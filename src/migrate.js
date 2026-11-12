require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function migrate() {
  const dbUrl = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[Migrate] No database URL found. Skipping migration.');
    return;
  }
  const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: dbUrl,
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

    // Ensure Admin user exists and has correct password
    const adminEmail = (process.env.ADMIN_EMAIL || 'sriman_cse@mvsrec.edu.in').toLowerCase().trim();
    const adminPass = process.env.ADMIN_PASSWORD || 'Sparky@748';
    const adminHash = await bcrypt.hash(adminPass, 12);
    const adminRes = await client.query(`
      INSERT INTO users(name, email, password_hash, role, status) 
      VALUES('Administrator', $1, $2, 'admin', 'active')
      ON CONFLICT(email) DO UPDATE 
      SET password_hash = EXCLUDED.password_hash, 
          role = 'admin',
          status = 'active', 
          failed_logins = 0, 
          locked_until = NULL
      RETURNING id;
    `, [adminEmail, adminHash]);
    const adminId = adminRes.rows[0]?.id;

    // Seed Courses if none exist
    const courseCount = await client.query('SELECT count(*) FROM courses');
    if (+courseCount.rows[0].count === 0 && adminId) {
      console.log('[Migrate] Seeding initial courses...');
      const seededCourses = [
        ['CS301', 'Data Structures & Algorithms', adminId],
        ['CS302', 'Database Management Systems', adminId],
        ['CS303', 'Operating Systems', adminId],
        ['CS304', 'Computer Networks', adminId]
      ];
      for (const [code, name, fid] of seededCourses) {
        await client.query('INSERT INTO courses(code, name, faculty_id) VALUES($1, $2, $3) ON CONFLICT(code) DO NOTHING', [code, name, fid]);
      }
    }

    // Seed Sample Questions if none exist
    const qCount = await client.query('SELECT count(*) FROM questions');
    if (+qCount.rows[0].count === 0 && adminId) {
      console.log('[Migrate] Seeding curriculum questions...');
      const c1 = (await client.query("SELECT id FROM courses WHERE code='CS301'")).rows[0]?.id;
      const c2 = (await client.query("SELECT id FROM courses WHERE code='CS302'")).rows[0]?.id;
      if (c1 && c2) {
        await client.query(`
          INSERT INTO questions(course_id, created_by, type, text, options, correct, marks, negative_marks, difficulty, topic, explanation)
          VALUES
          ($1, $3, 'single', 'What is the time complexity of searching in a balanced Binary Search Tree?', '["O(1)", "O(log n)", "O(n)", "O(n log n)"]'::jsonb, '["1"]'::jsonb, 2, 0.5, 'easy', 'BST', 'A balanced BST has a height of log n, so search operations take O(log n) time.'),
          ($1, $3, 'single', 'Which data structure uses LIFO (Last In First Out) ordering?', '["Queue", "Stack", "Array", "Linked List"]'::jsonb, '["1"]'::jsonb, 1, 0, 'easy', 'Stacks', 'A stack implements LIFO discipline.'),
          ($1, $3, 'multiple', 'Which of the following are self-balancing binary search trees? (Select all that apply)', '["AVL Tree", "Red-Black Tree", "B-Tree", "Binary Heap"]'::jsonb, '["0", "1"]'::jsonb, 2, 0, 'medium', 'Trees', 'AVL Trees and Red-Black Trees are binary self-balancing search trees.'),
          ($1, $3, 'true_false', 'Quicksort has a worst-case time complexity of O(n^2).', '["True", "False"]'::jsonb, '["0"]'::jsonb, 1, 0, 'easy', 'Sorting', 'When the pivot is the smallest or largest element repeatedly, worst case is O(n^2).'),
          ($1, $3, 'fill', 'The minimum number of queues needed to implement a stack is ______.', '[]'::jsonb, '["2", "two"]'::jsonb, 2, 0, 'medium', 'Data Structures', 'Two queues are required to implement a LIFO stack.'),
          ($1, $3, 'numerical', 'How many edges are there in a tree with 15 vertices?', '[]'::jsonb, '["14"]'::jsonb, 1, 0, 'easy', 'Trees', 'A tree with V vertices always has V - 1 edges (15 - 1 = 14).'),
          ($2, $3, 'single', 'Which normal form eliminates partial dependency?', '["1NF", "2NF", "3NF", "BCNF"]'::jsonb, '["1"]'::jsonb, 2, 0.5, 'medium', 'Normalization', '2NF requires relation to be in 1NF and no non-prime attribute is partially dependent on any candidate key.'),
          ($2, $3, 'single', 'What does ACID stand for in DBMS transactions?', '["Atomicity, Consistency, Isolation, Durability", "Accuracy, Consistency, Integrity, Durability", "Atomicity, Concurrency, Isolation, Durability", "Action, Consistency, Isolation, Durability"]'::jsonb, '["0"]'::jsonb, 1, 0, 'easy', 'Transactions', 'ACID stands for Atomicity, Consistency, Isolation, and Durability.'),
          ($2, $3, 'true_false', 'A primary key can accept NULL values in SQL.', '["True", "False"]'::jsonb, '["1"]'::jsonb, 1, 0, 'easy', 'Keys', 'Primary key constraints enforce both UNIQUE and NOT NULL.')
        `, [c1, c2, adminId]);
      }
    }

    console.log('[Migrate] Schema and initial data verified successfully.');
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
