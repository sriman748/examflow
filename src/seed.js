require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const isLocalDb = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
const p = new Pool({
  connectionString: process.env.DATABASE_URL,
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
