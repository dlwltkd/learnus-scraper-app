import { Platform } from 'react-native';

// ============================================
// LEARNUS CONNECT - NEO-ACADEMIC DESIGN SYSTEM
// ============================================

// ─── Light Palette ──────────────────────────────────────────────────────────────

export const LightColors = {
    // === BACKGROUND SYSTEM ===
    background: '#F8F9FC',
    backgroundWarm: '#FDF8F4',
    backgroundCool: '#F4F7FB',
    backgroundGradientStart: '#FFFFFF',
    backgroundGradientEnd: '#F0F4F8',

    // === SURFACE SYSTEM ===
    surface: '#FFFFFF',
    surfaceElevated: 'rgba(255, 255, 255, 0.95)',
    surfaceGlass: 'rgba(255, 255, 255, 0.85)',
    surfaceHighlight: '#F7F9FC',
    surfaceMuted: '#F2F5F9',
    surfaceAlt: '#F0F3F8',

    // === TEXT HIERARCHY ===
    textPrimary: '#1A1D26',
    textSecondary: '#5C6679',
    textTertiary: '#9CA3B4',
    textMuted: '#C4CAD6',
    textInverse: '#FFFFFF',
    text: '#1A1D26',
    textLight: '#9CA3B4',

    // === BRAND PRIMARY ===
    primary: '#3182F6',
    primaryLight: '#5B9DF7',
    primaryLighter: '#E8F2FF',
    primaryDark: '#1B64DA',
    primaryPressed: '#1B64DA',
    primaryForeground: '#FFFFFF',
    primaryGlow: 'rgba(49, 130, 246, 0.15)',
    primaryGradientStart: '#3182F6',
    primaryGradientEnd: '#5B9DF7',

    // === ACCENT COLORS ===
    accent: '#FF6B4A',
    accentLight: '#FFF0ED',
    accentForeground: '#FFFFFF',

    secondary: '#6366F1',
    secondaryLight: '#EEF2FF',

    tertiary: '#8B5CF6',
    tertiaryLight: '#F5F3FF',

    // === SEMANTIC COLORS ===
    success: '#22C55E',
    successLight: '#DCFCE7',
    successForeground: '#FFFFFF',

    warning: '#F59E0B',
    warningLight: '#FEF3C7',

    error: '#EF4444',
    errorLight: '#FEE2E2',
    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',

    // === BORDERS & DIVIDERS ===
    border: '#E8ECF2',
    borderLight: '#F0F3F8',
    borderFocus: '#3182F6',
    divider: '#EEF1F6',
    input: '#E8ECF2',
    ring: '#3182F6',

    // === CHART PALETTE ===
    chart1: '#3182F6',
    chart2: '#22C55E',
    chart3: '#F59E0B',
    chart4: '#8B5CF6',
    chart5: '#EC4899',

    // === SPECIAL EFFECTS ===
    overlay: 'rgba(26, 29, 38, 0.5)',
    overlayLight: 'rgba(26, 29, 38, 0.3)',
    glassBorder: 'rgba(255, 255, 255, 0.2)',
    glassBackground: 'rgba(255, 255, 255, 0.7)',
    shimmer: 'rgba(255, 255, 255, 0.5)',

    // === GRADIENTS ===
    gradients: {
        primary: ['#3182F6', '#5B9DF7'],
        warm: ['#FF6B4A', '#FF8F73'],
        cool: ['#6366F1', '#818CF8'],
        surface: ['#FFFFFF', '#F8FAFC'],
        hero: ['#3182F6', '#6366F1'],
    },
};

// ─── Dark Palette ───────────────────────────────────────────────────────────────

