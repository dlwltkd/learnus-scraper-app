import assert from 'node:assert/strict';
import test from 'node:test';

import { CONFIG } from '../src/config.production.js';
import { BridgeError } from '../src/errors.js';
import {
  completionUrlFromExchange,
  exchangeCookieHeader,
  validateCompletionUrl,
} from '../src/exchange.js';

const ticket = 'A'.repeat(43);
const validCompletionUrl = `${CONFIG.completionOrigin}${CONFIG.completionPath}#ticket=${ticket}`;

test('validateCompletionUrl accepts only the configured fragment completion URL', () => {
  assert.equal(validateCompletionUrl(validCompletionUrl, CONFIG), validCompletionUrl);

  for (const invalidUrl of [
    `https://evil.example/auth/extension#ticket=${ticket}`,
    `${CONFIG.completionOrigin}/other#ticket=${ticket}`,
    `${CONFIG.completionOrigin}${CONFIG.completionPath}?ticket=${ticket}`,
    `${CONFIG.completionOrigin}${CONFIG.completionPath}#ticket=short`,
    `${CONFIG.completionOrigin}${CONFIG.completionPath}#ticket=${ticket}&extra=value`,
  ]) {
    assert.throws(
      () => validateCompletionUrl(invalidUrl, CONFIG),
      (error) => error instanceof BridgeError && error.code === 'BAD_RESPONSE',
    );
  }
});

test('completionUrlFromExchange validates a short-lived ticket and uses fixed routing', () => {
  assert.equal(
    completionUrlFromExchange({ status: 'success', ticket, expires_in: 90 }, CONFIG),
    validCompletionUrl,
  );

  for (const invalidPayload of [
    null,
    { status: 'error', ticket, expires_in: 90 },
    { status: 'success', ticket: 'short', expires_in: 90 },
    { status: 'success', ticket: `${ticket}!`, expires_in: 90 },
    { status: 'success', ticket, expires_in: 29 },
    { status: 'success', ticket, expires_in: 301 },
    { status: 'success', ticket, expires_in: 90.5 },
  ]) {
    assert.throws(
      () => completionUrlFromExchange(invalidPayload, CONFIG),
      (error) => error instanceof BridgeError && error.code === 'BAD_RESPONSE',
    );
  }
});

test('completionUrlFromExchange ignores a server-provided redirect URL', () => {
  assert.equal(
    completionUrlFromExchange({
      status: 'success',
      ticket,
      expires_in: 90,
      completion_url: `https://evil.example/auth/extension#ticket=${ticket}`,
    }, CONFIG),
    validCompletionUrl,
  );
});

test('exchangeCookieHeader sends one no-store credential-free request', async () => {
  let capturedUrl;
  let capturedOptions;
  const fetchImpl = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return new Response(JSON.stringify({ status: 'success', ticket, expires_in: 90 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await exchangeCookieHeader('MoodleSession=secret', CONFIG, fetchImpl);

  assert.deepEqual(result, { completionUrl: validCompletionUrl, ticket, expiresIn: 90 });
  assert.equal(capturedUrl, CONFIG.exchangeUrl);
  assert.equal(capturedOptions.method, 'POST');
  assert.equal(capturedOptions.cache, 'no-store');
  assert.equal(capturedOptions.credentials, 'omit');
  assert.equal(capturedOptions.redirect, 'error');
  assert.equal(capturedOptions.referrerPolicy, 'no-referrer');
  assert.deepEqual(JSON.parse(capturedOptions.body), { cookies: 'MoodleSession=secret' });
});

test('exchangeCookieHeader maps rejection and rate limiting to stable codes', async () => {
  const cases = [
    [401, 'SESSION_REJECTED'],
    [403, 'SESSION_REJECTED'],
    [429, 'RATE_LIMITED'],
    [503, 'SERVER'],
    [400, 'BAD_RESPONSE'],
  ];

  for (const [status, code] of cases) {
    await assert.rejects(
      exchangeCookieHeader('MoodleSession=secret', CONFIG, async () => new Response('', { status })),
      (error) => error instanceof BridgeError && error.code === code,
    );
  }
});

test('exchangeCookieHeader does not surface network exception text', async () => {
  await assert.rejects(
    exchangeCookieHeader('MoodleSession=secret', CONFIG, async () => {
      throw new Error('request contained MoodleSession=secret');
    }),
    (error) => (
      error instanceof BridgeError
      && error.code === 'NETWORK'
      && !error.message.includes('secret')
    ),
  );
});

test('a timeout while reading the response body is reported without exception text', async () => {
  await assert.rejects(
    exchangeCookieHeader('MoodleSession=secret', { ...CONFIG, requestTimeoutMs: 5 }, async (_url, options) => ({
      ok: true,
      text: () => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          reject(new DOMException('body contained a secret', 'AbortError'));
        }, { once: true });
      }),
    })),
    (error) => error instanceof BridgeError && error.code === 'TIMEOUT' && !error.message.includes('secret'),
  );
});
