import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
    NavigationContainer,
    StackActions,
    createNavigationContainerRef,
    type LinkingOptions,
    type ParamListBase,
} from '@react-navigation/native';
import {
    createStackNavigator,
    type StackScreenProps,
} from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LabsProvider, useLabs } from './context/LabsContext';
import { UserProvider, useUser } from './context/UserContext';
import { TourProvider } from './context/TourContext';
import {
    WebIcon,
    WebTheme,
    LoadingState,
    type WebIconName,
} from './components/web/WebUI';
import { getCourses, type CourseSummary } from './services/api';
import { isDemoMode, setDemoMode } from './services/demoMode';
import { TOUR_MOCK_COURSES } from './constants/tourMockData';
import LoginScreen from './LoginScreen';
import DashboardScreen from './DashboardScreen';
import CoursesScreen from './CoursesScreen';
import VideoLecturesScreen from './VideoLecturesScreen';
import SettingsScreen from './SettingsScreen';
import CourseDetailScreen from './CourseDetailScreen';
import BoardScreen from './BoardScreen';
import PostDetailScreen from './PostDetailScreen';
import ManageCoursesScreen from './ManageCoursesScreen';
import HelpScreen from './HelpScreen';
import NotificationSettingsScreen from './NotificationSettingsScreen';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import MyInfoScreen from './MyInfoScreen';
import TermsOfServiceScreen from './TermsOfServiceScreen';
import NotificationHistoryScreen from './NotificationHistoryScreen';
import VodTranscriptScreen from './VodTranscriptScreen';
import FlashcardStudyScreen from './FlashcardStudyScreen';
import FlashcardDeckListScreen from './FlashcardDeckListScreen';
import LabsScreen from './LabsScreen';
import CourseLibraryScreen from './CourseLibraryScreen';
import CourseBrainChatScreen from './CourseBrainChatScreen';
import BrainSettingsScreen from './BrainSettingsScreen';
import LibraryItemScreen from './LibraryItemScreen';
import './components/web/web.css';

// A development-only, local-data preview. Production authentication is unchanged.
const previewPath =
    __DEV__ && typeof window !== 'undefined' ? window.location.pathname : '';
const isLoginPreview = previewPath === '/preview/login';
const isPreview = previewPath === '/preview' || isLoginPreview;
if (isPreview) setDemoMode(true);

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef<ParamListBase>();

// Keep full screen params in React Navigation's in-memory history, not in URLs
// or browser storage. Deep links still enter through the workspace dashboard.
const webLinking: LinkingOptions<ParamListBase> = {
    prefixes: [],
    getStateFromPath: () => ({ routes: [{ name: 'Main' }] }),
    getPathFromState: () => (isPreview ? '/preview' : '/'),
};

const mainPages: Array<{
    name: string;
    label: string;
    icon: WebIconName;
    component: React.ComponentType;
}> = [
    {
        name: 'Dashboard',
        label: '대시보드',
        icon: 'grid-outline',
        component: DashboardScreen,
    },
    {
        name: 'Courses',
        label: '내 강의',
        icon: 'albums-outline',
        component: CoursesScreen,
    },
    {
        name: 'VideoLectures',
        label: '동영상 강의',
        icon: 'play-circle-outline',
        component: VideoLecturesScreen,
    },
    {
        name: 'Settings',
        label: '설정',
        icon: 'options-outline',
        component: SettingsScreen,
    },
];

