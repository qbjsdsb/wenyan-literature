export const NETEM_SOURCE_COMMIT = 'bf83111e0ebf29c6f9aca45d2a4f30e2c72af2e7';
export const NETEM_SOURCE_REPO = 'exam-data/NETEMVocabulary';
export const NETEM_SOURCE_FILE = 'netem_full_list.json';

export const ENGLISH_LAYERS = Object.freeze({
  core: { label: '核心', limit: 1200 },
  high: { label: '高频', limit: 2444 },
  full: { label: '完整', limit: 5530 }
});

export const DEFAULT_ENGLISH_LAYER = 'core';

export function normalizeWordId(value) {
  return String(value ?? '').trim().toLowerCase().normalize('NFKC');
}

export function normalizeRow(row) {
  const word = String(row?.['单词'] ?? row?.word ?? '').trim();
  const meaning = String(row?.['释义'] ?? row?.meaning ?? '').trim();
  const id = normalizeWordId(row?.id ?? word);
  if (!word || !meaning || !id || id.length > 80) return null;

  return {
    id,
    word,
    meaning,
    frequency: Number(row?.['词频'] ?? row?.frequency) || 0,
    rank: Number(row?.['序号'] ?? row?.rank) || 99999,
    variants: row?.['其他拼写'] ?? row?.variants ?? null,
    category: row?.['分类'] ?? row?.category ?? null,
    subcategory: row?.['子分类'] ?? row?.subcategory ?? null
  };
}

export function normalizeCatalog(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  return rows
    .map(normalizeRow)
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
    .filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

export function catalogFromPayload(payload) {
  if (Array.isArray(payload?.catalog)) return normalizeCatalog(payload.catalog);
  const rows = payload?.['5530考研词汇词频排序表'] ?? Object.values(payload ?? {}).find(Array.isArray);
  return normalizeCatalog(rows);
}

export function isCompleteCatalog(catalog) {
  return Array.isArray(catalog) && catalog.length >= 5000;
}

export function resolveEnglishLayer(value) {
  return Object.hasOwn(ENGLISH_LAYERS, value) ? value : DEFAULT_ENGLISH_LAYER;
}

export function selectActiveCatalog(catalog, seedWords = [], layer = DEFAULT_ENGLISH_LAYER) {
  const selectedLayer = resolveEnglishLayer(layer);
  const limit = Math.min(ENGLISH_LAYERS[selectedLayer].limit, catalog.length);
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

  return selected;
}
