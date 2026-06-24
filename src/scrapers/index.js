const openrouter = require('./openrouter');
const artificialanalysis = require('./artificialanalysis');
const llmstats = require('./llmstats');
const huggingface = require('./huggingface');
const arena = require('./arena');

const SCRAPERS = [openrouter, artificialanalysis, llmstats, huggingface, arena];

async function fetchAllRankings() {
  console.log('[scrapers] Fetching all rankings...');
  const results = await Promise.allSettled(SCRAPERS.map(s => s.fetch()));

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      console.log(`[scrapers] ${result.value.name}: ${result.value.status} (${result.value.models?.length || 0} models)`);
      return result.value;
    } else {
      const scraper = SCRAPERS[i];
      console.error(`[scrapers] ${scraper.name || i} crashed:`, result.reason?.message);
      return {
        id: `source_${i}`,
        name: `Source ${i + 1}`,
        status: 'error',
        error: result.reason?.message || 'Unknown error',
        lastFetched: new Date().toISOString(),
        models: [],
        availableCategories: [],
      };
    }
  });
}

module.exports = { fetchAllRankings };