export const DarkColors: typeof LightColors = {
    // === BACKGROUND SYSTEM ===
    background: '#0F1117',
    backgroundWarm: '#141618',
    backgroundCool: '#0D1015',
    backgroundGradientStart: '#141720',
    backgroundGradientEnd: '#0F1117',

    // === SURFACE SYSTEM ===
    surface: '#1A1D26',
    surfaceElevated: 'rgba(30, 33, 43, 0.95)',
    surfaceGlass: 'rgba(30, 33, 43, 0.85)',
    surfaceHighlight: '#22252E',
    surfaceMuted: '#161920',
    surfaceAlt: '#1E2028',

    // === TEXT HIERARCHY ===
    textPrimary: '#E8ECF2',
    textSecondary: '#9CA3B4',
    textTertiary: '#6B7280',
    textMuted: '#4B5563',
    textInverse: '#1A1D26',
    text: '#E8ECF2',
    textLight: '#6B7280',

    // === BRAND PRIMARY ===
    primary: '#4A94F7',
    primaryLight: '#6BABF9',
    primaryLighter: '#1A2744',
    primaryDark: '#3182F6',
    primaryPressed: '#3182F6',
    primaryForeground: '#FFFFFF',
    primaryGlow: 'rgba(74, 148, 247, 0.2)',
    primaryGradientStart: '#4A94F7',
    primaryGradientEnd: '#6BABF9',

    // === ACCENT COLORS ===
    accent: '#FF8266',
    accentLight: '#2D1F1C',
    accentForeground: '#FFFFFF',

    secondary: '#818CF8',
    secondaryLight: '#1E1F3A',

    tertiary: '#A78BFA',
    tertiaryLight: '#221E33',

    // === SEMANTIC COLORS ===
    success: '#34D399',
    successLight: '#132D22',
    successForeground: '#FFFFFF',

    warning: '#FBBF24',
    warningLight: '#2D2412',

    error: '#F87171',
    errorLight: '#2D1616',
    destructive: '#F87171',
    destructiveForeground: '#FFFFFF',

    // === BORDERS & DIVIDERS ===
    border: '#2A2D38',
    borderLight: '#22252E',
    borderFocus: '#4A94F7',
    divider: '#22252E',
    input: '#2A2D38',
    ring: '#4A94F7',

    // === CHART PALETTE ===
    chart1: '#4A94F7',
    chart2: '#34D399',
    chart3: '#FBBF24',
    chart4: '#A78BFA',
    chart5: '#F472B6',

    // === SPECIAL EFFECTS ===
    overlay: 'rgba(0, 0, 0, 0.6)',
    overlayLight: 'rgba(0, 0, 0, 0.4)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    glassBackground: 'rgba(30, 33, 43, 0.7)',
    shimmer: 'rgba(255, 255, 255, 0.08)',

    // === GRADIENTS ===
    gradients: {
        primary: ['#4A94F7', '#6BABF9'],
        warm: ['#FF8266', '#FFA08A'],
        cool: ['#818CF8', '#A5B4FC'],
        surface: ['#1A1D26', '#22252E'],
        hero: ['#4A94F7', '#818CF8'],
    },
};

// ─── Color type ─────────────────────────────────────────────────────────────────

export type ColorScheme = typeof LightColors;

// ─── Default export (light) for backward compat in non-component code ──────────
export const Colors = LightColors;

// ─── Layout (theme-aware shadows) ───────────────────────────────────────────────

export const createLayout = (isDark: boolean) => ({
    borderRadius: {
        xs: 6,
        s: 10,
        m: 14,
        l: 20,
        xl: 28,
        xxl: 36,
        full: 9999,
    },

    shadow: {
        sm: {
            shadowColor: isDark ? '#000' : '#1A1D26',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.04,
            shadowRadius: 8,
            elevation: isDark ? 1 : 2,
        },
        default: {
            shadowColor: isDark ? '#000' : '#1A1D26',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.4 : 0.06,
            shadowRadius: 16,
            elevation: isDark ? 2 : 4,
        },
        md: {
            shadowColor: isDark ? '#000' : '#1A1D26',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.5 : 0.08,
            shadowRadius: 24,
            elevation: isDark ? 3 : 6,
        },
        lg: {
            shadowColor: isDark ? '#000' : '#1A1D26',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: isDark ? 0.6 : 0.12,
            shadowRadius: 32,
            elevation: isDark ? 4 : 8,
        },
        xl: {
            shadowColor: isDark ? '#000' : '#1A1D26',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: isDark ? 0.7 : 0.15,
            shadowRadius: 40,
            elevation: isDark ? 6 : 12,
        },
        primary: {
            shadowColor: isDark ? '#4A94F7' : '#3182F6',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.3 : 0.25,
            shadowRadius: 20,
            elevation: isDark ? 4 : 8,
        },
        error: {
            shadowColor: isDark ? '#F87171' : '#EF4444',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.3 : 0.2,
            shadowRadius: 12,
            elevation: isDark ? 2 : 4,
        },
        inset: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: isDark ? 0.15 : 0.05,
            shadowRadius: 4,
            elevation: 0,
        },
    },

    glass: isDark ? {
        light: {
            backgroundColor: 'rgba(30, 33, 43, 0.85)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
        },
        medium: {
            backgroundColor: 'rgba(30, 33, 43, 0.75)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.05)',
        },
        dark: {
            backgroundColor: 'rgba(15, 17, 23, 0.85)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.05)',
        },
    } : {
        light: {
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.3)',
        },
        medium: {
            backgroundColor: 'rgba(255, 255, 255, 0.75)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.2)',
        },
        dark: {
            backgroundColor: 'rgba(26, 29, 38, 0.75)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
        },
    },
});

