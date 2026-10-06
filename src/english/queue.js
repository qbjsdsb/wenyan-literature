import { activeEvents } from '../core.js';

const DEFAULT_WRONG_LOOKBACK_DAYS = 14;

export function recentWrongWordIds(events, eligibleIds, { now = Date.now(), lookbackDays = DEFAULT_WRONG_LOOKBACK_DAYS } = {}) {
  const eligible = eligibleIds instanceof Set ? eligibleIds : new Set(eligibleIds ?? []);
  const cutoff = now - lookbackDays * 86400000;
  const latestAttempt = new Map();

  for (const event of activeEvents(events)) {
    if (!event.key?.startsWith('word:')) continue;
    const id = event.key.slice(5);
    if (!eligible.has(id) || !['review', 'typing'].includes(event.kind)) continue;
    let wrong = false;
    if (event.kind === 'typing') wrong = event.value.correct === false;
    if (event.kind === 'review') wrong = event.value.rating === 1 || event.value.firstCorrect === false || event.value.hinted === true;
    latestAttempt.set(id, { at: event.at, wrong });
  }

  return [...latestAttempt.entries()]
    .filter(([, value]) => value.wrong && value.at >= cutoff)
    .sort((a, b) => b[1].at - a[1].at || a[0].localeCompare(b[0]))
    .map(([id]) => id);
}

export function buildEnglishQueue({ dueIds = [], wrongIds = [], newIds = [], newLimit = 12, maxTotal = 24 } = {}) {
  const queue = [];
  const seen = new Set();
  const add = id => {
    if (!id || seen.has(id) || queue.length >= maxTotal) return;
    seen.add(id);
    queue.push(id);
  };

  for (const id of dueIds) add(id);
  for (const id of wrongIds) add(id);
  for (const id of newIds.slice(0, Math.max(0, newLimit))) add(id);
  return queue;
}
