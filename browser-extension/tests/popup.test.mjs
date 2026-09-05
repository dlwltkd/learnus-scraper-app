import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/popup.js', import.meta.url), 'utf8');

function loadPopup(sendMessage) {
  const elements = Object.fromEntries(['open-login', 'connect-browser', 'status'].map((id) => [id, {
    disabled: false,
    textContent: '',
    attributes: {},
    listeners: {},
    classes: new Set(),
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, listener) { this.listeners[name] = listener; },
  }]));
  for (const element of Object.values(elements)) {
    element.classList = { toggle: (name, enabled) => {
      if (enabled) element.classes.add(name);
      else element.classes.delete(name);
    } };
  }
  vm.runInNewContext(source, {
    document: { querySelector: (selector) => elements[selector.slice(1)] },
    chrome: { runtime: { sendMessage } },
  });
  return elements;
}

test('opening the popup does not transfer a session until the user clicks', async () => {
  const actions = [];
  const popup = loadPopup(async ({ type }) => { actions.push(type); return { ok: true }; });
  assert.deepEqual(actions, []);
  await popup['open-login'].listeners.click();
  assert.deepEqual(actions, ['OPEN_LOGIN']);
  assert.match(popup.status.textContent, /로그인한 뒤/);
  assert.equal(popup['open-login'].disabled, false);
});

test('connection reports progress and permits retry after an error', async () => {
  let respond;
  const popup = loadPopup(() => new Promise((resolve) => { respond = resolve; }));
  const request = popup['connect-browser'].listeners.click();
  assert.equal(popup['connect-browser'].disabled, true);
  assert.equal(popup['open-login'].disabled, true);
  assert.equal(popup['connect-browser'].attributes['aria-busy'], 'true');
  assert.match(popup.status.textContent, /확인하고 있어요/);
  respond({ ok: false, code: 'NO_SESSION' });
  await request;
  assert.equal(popup['connect-browser'].disabled, false);
  assert.equal(popup['connect-browser'].attributes['aria-busy'], 'false');
  assert.match(popup.status.textContent, /같은 브라우저/);
  assert.equal(popup.status.classes.has('error'), true);

  const retry = popup['connect-browser'].listeners.click();
  assert.equal(popup.status.classes.has('error'), false);
  respond({ ok: true });
  await retry;
  assert.match(popup.status.textContent, /새로 열린 LearnUs Connect 탭/);
  assert.equal(popup.status.classes.has('error'), false);
});

test('all public errors have Korean recovery guidance without echoing server content', async () => {
  for (const code of [
    'NO_SESSION', 'SESSION_REJECTED', 'RATE_LIMITED', 'NETWORK', 'TIMEOUT', 'SERVER',
    'BAD_RESPONSE', 'COOKIE_UNAVAILABLE', 'INTERNAL', 'INVALID_ACTION', 'INVALID_SENDER', 'unknown-secret',
  ]) {
    const popup = loadPopup(async () => ({ ok: false, code, message: 'sensitive server details' }));
    await popup['connect-browser'].listeners.click();
    assert.match(popup.status.textContent, /[가-힣]/);
    assert.doesNotMatch(popup.status.textContent, /secret|sensitive/);
    assert.equal(popup.status.classes.has('error'), true);
    assert.equal(popup['connect-browser'].disabled, false);
  }
});

test('a disconnected service worker shows a recoverable Korean error', async () => {
  const popup = loadPopup(async () => { throw new Error('private runtime details'); });
  await popup['connect-browser'].listeners.click();
  assert.match(popup.status.textContent, /다시 열어/);
  assert.doesNotMatch(popup.status.textContent, /private/);
  assert.equal(popup['connect-browser'].disabled, false);
});
