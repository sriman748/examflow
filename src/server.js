require('dotenv').config();
const express=require('express'),helmet=require('helmet'),rateLimit=require('express-rate-limit'),
  jwt=require('jsonwebtoken'),bcrypt=require('bcryptjs'),{Pool}=require('pg'),crypto=require('crypto'),
  multer=require('multer'),pdfParse=require('pdf-parse'),mammoth=require('mammoth');

const isLocalDb=!process.env.DATABASE_URL||process.env.DATABASE_URL.includes('localhost')||process.env.DATABASE_URL.includes('127.0.0.1');
const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  max:100,
  ssl:isLocalDb?false:{rejectUnauthorized:false}
}),SECRET=process.env.JWT_SECRET;
if(!SECRET||SECRET.length<24)throw new Error('Set a strong JWT_SECRET');
const q=async(s,p,c=pool)=>(await c.query(s,p)).rows;
const app=express();app.use(helmet({contentSecurityPolicy:false}),express.json({limit:'20mb'}));
app.use(express.static(__dirname+'/../public'));

// Rate limiting with support for shared campus IP / NAT
const authKey = req => (req.headers.authorization || req.ip);
app.use('/api/auth/login', rateLimit({ windowMs: 60000, max: 100, keyGenerator: req => req.ip }));
app.use('/api', rateLimit({ windowMs: 60000, max: 3000, keyGenerator: authKey }));

const h=f=>(req,res,next)=>f(req,res,next).catch(next);
const audit=(u,a,d)=>q('INSERT INTO audit_logs(user_id,action,detail) VALUES($1,$2,$3)',[u,a,d||{}]);
const auth=(...roles)=>(req,res,next)=>{
  try{req.user=jwt.verify((req.headers.authorization||'').slice(7),SECRET)}catch{return res.status(401).json({error:'Unauthorized'})}
  if(roles.length&&!roles.includes(req.user.role))return res.status(403).json({error:'Forbidden'});next()};
const isAdmin=u=>u.role==='admin';
const isFaculty=u=>u.role==='faculty'||u.role==='admin';
const ownsCourse=async(u,cid)=>{
  if(isAdmin(u))return true;
  const[c]=await q('SELECT * FROM courses WHERE id=$1',[cid]);
  return Boolean(c&&c.faculty_id===u.id);
};
const ownsTest=async(u,tid)=>{
  if(isAdmin(u)){const[t]=await q('SELECT * FROM tests WHERE id=$1',[tid]);return t||null}
  const[t]=await q(`SELECT t.*, c.faculty_id AS course_faculty_id 
    FROM tests t JOIN courses c ON c.id=t.course_id WHERE t.id=$1`,[tid]);
  if(t&&(t.created_by===u.id||t.course_faculty_id===u.id))return t;
  return null;
};
const ownsQuestion=async(u,qid)=>{
  if(isAdmin(u))return true;
  const[qn]=await q(`SELECT q.*, c.faculty_id AS course_faculty_id 
    FROM questions q JOIN courses c ON c.id=q.course_id WHERE q.id=$1`,[qid]);
  return Boolean(qn&&(qn.created_by===u.id||qn.course_faculty_id===u.id));
};

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:20*1024*1024}});

