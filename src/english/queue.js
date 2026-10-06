import { activeEvents, DAY } from '../core.js';
import {
  DEFAULT_ENGLISH_NEW_WORD_LIMIT,
  ENGLISH_MAX_SESSION_WORDS,
  ENGLISH_WRONG_LOOKBACK_DAYS
} from './config.js';
import { isEnglishAttemptEvent, isWrongEnglishAttempt } from './events.js';
import { wordIdFromKey } from './keys.js';

export function recentWrongWordIds(
  events,
  eligibleIds,
  { now = Date.now(), lookbackDays = ENGLISH_WRONG_LOOKBACK_DAYS } = {}
) {
  const eligible = eligibleIds instanceof Set ? eligibleIds : new Set(eligibleIds ?? []);
  const latestAttempt = new Map();

  for (const event of activeEvents(events)) {
    if (!isEnglishAttemptEvent(event)) continue;
    const id = wordIdFromKey(event.key);
    if (!eligible.has(id)) continue;
    latestAttempt.set(id, { event, wrong: isWrongEnglishAttempt(event) });
  }

  const cutoff = now - lookbackDays * DAY;
  return [...latestAttempt.entries()]
    .filter(([, value]) => value.wrong && value.event.at >= cutoff)
    .sort((a, b) => b[1].event.at - a[1].event.at || a[0].localeCompare(b[0]))
    .map(([id]) => id);
}

export function buildEnglishQueue({
  dueIds = [],
  wrongIds = [],
  newIds = [],
  newLimit = DEFAULT_ENGLISH_NEW_WORD_LIMIT,
  maxTotal = ENGLISH_MAX_SESSION_WORDS
} = {}) {
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
