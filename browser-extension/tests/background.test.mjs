import assert from 'node:assert/strict';
import test from 'node:test';

import { connectBrowser, openLearnUsLogin } from '../src/bridge.js';
import { CONFIG } from '../src/config.production.js';
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
    openTab: async (url) => opened.push(url),
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response(JSON.stringify({ status: 'success', ticket, expires_in: 90 }));
    },
  });

  assert.deepEqual(cookieQueries, [CONFIG.learnUsCookieUrl]);
  assert.deepEqual(body, { cookies: 'MoodleSession=live-session; device=device-token' });
  assert.deepEqual(opened, [completionUrl]);
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
