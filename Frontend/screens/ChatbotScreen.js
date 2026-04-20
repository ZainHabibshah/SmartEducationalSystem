import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import BottomNav from '../components/BottomNav';
import apiService from '../services/apiService';

const { height } = Dimensions.get('window');

const COLORS = {
    bg: '#F5F5F5',
    heading: '#03045e',
    inputBg: '#03045e',
    inputText: '#FFFFFF',
    bubbleUser: '#DDE8D8',
    bubbleBot: '#FFFFFF',
    link: '#023e8a',
};

function isSimpleGreeting(text) {
    const t = (text || '').trim().toLowerCase();
    if (!t) return false;
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)(\s+there)?[\s!.]*$/.test(t)) return true;
    if (/^how are you[\s?.!]*$/.test(t)) return true;
    return false;
}

function localGreetingReply(displayName) {
    return `Hello ${displayName}! I'm here to help. What would you like to know about your classes?`;
}

function parseIntentCommand(text) {
    const raw = (text || '');
    const trimmedLeft = raw.replace(/^\s+/, '');
    const m = trimmedLeft.match(/^\/(timetable|course|student|ai)\b/i);
    if (!m) return { intent: null, remaining: raw };
    const intent = m[1].toLowerCase();
    const after = trimmedLeft.slice(m[0].length);
    const remaining = after.replace(/^[\s,.;:!?-]+/, '').trim();
    return { intent, remaining };
}

function intentLabel(intent) {
    if (intent === 'timetable') return 'Timetable';
    if (intent === 'course') return 'Course';
    if (intent === 'student') return 'Student';
    if (intent === 'ai') return 'AI';
    return 'Auto';
}

/** When the last line is only `/` or `/letters` (no space yet), show intent picker like WhatsApp @. */
function getSlashCommandState(text) {
    const raw = text ?? '';
    const lines = raw.split('\n');
    const last = lines[lines.length - 1];
    const m = last.match(/^(\s*)\/([a-zA-Z]*)$/);
    if (!m) return null;
    return {
        leadingSpaces: m[1],
        filter: (m[2] || '').toLowerCase(),
        linesBefore: lines.slice(0, -1),
    };
}

const INTENT_MENU_ITEMS = [
    {
        id: 'timetable',
        prefix: 'timetable',
        label: '/timetable',
        purpose: 'Questions about class times using the timetable your admin uploaded.',
        adminOnly: false,
    },
    {
        id: 'course',
        prefix: 'course',
        label: '/course',
        purpose: 'Course books & slides: embeddings when the match is strong, else full files plus AI.',
        adminOnly: false,
    },
    {
        id: 'student',
        prefix: 'student',
        label: '/student',
        purpose: 'Find students in your course by name, ID, or email (admins only).',
        adminOnly: true,
    },
    {
        id: 'ai',
        prefix: 'ai',
        label: '/ai',
        purpose: 'General AI chat without using uploaded course files (admins only).',
        adminOnly: true,
    },
];

function filterIntentMenuItems(filterLower) {
    return INTENT_MENU_ITEMS.filter((item) => item.prefix.startsWith(filterLower));
}

/** Split assistant text into plain segments and [label](url) links (timetable / schedules / course files). */
function parseTextWithMarkdownLinks(text) {
    if (text == null || typeof text !== 'string') {
        return [{ type: 'text', value: '' }];
    }
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let last = 0;
    let m = re.exec(text);
    while (m !== null) {
        if (m.index > last) {
            parts.push({ type: 'text', value: text.slice(last, m.index) });
        }
        parts.push({ type: 'link', label: m[1], url: m[2] });
        last = re.lastIndex;
        m = re.exec(text);
    }
    if (last < text.length) {
        parts.push({ type: 'text', value: text.slice(last) });
    }
    return parts.length ? parts : [{ type: 'text', value: text }];
}