// Static Layout for backward compat
export const Layout = createLayout(false);

export type LayoutType = ReturnType<typeof createLayout>;

// ─── Typography factory ─────────────────────────────────────────────────────────

export const createTypography = (colors: ColorScheme) => ({
    display: {
        fontSize: 34,
        fontWeight: '800' as const,
        color: colors.textPrimary,
        lineHeight: 42,
        letterSpacing: -1,
    },
    header1: {
        fontSize: 28,
        fontWeight: '700' as const,
        color: colors.textPrimary,
        lineHeight: 36,
        letterSpacing: -0.6,
    },
    header2: {
        fontSize: 22,
        fontWeight: '700' as const,
        color: colors.textPrimary,
        lineHeight: 30,
        letterSpacing: -0.4,
    },
    header3: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: colors.textPrimary,
        lineHeight: 26,
        letterSpacing: -0.3,
    },
    subtitle1: {
        fontSize: 17,
        fontWeight: '600' as const,
        color: colors.textPrimary,
        lineHeight: 24,
        letterSpacing: -0.2,
    },
    subtitle2: {
        fontSize: 15,
        fontWeight: '600' as const,
        color: colors.textSecondary,
        lineHeight: 22,
        letterSpacing: -0.1,
    },
    body1: {
        fontSize: 16,
        fontWeight: '400' as const,
        color: colors.textPrimary,
        lineHeight: 24,
        letterSpacing: -0.1,
    },
    body2: {
        fontSize: 14,
        fontWeight: '400' as const,
        color: colors.textSecondary,
        lineHeight: 21,
    },
    caption: {
        fontSize: 12,
        fontWeight: '500' as const,
        color: colors.textTertiary,
        lineHeight: 16,
        letterSpacing: 0.1,
    },
    overline: {
        fontSize: 11,
        fontWeight: '600' as const,
        color: colors.textTertiary,
        lineHeight: 14,
        letterSpacing: 0.8,
        textTransform: 'uppercase' as const,
    },
    button: {
        fontSize: 15,
        fontWeight: '600' as const,
        letterSpacing: -0.1,
    },
    buttonSmall: {
        fontSize: 13,
        fontWeight: '600' as const,
        letterSpacing: 0,
    },
    label: {
        fontSize: 13,
        fontWeight: '500' as const,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    number: {
        fontSize: 32,
        fontWeight: '700' as const,
        color: colors.textPrimary,
        lineHeight: 40,
        letterSpacing: -1,
        fontVariant: ['tabular-nums'] as ('tabular-nums')[],
    },
    numberSmall: {
        fontSize: 24,
        fontWeight: '700' as const,
        color: colors.textPrimary,
        lineHeight: 32,
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums'] as ('tabular-nums')[],
    },
});

// Static Typography for backward compat
export const Typography = createTypography(LightColors);

export type TypographyType = ReturnType<typeof createTypography>;

// ─── Spacing (theme-independent) ────────────────────────────────────────────────

export const Spacing = {
    xxs: 2,
    xs: 4,
    s: 8,
    sm: 8,
    m: 16,
    md: 16,
    l: 24,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
    cardPadding: 20,
    sectionGap: 28,
    screenPadding: 20,
};

// ─── Animation (theme-independent) ──────────────────────────────────────────────

export const Animation = {
    duration: {
        fast: 150,
        normal: 250,
        slow: 400,
        page: 350,
    },
    spring: {
        gentle: { damping: 15, stiffness: 120 },
        bouncy: { damping: 10, stiffness: 180 },
        stiff: { damping: 20, stiffness: 300 },
    },
    easing: {
        easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
        easeIn: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
        easeInOut: 'cubic-bezier(0.87, 0, 0.13, 1)',
        bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
};

// ─── Icon Sizes ─────────────────────────────────────────────────────────────────

export const IconSize = {
    xs: 14,
    sm: 18,
    md: 22,
    lg: 28,
    xl: 36,
    xxl: 48,
};

// ─── Legacy Support ─────────────────────────────────────────────────────────────

export const COLORS = Colors;
export const SPACING = Spacing;
export const FONTS = {
    sizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, title: 28 },
};
export const SHADOWS = {
    card: Layout.shadow.default,
};
