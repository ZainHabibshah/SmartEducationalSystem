import { Stack } from 'expo-router';
import React from 'react';

export default function SuperAdminLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="index" />
			<Stack.Screen name="assign-teacher" />
			<Stack.Screen name="all-students" />
			<Stack.Screen name="global-leaderboard" />
			<Stack.Screen name="settings" />
		</Stack>
	);
}

