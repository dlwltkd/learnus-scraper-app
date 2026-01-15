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

const BulletPoint = ({ text }: { text: string }) => (
    <View style={styles.bulletItem}>
        <View style={styles.bullet} />
        <Text style={styles.bulletText}>{text}</Text>
    </View>
);

export default function PrivacyPolicyScreen() {
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
                    <Text style={styles.lastUpdated}>Last updated: 2026-01-15</Text>
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
                                "LearnUs Connect" (이하 "앱")은 사용자의 개인정보를 중요시하며,
                                '정보통신망 이용촉진 및 정보보호 등에 관한 법률' 등 관련 법령을 준수하고 있습니다.
                                본 개인정보처리방침은 회사가 사용자의 개인정보를 어떻게 수집, 이용, 보호하는지에 대해 설명합니다.
                            </Text>
                        </View>

                        <SectionHeader title="수집하는 개인정보" />
                        <View style={styles.group}>
                            <PolicySection title="1. 수집하는 개인정보 항목 및 수집 방법">
                                <Text style={styles.policyText}>
                                    본 앱은 회원가입이나 별도의 계정 생성을 요구하지 않으며, 서비스 제공을 위해 최소한의 기기 정보를 수집할 수 있습니다.
                                </Text>
                                <Text style={styles.subTitle}>수집 항목:</Text>
                                <BulletPoint text="기기 식별자(Device ID)" />
                                <BulletPoint text="운영체제 버전" />
                                <BulletPoint text="앱 이용 기록" />
                                <BulletPoint text="기기 모델명" />
                                <Text style={styles.subTitle}>수집 목적:</Text>
                                <BulletPoint text="앱의 기본 기능 제공" />
                                <BulletPoint text="푸시 알림 발송" />
                                <BulletPoint text="오류 분석 및 서비스 개선" />
                            </PolicySection>
                        </View>

                        <SectionHeader title="개인정보 이용" />
                        <View style={styles.group}>
                            <PolicySection title="2. 개인정보의 수집 및 이용 목적">
                                <Text style={styles.policyText}>수집한 정보는 다음의 목적을 위해서만 이용됩니다.</Text>
                                <BulletPoint text="서비스 제공: 콘텐츠(게시물, 강의 등) 업데이트 알림 제공" />
                                <BulletPoint text="앱 관리: 백그라운드 데이터 동기화(Background Fetch) 및 알림(Notifications) 기능 등 앱의 안정적인 구동 지원" />
                            </PolicySection>
                        </View>

                        <SectionHeader title="제3자 제공" />
                        <View style={styles.group}>
                            <PolicySection title="3. 개인정보의 제3자 제공">
                                <Text style={styles.policyText}>
                                    본 앱은 사용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 단, 법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우는 예외로 합니다.
                                </Text>
                            </PolicySection>
                        </View>

                        <SectionHeader title="아동 개인정보보호" />
                        <View style={styles.group}>
                            <PolicySection title="4. 아동의 개인정보보호">
                                <Text style={styles.policyText}>본 앱은 만 13세 미만 아동을 포함한 모든 연령층이 사용할 수 있습니다.</Text>
                                <BulletPoint text="당사는 만 13세 미만 아동의 개인정보를 고의로 수집하지 않습니다." />
                                <BulletPoint text="앱 사용 과정에서 민감한 개인정보(이름, 주소, 전화번호 등)를 요구하거나 수집하지 않습니다." />
                                <BulletPoint text="만약 아동의 부모나 법정대리인이 당사가 부지불식간에 아동의 개인정보를 수집했음을 알게 된 경우, 아래 연락처로 문의 주시면 즉시 해당 정보를 삭제하는 등 필요한 조치를 취하겠습니다." />
                            </PolicySection>
                        </View>

                        <SectionHeader title="개인정보 파기" />
                        <View style={styles.group}>
                            <PolicySection title="5. 개인정보의 파기 절차 및 방법">
                                <Text style={styles.policyText}>
                                    사용자의 개인정보는 원칙적으로 개인정보의 수집 및 이용목적이 달성되면 지체 없이 파기합니다. 앱을 삭제하거나 데이터를 지우는 경우 기기에 저장된 관련 데이터도 함께 삭제됩니다.
                                </Text>
                            </PolicySection>
                        </View>

                        <SectionHeader title="문의" />
                        <View style={styles.group}>
                            <PolicySection title="6. 문의사항">
                                <Text style={styles.policyText}>개인정보 보호와 관련하여 문의사항이 있으시면 아래로 연락 주시기 바랍니다.</Text>
                                <View style={styles.contactBox}>
                                    <View style={styles.contactRow}>
                                        <Ionicons name="mail-outline" size={18} color={Colors.primary} />
                                        <Text style={styles.contactText}>dlwltkd@yonsei.ac.kr</Text>
                                    </View>
                                    <View style={styles.contactRow}>
                                        <Ionicons name="person-outline" size={18} color={Colors.primary} />
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
                                "LearnUs Connect" (hereinafter referred to as the "App") values your privacy and complies with applicable laws and regulations. This Privacy Policy explains how we collect, use, and protect your information.
                            </Text>
                        </View>

                        <SectionHeader title="Information Collection" />
                        <View style={styles.group}>
                            <PolicySection title="1. Information We Collect">
                                <Text style={styles.policyText}>
                                    This App does not require user registration or account creation. We may collect minimal device information to provide services.
                                </Text>
                                <Text style={styles.subTitle}>Collected Items:</Text>
                                <BulletPoint text="Device ID" />
                                <BulletPoint text="OS version" />
                                <BulletPoint text="App usage logs" />
                                <BulletPoint text="Device model" />
                                <Text style={styles.subTitle}>Purpose:</Text>
                                <BulletPoint text="To provide basic app features" />
                                <BulletPoint text="Send push notifications" />
                                <BulletPoint text="Analyze errors and improve service" />
                            </PolicySection>
                        </View>

                        <SectionHeader title="Information Usage" />
                        <View style={styles.group}>
                            <PolicySection title="2. Purpose of Collection and Use">
                                <Text style={styles.policyText}>The collected information is used solely for the following purposes:</Text>
                                <BulletPoint text="Service Provision: Determining when to send notifications for new content (posts, lectures, etc.)" />
                                <BulletPoint text="App Management: Supporting stable app operation including Background Fetch and Notifications features" />
                            </PolicySection>
                        </View>

                        <SectionHeader title="Third-Party Disclosure" />
                        <View style={styles.group}>
                            <PolicySection title="3. Third-Party Disclosure">
                                <Text style={styles.policyText}>
                                    We do not share your personal information with third parties, except as required by law or legal process.
                                </Text>
                            </PolicySection>
                        </View>

                        <SectionHeader title="Children's Privacy" />
                        <View style={styles.group}>
                            <PolicySection title="4. Children's Privacy">
                                <Text style={styles.policyText}>This App is available for users of all ages, including children under the age of 13.</Text>
                                <BulletPoint text="We do not knowingly collect personal information from children under 13." />
                                <BulletPoint text="We do not request or collect sensitive personal information (name, address, phone number, etc.) during the use of the App." />
                                <BulletPoint text="If a parent or guardian becomes aware that we have inadvertently collected personal information from a child, please contact us immediately, and we will take necessary actions such as deleting the information." />
                            </PolicySection>
                        </View>

                        <SectionHeader title="Data Retention" />
                        <View style={styles.group}>
                            <PolicySection title="5. Data Retention and Deletion">
                                <Text style={styles.policyText}>
                                    In principle, user information is destroyed without delay once the purpose of collection and use is achieved. Uninstalling the app effectively removes local data associated with it on your device.
                                </Text>
                            </PolicySection>
                        </View>

                        <SectionHeader title="Contact" />
                        <View style={styles.group}>
                            <PolicySection title="6. Contact Us">
                                <Text style={styles.policyText}>If you have any questions regarding privacy, please contact us at:</Text>
                                <View style={styles.contactBox}>
                                    <View style={styles.contactRow}>
                                        <Ionicons name="mail-outline" size={18} color={Colors.primary} />
                                        <Text style={styles.contactText}>dlwltkd@yonsei.ac.kr</Text>
                                    </View>
                                    <View style={styles.contactRow}>
                                        <Ionicons name="person-outline" size={18} color={Colors.primary} />
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
        backgroundColor: Colors.primary,
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
        backgroundColor: Colors.primaryLighter,
        borderRadius: 12,
        padding: Spacing.m,
        marginBottom: Spacing.m,
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
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
    subTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textPrimary,
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
        backgroundColor: Colors.primary,
        marginTop: 7,
        marginRight: 10,
    },
    bulletText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        color: Colors.textSecondary,
    },
    contactBox: {
        backgroundColor: Colors.surfaceHighlight,
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
        color: Colors.textPrimary,
        fontWeight: '500',
    },
});
