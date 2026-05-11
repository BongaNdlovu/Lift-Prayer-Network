import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_CACHE_KEY = '@lift_user_location';
const LOCATION_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface CachedLocation {
  country: string;
  city?: string;
  region?: string;
  timestamp: number;
}

// Country code to country name mapping
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  JP: 'Japan',
  IN: 'India',
  BR: 'Brazil',
  ZA: 'South Africa',
  NG: 'Nigeria',
  KE: 'Kenya',
  GH: 'Ghana',
  MX: 'Mexico',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  PL: 'Poland',
  UA: 'Ukraine',
  RU: 'Russia',
  CN: 'China',
  KR: 'South Korea',
  PH: 'Philippines',
  ID: 'Indonesia',
  MY: 'Malaysia',
  SG: 'Singapore',
  TH: 'Thailand',
  VN: 'Vietnam',
  AE: 'UAE',
  SA: 'Saudi Arabia',
  EG: 'Egypt',
  AR: 'Argentina',
  CL: 'Chile',
  CO: 'Colombia',
  PE: 'Peru',
  NZ: 'New Zealand',
  IE: 'Ireland',
  PT: 'Portugal',
  BE: 'Belgium',
  CH: 'Switzerland',
  AT: 'Austria',
  CZ: 'Czech Republic',
  HU: 'Hungary',
  RO: 'Romania',
  GR: 'Greece',
  TR: 'Turkey',
  IL: 'Israel',
  PK: 'Pakistan',
  BD: 'Bangladesh',
  LK: 'Sri Lanka',
  NP: 'Nepal',
  MM: 'Myanmar',
  KH: 'Cambodia',
  TW: 'Taiwan',
  HK: 'Hong Kong',
};

// Get country name from code
export const getCountryName = (code: string): string => {
  return COUNTRY_NAMES[code?.toUpperCase()] || code || 'Unknown';
};

// Format location string for display
export const formatLocationDisplay = (location: CachedLocation | null): string => {
  if (!location) return 'Earth 🌍';
  
  const parts: string[] = [];
  
  if (location.city) {
    parts.push(location.city);
  }
  
  if (location.country) {
    parts.push(location.country);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'Earth 🌍';
};

// Get cached location
export const getCachedLocation = async (): Promise<CachedLocation | null> => {
  try {
    const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
    if (cached) {
      const parsed: CachedLocation = JSON.parse(cached);
      // Check if cache is still valid
      if (Date.now() - parsed.timestamp < LOCATION_CACHE_DURATION) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Location] Error reading cached location:', err);
  }
  return null;
};

// Save location to cache
const cacheLocation = async (location: CachedLocation): Promise<void> => {
  try {
    await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(location));
  } catch (err) {
    console.warn('[Location] Error caching location:', err);
  }
};

// Request location permission and get user's country
export const getUserLocation = async (): Promise<CachedLocation | null> => {
  // Check cache first
  const cached = await getCachedLocation();
  if (cached) {
    return cached;
  }

  try {
    // Request permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('[Location] Permission not granted');
      return null;
    }

    // Get current position
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low, // Low accuracy is enough for country
    });

    // Reverse geocode to get country
    const [address] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });

    if (address) {
      const location: CachedLocation = {
        country: getCountryName(address.isoCountryCode || '') || address.country || 'Unknown',
        city: address.city || address.subregion || undefined,
        region: address.region || undefined,
        timestamp: Date.now(),
      };

      // Cache the location
      await cacheLocation(location);
      
      return location;
    }
  } catch (err) {
    console.warn('[Location] Error getting location:', err);
  }

  return null;
};

// Get location display string (for use in requests/testimonies)
export const getLocationString = async (): Promise<string> => {
  const location = await getUserLocation();
  return formatLocationDisplay(location);
};

