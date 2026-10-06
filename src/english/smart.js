import { buildEnglishQueue } from './queue.js';
import { DEFAULT_ENGLISH_NEW_WORD_LIMIT, ENGLISH_MAX_SESSION_WORDS } from './config.js';

// Keep the existing session event contract (queue <= 50, value <= 8192).
// Reserve one retry per recall; a new word also needs an exposure step.
const STEP_BUDGET = 48;
const GAP = 3;
export const isSmartSession = session => session?.smart === 1;
export const stepKind = (session, index = session?.index) => isSmartSession(session) ? session.steps[index] : session?.mode === 'follow' ? 'e' : 'r';
export const stepMode = session => stepKind(session) === 'e' ? 'follow' : session?.mode || 'recall';

export function createSmartSession({ dueIds = [], wrongIds = [], newIds = [], newLimit = DEFAULT_ENGLISH_NEW_WORD_LIMIT, id, now = Date.now() } = {}) {
  const candidates = buildEnglishQueue({ dueIds, wrongIds, newIds, newLimit, maxTotal: ENGLISH_MAX_SESSION_WORDS });
  const known = new Set([...dueIds, ...wrongIds]);
  const selected = [];
  let cost = 0;
  for (const word of candidates) {
    const price = known.has(word) ? 2 : 3;
    if (cost + price > STEP_BUDGET) break;
    selected.push({ id: word, kind: known.has(word) ? 'r' : 'e' });
    cost += price;
  }
  // When only a few new words are left, introduce them before the last few
  // reviews so their later recall can still have intervening words.
  const exposures = selected.filter(step => step.kind === 'e');
  const recalls = selected.filter(step => step.kind === 'r');
  const base = exposures.length && exposures.length <= GAP && recalls.length >= GAP
    ? [...recalls.slice(0, -GAP), ...exposures, ...recalls.slice(-GAP)] : selected;
  const plan = base.map(step => ({ ...step }));
  for (let index = 0; index < plan.length; index++) {
    const step = plan[index];
    if (step.kind !== 'e') continue;
    let position = index + 1, intervening = 0;
    while (position < plan.length && intervening < GAP) {
      if (plan[position].id !== step.id) intervening++;
      position++;
    }
    plan.splice(position, 0, { id: step.id, kind: 'r' });
  }
  return { id, mode: 'recall', smart: 1, queue: plan.map(step => step.id), steps: plan.map(step => step.kind).join(''), index: 0, results: [], startedAt: now };
}

export function sessionProgress(session) {
  if (!session) return { completed: 0, total: 0 };
  if (!isSmartSession(session)) return { completed: session.index, total: session.queue.length };
  const total = new Set(session.queue).size;
  return { completed: total - new Set(session.queue.slice(session.index)).size, total };
}

export function englishStepEvent(session, rating) {
  const current = session.current || { firstCorrect: true, hinted: false };
  if (stepKind(session) === 'e') return { kind: 'typing', value: { correct: current.firstCorrect, session: session.id } };
  const failed = current.firstCorrect === false || current.hinted === true;
  return { kind: 'review', value: { rating: isSmartSession(session) && failed ? 1 : rating, firstCorrect: current.firstCorrect, hinted: Boolean(current.hinted) } };
}

export function completeEnglishStep(session, event) {
  const next = structuredClone(session), kind = stepKind(session), id = session.queue[session.index];
  const current = session.current || { firstCorrect: true, hinted: false };
  const result = { id, rating: event.kind === 'review' ? event.value.rating : null, firstCorrect: current.firstCorrect, hinted: Boolean(current.hinted), eventId: event.id };
  // One delayed retry only. Never place the same word immediately next; if
  // there is no intervening word left, it stays due/wrong for the next group.
  if (isSmartSession(session) && kind === 'r' && (result.rating === 1 || !result.firstCorrect || result.hinted)) {
    const alreadyQueued = next.queue.some((word, i) => word === id && next.steps[i] === 'x');
    let position = next.index + 1, gap = 0;
    while (position < next.queue.length && gap < GAP) {
      if (next.queue[position] !== id) gap++;
      position++;
    }
    if (!alreadyQueued && gap > 0 && next.queue.length < 50) {
      next.queue.splice(position, 0, id);
      next.steps = next.steps.slice(0, position) + 'x' + next.steps.slice(position);
      result.retryAt = position;
    }
  }
  next.results.push(result);
  next.index++;
  delete next.current;
  return next;
}

export function undoEnglishStep(session, eventId) {
  if (session?.results.at(-1)?.eventId !== eventId) return session;
  const next = structuredClone(session), result = next.results.pop();
  next.index--;
  if (Number.isInteger(result.retryAt)) {
    next.queue.splice(result.retryAt, 1);
    next.steps = next.steps.slice(0, result.retryAt) + next.steps.slice(result.retryAt + 1);
  }
  next.current = { firstCorrect: result.firstCorrect, hinted: Boolean(result.hinted) };
  return next;
}

export function englishSessionStats(session) {
  const results = session?.results || [], recalls = results.filter(result => result.rating != null);
  const newIds = isSmartSession(session) ? new Set(session.queue.filter((id, i) => session.steps[i] === 'e')) : new Set();
  const learned = new Set(recalls.filter(result => newIds.has(result.id)).map(result => result.id));
  const first = recalls.filter((result, i) => !recalls.slice(0, i).some(previous => previous.id === result.id));
  const last = new Map(recalls.map(result => [result.id, result]));
  return {
    newLearned: learned.size,
    recalled: recalls.length,
    firstCorrectRate: first.length ? Math.round(100 * first.filter(result => result.firstCorrect && !result.hinted && result.rating !== 1).length / first.length) : null,
    corrections: new Set(results.filter(result => result.firstCorrect === false).map(result => result.id)).size,
    needsThought: [...last.values()].filter(result => result.rating === 1 || !result.firstCorrect || result.hinted).length
  };
}
