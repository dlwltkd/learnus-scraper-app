import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Layout, Typography } from '../constants/theme';

interface VodActionSheetProps {
    item: any;
    onWatch: () => void;
    onTranscribe: () => void;
    onAutoWatch: () => void;
    onClose: () => void;
    tourRef?: React.RefObject<any>;
    tourActive?: boolean;
}

export default function VodActionSheet({ item, onWatch, onTranscribe, onAutoWatch, onClose, tourRef, tourActive }: VodActionSheetProps) {
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const slideY = useRef(new Animated.Value(300)).current;
    const insets = useSafeAreaInsets();

    useEffect(() => {
        Animated.parallel([
            Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(slideY, { toValue: 0, damping: 22, stiffness: 220, useNativeDriver: true }),
        ]).start();
    }, []);

    const dismiss = useCallback(() => {
        Animated.parallel([
            Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(slideY, { toValue: 300, duration: 200, useNativeDriver: true }),
        ]).start(() => onClose());
    }, [onClose]);

    const sheetContent = (
        <Animated.View ref={tourRef} collapsable={false} style={[styles.sheet, { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + Spacing.m }]}>
            <View style={styles.handle} />
            <Text style={styles.vodTitle} numberOfLines={2}>{item.title}</Text>
            {item.course_name && (
                <Text style={styles.vodCourse} numberOfLines={1}>{item.course_name}</Text>
            )}
            <View style={styles.divider} />
            <TouchableOpacity style={styles.action} onPress={onWatch} activeOpacity={0.7}>
                <View style={[styles.actionIcon, { backgroundColor: Colors.primaryLighter }]}>
                    <Ionicons name="play-circle" size={22} color={Colors.primary} />
                </View>
                <View style={styles.actionText}>
                    <Text style={styles.actionLabel}>강의 시청</Text>
                    <Text style={styles.actionSub}>브라우저에서 열기</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={onTranscribe} activeOpacity={0.7}>
                <View style={[styles.actionIcon, { backgroundColor: Colors.primaryLighter }]}>
                    <Ionicons name="text" size={22} color={Colors.primary} />
                </View>
                <View style={styles.actionText}>
                    <Text style={styles.actionLabel}>텍스트 추출</Text>
                    <Text style={styles.actionSub}>AI로 강의 내용 변환</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.action, item.is_completed && styles.actionDisabled]} onPress={onAutoWatch} activeOpacity={0.7}>
                <View style={[styles.actionIcon, { backgroundColor: item.is_completed ? Colors.surfaceAlt : Colors.successLight }]}>
                    <Ionicons name="checkmark-circle-outline" size={22} color={item.is_completed ? Colors.textTertiary : Colors.success} />
                </View>
                <View style={styles.actionText}>
                    <Text style={[styles.actionLabel, item.is_completed && { color: Colors.textTertiary }]}>자동 시청</Text>
                    <Text style={styles.actionSub}>{item.is_completed ? '이미 시청 완료된 강의예요' : '백그라운드에서 자동으로 시청'}</Text>
                </View>
                {!item.is_completed && <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={dismiss} activeOpacity={0.7}>
                <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
        </Animated.View>
    );

    // During tour: render without Modal so tour overlay can appear on top
    if (tourActive) {
        return (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="auto">
                    <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={dismiss} />
                </Animated.View>
                {sheetContent}
            </View>
        );
    }

    return (
        <Modal animationType="none" transparent statusBarTranslucent onRequestClose={dismiss}>
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={dismiss} />
            </Animated.View>
            {sheetContent}
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.overlay,
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.surface,
        borderTopLeftRadius: Layout.borderRadius.xl,
        borderTopRightRadius: Layout.borderRadius.xl,
        paddingHorizontal: Spacing.l,
        paddingTop: Spacing.m,
        ...Layout.shadow.lg,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.border,
        alignSelf: 'center',
        marginBottom: Spacing.m,
    },
    vodTitle: {
        ...Typography.subtitle1,
        marginBottom: 4,
    },
    vodCourse: {
        ...Typography.caption,
        marginBottom: Spacing.m,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.divider,
        marginBottom: Spacing.m,
    },
    action: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.m,
        gap: Spacing.m,
    },
    actionDisabled: { opacity: 0.6 },
    actionIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionText: {
        flex: 1,
    },
    actionLabel: {
        ...Typography.subtitle1,
        fontSize: 15,
        marginBottom: 2,
    },
    actionSub: {
        ...Typography.caption,
    },
    cancelBtn: {
        marginTop: Spacing.s,
        paddingVertical: Spacing.m,
        alignItems: 'center',
        backgroundColor: Colors.surfaceAlt,
        borderRadius: Layout.borderRadius.l,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
});
