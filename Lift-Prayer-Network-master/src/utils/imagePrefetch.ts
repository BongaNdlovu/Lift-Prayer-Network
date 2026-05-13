import { Image } from 'react-native';

const prefetchedUrls = new Set<string>();
const inflightUrls = new Set<string>();
const MAX_PREFETCH_URLS = 6;
const MAX_CONCURRENT_PREFETCHES = 2;

const runWithConcurrency = async <T,>(items: T[], worker: (item: T) => Promise<void>): Promise<void> => {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(MAX_CONCURRENT_PREFETCHES, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  });
  await Promise.allSettled(workers);
};

export const prefetchImage = async (url: string | null | undefined): Promise<void> => {
  if (!url || prefetchedUrls.has(url) || inflightUrls.has(url)) return;

  inflightUrls.add(url);
  try {
    await Image.prefetch(url);
    prefetchedUrls.add(url);
  } catch {
    // Ignore failures; image will load normally when needed
  } finally {
    inflightUrls.delete(url);
  }
};

export const prefetchImages = async (urls: (string | null | undefined)[]): Promise<void> => {
  const validUrls = Array.from(new Set(urls))
    .filter((url): url is string => !!url && !prefetchedUrls.has(url) && !inflightUrls.has(url))
    .slice(0, MAX_PREFETCH_URLS);

  await runWithConcurrency(validUrls, prefetchImage);
};

export const prefetchFeedAvatars = async (items: { userPhotoURL?: string | null }[]): Promise<void> => {
  const urls = items
    .slice(0, MAX_PREFETCH_URLS)
    .map((item) => item.userPhotoURL)
    .filter((url): url is string => !!url);

  await prefetchImages(urls);
};

export const clearPrefetchCache = (): void => {
  prefetchedUrls.clear();
  inflightUrls.clear();
};
