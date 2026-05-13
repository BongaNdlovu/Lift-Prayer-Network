import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { firebaseEnabled, storage } from './firebase';

const PROFILE_PHOTO_PATH = 'profile-pictures';
const PROFILE_PHOTO_FILE = 'profile.jpg';

const profilePhotoPath = (userId: string) => `${PROFILE_PHOTO_PATH}/${userId}/${PROFILE_PHOTO_FILE}`;

export async function uploadProfilePhoto(userId: string, localUri: string): Promise<string> {
  if (!firebaseEnabled || !storage) {
    throw new Error('Firebase Storage is not available.');
  }

  const resized = await manipulateAsync(
    localUri,
    [{ resize: { width: 400, height: 400 } }],
    { compress: 0.8, format: SaveFormat.JPEG },
  );

  const response = await fetch(resized.uri);
  const blob = await response.blob();
  const photoRef = ref(storage, profilePhotoPath(userId));

  await uploadBytes(photoRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(photoRef);
}

export async function deleteProfilePhoto(userId: string): Promise<void> {
  if (!firebaseEnabled || !storage) return;

  try {
    await deleteObject(ref(storage, profilePhotoPath(userId)));
  } catch (error: any) {
    if (error?.code === 'storage/object-not-found') return;
    throw error;
  }
}

export function isAppStorageProfilePhoto(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const decodedPath = decodeURIComponent(parsed.pathname);
    return decodedPath.includes(`/o/${PROFILE_PHOTO_PATH}/`) && decodedPath.endsWith(`/${PROFILE_PHOTO_FILE}`);
  } catch {
    return false;
  }
}

