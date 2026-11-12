const app = require('../src/server');
const migrate = require('../src/migrate');

let migrated = false;

module.exports = async (req, res) => {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!migrated && dbUrl) {
    try {
      await migrate();
      migrated = true;
    } catch (e) {
      console.warn('[Vercel Serverless] Auto-migration status:', e.message);
    }
  }
  return app(req, res);
};
