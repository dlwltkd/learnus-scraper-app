import assert from 'node:assert/strict';
import test from 'node:test';

import { connectBrowser, openLearnUsLogin } from '../src/bridge.js';
import { CONFIG } from '../src/config.production.js';
import { CONFIG as DEVELOPMENT_CONFIG } from '../src/config.development.js';
import { BridgeError } from '../src/errors.js';

const ticket = 'B'.repeat(43);
const completionUrl = `${CONFIG.completionOrigin}${CONFIG.completionPath}#ticket=${ticket}`;

test('openLearnUsLogin opens only the fixed LearnUs login URL', async () => {
  const opened = [];
  await openLearnUsLogin({ config: CONFIG, openTab: async (url) => opened.push(url) });
  assert.deepEqual(opened, [CONFIG.learnUsLoginUrl]);
});

test('connectBrowser reads exact-origin cookies, exchanges them, and opens completion', async () => {
  const cookieQueries = [];
  const opened = [];
  const bindings = [];
  let body;

  await connectBrowser({
    config: CONFIG,
    getCookies: async (url) => {
      cookieQueries.push(url);
      return [
        { name: 'MoodleSession', value: 'live-session' },
        { name: 'device', value: 'device-token' },
      ];
    },
    setCookie: async (details) => {
      bindings.push(details);
      return { ...details, hostOnly: true };
    },
    openTab: async (url) => {
      assert.equal(bindings.length, 1);
      opened.push(url);
    },
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response(JSON.stringify({ status: 'success', ticket, expires_in: 90 }));
    },
  });

  assert.deepEqual(cookieQueries, [CONFIG.learnUsCookieUrl]);
  assert.deepEqual(body, { cookies: 'MoodleSession=live-session; device=device-token' });
  assert.deepEqual(opened, [completionUrl]);
  assert.deepEqual({ ...bindings[0], expirationDate: undefined }, {
    url: `${CONFIG.completionOrigin}/`,
    name: '__Host-luconnect_login',
    value: ticket,
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    expirationDate: undefined,
  });
  assert.ok(bindings[0].expirationDate > Date.now() / 1_000);
  assert.ok(bindings[0].expirationDate <= Date.now() / 1_000 + 90);
});

test('connectBrowser fails closed before network access when no session exists', async () => {
  let fetched = false;
  let opened = false;

  await assert.rejects(
    connectBrowser({
      config: CONFIG,
      getCookies: async () => [{ name: 'preference', value: 'value' }],
      openTab: async () => { opened = true; },
      fetchImpl: async () => {
        fetched = true;
        return new Response();
      },
    }),
    (error) => error instanceof BridgeError && error.code === 'NO_SESSION',
  );

  assert.equal(fetched, false);
  assert.equal(opened, false);
});

test('connectBrowser rejects an invalid ticket without opening a completion tab', async () => {
  let opened = false;

  await assert.rejects(
    connectBrowser({
      config: CONFIG,
      getCookies: async () => [{ name: 'MoodleSession', value: 'live-session' }],
      openTab: async () => { opened = true; },
      fetchImpl: async () => new Response(JSON.stringify({
        status: 'success',
        ticket: 'invalid!',
        expires_in: 90,
      })),
    }),
    (error) => error instanceof BridgeError && error.code === 'BAD_RESPONSE',
  );

  assert.equal(opened, false);
});

test('connection fails closed when the browser cannot set a secure binding cookie', async () => {
  for (const setCookie of [
    async () => undefined,
    async () => { throw new Error('cookie secret must not escape'); },
    async (details) => ({ ...details, hostOnly: false }),
    async (details) => ({ ...details, hostOnly: true, httpOnly: false }),
    async (details) => ({ ...details, hostOnly: true, secure: false }),
  ]) {
    let opened = false;
    await assert.rejects(connectBrowser({
      config: CONFIG,
      getCookies: async () => [{ name: 'MoodleSession', value: 'live-session' }],
      setCookie,
      openTab: async () => { opened = true; },
      fetchImpl: async () => new Response(JSON.stringify({ status: 'success', ticket, expires_in: 90 })),
    }), (error) => error instanceof BridgeError && error.code === 'COOKIE_UNAVAILABLE');
    assert.equal(opened, false);
  }
});

test('reopening the popup joins one pending exchange and permits a later retry', async () => {
  let finishRequest;
  let exchanges = 0;
  const opened = [];
  const options = {
    config: CONFIG,
    getCookies: async () => [{ name: 'MoodleSession', value: 'live-session' }],
    setCookie: async (details) => ({ ...details, hostOnly: true }),
    openTab: async (url) => opened.push(url),
    fetchImpl: async () => {
      exchanges++;
      return new Promise((resolve) => { finishRequest = resolve; });
    },
  };
  const first = connectBrowser(options);
  const second = connectBrowser(options);
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(exchanges, 1);
  finishRequest(new Response(JSON.stringify({ status: 'success', ticket, expires_in: 90 })));
  await Promise.all([first, second]);
  assert.deepEqual(opened, [completionUrl]);

  await connectBrowser({
    ...options,
    fetchImpl: async () => new Response(JSON.stringify({ status: 'success', ticket, expires_in: 90 })),
  });
  assert.equal(opened.length, 2);
});

test('development binds to the permitted localhost host without requiring HTTPS', async () => {
  let binding;
  await connectBrowser({
    config: DEVELOPMENT_CONFIG,
    getCookies: async () => [{ name: 'MoodleSession', value: 'live-session' }],
    setCookie: async (details) => {
      binding = details;
      return { ...details, hostOnly: true };
    },
    openTab: async () => {},
    fetchImpl: async () => new Response(JSON.stringify({ status: 'success', ticket, expires_in: 90 })),
  });
  assert.equal(binding.url, 'http://localhost:8000/');
  assert.equal(binding.name, 'luconnect_login');
  assert.equal(binding.secure, false);
  assert.equal(binding.httpOnly, true);
});
