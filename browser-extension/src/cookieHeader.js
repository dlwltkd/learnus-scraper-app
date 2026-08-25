function isCookieRecord(cookie) {
  return cookie !== null
    && typeof cookie === 'object'
    && typeof cookie.name === 'string'
    && typeof cookie.value === 'string';
}

export function hasUsableMoodleSession(cookies) {
  if (!Array.isArray(cookies)) return false;

  return cookies.some((cookie) => (
    isCookieRecord(cookie)
    && cookie.name === 'MoodleSession'
    && cookie.value.length > 0
    && cookie.value.toLowerCase() !== 'deleted'
  ));
}

export function buildCookieHeader(cookies) {
  if (!Array.isArray(cookies)) return '';

  const seenNames = new Set();
  const parts = [];

  // chrome.cookies.getAll() returns longest-path cookies first. Keep the first
  // value when duplicate names exist so the result matches browser precedence.
  for (const cookie of cookies) {
    if (!isCookieRecord(cookie)) continue;

    if (cookie.name === '') {
      if (cookie.value !== '') parts.push(cookie.value);
      continue;
    }

    if (seenNames.has(cookie.name)) continue;
    seenNames.add(cookie.name);
    parts.push(`${cookie.name}=${cookie.value}`);
  }

  return parts.join('; ');
}
