const cron = require('node-cron');
const { fetchAllRankings } = require('./scrapers');
const cache = require('./cache');

let isRunning = false;
let lastRun = null;

async function runUpdate() {
  if (isRunning) {
    console.log('[scheduler] Update already in progress, skipping.');
    return false;
  }
  isRunning = true;
  console.log('[scheduler] Starting data update...');
  try {
    const data = await fetchAllRankings();
    cache.saveData({ rankings: data, updatedAt: new Date().toISOString() });
    lastRun = new Date();
    console.log('[scheduler] Update complete.');
    return true;
  } catch (err) {
    console.error('[scheduler] Update failed:', err.message);
    return false;
  } finally {
    isRunning = false;
  }
}

function start() {
  // Run every day at 6:00 AM
  cron.schedule('0 6 * * *', () => {
    console.log('[scheduler] Daily update triggered.');
    runUpdate();
  });
  console.log('[scheduler] Daily update scheduled for 6:00 AM.');
}

function getStatus() {
  return { isRunning, lastRun };
}

module.exports = { start, runUpdate, getStatus };
