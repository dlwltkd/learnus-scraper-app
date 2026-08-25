import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from './constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from './constants/theme';
import { useTheme } from './context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

type Styles = ReturnType<typeof createStyles>;

const SectionHeader = ({ title, styles }: { title: string; styles: Styles }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
);

const PolicySection = ({ title, children, styles }: { title: string; children: React.ReactNode; styles: Styles }) => (
    <View style={styles.policySection}>
        <Text style={styles.policyTitle}>{title}</Text>
        {children}
    </View>
);

const BulletPoint = ({ text, boldTitle, styles, colors }: { text: string; boldTitle?: string; styles: Styles; colors: ColorScheme }) => (
    <View style={styles.bulletItem}>
        <View style={styles.bullet} />
        <Text style={styles.bulletText}>
            {boldTitle && <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{boldTitle}: </Text>}
            {text}
        </Text>
    </View>
);

export default function TermsOfServiceScreen() {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const [language, setLanguage] = useState<'ko' | 'en'>('ko');

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Header */}
                <View style={styles.hero}>
                    <View style={styles.iconBadge}>
                        <Ionicons name="document-text" size={36} color="white" />
                    </View>
                    <Text style={styles.headerTitle}>
                        {language === 'ko' ? '이용약관' : 'Terms of Service'}
                    </Text>
                    <Text style={styles.lastUpdated}>Last updated: 2026-08-25</Text>
                </View>

                {/* Language Toggle */}
                <View style={styles.languageToggle}>
                    <TouchableOpacity
                        style={[styles.langButton, language === 'ko' && styles.langButtonActive]}
                        onPress={() => setLanguage('ko')}
                    >
                        <Text style={[styles.langText, language === 'ko' && styles.langTextActive]}>한국어</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.langButton, language === 'en' && styles.langButtonActive]}
                        onPress={() => setLanguage('en')}
                    >
                        <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>English</Text>
                    </TouchableOpacity>
                </View>

                {language === 'ko' ? (
                    <>
                        {/* Korean Content */}
                        <View style={styles.introBox}>
                            <Text style={styles.introText}>
                                LearnUs Connect(이하 "서비스")를 이용해 주셔서 감사합니다. 본 약관은 모바일 앱,
                                웹 서비스와 LearnUs Connect 브라우저 확장 프로그램에 적용됩니다. 서비스를
                                이용하면 본 약관에 동의한 것으로 봅니다.
                            </Text>
                        </View>

                        <SectionHeader title="서비스 목적" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="1. 서비스의 목적 및 성격" styles={styles}>
                                <Text style={styles.policyText}>
                                    본 서비스는 연세대학교의 공식 서비스가 아닌 독립적인 서드파티 유틸리티입니다.
                                    LearnUs의 공지, 과제와 강의 콘텐츠를 동기화하고 사용자가 선택한 알림·AI
                                    기능을 제공합니다.
                                </Text>
                            </PolicySection>
                        </View>

                        <SectionHeader title="계정 관리" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="2. 계정 및 개인정보 관리 (Accounts & Privacy)" styles={styles}>
                                <BulletPoint
                                    boldTitle="LearnUs 인증"
                                    text="사용자는 연세대학교의 정상 SSO 화면에서 로그인합니다. 서비스는 로그인 후 생성된 LearnUs 세션 쿠키를 서버로 전송해 사용자를 확인하고 데이터를 동기화하며, 연세포털 비밀번호는 저장하지 않습니다."
                                    styles={styles}
                                    colors={colors}
                                />
                                <BulletPoint
                                    boldTitle="브라우저 확장 프로그램"
                                    text="사용자가 연결 버튼을 누른 경우에만 ys.learnus.org용 쿠키를 LearnUs Connect 서버로 전송합니다. 비밀번호를 읽거나 쿠키를 확장 저장소에 보관하지 않습니다."
                                    styles={styles}
                                    colors={colors}
                                />
                                <BulletPoint
                                    boldTitle="서비스 데이터"
                                    text="인증 세션, 동기화된 학습 정보와 사용자가 요청한 결과는 서버에 보관될 수 있습니다. 자세한 처리 범위와 삭제 방법은 개인정보처리방침을 따릅니다."
                                    styles={styles}
                                    colors={colors}
                                />
                                <BulletPoint
                                    boldTitle="보안 책임"
                                    text="사용자는 자신의 기기와 브라우저 세션을 보호하고 공유 기기에서는 사용 후 로그아웃해야 합니다."
                                    styles={styles}
                                    colors={colors}
                                />
                            </PolicySection>
                        </View>

                        <SectionHeader title="서비스 운영" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="3. 서비스의 제공 및 변경" styles={styles}>
                                <BulletPoint
                                    boldTitle="데이터 정확성"
                                    text="본 서비스는 스크래핑(Scraping) 기술을 사용하여 데이터를 가져오므로, LearnUs 웹사이트의 구조 변경이나 시스템 점검 등으로 인해 데이터가 정확하지 않거나 업데이트가 지연될 수 있습니다."
                                    styles={styles}
                                    colors={colors}
                                />
                                <BulletPoint
                                    boldTitle="서비스 중단"
                                    text="학교 측의 요청이나 운영상의 이유로 사전 고지 없이 서비스가 중단되거나 기능이 변경될 수 있습니다."
                                    styles={styles}
                                    colors={colors}
                                />
                            </PolicySection>
                        </View>

                        <SectionHeader title="면책 조항" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="4. 책임의 한계 (Disclaimers)" styles={styles}>
                                <BulletPoint
                                    boldTitle="면책 조항"
                                    text="법령이 허용하는 범위에서 서비스 운영자는 데이터 오류나 지연 등으로 발생한 간접 손해를 책임지지 않습니다. 중요한 학사 일정은 학교 공식 웹사이트나 공식 앱에서 반드시 확인해야 합니다."
                                    styles={styles}
                                    colors={colors}
                                />
                                <BulletPoint
                                    boldTitle='"AS IS" 제공'
                                    text='본 서비스는 "있는 그대로" 제공되며, 특정 목적에 대한 적합성이나 무결성을 보증하지 않습니다.'
                                    styles={styles}
                                    colors={colors}
                                />
                            </PolicySection>
                        </View>

                        <SectionHeader title="기타" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="5. 준거법" styles={styles}>
                                <Text style={styles.policyText}>
                                    본 약관은 대한민국 법률에 따라 해석되고 규율됩니다.
                                </Text>
                            </PolicySection>
                        </View>
                    </>
                ) : (
                    <>
                        {/* English Content */}
                        <View style={styles.introBox}>
                            <Text style={styles.introText}>
                                These Terms apply to the LearnUs Connect mobile app, web service, and browser
                                extension (the "Service"). By using the Service, you agree to them.
                            </Text>
                        </View>

                        <SectionHeader title="Nature of Service" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="1. Nature of Service" styles={styles}>
                                <Text style={styles.policyText}>
                                    The Service is an independent third-party utility and is not an official Yonsei
                                    University service. It synchronizes LearnUs announcements, assignments, and lecture
                                    content and provides optional notification and AI features.
                                </Text>
                            </PolicySection>
                        </View>

                        <SectionHeader title="Accounts & Privacy" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="2. Accounts & Privacy" styles={styles}>
                                <BulletPoint
                                    boldTitle="LearnUs Authentication"
                                    text="You sign in through Yonsei University's normal SSO pages. The Service sends the resulting LearnUs session cookies to its server to verify your identity and synchronize data. It does not store your Yonsei Portal password."
                                    styles={styles}
                                    colors={colors}
                                />
                                <BulletPoint
                                    boldTitle="Browser Extension"
                                    text="The extension sends cookies applicable to ys.learnus.org only after you select Connect. It does not read your password or retain cookies in extension storage."
                                    styles={styles}
                                    colors={colors}
                                />
                                <BulletPoint
                                    boldTitle="Service Data"
                                    text="Authentication sessions, synchronized learning information, and requested results may be stored on the server. The Privacy Policy explains processing and deletion requests."
                                    styles={styles}
                                    colors={colors}
                                />
                                <BulletPoint
                                    boldTitle="Security"
                                    text="You are responsible for protecting your devices and browser sessions and should sign out after using a shared device."
                                    styles={styles}
                                    colors={colors}
                                />
                            </PolicySection>
                        </View>

                        <SectionHeader title="Service Operation" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="3. Service Operation" styles={styles}>
                                <BulletPoint
                                    boldTitle="Data Accuracy"
                                    text="As the Service relies on web scraping, data may be inaccurate or delayed due to changes in the LearnUs website structure or system maintenance."
                                    styles={styles}
                                    colors={colors}
                                />
                                <BulletPoint
                                    boldTitle="Service Availability"
                                    text="The service may be suspended or modified without prior notice due to requests from the university or operational reasons."
                                    styles={styles}
                                    colors={colors}
                                />
                            </PolicySection>
                        </View>

                        <SectionHeader title="Disclaimers" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="4. Disclaimers" styles={styles}>
                                <BulletPoint
                                    boldTitle="Limitation of Liability"
                                    text="To the extent permitted by law, the operator is not responsible for indirect loss caused by data errors, delays, or Service use. Always verify important academic schedules through an official university service."
                                    styles={styles}
                                    colors={colors}
                                />
                                <BulletPoint
                                    boldTitle='"AS IS" Basis'
                                    text='The service is provided "AS IS" without declared or implied warranties of any kind.'
                                    styles={styles}
                                    colors={colors}
                                />
                            </PolicySection>
                        </View>

                        <SectionHeader title="Governing Law" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="5. Governing Law" styles={styles}>
                                <Text style={styles.policyText}>
                                    These terms shall be governed by and construed in accordance with the laws of the Republic of Korea.
                                </Text>
                            </PolicySection>
                        </View>
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
    iconBadge: {
        width: 72,
        height: 72,
        borderRadius: 20,
        backgroundColor: colors.secondary, // Using secondary color (Blue/Teal usually) for TOS
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.m,
        shadowColor: colors.secondary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 4,
        letterSpacing: -0.5,
    },
    lastUpdated: {
        fontSize: 13,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    languageToggle: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 4,
        marginBottom: Spacing.l,
        borderWidth: 1,
        borderColor: colors.border,
    },
    langButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    langButtonActive: {
        backgroundColor: colors.secondary, // Match icon badge
    },
    langText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    langTextActive: {
        color: 'white',
    },
    introBox: {
        backgroundColor: colors.background, // Slightly different than primaryLighter
        borderRadius: 12,
        padding: Spacing.m,
        marginBottom: Spacing.m,
        borderLeftWidth: 4,
        borderLeftColor: colors.secondary,
        borderWidth: 1,
        borderColor: colors.border,
    },
    introText: {
        fontSize: 14,
        lineHeight: 22,
        color: colors.textPrimary,
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: Spacing.s,
        marginLeft: Spacing.xs,
        marginTop: Spacing.m,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    group: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.02)',
        ...layout.shadow.sm,
    },
    policySection: {
        padding: Spacing.m,
    },
    policyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: Spacing.s,
    },
    policyText: {
        fontSize: 14,
        lineHeight: 22,
        color: colors.textSecondary,
        marginBottom: Spacing.s,
    },
    bulletItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 6,
        paddingLeft: Spacing.xs,
    },
    bullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.secondary,
        marginTop: 7,
        marginRight: 10,
    },
    bulletText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        color: colors.textSecondary,
    },
});
