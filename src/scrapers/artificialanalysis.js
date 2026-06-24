const { getPageData } = require('../browser');

const SOURCE = {
  id: 'artificialanalysis',
  name: 'Artificial Analysis',
  url: 'https://artificialanalysis.ai/leaderboards/models',
  color: '#8B5CF6',
  colorName: 'violet',
};

async function fetch() {
  try {
    const models = await getPageData(
      'https://artificialanalysis.ai/leaderboards/models',
      extractModels,
      { waitForSelector: 'table tbody tr', timeout: 30000 }
    );

    if (!models || models.length === 0) {
      return {
        ...SOURCE,
        status: 'error',
        error: 'Could not extract model data from page.',
        lastFetched: new Date().toISOString(),
        models: [],
        availableCategories: [],
      };
    }

    return {
      ...SOURCE,
      status: 'success',
      lastFetched: new Date().toISOString(),
      note: 'Quality & speed benchmarks from Artificial Analysis',
      models: models.map((m, i) => ({
        rank: i + 1,
        name: m.name,
        displayName: m.name,
        provider: m.provider || extractProvider(m.name),
        category: 'all',
        score: m.qualityIndex,
        metrics: buildMetrics(m),
      })),
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

// Runs inside the browser page context — uses exact DOM structure from Artificial Analysis
function extractModels() {
  const rows = Array.from(document.querySelectorAll('table tbody tr'));
  if (rows.length === 0) return [];

  return rows.map((row, i) => {
    const cells = Array.from(row.querySelectorAll('td'));
    if (cells.length < 4) return null;

    // Cell 0: model name
    const name = cells[0].textContent.trim();
    // Cell 1: context window (e.g. "1M", "128K")
    const context = cells[1] ? cells[1].textContent.trim() : null;
    // Cell 2: provider name
    const providerEl = cells[2] ? cells[2].querySelector('span') : null;
    const provider = providerEl ? providerEl.textContent.trim() : (cells[2] ? cells[2].textContent.trim() : '');
    // Cell 3: quality/intelligence index (numeric)
    const scoreText = cells[3] ? cells[3].textContent.trim() : '';
    const score = parseFloat(scoreText) || null;
    // Cell 4: blended price
    const price = cells[4] ? cells[4].textContent.trim() : null;
    // Cell 5: speed (tokens/s)
    const speed = cells[5] ? cells[5].textContent.trim() : null;

    if (!name || name.length < 2) return null;

    return { name, provider, context, score, price, speed };
  }).filter(Boolean);
}

function buildMetrics(m) {
  const metrics = {};
  if (m.score   != null) metrics['Quality Index'] = m.score;
  if (m.price   && m.price !== '--') metrics['Price'] = m.price;
  if (m.context && m.context !== '--') metrics['Context'] = m.context;
  if (m.speed   && m.speed !== '--') metrics['Speed'] = m.speed;
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
