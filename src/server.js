require('dotenv').config();
const path = require('path');
const express = require('express'), helmet = require('helmet'), rateLimit = require('express-rate-limit'),
  jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs'), { Pool } = require('pg'), crypto = require('crypto'),
  multer = require('multer'), pdfParse = require('pdf-parse'), mammoth = require('mammoth');

const dbUrl = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
let pool = null;
if (dbUrl) {
  const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocalDb ? false : { rejectUnauthorized: false },
    max: 20
  });
  pool.on('error', (err) => console.error('pg pool error:', err.message));
}

const SECRET = process.env.JWT_SECRET || 'examflow_jwt_secret_mvsrec_production_secure_token_2026';

let migrationPromise = null;
let migrated = false;

const q = async (s, p, c = pool) => {
  if (!c) {
    const err = new Error('Database not configured. Please attach Vercel Postgres in Storage or set DATABASE_URL.');
    err.status = 503;
    throw err;
  }
  if (!migrated && !migrationPromise) {
    migrationPromise = (async () => {
      try {
        const client = await c.connect();
        try {
          const res = await client.query("SELECT to_regclass('public.users') AS exists;");
          if (!res.rows[0] || !res.rows[0].exists) {
            console.log('[Auto-migrate] Running migration on first request...');
            const migrate = require('./migrate');
            await migrate();
          }
          migrated = true;
        } finally {
          client.release();
        }
      } catch (err) {
        console.error('[Auto-migrate] Migration check error:', err.message);
      }
    })();
  }
  if (migrationPromise) {
    await migrationPromise;
  }
  return (await c.query(s, p)).rows;
};

const app = express();
app.use(helmet({ contentSecurityPolicy: false }), express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    database_connected: !!pool,
    timestamp: new Date().toISOString()
  });
});

// Rate limiting with support for shared campus IP / NAT
const authKey = req => (req.headers.authorization || req.ip);
app.use('/api/auth/login', rateLimit({ windowMs: 60000, max: 100, keyGenerator: req => req.ip }));
app.use('/api', rateLimit({ windowMs: 60000, max: 3000, keyGenerator: authKey }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const h=f=>(req,res,next)=>f(req,res,next).catch(next);
const audit=(u,a,d)=>q('INSERT INTO audit_logs(user_id,action,detail) VALUES($1,$2,$3)',[u,a,d||{}]);
const auth=(...roles)=>(req,res,next)=>{
  try{req.user=jwt.verify((req.headers.authorization||'').slice(7),SECRET)}catch{return res.status(401).json({error:'Unauthorized'})}
  if(roles.length&&!roles.includes(req.user.role))return res.status(403).json({error:'Forbidden'});next()};
const isAdmin=u=>u.role==='admin';
const isFaculty=u=>u.role==='faculty'||u.role==='admin';
const ownsCourse=async(u,cid)=>{
  if(isAdmin(u))return true;
  const[c]=await q(`SELECT 1 FROM courses c WHERE c.id=$1 AND (c.faculty_id=$2 OR EXISTS (SELECT 1 FROM course_faculty cf WHERE cf.course_id=c.id AND cf.faculty_id=$2))`,[cid,u.id]);
  return Boolean(c);
};
const ownsTest=async(u,tid)=>{
  if(isAdmin(u)){const[t]=await q('SELECT * FROM tests WHERE id=$1',[tid]);return t||null}
  const[t]=await q(`SELECT t.*, c.faculty_id AS course_faculty_id 
    FROM tests t JOIN courses c ON c.id=t.course_id 
    WHERE t.id=$1 AND (t.created_by=$2 OR c.faculty_id=$2 OR EXISTS (SELECT 1 FROM course_faculty cf WHERE cf.course_id=c.id AND cf.faculty_id=$2))`,[tid,u.id]);
  if(t)return t;
  return null;
};
const ownsQuestion=async(u,qid)=>{
  if(isAdmin(u))return true;
  const[qn]=await q(`SELECT q.*, c.faculty_id AS course_faculty_id 
    FROM questions q JOIN courses c ON c.id=q.course_id 
    WHERE q.id=$1 AND (q.created_by=$2 OR c.faculty_id=$2 OR EXISTS (SELECT 1 FROM course_faculty cf WHERE cf.course_id=c.id AND cf.faculty_id=$2))`,[qid,u.id]);
  return Boolean(qn);
};

// ---- HIGH-ACCURACY QUESTION EXTRACTOR (MATHS & PROGRAMMING AWARE) ----
function extractInlineOptions(line) {
  const markerRegex = /(?:^|\s+)(?:\(([A-Ha-h1-9])\)|([A-Ha-h1-9])(?:\.|\)|:|\]|-))\s+/g;
  const matches = [];
  let m;
  while ((m = markerRegex.exec(line)) !== null) {
    const key = (m[1] || m[2]).toUpperCase();
    matches.push({
      key,
      startIndex: m.index,
      contentStart: m.index + m[0].length
    });
  }

  if (matches.length < 2) return null;

  const firstKey = matches[0].key;
  const isLetter = /^[A-D]$/.test(firstKey);
  const isDigit = /^[1-4]$/.test(firstKey);
  if (!isLetter && !isDigit) return null;

  for (let i = 0; i < matches.length; i++) {
    const expected = isLetter ? String.fromCharCode(65 + i) : String(1 + i);
    if (matches[i].key !== expected) return null;
  }

  const options = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].contentStart;
    const end = (i + 1 < matches.length) ? matches[i + 1].startIndex : line.length;
    options.push(line.substring(start, end).trim());
  }

  return options;
}

