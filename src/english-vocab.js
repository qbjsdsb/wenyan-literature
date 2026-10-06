import { words } from './content.js';

const CACHE_KEY = 'wenyan-netem-catalog-v1';
const CACHE_VERSION = 1;
const ACTIVE_LIMIT = 1200;
const DATASET_PAGE = 'https://github.com/exam-data/NETEMVocabulary';
const DATASET_URLS = [
  'https://cdn.jsdelivr.net/gh/exam-data/NETEMVocabulary@master/netem_full_list.json',
  'https://raw.githubusercontent.com/exam-data/NETEMVocabulary/master/netem_full_list.json'
];

const seedWords = words.map(word => ({ ...word }));
const seedById = new Map(seedWords.map(word => [word.id.toLowerCase(), word]));

export const vocabularyMeta = {
  status: 'sample',
  active: words.length,
  total: words.length,
  source: '内置样本',
  license: '内置样本',
  fromCache: false
};

function normalizeRow(row) {
  const word = String(row?.['单词'] ?? '').trim();
  const id = word.toLowerCase().normalize('NFKC');
  if (!word || id.length > 80 || !String(row?.['释义'] ?? '').trim()) return null;
  const seed = seedById.get(id);
  return {
    id,
    word,
    ipa: seed?.ipa ?? '',
    meaning: String(row['释义']).trim(),
    frequency: Number(row['词频']) || 0,
    rank: Number(row['序号']) || 99999,
    variants: row['其他拼写'] ?? null,
    category: row['分类'] ?? null,
    subcategory: row['子分类'] ?? null,
    source: `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word.toLowerCase())}`
  };
}

function normalizeCatalog(rows) {
  const seen = new Set();
  return rows
    .map(normalizeRow)
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank)
    .filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

function selectActive(catalog) {
  const selected = catalog.slice(0, ACTIVE_LIMIT);
  const selectedIds = new Set(selected.map(word => word.id));
  // Preserve every old v0.1 seed word so unfinished sessions and review records stay usable.
  for (const seed of seedWords) {
    if (selectedIds.has(seed.id)) continue;
    const full = catalog.find(word => word.id === seed.id);
    selected.push(full ?? seed);
    selectedIds.add(seed.id);
  }
  return selected;
}

function activate(catalog, { fromCache = false } = {}) {
  if (!Array.isArray(catalog) || catalog.length < 1000) return false;
  const active = selectActive(catalog);
  words.splice(0, words.length, ...active);
  Object.assign(vocabularyMeta, {
    status: 'ready',
    active: active.length,
    total: catalog.length,
    source: 'NETEMVocabulary',
    license: 'CC BY-NC-SA 4.0',
    fromCache
  });
  window.__wenyanVocabularyMeta = { ...vocabularyMeta };
  window.dispatchEvent(new CustomEvent('wenyan-vocabulary-loaded', { detail: { ...vocabularyMeta } }));
  return true;
}

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached?.version !== CACHE_VERSION || !Array.isArray(cached.catalog)) return null;
    return cached.catalog;
  } catch {
    return null;
  }
}

function writeCache(catalog) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, catalog }));
  } catch {
    // The vocabulary still works for this session even if the browser refuses the cache.
  }
}

async function fetchCatalog() {
  let lastError;
  for (const url of DATASET_URLS) {
    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const rows = payload?.['5530考研词汇词频排序表'] ?? Object.values(payload ?? {}).find(Array.isArray);
      if (!Array.isArray(rows)) throw new Error('Unexpected vocabulary payload');
      const catalog = normalizeCatalog(rows);
      if (catalog.length < 5000) throw new Error('Vocabulary catalog is incomplete');
      return catalog;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Vocabulary download failed');
}

function decorateEnglishPage() {
  const page = document.querySelector('.english-page');
  if (!page) return;
  const badge = page.querySelector('.page-heading .muted');
  const lead = page.querySelector('.lead');
  const note = page.querySelector('.source-note');
  if (badge) {
    badge.textContent = vocabularyMeta.status === 'ready'
      ? `考研高频学习集 · ${vocabularyMeta.active}词 / 全量${vocabularyMeta.total}词`
      : `基础样本 · ${words.length}词`;
  }
  if (lead && vocabularyMeta.status === 'ready') {
    lead.textContent = '优先复习到期词；新词按考研试卷词频顺序进入训练。';
  }
  if (note) {
    if (vocabularyMeta.status === 'ready') {
      note.innerHTML = `词频与释义数据来自 <a href="${DATASET_PAGE}" target="_blank" rel="noopener">NETEMVocabulary</a>，数据许可 CC BY-NC-SA 4.0。当前为性能优化后的高频学习集，完整目录共 ${vocabularyMeta.total} 词；旧 v0.1 学习记录继续沿用。`;
    } else {
      note.textContent = '当前使用内置基础词组；考研词库正在加载，失败时仍可继续练习。';
    }
  }
}

const style = document.createElement('style');
style.textContent = '.ipa:empty{display:none}';
document.head.append(style);

const app = document.getElementById('app');
if (app) new MutationObserver(decorateEnglishPage).observe(app, { childList: true });

window.addEventListener('wenyan-vocabulary-loaded', () => {
  if (location.hash === '#english') window.dispatchEvent(new Event('hashchange'));
  else decorateEnglishPage();
});

const cached = readCache();
if (cached) activate(cached, { fromCache: true });
else decorateEnglishPage();

if (navigator.onLine !== false) {
  fetchCatalog()
    .then(catalog => {
      writeCache(catalog);
      activate(catalog);
    })
    .catch(() => {
      vocabularyMeta.status = cached ? 'ready' : 'sample';
      decorateEnglishPage();
    });
}
