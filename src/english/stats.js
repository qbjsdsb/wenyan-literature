import { activeEvents } from '../core.js';
import { isWordKey, wordIdFromKey } from './keys.js';

function localDayStart(timestamp) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function englishDailyStats(events, now = Date.now()) {
  const active = activeEvents(events);
  const start = localDayStart(now);
  const today = active.filter(event => event.at >= start && event.at <= now && isWordKey(event.key));
  const todayReviews = today.filter(event => event.kind === 'review');
  const todayTyping = today.filter(event => event.kind === 'typing');

  const firstReviewByWord = new Map();
  for (const event of active) {
    if (event.kind !== 'review' || !isWordKey(event.key)) continue;
    const id = wordIdFromKey(event.key);
    const previous = firstReviewByWord.get(id);
    if (!previous || event.at < previous.at) firstReviewByWord.set(id, event);
  }

  const newLearned = [...firstReviewByWord.values()].filter(event => event.at >= start && event.at <= now).length;
  const reviewed = todayReviews.length;

  // Older events may predate firstCorrect/hinted. Exclude unknown legacy rows from
  // the accuracy denominator instead of silently counting them as successful recall.
  const evaluableReviews = todayReviews.filter(event => typeof event.value?.firstCorrect === 'boolean');
  const recallSuccess = evaluableReviews.filter(event =>
    event.value.rating > 1 && event.value.firstCorrect === true && event.value.hinted !== true
  ).length;
  const firstCorrectRate = evaluableReviews.length
    ? Math.round((recallSuccess / evaluableReviews.length) * 100)
    : null;

  const spellingErrors =
    todayTyping.filter(event => event.value?.correct === false).length +
    todayReviews.filter(event => event.value?.firstCorrect === false).length;

  return {
    newLearned,
    reviewed,
    firstCorrectRate,
    spellingErrors
  };
}
