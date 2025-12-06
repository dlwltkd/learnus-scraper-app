import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Colors, Spacing, Layout, Typography } from './constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from './context/AuthContext';

const SettingItem = ({ icon, title, onPress, isDestructive = false }: any) => (
    <TouchableOpacity style={styles.item} onPress={onPress}>
        <View style={styles.itemLeft}>
            <Ionicons name={icon} size={24} color={isDestructive ? Colors.error : Colors.textPrimary} />
            <Text style={[styles.itemTitle, isDestructive && { color: Colors.error }]}>{title}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
    </TouchableOpacity>
);

export default function SettingsScreen() {
    const navigation = useNavigation();
    const { logout } = useAuth();

    const handleLogout = () => {
        Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            {
                text: '로그아웃',
                style: 'destructive',
                onPress: () => {
                    logout();
                }
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>설정</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>계정</Text>
                <View style={styles.card}>
                    <SettingItem icon="person-outline" title="내 정보" onPress={() => { }} />
                    <View style={styles.divider} />
                    <SettingItem
                        icon="notifications-outline"
                        title="알림 설정"
                        onPress={() => (navigation as any).navigate('NotificationSettings')}
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>일반</Text>
                <View style={styles.card}>
                    <SettingItem icon="help-circle-outline" title="도움말" onPress={() => (navigation as any).navigate('Help')} />
                    <View style={styles.divider} />
                    <SettingItem icon="log-out-outline" title="로그아웃" onPress={handleLogout} isDestructive />
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        paddingHorizontal: Spacing.l,
        paddingVertical: Spacing.m,
        marginBottom: Spacing.s,
    },
    headerTitle: {
        ...Typography.header1,
        fontSize: 28,
    },
    section: {
        paddingHorizontal: Spacing.l, // Match Dashboard padding
        marginBottom: Spacing.l,
    },
    sectionTitle: {
        ...Typography.body2,
        marginLeft: Spacing.xs,
        marginBottom: Spacing.s,
    },
    card: {
        backgroundColor: Colors.surface,
        borderRadius: Layout.borderRadius.l,
        padding: Spacing.xs, // Reduced padding inside card for list items
        borderWidth: 1,
        borderColor: Colors.border,
        ...Layout.shadow.sm,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.m,
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.m,
    },
    itemTitle: {
        ...Typography.body1,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.divider,
        marginLeft: Spacing.xl + Spacing.m, // Align with text
    },
});
