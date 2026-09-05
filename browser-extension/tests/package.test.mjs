import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { buildExtension } from '../package-extension.mjs';

const forbiddenPermissions = new Set([
  '<all_urls>',
  'activeTab',
  'scripting',
  'storage',
  'tabs',
  'webNavigation',
  'webRequest',
]);

test('packager isolates production and development permissions and configuration', async (t) => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'learnus-extension-'));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));

  for (const target of ['production', 'development']) {
    const { outputDirectory } = await buildExtension(target, {
      outputRoot,
      createArchive: false,
    });
    const manifest = JSON.parse(await readFile(join(outputDirectory, 'manifest.json'), 'utf8'));
    const config = await readFile(join(outputDirectory, 'config.js'), 'utf8');
    const popup = await readFile(join(outputDirectory, 'popup.html'), 'utf8');
    const packagedFiles = await readdir(outputDirectory);

    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual(manifest.permissions, ['cookies']);
    assert.equal('content_scripts' in manifest, false);
    for (const permission of [...manifest.permissions, ...manifest.host_permissions]) {
      assert.equal(forbiddenPermissions.has(permission), false);
    }
    assert.equal(packagedFiles.some((file) => file.includes(`config.${target}`)), false);
    assert.match(popup, /<html lang="ko">/);
    assert.match(popup, /서버에 전달·보관돼요/);
    assert.match(popup, /개인정보 처리방침/);
    assert.match(manifest.description, /연세대학교 LearnUs 로그인/);
    assert.match(
      popup,
      /https:\/\/github\.com\/dlwltkd\/learnus-scraper-app\/blob\/main\/docs\/legal\/privacy-policy\.md/,
    );

    if (target === 'production') {
      assert.equal(manifest.host_permissions.some((host) => host.includes('localhost')), false);
      assert.equal(config.includes('localhost'), false);
    } else {
      assert.equal(manifest.host_permissions.includes('http://localhost:8000/*'), true);
      assert.equal(config.includes('http://localhost:8000/auth/extension/exchange'), true);
    }
  }
});
