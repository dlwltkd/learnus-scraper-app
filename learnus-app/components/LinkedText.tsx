import React, { useMemo } from 'react';
import { Linking, Text, TextStyle, StyleProp } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * Text with URLs, emails and phone numbers made tappable.
 *
 * Course announcements are full of things a student needs to act on — an Overleaf
 * template, a datacenter address to email, a form to submit. Rendered as flat text they
 * have to be retyped by hand, which is exactly the friction the app exists to remove.
 *
 * Detection is deliberately conservative: it matches complete, unambiguous tokens and
 * leaves everything else as plain text, because a wrong link is worse than no link.
 */

// Trailing punctuation is excluded from the match so "see https://x.com." doesn't
// produce a dead link ending in a full stop.
const PATTERN = /((?:https?:\/\/|www\.)[^\s<>()[\]]+[^\s<>()[\].,;:!?'"]|[\w.+-]+@[\w-]+\.[\w.-]+|(?:\+?\d{1,3}[-\s]?)?\d{2,4}-\d{3,4}-\d{4})/g;

function hrefFor(token: string): string {
    if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(token)) return `mailto:${token}`;
    if (/^[\d+][\d\s-]+$/.test(token)) return `tel:${token.replace(/[\s-]/g, '')}`;
    if (/^www\./i.test(token)) return `https://${token}`;
    return token;
}

interface LinkedTextProps {
    children?: string | null;
    style?: StyleProp<TextStyle>;
    linkStyle?: StyleProp<TextStyle>;
    selectable?: boolean;
    numberOfLines?: number;
}

export default function LinkedText({
    children,
    style,
    linkStyle,
    selectable,
    numberOfLines,
}: LinkedTextProps) {
    const { colors } = useTheme();
    const text = children || '';

    const parts = useMemo(() => {
        const out: { text: string; link: boolean }[] = [];
        let lastIndex = 0;
        // The regex is global, so reset before each run — a shared lastIndex across
        // renders would silently skip matches on every other call.
        PATTERN.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = PATTERN.exec(text)) !== null) {
            if (match.index > lastIndex) {
                out.push({ text: text.slice(lastIndex, match.index), link: false });
            }
            out.push({ text: match[0], link: true });
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) out.push({ text: text.slice(lastIndex), link: false });
        return out;
    }, [text]);

    if (parts.length <= 1) {
        return <Text style={style} selectable={selectable} numberOfLines={numberOfLines}>{text}</Text>;
    }

    return (
        <Text style={style} selectable={selectable} numberOfLines={numberOfLines}>
            {parts.map((part, index) =>
                part.link ? (
                    <Text
                        key={index}
                        style={[{ color: colors.primary, textDecorationLine: 'underline' }, linkStyle]}
                        onPress={() => Linking.openURL(hrefFor(part.text)).catch(() => {})}
                    >
                        {part.text}
                    </Text>
                ) : (
                    <Text key={index}>{part.text}</Text>
                ),
            )}
        </Text>
    );
}
