import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Spacing } from '../constants/theme';
import type { ColorScheme, TypographyType, LayoutType } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { getCourseBrainStatus, setCourseBrain } from '../services/api';
import type { BrainScope, CourseBrainState } from '../services/api';
import { LEARNED_CONTENT } from '../constants/brainContent';

const POLL_MS = 4000;

interface Props {
    courseId: number;
    /** Lets the parent show or hide the chat entry as the build finishes. */
    onStateChange?: (state: CourseBrainState) => void;
}

/**
 * The switch that decides whether a course gets learned.
 *
 * Turning it on starts a sweep that transcribes every lecture and reads every file, so
 * the row says what that involves before the tap rather than after it. While a build
 * runs the row becomes its own progress display and polls; it stops polling the moment
 * the build settles, so an idle screen makes no requests.
 */
export default function CourseBrainToggle({ courseId, onStateChange }: Props) {
    const { colors, typography, layout, isDark } = useTheme();
    const styles = useMemo(
        () => createStyles(colors, typography, layout, isDark),
        [colors, typography, layout, isDark],
    );

    const [state, setState] = useState<CourseBrainState | null>(null);
    const [pending, setPending] = useState<{ files: number; vods: number; assignments: number; total: number } | null>(null);
    const [busy, setBusy] = useState(false);
    const [explaining, setExplaining] = useState(false);
    // Chosen in the sheet before committing, so the expensive stage can be declined up
    // front rather than started and then turned off.
    const [draftScope, setDraftScope] = useState<BrainScope>({ vods: true, files: true, assignments: true });
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const barAnim = useRef(new Animated.Value(0)).current;

    const apply = useCallback((next: CourseBrainState) => {
        setState(next);
        onStateChange?.(next);
    }, [onStateChange]);

    const refresh = useCallback(async () => {
        try {
            const data = await getCourseBrainStatus(courseId);
            apply(data);
            setPending(data.pending);
            return data;
        } catch {
            return null;
        }
    }, [courseId, apply]);

    // Poll only while there is something to watch.
    useEffect(() => {
        let cancelled = false;
        const tick = async () => {
            const data = await refresh();
            if (cancelled) return;
            const active = data?.status === 'building' || data?.status === 'queued';
            if (active) timer.current = setTimeout(tick, POLL_MS);
        };
        tick();
        return () => {
            cancelled = true;
            if (timer.current) clearTimeout(timer.current);
        };
    }, [refresh]);

    const progress = state?.progress ?? 0;
    useEffect(() => {
        Animated.timing(barAnim, {
            toValue: progress / 100,
            duration: 400,
            useNativeDriver: false,
        }).start();
    }, [progress, barAnim]);

    const commit = async (value: boolean) => {
        setBusy(true);
        try {
            apply(await setCourseBrain(courseId, value
                ? { enabled: true, scope: draftScope }
                : { enabled: false }));
            // The build is queued server-side; pick its progress up on the next poll.
            if (value) setTimeout(refresh, 800);
        } catch {
            // Leave the switch where it was; the next poll reconciles with the server.
        } finally {
            setBusy(false);
        }
    };

    // Turning it on is the expensive direction, so it goes through the explainer first.
    // Turning it off is cheap and reversible, so it just happens.
    const toggle = (value: boolean) => {
        if (!value) return commit(false);
        setDraftScope(state?.scope ?? { vods: true, files: true, assignments: true });
        setExplaining(true);
    };

    if (!state) return null;

    const building = state.status === 'building' || state.status === 'queued';

    // What the row says under the title, in the order the states actually occur.
    let subtitle: string;
    if (building) {
        subtitle = state.stage || '준비하는 중';
    } else if (state.status === 'error') {
        subtitle = '학습에 실패했어요. 다시 켜면 이어서 시도해요.';
    } else if (state.enabled && state.status === 'ready') {
        subtitle = pending?.total
            ? `새 자료 ${pending.total}개는 다음 동기화 때 학습해요`
            : '모든 자료를 학습했어요';
    } else if (state.enabled) {
        subtitle = '곧 학습을 시작해요';
    } else if (pending?.total) {
        subtitle = `강의 ${pending.vods}개와 자료 ${pending.files}개를 학습해요`;
    } else {
        subtitle = '이 강의 자료를 학습시켜요';
    }

    return (
        <View style={styles.card}>
            <View style={styles.row}>
                <View style={styles.text}>
                    <Text style={styles.title}>이 강의 학습하기</Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>
                </View>
                {busy ? (
                    <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
                ) : (
                    <Switch
                        value={state.enabled}
                        onValueChange={toggle}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={colors.surface}
                    />
                )}
            </View>

            {building && (
                <View style={styles.track}>
                    <Animated.View
                        style={[styles.fill, {
                            width: barAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                            }),
                        }]}
                    />
                </View>
            )}

            <Modal
                visible={explaining}
                transparent
                animationType="slide"
                onRequestClose={() => setExplaining(false)}
            >
                <Pressable style={styles.backdrop} onPress={() => setExplaining(false)}>
                    <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
                        <View style={styles.grabber} />
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.sheetTitle}>이 강의를 학습시킬까요?</Text>
                            <Text style={styles.sheetLead}>
                                학습을 켜면 이 강의의 자료를 한 번에 정리해요. 끝나면 강의 내용을
                                근거로 질문에 답하고, 어디서 나왔는지 알려줘요.
                            </Text>

                            <Text style={styles.sheetSection}>지금 학습할 자료</Text>
                            {LEARNED_CONTENT.map(row => {
                                const count = pending ? (pending as any)[row.key] as number : 0;
                                return (
                                    <View key={row.key} style={styles.sheetRow}>
                                        <Ionicons name={row.icon} size={18} color={colors.textSecondary} />
                                        <View style={styles.sheetRowText}>
                                            <Text style={styles.sheetRowTitle}>{row.title}</Text>
                                            <Text style={styles.sheetRowSub}>{row.detail}</Text>
                                        </View>
                                        <Text style={styles.sheetCount}>{count > 0 ? `${count}개` : '없음'}</Text>
                                        <Switch
                                            value={draftScope[row.key]}
                                            onValueChange={v => setDraftScope(prev => ({ ...prev, [row.key]: v }))}
                                            trackColor={{ false: colors.border, true: colors.primary }}
                                            thumbColor={colors.surface}
                                            style={styles.sheetSwitch}
                                        />
                                    </View>
                                );
                            })}

                            <Text style={styles.sheetSection}>알아두세요</Text>
                            <Text style={styles.sheetNote}>
                                • 강의 영상은 음성을 글로 옮겨서 학습해요. 강의 수에 따라 30분에서
                                한 시간쯤 걸리고, 그동안 앱을 닫아도 계속 진행돼요.{'\n'}
                                • 학습이 끝난 뒤 새 자료가 올라오면 자동으로 따라 학습해요.{'\n'}
                                • 위 스위치로 학습할 종류를 고를 수 있어요. 나중에 설정에서
                                바꿔도 돼요.{'\n'}
                                • 필요한 자료만 하나씩 학습시키려면, 자료 둘러보기에서 골라
                                학습시킬 수 있어요.
                            </Text>
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.primaryButton}
                            activeOpacity={0.85}
                            onPress={() => { setExplaining(false); commit(true); }}
                        >
                            <Text style={styles.primaryButtonText}>학습 시작하기</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            activeOpacity={0.7}
                            onPress={() => setExplaining(false)}
                        >
                            <Text style={styles.secondaryButtonText}>나중에</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}


