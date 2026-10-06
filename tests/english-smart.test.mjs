import test from 'node:test';
import assert from 'node:assert/strict';
import { createSmartSession, completeEnglishStep, englishStepEvent, stepKind, stepMode, sessionProgress, undoEnglishStep, englishSessionStats } from '../src/english/smart.js';
import { markEnglishSessionHinted, recordEnglishFirstAttempt, hasUnfinishedEnglishSession } from '../src/english/session.js';
import { reviewCard, mergeEvents, latest, validEvent, activeEvents } from '../src/core.js';
import { importEvents, exportState } from '../src/backup.js';
import { readFileSync } from 'node:fs';

const session = options => createSmartSession({ id: 'smart-session-123', ...options });
let seq = 0;
function event(kind, key, value) { return { id: `smart-event-${String(++seq).padStart(8, '0')}`, kind, key, value, device: 'smart-qa', at: Date.now() + seq }; }
function finish(s, { correct = true, hint = false, rating = 3 } = {}) {
  if (hint) s = markEnglishSessionHinted(s);
  s = recordEnglishFirstAttempt(s, correct, hint);
  const descriptor = englishStepEvent(s, rating), e = event(descriptor.kind, 'word:' + s.queue[s.index], descriptor.value);
  return { session: completeEnglishStep(s, e), event: e };
}

test('due and wrong words start with recall, produce review, never typing-only completion', () => {
  const s = session({ dueIds: ['due'], wrongIds: ['wrong'], newIds: ['fresh'] });
  assert.equal(stepMode(s), 'recall');
  const completed = finish(s);
  assert.equal(completed.event.kind, 'review');
  assert.equal(reviewCard([completed.event], 'word:due').reps, 1);
  assert.equal(stepMode(completed.session), 'recall');
});

test('exposure writes typing only; delayed active recall starts FSRS and true new-learned stats', () => {
  let s = session({ newIds: ['a', 'b', 'c', 'd', 'e', 'f'] }), events = [];
  assert.equal(stepKind(s), 'e');
  let result = finish(s); s = result.session; events.push(result.event);
  assert.equal(reviewCard(events, 'word:a').reps, 0);
  assert.equal(englishSessionStats(s).newLearned, 0);
  assert.ok(s.queue.indexOf('a', 1) >= 4);
  while (s.queue[s.index] !== 'a') { result = finish(s); s = result.session; events.push(result.event); }
  assert.equal(stepMode(s), 'recall');
  result = finish(s); events.push(result.event);
  assert.equal(result.event.kind, 'review');
  assert.equal(reviewCard(events, 'word:a').reps, 1);
  assert.equal(englishSessionStats(result.session).newLearned, 1);
});

test('few new words use intervening existing recalls when available', () => {
  const s = session({ dueIds: ['a', 'b', 'c', 'd', 'e'], newIds: ['fresh'] });
  const exposure = s.steps.indexOf('e'), recall = s.queue.lastIndexOf('fresh');
  assert.ok(recall - exposure >= 4);
});

test('spelling correction preserves first miss, forces Again and inserts one delayed retry', () => {
  let s = session({ wrongIds: ['a', 'b', 'c', 'd', 'e'] });
  s = recordEnglishFirstAttempt(s, false);
  s = recordEnglishFirstAttempt(s, true);
  assert.equal(s.current.firstCorrect, false);
  const first = finish(s); s = first.session;
  assert.equal(first.event.value.rating, 1);
  assert.ok(s.queue.lastIndexOf('a') >= 4);
  while (s.queue[s.index] !== 'a') s = finish(s).session;
  s = finish(s, { correct: false }).session;
  assert.equal(s.queue.filter(id => id === 'a').length, 2);
  let safety = 0;
  while (hasUnfinishedEnglishSession(s) && safety++ < 50) s = finish(s).session;
  assert.ok(safety < 50);
});

test('last isolated error stays wrong for next group rather than an immediate repeat', () => {
  let s = session({ dueIds: ['only'] });
  s = finish(s, { correct: false }).session;
  assert.equal(s.queue.length, 1);
  assert.equal(englishSessionStats(s).needsThought, 1);
});

