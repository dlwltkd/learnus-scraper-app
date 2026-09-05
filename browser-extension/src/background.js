import { connectBrowser, openLearnUsLogin } from './bridge.js';
import { CONFIG } from './config.js';
import { publicErrorCode } from './errors.js';

const OPEN_LOGIN = 'OPEN_LOGIN';
const CONNECT_BROWSER = 'CONNECT_BROWSER';

const openTab = async (url) => {
  await chrome.tabs.create({ url });
};

async function handleMessage(message) {
  if (message?.type === OPEN_LOGIN) {
    await openLearnUsLogin({ config: CONFIG, openTab });
    return { ok: true };
  }

  if (message?.type === CONNECT_BROWSER) {
    await connectBrowser({
      config: CONFIG,
      getCookies: (url) => chrome.cookies.getAll({ url }),
      setCookie: (details) => chrome.cookies.set(details),
      openTab,
      fetchImpl: fetch,
    });
    return { ok: true };
  }

  return { ok: false, code: 'INVALID_ACTION' };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, code: 'INVALID_SENDER' });
    return false;
  }

  handleMessage(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, code: publicErrorCode(error) }));
  return true;
});
