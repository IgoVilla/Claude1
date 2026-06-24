require('dotenv').config();
// Allow self-signed / corporate proxy certificates for outbound HTTP requests
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const express = require('express');
const cors = require('cors');
const path = require('path');
const cache = require('./src/cache');
const scheduler = require('./src/scheduler');
const { fetchAllRankings } = require('./src/scrapers');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Return all ranking data (from cache)
app.get('/api/rankings', (req, res) => {
  const data = cache.loadData();
  const age = cache.getAge();
  if (!data) {
    return res.json({ status: 'no_data', message: 'No data yet. Trigger a refresh.', rankings: [] });
  }
  res.json({ ...data, cacheAgeMs: age });
});

// Manual refresh trigger (rate limited to once every 5 minutes)
let lastManualRefresh = 0;
app.post('/api/refresh', async (req, res) => {
  const now = Date.now();
  const { isRunning } = scheduler.getStatus();

  if (isRunning) {
    return res.json({ status: 'already_running', message: 'Update already in progress.' });
  }
  if (now - lastManualRefresh < 5 * 60 * 1000) {
    const waitSecs = Math.ceil((5 * 60 * 1000 - (now - lastManualRefresh)) / 1000);
    return res.json({ status: 'rate_limited', message: `Wait ${waitSecs}s before refreshing again.` });
  }

  lastManualRefresh = now;
  res.json({ status: 'started', message: 'Data refresh started. Check /api/rankings in a moment.' });
  scheduler.runUpdate();
});

// Status endpoint
app.get('/api/status', (req, res) => {
  const { isRunning, lastRun } = scheduler.getStatus();
  const age = cache.getAge();
  res.json({
    isRunning,
    lastRun,
    cacheAgeMs: age,
    cacheAgeHuman: age ? formatAge(age) : 'No cache',
  });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function formatAge(ms) {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

app.listen(PORT, async () => {
  console.log(`\n🚀 AI Rankings Hub running at http://localhost:${PORT}\n`);
  scheduler.start();

  // Auto-fetch on startup if no cache or cache is older than 12 hours
  const age = cache.getAge();
  if (!age || age > 12 * 60 * 60 * 1000) {
    console.log('[startup] No recent cache found, fetching data now...');
    scheduler.runUpdate();
  } else {
    console.log(`[startup] Cache is ${formatAge(age)}, skipping initial fetch.`);
  }
});
