import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import type { PickedImage } from '../utils/pickImage';

/**
 * A full-screen camera with a guide (an ID-card frame or a face oval) and
 * tips, then a preview to retake or use the photo. The server checks every
 * photo's quality before keeping it. When the camera cannot be used the member
 * is offered their photo library instead.
 */
export interface GuidedCameraProps {
  visible: boolean;
  target: 'ID' | 'FACE';
  title: string;
  tips: string[];
  onCapture: (photo: PickedImage) => void;
  onClose: () => void;
  /** Choose from the photo library instead (camera refused or unavailable). */
  onUseLibrary: () => void;
}

export const GuidedCamera: React.FC<GuidedCameraProps> = ({ visible, target, title, tips, onCapture, onClose, onUseLibrary }) => {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [taking, setTaking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [preview, setPreview] = useState<PickedImage | null>(null);

  const close = () => {
    setPreview(null);
    setFailure(null);
    setReady(false);
    onClose();
  };

  const take = async () => {
    if (!cameraRef.current || !ready || taking) return;
    setTaking(true);
    try {
      const pic = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.85 });
      if (!pic?.base64) {
        setFailure('The photo could not be read. Try again, or choose one from your photos.');
        return;
      }
      setPreview({ dataUrl: `data:image/jpeg;base64,${pic.base64}`, fileName: `${target === 'FACE' ? 'selfie' : 'id'}-${Date.now()}.jpg`, mime: 'image/jpeg', uri: pic.uri });
    } catch (err) {
      setFailure(err instanceof Error ? `The camera could not take the photo (${err.message}).` : 'The camera could not take the photo.');
    } finally {
      setTaking(false);
    }
  };

  const denied = permission && !permission.granted;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
      <SafeAreaView style={styles.root}>
        <View style={styles.top}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <TouchableOpacity onPress={close} accessibilityLabel="Close the camera" style={styles.iconBtn}>
            <Ionicons name="close" size={26} color={colors.white} />
          </TouchableOpacity>
        </View>

        {!permission ? (
          <ActivityIndicator color={colors.white} style={{ flex: 1 }} />
        ) : denied || failure ? (
          <View style={styles.center}>
            <Ionicons name="camera-outline" size={44} color={colors.primaryLight} />
            <Text style={styles.message}>
              {failure ?? (permission.canAskAgain ? 'Allow the camera to take this photo.' : 'Camera access is off for this app. Turn it on in your phone settings, or choose a photo instead.')}
            </Text>
            {denied && permission.canAskAgain ? (
              <TouchableOpacity style={styles.primary} onPress={requestPermission} accessibilityRole="button">
                <Text style={styles.primaryText}>Allow camera</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.secondary} onPress={onUseLibrary} accessibilityRole="button">
              <Text style={styles.secondaryText}>Choose from my photos</Text>
            </TouchableOpacity>
          </View>
        ) : preview ? (
          <>
            <Image source={{ uri: preview.uri }} style={styles.preview} resizeMode="contain" accessibilityLabel="The photo you took" />
            <View style={styles.bottom}>
              <Text style={styles.tip}>Is everything clear and readable, with nothing cut off?</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.secondary, styles.flex]} onPress={() => setPreview(null)} accessibilityRole="button">
                  <Text style={styles.secondaryText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primary, styles.flex]}
                  onPress={() => {
                    const photo = preview;
                    setPreview(null);
                    setReady(false);
                    onCapture(photo);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryText}>Use this photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.cameraWrap}>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={target === 'FACE' ? 'front' : 'back'}
                mirror={target === 'FACE'}
                onCameraReady={() => setReady(true)}
                onMountError={(e) => setFailure(`The camera could not start (${e.message}).`)}
              />
              <View pointerEvents="none" style={styles.guideLayer}>
                <View style={target === 'FACE' ? styles.oval : styles.card} />
              </View>
            </View>
            <View style={styles.bottom}>
              {tips.map((t) => (
                <Text key={t} style={styles.tip}>
                  • {t}
                </Text>
              ))}
              <TouchableOpacity style={[styles.primary, styles.capture]} onPress={take} disabled={!ready || taking} accessibilityRole="button" accessibilityLabel="Take photo">
                {taking ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="camera" size={24} color={colors.primary} />}
                <Text style={styles.primaryText}>{ready ? 'Take photo' : 'Starting the camera…'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  title: { color: colors.white, fontSize: 18, fontWeight: '800' },
  iconBtn: { padding: 6 },
  cameraWrap: { flex: 1, overflow: 'hidden' },
  guideLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  card: { width: '86%', aspectRatio: 1.586, borderWidth: 4, borderColor: colors.primaryLight, borderRadius: 16 },
  oval: { width: '62%', aspectRatio: 0.75, borderWidth: 4, borderColor: colors.primaryLight, borderRadius: 1000 },
  preview: { flex: 1, backgroundColor: colors.primaryDeep },
  bottom: { padding: 16, gap: 8 },
  tip: { color: '#CBD5E1', fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  message: { color: colors.white, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primaryLight, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20 },
  primaryText: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  secondary: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 16, paddingVertical: 15, paddingHorizontal: 20 },
  secondaryText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  capture: { marginTop: 6 },
});
