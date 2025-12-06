import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Layout } from './constants/theme';
import { Ionicons } from '@expo/vector-icons';

const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
);

const InfoRow = ({ icon, label, value, isLast = false }: any) => (
    <View style={styles.row}>
        <View style={styles.rowLeft}>
            <View style={styles.iconContainer}>
                <Ionicons name={icon} size={20} color={Colors.primary} />
            </View>
            <Text style={styles.rowLabel}>{label}</Text>
        </View>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        {!isLast && <View style={styles.separator} />}
    </View>
);

const ActionRow = ({ icon, label, onPress, isDestructive = false, isLast = false }: any) => (
    <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={styles.rowLeft}>
            <View style={[styles.iconContainer, isDestructive && styles.destructiveIcon]}>
                <Ionicons
                    name={icon}
                    size={20}
                    color={isDestructive ? Colors.error : Colors.primary}
                />
            </View>
            <Text style={[styles.rowLabel, isDestructive && { color: Colors.error }]}>
                {label}
            </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        {!isLast && <View style={styles.separator} />}
    </TouchableOpacity>
);

export default function HelpScreen() {
    const handleContact = () => {
        Linking.openURL('mailto:dlwltkd@yonsei.ac.kr').catch(() => { });
    };

    const handleGithub = () => {
        Linking.openURL('https://github.com/dlwltkd/learnus-scraper-app').catch(() => { });
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Hero / Header */}
                <View style={styles.hero}>
                    <View style={styles.logoBadge}>
                        <Ionicons name="school" size={40} color="white" />
                    </View>
                    <Text style={styles.appName}>LearnUs Connect</Text>
                    <Text style={styles.version}>Version 1.0.0 (Beta)</Text>
                </View>

                {/* Service Info */}
                <SectionHeader title="서비스 소개" />
                <View style={styles.group}>
                    <View style={styles.textBox}>
                        <Text style={styles.text}>
                            LearnUs Connect는 연세대학교 학생들이 모바일 환경에서
                            학습 플랫폼을 보다 직관적이고 편리하게 이용할 수 있도록
                            제작된 비공식 학생 프로젝트입니다.
                        </Text>
                    </View>
                </View>

                {/* Disclaimer - Styled as Important Note */}
                <SectionHeader title="주의사항 (Disclaimer)" />
                <View style={styles.group}>
                    <View style={styles.textBox}>
                        <View style={styles.disclaimerItem}>
                            <Ionicons name="alert-circle" size={16} color={Colors.textSecondary} style={{ marginTop: 2 }} />
                            <Text style={styles.disclaimerText}>
                                본 서비스는 연세대학교 공식 앱이 아니며, 학교 측의 공식적인 지원을 받지 않습니다.
                            </Text>
                        </View>
                        <View style={[styles.disclaimerItem, { marginTop: 8 }]}>
                            <Ionicons name="shield-checkmark" size={16} color={Colors.textSecondary} style={{ marginTop: 2 }} />
                            <Text style={styles.disclaimerText}>
                                사용자의 비밀번호는 저장되지 않으며, 로그인 후 발급된 세션 쿠키만을 사용하여 서비스를 제공합니다.
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Links */}
                <SectionHeader title="더 보기" />
                <View style={styles.group}>
                    <ActionRow
                        icon="logo-github"
                        label="오픈소스 라이선스 확인"
                        onPress={handleGithub}
                    />
                    <ActionRow
                        icon="mail"
                        label="개발자에게 문의하기"
                        onPress={handleContact}
                        isLast
                    />
                </View>

                {/* Copyright */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Designed & Developed by Yonsei Students</Text>
                    <Text style={styles.footerCopyright}>Copyright © 2024 LearnUs Connect Team</Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F4F6',
    },
    content: {
        paddingHorizontal: Spacing.l,
        paddingBottom: Spacing.xxl,
    },
    hero: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
        marginBottom: Spacing.s,
    },
    logoBadge: {
        width: 80,
        height: 80,
        borderRadius: 22,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.m,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    appName: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 4,
        letterSpacing: -0.5,
    },
    version: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: Spacing.s,
        marginLeft: Spacing.xs,
        marginTop: Spacing.m,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    group: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.02)',
        ...Layout.shadow.sm,
    },
    textBox: {
        padding: Spacing.m,
    },
    text: {
        fontSize: 15,
        lineHeight: 24,
        color: Colors.textPrimary,
    },
    disclaimerItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    disclaimerText: {
        fontSize: 14,
        lineHeight: 20,
        color: Colors.textSecondary,
        flex: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: Colors.surface,
        position: 'relative',
    },
    separator: {
        position: 'absolute',
        bottom: 0,
        left: 52, // Indent divider to line up with text (Icon width 32 + gap 12 + extra padding)
        right: 0,
        height: 1,
        backgroundColor: Colors.border,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: Colors.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    destructiveIcon: {
        backgroundColor: '#FFF0F0',
    },
    rowLabel: {
        fontSize: 16,
        color: Colors.textPrimary,
        fontWeight: '500',
    },
    rowValue: {
        fontSize: 15,
        color: Colors.textSecondary,
    },
    footer: {
        marginTop: Spacing.xl,
        alignItems: 'center',
        paddingBottom: Spacing.l,
    },
    footerText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.textTertiary,
        marginBottom: 4,
    },
    footerCopyright: {
        fontSize: 11,
        color: Colors.textTertiary,
    },
});
