const axios = require('axios');

const SOURCE = {
  id: 'arena',
  name: 'Arena.ai',
  url: 'https://arena.ai/leaderboard/text',
  color: '#F43F5E',
  colorName: 'rose',
};

const API_BASE = 'https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard';

// Categories available on the API
const CATEGORIES = ['text', 'code', 'vision', 'agent', 'search', 'document'];

async function fetchCategory(name) {
  const res = await axios.get(API_BASE, {
    params: { name },
    timeout: 15000,
    headers: { Accept: 'application/json' },
  });
  return res.data?.models || [];
}

function normalizeModels(rawModels, category) {
  return rawModels.map(m => ({
    rank: m.rank,
    name: m.model,
    displayName: m.model,
    provider: m.vendor || extractProvider(m.model),
    category,
    score: m.score,
    metrics: {
      'ELO': m.score != null ? `${m.score}±${m.ci ?? '?'}` : 'N/A',
      'Votes': m.votes ? Number(m.votes).toLocaleString() : 'N/A',
      ...(m.license ? { 'License': m.license } : {}),
    },
  }));
}

async function fetch() {
  try {
    const results = await Promise.allSettled(CATEGORIES.map(fetchCategory));

    const byCategory = {};
    CATEGORIES.forEach((cat, i) => {
      if (results[i].status === 'fulfilled' && results[i].value.length > 0) {
        byCategory[cat] = normalizeModels(results[i].value, cat);
      }
    });

    if (Object.keys(byCategory).length === 0) {
      return {
        ...SOURCE,
        status: 'error',
        error: 'Could not fetch any Arena.ai leaderboard data.',
        lastFetched: new Date().toISOString(),
        models: [],
        availableCategories: [],
      };
    }

    // Main models = text leaderboard (or first available)
    const mainModels = byCategory['text'] || Object.values(byCategory)[0];
    const availableCategories = ['all', ...Object.keys(byCategory)];

    return {
      ...SOURCE,
      status: 'success',
      lastFetched: new Date().toISOString(),
      note: `ELO rankings across ${Object.keys(byCategory).length} categories (text, code, vision, agent…)`,
      models: mainModels,
      categoryModels: byCategory,
      availableCategories,
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

function extractProvider(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3') || lower.includes('o4')) return 'OpenAI';
  if (lower.includes('claude') || lower.includes('fable')) return 'Anthropic';
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
