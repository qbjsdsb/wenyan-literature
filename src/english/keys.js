import { WORD_KEY_PREFIX } from './config.js';

export function wordKey(id) {
  return `${WORD_KEY_PREFIX}${id}`;
}

export function isWordKey(key) {
  return typeof key === 'string' && key.startsWith(WORD_KEY_PREFIX);
}

export function wordIdFromKey(key) {
  return isWordKey(key) ? key.slice(WORD_KEY_PREFIX.length) : null;
}
