import { ENGLISH_MAX_SESSION_WORDS } from './config.js';

export function validSmartPlan(session) {
  if (session.smart == null) return true;
  if (session.smart !== 1 || session.mode !== 'recall' || typeof session.steps !== 'string' || session.steps.length !== session.queue.length || /[^erx]/.test(session.steps)) return false;
  const counts = new Map();
  for (let i = 0; i < session.queue.length; i++) {
    const id = session.queue[i], kind = session.steps[i], seen = counts.get(id) || '';
    if (seen.includes(kind) || (kind === 'x' && !seen.includes('r')) || (kind === 'e' && seen.length)) return false;
    counts.set(id, seen + kind);
  }
  return counts.size <= ENGLISH_MAX_SESSION_WORDS && [...counts.values()].every(seen => seen.includes('r'));
}

export function hasUnfinishedEnglishSession(session) {
  return Boolean(
    session &&
    Array.isArray(session.queue) &&
    Number.isSafeInteger(session.index) &&
    session.index >= 0 &&
    session.index < session.queue.length
  );
}

export function pendingEnglishWordIds(session) {
  if (!hasUnfinishedEnglishSession(session)) return [];
  return session.queue.slice(session.index).filter(id => typeof id === 'string' && id);
}

export function markEnglishSessionHinted(session) {
  if (!hasUnfinishedEnglishSession(session)) return session;
  return {
    ...session,
    current: {
      ...(session.current || {}),
      hinted: true
    }
  };
}

export function recordEnglishFirstAttempt(session, correct, hinted = false) {
  if (!hasUnfinishedEnglishSession(session)) return session;
  if (typeof session.current?.firstCorrect === 'boolean') return session;
  return {
    ...session,
    current: {
      ...(session.current || {}),
      firstCorrect: Boolean(correct),
      hinted: Boolean(session.current?.hinted || hinted)
    }
  };
}

