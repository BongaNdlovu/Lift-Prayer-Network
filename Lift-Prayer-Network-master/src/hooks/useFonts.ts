import {
  useFonts as usePlayfair,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

export const useAppFonts = () => {
  const [playfairLoaded] = usePlayfair({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_700Bold_Italic,
  });

  const [interLoaded] = useInter({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const fontsLoaded = playfairLoaded && interLoaded;

  return { fontsLoaded };
};
