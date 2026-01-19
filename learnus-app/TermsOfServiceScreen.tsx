import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Layout } from './constants/theme';
import { Ionicons } from '@expo/vector-icons';

const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
);

const PolicySection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.policySection}>
        <Text style={styles.policyTitle}>{title}</Text>
        {children}
    </View>
);

const BulletPoint = ({ text, boldTitle }: { text: string; boldTitle?: string }) => (
    <View style={styles.bulletItem}>
        <View style={styles.bullet} />
        <Text style={styles.bulletText}>
            {boldTitle && <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{boldTitle}: </Text>}
            {text}
        </Text>
    </View>
);

export default function TermsOfServiceScreen() {
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
                    <Text style={styles.lastUpdated}>Last updated: 2026-01-16</Text>
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
                                "LearnUs Connect" (이하 "앱")를 이용해 주셔서 감사합니다.
                                본 약관은 사용자가 앱을 이용함에 있어 필요한 권리, 의무 및 책임사항을 규정합니다.
                                앱을 설치하고 이용함으로써 귀하는 본 약관에 동의하게 됩니다.
                            </Text>
                        </View>

                        <SectionHeader title="서비스 목적" />
                        <View style={styles.group}>
                            <PolicySection title="1. 서비스의 목적 및 성격">
                                <Text style={styles.policyText}>
                                    본 앱은 연세대학교의 공식 앱이 아니며, 학생들이 학교 'LearnUs' 시스템의 공지사항, 과제, 강의 콘텐츠 등을 모바일에서 편리하게 확인할 수 있도록 돕기 위해 개발된 서드파티 유틸리티 앱입니다.
                                </Text>
                            </PolicySection>
                        </View>

                        <SectionHeader title="계정 관리" />
                        <View style={styles.group}>
                            <PolicySection title="2. 계정 및 개인정보 관리 (Accounts & Privacy)">
                                <BulletPoint
                                    boldTitle="로그인 정보"
                                    text="본 앱은 사용자의 연세포털 ID와 비밀번호를 이용하여 LearnUs 시스템에서 데이터를 가져옵니다. 계정 정보는 사용자의 기기(로컬 스토리지)에만 암호화되어 저장되며, 개발자나 외부 서버로 전송되지 않습니다."
                                />
                                <BulletPoint
                                    boldTitle="기기 보안 책임"
                                    text="기기 분실이나 타인의 기기 사용으로 인한 정보 유출에 대한 책임은 전적으로 사용자에게 있습니다."
                                />
                            </PolicySection>
                        </View>

                        <SectionHeader title="서비스 운영" />
                        <View style={styles.group}>
                            <PolicySection title="3. 서비스의 제공 및 변경">
                                <BulletPoint
                                    boldTitle="데이터 정확성"
                                    text="본 앱은 스크래핑(Scraping) 기술을 사용하여 데이터를 가져오므로, LearnUs 웹사이트의 구조 변경이나 시스템 점검 등으로 인해 데이터가 정확하지 않거나 업데이트가 지연될 수 있습니다."
                                />
                                <BulletPoint
                                    boldTitle="서비스 중단"
                                    text="학교 측의 요청이나 운영상의 이유로 사전 고지 없이 서비스가 중단되거나 기능이 변경될 수 있습니다."
                                />
                            </PolicySection>
                        </View>

                        <SectionHeader title="면책 조항" />
                        <View style={styles.group}>
                            <PolicySection title="4. 책임의 한계 (Disclaimers)">
                                <BulletPoint
                                    boldTitle="면책 조항"
                                    text="개발자는 본 앱의 사용으로 인해 발생하는 어떠한 손해(과제 제출 기한 놓침, 데이터 오류 등)에 대해서도 법적 책임을 지지 않습니다. 중요한 학사 일정은 반드시 학교 공식 웹사이트나 공식 앱을 통해 교차 확인하시기 바랍니다."
                                />
                                <BulletPoint
                                    boldTitle='"AS IS" 제공'
                                    text='본 서비스는 "있는 그대로" 제공되며, 특정 목적에 대한 적합성이나 무결성을 보증하지 않습니다.'
                                />
                            </PolicySection>
                        </View>

                        <SectionHeader title="기타" />
                        <View style={styles.group}>
                            <PolicySection title="5. 준거법">
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
                                "LearnUs Connect" (hereinafter referred to as the "App").
                                By downloading or using the App, you agree to these Terms of Service.
                            </Text>
                        </View>

                        <SectionHeader title="Nature of Service" />
                        <View style={styles.group}>
                            <PolicySection title="1. Nature of Service">
                                <Text style={styles.policyText}>
                                    This App is NOT an official application of Yonsei University.
                                    It is a third-party utility designed to help students conveniently check announcements, assignments, and lecture contents from the 'LearnUs' system.
                                </Text>
                            </PolicySection>
                        </View>

                        <SectionHeader title="Accounts & Privacy" />
                        <View style={styles.group}>
                            <PolicySection title="2. Accounts & Privacy">
                                <BulletPoint
                                    boldTitle="Login Credentials"
                                    text="The App uses your Yonsei Portal ID and password to fetch data. Your credentials are stored encrypted locally on your device only and are NEVER transmitted to the developer or any external servers."
                                />
                                <BulletPoint
                                    boldTitle="Device Security"
                                    text="You are solely responsible for securing your device to prevent unauthorized access to your stored credentials."
                                />
                            </PolicySection>
                        </View>

                        <SectionHeader title="Service Operation" />
                        <View style={styles.group}>
                            <PolicySection title="3. Service Operation">
                                <BulletPoint
                                    boldTitle="Data Accuracy"
                                    text="As the App relies on web scraping, data may be inaccurate or delayed due to changes in the LearnUs website structure or system maintenance."
                                />
                                <BulletPoint
                                    boldTitle="Service Availability"
                                    text="The service may be suspended or modified without prior notice due to requests from the university or operational reasons."
                                />
                            </PolicySection>
                        </View>

                        <SectionHeader title="Disclaimers" />
                        <View style={styles.group}>
                            <PolicySection title="4. Disclaimers">
                                <BulletPoint
                                    boldTitle="Limitation of Liability"
                                    text="The developer is NOT responsible for any damages arising from the use of this App, including but not limited to missed assignment deadlines or data errors. Please always double-check important academic schedules on the official website."
                                />
                                <BulletPoint
                                    boldTitle='"AS IS" Basis'
                                    text='The service is provided "AS IS" without declared or implied warranties of any kind.'
                                />
                            </PolicySection>
                        </View>

                        <SectionHeader title="Governing Law" />
                        <View style={styles.group}>
                            <PolicySection title="5. Governing Law">
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
    iconBadge: {
        width: 72,
        height: 72,
        borderRadius: 20,
        backgroundColor: Colors.secondary, // Using secondary color (Blue/Teal usually) for TOS
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.m,
        shadowColor: Colors.secondary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 4,
        letterSpacing: -0.5,
    },
    lastUpdated: {
        fontSize: 13,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    languageToggle: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 4,
        marginBottom: Spacing.l,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    langButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    langButtonActive: {
        backgroundColor: Colors.secondary, // Match icon badge
    },
    langText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    langTextActive: {
        color: 'white',
    },
    introBox: {
        backgroundColor: Colors.background, // Slightly different than primaryLighter
        borderRadius: 12,
        padding: Spacing.m,
        marginBottom: Spacing.m,
        borderLeftWidth: 4,
        borderLeftColor: Colors.secondary,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    introText: {
        fontSize: 14,
        lineHeight: 22,
        color: Colors.textPrimary,
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
    policySection: {
        padding: Spacing.m,
    },
    policyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.s,
    },
    policyText: {
        fontSize: 14,
        lineHeight: 22,
        color: Colors.textSecondary,
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
        backgroundColor: Colors.secondary,
        marginTop: 7,
        marginRight: 10,
    },
    bulletText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        color: Colors.textSecondary,
    },
});
