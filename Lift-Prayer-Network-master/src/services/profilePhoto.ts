import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, firebaseEnabled } from './firebase';
import { updateUserProfile } from './userProfile';

const MAX_IMAGE_SIZE = 1024; // Max dimension for compression
const JPEG_QUALITY = 0.8; // Compression quality (0-1)
const PROFILE_PHOTO_PATH = 'profile-photos';

export interface PhotoUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Request permission to access the device's photo library
 */
export const requestPhotoLibraryPermission = async (): Promise<boolean> => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[ProfilePhoto] Error requesting photo library permission:', error);
    return false;
  }
};

/**
 * Request permission to access the device's camera
 */
export const requestCameraPermission = async (): Promise<boolean> => {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[ProfilePhoto] Error requesting camera permission:', error);
    return false;
  }
};

/**
 * Pick an image from the device's photo library
 */
export const pickPhotoFromLibrary = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
  try {
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) {
      console.error('[ProfilePhoto] Photo library permission not granted');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    return result.assets[0];
  } catch (error) {
    console.error('[ProfilePhoto] Error picking photo from library:', error);
    return null;
  }
};

/**
 * Take a photo using the device's camera
 */
export const takePhotoWithCamera = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
  try {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      console.error('[ProfilePhoto] Camera permission not granted');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    return result.assets[0];
  } catch (error) {
    console.error('[ProfilePhoto] Error taking photo with camera:', error);
    return null;
  }
};

/**
 * Compress and optimize an image for upload
 */
export const compressImage = async (
  uri: string,
  maxSize: number = MAX_IMAGE_SIZE
): Promise<string> => {
  try {
    const result = await manipulateAsync(
      uri,
      [
        {
          resize: {
            width: maxSize,
            height: maxSize,
          },
        },
      ],
      {
        compress: JPEG_QUALITY,
        format: SaveFormat.JPEG,
        base64: false,
      }
    );

    return result.uri;
  } catch (error) {
    console.error('[ProfilePhoto] Error compressing image:', error);
    throw new Error('Failed to compress image');
  }
};

/**
 * Upload a profile photo to Firebase Storage
 */
export const uploadProfilePhoto = async (
  userId: string,
  imageUri: string
): Promise<PhotoUploadResult> => {
  if (!firebaseEnabled || !storage) {
    return { success: false, error: 'Firebase storage not available' };
  }

  try {
    // Compress the image
    const compressedUri = await compressImage(imageUri);

    // Convert URI to blob
    const response = await fetch(compressedUri);
    const blob = await response.blob();

    // Create a reference to the storage location
    const fileName = `${userId}-${Date.now()}.jpg`;
    const storageRef = ref(storage, `${PROFILE_PHOTO_PATH}/${fileName}`);

    // Upload the file
    await uploadBytes(storageRef, blob);

    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);

    return { success: true, url: downloadURL };
  } catch (error) {
    console.error('[ProfilePhoto] Error uploading photo:', error);
    return { success: false, error: 'Failed to upload photo' };
  }
};

/**
 * Delete a profile photo from Firebase Storage
 */
export const deleteProfilePhoto = async (photoUrl: string): Promise<boolean> => {
  if (!firebaseEnabled || !storage) {
    return false;
  }

  try {
    // Extract the path from the URL
    const url = new URL(photoUrl);
    const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
    if (!pathMatch) {
      console.error('[ProfilePhoto] Invalid photo URL format');
      return false;
    }

    const path = decodeURIComponent(pathMatch[1]);
    const storageRef = ref(storage, path);

    await deleteObject(storageRef);
    return true;
  } catch (error) {
    console.error('[ProfilePhoto] Error deleting photo:', error);
    return false;
  }
};

/**
 * Update a user's profile photo with full workflow:
 * 1. Pick/compress image
 * 2. Upload to storage
 * 3. Update user profile
 * 4. Delete old photo if exists
 */
export const updateProfilePhoto = async (
  userId: string,
  currentPhotoUrl: string | null
): Promise<PhotoUploadResult> => {
  try {
    // Pick photo
    const photo = await pickPhotoFromLibrary();
    if (!photo) {
      return { success: false, error: 'No photo selected' };
    }

    // Upload new photo
    const uploadResult = await uploadProfilePhoto(userId, photo.uri);
    if (!uploadResult.success || !uploadResult.url) {
      return uploadResult;
    }

    // Update user profile with new URL
    await updateUserProfile(userId, { photoURL: uploadResult.url });

    // Delete old photo if it exists
    if (currentPhotoUrl) {
      await deleteProfilePhoto(currentPhotoUrl);
    }

    return { success: true, url: uploadResult.url };
  } catch (error) {
    console.error('[ProfilePhoto] Error updating profile photo:', error);
    return { success: false, error: 'Failed to update profile photo' };
  }
};

/**
 * Remove a user's profile photo
 */
export const removeProfilePhoto = async (
  userId: string,
  currentPhotoUrl: string | null
): Promise<boolean> => {
  try {
    // Delete photo from storage
    if (currentPhotoUrl) {
      await deleteProfilePhoto(currentPhotoUrl);
    }

    // Update user profile to remove photo URL
    await updateUserProfile(userId, { photoURL: null });

    return true;
  } catch (error) {
    console.error('[ProfilePhoto] Error removing profile photo:', error);
    return false;
  }
};
