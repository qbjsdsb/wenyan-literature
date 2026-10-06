import { words } from './content.js';
import {
  DEFAULT_ENGLISH_LAYER,
  ENGLISH_LAYERS,
  NETEM_SOURCE_COMMIT,
  NETEM_SOURCE_REPO,
  catalogFromPayload,
  isCompleteCatalog,
  resolveEnglishLayer,
  selectActiveCatalog
} from './english/catalog.js';

const LEGACY_CACHE_KEY = 'wenyan-netem-catalog-v1';
const LAYER_KEY = 'wenyan-english-layer-v1';
const DATASET_PAGE = `https://github.com/${NETEM_SOURCE_REPO}`;
const LOCAL_SNAPSHOT = '/data/english/netem-v1.json';
const DATASET_URLS = [
  LOCAL_SNAPSHOT,
  `https://cdn.jsdelivr.net/gh/${NETEM_SOURCE_REPO}@${NETEM_SOURCE_COMMIT}/netem_full_list.json`,
  `https://raw.githubusercontent.com/${NETEM_SOURCE_REPO}/${NETEM_SOURCE_COMMIT}/netem_full_list.json`
];

const seedWords = words.map(word => ({ ...word }));
const seedById = new Map(seedWords.map(word => [word.id.toLowerCase(), word]));
let catalog = null;
let activeLayer = readLayer();

export const vocabularyMeta = {
  status: 'sample',
  active: words.length,
  total: words.length,
  source: '内置样本',
  sourceCommit: NETEM_SOURCE_COMMIT,
  license: '内置样本',
  layer: activeLayer,
  bundled: false
};

function readLayer() {
  try {
    return resolveEnglishLayer(localStorage.getItem(LAYER_KEY) || DEFAULT_ENGLISH_LAYER);
  } catch {
    return DEFAULT_ENGLISH_LAYER;
  }
}

function writeLayer(layer) {
  try {
    localStorage.setItem(LAYER_KEY, layer);
  } catch {
    // Preference failure must not block learning.
  }
}

function clearLegacyCatalogCache() {
  try {
    localStorage.removeItem(LEGACY_CACHE_KEY);
  } catch {
    // This is only an obsolete content cache, never learning state.
  }
}

function withRuntimeFields(item) {
  const seed = seedById.get(item.id);
  return {
    ...item,
    ipa: seed?.ipa ?? item.ipa ?? '',
    source: `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(item.word.toLowerCase())}`
  };
}

function activate(nextCatalog, { bundled = false, source = 'NETEMVocabulary' } = {}) {
  if (!isCompleteCatalog(nextCatalog)) return false;
  catalog = nextCatalog;
  const active = selectActiveCatalog(catalog, seedWords, activeLayer).map(withRuntimeFields);
  words.splice(0, words.length, ...active);
  Object.assign(vocabularyMeta, {
    status: 'ready',
    active: active.length,
    total: catalog.length,
    source,
    sourceCommit: NETEM_SOURCE_COMMIT,
    license: 'CC BY-NC-SA 4.0',
    layer: activeLayer,
    bundled
  });
  window.__wenyanVocabularyMeta = { ...vocabularyMeta };
  window.dispatchEvent(new CustomEvent('wenyan-vocabulary-loaded', { detail: { ...vocabularyMeta } }));
  clearLegacyCatalogCache();
  return true;
}

async function loadCatalog() {
  let lastError;
  for (const url of DATASET_URLS) {
    try {
      const response = await fetch(url, { cache: url === LOCAL_SNAPSHOT ? 'default' : 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const nextCatalog = catalogFromPayload(payload);
      if (!isCompleteCatalog(nextCatalog)) throw new Error('Vocabulary catalog is incomplete');
      return {
        catalog: nextCatalog,
        bundled: url === LOCAL_SNAPSHOT,
        source: url === LOCAL_SNAPSHOT ? 'Wenyan 固定词库快照' : 'NETEMVocabulary 固定版本'
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Vocabulary load failed');
}

function layerOptions() {
  return Object.entries(ENGLISH_LAYERS)
    .map(([id, info]) => `<option value="${id}" ${activeLayer === id ? 'selected' : ''}>${info.label} · ${info.limit}词</option>`)
    .join('');
}

function decorateEnglishPage() {
  const page = document.querySelector('.english-page');
  if (!page) return;
  const badge = page.querySelector('.page-heading .muted');
  const lead = page.querySelector('.lead');
  const note = page.querySelector('.source-note');
  const newLimit = page.querySelector('#new-limit')?.closest('label');

  if (badge) {
    badge.textContent = vocabularyMeta.status === 'ready'
      ? `${ENGLISH_LAYERS[activeLayer].label}学习集 · ${vocabularyMeta.active}词 / 全量${vocabularyMeta.total}词`
      : `基础样本 · ${words.length}词`;
  }

  if (lead && vocabularyMeta.status === 'ready') {
    lead.textContent = '到期复习优先；新词按固定考研词频顺序进入训练。';
  }

  if (vocabularyMeta.status === 'ready' && newLimit && !page.querySelector('#vocab-layer')) {
    newLimit.insertAdjacentHTML('afterend', `<label class="small-control">词库范围 <select id="vocab-layer">${layerOptions()}</select></label>`);
  }

  if (note) {
    if (vocabularyMeta.status === 'ready') {
      const origin = vocabularyMeta.bundled ? '随 Wenyan 构建发布的固定快照' : '固定提交回退源';
      note.innerHTML = `词频与释义来自 <a href="${DATASET_PAGE}" target="_blank" rel="noopener">NETEMVocabulary</a>，数据许可 CC BY-NC-SA 4.0。当前使用 ${origin}（${NETEM_SOURCE_COMMIT.slice(0, 12)}），不再跟随上游 master 漂移；完整目录 ${vocabularyMeta.total} 词。`;
    } else {
      note.textContent = '当前使用内置基础词组；固定考研词库未能载入时仍可继续练习。';
    }
  }
}

function changeLayer(value) {
  const next = resolveEnglishLayer(value);
  if (next === activeLayer) return;
  activeLayer = next;
  writeLayer(activeLayer);
  if (catalog) activate(catalog, { bundled: vocabularyMeta.bundled, source: vocabularyMeta.source });
}

const style = document.createElement('style');
style.textContent = '.ipa:empty{display:none}';
document.head.append(style);

const app = document.getElementById('app');
if (app) new MutationObserver(decorateEnglishPage).observe(app, { childList: true });

document.addEventListener('change', event => {
  if (event.target?.id === 'vocab-layer') changeLayer(event.target.value);
});

window.addEventListener('wenyan-vocabulary-loaded', () => {
  if (location.hash === '#english') window.dispatchEvent(new Event('hashchange'));
  else decorateEnglishPage();
});

decorateEnglishPage();
loadCatalog()
  .then(result => activate(result.catalog, result))
  .catch(() => {
    vocabularyMeta.status = 'sample';
    decorateEnglishPage();
  });
