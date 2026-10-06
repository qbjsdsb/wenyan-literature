import { activeEvents, latest, reviewCard } from '../core.js';

const DAY = 86400000;

export function wordLearningState(events, id, now = Date.now()) {
  const key = `word:${id}`;
  const active = activeEvents(events);
  const mastered = Boolean(latest(events, 'mastered', key)?.on);
  const favorite = Boolean(latest(events, 'favorite', key)?.on);
  const reviews = active.filter(event => event.kind === 'review' && event.key === key);
  const attempts = active.filter(event => ['review', 'typing'].includes(event.kind) && event.key === key);
  const lastAttempt = attempts.at(-1) ?? null;

  let recentWrong = false;
  if (lastAttempt && lastAttempt.at >= now - 14 * DAY) {
    if (lastAttempt.kind === 'typing') recentWrong = lastAttempt.value.correct === false;
    if (lastAttempt.kind === 'review') {
      recentWrong = lastAttempt.value.rating === 1 || lastAttempt.value.firstCorrect === false || lastAttempt.value.hinted === true;
    }
  }

  if (mastered) {
    return { state: 'mastered', label: '已掌握', favorite, mastered, recentWrong, reviewCount: reviews.length, due: null };
  }

  if (!reviews.length) {
    return { state: 'new', label: '新词', favorite, mastered, recentWrong, reviewCount: 0, due: null };
  }

  const card = reviewCard(events, key);
  const due = card.due;
  const isDue = due.getTime() <= now;
  return {
    state: isDue ? 'due' : 'learning',
    label: isDue ? '已到期' : '复习中',
    favorite,
    mastered,
    recentWrong,
    reviewCount: reviews.length,
    due
  };
}

export function displayVariants(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' · ');
  if (value == null) return '';
  if (typeof value === 'object') return Object.values(value).filter(Boolean).join(' · ');
  return String(value).trim();
}
