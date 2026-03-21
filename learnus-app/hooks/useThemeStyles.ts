import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import type { ColorScheme, TypographyType, LayoutType } from '../constants/theme';
import { Spacing } from '../constants/theme';

interface ThemeArgs {
    colors: ColorScheme;
    typography: TypographyType;
    layout: LayoutType;
    spacing: typeof Spacing;
    isDark: boolean;
}

/**
 * Creates theme-aware styles that update when the theme changes.
 *
 * Usage:
 *   const createStyles = (t: ThemeArgs) => StyleSheet.create({ ... });
 *   // Inside component:
 *   const styles = useThemeStyles(createStyles);
 */
export function useThemeStyles<T>(factory: (theme: ThemeArgs) => T): T {
    const { colors, typography, layout, spacing, isDark } = useTheme();
    return useMemo(
        () => factory({ colors, typography, layout, spacing, isDark }),
        [colors, typography, layout, spacing, isDark]
    );
}
