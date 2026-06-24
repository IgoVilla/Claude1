const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/rankings.json');

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function saveData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function getAge() {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const stat = fs.statSync(DATA_FILE);
    return Date.now() - stat.mtimeMs;
  } catch {
    return null;
  }
}

module.exports = { saveData, loadData, getAge };
