import { words } from './content.js';
import { local } from './storage.js';
import {
  ENGLISH_CATALOG_MIN_SIZE,
  ENGLISH_LAYERS,
  ENGLISH_PUBLIC_DATA,
  ENGLISH_STORAGE_KEYS,
  englishLayerLimit
} from './english/config.js';
import {
  DEFAULT_ENGLISH_LAYER,
  NETEM_SOURCE_COMMIT,
  NETEM_SOURCE_REPO,
  catalogFromPayload,
  catalogRowsFromPayload,
  isCompleteCatalog,
  resolveEnglishLayer,
  selectActiveCatalog
} from './english/catalog.js';
import { applyLexiconEnrichment } from './english/lexicon.js';

const DATASET_PAGE = `https://github.com/${NETEM_SOURCE_REPO}`;

function publicAssetUrl(path) {
  const base = typeof import.meta.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/';
  return `${base.endsWith('/') ? base : `${base}/`}${String(path).replace(/^\/+/, '')}`;
}

const LOCAL_SNAPSHOT = publicAssetUrl(ENGLISH_PUBLIC_DATA.catalog);
const LEXICON_SNAPSHOT = publicAssetUrl(ENGLISH_PUBLIC_DATA.lexicon);
const DATASET_URLS = [
  LOCAL_SNAPSHOT,
  `https://cdn.jsdelivr.net/gh/${NETEM_SOURCE_REPO}@${NETEM_SOURCE_COMMIT}/netem_full_list.json`,
  `https://raw.githubusercontent.com/${NETEM_SOURCE_REPO}/${NETEM_SOURCE_COMMIT}/netem_full_list.json`
];

const seedWords = words.map(word => ({ ...word }));
const seedById = new Map(seedWords.map(word => [word.id.toLowerCase(), word]));
let catalog = null;
let lexiconPayload = null;
let activeLayer = readLayer();

export const vocabularyMeta = {
  status: 'loading',
  active: words.length,
  compatibility: 0,
  carryover: 0,
  total: words.length,
  sourceCount: words.length,
  source: '内置兼容词组',
  sourceCommit: NETEM_SOURCE_COMMIT,
  license: '内置兼容数据',
  layer: activeLayer,
  bundled: false,
  lexicon: false,
  phoneticCount: 0,
  posCount: 0,
  exchangeCount: 0
};

function readLayer() {
  try {
    return resolveEnglishLayer(local.getItem(ENGLISH_STORAGE_KEYS.layer) || DEFAULT_ENGLISH_LAYER);
  } catch {
    return DEFAULT_ENGLISH_LAYER;
  }
}

function writeLayer(layer) {
  try {
    local.setItem(ENGLISH_STORAGE_KEYS.layer, layer);
  } catch {
    // Preference failure must not block learning.
  }
}

function clearLegacyCatalogCache() {
  try {
    local.removeItem(ENGLISH_STORAGE_KEYS.legacyCatalog);
  } catch {
    // This is only an obsolete content cache, never learning state.
  }
}

function withRuntimeFields(item) {
  const seed = seedById.get(item.id);
  return {
    ...item,
    ipa: seed?.ipa || item.ipa || '',
    source: `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(item.word.toLowerCase())}`
  };
}

