const assert = require('node:assert/strict');
const test = require('node:test');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = new URL(process.env.LEARNUS_QA_BASE || 'http://localhost:8081');
assert.ok(
    ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname),
    'Run navigation tests against a local app or local static export.',
);
const origin = base.origin;
const course = {
    id: 731902,
    name: '비공개 수업 NAV_COURSE_ONE',
    professor: 'NAV_PRIVATE_PROFESSOR',
    is_active: true,
};
const secondCourse = {
    id: 731903,
    name: '비공개 수업 NAV_COURSE_TWO',
    professor: 'NAV_SECOND_PROFESSOR',
    is_active: true,
};
const board = {
    id: 842901,
    title: '공지사항 NAV_PRIVATE_BOARD',
    url: 'https://ys.learnus.org/mod/board/view.php?id=842901',
};
const post = {
    id: 953901,
    title: 'NAV_PRIVATE_POST_TITLE',
    writer: 'NAV_PRIVATE_WRITER',
    date: '2026-09-05',
    url: 'https://ys.learnus.org/mod/board/view.php?id=953901',
    content: '<p>NAV_PRIVATE_POST_CONTENT</p>',
};
const overview = {
    stats: {
        completed_assignments_due: 0,
        total_assignments_due: 0,
        missed_vods_count: 0,
        missed_assignments_count: 0,
    },
    upcoming_assignments: [],
    missed_assignments: [],
    missed_vods: [],
    upcoming_vods: [],
    unchecked_vods: [],
    available_vods: [
        {
            id: 624901,
            title: 'NAV_PRIVATE_LECTURE',
            course_id: course.id,
            course_name: course.name,
            end_date: '2099-09-10T23:59:00',
            is_completed: false,
            url: 'https://ys.learnus.org/mod/vod/viewer.php?id=624901',
        },
    ],
};
const pageSelectors = {
    Dashboard: '.dashboard-page',
    Courses: '.courses-page',
    VideoLectures: '.lectures-page',
    Settings: '.account-page',
    CourseDetail: '.course-detail-page',
    Board: '.board-page',
    PostDetail: '.board-post-page',
};
const sidebarLabels = {
    Dashboard: '대시보드',
    Courses: '내 강의',
    VideoLectures: '동영상 강의',
    Settings: '설정',
};
let browser;

test.before(async () => {
    browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
});
test.after(async () => {
    await browser?.close();
});

async function workspace(t) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
    });
    const errors = [];
    const unexpected = [];
    let signedIn = true;
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', (error) => errors.push(error.message));
    await context.addInitScript(() => {
        window.__navigationHistoryWrites = [];
        for (const method of ['pushState', 'replaceState']) {
            const original = window.history[method];
            window.history[method] = function (state, title, url) {
                window.__navigationHistoryWrites.push({
                    method,
                    state: JSON.stringify(state),
                    url: url == null ? null : String(url),
                });
                return original.apply(this, arguments);
            };
        }
    });
    await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== origin) {
            unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
            return route.abort();
        }
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const path = url.pathname.slice(4);
        const json = (data, status = 200) =>
            route.fulfill({
                status,
                contentType: 'application/json',
                body: JSON.stringify(data),
            });
        if (path === '/auth/logout' && request.method() === 'POST') {
            signedIn = false;
            return json({ status: 'success' });
        }
        if (!signedIn) return json({ detail: 'Not authenticated' }, 401);
        if (request.method() !== 'GET') {
            unexpected.push(`${request.method()} ${path}`);
            return json(
                { detail: 'Unexpected mutation in navigation test' },
                501,
            );
        }
        if (path === '/auth/web-session')
            return json({
                authenticated: true,
                username: 'NAV_PRIVATE_ACCOUNT',
            });
        if (path === '/auth/validate-session') return json({ valid: true });
        if (path === '/settings/labs')
            return json({
                labs_unlocked: false,
                brain_enabled: false,
                auto_watch_enabled: false,
            });
        if (path === '/courses') return json([course, secondCourse]);
        if (path === '/dashboard/overview') return json(overview);
        if (/^\/courses\/73190[23]\/(assignments|vods)$/.test(path))
            return json([]);
        if (/^\/courses\/73190[23]\/boards$/.test(path)) return json([board]);
        if (path === `/boards/${board.id}/posts`) return json([post]);
        if (path === `/posts/${post.id}`) return json(post);
        if (path === '/flashcards/decks') return json({ decks: [] });
        if (path === '/notifications') return json([]);
        if (path === '/version') return json({ version: '1.0.0' });
        unexpected.push(`${request.method()} ${path}`);
        return json({ detail: 'Unexpected fixture request' }, 501);
    });
    t.after(async () => {
        try {
            assert.deepEqual(
                errors,
                [],
                'Navigation must not raise browser runtime errors',
            );
            assert.deepEqual(
                unexpected,
                [],
                'All account and provider requests must stay inside the fixture',
            );
            if (!page.isClosed() && new URL(page.url()).origin === origin)
                await assertPrivateHistory(page);
        } finally {
            await context.close();
        }
    });
    await page.goto(`${origin}/`);
    await show(page, 'Dashboard');
    return page;
}

