const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const axios = require('axios');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../services/api.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

function loadClient({ demo = false, href = 'https://luconnect.example/auth/extension' } = {}) {
    let responseBody;
    let responseStatus = 200;
    let networkCalls = 0;
    let lastRequest;
    const historyReplacements = [];
    const browserWindow = {
        location: new URL(href),
        history: {
            replaceState(_state, _title, url) {
                historyReplacements.push(url);
                browserWindow.location = new URL(url, browserWindow.location);
            },
        },
    };
    const http = axios.create({
        adapter: async config => {
            networkCalls++;
            lastRequest = config;
            const response = { data: responseBody, status: responseStatus, statusText: '', headers: {}, config };
            if (responseStatus >= 400) throw new axios.AxiosError('Request failed', undefined, config, undefined, response);
            return response;
        },
    });
    const module = { exports: {} };
    const dependencies = {
        axios: { create: () => http, isAxiosError: axios.isAxiosError },
        'react-native': { Platform: { OS: 'web' } },
        'react-native-sse': class EventSource {},
        './secureStorage': { secureStorage: {} },
        './demoMode': { DEMO_USERNAME: 'playreview', isDemoMode: () => demo },
    };
    vm.runInNewContext(compiled, {
        module,
        exports: module.exports,
        require: name => {
            if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
            return dependencies[name];
        },
        process: { env: {} },
        __DEV__: false,
        console: { log() {} },
        window: browserWindow,
        document: { title: 'LearnUs Connect' },
        URLSearchParams,
    });
    return {
        api: module.exports,
        respond: (body, status = 200) => { responseBody = body; responseStatus = status; },
        networkCalls: () => networkCalls,
        lastRequest: () => lastRequest,
        currentUrl: () => browserWindow.location.toString(),
        historyReplacements,
    };
}

function authError(api, reason) {
    return error => error instanceof api.BrowserAuthError && error.reason === reason;
}

test('a valid web session activates browser authentication', async () => {
    const { api, respond } = loadClient();
    respond({ authenticated: true, username: 'student' });
    assert.equal(await api.restoreBrowserSession(), true);
    assert.equal(api.hasAuthToken(), true);
});

for (const [name, body] of [
    ['HTML 200 fallback', '<!DOCTYPE html><html><body>Expo</body></html>'],
    ['empty body', null],
    ['array body', []],
    ['missing fields', {}],
    ['false authentication', { authenticated: false, username: 'student' }],
    ['truthy authentication string', { authenticated: 'true', username: 'student' }],
    ['missing username', { authenticated: true }],
    ['blank username', { authenticated: true, username: '  ' }],
    ['non-string username', { authenticated: true, username: 123 }],
]) {
    test(`session restoration rejects ${name} and clears prior authentication`, async () => {
        const { api, respond } = loadClient();
        respond({ authenticated: true, username: 'student' });
        await api.restoreBrowserSession();
        respond(body);
        await assert.rejects(api.restoreBrowserSession(), authError(api, 'unavailable'));
        assert.equal(api.hasAuthToken(), false);
    });
}

test('a 401 session response signs out without becoming a server error', async () => {
    const { api, respond } = loadClient();
    respond({ authenticated: true, username: 'student' });
    await api.restoreBrowserSession();
    respond({ detail: 'Not authenticated' }, 401);
    assert.equal(await api.restoreBrowserSession(), false);
    assert.equal(api.hasAuthToken(), false);
});

test('a failed session request clears prior authentication', async () => {
    const { api, respond } = loadClient();
    respond({ authenticated: true, username: 'student' });
    await api.restoreBrowserSession();
    respond({}, 503);
    await assert.rejects(api.restoreBrowserSession(), authError(api, 'unavailable'));
    assert.equal(api.hasAuthToken(), false);
});

test('valid extension completion activates browser authentication', async () => {
    const { api, respond } = loadClient();
    respond({ status: 'success', username: 'student' });
    const result = await api.completeExtensionLogin('test-ticket');
    assert.equal(result.status, 'success');
    assert.equal(result.username, 'student');
    assert.equal(api.hasAuthToken(), true);
});

