import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnglishQueue, recentWrongWordIds } from '../src/english/queue.js';

function event({ id, kind, key, at, value }) {
  return { id, kind, key, at, value, device: 'test-device' };
}

test('smart queue orders due, recent wrong, then new and removes duplicates', () => {
  const queue = buildEnglishQueue({
    dueIds: ['due-1', 'shared'],
    wrongIds: ['wrong-1', 'shared'],
    newIds: ['new-1', 'new-2'],
    newLimit: 1,
    maxTotal: 10
  });
  assert.deepEqual(queue, ['due-1', 'shared', 'wrong-1', 'new-1']);
});

test('smart queue respects total cap', () => {
  const queue = buildEnglishQueue({
    dueIds: ['a', 'b', 'c'],
    wrongIds: ['d'],
    newIds: ['e'],
    maxTotal: 3
  });
  assert.deepEqual(queue, ['a', 'b', 'c']);
});

test('latest correct attempt clears an earlier wrong word', () => {
  const now = Date.now();
  const events = [
    event({ id: 'aaaaaaaa-aaaa', kind: 'typing', key: 'word:abandon', at: now - 1000, value: { correct: false, session: 's' } }),
    event({ id: 'bbbbbbbb-bbbb', kind: 'typing', key: 'word:abandon', at: now, value: { correct: true, session: 's2' } })
  ];
  assert.deepEqual(recentWrongWordIds(events, new Set(['abandon']), { now }), []);
});

test('review with failed recall, hint, or spelling miss enters recent wrong list', () => {
  const now = Date.now();
  const events = [
    event({ id: 'aaaaaaaa-aa11', kind: 'review', key: 'word:abandon', at: now - 3000, value: { rating: 1, firstCorrect: true, hinted: false } }),
    event({ id: 'bbbbbbbb-bb22', kind: 'review', key: 'word:ability', at: now - 2000, value: { rating: 3, firstCorrect: false, hinted: false } }),
    event({ id: 'cccccccc-cc33', kind: 'review', key: 'word:abstract', at: now - 1000, value: { rating: 3, firstCorrect: true, hinted: true } })
  ];
  assert.deepEqual(recentWrongWordIds(events, new Set(['abandon', 'ability', 'abstract']), { now }), ['abstract', 'ability', 'abandon']);
});

test('old wrong attempts fall outside the lookback window', () => {
  const now = Date.now();
  const events = [
    event({ id: 'aaaaaaaa-old1', kind: 'typing', key: 'word:abandon', at: now - 15 * 86400000, value: { correct: false, session: 's' } })
  ];
  assert.deepEqual(recentWrongWordIds(events, new Set(['abandon']), { now, lookbackDays: 14 }), []);
});

test('undo removes the wrong attempt from derived state', () => {
  const now = Date.now();
  const wrong = event({ id: 'aaaaaaaa-wr11', kind: 'typing', key: 'word:abandon', at: now - 1000, value: { correct: false, session: 's' } });
  const undo = event({ id: 'bbbbbbbb-un22', kind: 'undo', key: 'word:abandon', at: now, value: { id: wrong.id } });
  assert.deepEqual(recentWrongWordIds([wrong, undo], new Set(['abandon']), { now }), []);
});