async function settle(page) {
    await page.evaluate(
        () =>
            new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
    );
}

async function assertPrivateHistory(page) {
    const current = new URL(page.url());
    assert.equal(
        current.pathname,
        '/',
        'Navigation keeps the canonical workspace URL',
    );
    assert.equal(current.search, '');
    assert.equal(current.hash, '');
    const writes = await page.evaluate(() => [
        ...window.__navigationHistoryWrites,
        {
            state: JSON.stringify(window.history.state),
            url: window.location.href,
        },
    ]);
    for (const entry of writes) {
        const serialized = `${entry.state || ''} ${entry.url || ''}`;
        assert.doesNotMatch(
            serialized,
            /NAV_PRIVATE|NAV_COURSE|NAV_SECOND|731902|731903|842901|953901|624901|"(?:params|routes|content|cards|transcript)"/,
            'Course names, IDs, post content, and full route params must remain out of browser history',
        );
        if (entry.url) {
            const url = new URL(entry.url, origin);
            assert.equal(url.pathname, '/');
            assert.equal(url.search, '');
            assert.equal(url.hash, '');
        }
    }
}

async function show(page, name, expectedCourse = course) {
    const screen = page.locator(`${pageSelectors[name]}:visible`);
    await screen.waitFor();
    if (name === 'CourseDetail')
        await screen
            .getByRole('heading', { name: expectedCourse.name, exact: true })
            .waitFor();
    if (name === 'Board')
        await screen
            .getByRole('heading', { name: board.title, exact: true })
            .waitFor();
    if (name === 'PostDetail') {
        await screen
            .getByRole('heading', { name: post.title, exact: true })
            .waitFor();
        await screen
            .getByText('NAV_PRIVATE_POST_CONTENT', { exact: true })
            .waitFor();
    }
    await settle(page);
    await assertPrivateHistory(page);
    return screen;
}

async function navigate(page, name) {
    await page
        .locator('.web-sidebar')
        .getByRole('button', { name: sidebarLabels[name], exact: true })
        .click();
    return show(page, name);
}

async function openCourse(page, selectedCourse = course) {
    await navigate(page, 'Courses');
    await page
        .locator('.courses-card-link')
        .filter({ hasText: selectedCourse.name })
        .click();
    return show(page, 'CourseDetail', selectedCourse);
}

async function openPost(page) {
    const detail = await openCourse(page);
    await detail
        .getByRole('button', { name: board.title, exact: true })
        .click();
    const boardPage = await show(page, 'Board');
    await boardPage
        .getByRole('button', { name: post.title, exact: true })
        .click();
    return show(page, 'PostDetail');
}

