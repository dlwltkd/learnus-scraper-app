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

const BulletPoint = ({ text, styles, colors }: { text: string; styles: Styles; colors: ColorScheme }) => (
    <View style={styles.bulletItem}>
        <View style={styles.bullet} />
        <Text style={styles.bulletText}>{text}</Text>
    </View>
);

export default function PrivacyPolicyScreen() {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, typography, layout, isDark), [colors, typography, layout, isDark]);

    const [language, setLanguage] = useState<'ko' | 'en'>('ko');

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Header */}
                <View style={styles.hero}>
                    <View style={styles.iconBadge}>
                        <Ionicons name="shield-checkmark" size={36} color="white" />
                    </View>
                    <Text style={styles.headerTitle}>
                        {language === 'ko' ? '개인정보처리방침' : 'Privacy Policy'}
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
                                LearnUs Connect(이하 "서비스")는 연세대학교 LearnUs 정보를 한곳에서 확인하고
                                선택한 AI·알림 기능을 이용할 수 있도록 제공되는 독립 서비스입니다. 이 방침은
                                모바일 앱, 웹 서비스와 LearnUs Connect 브라우저 확장 프로그램에 적용됩니다.
                            </Text>
                        </View>

                        <SectionHeader title="수집하는 개인정보" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="1. 수집하는 개인정보 항목 및 수집 방법" styles={styles}>
                                <Text style={styles.policyText}>
                                    서비스는 기능 제공에 필요한 LearnUs 계정·세션 정보와 학습 정보를 서버에서 처리합니다.
                                    비밀번호는 저장하지 않습니다.
                                </Text>
                                <Text style={styles.subTitle}>수집 항목:</Text>
                                <BulletPoint text="LearnUs 사용자 ID, 내부 사용자명과 LearnUs 인증 쿠키" styles={styles} colors={colors} />
                                <BulletPoint text="강좌, 과제, 강의, 파일, 게시판, 공지, 진도와 완료 상태" styles={styles} colors={colors} />
                                <BulletPoint text="전사, 요약, AI 대화, 플래시카드, Course Brain 결과와 사용량 기록" styles={styles} colors={colors} />
                                <BulletPoint text="푸시 토큰, 기기 이름, 알림 설정·내역과 사용자가 제출한 진단 정보" styles={styles} colors={colors} />
                                <Text style={styles.subTitle}>수집 방법:</Text>
                                <BulletPoint text="모바일에서는 LearnUs WebView SSO 완료 후 세션 쿠키를 전송합니다." styles={styles} colors={colors} />
                                <BulletPoint text="확장 프로그램은 사용자가 연결 버튼을 누른 경우에만 ys.learnus.org용 쿠키를 서버로 전송하며 비밀번호를 읽거나 쿠키를 확장 저장소에 보관하지 않습니다." styles={styles} colors={colors} />
                            </PolicySection>
                        </View>

                        <SectionHeader title="개인정보 이용" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="2. 개인정보의 수집 및 이용 목적" styles={styles}>
                                <Text style={styles.policyText}>수집한 정보는 다음의 목적을 위해서만 이용됩니다.</Text>
                                <BulletPoint text="LearnUs 세션 확인, 사용자 식별과 강좌·과제·강의·공지 동기화" styles={styles} colors={colors} />
                                <BulletPoint text="사용자가 선택한 전사, 요약, 대화, 플래시카드와 Course Brain 제공" styles={styles} colors={colors} />
                                <BulletPoint text="알림 전송, 사용량 제한, 보안, 장애 진단과 서비스 운영" styles={styles} colors={colors} />
                            </PolicySection>
                        </View>

                        <SectionHeader title="제3자 제공" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="3. 개인정보의 제3자 제공" styles={styles}>
                                <Text style={styles.policyText}>
                                    기능에 따라 연세대학교 LearnUs, OpenAI(AI·전사 기능), Expo 푸시 서비스와
                                    서버 호스팅 사업자가 필요한 정보를 처리할 수 있습니다. 법령상 요구가 있는
                                    경우에도 적용되는 절차와 범위 안에서만 정보를 제공할 수 있습니다.
                                </Text>
                            </PolicySection>
                        </View>

                        <SectionHeader title="아동 개인정보보호" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="4. 아동의 개인정보보호" styles={styles}>
                                <Text style={styles.policyText}>
                                    서비스는 연세대학교 LearnUs 사용 권한이 있는 이용자를 대상으로 하며 아동을
                                    대상으로 설계되지 않았습니다. 보호자가 아동의 정보가 처리되었다고 판단하는
                                    경우 아래 연락처로 문의할 수 있습니다.
                                </Text>
                            </PolicySection>
                        </View>

                        <SectionHeader title="개인정보 파기" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="5. 개인정보의 파기 절차 및 방법" styles={styles}>
                                <Text style={styles.policyText}>
                                    LearnUs 세션, 동기화된 학습 정보와 생성 결과는 서비스 제공 및 계정 데이터
                                    삭제 요청 처리 시까지 서버에 보관될 수 있습니다. 로그인 티켓은 기본 90초 후
                                    만료되고 한 번만 사용할 수 있으며, 웹 세션은 기본 7일 후 만료됩니다. 앱이나
                                    확장 프로그램 삭제는 로컬 데이터만 제거하며 서버 데이터는 자동 삭제하지
                                    않습니다. 서버 데이터 삭제는 아래 연락처로 요청할 수 있습니다.
                                </Text>
                            </PolicySection>
                        </View>

                        <SectionHeader title="문의" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="6. 문의사항" styles={styles}>
                                <Text style={styles.policyText}>개인정보 보호와 관련하여 문의사항이 있으시면 아래로 연락 주시기 바랍니다.</Text>
                                <View style={styles.contactBox}>
                                    <View style={styles.contactRow}>
                                        <Ionicons name="mail-outline" size={18} color={colors.primary} />
                                        <Text style={styles.contactText}>dlwltkd@yonsei.ac.kr</Text>
                                    </View>
                                    <View style={styles.contactRow}>
                                        <Ionicons name="person-outline" size={18} color={colors.primary} />
                                        <Text style={styles.contactText}>개발자: 이지상</Text>
                                    </View>
                                </View>
                            </PolicySection>
                        </View>
                    </>
                ) : (
                    <>
                        {/* English Content */}
                        <View style={styles.introBox}>
                            <Text style={styles.introText}>
                                LearnUs Connect (the "Service") is an independent service for viewing Yonsei LearnUs
                                information and using optional AI and notification features. This policy applies to
                                the mobile app, web service, and LearnUs Connect browser extension.
                            </Text>
                        </View>

                        <SectionHeader title="Information Collection" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="1. Information We Collect" styles={styles}>
                                <Text style={styles.policyText}>
                                    The Service processes the LearnUs account, session, and learning data needed to
                                    provide its features. Passwords are not stored.
                                </Text>
                                <Text style={styles.subTitle}>Collected Items:</Text>
                                <BulletPoint text="LearnUs user ID, internal username, and LearnUs authentication cookies" styles={styles} colors={colors} />
                                <BulletPoint text="Courses, assignments, lectures, files, boards, announcements, progress, and completion state" styles={styles} colors={colors} />
                                <BulletPoint text="Transcripts, summaries, AI chats, flashcards, Course Brain results, and usage records" styles={styles} colors={colors} />
                                <BulletPoint text="Push token, device name, notification settings and history, and submitted diagnostics" styles={styles} colors={colors} />
                                <Text style={styles.subTitle}>Collection method:</Text>
                                <BulletPoint text="On mobile, session cookies are sent after LearnUs WebView SSO completes." styles={styles} colors={colors} />
                                <BulletPoint text="The extension sends cookies for ys.learnus.org only after the user selects Connect; it does not read passwords or retain cookies in extension storage." styles={styles} colors={colors} />
                            </PolicySection>
                        </View>

                        <SectionHeader title="Information Usage" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="2. Purpose of Collection and Use" styles={styles}>
                                <Text style={styles.policyText}>The collected information is used solely for the following purposes:</Text>
                                <BulletPoint text="Validate LearnUs sessions, identify users, and synchronize learning content" styles={styles} colors={colors} />
                                <BulletPoint text="Provide requested transcription, summary, chat, flashcard, and Course Brain features" styles={styles} colors={colors} />
                                <BulletPoint text="Deliver notifications, enforce usage limits, protect and operate the Service" styles={styles} colors={colors} />
                            </PolicySection>
                        </View>

                        <SectionHeader title="Third-Party Disclosure" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="3. Third-Party Disclosure" styles={styles}>
                                <Text style={styles.policyText}>
                                    Depending on the feature used, Yonsei LearnUs, OpenAI (AI and transcription),
                                    Expo push services, and the server hosting provider may process the information
                                    required for that feature. Disclosure required by law is limited to the applicable
                                    process and scope.
                                </Text>
                            </PolicySection>
                        </View>

                        <SectionHeader title="Children's Privacy" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="4. Children's Privacy" styles={styles}>
                                <Text style={styles.policyText}>
                                    The Service is intended for people authorized to use Yonsei LearnUs and is not
                                    designed for children. A parent or guardian who believes a child's data has been
                                    processed may contact us below.
                                </Text>
                            </PolicySection>
                        </View>

                        <SectionHeader title="Data Retention" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="5. Data Retention and Deletion" styles={styles}>
                                <Text style={styles.policyText}>
                                    LearnUs sessions, synchronized learning data, and generated results may remain on
                                    the server until an account-data deletion request is completed. Login tickets expire
                                    after 90 seconds by default and are single-use; web sessions expire after seven days
                                    by default. Removing the app or extension deletes local data only and does not delete
                                    server data. Contact us below to request server-data deletion.
                                </Text>
                            </PolicySection>
                        </View>

                        <SectionHeader title="Contact" styles={styles} />
                        <View style={styles.group}>
                            <PolicySection title="6. Contact Us" styles={styles}>
                                <Text style={styles.policyText}>If you have any questions regarding privacy, please contact us at:</Text>
                                <View style={styles.contactBox}>
                                    <View style={styles.contactRow}>
                                        <Ionicons name="mail-outline" size={18} color={colors.primary} />
                                        <Text style={styles.contactText}>dlwltkd@yonsei.ac.kr</Text>
                                    </View>
                                    <View style={styles.contactRow}>
                                        <Ionicons name="person-outline" size={18} color={colors.primary} />
                                        <Text style={styles.contactText}>Developer: 이지상</Text>
                                    </View>
                                </View>
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
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.m,
        shadowColor: colors.primary,
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
        backgroundColor: colors.primary,
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
        backgroundColor: colors.primaryLighter,
        borderRadius: 12,
        padding: Spacing.m,
        marginBottom: Spacing.m,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
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
    subTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
        marginTop: Spacing.s,
        marginBottom: Spacing.xs,
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
        backgroundColor: colors.primary,
        marginTop: 7,
        marginRight: 10,
    },
    bulletText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        color: colors.textSecondary,
    },
    contactBox: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 10,
        padding: Spacing.m,
        marginTop: Spacing.s,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    contactText: {
        fontSize: 14,
        color: colors.textPrimary,
        fontWeight: '500',
    },
});