function parseQuestionsFromText(rawText) {
  if (!rawText) return [];
  const text = String(rawText).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = text.split('\n');

  const qStartRegex = /^\s*(?:Q(?:uestion)?\s*(\d+)[:.)-]?|(\d+)\s*[:.)-])\s+(.*)/i;
  const optStartRegex = /^\s*(?:\(([A-Ha-h1-9])\)|([A-Ha-h1-9])(?:\.|\)|:|\]|-))\s+(.*)/;

  const questionsRaw = [];
  let currentQ = null;
  let expectedQNum = 1;

  for (let rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const qMatch = trimmed.match(qStartRegex);
    const isInline = extractInlineOptions(trimmed);
    let isNewQ = false;
    let qNum = null;

    if (qMatch && !isInline) {
      qNum = parseInt(qMatch[1] || qMatch[2], 10);
      const isEnclosedParen = /^\s*\(\d+\)/.test(trimmed);
      const hasOptions = currentQ && currentQ.hasOptions;

      if (!isEnclosedParen) {
        if (!currentQ && qNum <= 2) {
          isNewQ = true;
        } else if (currentQ && (hasOptions || currentQ.hasAnswer)) {
          isNewQ = true;
        } else if (currentQ && qNum === expectedQNum) {
          isNewQ = true;
        }
      }
    }

    if (isNewQ) {
      if (currentQ) questionsRaw.push(currentQ);
      currentQ = { num: qNum, lines: [trimmed], hasOptions: false, hasAnswer: false };
      expectedQNum = qNum + 1;
    } else {
      if (!currentQ) {
        currentQ = { num: 1, lines: [trimmed], hasOptions: false, hasAnswer: false };
      } else {
        currentQ.lines.push(trimmed);
      }

      if (isInline || optStartRegex.test(trimmed)) {
        currentQ.hasOptions = true;
      }
      if (/^(?:correct\s*answer|correct\s*option|correct|answer|ans|key|sol|solution)\s*[:.\-]/i.test(trimmed)) {
        currentQ.hasAnswer = true;
      }
    }
  }

  if (currentQ) questionsRaw.push(currentQ);

  let blocksToProcess = questionsRaw.map(q => q.lines);
  if (blocksToProcess.length <= 1 && text.includes('\n\n')) {
    blocksToProcess = text.split(/\n\s*\n+/).map(b => b.split('\n').map(l => l.trim()).filter(Boolean));
  }

  const out = [];
  for (let lines of blocksToProcess) {
    if (!lines || !lines.length) continue;

    let questionLines = [];
    let options = [];
    let answerText = null;
    let marks = 1;
    let explanation = '';

    for (let i = 0; i < lines.length; i++) {
      let l = lines[i];

      // 1. First line of block is always the question text
      if (i === 0) {
        const cleaned = l.replace(/^\s*(?:Q(?:uestion)?\s*[\d.]+\s*[:.)-]?|\(?\d+\s*[:.)-])\s*/i, '');
        questionLines.push(cleaned || l);
        continue;
      }

      // Marks
      let mMarks = l.match(/(?:\[|\()?\s*marks?\s*[:\-]?\s*([\d.]+)\s*(?:marks?|pts?|m)?(?:\s*\]|\))?/i)
        || l.match(/(?:\[|\()\s*([\d.]+)\s*(?:marks?|pts?|m)\s*(?:\]|\))/i);
      if (mMarks) {
        marks = +mMarks[1] || 1;
        l = l.replace(mMarks[0], '').trim();
        if (!l) continue;
      }

      // Answer
      let mAns = l.match(/^(?:correct\s*answer|correct\s*option|correct|answer|ans|key|sol|solution)\s*[:.\-]\s*(.+)/i);
      if (mAns) {
        answerText = mAns[1].trim();
        continue;
      }

      // Explanation
      let mExp = l.match(/^(?:explanation|exp)\s*[:.\-]\s*(.+)/i);
      if (mExp) {
        explanation = mExp[1].trim();
        continue;
      }

      // Inline multiple options: e.g. "A. input() B. print() C. show() D. display()" or "1. 3 2. 5 3. 7 4. 10"
      const inlineOpts = extractInlineOptions(l);
      if (inlineOpts && inlineOpts.length >= 2) {
        options.push(...inlineOpts);
        continue;
      }

      // Single letter option: "A. Text", "A) Text", "(A) Text"
      let mOptLetter = l.match(/^(?:\(([A-Ha-h])\)|([A-Ha-h])(?:\.|\)|:|\]|-))\s+(.+)/);
      if (mOptLetter) {
        options.push(mOptLetter[3].trim());
        continue;
      }

      // Single number option: "(1) Text", "1. Text", "1) Text"
      let mOptNum = l.match(/^(?:\(([1-9])\)|([1-9])(?:\.|\)|:|\]|-))\s+(.+)/);
      if (mOptNum && questionLines.length > 0) {
        options.push(mOptNum[3].trim());
        continue;
      }

      // Standalone True / False
      if (/^(?:true|false)$/i.test(l) && options.length < 2) {
        options.push(l.charAt(0).toUpperCase() + l.slice(1).toLowerCase());
        continue;
      }

      // Question continuation line (before options/answers)
      if (options.length === 0 && !answerText) {
        questionLines.push(l);
      }
    }

    const qText = questionLines.join(' ').trim();
    if (!qText || (options.length === 0 && !answerText)) continue;

    let correctIdx = [];
    let qType = 'single';

    if (answerText) {
      if (/^(?:true|t)$/i.test(answerText)) {
        qType = 'true_false';
        correctIdx = ['true'];
      } else if (/^(?:false|f)$/i.test(answerText)) {
        qType = 'true_false';
        correctIdx = ['false'];
      } else {
        // Leading option letter or digit: e.g. "B. print()" -> "B", "(B)" -> "B", "(1)" -> 0, "2. print()" -> 1
        const leadingKeyMatch = answerText.match(/^(?:\(?([A-Ha-h1-9])\)?(?:\.|\)|:|-|\s+|$))/);
        if (leadingKeyMatch) {
          const k = leadingKeyMatch[1].toUpperCase();
          if (/^[A-H]$/.test(k)) {
            const idx = k.charCodeAt(0) - 65;
            if (options.length === 0 || idx < options.length) {
              correctIdx = [idx];
            }
          } else if (/^[1-9]$/.test(k)) {
            const idx = +k - 1;
            if (options.length === 0 || idx < options.length) {
              correctIdx = [idx];
            }
          }
        }

        // Check comma-separated multiple answers
        if (!correctIdx.length) {
          const multiLetters = [...answerText.matchAll(/\b([A-Ha-h])\b/g)].map(m => m[1].toUpperCase());
          if (multiLetters.length >= 2) {
            correctIdx = multiLetters.map(x => x.charCodeAt(0) - 65);
            qType = 'multiple';
          }
        }

        // Direct option text match
        if (!correctIdx.length && options.length) {
          const cleanAns = answerText.toLowerCase().replace(/^(?:option\s*)?[a-h1-9][.:)\s-]*/i, '').trim();
          const rawAns = answerText.toLowerCase().trim();
          let matchIdx = options.findIndex(opt => opt.toLowerCase().trim() === rawAns);
          if (matchIdx === -1 && cleanAns) {
            matchIdx = options.findIndex(opt => opt.toLowerCase().trim() === cleanAns);
          }
          if (matchIdx !== -1) {
            correctIdx = [matchIdx];
          }
        }
      }
    }

    if (options.length === 2 && /true/i.test(options[0]) && /false/i.test(options[1])) {
      qType = 'true_false';
      if (correctIdx.length === 1 && typeof correctIdx[0] === 'number') {
        correctIdx = [correctIdx[0] === 0 ? 'true' : 'false'];
      }
    }

    out.push({
      type: qType,
      text: qText,
      options: qType === 'true_false' && (!options || options.length < 2) ? ['True', 'False'] : options,
      correct: correctIdx,
      marks: marks || 1,
      explanation: explanation || '',
      needs_review: !options.length || !correctIdx.length
    });
  }
  return out;
}

// ---- USER PROFILE HELPER ----
const userProfile = u => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  roll_number: u.roll_number || '',
  employee_id: u.employee_id || '',
  department: u.department || '',
  designation: u.designation || '',
  year_sem: u.year_sem || '',
  phone: u.phone || '',
  specialization: u.specialization || '',
  auth_provider: u.auth_provider || 'local',
  avatar_url: u.avatar_url || '',
  created_at: u.created_at
});