async function traverse(page, direction, name, expectedCourse) {
    await page[direction]({ waitUntil: 'commit' });
    return show(page, name, expectedCourse);
}

async function historySnapshot(page) {
    await settle(page);
    return page.evaluate(() => ({
        length: window.history.length,
        state: JSON.stringify(window.history.state),
        writes: window.__navigationHistoryWrites.length,
    }));
}

test('main-page chain retains revisits through browser Back and Forward', async (t) => {
    const page = await workspace(t);
    for (const name of ['Courses', 'VideoLectures', 'Courses', 'Settings'])
        await navigate(page, name);
    for (const name of ['Courses', 'VideoLectures', 'Courses', 'Dashboard'])
        await traverse(page, 'goBack', name);
    for (const name of ['Courses', 'VideoLectures', 'Courses', 'Settings'])
        await traverse(page, 'goForward', name);
});

test('detail to sidebar navigation restores the complete course params on Back', async (t) => {
    const page = await workspace(t);
    await openCourse(page);
    await navigate(page, 'VideoLectures');
    const detail = await traverse(page, 'goBack', 'CourseDetail');
    await detail.getByText(course.professor, { exact: true }).waitFor();
    await detail
        .getByRole('button', { name: board.title, exact: true })
        .waitFor();
    await traverse(page, 'goForward', 'VideoLectures');
});

test('board and post Back and Forward restore their titles, content, and course context', async (t) => {
    const page = await workspace(t);
    await openPost(page);
    await traverse(page, 'goBack', 'Board');
    await traverse(page, 'goBack', 'CourseDetail');
    await traverse(page, 'goForward', 'Board');
    const postPage = await traverse(page, 'goForward', 'PostDetail');
    await postPage
        .getByText(`${course.name} / ${board.title}`, { exact: true })
        .waitFor();
    await navigate(page, 'Settings');
    await traverse(page, 'goBack', 'PostDetail');
});

test('explicit screen Back preserves browser Forward for both post and board', async (t) => {
    const page = await workspace(t);
    const postPage = await openPost(page);
    await postPage
        .getByRole('button', { name: '목록으로', exact: true })
        .click();
    await show(page, 'Board');
    await traverse(page, 'goForward', 'PostDetail');
    await page
        .locator('.board-post-page:visible')
        .getByRole('button', { name: '목록으로', exact: true })
        .click();
    const boardPage = await show(page, 'Board');
    await boardPage
        .getByRole('button', { name: `${course.name}로 돌아가기`, exact: true })
        .click();
    await show(page, 'CourseDetail');
    await traverse(page, 'goForward', 'Board');
    await traverse(page, 'goForward', 'PostDetail');
});

test('clicking the current sidebar page does not add duplicate history', async (t) => {
    const page = await workspace(t);
    await navigate(page, 'Courses');
    const before = await historySnapshot(page);
    for (let index = 0; index < 3; index++) await navigate(page, 'Courses');
    const after = await historySnapshot(page);
    assert.equal(after.length, before.length);
    assert.equal(after.state, before.state);
    await traverse(page, 'goBack', 'Dashboard');
    await traverse(page, 'goForward', 'Courses');
    await page.getByRole('button', { name: '강의 관리', exact: true }).click();
    const management = page.locator('.management-page:visible');
    await management.waitFor();
    await management
        .getByRole('button', { name: '내 강의', exact: true })
        .click();
    await show(page, 'Courses');
});

