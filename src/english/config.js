export const WORD_KEY_PREFIX = 'word:';

export const ENGLISH_STORAGE_KEYS = Object.freeze({
  mode: 'wenyan-mode',
  session: 'wenyan-session',
  layer: 'wenyan-english-layer-v1',
  legacyCatalog: 'wenyan-netem-catalog-v1'
});

export const ENGLISH_MODES = Object.freeze({
  follow: Object.freeze({ label: '跟打', description: '看着单词完整输入，先练熟拼写。' }),
  recall: Object.freeze({ label: '默写', description: '根据释义回忆拼写，提交后核对。' }),
  listen: Object.freeze({ label: '听写', description: '先听发音，再完整写出单词。' })
});
export const DEFAULT_ENGLISH_MODE = 'follow';

export const ENGLISH_NEW_WORD_LIMITS = Object.freeze([6, 12, 24]);
export const DEFAULT_ENGLISH_NEW_WORD_LIMIT = 12;
export const ENGLISH_MAX_SESSION_WORDS = 24;
export const ENGLISH_WRONG_LOOKBACK_DAYS = 14;

export const ENGLISH_LIST_LIMITS = Object.freeze({
  all: 300,
  filtered: 500,
  search: 5
});

export const ENGLISH_TTS = Object.freeze({
  language: 'en-GB',
  rate: 0.82
});

export const ENGLISH_PUBLIC_DATA = Object.freeze({
  catalog: 'data/english/netem-v1.json',
  lexicon: 'data/english/ecdict-v1.json'
});

export const ENGLISH_LAYERS = Object.freeze({
  core: Object.freeze({ label: '核心', limit: 1200 }),
  high: Object.freeze({ label: '高频', limit: 2444 }),
  full: Object.freeze({ label: '完整', limit: null })
});
export const DEFAULT_ENGLISH_LAYER = 'core';

export const ENGLISH_CATALOG_MIN_SIZE = 5000;
export const ENGLISH_MAX_WORD_ID_LENGTH = 80;
export const RATING_AGAIN = 1;

export function englishLayerLimit(layer, total) {
  const configured = ENGLISH_LAYERS[layer]?.limit;
  return configured == null ? total : Math.min(configured, total);
}

export function englishModeLabel(mode) {
  return ENGLISH_MODES[mode]?.label ?? ENGLISH_MODES[DEFAULT_ENGLISH_MODE].label;
}

export function englishModeDescription(mode) {
  return ENGLISH_MODES[mode]?.description ?? ENGLISH_MODES[DEFAULT_ENGLISH_MODE].description;
}
