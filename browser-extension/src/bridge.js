import { buildCookieHeader, hasUsableMoodleSession } from './cookieHeader.js';
import { BridgeError } from './errors.js';
import { exchangeCookieHeader } from './exchange.js';

export async function openLearnUsLogin({ config, openTab }) {
  await openTab(config.learnUsLoginUrl);
}

export async function connectBrowser({ config, getCookies, openTab, fetchImpl = fetch }) {
  let cookies = await getCookies(config.learnUsCookieUrl);
  let cookieHeader = '';

  try {
    if (!hasUsableMoodleSession(cookies)) {
      throw new BridgeError('NO_SESSION');
    }

    cookieHeader = buildCookieHeader(cookies);
    const completionUrl = await exchangeCookieHeader(cookieHeader, config, fetchImpl);
    await openTab(completionUrl);
  } finally {
    cookieHeader = '';
    cookies = [];
  }
}