// ---- AUTH ----
app.post('/api/auth/login',h(async(req,res)=>{
  const{email,password}=req.body||{};
  const[u]=await q('SELECT * FROM users WHERE email=$1',[String(email||'').toLowerCase()]);
  if(u&&u.locked_until&&u.locked_until>new Date())return res.status(429).json({error:'Account temporarily locked'});
  const ok=u&&u.status==='active'&&await bcrypt.compare(String(password||''),u.password_hash);
  if(!ok){
    if(u)await q("UPDATE users SET failed_logins=failed_logins+1,locked_until=CASE WHEN failed_logins+1>=5 THEN now()+interval '15 minutes' END WHERE id=$1",[u.id]);
    return res.status(401).json({error:'Invalid credentials'});
  }
  await q('UPDATE users SET failed_logins=0,locked_until=NULL WHERE id=$1',[u.id]);
  res.json({token:jwt.sign({id:u.id,role:u.role},SECRET,{expiresIn:'2h'}),user:userProfile(u)});
}));

// ---- ROLE-BASED REGISTRATION (Faculty & Student) ----
app.post('/api/auth/register',h(async(req,res)=>{
  const b=req.body||{};
  const role=b.role==='faculty'?'faculty':'student';
  const name=String(b.name||'').trim();
  const email=String(b.email||'').trim().toLowerCase();
  const password=String(b.password||'');

  if(!name||!email||!password||password.length<8) {
    return res.status(400).json({error:'Name, valid email, and password (8+ chars) are required'});
  }

  try {
    const[u]=await q(`INSERT INTO users(name,email,password_hash,role,roll_number,employee_id,department,designation,year_sem,phone,specialization,auth_provider)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'local')
      RETURNING *`,
      [name,email,await bcrypt.hash(password,12),role,b.roll_number||null,b.employee_id||null,b.department||null,b.designation||null,b.year_sem||null,b.phone||null,b.specialization||null]);
    
    await audit(u.id,'user.register',{role:u.role});
    res.status(201).json({token:jwt.sign({id:u.id,role:u.role},SECRET,{expiresIn:'2h'}),user:userProfile(u)});
  } catch(e) {
    if(e.code==='23505') return res.status(409).json({error:'An account with this email already exists'});
    throw e;
  }
}));

// ---- GOOGLE AUTHENTICATION & MULTI-PROVIDER AUTH ----
app.post('/api/auth/google',h(async(req,res)=>{
  const{email,name,role,avatar_url}=req.body||{};
  if(!email)return res.status(400).json({error:'Google email is required'});
  const cleanEmail=String(email).trim().toLowerCase();
  const adminEmail=(process.env.ADMIN_EMAIL||'sriman_cse@mvsrec.edu.in').toLowerCase().trim();
  let[u]=await q('SELECT * FROM users WHERE email=$1',[cleanEmail]);

  if(!u){
    // Auto-register: if email matches designated institution admin email, grant admin role
    const isTargetAdmin = cleanEmail === adminEmail;
    const targetRole = isTargetAdmin ? 'admin' : (role === 'faculty' ? 'faculty' : 'student');
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const[created]=await q(`INSERT INTO users(name,email,password_hash,role,auth_provider,avatar_url)
      VALUES($1,$2,$3,$4,'google',$5) RETURNING *`,
      [name||cleanEmail.split('@')[0],cleanEmail,await bcrypt.hash(randomPassword,10),targetRole,avatar_url||null]);
    u=created;
    await audit(u.id,'user.register.google',{role:u.role});
  } else {
    // Existing user: update avatar if present
    if(!u.avatar_url&&avatar_url){
      await q('UPDATE users SET avatar_url=$1 WHERE id=$2',[avatar_url,u.id]);
      u.avatar_url=avatar_url;
    }
  }

  if(u.status!=='active') return res.status(403).json({error:'Your account is deactivated or suspended'});
  await q('UPDATE users SET failed_logins=0,locked_until=NULL WHERE id=$1',[u.id]);
  res.json({token:jwt.sign({id:u.id,role:u.role},SECRET,{expiresIn:'2h'}),user:userProfile(u)});
}));

// ---- CURRENT USER PROFILE & STATS ----
app.get('/api/auth/me',auth(),h(async(req,res)=>{
  const[u]=await q('SELECT * FROM users WHERE id=$1',[req.user.id]);
  if(!u)return res.status(404).json({error:'User not found'});

  let stats={};
  if(u.role==='student'){
    const[eCount]=await q('SELECT COUNT(*)::int c FROM enrollments WHERE student_id=$1',[u.id]);
    const[aCount]=await q('SELECT COUNT(*)::int c, COALESCE(AVG(r.score),0)::numeric(5,1) avg_score FROM attempts a JOIN results r ON r.attempt_id=a.id WHERE a.student_id=$1',[u.id]);
    stats={enrolled_courses:eCount.c,completed_exams:aCount.c,avg_score:+aCount.avg_score||0};
  } else if(u.role==='faculty'){
    const[cCount]=await q('SELECT COUNT(*)::int c FROM courses WHERE faculty_id=$1',[u.id]);
    const[tCount]=await q('SELECT COUNT(*)::int c FROM tests WHERE created_by=$1',[u.id]);
    const[qCount]=await q('SELECT COUNT(*)::int c FROM questions WHERE created_by=$1 AND NOT archived',[u.id]);
    stats={courses_count:cCount.c,tests_count:tCount.c,questions_count:qCount.c};
  } else if(u.role==='admin'){
    const[uCount]=await q('SELECT COUNT(*)::int c FROM users');
    const[cCount]=await q('SELECT COUNT(*)::int c FROM courses');
    const[tCount]=await q('SELECT COUNT(*)::int c FROM tests');
    stats={total_users:uCount.c,total_courses:cCount.c,total_tests:tCount.c};
  }

  res.json({user:userProfile(u),stats});
}));

// ---- UPDATE OWN PROFILE ----
app.put('/api/auth/profile',auth(),h(async(req,res)=>{
  const b=req.body||{};
  const uId=req.user.id;
  const[existing]=await q('SELECT * FROM users WHERE id=$1',[uId]);
  if(!existing)return res.status(404).json({error:'User not found'});

  const[updated]=await q(`UPDATE users SET
    name=COALESCE($1,name),
    roll_number=COALESCE($2,roll_number),
    employee_id=COALESCE($3,employee_id),
    department=COALESCE($4,department),
    designation=COALESCE($5,designation),
    year_sem=COALESCE($6,year_sem),
    phone=COALESCE($7,phone),
    specialization=COALESCE($8,specialization),
    avatar_url=COALESCE($9,avatar_url)
    WHERE id=$10 RETURNING *`,
    [b.name||null,b.roll_number||null,b.employee_id||null,b.department||null,b.designation||null,b.year_sem||null,b.phone||null,b.specialization||null,b.avatar_url||null,uId]);
  
  await audit(uId,'user.profile_update',{});
  res.json({user:userProfile(updated)});
}));

