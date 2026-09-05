import { buildCookieHeader, hasUsableMoodleSession } from './cookieHeader.js';
import { BridgeError } from './errors.js';
import { exchangeCookieHeader } from './exchange.js';

export async function openLearnUsLogin({ config, openTab }) {
  await openTab(config.learnUsLoginUrl);
}

let pendingConnection = null;

export function connectBrowser(options) {
  // Reopening the popup while LearnUs is responding must not start another exchange.
  if (!pendingConnection) {
    pendingConnection = performConnection(options).finally(() => { pendingConnection = null; });
  }
  return pendingConnection;
}

async function performConnection({ config, getCookies, setCookie, openTab, fetchImpl = fetch }) {
  let cookies = await getCookies(config.learnUsCookieUrl);
  let cookieHeader = '';

  try {
    if (!hasUsableMoodleSession(cookies)) {
      throw new BridgeError('NO_SESSION');
    }

    cookieHeader = buildCookieHeader(cookies);
    const { completionUrl, ticket, expiresIn } = await exchangeCookieHeader(cookieHeader, config, fetchImpl);
    const secure = new URL(config.completionOrigin).protocol === 'https:';
    let binding;
    try {
      binding = await setCookie({
        url: `${new URL(config.exchangeUrl).origin}/`,
        name: config.loginCookieName,
        value: ticket,
        path: '/',
        secure,
        httpOnly: true,
        sameSite: 'strict',
        expirationDate: Math.floor(Date.now() / 1_000) + expiresIn,
      });
    } catch {
      throw new BridgeError('COOKIE_UNAVAILABLE');
    }
    if (
      !binding || binding.value !== ticket || binding.name !== config.loginCookieName
      || !binding.hostOnly || !binding.httpOnly || binding.secure !== secure
      || binding.path !== '/' || binding.sameSite !== 'strict'
    ) {
      throw new BridgeError('COOKIE_UNAVAILABLE');
    }
    await openTab(completionUrl);
  } finally {
    cookieHeader = '';
    cookies = [];
  }
}
