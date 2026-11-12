const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

const PG_BIN = path.join(__dirname, 'pgsql', 'bin');
const PG_DATA = path.join(__dirname, 'pgdata');
const POSTMASTER_PID = path.join(PG_DATA, 'postmaster.pid');

// Set PATH to include pgsql/bin
process.env.PATH = PG_BIN + path.delimiter + (process.env.PATH || '');

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function waitForPostgres(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const ok = await checkPort(5432);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function start() {
  console.log('[Runner] Checking PostgreSQL status...');
  let isRunning = await checkPort(5432);

  if (!isRunning) {
    console.log('[Runner] PostgreSQL is not running. Cleaning stale locks...');
    if (fs.existsSync(POSTMASTER_PID)) {
      try {
        fs.unlinkSync(POSTMASTER_PID);
      } catch (e) {
        console.warn('[Runner] Could not delete postmaster.pid:', e.message);
      }
    }

    console.log('[Runner] Starting PostgreSQL engine...');
    const pgCtl = path.join(PG_BIN, 'pg_ctl.exe');
    try {
      execSync(`"${pgCtl}" -D "${PG_DATA}" -l "${path.join(PG_DATA, 'server.log')}" -w start`, {
        stdio: 'inherit'
      });
    } catch (e) {
      console.warn('[Runner] pg_ctl start returned:', e.message);
    }

    const ready = await waitForPostgres(25);
    if (!ready) {
      console.error('[Runner] FATAL: PostgreSQL did not become ready in time.');
      process.exit(1);
    }
  }

  console.log('[Runner] PostgreSQL is active on port 5432.');

  // Run seed check
  console.log('[Runner] Ensuring admin user is seeded...');
  try {
    execSync(`node "${path.join(__dirname, 'src', 'seed.js')}"`, { stdio: 'inherit' });
  } catch (e) {
    console.error('[Runner] Seed error:', e.message);
  }

  // Start ExamFlow Server
  console.log('[Runner] Launching ExamFlow server...');
  require('./src/server.js');

  // Background watchdog: periodically check postgres
  setInterval(async () => {
    const alive = await checkPort(5432);
    if (!alive) {
      console.error('[Runner] Watchdog: PostgreSQL dropped connection! Restarting...');
      if (fs.existsSync(POSTMASTER_PID)) {
        try { fs.unlinkSync(POSTMASTER_PID); } catch {}
      }
      try {
        const pgCtl = path.join(PG_BIN, 'pg_ctl.exe');
        execSync(`"${pgCtl}" -D "${PG_DATA}" -l "${path.join(PG_DATA, 'server.log')}" -w start`);
      } catch (err) {
        console.error('[Runner] Watchdog restart error:', err.message);
      }
    }
  }, 10000);
}

start().catch(err => {
  console.error('[Runner] Fatal crash:', err);
  process.exit(1);
});

