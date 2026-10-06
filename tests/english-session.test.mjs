import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasUnfinishedEnglishSession,
  markEnglishSessionHinted,
  pendingEnglishWordIds,
  recordEnglishFirstAttempt
} from '../src/english/session.js';

const base = {
  id: 'session-1234',
  mode: 'recall',
  queue: ['abandon', 'ability', 'remote-word'],
  index: 1,
  results: [],
  startedAt: 1
};

test('unfinished session exposes only pending word ids', () => {
  assert.equal(hasUnfinishedEnglishSession(base), true);
  assert.deepEqual(pendingEnglishWordIds(base), ['ability', 'remote-word']);
  assert.deepEqual(pendingEnglishWordIds({ ...base, index: 3 }), []);
});

test('hint is persisted into current state without inventing a first-attempt result', () => {
  const hinted = markEnglishSessionHinted(base);
  assert.equal(hinted.current.hinted, true);
  assert.equal(Object.hasOwn(hinted.current, 'firstCorrect'), false);
});

test('first attempt keeps an earlier persisted hint after refresh', () => {
  const hinted = markEnglishSessionHinted(base);
  const attempted = recordEnglishFirstAttempt(hinted, true, false);
  assert.equal(attempted.current.firstCorrect, true);
  assert.equal(attempted.current.hinted, true);
});

test('first attempt is immutable once recorded', () => {
  const first = recordEnglishFirstAttempt(base, false, false);
  const later = recordEnglishFirstAttempt(first, true, false);
  assert.equal(later.current.firstCorrect, false);
});