test('hint and firstCorrect survive serializing current step, with no false successful review', () => {
  let s = session({ dueIds: ['a', 'b', 'c', 'd'] });
  s = markEnglishSessionHinted(s);
  s = JSON.parse(JSON.stringify(s));
  assert.equal(s.current.hinted, true);
  const result = finish(s);
  assert.equal(result.event.value.rating, 1);
  assert.equal(result.event.value.firstCorrect, true);
  assert.equal(result.event.value.hinted, true);
});

test('undo restores original step, removes inserted retry and restores FSRS history', () => {
  const original = session({ dueIds: ['a', 'b', 'c', 'd'] });
  const result = finish(original, { correct: false });
  const undone = undoEnglishStep(result.session, result.event.id);
  assert.deepEqual(undone.queue, original.queue);
  assert.equal(undone.steps, original.steps);
  assert.equal(undone.index, 0);
  assert.equal(undone.current.firstCorrect, false);
  const undo = event('undo', result.event.key, { id: result.event.id });
  assert.equal(reviewCard([result.event, undo], result.event.key).reps, 0);
  assert.equal(activeEvents([result.event, undo]).length, 0);
});

test('legacy sessions have no smart steps, preserve their mode and can still complete', () => {
  const old = { id: 'old-session', mode: 'follow', queue: ['a', 'b'], index: 1, results: [{ id: 'a', rating: null }], current: { hinted: false } };
  assert.equal(stepMode(old), 'follow');
  const finished = finish(JSON.parse(JSON.stringify(old)));
  assert.equal(finished.event.kind, 'typing');
  assert.equal(finished.session.index, 2);
});

test('Smart backup round-trip retains plan, pending step, review, flags and undo compatibility', () => {
  let s = session({ newIds: ['a', 'b', 'c', 'd'] });
  const result = finish(s); s = markEnglishSessionHinted(result.session);
  const events = mergeEvents([result.event, event('favorite', 'word:a', { on: true }), event('mastered', 'word:d', { on: true }), event('session', 'english', s)]);
  const restored = importEvents(JSON.parse(JSON.stringify(exportState(events))), []);
  assert.equal(restored.length, 4);
  const resumed = latest(restored, 'session', 'english');
  assert.deepEqual(resumed, s);
  assert.equal(resumed.current.hinted, true);
  assert.equal(finish(resumed).session.index, 2);
  assert.deepEqual(importEvents(exportState(events), restored), restored);
});

test('bounded planning and retries remain valid under existing 50 steps / 8192 bytes event contract', () => {
  const catalog = JSON.parse(readFileSync(new URL('../public/data/english/netem-v1.json', import.meta.url))).catalog;
  const longest = catalog.map(word => word.id).sort((a, b) => b.length - a.length).slice(0, 24);
  for (const options of [{ dueIds: longest }, { newIds: longest, newLimit: 24 }, { dueIds: longest.slice(0, 12), newIds: longest.slice(12), newLimit: 12 }]) {
    let s = session(options), safety = 0;
    while (hasUnfinishedEnglishSession(s) && safety++ < 50) {
      s = finish(s, { correct: false, hint: true }).session;
      assert.equal(validEvent(event('session', 'english', s)), true, 'persistable at every step');
    }
    assert.ok(safety < 50);
    assert.ok(s.queue.length <= 50);
    assert.equal(sessionProgress(s).completed, sessionProgress(s).total);
  }
});

test('malformed optional Smart plans are rejected without rejecting legacy session events', () => {
  const s = session({ newIds: ['a', 'b'] });
  assert.equal(validEvent(event('session', 'english', s)), true);
  for (const steps of ['eee', 'zzzz', 'xxxx']) assert.equal(validEvent(event('session', 'english', { ...s, steps })), false);
  assert.equal(validEvent(event('session', 'english', { mode: 'recall', queue: ['a'], index: 0, results: [] })), true);
});
