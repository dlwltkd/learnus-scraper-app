import { Platform } from 'react-native';

// ============================================
// LEARNUS CONNECT - NEO-ACADEMIC DESIGN SYSTEM
// ============================================

export const Colors = {
    // === BACKGROUND SYSTEM ===
    // Warm, inviting backgrounds with subtle depth
    background: '#F8F9FC',           // Warm light gray
    backgroundWarm: '#FDF8F4',       // Cream undertone for variety
    backgroundCool: '#F4F7FB',       // Cool variant
    backgroundGradientStart: '#FFFFFF',
    backgroundGradientEnd: '#F0F4F8',

    // === SURFACE SYSTEM (Glass Cards) ===
    surface: '#FFFFFF',
    surfaceElevated: 'rgba(255, 255, 255, 0.95)',
    surfaceGlass: 'rgba(255, 255, 255, 0.85)',
    surfaceHighlight: '#F7F9FC',
    surfaceMuted: '#F2F5F9',

    // === TEXT HIERARCHY ===
    textPrimary: '#1A1D26',          // Deep charcoal, not pure black
    textSecondary: '#5C6679',        // Balanced gray
    textTertiary: '#9CA3B4',         // Light gray for hints
    textMuted: '#C4CAD6',            // Very subtle
    textInverse: '#FFFFFF',
    text: '#1A1D26',                 // Legacy support
    textLight: '#9CA3B4',            // Legacy support

    // === BRAND PRIMARY (Blue Spectrum) ===
    primary: '#3182F6',              // Core blue - kept as requested
    primaryLight: '#5B9DF7',         // Lighter variant
    primaryLighter: '#E8F2FF',       // Very light tint
    primaryDark: '#1B64DA',          // Pressed/darker state
    primaryPressed: '#1B64DA',
    primaryForeground: '#FFFFFF',
    primaryGlow: 'rgba(49, 130, 246, 0.15)',  // For glow effects
    primaryGradientStart: '#3182F6',
    primaryGradientEnd: '#5B9DF7',

    // === ACCENT COLORS ===
    accent: '#FF6B4A',               // Warm coral for energy
    accentLight: '#FFF0ED',
    accentForeground: '#FFFFFF',

    secondary: '#6366F1',            // Indigo for variety
    secondaryLight: '#EEF2FF',

    tertiary: '#8B5CF6',             // Purple for AI features
    tertiaryLight: '#F5F3FF',

    // === SEMANTIC COLORS ===
    success: '#22C55E',              // Fresh green
    successLight: '#DCFCE7',
    successForeground: '#FFFFFF',

    warning: '#F59E0B',              // Warm amber
    warningLight: '#FEF3C7',

    error: '#EF4444',                // Clear red
    errorLight: '#FEE2E2',
    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',

    // === BORDERS & DIVIDERS ===
    border: '#E8ECF2',               // Soft border
    borderLight: '#F0F3F8',          // Very subtle
    borderFocus: '#3182F6',          // Focus state
    divider: '#EEF1F6',
    input: '#E8ECF2',
    ring: '#3182F6',

    // === CHART PALETTE ===
    chart1: '#3182F6',               // Primary blue
    chart2: '#22C55E',               // Green
    chart3: '#F59E0B',               // Amber
    chart4: '#8B5CF6',               // Purple
    chart5: '#EC4899',               // Pink

    // === SPECIAL EFFECTS ===
    overlay: 'rgba(26, 29, 38, 0.5)',
    overlayLight: 'rgba(26, 29, 38, 0.3)',
    glassBorder: 'rgba(255, 255, 255, 0.2)',
    glassBackground: 'rgba(255, 255, 255, 0.7)',
    shimmer: 'rgba(255, 255, 255, 0.5)',

    // === GRADIENTS (as CSS-like strings for reference) ===
    gradients: {
        primary: ['#3182F6', '#5B9DF7'],
        warm: ['#FF6B4A', '#FF8F73'],
        cool: ['#6366F1', '#818CF8'],
        surface: ['#FFFFFF', '#F8FAFC'],
        hero: ['#3182F6', '#6366F1'],
    },
};

export const Spacing = {
    // Base unit: 4px
    xxs: 2,
    xs: 4,
    s: 8,
    sm: 8,      // Legacy
    m: 16,
    md: 16,     // Legacy
    l: 24,
    lg: 24,     // Legacy
    xl: 32,
    xxl: 48,
    xxxl: 64,

    // Semantic spacing
    cardPadding: 20,
    sectionGap: 28,
    screenPadding: 20,
};