function BotMessageText({ text, baseStyle, linkStyle }) {
    const parts = parseTextWithMarkdownLinks(text);
    const openLink = async (url) => {
        try {
            const isCourse =
                url.includes('/api/course-materials/download/') || url.includes('course-materials/download');
            if (isCourse) {
                await apiService.downloadCourseMaterialWithAuth(url);
                return;
            }
            const can = await Linking.canOpenURL(url);
            if (can) {
                await Linking.openURL(url);
            }
        } catch (e) {
            Alert.alert('Link', e?.message || 'Could not open or download.');
        }
    };
    if (parts.length === 1 && parts[0].type === 'text') {
        return <Text style={baseStyle}>{parts[0].value}</Text>;
    }
    return (
        <Text style={baseStyle}>
            {parts.map((p, i) =>
                p.type === 'link' ? (
                    <Text key={i} style={[baseStyle, linkStyle]} onPress={() => openLink(p.url)}>
                        {p.label}
                    </Text>
                ) : (
                    <Text key={i} style={baseStyle}>
                        {p.value}
                    </Text>
                )
            )}
        </Text>
    );
}

function TypingIndicatorBubble() {
    const d1 = useRef(new Animated.Value(0.35)).current;
    const d2 = useRef(new Animated.Value(0.35)).current;
    const d3 = useRef(new Animated.Value(0.35)).current;
    useEffect(() => {
        const pulse = (v, delay) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
                    Animated.timing(v, { toValue: 0.35, duration: 320, useNativeDriver: true }),
                ])
            );
        const a1 = pulse(d1, 0);
        const a2 = pulse(d2, 160);
        const a3 = pulse(d3, 320);
        a1.start();
        a2.start();
        a3.start();
        return () => {
            a1.stop();
            a2.stop();
            a3.stop();
        };
    }, [d1, d2, d3]);
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, minWidth: 48 }}>
            {[d1, d2, d3].map((op, i) => (
                <Animated.View
                    key={i}
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: 3.5,
                        backgroundColor: COLORS.heading,
                        marginRight: i < 2 ? 5 : 0,
                        opacity: op,
                    }}
                />
            ))}
        </View>
    );
}

