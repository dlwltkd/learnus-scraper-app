import React from 'react';
import {
    Linking,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';


interface LoginScreenProps {
    onLoginSuccess: (token: string) => Promise<boolean>;
    autoLogout?: boolean;
    onAutoLogoutComplete?: () => void;
}


export default function LoginScreen(_props: LoginScreenProps) {
    const { colors } = useTheme();
    const { webLoginError } = useAuth();

    const openLearnUs = () => {
        Linking.openURL('https://ys.learnus.org/login/index.php');
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>LEARNUS CONNECT</Text>
                <Text style={[styles.title, { color: colors.textPrimary }]}>웹에서 계속하기</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>
                    LearnUs는 연세 SSO 로그인을 사용해요. 브라우저 확장 프로그램에서 로그인한 LearnUs
                    세션을 직접 연결하면 이 사이트에는 별도의 안전한 세션만 저장돼요.
                </Text>

                <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                    onPress={openLearnUs}
                >
                    <Text style={styles.primaryButtonText}>LearnUs SSO 열기</Text>
                </TouchableOpacity>

                <Text style={[styles.steps, { color: colors.textSecondary }]}>
                    1. LearnUs에서 SSO 로그인을 완료하세요.{`\n`}
                    2. LearnUs Connect 확장 프로그램을 열고 “이 브라우저 연결”을 누르세요.
                </Text>

                {webLoginError && <Text style={styles.errorText}>{webLoginError}</Text>}
            </View>
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 480,
        borderWidth: 1,
        borderRadius: 24,
        padding: 32,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 12 },
    },
    eyebrow: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1.4,
        marginBottom: 12,
    },
    title: {
        fontSize: 30,
        fontWeight: '700',
        marginBottom: 14,
    },
    description: {
        fontSize: 16,
        lineHeight: 25,
        marginBottom: 24,
    },
    primaryButton: {
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        paddingHorizontal: 20,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    steps: {
        fontSize: 14,
        lineHeight: 22,
        marginTop: 22,
    },
    errorText: {
        color: '#dc2626',
        fontSize: 14,
        lineHeight: 21,
        marginTop: 16,
    },
});
