require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const isLocalDb = !dbUrl || dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
const p = new Pool({
  connectionString: dbUrl,
  ssl: isLocalDb ? false : { rejectUnauthorized: false }
});

(async () => {
  try {
    const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const pass = process.env.ADMIN_PASSWORD;
    const hash = await bcrypt.hash(pass, 12);
    
    await p.query(`
      INSERT INTO users(name, email, password_hash, role, status) 
      VALUES('Admin', $1, $2, 'admin', 'active')
      ON CONFLICT(email) DO UPDATE 
      SET password_hash = EXCLUDED.password_hash, 
          status = 'active', 
          failed_logins = 0, 
          locked_until = NULL
    `, [email, hash]);

    console.log(`[Seed] Admin user verified: ${email}`);
  } catch (err) {
    console.error('[Seed] Error seeding admin:', err.message);
  } finally {
    await p.end();
  }
})();
