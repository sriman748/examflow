const app = require('../src/server');
const migrate = require('../src/migrate');

let migrated = false;

module.exports = async (req, res) => {
  if (!migrated && process.env.DATABASE_URL) {
    try {
      await migrate();
      migrated = true;
    } catch (e) {
      console.warn('[Vercel Serverless] Auto-migration status:', e.message);
    }
  }
  return app(req, res);
};
