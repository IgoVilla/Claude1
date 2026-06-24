/* ── State ─────────────────────────────────────────────────── */
let allData = null;
let activeCategory = 'all';
let searchQuery = '';
let refreshTimer = null;

/* ── DOM refs ──────────────────────────────────────────────── */
const grid          = document.getElementById('rankingsGrid');
const searchInput   = document.getElementById('searchInput');
const clearSearch   = document.getElementById('clearSearch');
const refreshBtn    = document.getElementById('refreshBtn');
const statusText    = document.getElementById('statusText');
const searchOverlay = document.getElementById('searchOverlay');
const searchResults = document.getElementById('searchResults');
const searchCount   = document.getElementById('searchResultCount');

/* ── Source colors map ─────────────────────────────────────── */
const SOURCE_COLORS = {
  openrouter:         '#6366F1',
  artificialanalysis: '#8B5CF6',
  llmstats:           '#10B981',
  huggingface:        '#F59E0B',
  arena:              '#F43F5E',
};

/* ── Fetch data ────────────────────────────────────────────── */
async function loadData() {
  try {
    const res = await fetch('/api/rankings');
    const json = await res.json();

    if (json.status === 'no_data') {
      setStatus('⏳ Fetching data for the first time...');
      scheduleRefreshCheck();
      return;
    }

    allData = json;
    render();
    updateStatus();
  } catch (e) {
    setStatus('❌ Could not connect to server');
    console.error(e);
  }
}

function scheduleRefreshCheck() {
  if (refreshTimer) return;
  refreshTimer = setInterval(async () => {
    const res = await fetch('/api/rankings');
    const json = await res.json();
    if (json.status !== 'no_data') {
      clearInterval(refreshTimer);
      refreshTimer = null;
      allData = json;
      render();
      updateStatus();
    }
  }, 4000);
}

/* ── Render ────────────────────────────────────────────────── */
function render() {
  if (!allData) return;

  if (searchQuery.trim().length > 1) {
    renderSearch();
    return;
  }

  searchOverlay.style.display = 'none';
  grid.style.display = 'grid';
  grid.innerHTML = '';

  const rankings = allData.rankings || [];
  if (rankings.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted);padding:40px;text-align:center">No data available yet.</p>';
    return;
  }

  rankings.forEach(source => {
    const card = buildCard(source);
    grid.appendChild(card);
  });
}

function buildCard(source) {
  const card = document.createElement('div');
  card.className = `source-card source-${source.id}`;
  card.dataset.sourceId = source.id;

  const color = SOURCE_COLORS[source.id] || '#6366F1';
  const models = getFilteredModels(source);

  card.innerHTML = `
    <div class="card-header">
      <div class="card-header-top">
        <div class="source-name">
          <div class="source-dot"></div>
          ${escHtml(source.name)}
        </div>
        <span class="source-status ${source.status === 'success' ? 'status-success' : 'status-error'}">
          ${source.status === 'success' ? 'live' : 'error'}
        </span>
      </div>
      <div class="card-meta">
        <span class="card-note">${escHtml(source.note || '')}</span>
        <a class="card-link" href="${source.url}" target="_blank">↗ Source</a>
      </div>
    </div>
    <div class="model-list" id="list-${source.id}">
      ${buildModelList(source, models, color)}
    </div>
  `;

  return card;
}

