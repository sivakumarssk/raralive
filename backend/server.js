require('dotenv').config();

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error.middleware');
const { pool } = require('./config/db');
const { setupSocket } = require('./socket');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
// React Native's fetch polyfill sometimes sends Content-Type as text/plain
// instead of application/json even when explicitly set, so accept both.
app.use(express.json({ type: ['application/json', 'text/plain'] }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/levels', express.static(path.join(__dirname, 'public/levels')));
app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

const httpServer = http.createServer(app);
const io = setupSocket(httpServer);
require('./utils/io-instance').set(io);

// ── Midnight cron: rotate daily tasks ────────────────────────────────────────
// Runs at 00:00 every day. No DB cleanup needed — task_progress uses period_start (date)
// so each new day automatically starts fresh. This cron just logs the rotation.
cron.schedule('0 0 * * *', () => {
  const today = new Date();
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today.getDay()];
  console.log(`[CRON] Daily task rotation — ${today.toISOString().slice(0,10)} (${dow}). New tasks will be served based on day_of_week.`);
}, { timezone: 'UTC' });

async function startServer() {
  try {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connection OK');
  } catch (error) {
    console.error('PostgreSQL connection failed:', error.message);
    process.exit(1);
  }

  httpServer.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
