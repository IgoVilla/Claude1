const axios = require('axios');

const SOURCE = {
  id: 'openrouter',
  name: 'OpenRouter',
  url: 'https://openrouter.ai/rankings',
  color: '#6366F1',
  colorName: 'indigo',
};

async function fetch() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const models = [];

  try {
    if (apiKey) {
      // Use rankings daily API if key is available
      const res = await axios.get('https://openrouter.ai/api/v1/datasets/rankings-daily', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15000,
      });
      const rows = res.data?.data || [];
      // Get most recent day
      const dates = [...new Set(rows.map(r => r.date))].sort().reverse();
      const latestDate = dates[0];
      const todayRows = rows.filter(r => r.date === latestDate && r.model_permaslug !== 'other');

      todayRows
        .sort((a, b) => (b.prompt_tokens + b.completion_tokens) - (a.prompt_tokens + a.completion_tokens))
        .forEach((row, i) => {
          const parts = (row.model_permaslug || '').split('/');
          models.push({
            rank: i + 1,
            name: row.model_permaslug,
            displayName: parts[parts.length - 1]?.replace(/-/g, ' ') || row.model_permaslug,
            provider: parts[0] || 'Unknown',
            category: 'all',
            metrics: {
              'Prompt Tokens': Number(row.prompt_tokens).toLocaleString(),
              'Completion Tokens': Number(row.completion_tokens).toLocaleString(),
            },
          });
        });
    } else {
      // Fallback: public models list — filter to real models only (no routers, no negative prices)
      const res = await axios.get('https://openrouter.ai/api/v1/models', { timeout: 15000 });
      const data = res.data?.data || [];
      const SKIP_PATTERNS = /router|auto|free|:free|:extended|:nitro|:floor|:thinking/i;
      data
        .filter(m => {
          if (!m.context_length) return false;
          if (SKIP_PATTERNS.test(m.id || '')) return false;
          const inp = parseFloat(m.pricing?.prompt || 0);
          const out = parseFloat(m.pricing?.completion || 0);
          if (inp < 0 || out < 0) return false; // skip invalid pricing
          return true;
        })
        .sort((a, b) => b.context_length - a.context_length)
        .slice(0, 50)
        .forEach((m, i) => {
          const parts = (m.id || '').split('/');
          const inp = parseFloat(m.pricing?.prompt || 0);
          const out = parseFloat(m.pricing?.completion || 0);
          models.push({
            rank: i + 1,
            name: m.id,
            displayName: m.name || parts[parts.length - 1],
            provider: parts[0] || 'Unknown',
            category: 'all',
            metrics: {
              'Context': `${(m.context_length / 1000).toFixed(0)}K`,
              'Input $/M': inp > 0 ? `$${(inp * 1e6).toFixed(2)}` : 'Free',
              'Output $/M': out > 0 ? `$${(out * 1e6).toFixed(2)}` : 'Free',
            },
          });
        });
    }

    return {
      ...SOURCE,
      status: 'success',
      lastFetched: new Date().toISOString(),
      note: apiKey ? 'Rankings by daily token usage' : 'Sorted by context window (add OPENROUTER_API_KEY for usage rankings)',
      models,
      availableCategories: ['all'],
    };
  } catch (err) {
    return { ...SOURCE, status: 'error', error: err.message, lastFetched: new Date().toISOString(), models: [], availableCategories: [] };
  }
}

module.exports = { fetch };