function buildModelList(source, models, color) {
  if (source.status === 'loading') {
    return `<div class="loading-state"><div class="loader"></div><p class="loading-text">Fetching...</p></div>`;
  }

  if (source.status === 'error' && models.length === 0) {
    return `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <div class="error-title">Could not load data</div>
        <div class="error-msg">${escHtml(source.error || 'Unknown error')}</div>
        <a class="error-link" href="${source.url}" target="_blank">Visit source →</a>
      </div>`;
  }

  if (models.length === 0) {
    return `<div class="error-state"><div class="error-icon">🔍</div><div class="error-msg">No models found for this filter.</div></div>`;
  }

  const topMetricKey = models[0] && Object.keys(models[0].metrics || {})[0];

  return models.slice(0, 30).map((m, i) => {
    const rankClass = m.rank === 1 ? 'top1' : m.rank === 2 ? 'top2' : m.rank === 3 ? 'top3' : '';
    const rankLabel = m.rank <= 3 ? ['🥇','🥈','🥉'][m.rank - 1] : `#${m.rank}`;
    const scoreVal  = m.score != null ? Number(m.score).toFixed(Number(m.score) > 100 ? 0 : 1) : '';
    const metricPills = buildMetricPills(m.metrics, 2);

    return `
      <div class="model-row" data-name="${escHtml((m.displayName || m.name || '').toLowerCase())}">
        <div class="model-rank ${rankClass}">${rankLabel}</div>
        <div class="model-info">
          <div class="model-name">${escHtml(formatName(m.displayName || m.name || ''))}</div>
          <div class="model-provider">${escHtml(m.provider || '')}</div>
        </div>
        <div>
          ${scoreVal ? `<div class="model-score" style="color:${color}">${scoreVal}</div>` : ''}
          ${metricPills ? `<div class="model-metrics">${metricPills}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function buildMetricPills(metrics, max = 2) {
  if (!metrics) return '';
  return Object.entries(metrics).slice(0, max).map(([k, v]) =>
    `<span class="metric-pill" title="${escHtml(k)}">${escHtml(String(v))}</span>`
  ).join('');
}

/* ── Search ────────────────────────────────────────────────── */
function renderSearch() {
  grid.style.display = 'none';
  searchOverlay.style.display = 'block';

  const q = searchQuery.trim().toLowerCase();
  const hits = [];

  (allData?.rankings || []).forEach(source => {
    const color = SOURCE_COLORS[source.id] || '#6366F1';
    (source.models || []).forEach(m => {
      const name = (m.displayName || m.name || '').toLowerCase();
      if (name.includes(q) || (m.provider || '').toLowerCase().includes(q)) {
        hits.push({ ...m, sourceName: source.name, sourceId: source.id, color });
      }
    });
  });

  searchCount.textContent = `${hits.length} result${hits.length !== 1 ? 's' : ''} for "${searchQuery}"`;

  if (hits.length === 0) {
    searchResults.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:20px 0">No models found matching "${escHtml(searchQuery)}"</div>`;
    return;
  }

  searchResults.innerHTML = hits.map(h => {
    const name = formatName(h.displayName || h.name || '');
    const metricPills = buildMetricPills(h.metrics, 3);
    const rankLabel = h.rank <= 3 ? ['🥇','🥈','🥉'][h.rank - 1] : `#${h.rank}`;
    return `
      <div class="search-result-card">
        <div class="result-rank" style="color:${h.color}">${rankLabel}</div>
        <div class="result-info">
          <div class="result-name">${escHtml(name)}</div>
          <div class="result-provider">${escHtml(h.provider || '')} ${metricPills ? '· ' + metricPills : ''}</div>
        </div>
        <span class="result-source" style="background:${h.color}22;color:${h.color}">${escHtml(h.sourceName)}</span>
      </div>`;
  }).join('');
}

/* ── Category Filter ───────────────────────────────────────── */
function getFilteredModels(source) {
  const models = source.models || [];
  if (activeCategory === 'all') return models;

  // Arena.ai: multi-category via categoryModels map
  if (source.id === 'arena' && source.categoryModels) {
    const catKey = activeCategory === 'all' ? 'text' : activeCategory;
    if (source.categoryModels[catKey]) return source.categoryModels[catKey];
    return source.models || [];
  }

  // HuggingFace: vision category
  if (source.id === 'huggingface' && activeCategory === 'vision' && source.visionModels) {
    return source.visionModels;
  }

  const filtered = models.filter(m =>
    (m.category || 'all') === activeCategory ||
    (m.tags || []).includes(activeCategory)
  );
  return filtered.length > 0 ? filtered : models;
}

/* ── Status ────────────────────────────────────────────────── */
function updateStatus() {
  if (!allData) return;
  const ts = allData.updatedAt;
  if (!ts) return;
  const ago = timeAgo(new Date(ts));
  statusText.innerHTML = `<span class="dot live"></span>Updated ${ago}`;
}

function setStatus(text) {
  statusText.innerHTML = text;
}

/* ── Refresh ───────────────────────────────────────────────── */
refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  refreshBtn.classList.add('spinning');
  setStatus('⏳ Refreshing...');

  try {
    const res = await fetch('/api/refresh', { method: 'POST' });
    const json = await res.json();
    showToast(json.message || 'Refresh started');

    if (json.status === 'started') {
      setTimeout(() => {
        loadData();
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('spinning');
      }, 8000);
    } else {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove('spinning');
    }
  } catch {
    showToast('Could not trigger refresh');
    refreshBtn.disabled = false;
    refreshBtn.classList.remove('spinning');
  }
});

/* ── Search Events ─────────────────────────────────────────── */
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  clearSearch.style.display = searchQuery ? 'block' : 'none';
  render();
});

clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  clearSearch.style.display = 'none';
  render();
});

/* ── Category Filter Events ────────────────────────────────── */
document.getElementById('categoryFilters').addEventListener('click', e => {
  const btn = e.target.closest('.cat-btn');
  if (!btn) return;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeCategory = btn.dataset.cat;
  render();
});

/* ── Utils ─────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatName(name) {
  return name
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(date) {
  const secs = Math.floor((Date.now() - date) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

/* ── Auto-refresh every 30 min ─────────────────────────────── */
setInterval(loadData, 30 * 60 * 1000);

/* ── Init ──────────────────────────────────────────────────── */
loadData();
