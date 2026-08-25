import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCookieHeader, hasUsableMoodleSession } from '../src/cookieHeader.js';

test('buildCookieHeader serializes standard cookies without changing values', () => {
  const header = buildCookieHeader([
    { name: 'MoodleSession', value: 'abc=def' },
    { name: 'MOODLEID1_', value: 'student' },
  ]);

  assert.equal(header, 'MoodleSession=abc=def; MOODLEID1_=student');
});

test('buildCookieHeader keeps the first value for duplicate names', () => {
  const header = buildCookieHeader([
    { name: 'MoodleSession', value: 'longest-path' },
    { name: 'MoodleSession', value: 'shorter-path' },
  ]);

  assert.equal(header, 'MoodleSession=longest-path');
});

test('buildCookieHeader preserves a keyless cookie and skips malformed records', () => {
  const header = buildCookieHeader([
    { name: '', value: 'device-token' },
    null,
    { name: 'valid', value: 'yes' },
    { name: 'missing-value' },
  ]);

  assert.equal(header, 'device-token; valid=yes');
});

test('hasUsableMoodleSession rejects missing, empty, and deleted sessions', () => {
  assert.equal(hasUsableMoodleSession([]), false);
  assert.equal(hasUsableMoodleSession([{ name: 'MoodleSession', value: '' }]), false);
  assert.equal(hasUsableMoodleSession([{ name: 'MoodleSession', value: 'deleted' }]), false);
  assert.equal(hasUsableMoodleSession([{ name: 'MoodleSession', value: 'DELETED' }]), false);
  assert.equal(hasUsableMoodleSession([{ name: 'MoodleSession', value: 'live' }]), true);
});