const detailPages: Array<{
    name: string;
    title: string;
    component: React.ComponentType<StackScreenProps<ParamListBase>>;
    desktop?: boolean;
}> = [
    {
        name: 'CourseDetail',
        title: '강의 홈',
        component: CourseDetailScreen,
        desktop: true,
    },
    { name: 'Board', title: '게시판', component: BoardScreen, desktop: true },
    {
        name: 'PostDetail',
        title: '게시물',
        component: PostDetailScreen,
        desktop: true,
    },
    {
        name: 'ManageCourses',
        title: '강의 관리',
        component: ManageCoursesScreen,
        desktop: true,
    },
    {
        name: 'NotificationSettings',
        title: '알림 설정',
        component: NotificationSettingsScreen,
    },
    {
        name: 'MyInfo',
        title: '내 정보',
        component: MyInfoScreen,
        desktop: true,
    },
    { name: 'Help', title: '도움말', component: HelpScreen, desktop: true },
    {
        name: 'PrivacyPolicy',
        title: '개인정보 처리방침',
        component: PrivacyPolicyScreen,
    },
    {
        name: 'TermsOfService',
        title: '이용약관',
        component: TermsOfServiceScreen,
    },
    {
        name: 'NotificationHistory',
        title: '알림 기록',
        component: NotificationHistoryScreen,
        desktop: true,
    },
    {
        name: 'VodTranscript',
        title: '강의 텍스트',
        component: VodTranscriptScreen,
    },
    {
        name: 'FlashcardStudy',
        title: '플래시카드 학습',
        component: FlashcardStudyScreen,
        desktop: true,
    },
    {
        name: 'FlashcardDeckList',
        title: '플래시카드',
        component: FlashcardDeckListScreen,
        desktop: true,
    },
    { name: 'Labs', title: '실험실', component: LabsScreen, desktop: true },
    {
        name: 'CourseLibrary',
        title: '강의 자료',
        component: CourseLibraryScreen,
        desktop: true,
    },
    {
        name: 'LibraryItem',
        title: '자료 살펴보기',
        component: LibraryItemScreen,
        desktop: true,
    },
    {
        name: 'CourseBrainChat',
        title: '강의 브레인',
        component: CourseBrainChatScreen,
        desktop: true,
    },
    {
        name: 'BrainSettings',
        title: '강의 브레인',
        component: BrainSettingsScreen,
        desktop: true,
    },
];

function MainPages() {
    const { colors } = useTheme();
    return (
        <Tab.Navigator
            backBehavior="fullHistory"
            tabBar={() => null}
            screenOptions={{
                headerShown: false,
                sceneStyle: { backgroundColor: colors.background },
            }}
        >
            {mainPages.map(({ name, component: Component }) => (
                <Tab.Screen key={name} name={name}>
                    {() => (
                        <div className="web-screen-frame">
                            <Component />
                        </div>
                    )}
                </Tab.Screen>
            ))}
        </Tab.Navigator>
    );
}

const guideSteps: Array<{ title: string; text: string; icon: WebIconName }> = [
    {
        title: '이번 학기를 한눈에',
        text: '대시보드에서 마감이 다가오는 과제와 강의를 확인하세요. 과제 옆 체크 버튼으로 완료 상태를 관리할 수 있어요.',
        icon: 'grid-outline',
    },
    {
        title: '강의마다 하나의 작업 공간',
        text: '내 강의에서 수업을 열면 과제, 동영상, 게시판을 모아 볼 수 있어요. 강의 관리에서 동기화할 수업을 선택하세요.',
        icon: 'albums-outline',
    },
    {
        title: '배우는 흐름 그대로',
        text: '동영상 강의에서 시청 기한을 확인하고, 강의 텍스트와 플래시카드로 학습을 이어가세요.',
        icon: 'play-circle-outline',
    },
    {
        title: '키보드로 더 빠르게',
        text: 'Ctrl 또는 ⌘ 키와 K를 눌러 강의와 메뉴를 빠르게 찾아보세요. 화면 오른쪽 위에서 테마를 바꿀 수도 있어요.',
        icon: 'search-outline',
    },
];