export default function ChatbotScreen({ base = 'admin' }) {
    const router = useRouter();
    const [displayName, setDisplayName] = useState(base === 'admin' ? 'Administrator' : 'Student');
    const [chatIntent, setChatIntent] = useState(null); // null => auto
    const courseHint =
        base === 'student'
            ? 'Hi! I am AppAssistance. For course book and slide questions (uploads + AI), use /course (example: /course What is a limit?).'
            : 'Hi! I am AppAssistance. Upload up to 6 course files from Course books on the dashboard; use /course in chat to answer from embeddings or full files plus AI.';
    const [messages, setMessages] = useState([{ id: '1', role: 'assistant', text: courseHint }]);
    const [input, setInput] = useState('');
    const listRef = useRef(null);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [composerHeight, setComposerHeight] = useState(0);
    const baseBottomNav = ((height * 0.16) - 10 + 24);
    const MESSAGES_EXTRA_GAP = 16;
    const composerBottom = baseBottomNav;
    const slashState = useMemo(() => getSlashCommandState(input), [input]);
    const intentMenuItems = useMemo(() => {
        if (!slashState) return [];
        const matched = filterIntentMenuItems(slashState.filter);
        return matched.map((item) => ({
            ...item,
            disabled: base === 'student' && item.adminOnly,
        }));
    }, [slashState, base]);
    const showIntentMenu = Boolean(slashState && intentMenuItems.length > 0);
    const intentMenuBottom = composerBottom + composerHeight + 6;
    const listBottomPadding =
        baseBottomNav + composerHeight + MESSAGES_EXTRA_GAP + (showIntentMenu ? 200 : 0);

    const applyIntentFromMenu = (item) => {
        if (!slashState || item.disabled) return;
        const newLastLine = `${slashState.leadingSpaces}/${item.prefix} `;
        const next = [...slashState.linesBefore, newLastLine].join('\n');
        setInput(next);
    };

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed) return;
        const now = Date.now();
        const { intent: cmdIntent, remaining } = parseIntentCommand(trimmed);
        const effectiveIntent = cmdIntent || chatIntent;
        const questionToSend = cmdIntent ? remaining : trimmed;
        const userMsg = { id: now.toString(), role: 'user', text: trimmed };
        const pendingId = (now + 1).toString();
        setMessages((prev) => [
            ...prev,
            userMsg,
            { id: pendingId, role: 'assistant', typing: true },
        ]);
        setInput('');

        try {
            if (cmdIntent) {
                const key = `chat_intent_${base}`;
                await AsyncStorage.setItem(key, cmdIntent);
                setChatIntent(cmdIntent);
                if (!questionToSend) {
                    const ack = `Switched to ${intentLabel(cmdIntent)} mode.`;
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === pendingId ? { ...msg, typing: false, text: ack } : msg
                        )
                    );
                    return;
                }
            }

            const result = await apiService.chatbotChat(questionToSend, effectiveIntent);
            const answer =
                result?.answer ||
                (isSimpleGreeting(trimmed) ? localGreetingReply(displayName) : `Sorry ${displayName}, I could not process that right now.`);
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === pendingId ? { ...msg, typing: false, text: answer } : msg
                )
            );
        } catch (error) {
            const fallback = isSimpleGreeting(trimmed)
                ? localGreetingReply(displayName)
                : error?.message || error?.error || `Sorry ${displayName}, I am unable to answer right now.`;
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === pendingId ? { ...msg, typing: false, text: fallback } : msg
                )
            );
        }
    };

    const onScroll = (e) => {
        const offsetY = e.nativeEvent.contentOffset.y;
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
        const nearBottom = distanceFromBottom < 80;
        setIsNearBottom(nearBottom);
        setShowScrollToBottom(!nearBottom);
    };

    const scrollToBottom = () => {
        listRef.current?.scrollToEnd({ animated: true });
    };

    useEffect(() => {
        const loadName = async () => {
            try {
                const key = base === 'admin' ? 'admin_name' : 'student_name';
                const fallback = base === 'admin' ? 'Administrator' : 'Student';
                const storedName = await AsyncStorage.getItem(key);
                setDisplayName(storedName || fallback);
            } catch {
                setDisplayName(base === 'admin' ? 'Administrator' : 'Student');
            }
        };
        loadName();
    }, [base]);

    useEffect(() => {
        const loadIntent = async () => {
            try {
                const key = `chat_intent_${base}`;
                const stored = await AsyncStorage.getItem(key);
                if (stored && ['timetable', 'course', 'student', 'ai'].includes(stored)) {
                    setChatIntent(stored);
                } else {
                    setChatIntent(null);
                }
            } catch {
                setChatIntent(null);
            }
        };
        loadIntent();
    }, [base]);

    // Student intent should not persist after leaving chat.
    useEffect(() => {
        return () => {
            if (base !== 'student') return;
            const key = `chat_intent_${base}`;
            AsyncStorage.removeItem(key).catch(() => {});
        };
    }, [base]);

    useEffect(() => {
        const id = setTimeout(scrollToBottom, 50);
        return () => clearTimeout(id);
    }, [messages.length, composerHeight]);

    const go = (key) => {
        if (key === 'home') router.push(`/${base}`);
        if (key === 'bell') router.push(`/${base}/notification`);
        if (key === 'chatbot') router.push(`/${base}/chatbot`);
        if (key === 'settings') router.push(`/${base}/settings`);
    };

    const renderItem = ({ item }) => {
        const isUser = item.role === 'user';
        return (
            <View style={[styles.bubbleRow, isUser ? styles.rowEnd : styles.rowStart]}>
                <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
                    {item.typing ? (
                        <TypingIndicatorBubble />
                    ) : isUser ? (
                        <Text style={[styles.bubbleText, styles.userText]}>{item.text}</Text>
                    ) : (
                        <BotMessageText
                            text={item.text}
                            baseStyle={[styles.bubbleText, styles.botText]}
                            linkStyle={styles.linkInBubble}
                        />
                    )}
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <View style={{ flex: 1 }}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.inputBg} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>AppAssistance</Text>
                <View style={{ width: 44 }} />
            </View>

            <View style={styles.listContainer}>
                <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    style={{ flex: 1 }}
                    contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
                    onScroll={onScroll}
                    onScrollBeginDrag={Keyboard.dismiss}
                    onContentSizeChange={() => {
                        if (isNearBottom) {
                            scrollToBottom();
                        }
                    }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    scrollEnabled
                    scrollEventThrottle={16}
                />
                {showScrollToBottom && (
                    <TouchableOpacity style={[styles.scrollDownBtn, { bottom: baseBottomNav + composerHeight + 20 }]} onPress={scrollToBottom} activeOpacity={0.85}>
                        <Ionicons name="arrow-down" size={18} color={COLORS.inputBg} />
                    </TouchableOpacity>
                )}
            </View>
            {showIntentMenu ? (
                <View style={[styles.intentMenu, { bottom: intentMenuBottom }]}>
                    <Text style={styles.intentMenuTitle}>Commands</Text>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                        style={styles.intentMenuScroll}
                        showsVerticalScrollIndicator={false}
                    >
                        {intentMenuItems.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[styles.intentRow, item.disabled && styles.intentRowDisabled]}
                                onPress={() => applyIntentFromMenu(item)}
                                activeOpacity={item.disabled ? 1 : 0.7}
                                disabled={item.disabled}
                            >
                                <Text style={[styles.intentLabel, item.disabled && styles.intentLabelDisabled]}>
                                    {item.label}
                                    {item.adminOnly ? ' · Admin' : ''}
                                </Text>
                                <Text style={[styles.intentPurpose, item.disabled && styles.intentPurposeDisabled]}>
                                    {item.purpose}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            ) : null}
            <View
                style={[styles.composer, { bottom: composerBottom, zIndex: 2 }]}
                onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
            >
                <TextInput
                    style={styles.input}
                    placeholder="Message — type / for commands"
                    placeholderTextColor="#A9B8A8"
                    value={input}
                    onChangeText={setInput}
                    multiline
                />
                <TouchableOpacity style={styles.send} onPress={handleSend} activeOpacity={0.85}>
                    <Ionicons name="send" size={18} color={COLORS.inputText} />
                </TouchableOpacity>
            </View>

            <BottomNav
                onPressHome={() => go('home')}
                onPressNotifications={() => go('bell')}
                onPressChatbot={() => go('chatbot')}
                onPressSettings={() => go('settings')}
            />
            </View>
        </KeyboardAvoidingView>
    );
}

