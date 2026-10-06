import test from 'node:test';
import assert from 'node:assert/strict';
import { displayVariants, wordLearningState } from '../src/english/status.js';

const now = Date.now();
const device = 'test-device';
const evt = (id, kind, key, at, value) => ({ id, device, kind, key, at, value });

test('new word remains new even after typing-only practice', () => {
  const events = [evt('aaaaaaaa-aaaa', 'typing', 'word:abandon', now - 1000, { correct: true, session: 's' })];
  const state = wordLearningState(events, 'abandon', now);
  assert.equal(state.state, 'new');
  assert.equal(state.label, '新词');
  assert.equal(state.reviewCount, 0);
});

test('recent wrong typing is surfaced without creating new storage state', () => {
  const events = [evt('bbbbbbbb-bbbb', 'typing', 'word:abandon', now - 1000, { correct: false, session: 's' })];
  assert.equal(wordLearningState(events, 'abandon', now).recentWrong, true);
});

test('mastered state has priority over review due state', () => {
  const events = [
    evt('cccccccc-cccc', 'review', 'word:abandon', now - 86400000 * 30, { rating: 1, firstCorrect: false, hinted: false }),
    evt('dddddddd-dddd', 'mastered', 'word:abandon', now - 100, { on: true })
  ];
  const state = wordLearningState(events, 'abandon', now);
  assert.equal(state.state, 'mastered');
  assert.equal(state.label, '已掌握');
  assert.equal(state.mastered, true);
});

test('favorite is independently preserved', () => {
  const events = [evt('eeeeeeee-eeee', 'favorite', 'word:abandon', now - 100, { on: true })];
  assert.equal(wordLearningState(events, 'abandon', now).favorite, true);
});

test('displayVariants accepts arrays, strings and objects', () => {
  assert.equal(displayVariants(['learned', 'learnt']), 'learned · learnt');
  assert.equal(displayVariants('learned'), 'learned');
  assert.equal(displayVariants({ past: 'learned', alt: 'learnt' }), 'learned · learnt');
  assert.equal(displayVariants(null), '');
});
