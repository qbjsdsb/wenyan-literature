import test from 'node:test';
import assert from 'node:assert/strict';
import { englishDailyStats } from '../src/english/stats.js';

const now = new Date(2026, 9, 6, 17, 30, 0).getTime();
const morning = new Date(2026, 9, 6, 9, 0, 0).getTime();
const yesterday = new Date(2026, 9, 5, 23, 0, 0).getTime();
const device = 'test-device';
const evt = (id, kind, key, at, value) => ({ id, device, kind, key, at, value });

test('counts a word as newly learned only when its first active review is today', () => {
  const events = [
    evt('aaaaaaaa-aa11', 'typing', 'word:abandon', morning - 1000, { correct: true, session: 's' }),
    evt('bbbbbbbb-bb22', 'review', 'word:abandon', morning, { rating: 3, firstCorrect: true, hinted: false }),
    evt('cccccccc-cc33', 'review', 'word:ability', yesterday, { rating: 3, firstCorrect: true, hinted: false }),
    evt('dddddddd-dd44', 'review', 'word:ability', morning + 1000, { rating: 3, firstCorrect: true, hinted: false })
  ];
  const stats = englishDailyStats(events, now);
  assert.equal(stats.newLearned, 1);
  assert.equal(stats.reviewed, 2);
});

test('first correct rate only treats successful unaided active recall as correct', () => {
  const events = [
    evt('aaaaaaaa-a111', 'review', 'word:a', morning, { rating: 3, firstCorrect: true, hinted: false }),
    evt('bbbbbbbb-b222', 'review', 'word:b', morning + 1, { rating: 1, firstCorrect: true, hinted: false }),
    evt('cccccccc-c333', 'review', 'word:c', morning + 2, { rating: 3, firstCorrect: false, hinted: false }),
    evt('dddddddd-d444', 'review', 'word:d', morning + 3, { rating: 3, firstCorrect: true, hinted: true })
  ];
  assert.equal(englishDailyStats(events, now).firstCorrectRate, 25);
});

test('legacy reviews without firstCorrect remain counted as reviews but not as accuracy evidence', () => {
  const events = [
    evt('aaaaaaaa-a101', 'review', 'word:legacy', morning, { rating: 3 }),
    evt('bbbbbbbb-b202', 'review', 'word:new', morning + 1, { rating: 3, firstCorrect: true, hinted: false })
  ];
  const stats = englishDailyStats(events, now);
  assert.equal(stats.reviewed, 2);
  assert.equal(stats.firstCorrectRate, 100);
});

test('typing-only follow practice does not affect active recall rate', () => {
  const events = [
    evt('aaaaaaaa-a555', 'typing', 'word:a', morning, { correct: true, session: 's' }),
    evt('bbbbbbbb-b666', 'typing', 'word:b', morning + 1, { correct: false, session: 's' })
  ];
  const stats = englishDailyStats(events, now);
  assert.equal(stats.reviewed, 0);
  assert.equal(stats.firstCorrectRate, null);
  assert.equal(stats.newLearned, 0);
});

test('spelling errors count one first miss per recorded training result', () => {
  const events = [
    evt('aaaaaaaa-a777', 'typing', 'word:a', morning, { correct: false, session: 's' }),
    evt('bbbbbbbb-b888', 'review', 'word:b', morning + 1, { rating: 3, firstCorrect: false, hinted: false }),
    evt('cccccccc-c999', 'review', 'word:c', morning + 2, { rating: 1, firstCorrect: true, hinted: false })
  ];
  assert.equal(englishDailyStats(events, now).spellingErrors, 2);
});

test('undo removes an event from daily stats', () => {
  const review = evt('aaaaaaaa-r111', 'review', 'word:a', morning, { rating: 3, firstCorrect: true, hinted: false });
  const undo = evt('bbbbbbbb-u222', 'undo', 'word:a', morning + 1, { id: review.id });
  const stats = englishDailyStats([review, undo], now);
  assert.deepEqual(stats, { newLearned: 0, reviewed: 0, firstCorrectRate: null, spellingErrors: 0 });
});