// ---- HIGH-ACCURACY QUESTION EXTRACTOR ----
function parseQuestionsFromText(rawText){
  if(!rawText)return[];
  let text=String(rawText).replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\t/g,' ');

  // Split into question blocks: match "1. ", "Q1. ", "Q.1", "Q1)", "(1) ", "Question 1:"
  const splitter=/(?:^|\n)\s*(?:Q(?:uestion)?\s*[\d.]+\s*[:.)-]?|\(?\d+\s*[:.)-])\s+/i;
  let rawBlocks=text.split(splitter);
  if(rawBlocks.length<=1){
    rawBlocks=text.split(/\n\s*\n+/);
  }

  const out=[];
  for(let block of rawBlocks){
    block=block.trim();
    if(!block||block.length<5)continue;

    const lines=block.split('\n').map(l=>l.trim()).filter(Boolean);
    if(!lines.length)continue;

    let questionLines=[];
    let options=[];
    let answerText=null;
    let marks=1;
    let explanation='';

    for(let i=0;i<lines.length;i++){
      let l=lines[i];

      // Match Marks: "(2 Marks)", "[1 Mark]", "Marks: 2", "(2m)", etc.
      let mMarks=l.match(/(?:\[|\()?\s*marks?\s*[:\-]?\s*([\d.]+)\s*(?:marks?|pts?|m)?(?:\s*\]|\))?/i)
        || l.match(/(?:\[|\()\s*([\d.]+)\s*(?:marks?|pts?|m)\s*(?:\]|\))/i);
      if(mMarks){
        marks=+mMarks[1]||1;
        l=l.replace(mMarks[0],'').trim();
        if(!l)continue;
      }

      // Match Answer: "Answer: B", "Ans: (A)", "Correct: True", "Key: B, C", "Solution: A"
      let mAns=l.match(/^(?:correct\s*answer|correct\s*option|correct|answer|ans|key|sol|solution)\s*[:.\-]\s*(.+)/i);
      if(mAns){
        answerText=mAns[1].trim();
        continue;
      }

      // Match Explanation
      let mExp=l.match(/^(?:explanation|exp)\s*[:.\-]\s*(.+)/i);
      if(mExp){
        explanation=mExp[1].trim();
        continue;
      }

      // Check inline multiple options: e.g. "A) Yes  B) No  C) Maybe  D) Never"
      const inlineOptMatches=[...l.matchAll(/(?:^|\s+)(?:\(?([A-Ha-h])[.)\]:\-])\s+([^A-Ha-h()\[\]]+)/g)];
      if(inlineOptMatches.length>=2&&inlineOptMatches[0][1].toUpperCase()==='A'){
        for(const om of inlineOptMatches){
          options.push(om[2].trim());
        }
        continue;
      }

      // Single option line: "A) Text", "a. Text", "(A) Text", "A - Text", "A: Text"
      let mOpt=l.match(/^(?:\(?([A-Ha-h])[.)\]:\-])\s*(.+)/);
      if(mOpt){
        options.push(mOpt[2].trim());
        continue;
      }

      // Standalone True / False option lines
      if(/^(?:true|false)$/i.test(l)&&options.length<2){
        options.push(l.charAt(0).toUpperCase()+l.slice(1).toLowerCase());
        continue;
      }

      // Question body line (accumulated before options/answers start)
      if(options.length===0&&!answerText){
        const cleaned=l.replace(/^(?:Q(?:uestion)?\s*[\d.]+\s*[:.)-]?|\(?\d+\s*[:.)-])\s*/i,'');
        questionLines.push(cleaned);
      }
    }

    const qText=questionLines.join(' ').trim();
    // Skip header/footer noise blocks that have no question body or no options/answers
    if(!qText||(options.length===0&&!answerText))continue;

    let correctIdx=[];
    let qType='single';

    if(answerText){
      // Check True/False answer
      if(/^(?:true|t)$/i.test(answerText)){
        qType='true_false';
        correctIdx=['true'];
      }else if(/^(?:false|f)$/i.test(answerText)){
        qType='true_false';
        correctIdx=['false'];
      }else{
        // Extract letters (e.g. "B", "(B)", "A, C", "Option B")
        const letters=[...answerText.matchAll(/\b([A-Ha-h])\b/g)].map(m=>m[1].toUpperCase());
        if(letters.length){
          correctIdx=letters.map(x=>x.charCodeAt(0)-65);
          if(correctIdx.length>1)qType='multiple';
        }else if(options.length){
          // Try matching option full text
          const cleanAns=answerText.toLowerCase().trim();
          const matchIdx=options.findIndex(opt=>opt.toLowerCase().trim()===cleanAns);
          if(matchIdx!==-1)correctIdx=[matchIdx];
        }
      }
    }

    if(options.length===2&&/true/i.test(options[0])&&/false/i.test(options[1])){
      qType='true_false';
      if(correctIdx.length===1&&typeof correctIdx[0]==='number'){
        correctIdx=[correctIdx[0]===0?'true':'false'];
      }
    }

    out.push({
      type:qType,
      text:qText,
      options:qType==='true_false'&&(!options||options.length<2)?['True','False']:options,
      correct:correctIdx,
      marks:marks||1,
      explanation:explanation||'',
      needs_review:!options.length||!correctIdx.length
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
  let[u]=await q('SELECT * FROM users WHERE email=$1',[cleanEmail]);

  // Block administrative account takeover via third-party login
  if(u&&u.role==='admin'){
    return res.status(403).json({error:'Administrative accounts must authenticate using secure email and password'});
  }
  // If the account was registered with local email & password, require password authentication
  if(u&&u.auth_provider==='local'&&u.password_hash){
    return res.status(403).json({error:'This institutional account is registered with a password. Please sign in with your email and password.'});
  }

  if(!u){
    // Auto-register via Google - strictly student or faculty, never admin
    const targetRole=role==='faculty'?'faculty':'student';
    const randomPassword=crypto.randomBytes(32).toString('hex');
    const[created]=await q(`INSERT INTO users(name,email,password_hash,role,auth_provider,avatar_url)
      VALUES($1,$2,$3,$4,'google',$5) RETURNING *`,
      [name||cleanEmail.split('@')[0],cleanEmail,await bcrypt.hash(randomPassword,10),targetRole,avatar_url||null]);
    u=created;
    await audit(u.id,'user.register.google',{role:u.role});
  } else {
    // Existing Google user: update avatar if present
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
      (SELECT COUNT(*) FROM tests t WHERE t.course_id=c.id AND t.published=true) tests_count
      FROM courses c JOIN enrollments e ON e.course_id=c.id
      LEFT JOIN users f ON f.id=c.faculty_id WHERE e.student_id=$1 ORDER BY c.id`,[u.id]));
  }
  res.json(await q(`SELECT c.*, f.name faculty_name, f.email faculty_email,
    (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) students_count,
    (SELECT COUNT(*) FROM tests t WHERE t.course_id=c.id) tests_count,
    (SELECT COUNT(*) FROM questions qn WHERE qn.course_id=c.id AND NOT qn.archived) questions_count
    FROM courses c LEFT JOIN users f ON f.id=c.faculty_id ORDER BY c.id`));
}));

app.get('/api/courses/catalog',auth('student'),h(async(req,res)=>{
  const u=req.user;
  res.json(await q(`SELECT c.*, f.name faculty_name, f.email faculty_email,
    EXISTS(SELECT 1 FROM enrollments e WHERE e.course_id=c.id AND e.student_id=$1) enrolled,
    (SELECT COUNT(*) FROM tests t WHERE t.course_id=c.id AND t.published=true) tests_count
    FROM courses c LEFT JOIN users f ON f.id=c.faculty_id ORDER BY c.id`,[u.id]));
}));

app.post('/api/courses/:id/self-enroll',auth('student'),h(async(req,res)=>{
  await q('INSERT INTO enrollments(course_id,student_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,req.user.id]);
  res.json({enrolled:true});
}));

app.post('/api/courses',auth('admin','faculty'),h(async(req,res)=>{
  const{code,name,faculty_id}=req.body;
  const fid=faculty_id||req.user.id;
  const[c]=await q('INSERT INTO courses(code,name,faculty_id) VALUES($1,$2,$3) RETURNING *',[code,name,fid]);
  res.status(201).json(c);
}));

app.put('/api/courses/:id',auth('admin','faculty'),h(async(req,res)=>{
  if(!(await ownsCourse(req.user,req.params.id)))return res.status(403).json({error:'Forbidden: You do not have permission to manage this course'});
  const{code,name,faculty_id}=req.body;
  const fid=isAdmin(req.user)?(faculty_id||req.user.id):req.user.id;
  const[c]=await q('UPDATE courses SET code=$1, name=$2, faculty_id=$3 WHERE id=$4 RETURNING *',[code,name,fid,req.params.id]);
  if(!c)return res.status(404).json({error:'Course not found'});
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
  if(cid&&!(await ownsCourse(req.user,cid))){
    return res.status(403).json({error:'Forbidden: You can only view questions for courses you manage'});
  }
  res.json(await q('SELECT * FROM questions WHERE course_id=$1 AND NOT archived ORDER BY id DESC',[cid]))}));

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
  const[t]=await q('INSERT INTO tests(course_id,created_by,title,start_at,end_at,duration_min,pass_marks,shuffle) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
   [b.course_id,req.user.id,b.title,b.start_at,b.end_at,b.duration_min,b.pass_marks||0,b.shuffle!==false]);
  for(let i=0;i<ids.length;i++)await q('INSERT INTO test_questions VALUES($1,$2,$3)',[t.id,ids[i],i]);
  await audit(req.user.id,'test.create',{id:t.id});res.status(201).json(t)}));

app.put('/api/tests/:id',auth('admin','faculty'),h(async(req,res)=>{
  const tid=req.params.id;
  const existing=await ownsTest(req.user,tid);
  if(!existing)return res.status(403).json({error:'Forbidden: You do not have permission to modify this test'});
  const b=req.body;
  const[t]=await q('UPDATE tests SET title=$1, start_at=$2, end_at=$3, duration_min=$4, pass_marks=$5 WHERE id=$6 RETURNING *',
    [b.title,b.start_at,b.end_at,b.duration_min,b.pass_marks||0,tid]);
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
  res.json(await q(`SELECT u.id,u.name,u.email,a.submitted_at,a.started_at,r.score,r.total,r.passed FROM tests t
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
      WHERE t.created_by=$1 OR c.faculty_id=$1
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
setInterval(()=>q('SELECT id FROM attempts WHERE submitted_at IS NULL AND deadline<now()').then(r=>Promise.all(r.map(x=>finalize(x.id)))).catch(console.error),15000);

app.post('/api/tests/:id/start',auth('student'),h(async(req,res)=>{
  const[t]=await q('SELECT t.* FROM tests t JOIN enrollments e ON e.course_id=t.course_id AND e.student_id=$2 WHERE t.id=$1 AND t.published',[req.params.id,req.user.id]);
  if(!t)return res.status(404).json({error:'Test not available or you are not enrolled'});
  const now=new Date();if(now<t.start_at||now>t.end_at)return res.status(403).json({error:'Outside test window'});
  const deadline=new Date(Math.min(+now+t.duration_min*60000,+t.end_at));
  const[a]=await q('INSERT INTO attempts(test_id,student_id,deadline) VALUES($1,$2,$3) ON CONFLICT(test_id,student_id) DO UPDATE SET test_id=EXCLUDED.test_id RETURNING *',[t.id,req.user.id,deadline]);
  if(a.submitted_at||a.deadline<=now){await finalize(a.id);return res.status(409).json({error:'Attempt already finished',attempt_id:a.id})}
  let qs=await q('SELECT qn.id,qn.type,qn.text,qn.options,qn.marks FROM test_questions tq JOIN questions qn ON qn.id=tq.question_id WHERE tq.test_id=$1 ORDER BY tq.position',[t.id]);
  if(t.shuffle)qs=shuffle(qs,a.id);
  const saved=await q('SELECT question_id,answer,marked FROM responses WHERE attempt_id=$1',[a.id]);
  res.json({attempt_id:a.id,deadline:a.deadline,server_time:now,questions:qs,saved})}));

app.put('/api/attempts/:id/answers',auth('student'),h(async(req,res)=>{
  const[a]=await q('SELECT * FROM attempts WHERE id=$1 AND student_id=$2',[req.params.id,req.user.id]);
  if(!a)return res.status(404).json({error:'Not found'});
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

app.use((e,req,res,next)=>{console.error(e);res.status(500).json({error:'Server error'})});
app.listen(process.env.PORT||3000,()=>console.log('ExamFlow API up on port '+(process.env.PORT||3000)));
