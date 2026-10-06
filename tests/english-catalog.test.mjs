import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGLISH_LAYERS,
  catalogFromPayload,
  isCompleteCatalog,
  normalizeCatalog,
  resolveEnglishLayer,
  selectActiveCatalog
} from '../src/english/catalog.js';

test('normalizes upstream rows, sorts by rank, and removes duplicate ids', () => {
  const rows = [
    { 序号: 2, 单词: 'Ability', 释义: '能力', 词频: 10 },
    { 序号: 1, 单词: 'abandon', 释义: '放弃', 词频: 20 },
    { 序号: 3, 单词: 'ABILITY', 释义: '能力（重复）', 词频: 9 },
    { 序号: 4, 单词: '', 释义: '无效' }
  ];
  const catalog = normalizeCatalog(rows);
  assert.deepEqual(catalog.map(item => item.id), ['abandon', 'ability']);
  assert.equal(catalog[0].rank, 1);
  assert.equal(catalog[1].meaning, '能力');
});

test('reads both normalized snapshots and upstream payloads', () => {
  const normalized = catalogFromPayload({ catalog: [{ rank: 1, word: 'abandon', meaning: '放弃' }] });
  const upstream = catalogFromPayload({ '5530考研词汇词频排序表': [{ 序号: 1, 单词: 'abandon', 释义: '放弃' }] });
  assert.equal(normalized[0].id, 'abandon');
  assert.equal(upstream[0].id, 'abandon');
});

test('study layers use stable limits and preserve old seed words', () => {
  const catalog = Array.from({ length: 5600 }, (_, index) => ({
    id: `word-${index + 1}`,
    word: `word-${index + 1}`,
    meaning: `meaning-${index + 1}`,
    rank: index + 1,
    frequency: 5600 - index,
    variants: null,
    category: null,
    subcategory: null
  }));
  const seed = { id: 'legacy-seed', word: 'legacy-seed', meaning: '旧词', ipa: '/seed/' };
  const core = selectActiveCatalog(catalog, [seed], 'core');
  const high = selectActiveCatalog(catalog, [seed], 'high');
  const full = selectActiveCatalog(catalog, [seed], 'full');

  assert.equal(core.length, ENGLISH_LAYERS.core.limit + 1);
  assert.equal(high.length, ENGLISH_LAYERS.high.limit + 1);
  assert.equal(full.length, ENGLISH_LAYERS.full.limit + 1);
  assert.equal(core.at(-1).id, 'legacy-seed');
});

test('invalid layer falls back to core', () => {
  assert.equal(resolveEnglishLayer('unknown'), 'core');
});

test('complete catalog requires at least 5000 normalized items', () => {
  assert.equal(isCompleteCatalog(Array.from({ length: 5000 }, () => ({}))), true);
  assert.equal(isCompleteCatalog(Array.from({ length: 4999 }, () => ({}))), false);
});