for (const [name, body] of [
    ['HTML 200 fallback', '<!DOCTYPE html><html>Expo</html>'],
    ['empty body', null],
    ['missing fields', {}],
    ['failed status', { status: 'failed', username: 'student' }],
    ['missing username', { status: 'success' }],
    ['blank username', { status: 'success', username: '  ' }],
    ['non-string username', { status: 'success', username: 123 }],
]) {
    test(`extension completion rejects ${name} and clears prior authentication`, async () => {
        const { api, respond } = loadClient();
        respond({ authenticated: true, username: 'student' });
        await api.restoreBrowserSession();
        respond(body);
        await assert.rejects(api.completeExtensionLogin('test-ticket'), authError(api, 'unavailable'));
        assert.equal(api.hasAuthToken(), false);
    });
}

for (const status of [401, 409, 410, 422, 403, 503]) {
    test(`extension completion preserves the failure reason for HTTP ${status}`, async () => {
        const { api, respond } = loadClient();
        respond({ authenticated: true, username: 'student' });
        await api.restoreBrowserSession();
        respond({}, status);
        const reason = [401, 409, 410, 422].includes(status) ? 'invalid-ticket' : 'unavailable';
        await assert.rejects(api.completeExtensionLogin('test-ticket'), authError(api, reason));
        assert.equal(api.hasAuthToken(), false);
    });
}

test('explicit demo mode supplies valid auth shapes without a network request', async () => {
    const { api, networkCalls } = loadClient({ demo: true });
    assert.equal(await api.restoreBrowserSession(), true);
    const result = await api.completeExtensionLogin('preview-ticket');
    assert.equal(result.status, 'success');
    assert.equal(result.username, 'playreview');
    assert.equal(api.hasAuthToken(), true);
    assert.equal(networkCalls(), 0);
});

test('the completion ticket is removed synchronously and can only be read once', () => {
    const ticket = 'A'.repeat(43);
    const { api, currentUrl, historyReplacements, networkCalls } = loadClient({
        href: `https://luconnect.example/auth/extension#ticket=${ticket}`,
    });
    assert.equal(api.takeExtensionLoginTicket(), ticket);
    assert.equal(currentUrl(), 'https://luconnect.example/auth/extension');
    assert.deepEqual(historyReplacements, ['/auth/extension']);
    assert.equal(api.takeExtensionLoginTicket(), null);
    assert.equal(networkCalls(), 0);
});

for (const path of [
    '/auth/extension#ticket=',
    '/auth/extension#ticket=short',
    `/auth/extension#ticket=${'A'.repeat(43)}&ticket=${'B'.repeat(43)}`,
    `/auth/extension#ticket=${'A'.repeat(43)}&extra=1`,
    `/#ticket=${'A'.repeat(43)}`,
]) {
    test(`invalid completion input is rejected and removed from ${path.split('#')[0]}`, () => {
        const { api, currentUrl, networkCalls } = loadClient({ href: `https://luconnect.example${path}` });
        assert.throws(() => api.takeExtensionLoginTicket(), authError(api, 'invalid-ticket'));
        assert.equal(new URL(currentUrl()).hash, '');
        assert.equal(networkCalls(), 0);
    });
}

test('ordinary page fragments do not trigger a login or change history', () => {
    const { api, currentUrl, historyReplacements } = loadClient({ href: 'https://luconnect.example/#help' });
    assert.equal(api.takeExtensionLoginTicket(), null);
    assert.equal(currentUrl(), 'https://luconnect.example/#help');
    assert.deepEqual(historyReplacements, []);
});

test('browser login and logout requests have a finite timeout', async () => {
    const { api, respond, lastRequest } = loadClient();
    respond({ authenticated: true, username: 'student' });
    await api.restoreBrowserSession();
    assert.equal(lastRequest().timeout, 15_000);
    respond({ status: 'success', username: 'student' });
    await api.completeExtensionLogin('test-ticket');
    assert.equal(lastRequest().timeout, 15_000);
    await api.logoutServerSide();
    assert.equal(lastRequest().timeout, 15_000);
});
