import * as ImagePicker from 'expo-image-picker';

export interface PickedImage {
  /** data:image/...;base64,... as the upload endpoints expect. */
  dataUrl: string;
  fileName: string;
  mime: string;
  uri: string;
}

/**
 * Takes or chooses one photo and returns it base64-encoded (works on iOS,
 * Android and web). Returns null when the member cancels; throws when the
 * camera or gallery permission is refused.
 */
export async function pickImage(source: 'camera' | 'library', options: { front?: boolean } = {}): Promise<PickedImage | null> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error(source === 'camera' ? 'Allow camera access to take the photo.' : 'Allow photo access to choose the picture.');
  }
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
    base64: true,
    ...(options.front ? { cameraType: ImagePicker.CameraType.front } : {}),
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  if (!asset.base64) throw new Error('The photo could not be read. Please try another one.');
  const mime = asset.mimeType && /^image\/(jpeg|png|webp)$/.test(asset.mimeType) ? asset.mimeType : 'image/jpeg';
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  return {
    dataUrl: `data:${mime};base64,${asset.base64}`,
    fileName: asset.fileName || `photo-${Date.now()}.${ext}`,
    mime,
    uri: asset.uri,
  };
}
