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

  // Normalize URL so Express routes matching /api/* work seamlessly
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }

  return app(req, res);
};
