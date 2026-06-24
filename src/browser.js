const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin   = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());
const puppeteer = puppeteerExtra;

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

function getEdgePath() {
  const fs = require('fs');
  for (const p of EDGE_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Microsoft Edge not found. Install Edge or set BROWSER_PATH in .env');
}

function getExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.platform === 'win32') return process.env.BROWSER_PATH || getEdgePath();
  // Linux: find system Chromium
  const { execSync } = require('child_process');
  try {
    return execSync(
      'which chromium || which chromium-browser || which google-chrome-stable || which google-chrome',
      { encoding: 'utf8' }
    ).trim();
  } catch {
    throw new Error('Chromium not found on Linux. Set PUPPETEER_EXECUTABLE_PATH env var.');
  }
}

let _browser = null;
let _launching = null; // mutex to prevent parallel launches

async function getBrowser() {
  if (_browser && _browser.connected) return _browser;
  if (_launching) return _launching; // reuse in-flight launch

  const executablePath = getExecutablePath();
  _launching = puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--disable-extensions',
    ],
  }).then(browser => {
    _browser = browser;
    _launching = null;
    _browser.on('disconnected', () => { _browser = null; });
    return browser;
  }).catch(err => {
    _launching = null;
    throw err;
  });

  return _launching;
}

async function fetchPage(url, { waitForSelector, timeout = 20000 } = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'
    );
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout });

    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 10000 }).catch(() => {});
    } else {
      // Give JS time to finish rendering
      await new Promise(r => setTimeout(r, 3000));
    }

    return page;
  } catch (err) {
    await page.close().catch(() => {});
    throw err;
  }
}

async function getPageData(url, extractFn, options = {}) {
  const page = await fetchPage(url, options);
  try {
    const data = await page.evaluate(extractFn);
    return data;
  } finally {
    await page.close().catch(() => {});
  }
}

async function closeBrowser() {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}

module.exports = { getBrowser, fetchPage, getPageData, closeBrowser };
