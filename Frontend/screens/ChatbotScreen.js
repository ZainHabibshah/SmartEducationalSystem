import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Keyboard, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import BottomNav from '../components/BottomNav';

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

export default function ChatbotScreen({ base = 'admin' }) {
    const router = useRouter();
    const [messages, setMessages] = useState([
        { id: '1', role: 'assistant', text: 'Hi! I am AppAssistance. Ask me anything about your classes.' },
    ]);
    const [input, setInput] = useState('');
    const listRef = useRef(null);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const [keyboardOffset, setKeyboardOffset] = useState(0);
    const [composerHeight, setComposerHeight] = useState(0);
    const baseBottomNav = ((height * 0.16) - 10 + 24);
    const MESSAGES_EXTRA_GAP = 16; 
    const composerBottom = keyboardOffset > 0 ? keyboardOffset + 50 : baseBottomNav;
    const listBottomPadding = (keyboardOffset > 0
        ? keyboardOffset + composerHeight + MESSAGES_EXTRA_GAP
        : baseBottomNav + composerHeight + MESSAGES_EXTRA_GAP);
    const footerHeight = (keyboardOffset > 0 ? keyboardOffset : baseBottomNav) + composerHeight + MESSAGES_EXTRA_GAP + 6;

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed) return;
        const userMsg = { id: Date.now().toString(), role: 'user', text: trimmed };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');


        setTimeout(() => {
            const botMsg = { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Let me think about that and fetch related info...' };
            setMessages((prev) => [...prev, botMsg]);
        }, 500);
    };

    const onScroll = (e) => {
        const offsetY = e.nativeEvent.contentOffset.y;
        setShowScrollToBottom(offsetY > 100);
    };

    const scrollToBottom = () => {
        listRef.current?.scrollToEnd({ animated: true });
    };

    useEffect(() => {
        const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
            setKeyboardOffset(e.endCoordinates.height);
            setTimeout(scrollToBottom, 50);
        });
        const hideSub = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardOffset(0);
            setTimeout(scrollToBottom, 50);
        });
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        const id = setTimeout(scrollToBottom, 50);
        return () => clearTimeout(id);
    }, [messages.length, keyboardOffset, composerHeight]);

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
                    <Text style={[styles.bubbleText, isUser ? styles.userText : styles.botText]}>{item.text}</Text>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
                    contentContainerStyle={[styles.listContent, { paddingBottom: 8 }]}
                    ListFooterComponent={<View style={{ height: footerHeight }} />}
                    onScroll={onScroll}
                    onContentSizeChange={scrollToBottom}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    scrollEnabled
                />
                {showScrollToBottom && (
                    <TouchableOpacity style={[styles.scrollDownBtn, { bottom: (keyboardOffset > 0 ? keyboardOffset : baseBottomNav) + composerHeight + 20 }]} onPress={scrollToBottom} activeOpacity={0.85}>
                        <Ionicons name="arrow-down" size={18} color={COLORS.inputBg} />
                    </TouchableOpacity>
                )}
            </View>
            <View style={[
                styles.composer,
                { bottom: composerBottom }
            ]}
                onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
            >
                <TextInput
                    style={styles.input}
                    placeholder="Type a message"
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
            </TouchableWithoutFeedback>
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
        paddingBottom: 140,
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
});


