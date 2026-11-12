require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function getDbClient(pool, maxAttempts = 10) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const client = await pool.connect();
      return client;
    } catch (err) {
      console.warn(`[Migrate] DB connection attempt ${i}/${maxAttempts} failed: ${err.message}. Retrying in 3s...`);
      if (i === maxAttempts) throw err;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

async function migrate() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    console.log('[Migrate] No database URL configured. Skipping migration.');
    return;
  }
  const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocalDb ? false : { rejectUnauthorized: false }
  });

  console.log('[Migrate] Connecting to database...');
  const client = await getDbClient(pool);
  try {
    await client.query("SET search_path = public, pg_catalog;");

    // Check if users table exists and has records
    let needsFullSeed = false;
    try {
      const regRes = await client.query("SELECT to_regclass('public.users') AS exists;");
      if (!regRes.rows[0] || !regRes.rows[0].exists) {
        needsFullSeed = true;
      } else {
        const countRes = await client.query('SELECT count(*) FROM public.users;');
        if (+countRes.rows[0].count === 0) {
          needsFullSeed = true;
        }
      }
    } catch {
      needsFullSeed = true;
    }

    if (needsFullSeed) {
      console.log('[Migrate] Fresh database detected. Applying complete snapshot seed (57 questions, courses, users)...');
      const seedFilePath = path.join(__dirname, 'database_seed.sql');
      if (fs.existsSync(seedFilePath)) {
        const seedSql = fs.readFileSync(seedFilePath, 'utf8');
        await client.query(seedSql);
        await client.query("SET search_path = public, pg_catalog;");
        console.log('[Migrate] Complete snapshot applied successfully.');
      } else {
        console.warn('[Migrate] database_seed.sql not found, creating base schema...');
        await client.query(`
          CREATE TABLE IF NOT EXISTS public.users (
            id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN('admin','faculty','student')), status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','inactive','suspended')),
            failed_logins INT DEFAULT 0, locked_until TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(),
            roll_number TEXT, employee_id TEXT, department TEXT, designation TEXT, year_sem TEXT, phone TEXT, specialization TEXT, auth_provider TEXT DEFAULT 'local', avatar_url TEXT
          );
          CREATE TABLE IF NOT EXISTS public.courses (id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, faculty_id INT REFERENCES public.users(id));
          CREATE TABLE IF NOT EXISTS public.enrollments (course_id INT REFERENCES public.courses(id) ON DELETE CASCADE, student_id INT REFERENCES public.users(id) ON DELETE CASCADE, PRIMARY KEY(course_id, student_id));
          CREATE TABLE IF NOT EXISTS public.questions (id SERIAL PRIMARY KEY, course_id INT NOT NULL REFERENCES public.courses(id), created_by INT REFERENCES public.users(id), type TEXT NOT NULL CHECK(type IN('single','multiple','true_false','fill','numerical','short')), text TEXT NOT NULL, options JSONB DEFAULT '[]', correct JSONB DEFAULT '[]', marks NUMERIC DEFAULT 1, negative_marks NUMERIC DEFAULT 0, difficulty TEXT DEFAULT 'medium', topic TEXT, explanation TEXT, archived BOOL DEFAULT false, created_at TIMESTAMPTZ DEFAULT now());
          CREATE TABLE IF NOT EXISTS public.tests (id SERIAL PRIMARY KEY, course_id INT NOT NULL REFERENCES public.courses(id), created_by INT REFERENCES public.users(id), title TEXT NOT NULL, start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ NOT NULL, duration_min INT NOT NULL, pass_marks NUMERIC DEFAULT 0, shuffle BOOL DEFAULT true, published BOOL DEFAULT false, results_released BOOL DEFAULT false, share_code TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT now());
          CREATE TABLE IF NOT EXISTS public.test_questions (test_id INT REFERENCES public.tests(id) ON DELETE CASCADE, question_id INT REFERENCES public.questions(id), position INT, PRIMARY KEY(test_id, question_id));
          CREATE TABLE IF NOT EXISTS public.attempts (id SERIAL PRIMARY KEY, test_id INT REFERENCES public.tests(id), student_id INT REFERENCES public.users(id), started_at TIMESTAMPTZ DEFAULT now(), deadline TIMESTAMPTZ NOT NULL, submitted_at TIMESTAMPTZ, UNIQUE(test_id, student_id));
          CREATE TABLE IF NOT EXISTS public.responses (attempt_id INT REFERENCES public.attempts(id) ON DELETE CASCADE, question_id INT REFERENCES public.questions(id), answer JSONB, marked BOOL DEFAULT false, updated_at TIMESTAMPTZ DEFAULT now(), PRIMARY KEY(attempt_id, question_id));
          CREATE TABLE IF NOT EXISTS public.results (attempt_id INT PRIMARY KEY REFERENCES public.attempts(id), score NUMERIC, total NUMERIC, correct INT, wrong INT, unattempted INT, passed BOOL);
          CREATE TABLE IF NOT EXISTS public.audit_logs (id SERIAL PRIMARY KEY, user_id INT, action TEXT, detail JSONB, at TIMESTAMPTZ DEFAULT now());
        `);
      }
    } else {
      console.log('[Migrate] Database schema and records verified.');
    }

    // Always ensure Admin user is properly configured and unlocked
    const adminEmail = (process.env.ADMIN_EMAIL || 'sriman_cse@mvsrec.edu.in').toLowerCase().trim();
    const adminPass = process.env.ADMIN_PASSWORD || 'Sparky@748';
    const adminHash = await bcrypt.hash(adminPass, 12);
    await client.query(`
      INSERT INTO public.users(name, email, password_hash, role, status) 
      VALUES('Administrator', $1, $2, 'admin', 'active')
      ON CONFLICT(email) DO UPDATE 
      SET password_hash = EXCLUDED.password_hash, 
          role = 'admin',
          status = 'active', 
          failed_logins = 0, 
          locked_until = NULL;
    `, [adminEmail, adminHash]);
    console.log(`[Migrate] Admin account verified: ${adminEmail}`);

  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrate().then(() => {
    console.log('[Migrate] Migration finished successfully.');
    process.exit(0);
  }).catch(err => {
    console.error('[Migrate] Migration failed:', err);
    process.exit(1);
  });
}

module.exports = migrate;
