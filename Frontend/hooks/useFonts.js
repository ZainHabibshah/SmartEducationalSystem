import { useFonts } from 'expo-font';
import { fontAssets } from '../assets/fonts/config';

export default function useFonts() {
  const [fontsLoaded] = useFonts(fontAssets);
  return fontsLoaded;
}