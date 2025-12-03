import {
  useFonts as usePlayfair,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  useFonts as useNunito,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from '@expo-google-fonts/nunito';

export const useAppFonts = () => {
  const [playfairLoaded] = usePlayfair({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_700Bold_Italic,
  });

  const [nunitoLoaded] = useNunito({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  const fontsLoaded = playfairLoaded && nunitoLoaded;

  return { fontsLoaded };
};