function Workspace() {
    const { isLoggedIn, isLoading, login, autoLogout, resetAutoLogout } =
        useAuth();
    const { profile } = useUser();
    const { colors, isDark, setThemeMode } = useTheme();
    const { labsUnlocked, brainEnabled } = useLabs();
    const [activeRoute, setActiveRoute] = useState('Dashboard');
    const [activeCourseName, setActiveCourseName] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [courses, setCourses] = useState<CourseSummary[]>([]);
    const [courseSearchError, setCourseSearchError] = useState(false);
    const [guideStep, setGuideStep] = useState(0);
    const searchDialog = useRef<HTMLDialogElement>(null);
    const guideDialog = useRef<HTMLDialogElement>(null);
    const searchInput = useRef<HTMLInputElement>(null);
    const displayName = profile.name || (isPreview ? '연세인' : '나의 계정');
    const searchShortcut =
        typeof navigator !== 'undefined' &&
        /Mac|iPhone|iPad/.test(navigator.platform)
            ? '⌘ K'
            : 'Ctrl K';

    const go = useCallback((name: string, params?: Record<string, unknown>) => {
        if (!navigationRef.isReady()) return;
        if (mainPages.some((page) => page.name === name))
            navigationRef.navigate({
                name: 'Main',
                params: { screen: name },
            });
        else if (name === 'CourseDetail') {
            const current = navigationRef.getCurrentRoute();
            const currentCourse = (
                current?.params as { course?: CourseSummary }
            )?.course;
            const nextCourse = params?.course as CourseSummary | undefined;
            if (current?.name !== name || currentCourse?.id !== nextCourse?.id)
                navigationRef.dispatch(StackActions.push(name, params));
        } else navigationRef.navigate(name, params);
        setSidebarOpen(false);
        searchDialog.current?.close();
    }, []);

    const openSearch = useCallback(() => {
        setSearch('');
        searchDialog.current?.showModal();
        searchInput.current?.focus();
    }, []);

    useEffect(() => {
        if (!isLoggedIn) return;
        let current = true;
        if (isDemoMode()) setCourses(TOUR_MOCK_COURSES);
        else
            getCourses()
                .then((result) => {
                    if (current) setCourses(result);
                })
                .catch(() => {
                    if (current) setCourseSearchError(true);
                });
        return () => {
            current = false;
        };
    }, [isLoggedIn]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (
                isLoggedIn &&
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === 'k'
            ) {
                event.preventDefault();
                openSearch();
            }
            if (event.key === 'Escape') setSidebarOpen(false);
        };
        const onGuide = () => {
            setGuideStep(0);
            guideDialog.current?.showModal();
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('learnus:tour', onGuide);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('learnus:tour', onGuide);
        };
    }, [isLoggedIn, openSearch]);

    const updateRoute = useCallback(() => {
        setSidebarOpen(false);
        searchDialog.current?.close();
        guideDialog.current?.close();
        const current = navigationRef.getCurrentRoute();
        const route = current?.name || 'Dashboard';
        const params = current?.params as
            | { courseName?: string; course?: CourseSummary }
            | undefined;
        const courseName = params?.courseName || params?.course?.name || '';
        setActiveRoute(route);
        setActiveCourseName(courseName);
        const title =
            mainPages.find((page) => page.name === route)?.label ||
            detailPages.find((page) => page.name === route)?.title ||
            '대시보드';
        document.title = `${courseName ? `${courseName} · ` : ''}${title} · LearnUs Connect`;
    }, []);

    if (isLoading)
        return <LoadingState label="워크스페이스를 준비하고 있어요" />;
    if (isLoginPreview || !isLoggedIn)
        return (
            <LoginScreen
                onLoginSuccess={async (token) => {
                    await login(token);
                    return true;
                }}
                autoLogout={autoLogout}
                onAutoLogoutComplete={resetAutoLogout}
            />
        );

    const title =
        mainPages.find((page) => page.name === activeRoute)?.label ||
        detailPages.find((page) => page.name === activeRoute)?.title ||
        '대시보드';
    const selected = [
        'CourseDetail',
        'Board',
        'PostDetail',
        'ManageCourses',
    ].includes(activeRoute)
        ? 'Courses'
        : [
                'BrainSettings',
                'CourseBrainChat',
                'CourseLibrary',
                'LibraryItem',
            ].includes(activeRoute)
          ? 'BrainSettings'
          : activeRoute === 'VodTranscript'
            ? 'VideoLectures'
            : activeRoute === 'FlashcardStudy'
              ? 'FlashcardDeckList'
              : [
                      'MyInfo',
                      'Labs',
                      'Help',
                      'NotificationSettings',
                      'TermsOfService',
                      'PrivacyPolicy',
                  ].includes(activeRoute)
                ? 'Settings'
                : activeRoute;
    const navLink = (name: string, label: string, icon: WebIconName) => (
        <button
            type="button"
            key={name}
            className={`web-nav-link${selected === name ? ' active' : ''}`}
            onClick={() => go(name)}
            aria-current={selected === name ? 'page' : undefined}
        >
            <WebIcon name={icon} size={19} />
            <span>{label}</span>
        </button>
    );
    const query = search.trim().toLocaleLowerCase();

    return (
        <NavigationContainer
            ref={navigationRef}
            linking={webLinking}
            onReady={updateRoute}
            onStateChange={updateRoute}
        >
            <TourProvider navigationRef={navigationRef}>
                <div className="web-shell">
                    <button
                        className={`web-sidebar-backdrop${sidebarOpen ? ' is-open' : ''}`}
                        onClick={() => setSidebarOpen(false)}
                        aria-label="메뉴 닫기"
                        tabIndex={sidebarOpen ? 0 : -1}
                    />
                    <aside
                        className={`web-sidebar${sidebarOpen ? ' is-open' : ''}`}
                        aria-label="주 메뉴"
                    >
                        <a
                            className="web-brand"
                            href="/"
                            onClick={(event) => {
                                event.preventDefault();
                                go('Dashboard');
                            }}
                            aria-label="LearnUs Connect 대시보드"
                        >
                            <span className="web-brand-mark">
                                <WebIcon name="layers" size={21} />
                            </span>
                            <span className="web-brand-wordmark">
                                LearnUs<small>CONNECT</small>
                            </span>
                        </a>
                        <nav className="web-nav" aria-label="학습 메뉴">
                            {mainPages
                                .filter((page) => page.name !== 'Settings')
                                .map((page) =>
                                    navLink(page.name, page.label, page.icon),
                                )}
                            {navLink(
                                'FlashcardDeckList',
                                '플래시카드',
                                'copy-outline',
                            )}
                            {labsUnlocked &&
                                brainEnabled &&
                                navLink(
                                    'BrainSettings',
                                    '강의 브레인',
                                    'chatbubble-ellipses-outline',
                                )}
                        </nav>
                        <div className="web-nav-divider" />
                        <nav className="web-nav" aria-label="개인 메뉴">
                            {navLink(
                                'NotificationHistory',
                                '알림',
                                'notifications-outline',
                            )}
                            {navLink('Settings', '설정', 'options-outline')}
                        </nav>
                        <div className="web-sidebar-bottom">
                            <a
                                className="web-learnus-link"
                                href="https://ys.learnus.org/"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                LearnUs 바로가기{' '}
                                <WebIcon name="open-outline" size={12} />
                            </a>
                            {navLink(
                                'Help',
                                '도움말 및 가이드',
                                'help-circle-outline',
                            )}
                            <div className="web-profile">
                                <span className="web-avatar">
                                    {displayName.slice(0, 1)}
                                </span>
                                <div>
                                    <div className="web-profile-name">
                                        {displayName}
                                    </div>
                                </div>
                                <button
                                    className="web-icon-button"
                                    onClick={() => go('MyInfo')}
                                    aria-label="내 정보 수정"
                                >
                                    <WebIcon name="chevron-forward" size={14} />
                                </button>
                            </div>
                        </div>
                    </aside>
                    <div className="web-main">
                        <header className="web-topbar">
                            <div className="web-breadcrumb">
                                <button
                                    className="web-icon-button web-mobile-menu"
                                    onClick={() => setSidebarOpen(true)}
                                    aria-label="메뉴 열기"
                                    aria-expanded={sidebarOpen}
                                >
                                    <WebIcon name="menu-outline" />
                                </button>
                                <strong>{title}</strong>
                                {activeCourseName && (
                                    <span
                                        className="web-breadcrumb-course"
                                        title={activeCourseName}
                                    >
                                        {activeCourseName}
                                    </span>
                                )}
                            </div>
                            <div className="web-topbar-actions">
                                <button
                                    className="web-search-trigger"
                                    onClick={openSearch}
                                    aria-label="강의 및 메뉴 검색"
                                >
                                    <WebIcon name="search-outline" size={16} />
                                    <span>강의, 메뉴 검색</span>
                                    <kbd>{searchShortcut}</kbd>
                                </button>
                                <span className="web-topbar-divider" />
                                <button
                                    className="web-icon-button"
                                    aria-label={
                                        isDark
                                            ? '라이트 모드로 전환'
                                            : '다크 모드로 전환'
                                    }
                                    onClick={() =>
                                        setThemeMode(isDark ? 'light' : 'dark')
                                    }
                                >
                                    <WebIcon
                                        name={
                                            isDark
                                                ? 'sunny-outline'
                                                : 'moon-outline'
                                        }
                                        size={18}
                                    />
                                </button>
                                <button
                                    className="web-icon-button"
                                    aria-label="알림 기록 열기"
                                    onClick={() => go('NotificationHistory')}
                                >
                                    <WebIcon
                                        name="notifications-outline"
                                        size={19}
                                    />
                                </button>
                                <button
                                    className="web-avatar"
                                    style={{ border: 0 }}
                                    onClick={() => go('MyInfo')}
                                    aria-label="내 정보"
                                >
                                    {displayName.slice(0, 1)}
                                </button>
                            </div>
                        </header>
                        {isPreview && (
                            <div className="web-preview-strip">
                                <span>디자인 미리보기 · 예시 학습 데이터</span>
                                <a href="/preview/login">로그인 화면 보기 ↗</a>
                            </div>
                        )}
                        <main className="web-content" id="main-content">
                            <Stack.Navigator
                                screenOptions={{
                                    headerShown: false,
                                    animation: 'none',
                                    cardStyle: {
                                        backgroundColor: colors.background,
                                    },
                                }}
                            >
                                <Stack.Screen
                                    name="Main"
                                    component={MainPages}
                                />
                                {detailPages.map(
                                    ({
                                        name,
                                        title: pageTitle,
                                        component: Component,
                                        desktop,
                                    }) => (
                                        <Stack.Screen
                                            key={name}
                                            name={name}
                                            options={{ title: pageTitle }}
                                        >
                                            {(props) =>
                                                desktop ? (
                                                    <div className="web-screen-frame">
                                                        <Component {...props} />
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="web-detail-heading">
                                                            <button
                                                                className="web-icon-button"
                                                                aria-label="이전 화면"
                                                                onClick={() =>
                                                                    navigationRef.canGoBack()
                                                                        ? navigationRef.goBack()
                                                                        : go(
                                                                              'Dashboard',
                                                                          )
                                                                }
                                                            >
                                                                <WebIcon
                                                                    name="arrow-back"
                                                                    size={17}
                                                                />
                                                            </button>
                                                            <span>
                                                                {pageTitle}
                                                            </span>
                                                        </div>
                                                        <div className="web-detail-frame">
                                                            <Component
                                                                {...props}
                                                            />
                                                        </div>
                                                    </>
                                                )
                                            }
                                        </Stack.Screen>
                                    ),
                                )}
                            </Stack.Navigator>
                        </main>
                    </div>
                </div>
                <dialog
                    ref={searchDialog}
                    className="web-dialog"
                    aria-label="강의 및 메뉴 검색"
                    onClick={(event) => {
                        if (event.target === searchDialog.current)
                            searchDialog.current?.close();
                    }}
                >
                    <div className="web-command-search">
                        <WebIcon name="search-outline" />
                        <input
                            ref={searchInput}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="어디로 이동할까요?"
                            aria-label="강의 및 메뉴 검색어"
                        />
                        <button
                            className="web-icon-button"
                            onClick={() => searchDialog.current?.close()}
                            aria-label="검색 닫기"
                        >
                            <WebIcon name="close" size={17} />
                        </button>
                    </div>
                    <div className="web-command-results">
                        <div className="web-command-label">메뉴</div>
                        {[
                            ...mainPages,
                            ...(labsUnlocked && brainEnabled
                                ? [
                                      {
                                          name: 'BrainSettings',
                                          label: '강의 브레인 · 채팅',
                                          icon: 'chatbubble-ellipses-outline' as const,
                                      },
                                  ]
                                : []),
                            {
                                name: 'FlashcardDeckList',
                                label: '플래시카드',
                                icon: 'copy-outline' as const,
                            },
                            {
                                name: 'Help',
                                label: '도움말',
                                icon: 'help-circle-outline' as const,
                            },
                        ]
                            .filter((page) => page.label.includes(query))
                            .map((page) => (
                                <button
                                    className="web-command-result"
                                    key={page.name}
                                    onClick={() => go(page.name)}
                                >
                                    <WebIcon name={page.icon} size={18} />
                                    {page.label}
                                    <WebIcon
                                        name="return-down-back"
                                        size={14}
                                    />
                                </button>
                            ))}
                        <div className="web-command-label">내 강의</div>
                        {courses
                            .filter((course) =>
                                course.name.toLocaleLowerCase().includes(query),
                            )
                            .map((course) => (
                                <button
                                    className="web-command-result"
                                    key={course.id}
                                    onClick={() =>
                                        go('CourseDetail', { course })
                                    }
                                >
                                    <WebIcon name="book-outline" size={18} />
                                    {course.name}
                                    <WebIcon name="arrow-forward" size={14} />
                                </button>
                            ))}
                        {(!courses.length ||
                            !courses.some((course) =>
                                course.name.toLocaleLowerCase().includes(query),
                            )) && (
                            <p className="web-command-label">
                                {courseSearchError
                                    ? '강의 목록을 불러오지 못했어요. 내 강의에서 다시 시도해주세요.'
                                    : '일치하는 강의가 없어요.'}
                            </p>
                        )}
                    </div>
                    <div className="web-command-footer">
                        Tab으로 이동 · Enter로 열기 · Esc로 닫기
                    </div>
                </dialog>
                <dialog
                    ref={guideDialog}
                    className="web-dialog"
                    aria-labelledby="web-guide-title"
                >
                    <div className="web-guide">
                        <WebIcon
                            name={guideSteps[guideStep].icon}
                            size={32}
                            color={colors.primary}
                        />
                        <h2 id="web-guide-title">
                            {guideSteps[guideStep].title}
                        </h2>
                        <p>{guideSteps[guideStep].text}</p>
                        <div className="web-guide-steps">
                            {guideSteps.map((_, index) => (
                                <span
                                    className={
                                        index === guideStep ? 'active' : ''
                                    }
                                    key={index}
                                />
                            ))}
                        </div>
                        <div className="web-guide-footer">
                            <button
                                className="web-button ghost"
                                onClick={() => guideDialog.current?.close()}
                            >
                                닫기
                            </button>
                            <button
                                className="web-button primary"
                                onClick={() =>
                                    guideStep < guideSteps.length - 1
                                        ? setGuideStep(guideStep + 1)
                                        : guideDialog.current?.close()
                                }
                            >
                                {guideStep < guideSteps.length - 1
                                    ? '다음'
                                    : '시작하기'}
                                <WebIcon name="arrow-forward" size={15} />
                            </button>
                        </div>
                    </div>
                </dialog>
            </TourProvider>
        </NavigationContainer>
    );
}

export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <ThemeProvider>
                    <ToastProvider>
                        <AuthProvider>
                            <LabsProvider>
                                <UserProvider>
                                    <WebTheme>
                                        <Workspace />
                                    </WebTheme>
                                </UserProvider>
                            </LabsProvider>
                        </AuthProvider>
                    </ToastProvider>
                </ThemeProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