function activate(nextCatalog, {
  bundled = false,
  source = 'NETEMVocabulary',
  sourceCount = nextCatalog.length
} = {}) {
  if (!isCompleteCatalog(nextCatalog)) return false;
  catalog = nextCatalog;
  const enriched = lexiconPayload ? applyLexiconEnrichment(catalog, lexiconPayload) : catalog;
  const layerSize = englishLayerLimit(activeLayer, enriched.length);
  const compatibleActive = selectActiveCatalog(enriched, seedWords, activeLayer);
  const pendingIds = globalThis.__wenyanActiveEnglishSessionIds?.() ?? [];
  const active = selectActiveCatalog(enriched, seedWords, activeLayer, pendingIds).map(withRuntimeFields);
  words.splice(0, words.length, ...active);
  Object.assign(vocabularyMeta, {
    status: 'ready',
    active: layerSize,
    compatibility: Math.max(0, compatibleActive.length - layerSize),
    carryover: Math.max(0, active.length - compatibleActive.length),
    total: catalog.length,
    sourceCount,
    source,
    sourceCommit: NETEM_SOURCE_COMMIT,
    license: 'CC BY-NC-SA 4.0',
    layer: activeLayer,
    bundled,
    lexicon: Boolean(lexiconPayload),
    phoneticCount: Number(lexiconPayload?.phoneticCount) || 0,
    posCount: Number(lexiconPayload?.posCount) || 0,
    exchangeCount: Number(lexiconPayload?.exchangeCount) || 0
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
      const sourceCount = Number(payload?.sourceCount) || catalogRowsFromPayload(payload).length || nextCatalog.length;
      return {
        catalog: nextCatalog,
        sourceCount,
        bundled: url === LOCAL_SNAPSHOT,
        source: url === LOCAL_SNAPSHOT ? 'Wenyan 固定词库快照' : 'NETEMVocabulary 固定版本'
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Vocabulary load failed');
}

async function loadLexicon() {
  try {
    const response = await fetch(LEXICON_SNAPSHOT, { cache: 'default' });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload?.entries || Number(payload.matchedCount) < ENGLISH_CATALOG_MIN_SIZE) return null;
    return payload;
  } catch {
    return null;
  }
}

function layerOptions() {
  return Object.entries(ENGLISH_LAYERS)
    .map(([id, info]) => {
      const count = vocabularyMeta.status === 'ready'
        ? englishLayerLimit(id, vocabularyMeta.total)
        : info.limit ?? '全部';
      return `<option value="${id}" ${activeLayer === id ? 'selected' : ''}>${info.label} · ${count}${typeof count === 'number' ? '词' : ''}</option>`;
    })
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
    const extras = [
      vocabularyMeta.compatibility ? `兼容保留${vocabularyMeta.compatibility}词` : '',
      vocabularyMeta.carryover ? `续学保留${vocabularyMeta.carryover}词` : ''
    ].filter(Boolean);
    badge.textContent = vocabularyMeta.status === 'ready'
      ? `${ENGLISH_LAYERS[activeLayer].label}学习集 · ${vocabularyMeta.active}词 / 唯一词${vocabularyMeta.total}词${extras.length ? ` · ${extras.join(' · ')}` : ''}`
      : `兼容词组 · ${words.length}词`;
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
      const lexiconParts = [
        vocabularyMeta.phoneticCount ? `${vocabularyMeta.phoneticCount} 词音标` : '',
        vocabularyMeta.exchangeCount ? `${vocabularyMeta.exchangeCount} 词词形` : '',
        vocabularyMeta.posCount ? `${vocabularyMeta.posCount} 词词性` : ''
      ].filter(Boolean);
      const lexicon = vocabularyMeta.lexicon && lexiconParts.length
        ? `；另由固定 ECDICT enrichment 补充 ${lexiconParts.join(' / ')}`
        : '';
      note.innerHTML = `词频与释义来自 <a href="${DATASET_PAGE}" target="_blank" rel="noopener">NETEMVocabulary</a>，数据许可 CC BY-NC-SA 4.0。当前使用 ${origin}（${NETEM_SOURCE_COMMIT.slice(0, 12)}）；上游 ${vocabularyMeta.sourceCount} 行规范化为 ${vocabularyMeta.total} 个稳定词条${lexicon}。`;
    } else {
      note.textContent = '固定考研词库未能载入；当前只保留兼容词组，学习记录不会被删除。';
    }
  }
}

function changeLayer(value) {
  const next = resolveEnglishLayer(value);
  if (next === activeLayer) return;
  activeLayer = next;
  writeLayer(activeLayer);
  if (catalog) activate(catalog, {
    bundled: vocabularyMeta.bundled,
    source: vocabularyMeta.source,
    sourceCount: vocabularyMeta.sourceCount
  });
}

const app = document.getElementById('app');
if (app) new MutationObserver(decorateEnglishPage).observe(app, { childList: true });

document.addEventListener('change', event => {
  if (event.target?.id === 'vocab-layer') changeLayer(event.target.value);
});

window.addEventListener('wenyan-vocabulary-loaded', () => {
  if (['#english', '#train'].includes(location.hash)) window.dispatchEvent(new Event('hashchange'));
  else decorateEnglishPage();
});

window.__wenyanVocabularyMeta = { ...vocabularyMeta };
decorateEnglishPage();
Promise.all([loadCatalog(), loadLexicon()])
  .then(([result, lexicon]) => {
    lexiconPayload = lexicon;
    activate(result.catalog, result);
  })
  .catch(() => {
    vocabularyMeta.status = 'sample';
    window.__wenyanVocabularyMeta = { ...vocabularyMeta };
    window.dispatchEvent(new CustomEvent('wenyan-vocabulary-loaded', { detail: { ...vocabularyMeta } }));
  });