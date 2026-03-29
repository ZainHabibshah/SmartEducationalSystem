import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const COLORS = {
    bg: '#F5F5F5',
    heading: '#03045e',
    inputBg: '#03045e',
    inputText: '#FFFFFF',
    buttonBg: '#03045e',
    buttonText: '#FFFFFF',
    link: '#023e8a',
};

export default function CustomHeader({ title, showBackButton = true }) {
    const router = useRouter();

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            // Fallback to student dashboard if no navigation history
            router.push('/student');
        }
    };

    const TOP_PAD = Platform.select({ ios: 70, android: (StatusBar?.currentHeight || 24) + 20 });

    return (
        <View style={styles.headerContainer}>
            {showBackButton && (
                <TouchableOpacity style={[styles.backButton, { top: TOP_PAD }]} onPress={handleBack} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={22} color={COLORS.inputBg} />
                </TouchableOpacity>
            )}
            <View style={[styles.titleContainer, { paddingTop: TOP_PAD }]}>
                <Text
                    style={styles.title}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                >
                    {title}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    headerContainer: {
        padding: 20,
        backgroundColor: COLORS.bg,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
        width: 40,
        height: 40,
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.inputBg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        position: 'absolute',
        left: 20,
    },
    backText: {
        display: 'none',
    },
    titleContainer: {
        width: '100%',
        paddingLeft: 60, 
        paddingRight: 60, 
    },
    title: {
        fontFamily: 'Griffter',
        fontSize: 28,
        color: COLORS.inputBg,
        textAlign: 'center',
    },
});
