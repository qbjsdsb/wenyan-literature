import { DAY } from '../core.js';
import { ENGLISH_WRONG_LOOKBACK_DAYS, RATING_AGAIN } from './config.js';
import { isWordKey } from './keys.js';

export function isEnglishAttemptEvent(event) {
  return Boolean(event && isWordKey(event.key) && ['review', 'typing'].includes(event.kind));
}

export function isWrongEnglishAttempt(event) {
  if (!isEnglishAttemptEvent(event)) return false;
  if (event.kind === 'typing') return event.value?.correct === false;
  return event.value?.rating === RATING_AGAIN || event.value?.firstCorrect === false || event.value?.hinted === true;
}

export function isRecentWrongEnglishAttempt(
  event,
  { now = Date.now(), lookbackDays = ENGLISH_WRONG_LOOKBACK_DAYS } = {}
) {
  return Boolean(
    isWrongEnglishAttempt(event) &&
    Number.isFinite(event.at) &&
    event.at >= now - lookbackDays * DAY
  );
}
