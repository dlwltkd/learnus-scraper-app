import { BridgeError } from './errors.js';

const MAX_RESPONSE_CHARS = 4_096;
const TICKET_PATTERN = /^[A-Za-z0-9_-]{32,512}$/;
const MIN_TICKET_TTL_SECONDS = 30;
const MAX_TICKET_TTL_SECONDS = 300;

function errorForStatus(status) {
  if (status === 401 || status === 403) return new BridgeError('SESSION_REJECTED');
  if (status === 429) return new BridgeError('RATE_LIMITED');
  if (status >= 500) return new BridgeError('SERVER');
  return new BridgeError('BAD_RESPONSE');
}

export function validateCompletionUrl(rawUrl, config) {
  if (typeof rawUrl !== 'string' || rawUrl.length > 2_048) {
    throw new BridgeError('BAD_RESPONSE');
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BridgeError('BAD_RESPONSE');
  }

  if (
    url.origin !== config.completionOrigin
    || url.pathname !== config.completionPath
    || url.search !== ''
    || url.username !== ''
    || url.password !== ''
  ) {
    throw new BridgeError('BAD_RESPONSE');
  }

  const fragment = new URLSearchParams(url.hash.slice(1));
  const entries = [...fragment.entries()];
  if (
    entries.length !== 1
    || entries[0][0] !== 'ticket'
    || !TICKET_PATTERN.test(entries[0][1])
  ) {
    throw new BridgeError('BAD_RESPONSE');
  }

  return url.toString();
}

export function completionUrlFromExchange(payload, config) {
  if (
    payload === null
    || typeof payload !== 'object'
    || payload.status !== 'success'
    || typeof payload.ticket !== 'string'
    || !TICKET_PATTERN.test(payload.ticket)
    || !Number.isInteger(payload.expires_in)
    || payload.expires_in < MIN_TICKET_TTL_SECONDS
    || payload.expires_in > MAX_TICKET_TTL_SECONDS
  ) {
    throw new BridgeError('BAD_RESPONSE');
  }

  const completionUrl = `${config.completionOrigin}${config.completionPath}`
    + `#ticket=${encodeURIComponent(payload.ticket)}`;
  return validateCompletionUrl(completionUrl, config);
}

export async function exchangeCookieHeader(cookieHeader, config, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    let response;
    try {
      response = await fetchImpl(config.exchangeUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cookies: cookieHeader }),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw new BridgeError('TIMEOUT');
      throw new BridgeError('NETWORK');
    }

    if (!response.ok) throw errorForStatus(response.status);

    const responseText = await response.text();
    if (responseText.length > MAX_RESPONSE_CHARS) {
      throw new BridgeError('BAD_RESPONSE');
    }

    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new BridgeError('BAD_RESPONSE');
    }

    return completionUrlFromExchange(payload, config);
  } finally {
    clearTimeout(timeout);
  }
}
