import { activeEvents } from '../core.js';

function localDayStart(timestamp) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function englishDailyStats(events, now = Date.now()) {
  const active = activeEvents(events);
  const start = localDayStart(now);
  const today = active.filter(event => event.at >= start && event.at <= now && event.key?.startsWith('word:'));
  const todayReviews = today.filter(event => event.kind === 'review');
  const todayTyping = today.filter(event => event.kind === 'typing');

  const firstReviewByWord = new Map();
  for (const event of active) {
    if (event.kind !== 'review' || !event.key?.startsWith('word:')) continue;
    const id = event.key.slice(5);
    const previous = firstReviewByWord.get(id);
    if (!previous || event.at < previous.at) firstReviewByWord.set(id, event);
  }

  const newLearned = [...firstReviewByWord.values()].filter(event => event.at >= start && event.at <= now).length;
  const reviewed = todayReviews.length;
  const recallSuccess = todayReviews.filter(event =>
    event.value?.rating > 1 && event.value?.firstCorrect !== false && event.value?.hinted !== true
  ).length;
  const firstCorrectRate = reviewed ? Math.round((recallSuccess / reviewed) * 100) : null;
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
