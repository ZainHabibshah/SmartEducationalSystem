import { Stack } from 'expo-router';
import React from 'react';

export default function AdminLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="index" />
			<Stack.Screen name="students" />
			<Stack.Screen name="edit-student" />
			<Stack.Screen name="add-student" />
			<Stack.Screen name="attendance" />
			<Stack.Screen name="schedule" />
            <Stack.Screen name="notification" />
			<Stack.Screen name="chatbot" />
			<Stack.Screen name="settings" />
		</Stack>
	);
}


