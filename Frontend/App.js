import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import useFonts from './hooks/useFonts';
import Navigation from './navigation/MainNavigator';
import ErrorBoundary from './components/ErrorBoundary';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const fontsLoaded = useFonts();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <Navigation />
    </ErrorBoundary>
  );
}