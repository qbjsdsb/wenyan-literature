import {
  DEFAULT_ENGLISH_LAYER,
  ENGLISH_CATALOG_MIN_SIZE,
  ENGLISH_LAYERS,
  ENGLISH_MAX_WORD_ID_LENGTH,
  englishLayerLimit
} from './config.js';

export { DEFAULT_ENGLISH_LAYER, ENGLISH_LAYERS };

export const NETEM_SOURCE_COMMIT = 'bf83111e0ebf29c6f9aca45d2a4f30e2c72af2e7';
export const NETEM_SOURCE_REPO = 'exam-data/NETEMVocabulary';
export const NETEM_SOURCE_FILE = 'netem_full_list.json';
export const NETEM_UPSTREAM_LIST_KEY = '5530考研词汇词频排序表';

export function normalizeWordId(value) {
  return String(value ?? '').trim().toLowerCase().normalize('NFKC');
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function mergeText(left, right, separator = '；') {
  const values = [left, right].map(value => String(value ?? '').trim()).filter(Boolean);
  return [...new Set(values)].join(separator);
}

export function normalizeRow(row) {
  const word = String(row?.['单词'] ?? row?.word ?? '').trim();
  const meaning = String(row?.['释义'] ?? row?.meaning ?? '').trim();
  const id = normalizeWordId(row?.id ?? word);
  if (!word || !meaning || !id || id.length > ENGLISH_MAX_WORD_ID_LENGTH) return null;

  return {
    id,
    word,
    meaning,
    frequency: finitePositive(row?.['词频'] ?? row?.frequency) ?? 0,
    rank: finitePositive(row?.['序号'] ?? row?.rank),
    variants: row?.['其他拼写'] ?? row?.variants ?? null,
    category: row?.['分类'] ?? row?.category ?? null,
    subcategory: row?.['子分类'] ?? row?.subcategory ?? null
  };
}

export function normalizeCatalog(rows) {
  if (!Array.isArray(rows)) return [];
  const byId = new Map();

  for (const row of rows) {
    const item = normalizeRow(row);
    if (!item) continue;
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }

    // Case-insensitive normalization intentionally keeps a stable word:<id> key.
    // When the upstream contains multiple senses such as may/May or march/March,
    // merge their learning information instead of silently dropping a source row.
    existing.meaning = mergeText(existing.meaning, item.meaning);
    existing.frequency += item.frequency;
    existing.rank = existing.rank == null ? item.rank : item.rank == null ? existing.rank : Math.min(existing.rank, item.rank);
    existing.variants = existing.variants ?? item.variants;
    existing.category = mergeText(existing.category, item.category, ' / ') || null;
    existing.subcategory = mergeText(existing.subcategory, item.subcategory, ' / ') || null;
  }

  return [...byId.values()].sort((a, b) =>
    (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY) || a.id.localeCompare(b.id)
  );
}

export function catalogRowsFromPayload(payload) {
  if (Array.isArray(payload?.catalog)) return payload.catalog;
  return payload?.[NETEM_UPSTREAM_LIST_KEY] ?? Object.values(payload ?? {}).find(Array.isArray) ?? [];
}

export function catalogFromPayload(payload) {
  return normalizeCatalog(catalogRowsFromPayload(payload));
}

export function isCompleteCatalog(catalog) {
  return Array.isArray(catalog) && catalog.length >= ENGLISH_CATALOG_MIN_SIZE;
}

export function resolveEnglishLayer(value) {
  return Object.hasOwn(ENGLISH_LAYERS, value) ? value : DEFAULT_ENGLISH_LAYER;
}

export function selectActiveCatalog(catalog, seedWords = [], layer = DEFAULT_ENGLISH_LAYER, preserveIds = []) {
  const selectedLayer = resolveEnglishLayer(layer);
  const limit = englishLayerLimit(selectedLayer, catalog.length);
  const selected = catalog.slice(0, limit).map(item => ({ ...item }));
  const selectedIds = new Set(selected.map(item => item.id));
  const byId = new Map(catalog.map(item => [item.id, item]));

  // Keep old v0.1 words available so existing sessions/review records remain valid.
  for (const seed of seedWords) {
    const id = normalizeWordId(seed?.id ?? seed?.word);
    if (!id || selectedIds.has(id)) continue;
    selected.push({ ...(byId.get(id) ?? seed), id });
    selectedIds.add(id);
  }

  // An unfinished session is stronger than the selected learning layer. Keep its
  // remaining words resolvable until the group is completed, even after a layer switch.
  for (const rawId of preserveIds) {
    const id = normalizeWordId(rawId);
    if (!id || selectedIds.has(id)) continue;
    const item = byId.get(id);
    if (!item) continue;
    selected.push({ ...item });
    selectedIds.add(id);
  }

  return selected;
}
