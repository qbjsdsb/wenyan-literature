import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY } from '../src/core.js';
import { isRecentWrongEnglishAttempt, isWrongEnglishAttempt } from '../src/english/events.js';
import { isWordKey, wordIdFromKey, wordKey } from '../src/english/keys.js';

const now = new Date(2026, 9, 6, 12, 0, 0).getTime();
const event = (kind, value, at = now) => ({ key: wordKey('abandon'), kind, value, at });

test('word key helpers round-trip stable ids', () => {
  assert.equal(wordKey('abandon'), 'word:abandon');
  assert.equal(isWordKey('word:abandon'), true);
  assert.equal(wordIdFromKey('word:abandon'), 'abandon');
  assert.equal(wordIdFromKey('lit:abandon'), null);
});

test('shared wrong-attempt semantics cover typing, forgetting, misspelling and hints', () => {
  assert.equal(isWrongEnglishAttempt(event('typing', { correct: false })), true);
  assert.equal(isWrongEnglishAttempt(event('typing', { correct: true })), false);
  assert.equal(isWrongEnglishAttempt(event('review', { rating: 1, firstCorrect: true, hinted: false })), true);
  assert.equal(isWrongEnglishAttempt(event('review', { rating: 3, firstCorrect: false, hinted: false })), true);
  assert.equal(isWrongEnglishAttempt(event('review', { rating: 3, firstCorrect: true, hinted: true })), true);
  assert.equal(isWrongEnglishAttempt(event('review', { rating: 3, firstCorrect: true, hinted: false })), false);
});

test('recent wrong uses the shared lookback window', () => {
  assert.equal(isRecentWrongEnglishAttempt(event('typing', { correct: false }, now), { now }), true);
  const old = event('typing', { correct: false }, now - 15 * DAY);
  assert.equal(isRecentWrongEnglishAttempt(old, { now }), false);
});
