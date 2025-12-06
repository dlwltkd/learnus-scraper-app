export const Colors = {
    // Backgrounds
    background: '#F9FAFB', // --background: oklch(0.98 0.002 264)
    surface: '#FFFFFF',    // --card: oklch(1 0 0)
    surfaceHighlight: '#F2F4F6', // --secondary: oklch(0.96 0.005 264)

    // Text
    textPrimary: '#191F28',   // --foreground: oklch(0.15 0.01 264)
    textSecondary: '#6B7684', // --muted-foreground: oklch(0.5 0.02 264)
    textTertiary: '#B0B8C1',  // Lighter grey for placeholders
    textLight: '#B0B8C1',     // Legacy support
    text: '#191F28',          // Legacy support

    // Borders
    border: '#E5E8EB',        // --border: oklch(0.92 0.005 264)
    secondary: '#F2F4F6',     // Legacy support

    // Brand
    primary: '#3182F6',       // --primary: oklch(0.55 0.18 250)
    primaryForeground: '#FFFFFF', // --primary-foreground: oklch(1 0 0)
    primaryPressed: '#1B64DA',

    accent: '#3182F6',        // --accent: oklch(0.94 0.03 250) (Using primary for accent for now as background accent is usually handled via opacity)
    accentForeground: '#3182F6',

    // Functional
    error: '#E54646',         // --destructive: oklch(0.55 0.22 25)
    destructive: '#E54646',
    destructiveForeground: '#FFFFFF',
    success: '#3182F6',
    divider: '#E5E8EB',
    input: '#E5E8EB',         // --input: oklch(0.92 0.005 264)
    ring: '#3182F6',          // --ring: oklch(0.55 0.18 250)

    // Charts (Approximated from oklch)
    chart1: '#E86B35',
    chart2: '#2EB8B8',
    chart3: '#2D384D',
    chart4: '#F2C94C',
    chart5: '#F2994A',

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.4)',
};

export const Spacing = {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
    // Legacy support
    sm: 8,
    md: 16,
    lg: 24,
};

export const Layout = {
    borderRadius: {
        s: 8,   // --radius-sm
        m: 12,  // --radius-md
        l: 16,  // --radius
        xl: 24, // --radius-xl
    },
    shadow: {
        // Soft, subtle shadow matching the clean aesthetic
        default: {
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.05,
            shadowRadius: 10,
            elevation: 2,
        },
        sm: {
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 1,
            },
            shadowOpacity: 0.03,
            shadowRadius: 4,
            elevation: 1,
        }
    },
};

export const Typography = {
    header1: {
        fontSize: 26,
        fontWeight: '700' as '700',
        color: Colors.textPrimary,
        lineHeight: 36,
        letterSpacing: -0.5,
    },
    header2: {
        fontSize: 22,
        fontWeight: '700' as '700',
        color: Colors.textPrimary,
        lineHeight: 30,
        letterSpacing: -0.4,
    },
    subtitle1: {
        fontSize: 18,
        fontWeight: '600' as '600',
        color: Colors.textPrimary,
        lineHeight: 26,
        letterSpacing: -0.3,
    },
    body1: {
        fontSize: 16,
        fontWeight: '400' as '400',
        color: Colors.textPrimary,
        lineHeight: 24,
        letterSpacing: -0.2,
    },
    body2: {
        fontSize: 14,
        fontWeight: '400' as '400',
        color: Colors.textSecondary,
        lineHeight: 20,
        letterSpacing: -0.1,
    },
    caption: {
        fontSize: 12,
        fontWeight: '400' as '400',
        color: Colors.textSecondary,
        lineHeight: 16,
    },
};

// Legacy Support for existing files
export const COLORS = Colors;
export const SPACING = Spacing;
export const FONTS = {
    sizes: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        title: 24,
    }
};
export const SHADOWS = {
    card: Layout.shadow.default
};