// ---- ADMIN: USER MANAGEMENT ----
app.post('/api/users',auth('admin'),h(async(req,res)=>{
  const{name,email,password,role}=req.body;
  if(!name||!email||!['admin','faculty','student'].includes(role)||!password||password.length<10)return res.status(400).json({error:'name, email, role, password(>=10) required'});
  const[u]=await q('INSERT INTO users(name,email,password_hash,role) VALUES($1,lower($2),$3,$4) RETURNING id,name,email,role',[name,email,await bcrypt.hash(password,12),role]);
  await audit(req.user.id,'user.create',{id:u.id});res.status(201).json(u)}));

app.get('/api/users',auth('admin'),h(async(req,res)=>res.json(await q('SELECT id,name,email,role,status,created_at,roll_number,employee_id,department,designation,year_sem,phone,specialization,auth_provider FROM users ORDER BY id'))));

app.put('/api/users/:id',auth('admin'),h(async(req,res)=>{
  const{name,email,role,password}=req.body;
  const[existing]=await q('SELECT * FROM users WHERE id=$1',[req.params.id]);
  if(!existing)return res.status(404).json({error:'User not found'});
  let hash=existing.password_hash;
  if(password&&password.length>=10)hash=await bcrypt.hash(password,12);
  const[updated]=await q('UPDATE users SET name=$1, email=lower($2), role=$3, password_hash=$4 WHERE id=$5 RETURNING id,name,email,role,status',
    [name||existing.name,email||existing.email,role||existing.role,hash,req.params.id]);
  await audit(req.user.id,'user.update',{id:req.params.id});
  res.json(updated);
}));

app.patch('/api/users/:id/status',auth('admin'),h(async(req,res)=>{
  await q('UPDATE users SET status=$1 WHERE id=$2',[req.body.status,req.params.id]);
  await audit(req.user.id,'user.status',req.body);res.json({ok:true})}));

app.delete('/api/users/:id',auth('admin'),h(async(req,res)=>{
  const uid=req.params.id;
  if(+uid===+req.user.id)return res.status(400).json({error:'Cannot delete your own admin account'});
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    await c.query('DELETE FROM results WHERE attempt_id IN (SELECT id FROM attempts WHERE student_id=$1)',[uid]);
    await c.query('DELETE FROM responses WHERE attempt_id IN (SELECT id FROM attempts WHERE student_id=$1)',[uid]);
    await c.query('DELETE FROM attempts WHERE student_id=$1',[uid]);
    await c.query('DELETE FROM enrollments WHERE student_id=$1',[uid]);
    await c.query('UPDATE courses SET faculty_id=NULL WHERE faculty_id=$1',[uid]);
    await c.query('DELETE FROM audit_logs WHERE user_id=$1',[uid]);
    await c.query('DELETE FROM users WHERE id=$1',[uid]);
    await c.query('COMMIT');
    res.json({deleted:true});
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
}));

// ---- COURSES MANAGEMENT ----
app.get('/api/courses',auth(),h(async(req,res)=>{
  const u=req.user;
  if(u.role==='student'){
    return res.json(await q(`SELECT c.*, f.name faculty_name, f.email faculty_email,
      (SELECT string_agg(u2.name, ', ') FROM course_faculty cf2 JOIN users u2 ON u2.id=cf2.faculty_id WHERE cf2.course_id=c.id) faculty_names,
      (SELECT json_agg(json_build_object('id', u2.id, 'name', u2.name, 'email', u2.email)) FROM course_faculty cf2 JOIN users u2 ON u2.id=cf2.faculty_id WHERE cf2.course_id=c.id) faculty_list,
      (SELECT COUNT(*) FROM tests t WHERE t.course_id=c.id AND t.published=true) tests_count
      FROM courses c JOIN enrollments e ON e.course_id=c.id
      LEFT JOIN users f ON f.id=c.faculty_id WHERE e.student_id=$1 ORDER BY c.id`,[u.id]));
  }
  res.json(await q(`SELECT c.*, f.name faculty_name, f.email faculty_email,
    (SELECT string_agg(u2.name, ', ') FROM course_faculty cf2 JOIN users u2 ON u2.id=cf2.faculty_id WHERE cf2.course_id=c.id) faculty_names,
    (SELECT json_agg(json_build_object('id', u2.id, 'name', u2.name, 'email', u2.email)) FROM course_faculty cf2 JOIN users u2 ON u2.id=cf2.faculty_id WHERE cf2.course_id=c.id) faculty_list,
    (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) students_count,
    (SELECT COUNT(*) FROM tests t WHERE t.course_id=c.id) tests_count,
    (SELECT COUNT(*) FROM questions qn WHERE qn.course_id=c.id AND NOT qn.archived) questions_count
    FROM courses c LEFT JOIN users f ON f.id=c.faculty_id ORDER BY c.id`));
}));

app.get('/api/courses/catalog',auth('student'),h(async(req,res)=>{
  const u=req.user;
  res.json(await q(`SELECT c.*, f.name faculty_name, f.email faculty_email,
    (SELECT string_agg(u2.name, ', ') FROM course_faculty cf2 JOIN users u2 ON u2.id=cf2.faculty_id WHERE cf2.course_id=c.id) faculty_names,
    EXISTS(SELECT 1 FROM enrollments e WHERE e.course_id=c.id AND e.student_id=$1) enrolled,
    (SELECT COUNT(*) FROM tests t WHERE t.course_id=c.id AND t.published=true) tests_count
    FROM courses c LEFT JOIN users f ON f.id=c.faculty_id ORDER BY c.id`,[u.id]));
}));

app.get('/api/courses/:id/students',auth('admin','faculty'),h(async(req,res)=>{
  if(!(await ownsCourse(req.user,req.params.id)))return res.status(403).json({error:'Forbidden: You do not have permission to view students for this course'});
  res.json(await q(`SELECT u.id, u.name, u.email, u.roll_number, u.department, u.year_sem, e.created_at enrolled_at
    FROM enrollments e JOIN users u ON u.id=e.student_id
    WHERE e.course_id=$1 ORDER BY u.name`,[req.params.id]));
}));

app.get('/api/courses/:id/enrollment-candidates',auth('admin','faculty'),h(async(req,res)=>{
  if(!(await ownsCourse(req.user,req.params.id)))return res.status(403).json({error:'Forbidden: You do not have permission to view enrollment candidates for this course'});
  const cid=req.params.id;
  const students=await q(`SELECT u.id, u.name, u.email, u.roll_number, u.department, u.year_sem,
    EXISTS(SELECT 1 FROM enrollments e WHERE e.course_id=$1 AND e.student_id=u.id) enrolled,
    (SELECT e.created_at FROM enrollments e WHERE e.course_id=$1 AND e.student_id=u.id) enrolled_at
    FROM users u
    WHERE u.role='student' AND u.status='active'
    ORDER BY u.department NULLS LAST, u.roll_number NULLS LAST, u.name`,[cid]);
  res.json(students);
}));