const createStyles = (colors: ColorScheme, typography: TypographyType, layout: LayoutType, isDark: boolean) =>
    StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderRadius: layout.borderRadius.l,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: Spacing.m,
            paddingVertical: Spacing.m,
            marginBottom: Spacing.m,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        text: {
            flex: 1,
            marginRight: Spacing.m,
        },
        title: {
            ...typography.subtitle1,
            fontWeight: '600',
        },
        subtitle: {
            ...typography.caption,
            color: colors.textSecondary,
            marginTop: 2,
        },
        spinner: {
            // Matches the Switch's footprint so the row does not jump while saving.
            width: 51,
        },
        track: {
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.surfaceMuted,
            overflow: 'hidden',
            marginTop: Spacing.m,
        },
        fill: {
            height: '100%',
            borderRadius: 2,
            backgroundColor: colors.primary,
        },

        // Onboarding sheet
        backdrop: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
        },
        sheet: {
            backgroundColor: colors.background,
            borderTopLeftRadius: layout.borderRadius.xl,
            borderTopRightRadius: layout.borderRadius.xl,
            paddingHorizontal: Spacing.l,
            paddingTop: Spacing.s,
            paddingBottom: Spacing.xl,
            maxHeight: '85%',
        },
        grabber: {
            alignSelf: 'center',
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            marginBottom: Spacing.l,
        },
        sheetTitle: {
            ...typography.header2,
            marginBottom: Spacing.s,
        },
        sheetLead: {
            ...typography.body2,
            color: colors.textSecondary,
            lineHeight: 21,
        },
        sheetSection: {
            ...typography.overline,
            color: colors.textTertiary,
            marginTop: Spacing.l,
            marginBottom: Spacing.s,
        },
        sheetRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: Spacing.s + 2,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
        },
        sheetRowText: {
            flex: 1,
            marginLeft: Spacing.m,
            marginRight: Spacing.s,
        },
        sheetRowTitle: {
            ...typography.subtitle1,
            fontSize: 15,
        },
        sheetRowSub: {
            ...typography.caption,
            color: colors.textSecondary,
            marginTop: 1,
        },
        sheetCount: {
            ...typography.subtitle1,
            fontSize: 15,
            color: colors.textSecondary,
        },
        sheetSwitch: {
            marginLeft: Spacing.s,
            transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
        },
        sheetNote: {
            ...typography.caption,
            color: colors.textSecondary,
            lineHeight: 20,
        },
        primaryButton: {
            backgroundColor: colors.primary,
            borderRadius: layout.borderRadius.l,
            paddingVertical: Spacing.m,
            alignItems: 'center',
            marginTop: Spacing.l,
        },
        primaryButtonText: {
            ...typography.subtitle1,
            color: '#FFFFFF',
            fontWeight: '600',
        },
        secondaryButton: {
            paddingVertical: Spacing.m,
            alignItems: 'center',
        },
        secondaryButtonText: {
            ...typography.subtitle1,
            fontSize: 15,
            color: colors.textSecondary,
        },
    });
