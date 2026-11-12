let app = null;
let loadError = null;

try {
  app = require('../src/server');
} catch (err) {
  loadError = err;
  console.error('[Vercel Serverless Init Error]:', err);
}

module.exports = (req, res) => {
  if (loadError) {
    return res.status(500).json({
      error: 'Backend initialization failed',
      message: loadError.message,
      stack: loadError.stack
    });
  }
  return app(req, res);
};
