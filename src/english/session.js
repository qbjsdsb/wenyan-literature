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