const TOP_SAFE = Platform.OS === 'android' ? (StatusBar.currentHeight || 32) : 24;

const styles = StyleSheet.create({
    container: {
        paddingTop: TOP_SAFE + 2,
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    header: {
        height: 56,
        backgroundColor: 'transparent',
        borderRadius: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        marginTop: 0,
        marginBottom: 8,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: COLORS.inputBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
    },
    headerTitle: {
        fontFamily: 'Griffter',
        fontSize: 20,
        color: COLORS.inputBg,
        textAlign: 'center',
        marginRight: 10,
    },
    listContainer: {
        flex: 1,
        paddingHorizontal: 16,
        paddingBottom: 0,
    },
    listContent: {
        paddingVertical: 8,
        rowGap: 8,
    },
    bubbleRow: {
        width: '100%',
        flexDirection: 'row',
    },
    rowStart: { justifyContent: 'flex-start' },
    rowEnd: { justifyContent: 'flex-end' },
    bubble: {
        maxWidth: '80%',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    userBubble: {
        backgroundColor: COLORS.inputBg,
        borderTopRightRadius: 4,
    },
    botBubble: {
        backgroundColor: COLORS.bubbleBot,
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        borderTopLeftRadius: 4,
    },
    bubbleText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.heading,
        lineHeight: 20,
    },
    userText: { color: '#FFFFFF' },
    botText: {},
    linkInBubble: {
        color: COLORS.link,
        textDecorationLine: 'underline',
        fontWeight: '600',
    },
    scrollDownBtn: {
        position: 'absolute',
        right: 20,
        bottom: 200,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#DDE8D8',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    composer: {
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: (height * 0.16) - 10 + 24, 
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#DDE8D8',
        paddingHorizontal: 10,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 100,
        paddingHorizontal: 8,
        fontFamily: 'Outfit',
        color: COLORS.heading,
    },
    send: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.inputBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    intentMenu: {
        position: 'absolute',
        left: 12,
        right: 12,
        maxHeight: 200,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#DDE8D8',
        paddingTop: 8,
        paddingHorizontal: 4,
        paddingBottom: 6,
        zIndex: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 8,
    },
    intentMenuTitle: {
        fontFamily: 'Outfit',
        fontSize: 11,
        fontWeight: '700',
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        paddingHorizontal: 12,
        paddingBottom: 6,
    },
    intentMenuScroll: {
        maxHeight: 168,
    },
    intentRow: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    intentRowDisabled: {
        opacity: 0.45,
    },
    intentLabel: {
        fontFamily: 'Outfit',
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.inputBg,
    },
    intentLabelDisabled: {
        color: '#6b7280',
    },
    intentPurpose: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: COLORS.heading,
        marginTop: 3,
        lineHeight: 16,
        opacity: 0.92,
    },
    intentPurposeDisabled: {
        opacity: 0.7,
    },
});


