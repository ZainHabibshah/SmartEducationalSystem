import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const COLORS = {
	bg: '#F5F5F5',
	heading: '#03045e',
	inputBg: '#03045e',
	inputText: '#FFFFFF',
	arrow: '#03045e',
	link: '#023e8a',
	buttonBg: '#03045e',
	buttonText: '#FFFFFF',
	success: '#4CAF50',
	danger: '#F44336',
};

export default function UploadConfirmationModal({ 
    visible, 
    onClose, 
    title = "Upload Successful", 
    message = "Your file has been uploaded successfully!",
    operationType = "upload", // upload, attendance, etc.
    variant = 'success' // 'success' | 'error'
}) {
	const scaleAnim = useRef(new Animated.Value(0)).current;
	const fadeAnim = useRef(new Animated.Value(0)).current;
	const checkmarkAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (visible) {
			// Start animations
			Animated.parallel([
				Animated.spring(scaleAnim, {
					toValue: 1,
					tension: 50,
					friction: 7,
					useNativeDriver: true,
				}),
				Animated.timing(fadeAnim, {
					toValue: 1,
					duration: 300,
					useNativeDriver: true,
				}),
			]).start();

			// Animate checkmark after modal appears
			setTimeout(() => {
				Animated.timing(checkmarkAnim, {
					toValue: 1,
					duration: 500,
					useNativeDriver: true,
				}).start();
			}, 200);
		} else {
			// Reset animations
			scaleAnim.setValue(0);
			fadeAnim.setValue(0);
			checkmarkAnim.setValue(0);
		}
	}, [visible]);

	const handleClose = () => {
		Animated.parallel([
			Animated.timing(scaleAnim, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}),
			Animated.timing(fadeAnim, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}),
		]).start(() => {
			onClose();
		});
	};

	return (
		<Modal
			visible={visible}
			transparent
			animationType="none"
			onRequestClose={handleClose}
		>
			<Animated.View 
				style={[
					styles.overlay,
					{ opacity: fadeAnim }
				]}
			>
				<Animated.View 
					style={[
						styles.modalContainer,
						{
							transform: [{ scale: scaleAnim }],
						}
					]}
				>
                    {/* Icon */}
					<View style={styles.iconContainer}>
						<Animated.View
							style={[
								styles.checkmarkContainer,
								{
									opacity: checkmarkAnim,
									transform: [{
										scale: checkmarkAnim.interpolate({
											inputRange: [0, 1],
											outputRange: [0.5, 1],
										})
									}]
								}
							]}
						>
                            {variant === 'success' ? (
                                <Svg width={80} height={80} viewBox="0 0 80 80">
                                    <Circle cx="40" cy="40" r="35" fill={COLORS.success} stroke={COLORS.success} strokeWidth="2" />
                                    <Path d="M25 40 L35 50 L55 30" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                </Svg>
                            ) : (
                                <Svg width={80} height={80} viewBox="0 0 80 80">
                                    <Circle cx="40" cy="40" r="35" fill={COLORS.danger} stroke={COLORS.danger} strokeWidth="2" />
                                    <Path d="M28 28 L52 52" stroke="white" strokeWidth="4" strokeLinecap="round" />
                                    <Path d="M52 28 L28 52" stroke="white" strokeWidth="4" strokeLinecap="round" />
                                </Svg>
                            )}
						</Animated.View>
					</View>

					{/* Title */}
					<Text style={styles.title}>{title}</Text>

					{/* Message */}
					<Text style={styles.message}>{message}</Text>

					{/* Close Button */}
					<TouchableOpacity 
						style={styles.closeButton} 
						onPress={handleClose}
						activeOpacity={0.8}
					>
						<Text style={styles.closeButtonText}>Continue</Text>
					</TouchableOpacity>
				</Animated.View>
			</Animated.View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	modalContainer: {
		backgroundColor: '#fff',
		borderRadius: 25,
		padding: 30,
		alignItems: 'center',
		width: width * 0.85,
		maxWidth: 350,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 10 },
		shadowOpacity: 0.25,
		shadowRadius: 20,
		elevation: 10,
	},
	iconContainer: {
		marginBottom: 20,
		alignItems: 'center',
		justifyContent: 'center',
	},
	checkmarkContainer: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	title: {
		fontFamily: 'Griffter',
		fontSize: 24,
		color: COLORS.inputBg,
		textAlign: 'center',
		marginBottom: 12,
		fontWeight: 'bold',
	},
	message: {
		fontFamily: 'Outfit',
		fontSize: 16,
		color: COLORS.link,
		textAlign: 'center',
		lineHeight: 22,
		marginBottom: 25,
	},
	closeButton: {
		backgroundColor: COLORS.buttonBg,
		paddingVertical: 12,
		paddingHorizontal: 30,
		borderRadius: 25,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	closeButtonText: {
		fontFamily: 'Outfit',
		fontSize: 16,
		color: COLORS.buttonText,
		fontWeight: '600',
	},
});