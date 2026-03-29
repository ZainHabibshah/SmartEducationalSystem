import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';

const { height } = Dimensions.get('window');

const COLORS = {
    inputBg: '#03045e',
};

export default function BottomNav({ onPressHome, onPressNotifications, onPressChatbot, onPressSettings }) {
    return (
        <View style={styles.bottomSection}>
            <View style={styles.bottomContainer}>
                <TouchableOpacity style={styles.bottomIcon} onPress={onPressHome} activeOpacity={0.8}>
                    <Ionicons name="home" size={24} color={COLORS.inputBg} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.bottomIcon} onPress={onPressNotifications} activeOpacity={0.8}>
                    <Ionicons name="notifications" size={24} color={COLORS.inputBg} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.bottomIcon} onPress={onPressChatbot} activeOpacity={0.8}>
                    <Ionicons name="chatbubbles" size={24} color={COLORS.inputBg} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.bottomIcon} onPress={onPressSettings} activeOpacity={0.8}>
                    <Ionicons name="settings" size={24} color={COLORS.inputBg} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    bottomSection: {
        height: height * 0.16,
        backgroundColor: COLORS.inputBg,
        width: '100%',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    bottomContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 30,
        flex: 1,
    },
    bottomIcon: {
        width: 60,
        height: 60,
        backgroundColor: '#DDE8D8',
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
});


