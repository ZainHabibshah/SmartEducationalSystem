import { Stack } from 'expo-router';
import React from 'react';

export default function StudentLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="attendance" />
            <Stack.Screen name="timetable" />
            <Stack.Screen name="curriculum" />
            <Stack.Screen name="quiz" />
            <Stack.Screen name="achievements" />
            <Stack.Screen name="chatbot" />
            <Stack.Screen name="notification" />
            <Stack.Screen name="settings" />
        </Stack>
    );
}