export const Layout = {
    borderRadius: {
        xs: 6,
        s: 10,
        m: 14,
        l: 20,
        xl: 28,
        xxl: 36,
        full: 9999,
    },

    // Glass morphism shadows - layered for depth
    shadow: {
        // Subtle elevation
        sm: {
            shadowColor: '#1A1D26',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
        },
        // Default card shadow
        default: {
            shadowColor: '#1A1D26',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 16,
            elevation: 4,
        },
        // Elevated elements
        md: {
            shadowColor: '#1A1D26',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.08,
            shadowRadius: 24,
            elevation: 6,
        },
        // Floating elements
        lg: {
            shadowColor: '#1A1D26',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.12,
            shadowRadius: 32,
            elevation: 8,
        },
        // Dramatic floating
        xl: {
            shadowColor: '#1A1D26',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.15,
            shadowRadius: 40,
            elevation: 12,
        },
        // Colored shadow for primary elements
        primary: {
            shadowColor: '#3182F6',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 8,
        },
        // Error/destructive shadow
        error: {
            shadowColor: '#EF4444',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 4,
        },
        // Inset shadow for depth
        inset: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 0,
        },
    },

    // Glass card styles
    glass: {
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
};

// Modern typography system
export const Typography = {
    // Display - Hero text
    display: {
        fontSize: 34,
        fontWeight: '800' as const,
        color: Colors.textPrimary,
        lineHeight: 42,
        letterSpacing: -1,
    },

    // Headers
    header1: {
        fontSize: 28,
        fontWeight: '700' as const,
        color: Colors.textPrimary,
        lineHeight: 36,
        letterSpacing: -0.6,
    },
    header2: {
        fontSize: 22,
        fontWeight: '700' as const,
        color: Colors.textPrimary,
        lineHeight: 30,
        letterSpacing: -0.4,
    },
    header3: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: Colors.textPrimary,
        lineHeight: 26,
        letterSpacing: -0.3,
    },

    // Subtitles
    subtitle1: {
        fontSize: 17,
        fontWeight: '600' as const,
        color: Colors.textPrimary,
        lineHeight: 24,
        letterSpacing: -0.2,
    },
    subtitle2: {
        fontSize: 15,
        fontWeight: '600' as const,
        color: Colors.textSecondary,
        lineHeight: 22,
        letterSpacing: -0.1,
    },

    // Body text
    body1: {
        fontSize: 16,
        fontWeight: '400' as const,
        color: Colors.textPrimary,
        lineHeight: 24,
        letterSpacing: -0.1,
    },
    body2: {
        fontSize: 14,
        fontWeight: '400' as const,
        color: Colors.textSecondary,
        lineHeight: 21,
    },

    // Small text
    caption: {
        fontSize: 12,
        fontWeight: '500' as const,
        color: Colors.textTertiary,
        lineHeight: 16,
        letterSpacing: 0.1,
    },
    overline: {
        fontSize: 11,
        fontWeight: '600' as const,
        color: Colors.textTertiary,
        lineHeight: 14,
        letterSpacing: 0.8,
        textTransform: 'uppercase' as const,
    },

    // UI Elements
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
        color: Colors.textSecondary,
        lineHeight: 18,
    },

    // Numbers (for stats)
    number: {
        fontSize: 32,
        fontWeight: '700' as const,
        color: Colors.textPrimary,
        lineHeight: 40,
        letterSpacing: -1,
        fontVariant: ['tabular-nums'] as const,
    },
    numberSmall: {
        fontSize: 24,
        fontWeight: '700' as const,
        color: Colors.textPrimary,
        lineHeight: 32,
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums'] as const,
    },
};

// Animation configurations
export const Animation = {
    // Timing
    duration: {
        fast: 150,
        normal: 250,
        slow: 400,
        page: 350,
    },

    // Spring configs (for react-native-reanimated or Animated)
    spring: {
        gentle: {
            damping: 15,
            stiffness: 120,
        },
        bouncy: {
            damping: 10,
            stiffness: 180,
        },
        stiff: {
            damping: 20,
            stiffness: 300,
        },
    },

    // Easing curves
    easing: {
        easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
        easeIn: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
        easeInOut: 'cubic-bezier(0.87, 0, 0.13, 1)',
        bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
};

// Icon sizes
export const IconSize = {
    xs: 14,
    sm: 18,
    md: 22,
    lg: 28,
    xl: 36,
    xxl: 48,
};

// ============================================
// LEGACY SUPPORT (for backwards compatibility)
// ============================================
export const COLORS = Colors;
export const SPACING = Spacing;
export const FONTS = {
    sizes: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 22,
        title: 28,
    }
};
export const SHADOWS = {
    card: Layout.shadow.default
};
