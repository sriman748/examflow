const express = require('express');

let app;
try {
  app = require('../src/server');
} catch (err) {
  console.error('[Vercel Serverless Boot Error]:', err);
  const fallback = express();
  fallback.use(express.json());
  fallback.all('*', (req, res) => {
    res.status(500).json({
      error: 'Vercel Serverless Boot Error',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });
  app = fallback;
}

module.exports = (req, res) => {
  // Normalize rewrites:
  if (req.url && req.url.startsWith('/api/index.js')) {
    req.url = req.url.replace(/^\/api\/index\.js/, '') || '/';
  }
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
};
