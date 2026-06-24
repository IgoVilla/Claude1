const axios = require('axios');

const SOURCE = {
  id: 'huggingface',
  name: 'Chatbot Arena',
  url: 'https://huggingface.co/spaces/lmarena-ai/chatbot-arena',
  color: '#F59E0B',
  colorName: 'amber',
};

const CATEGORY_MAP = {
  text: 'all',
  coding: 'code',
  math: 'math',
  'hard-prompts': 'hard',
  vision: 'vision',
  'instruction-following': 'instruction',
};

async function fetchCategory(name) {
  const res = await axios.get(`https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard`, {
    params: { name },
    timeout: 15000,
    headers: { 'Accept': 'application/json' },
  });
  return res.data;
}

function normalizeModels(rawModels, category) {
  return (rawModels || []).map((m, i) => ({
    rank: m.rank || i + 1,
    name: m.model || m.name || `Model ${i + 1}`,
    displayName: m.model || m.name || `Model ${i + 1}`,
    provider: m.vendor || extractProvider(m.model || ''),
    category,
    score: m.score || m.elo_rating,
    metrics: {
      'ELO Score': m.score || m.elo_rating || 'N/A',
      'Votes': m.vote_count ? Number(m.vote_count).toLocaleString() : 'N/A',
      ...(m.confidence_interval ? { 'CI': m.confidence_interval } : {}),
    },
  }));
}

async function fetch() {
  try {
    const [textRes, visionRes] = await Promise.allSettled([
      fetchCategory('text'),
      fetchCategory('vision'),
    ]);

    const text = textRes.status === 'fulfilled' ? textRes.value : null;
    const vision = visionRes.status === 'fulfilled' ? visionRes.value : null;

    if (!text) throw new Error('Failed to fetch main leaderboard');

    const models = normalizeModels(text.models, 'all');
    const visionModels = vision ? normalizeModels(vision.models, 'vision') : [];

    return {
      ...SOURCE,
      status: 'success',
      lastFetched: new Date().toISOString(),
      note: 'ELO rankings from head-to-head human preference votes',
      models,
      visionModels,
      availableCategories: ['all', ...(visionModels.length > 0 ? ['vision'] : [])],
    };
  } catch (err) {
    return { ...SOURCE, status: 'error', error: err.message, lastFetched: new Date().toISOString(), models: [], availableCategories: [] };
  }
}

function extractProvider(modelName) {
  const lower = modelName.toLowerCase();
  if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3')) return 'OpenAI';
  if (lower.includes('claude')) return 'Anthropic';
  if (lower.includes('gemini')) return 'Google';
  if (lower.includes('llama')) return 'Meta';
  if (lower.includes('mistral') || lower.includes('mixtral')) return 'Mistral';
  if (lower.includes('deepseek')) return 'DeepSeek';
  if (lower.includes('qwen')) return 'Alibaba';
  if (lower.includes('grok')) return 'xAI';
  return 'Unknown';
}

module.exports = { fetch };
