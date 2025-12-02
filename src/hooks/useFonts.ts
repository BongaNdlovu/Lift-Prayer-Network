import {
  useFonts as useOutfit,
  Outfit_700Bold,
  Outfit_600SemiBold,
} from '@expo-google-fonts/outfit';
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

export const useAppFonts = () => {
  const [outfitLoaded] = useOutfit({
    Outfit_700Bold,
    Outfit_600SemiBold,
  });

  const [interLoaded] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const fontsLoaded = outfitLoaded && interLoaded;

  return { fontsLoaded };
};
