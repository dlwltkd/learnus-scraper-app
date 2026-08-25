import React from 'react';
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { Spacing } from '../constants/theme';


interface VodWebViewerProps {
    url: string;
    title: string;
    cookies: string;
    onClose: () => void;
    startAt?: number;
}


export default function VodWebViewer({ url, title, onClose, startAt }: VodWebViewerProps) {
    const { colors } = useTheme();

    return (
        <Modal transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                    <Text style={[styles.message, { color: colors.textSecondary }]}>
                        브라우저에서는 로그인된 LearnUs 탭에서 강의를 열어요.
                        {startAt ? ` ${Math.floor(startAt / 60)}분 ${startAt % 60}초 지점으로 이동해주세요.` : ''}
                    </Text>
                    <TouchableOpacity
                        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                        onPress={() => Linking.openURL(url).catch(() => {})}
                    >
                        <Text style={styles.primaryLabel}>LearnUs에서 열기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={[styles.closeLabel, { color: colors.textSecondary }]}>닫기</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}


const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.l,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    card: {
        width: '100%',
        maxWidth: 440,
        borderWidth: 1,
        borderRadius: 18,
        padding: Spacing.l,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: Spacing.s,
    },
    message: {
        fontSize: 15,
        lineHeight: 23,
        marginBottom: Spacing.l,
    },
    primaryButton: {
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    primaryLabel: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    closeButton: {
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.s,
    },
    closeLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
});
