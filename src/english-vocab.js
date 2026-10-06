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

export const DATASET_PAGE = `https://github.com/${NETEM_SOURCE_REPO}`;

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
let enrichedCatalog = [];
let pendingWordIds = () => [];
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
  enrichedCatalog = enriched.map(withRuntimeFields);
  const layerSize = englishLayerLimit(activeLayer, enriched.length);
  const compatibleActive = selectActiveCatalog(enriched, seedWords, activeLayer);
  const pendingIds = pendingWordIds();
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

export function changeEnglishLayer(value) {
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

// One data interface; app.js owns all DOM rendering. The read-only global is
// retained for existing browser smoke / diagnostics, never used as state.
export function getVocabularyState() {
  return { ...vocabularyMeta, lexiconSource: lexiconPayload?.source ? { ...lexiconPayload.source } : null };
}
export function activeLearningIds() {
  return catalog ? new Set(catalog.slice(0, englishLayerLimit(activeLayer, catalog.length)).map(word => word.id)) : new Set(words.map(word => word.id));
}
export function findEnglishWord(id) {
  return words.find(word => word.id === id) || enrichedCatalog.find(word => word.id === id);
}
export function searchEnglishWords(query, limit = 5) {
  const text = query.trim().toLowerCase();
  if (!text) return [];
  const pool = enrichedCatalog.length ? enrichedCatalog : words;
  return pool.filter(word => (word.word + word.meaning).toLowerCase().includes(text)).slice(0, limit);
}
export function initializeVocabulary({ getPendingWordIds = () => [] } = {}) {
  pendingWordIds = getPendingWordIds;
  window.__wenyanVocabularyMeta = { ...vocabularyMeta };
  return Promise.all([loadCatalog(), loadLexicon()])
    .then(([result, lexicon]) => {
      lexiconPayload = lexicon;
      activate(result.catalog, result);
    })
    .catch(() => {
      vocabularyMeta.status = 'sample';
      window.__wenyanVocabularyMeta = { ...vocabularyMeta };
      window.dispatchEvent(new CustomEvent('wenyan-vocabulary-loaded', { detail: { ...vocabularyMeta } }));
    });
}
