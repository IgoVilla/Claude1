const axios = require('axios');
const { getPageData } = require('../browser');

const SOURCE = {
  id: 'llmstats',
  name: 'LLM Stats',
  url: 'https://llm-stats.com/leaderboards/llm-leaderboard',
  color: '#10B981',
  colorName: 'emerald',
};

async function fetchWithApiKey(apiKey) {
  const res = await axios.get('https://api.llm-stats.com/v1/leaderboard', {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 15000,
  });
  return res.data;
}

async function fetchWithBrowser() {
  return getPageData(
    'https://llm-stats.com/leaderboards/llm-leaderboard',
    extractModels,
    { waitForSelector: 'table tbody tr, [class*="row"], [class*="model"]', timeout: 30000 }
  );
}

// Runs inside browser page context
function extractModels() {
  // Try table rows first
  const rows = Array.from(document.querySelectorAll('table tbody tr'));
  if (rows.length > 3) {
    return rows.map((row, i) => {
      const cells = Array.from(row.querySelectorAll('td'));
      const texts = cells.map(c => c.textContent.trim()).filter(Boolean);
      if (texts.length < 2) return null;

      // First meaningful text is usually model name
      const name = texts.find(t => t.length > 3 && !/^\d+(\.\d+)?$/.test(t) && !t.startsWith('$')) || texts[0];
      const score = parseFloat(texts.find(t => /^\d{2,3}(\.\d+)?$/.test(t))) || null;
      const price = texts.find(t => t.startsWith('$')) || null;

      return { name, score, price, rawCells: texts.slice(0, 5) };
    }).filter(Boolean).filter(m => m.name && m.name.length > 2 && !/^\d+$/.test(m.name));
  }

  // Fallback: try generic model cards/rows
  const items = Array.from(document.querySelectorAll('[class*="model"],[class*="row"],[class*="card"]'));
  return items.slice(0, 50).map((el, i) => {
    const text = el.textContent.trim();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    return { name: lines[0] || `Model ${i + 1}`, score: null, rawCells: lines.slice(0, 4) };
  }).filter(m => m.name && m.name.length > 3 && !/^\d+$/.test(m.name));
}

async function fetch() {
  const apiKey = process.env.LLMSTATS_API_KEY;

  try {
    let rawModels = null;

    if (apiKey) {
      rawModels = await fetchWithApiKey(apiKey);
    } else {
      rawModels = await fetchWithBrowser();
    }

    if (!rawModels || rawModels.length === 0) {
      return {
        ...SOURCE,
        status: 'error',
        error: 'No models found on LLM Stats leaderboard.',
        lastFetched: new Date().toISOString(),
        models: [],
        availableCategories: [],
      };
    }

    const models = rawModels.slice(0, 50).map((m, i) => {
      const name = m.name || m.display_name || m.model || `Model ${i + 1}`;
      return {
        rank: m.rank || i + 1,
        name,
        displayName: name,
        provider: m.provider || m.organization || extractProvider(name),
        category: m.category || 'all',
        score: m.score || m.intelligence || null,
        metrics: buildMetrics(m),
      };
    });

    return {
      ...SOURCE,
      status: 'success',
      lastFetched: new Date().toISOString(),
      note: apiKey ? 'Data via LLM Stats API' : 'Benchmarks from LLM Stats leaderboard',
      models,
      availableCategories: ['all'],
    };
  } catch (err) {
    return {
      ...SOURCE,
      status: 'error',
      error: err.message,
      lastFetched: new Date().toISOString(),
      models: [],
      availableCategories: [],
    };
  }
}

function buildMetrics(m) {
  const metrics = {};
  if (m.score != null) metrics['Score'] = m.score;
  if (m.price != null) metrics['Price'] = m.price;
  if (m.input_price != null) metrics['Input $/M'] = `$${m.input_price}`;
  if (m.output_price != null) metrics['Output $/M'] = `$${m.output_price}`;
  if (m.rawCells && !metrics['Score']) {
    const numericCell = m.rawCells.find(c => /^\d{2,3}(\.\d+)?$/.test(c));
    if (numericCell) metrics['Score'] = parseFloat(numericCell);
  }
  return metrics;
}

function extractProvider(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3') || lower.includes('o4')) return 'OpenAI';
  if (lower.includes('claude')) return 'Anthropic';
  if (lower.includes('gemini')) return 'Google';
  if (lower.includes('llama')) return 'Meta';
  if (lower.includes('mistral') || lower.includes('mixtral')) return 'Mistral';
  if (lower.includes('deepseek')) return 'DeepSeek';
  if (lower.includes('qwen')) return 'Alibaba';
  if (lower.includes('grok')) return 'xAI';
  if (lower.includes('command')) return 'Cohere';
  return 'Unknown';
}

module.exports = { fetch };