app.post('/api/courses/:id/self-enroll',auth('student'),h(async(req,res)=>{
  await q('INSERT INTO enrollments(course_id,student_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,req.user.id]);
  res.json({enrolled:true});
}));

app.post('/api/courses',auth('admin','faculty'),h(async(req,res)=>{
  const{code,name,faculty_id,faculty_ids}=req.body;
  const fids = Array.isArray(faculty_ids) && faculty_ids.length ? faculty_ids.map(Number) : [Number(faculty_id||req.user.id)];
  const primaryFid = fids[0] || req.user.id;
  const[c]=await q('INSERT INTO courses(code,name,faculty_id) VALUES($1,$2,$3) RETURNING *',[code,name,primaryFid]);
  for(const fid of fids){
    await q('INSERT INTO course_faculty(course_id, faculty_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[c.id, fid]);
  }
  res.status(201).json(c);
}));

app.put('/api/courses/:id',auth('admin','faculty'),h(async(req,res)=>{
  if(!(await ownsCourse(req.user,req.params.id)))return res.status(403).json({error:'Forbidden: You do not have permission to manage this course'});
  const{code,name,faculty_id,faculty_ids}=req.body;
  let primaryFid;
  if(Array.isArray(faculty_ids) && faculty_ids.length){
    primaryFid = Number(faculty_ids[0]);
  } else if(faculty_id){
    primaryFid = Number(faculty_id);
  } else if(!isAdmin(req.user)){
    primaryFid = req.user.id;
  }
  const[c]=await q('UPDATE courses SET code=$1, name=$2, faculty_id=COALESCE($3, faculty_id) WHERE id=$4 RETURNING *',[code,name,primaryFid||null,req.params.id]);
  if(!c)return res.status(404).json({error:'Course not found'});

  if(Array.isArray(faculty_ids)){
    await q('DELETE FROM course_faculty WHERE course_id=$1',[req.params.id]);
    for(const fid of faculty_ids){
      await q('INSERT INTO course_faculty(course_id, faculty_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id, Number(fid)]);
    }
  } else if(faculty_id){
    await q('INSERT INTO course_faculty(course_id, faculty_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id, Number(faculty_id)]);
  }
  res.json(c);
}));

app.delete('/api/courses/:id',auth('admin'),h(async(req,res)=>{
  const cid=req.params.id;
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    await c.query('DELETE FROM results WHERE attempt_id IN (SELECT a.id FROM attempts a JOIN tests t ON t.id=a.test_id WHERE t.course_id=$1)',[cid]);
    await c.query('DELETE FROM responses WHERE attempt_id IN (SELECT a.id FROM attempts a JOIN tests t ON t.id=a.test_id WHERE t.course_id=$1)',[cid]);
    await c.query('DELETE FROM attempts WHERE test_id IN (SELECT id FROM tests WHERE course_id=$1)',[cid]);
    await c.query('DELETE FROM test_questions WHERE test_id IN (SELECT id FROM tests WHERE course_id=$1)',[cid]);
    await c.query('DELETE FROM tests WHERE course_id=$1',[cid]);
    await c.query('DELETE FROM questions WHERE course_id=$1',[cid]);
    await c.query('DELETE FROM enrollments WHERE course_id=$1',[cid]);
    await c.query('DELETE FROM course_faculty WHERE course_id=$1',[cid]);
    await c.query('DELETE FROM courses WHERE id=$1',[cid]);
    await c.query('COMMIT');
    res.json({deleted:true});
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
}));

app.post('/api/courses/:id/enroll',auth('admin','faculty'),h(async(req,res)=>{
  if(!(await ownsCourse(req.user,req.params.id)))return res.status(403).json({error:'Forbidden: You do not have permission to enroll students into this course'});
  for(const s of req.body.student_ids||[])await q('INSERT INTO enrollments VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,s]);
  res.json({ok:true});
}));

// ---- QUESTIONS (Create, Read, Update, Delete) ----
const QTYPES=['single','multiple','true_false','fill','numerical','short'];
app.post('/api/questions',auth('admin','faculty'),h(async(req,res)=>{
  const b=req.body;if(!QTYPES.includes(b.type)||!b.text)return res.status(400).json({error:'invalid question'});
  if(!(await ownsCourse(req.user,b.course_id)))return res.status(403).json({error:'Forbidden: You can only add questions to courses you manage'});
  const[r]=await q(`INSERT INTO questions(course_id,created_by,type,text,options,correct,marks,negative_marks,difficulty,topic,explanation)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[b.course_id,req.user.id,b.type,b.text,JSON.stringify(b.options||[]),JSON.stringify(b.correct||[]),b.marks??1,b.negative_marks??0,b.difficulty||'medium',b.topic,b.explanation]);
  res.status(201).json(r)}));

app.get('/api/questions',auth('admin','faculty'),h(async(req,res)=>{
  const cid=req.query.course_id;
  if(cid){
    if(!(await ownsCourse(req.user, cid))) return res.status(403).json({error:'Forbidden: You can only view questions for courses you manage'});
    return res.json(await q('SELECT * FROM questions WHERE course_id=$1 AND NOT archived ORDER BY id DESC',[cid]));
  }
  if(isAdmin(req.user)){
    return res.json(await q('SELECT * FROM questions WHERE NOT archived ORDER BY id DESC'));
  }
  res.json(await q(`SELECT q.* FROM questions q 
    JOIN courses c ON c.id=q.course_id
    WHERE NOT q.archived AND (q.created_by=$1 OR c.faculty_id=$1 OR EXISTS (SELECT 1 FROM course_faculty cf WHERE cf.course_id=c.id AND cf.faculty_id=$1))
    ORDER BY q.id DESC`,[req.user.id]));
}));

app.put('/api/questions/:id',auth('admin','faculty'),h(async(req,res)=>{
  if(!(await ownsQuestion(req.user,req.params.id)))return res.status(403).json({error:'Forbidden: You can only modify questions from courses you manage'});
  const b=req.body;
  const[r]=await q(`UPDATE questions SET text=$1, type=$2, options=$3, correct=$4, marks=$5, negative_marks=$6 WHERE id=$7 RETURNING *`,
    [b.text,b.type,JSON.stringify(b.options||[]),JSON.stringify(b.correct||[]),b.marks??1,b.negative_marks??0,req.params.id]);
  if(!r)return res.status(404).json({error:'Question not found'});
  res.json(r);
}));

app.delete('/api/questions/:id',auth('admin','faculty'),h(async(req,res)=>{
  if(!(await ownsQuestion(req.user,req.params.id)))return res.status(403).json({error:'Forbidden: You can only archive questions from courses you manage'});
  await q('UPDATE questions SET archived=true WHERE id=$1',[req.params.id]);
  res.json({deleted:true});
}));

app.post('/api/questions/bulk-delete',auth('admin','faculty'),h(async(req,res)=>{
  const { question_ids } = req.body || {};
  if(!Array.isArray(question_ids) || !question_ids.length){
    return res.status(400).json({error:'No question IDs provided for deletion'});
  }
  const validIds = [];
  for(const qid of question_ids){
    if(await ownsQuestion(req.user, qid)){
      validIds.push(Number(qid));
    }
  }
  if(!validIds.length){
    return res.status(403).json({error:'Forbidden: You do not have permission to delete the selected questions'});
  }
  await q('UPDATE questions SET archived=true WHERE id=ANY($1)',[validIds]);
  await audit(req.user.id, 'questions.bulk_delete', { count: validIds.length, ids: validIds });
  res.json({ success: true, count: validIds.length, ids: validIds });
}));

// Smart Text Extractor
app.post('/api/questions/parse',auth('admin','faculty'),h(async(req,res)=>{
  const out=parseQuestionsFromText(req.body.text||'');
  res.json(out);
}));

async function extractTextFromPDF(buffer){
  const pdfModule=require('pdf-parse');
  if(typeof pdfModule==='function'){
    const data=await pdfModule(buffer);
    return data.text||'';
  }
  if(pdfModule.PDFParse){
    const parser=new pdfModule.PDFParse({data:buffer});
    const res=await parser.getText();
    if(typeof parser.destroy==='function')await parser.destroy();
    return res.text||(res.pages?res.pages.map(p=>p.text).join('\n'):'');
  }
  throw new Error('PDF extractor engine unavailable');
}

// Smart File Extractor (PDF, DOCX, TXT)
app.post('/api/questions/upload',auth('admin','faculty'),upload.single('file'),h(async(req,res)=>{
  if(!req.file)return res.status(400).json({error:'No document file uploaded'});
  const fname=(req.file.originalname||'').toLowerCase();
  let extractedText='';

  try{
    if(fname.endsWith('.pdf')||req.file.mimetype==='application/pdf'){
      extractedText=await extractTextFromPDF(req.file.buffer);
    }else if(fname.endsWith('.docx')||fname.endsWith('.doc')||req.file.mimetype.includes('word')){
      const mammoth=require('mammoth');
      const docxData=await mammoth.extractRawText({buffer:req.file.buffer});
      extractedText=docxData.value||'';
    }else{
      extractedText=req.file.buffer.toString('utf-8');
    }
  }catch(err){
    console.error('File extraction error:',err);
    return res.status(400).json({error:'Could not parse document file: '+err.message});
  }

  const questions=parseQuestionsFromText(extractedText);
  res.json({text:extractedText,questions});
}));

// ---- SHAREABLE TEST ROUTES ----
app.get('/api/tests/join/:code',h(async(req,res)=>{
  const[t]=await q(`SELECT t.id,t.title,t.start_at,t.end_at,t.duration_min,t.pass_marks,c.name course_name,c.code course_code
   FROM tests t JOIN courses c ON c.id=t.course_id WHERE t.share_code=$1 AND t.published`,[req.params.code]);
  if(!t)return res.status(404).json({error:'Test not found or not published'});res.json(t)}));

app.post('/api/tests/join/:code',auth('student'),h(async(req,res)=>{
  const[t]=await q('SELECT t.* FROM tests t WHERE t.share_code=$1 AND t.published',[req.params.code]);
  if(!t)return res.status(404).json({error:'Test not found'});
  await q('INSERT INTO enrollments(course_id,student_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[t.course_id,req.user.id]);
  res.json({enrolled:true,test_id:t.id})}));

// ---- TESTS (Create, Read, Update, Delete) ----
app.post('/api/tests',auth('admin','faculty'),h(async(req,res)=>{
  const b=req.body;
  if(!(await ownsCourse(req.user,b.course_id)))return res.status(403).json({error:'Forbidden: You can only create tests for courses you manage'});
  const ids=b.question_ids||[];const ok=await q('SELECT id FROM questions WHERE id=ANY($1) AND course_id=$2 AND NOT archived',[ids,b.course_id]);
  if(ok.length!==ids.length||!ids.length)return res.status(400).json({error:'Invalid question set'});
  if(new Date(b.end_at)<=new Date(b.start_at)||b.duration_min<1)return res.status(400).json({error:'Invalid schedule'});
  const[t]=await q('INSERT INTO tests(course_id,created_by,title,start_at,end_at,duration_min,pass_marks,shuffle,per_question_timer) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
   [b.course_id,req.user.id,b.title,b.start_at,b.end_at,b.duration_min,b.pass_marks||0,b.shuffle!==false,+b.per_question_timer||0]);
  for(let i=0;i<ids.length;i++)await q('INSERT INTO test_questions VALUES($1,$2,$3)',[t.id,ids[i],i]);
  await audit(req.user.id,'test.create',{id:t.id});res.status(201).json(t)}));

app.put('/api/tests/:id',auth('admin','faculty'),h(async(req,res)=>{
  const tid=req.params.id;
  const existing=await ownsTest(req.user,tid);
  if(!existing)return res.status(403).json({error:'Forbidden: You do not have permission to modify this test'});
  const b=req.body;
  const[t]=await q('UPDATE tests SET title=$1, start_at=$2, end_at=$3, duration_min=$4, pass_marks=$5, per_question_timer=COALESCE($6, per_question_timer) WHERE id=$7 RETURNING *',
    [b.title,b.start_at,b.end_at,b.duration_min,b.pass_marks||0,b.per_question_timer!==undefined?+b.per_question_timer:null,tid]);
  if(!t)return res.status(404).json({error:'Test not found'});
  if(Array.isArray(b.question_ids)&&b.question_ids.length){
    await q('DELETE FROM test_questions WHERE test_id=$1',[tid]);
    for(let i=0;i<b.question_ids.length;i++)await q('INSERT INTO test_questions VALUES($1,$2,$3)',[tid,b.question_ids[i],i]);
  }
  res.json(t);
}));

app.delete('/api/tests/:id',auth('admin','faculty'),h(async(req,res)=>{
  const tid=req.params.id;
  const existing=await ownsTest(req.user,tid);
  if(!existing)return res.status(403).json({error:'Forbidden: You do not have permission to delete this test'});
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    await c.query('DELETE FROM results WHERE attempt_id IN (SELECT id FROM attempts WHERE test_id=$1)',[tid]);
    await c.query('DELETE FROM responses WHERE attempt_id IN (SELECT id FROM attempts WHERE test_id=$1)',[tid]);
    await c.query('DELETE FROM attempts WHERE test_id=$1',[tid]);
    await c.query('DELETE FROM test_questions WHERE test_id=$1',[tid]);
    await c.query('DELETE FROM tests WHERE id=$1',[tid]);
    await c.query('COMMIT');
    res.json({deleted:true});
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
}));

app.post('/api/tests/:id/publish',auth('admin','faculty'),h(async(req,res)=>{
  const existing=await ownsTest(req.user,req.params.id);
  if(!existing)return res.status(403).json({error:'Forbidden: You do not have permission to publish this test'});
  await q('UPDATE tests SET published=$1 WHERE id=$2',[req.body.published!==false,req.params.id]);
  await audit(req.user.id,'test.publish',{id:+req.params.id});res.json({ok:true})}));

app.post('/api/tests/:id/release',auth('admin','faculty'),h(async(req,res)=>{
  const existing=await ownsTest(req.user,req.params.id);
  if(!existing)return res.status(403).json({error:'Forbidden: You do not have permission to release results for this test'});
  await q('UPDATE tests SET results_released=$1 WHERE id=$2',[req.body.released!==false,req.params.id]);
  await audit(req.user.id,'test.release',{id:+req.params.id});res.json({ok:true})}));

app.post('/api/tests/:id/share',auth('admin','faculty'),h(async(req,res)=>{
  const t=await ownsTest(req.user,req.params.id);if(!t)return res.status(403).json({error:'Forbidden'});
  let code=t.share_code;
  if(!code){code=crypto.randomBytes(6).toString('hex');await q('UPDATE tests SET share_code=$1 WHERE id=$2',[code,t.id])}
  res.json({share_code:code,link:'/join/'+code})}));

app.get('/api/tests/:id/students',auth('admin','faculty'),h(async(req,res)=>{
  const t=await ownsTest(req.user,req.params.id);
  if(!t)return res.status(403).json({error:'Forbidden: You do not have permission to view students for this test'});
  res.json(await q(`SELECT u.id,u.name,u.email,u.roll_number,u.department,
   a.id attempt_id,a.submitted_at,a.started_at,a.warnings_count,a.tab_switches,a.is_blocked,a.blocked_reason,
   r.score,r.total,r.passed FROM tests t
   JOIN enrollments e ON e.course_id=t.course_id JOIN users u ON u.id=e.student_id
   LEFT JOIN attempts a ON a.test_id=t.id AND a.student_id=u.id
   LEFT JOIN results r ON r.attempt_id=a.id
   WHERE t.id=$1 ORDER BY u.name`,[req.params.id]))}));

app.get('/api/tests',auth(),h(async(req,res)=>{
  const u=req.user;
  if(u.role==='student'){
    return res.json(await q(`SELECT t.id,t.title,t.start_at,t.end_at,t.duration_min,t.pass_marks,c.code course_code,c.name course_name,
      a.submitted_at,a.id attempt_id
      FROM tests t JOIN enrollments e ON e.course_id=t.course_id AND e.student_id=$1
      JOIN courses c ON c.id=t.course_id
      LEFT JOIN attempts a ON a.test_id=t.id AND a.student_id=$1
      WHERE t.published ORDER BY t.start_at DESC`,[u.id]));
  }
  if(u.role==='faculty'){
    return res.json(await q(`SELECT t.*, c.code course_code, c.name course_name, u.name creator_name,
      (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id=t.id) questions_count,
      (SELECT COUNT(*) FROM attempts a WHERE a.test_id=t.id) attempts_count,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=t.course_id) enrolled_count
      FROM tests t JOIN courses c ON c.id=t.course_id
      LEFT JOIN users u ON u.id=t.created_by
      WHERE t.created_by=$1 OR c.faculty_id=$1 OR EXISTS (SELECT 1 FROM course_faculty cf WHERE cf.course_id=c.id AND cf.faculty_id=$1)
      ORDER BY t.id DESC`,[u.id]));
  }
  res.json(await q(`SELECT t.*, c.code course_code, c.name course_name, u.name creator_name,
    (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id=t.id) questions_count,
    (SELECT COUNT(*) FROM attempts a WHERE a.test_id=t.id) attempts_count,
    (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=t.course_id) enrolled_count
    FROM tests t JOIN courses c ON c.id=t.course_id
    LEFT JOIN users u ON u.id=t.created_by
    ORDER BY t.id DESC`));
}));

// ---- EXAM ENGINE ----
const rng=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const shuffle=(a,seed)=>{const r=rng(seed),x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
function isCorrect(qn,ans){if(ans==null||ans===''||(Array.isArray(ans)&&!ans.length))return null;const c=qn.correct;
  switch(qn.type){case'single':case'true_false':return String(ans)===String(c[0]);
    case'multiple':return JSON.stringify([...ans].map(Number).sort())===JSON.stringify(c.map(Number).sort());
    case'numerical':return Math.abs(Number(ans)-Number(c[0]))<1e-6;
    case'fill':return c.some(x=>String(x).trim().toLowerCase()===String(ans).trim().toLowerCase());
    default:return null}}
async function finalize(attemptId){
  if(!pool)return;
  const c=await pool.connect();try{await c.query('BEGIN');
    const[a]=await q('SELECT a.*,t.pass_marks FROM attempts a JOIN tests t ON t.id=a.test_id WHERE a.id=$1 FOR UPDATE OF a',[attemptId],c);
    if(!a||a.submitted_at){await c.query('ROLLBACK');return}
    const rows=await q(`SELECT qn.*,r.answer FROM test_questions tq JOIN questions qn ON qn.id=tq.question_id LEFT JOIN responses r ON r.attempt_id=$1 AND r.question_id=qn.id WHERE tq.test_id=$2`,[attemptId,a.test_id],c);
    let score=0,total=0,ok=0,bad=0,none=0;
    for(const r of rows){total+=+r.marks;const v=isCorrect(r,r.answer);
      if(v===true){score+=+r.marks;ok++}else if(v===false){score-=+r.negative_marks;bad++}else none++}
    await q('INSERT INTO results VALUES($1,$2,$3,$4,$5,$6,$7)',[attemptId,score,total,ok,bad,none,score>=a.pass_marks],c);
    await q('UPDATE attempts SET submitted_at=LEAST(now(),deadline) WHERE id=$1',[attemptId],c);await c.query('COMMIT')
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}

setInterval(()=>{
  if(!pool)return;
  q('SELECT id FROM attempts WHERE submitted_at IS NULL AND deadline<now()').then(r=>Promise.all(r.map(x=>finalize(x.id)))).catch(console.error);
},15000);

// ---- PROCTORING & ANTI-CHEATING CONTROLS ----
app.post('/api/attempts/:id/warning',auth('student'),h(async(req,res)=>{
  const[a]=await q('SELECT * FROM attempts WHERE id=$1 AND student_id=$2',[req.params.id,req.user.id]);
  if(!a)return res.status(404).json({error:'Attempt not found'});
  if(a.submitted_at)return res.status(409).json({error:'Attempt already submitted'});

  const curWarnings = a.warnings_count || 0;
  const nextWarnings = curWarnings + 1;
  const shouldBlock = nextWarnings >= 3;
  const reason = shouldBlock ? 'Exceeded maximum tab switch warnings (3/3). Test blocked by proctoring system.' : a.blocked_reason;

  const[updated]=await q(`UPDATE attempts SET 
    warnings_count=$1,
    tab_switches=COALESCE(tab_switches,0)+1,
    is_blocked=CASE WHEN $2 THEN true ELSE is_blocked END,
    blocked_reason=CASE WHEN $2 THEN $3 ELSE blocked_reason END
    WHERE id=$4 RETURNING id, warnings_count, tab_switches, is_blocked, blocked_reason`,
    [nextWarnings, shouldBlock, reason, a.id]);

  await audit(req.user.id, shouldBlock ? 'exam.proctor.blocked' : 'exam.proctor.warning', {
    attempt_id: a.id,
    warnings_count: nextWarnings,
    action: req.body.action || 'tab_switch'
  });

  res.json(updated);
}));

app.post('/api/attempts/:id/unblock',auth('admin','faculty'),h(async(req,res)=>{
  const[a]=await q('SELECT a.*, t.id test_id, t.course_id FROM attempts a JOIN tests t ON t.id=a.test_id WHERE a.id=$1',[req.params.id]);
  if(!a)return res.status(404).json({error:'Attempt not found'});
  if(!(await ownsTest(req.user, a.test_id)))return res.status(403).json({error:'Forbidden: You do not have permission to manage this exam attempt'});

  const[updated]=await q('UPDATE attempts SET is_blocked=false, blocked_reason=NULL, warnings_count=0 WHERE id=$1 RETURNING *',[a.id]);
  await audit(req.user.id,'exam.proctor.unblock',{attempt_id:a.id, student_id:a.student_id});
  res.json({unblocked:true, attempt:updated});
}));

app.post('/api/attempts/:id/block',auth('admin','faculty'),h(async(req,res)=>{
  const[a]=await q('SELECT a.*, t.id test_id, t.course_id FROM attempts a JOIN tests t ON t.id=a.test_id WHERE a.id=$1',[req.params.id]);
  if(!a)return res.status(404).json({error:'Attempt not found'});
  if(!(await ownsTest(req.user, a.test_id)))return res.status(403).json({error:'Forbidden: You do not have permission to manage this exam attempt'});

  const reason = req.body.reason || 'Manually blocked by instructor / proctor.';
  const[updated]=await q('UPDATE attempts SET is_blocked=true, blocked_reason=$2 WHERE id=$1 RETURNING *',[a.id, reason]);
  await audit(req.user.id,'exam.proctor.manual_block',{attempt_id:a.id, student_id:a.student_id, reason});
  res.json({blocked:true, attempt:updated});
}));

app.post('/api/tests/:id/start',auth('student'),h(async(req,res)=>{
  const[t]=await q('SELECT t.* FROM tests t JOIN enrollments e ON e.course_id=t.course_id AND e.student_id=$2 WHERE t.id=$1 AND t.published',[req.params.id,req.user.id]);
  if(!t)return res.status(404).json({error:'Test not available or you are not enrolled'});
  const now=new Date();if(now<t.start_at||now>t.end_at)return res.status(403).json({error:'Outside test window'});
  const deadline=new Date(Math.min(+now+t.duration_min*60000,+t.end_at));
  const[a]=await q('INSERT INTO attempts(test_id,student_id,deadline) VALUES($1,$2,$3) ON CONFLICT(test_id,student_id) DO UPDATE SET test_id=EXCLUDED.test_id RETURNING *',[t.id,req.user.id,deadline]);
  if(a.submitted_at||a.deadline<=now){await finalize(a.id);return res.status(409).json({error:'Attempt already finished',attempt_id:a.id})}
  if(a.is_blocked){
    return res.status(403).json({
      error: 'Exam attempt is BLOCKED: ' + (a.blocked_reason || 'Proctoring violation. Please contact your instructor.'),
      is_blocked: true,
      blocked_reason: a.blocked_reason,
      attempt_id: a.id,
      warnings_count: a.warnings_count
    });
  }
  let qs=await q('SELECT qn.id,qn.type,qn.text,qn.options,qn.marks FROM test_questions tq JOIN questions qn ON qn.id=tq.question_id WHERE tq.test_id=$1 ORDER BY tq.position',[t.id]);
  if(t.shuffle)qs=shuffle(qs,a.id);
  const saved=await q('SELECT question_id,answer,marked FROM responses WHERE attempt_id=$1',[a.id]);
  res.json({
    attempt_id:a.id,
    deadline:a.deadline,
    server_time:now,
    per_question_timer:t.per_question_timer||0,
    warnings_count:a.warnings_count||0,
    is_blocked:!!a.is_blocked,
    blocked_reason:a.blocked_reason||null,
    questions:qs,
    saved
  })}));

app.put('/api/attempts/:id/answers',auth('student'),h(async(req,res)=>{
  const[a]=await q('SELECT * FROM attempts WHERE id=$1 AND student_id=$2',[req.params.id,req.user.id]);
  if(!a)return res.status(404).json({error:'Not found'});
  if(a.is_blocked)return res.status(403).json({error:'Exam attempt is blocked by proctoring system',is_blocked:true});
  if(a.submitted_at||a.deadline<=new Date())return res.status(409).json({error:'Attempt closed'});
  const list=Array.isArray(req.body)?req.body:[req.body];
  for(const r of list)await q(`INSERT INTO responses(attempt_id,question_id,answer,marked) SELECT $1,$2,$3,$4 WHERE EXISTS(SELECT 1 FROM test_questions WHERE test_id=$5 AND question_id=$2)
    ON CONFLICT(attempt_id,question_id) DO UPDATE SET answer=EXCLUDED.answer,marked=EXCLUDED.marked,updated_at=now()`,[a.id,r.question_id,JSON.stringify(r.answer??null),!!r.marked,a.test_id]);
  res.json({saved:list.length})}));

app.post('/api/attempts/:id/submit',auth('student'),h(async(req,res)=>{
  const[a]=await q('SELECT id FROM attempts WHERE id=$1 AND student_id=$2',[req.params.id,req.user.id]);
  if(!a)return res.status(404).json({error:'Not found'});await finalize(a.id);res.json({submitted:true})}));

app.get('/api/attempts/:id/result',auth('student'),h(async(req,res)=>{
  const[r]=await q('SELECT r.*,t.results_released,t.title,c.code course_code,c.name course_name FROM attempts a JOIN results r ON r.attempt_id=a.id JOIN tests t ON t.id=a.test_id JOIN courses c ON c.id=t.course_id WHERE a.id=$1 AND a.student_id=$2',[req.params.id,req.user.id]);
  if(!r)return res.status(404).json({error:'No result'});
  if(!r.results_released)return res.status(403).json({error:'Result not released yet'});res.json(r)}));

// ---- ANALYTICS ----
app.get('/api/tests/:id/results',auth('admin','faculty'),h(async(req,res)=>{
  const t=await ownsTest(req.user,req.params.id);
  if(!t)return res.status(403).json({error:'Forbidden: You do not have permission to view results for this test'});
  const rows=await q(`SELECT u.name,u.email,r.score,r.total,r.correct,r.wrong,r.unattempted,r.passed,RANK() OVER(ORDER BY r.score DESC) rank
    FROM attempts a JOIN results r ON r.attempt_id=a.id JOIN users u ON u.id=a.student_id WHERE a.test_id=$1 ORDER BY rank`,[req.params.id]);
  const s=rows.map(r=>+r.score).sort((x,y)=>x-y),n=s.length;
  const stats=n?{appeared:n,avg:s.reduce((x,y)=>x+y,0)/n,highest:s[n-1],lowest:s[0],median:n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2,pass_pct:100*rows.filter(r=>r.passed).length/n}:{appeared:0};
  if(req.query.format==='csv'){const esc=v=>`"${String(v).replace(/"/g,'""').replace(/^[=+\-@]/,"'$&")}"`;
    res.type('text/csv').send(['rank,name,email,score,total,correct,wrong,unattempted,passed',...rows.map(r=>[r.rank,r.name,r.email,r.score,r.total,r.correct,r.wrong,r.unattempted,r.passed].map(esc).join(','))].join('\n'));return}
  res.json({stats,rows})}));

app.use((e,req,res,next)=>{
  console.error(e);
  res.status(e.status||500).json({error:e.message||'Server error'});
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log('ExamFlow API up on port '+PORT));

module.exports = app;
