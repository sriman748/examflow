require('dotenv').config();
const { Pool } = require('pg');

async function migrate() {
  const isLocalDb = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocalDb ? false : { rejectUnauthorized: false }
  });

  console.log('[Migrate] Connecting to database...');
  const client = await pool.connect();
  try {
    console.log('[Migrate] Applying database schema...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN('admin','faculty','student')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','inactive','suspended')),
        failed_logins INT DEFAULT 0,
        locked_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        roll_number TEXT,
        employee_id TEXT,
        department TEXT,
        designation TEXT,
        year_sem TEXT,
        phone TEXT,
        specialization TEXT,
        auth_provider TEXT DEFAULT 'local',
        avatar_url TEXT
      );

      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        faculty_id INT REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS enrollments (
        course_id INT REFERENCES courses(id) ON DELETE CASCADE,
        student_id INT REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY(course_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        course_id INT NOT NULL REFERENCES courses(id),
        created_by INT REFERENCES users(id),
        type TEXT NOT NULL CHECK(type IN('single','multiple','true_false','fill','numerical','short')),
        text TEXT NOT NULL,
        options JSONB DEFAULT '[]',
        correct JSONB DEFAULT '[]',
        marks NUMERIC DEFAULT 1,
        negative_marks NUMERIC DEFAULT 0,
        difficulty TEXT DEFAULT 'medium',
        topic TEXT,
        explanation TEXT,
        archived BOOL DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS tests (
        id SERIAL PRIMARY KEY,
        course_id INT NOT NULL REFERENCES courses(id),
        created_by INT REFERENCES users(id),
        title TEXT NOT NULL,
        start_at TIMESTAMPTZ NOT NULL,
        end_at TIMESTAMPTZ NOT NULL,
        duration_min INT NOT NULL,
        pass_marks NUMERIC DEFAULT 0,
        shuffle BOOL DEFAULT true,
        published BOOL DEFAULT false,
        results_released BOOL DEFAULT false,
        share_code TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS test_questions (
        test_id INT REFERENCES tests(id) ON DELETE CASCADE,
        question_id INT REFERENCES questions(id),
        position INT,
        PRIMARY KEY(test_id, question_id)
      );

      CREATE TABLE IF NOT EXISTS attempts (
        id SERIAL PRIMARY KEY,
        test_id INT REFERENCES tests(id),
        student_id INT REFERENCES users(id),
        started_at TIMESTAMPTZ DEFAULT now(),
        deadline TIMESTAMPTZ NOT NULL,
        submitted_at TIMESTAMPTZ,
        UNIQUE(test_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS responses (
        attempt_id INT REFERENCES attempts(id) ON DELETE CASCADE,
        question_id INT REFERENCES questions(id),
        answer JSONB,
        marked BOOL DEFAULT false,
        updated_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY(attempt_id, question_id)
      );

      CREATE TABLE IF NOT EXISTS results (
        attempt_id INT PRIMARY KEY REFERENCES attempts(id),
        score NUMERIC,
        total NUMERIC,
        correct INT,
        wrong INT,
        unattempted INT,
        passed BOOL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT,
        action TEXT,
        detail JSONB,
        at TIMESTAMPTZ DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_attempts_test ON attempts(test_id);
      CREATE INDEX IF NOT EXISTS idx_attempts_deadline ON attempts(deadline) WHERE submitted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_questions_course ON questions(course_id);
    `);
    console.log('[Migrate] Schema verified and ready.');
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrate().catch(err => {
    console.error('[Migrate] Fatal:', err);
    process.exit(1);
  });
}

module.exports = migrate;
