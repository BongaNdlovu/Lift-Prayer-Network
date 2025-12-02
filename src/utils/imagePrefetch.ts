import { Image } from 'react-native';

const prefetchedUrls = new Set<string>();

export const prefetchImage = async (url: string | null | undefined): Promise<void> => {
  if (!url || prefetchedUrls.has(url)) return;

  try {
    await Image.prefetch(url);
    prefetchedUrls.add(url);
  } catch {
    // Ignore failures; image will load normally when needed
  }
};

export const prefetchImages = async (urls: (string | null | undefined)[]): Promise<void> => {
  const validUrls = urls.filter((url): url is string => !!url && !prefetchedUrls.has(url));
  await Promise.allSettled(validUrls.map(prefetchImage));
};

export const prefetchFeedAvatars = async (items: Array<{ userPhotoURL?: string | null }>): Promise<void> => {
  const urls = items
    .slice(0, 20)
    .map((item) => item.userPhotoURL)
    .filter((url): url is string => !!url);

  await prefetchImages(urls);
};

export const clearPrefetchCache = (): void => {
  prefetchedUrls.clear();
};