test('typing, filters, view controls, and opening search do not write navigation history', async (t) => {
    const page = await workspace(t);
    const courses = await navigate(page, 'Courses');
    const beforeCourses = await historySnapshot(page);
    await courses
        .getByRole('searchbox', { name: '강의명 또는 교수 검색' })
        .fill('NAV_PRIVATE_SEARCH');
    await courses
        .getByRole('searchbox', { name: '강의명 또는 교수 검색' })
        .fill('');
    await courses.getByRole('button', { name: /^숨긴 강의/ }).click();
    await courses.getByRole('button', { name: /^활성 강의/ }).click();
    await courses
        .getByRole('button', { name: '카드로 보기', exact: true })
        .click();
    await courses
        .getByRole('button', { name: '목록으로 보기', exact: true })
        .click();
    await page
        .getByRole('button', { name: '강의 및 메뉴 검색', exact: true })
        .click();
    await page
        .getByRole('textbox', { name: '강의 및 메뉴 검색어', exact: true })
        .fill('NAV_PRIVATE_COMMAND');
    await page.keyboard.press('Escape');
    assert.deepEqual(await historySnapshot(page), beforeCourses);
    const lectures = await navigate(page, 'VideoLectures');
    const beforeLectures = await historySnapshot(page);
    await lectures
        .getByRole('searchbox', { name: '동영상 강의 검색' })
        .fill('NAV_PRIVATE_LECTURE');
    await lectures
        .getByRole('combobox', { name: '수업별 필터' })
        .selectOption(course.name);
    await lectures.getByRole('button', { name: /^시청 가능/ }).click();
    assert.deepEqual(await historySnapshot(page), beforeLectures);
    await traverse(page, 'goBack', 'Courses');
});

test('rapid browser traversal settles on the correct route', async (t) => {
    const page = await workspace(t);
    for (const name of ['Courses', 'VideoLectures', 'Settings'])
        await navigate(page, name);
    await page.goBack({ waitUntil: 'commit' });
    await page.goBack({ waitUntil: 'commit' });
    await page.goForward({ waitUntil: 'commit' });
    await show(page, 'VideoLectures');
    await traverse(page, 'goForward', 'Settings');
    await traverse(page, 'goBack', 'VideoLectures');
});

test('searching for another course preserves the previous course on browser Back', async (t) => {
    const page = await workspace(t);
    await openCourse(page);
    await page.keyboard.press('Control+k');
    await page
        .getByRole('textbox', { name: '강의 및 메뉴 검색어', exact: true })
        .fill(secondCourse.name);
    await page
        .locator('.web-command-result')
        .filter({ hasText: secondCourse.name })
        .click();
    await show(page, 'CourseDetail', secondCourse);
    await traverse(page, 'goBack', 'CourseDetail', course);
    await traverse(page, 'goForward', 'CourseDetail', secondCourse);
});

test('reload and stale browser history safely return to the dashboard', async (t) => {
    const page = await workspace(t);
    await openPost(page);
    await navigate(page, 'Settings');
    await page.reload();
    await show(page, 'Dashboard');
    await traverse(page, 'goBack', 'Dashboard');
    await navigate(page, 'Courses');
});

test('browser Back and Forward cannot reveal the workspace after logout', async (t) => {
    const page = await workspace(t);
    await openPost(page);
    const settings = await navigate(page, 'Settings');
    await settings
        .getByRole('button', { name: '로그아웃', exact: true })
        .click();
    await page
        .getByText('이 브라우저에서 로그아웃하시겠어요?', { exact: true })
        .waitFor();
    await page.getByText('로그아웃', { exact: true }).last().click();
    await page.locator('.login-page:visible').waitFor();
    for (const direction of ['goBack', 'goBack', 'goForward']) {
        await page[direction]({ waitUntil: 'commit' });
        await page.locator('.login-page:visible').waitFor();
        await settle(page);
        assert.equal(await page.locator('.web-shell').count(), 0);
        assert.equal(
            await page
                .getByText('NAV_PRIVATE_POST_CONTENT', { exact: true })
                .count(),
            0,
        );
        await assertPrivateHistory(page);
    }
    await page.reload();
    await page.locator('.login-page:visible').waitFor();
    await page.goBack({ waitUntil: 'commit' });
    await page.locator('.login-page:visible').waitFor();
    assert.equal(await page.locator('.web-shell').count(), 0);
});
