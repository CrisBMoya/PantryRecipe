import { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BarcodeScannerConfig, ScannedBarcode } from '../types/barcode';
import { SUPPORTED_BARCODE_TYPES } from '../utils/barcodeValidator';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

export interface BarcodeScannerViewProps {
  /**
   * Optional callback fired as soon as a barcode passes checksum and multi-frame consensus,
   * and again when a front product photo is captured and saved.
   */
  onScanned?: (barcode: ScannedBarcode) => void;
  /**
   * Optional scanner precision & symbology configuration.
   */
  config?: BarcodeScannerConfig;
}

export function BarcodeScannerView({
  onScanned,
  config,
}: BarcodeScannerViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState<boolean>(false);
  const [isRetakingPhoto, setIsRetakingPhoto] = useState<boolean>(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const {
    isScanning,
    scannedResult,
    verifyingProgress,
    requiredReads,
    handleBarcodeScanned,
    startScanning,
    attachFrontPhoto,
  } = useBarcodeScanner(config, onScanned);

  const barcodeTypes = config?.barcodeTypes ?? SUPPORTED_BARCODE_TYPES;

  const isAwaitingFrontPhoto =
    scannedResult !== null &&
    ((scannedResult.status === 'new' && !scannedResult.frontPhotoUri) ||
      isRetakingPhoto);

  const handleStartScanning = () => {
    setPhotoError(null);
    setIsRetakingPhoto(false);
    startScanning();
  };

  const handleCaptureFrontPhoto = async () => {
    if (!cameraRef.current || isTakingPhoto || !scannedResult) {
      return;
    }

    setPhotoError(null);
    setIsTakingPhoto(true);
    try {
      const captured = await cameraRef.current.takePictureAsync({
        quality: 0.85,
      });

      if (!captured?.uri) {
        setPhotoError('Could not capture photo. Please try again.');
        return;
      }

      const savedUri = attachFrontPhoto(captured.uri);
      if (!savedUri) {
        setPhotoError('Failed to save photo to device storage.');
        return;
      }

      setIsRetakingPhoto(false);
    } catch (error) {
      console.warn('Error capturing front product photo:', error);
      setPhotoError('Error taking photo. Please hold steady and try again.');
    } finally {
      setIsTakingPhoto(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.infoText}>Checking camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <View style={styles.permissionCard}>
          <Text style={styles.title}>Camera Access Needed</Text>
          <Text style={styles.subtitle}>
            We need permission to use your camera to scan barcodes and take product photos.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={requestPermission}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Grant Camera Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        autofocus="on"
        onBarcodeScanned={
          isScanning && !scannedResult ? handleBarcodeScanned : undefined
        }
        barcodeScannerSettings={{
          barcodeTypes,
        }}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {isAwaitingFrontPhoto ? 'Front Product Photo' : 'Barcode Scanner'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isAwaitingFrontPhoto
              ? 'New barcode detected — frame the front of the product and take a photo'
              : scannedResult
                ? 'Barcode verified!'
                : !isScanning
                  ? 'Press the button below to scan a barcode'
                  : verifyingProgress > 0
                    ? `Verifying barcode (${verifyingProgress}/${requiredReads})...`
                    : 'Hold steady over a barcode'}
          </Text>
        </View>

        <View style={styles.reticleContainer} pointerEvents="none">
          <View
            style={[
              styles.reticle,
              isAwaitingFrontPhoto ? styles.reticlePhotoFrame : null,
              !isScanning && !scannedResult ? styles.reticleIdle : null,
              isScanning && verifyingProgress > 0 && !scannedResult
                ? styles.reticleVerifying
                : null,
              scannedResult && !isAwaitingFrontPhoto
                ? styles.reticleActive
                : null,
            ]}
          />
        </View>

        <View style={styles.footer}>
          {scannedResult ? (
            <View style={styles.resultCard}>
              <View style={styles.resultHeaderRow}>
                <Text style={styles.resultLabel}>
                  VERIFIED BARCODE ({scannedResult.type.toUpperCase()})
                </Text>
                {scannedResult.status && (
                  <View
                    style={[
                      styles.statusBadge,
                      scannedResult.status === 'new'
                        ? styles.statusBadgeNew
                        : styles.statusBadgeOld,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        scannedResult.status === 'new'
                          ? styles.statusBadgeTextNew
                          : styles.statusBadgeTextOld,
                      ]}
                    >
                      {scannedResult.status === 'new' ? 'NEW CODE' : 'OLD CODE'}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.resultData} selectable>
                {scannedResult.data}
              </Text>

              {isAwaitingFrontPhoto ? (
                <View style={styles.photoPromptSection}>
                  <View style={styles.photoPromptBanner}>
                    <Text style={styles.photoPromptTitle}>
                      Front product photo required
                    </Text>
                    <Text style={styles.photoPromptSubtitle}>
                      Please take a clear photo of the front of the product. It will be saved on your device to be sent to the server later.
                    </Text>
                  </View>

                  {photoError && (
                    <Text style={styles.errorText}>{photoError}</Text>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.photoCaptureButton,
                      isTakingPhoto ? styles.buttonDisabled : null,
                    ]}
                    onPress={handleCaptureFrontPhoto}
                    disabled={isTakingPhoto}
                    activeOpacity={0.8}
                  >
                    {isTakingPhoto ? (
                      <View style={styles.buttonLoadingRow}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text style={styles.primaryButtonText}>
                          Saving Photo...
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        Take Front Product Photo
                      </Text>
                    )}
                  </TouchableOpacity>

                  {isRetakingPhoto && (
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => setIsRetakingPhoto(false)}
                      disabled={isTakingPhoto}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <>
                  {scannedResult.status && (
                    <Text style={styles.storageMessage}>
                      {scannedResult.status === 'new'
                        ? 'New code — barcode and front product photo saved for API upload.'
                        : 'Old code — already exists in local file.'}
                    </Text>
                  )}

                  {scannedResult.frontPhotoUri && (
                    <View style={styles.savedPhotoContainer}>
                      <Image
                        source={{ uri: scannedResult.frontPhotoUri }}
                        style={styles.savedPhotoThumbnail}
                        resizeMode="cover"
                      />
                      <View style={styles.savedPhotoInfo}>
                        <Text style={styles.savedPhotoTitle}>
                          Front Product Photo Saved
                        </Text>
                        <Text
                          style={styles.savedPhotoUri}
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {scannedResult.frontPhotoUri}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setPhotoError(null);
                            setIsRetakingPhoto(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.retakeLinkText}>
                            Retake Front Photo
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleStartScanning}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryButtonText}>Scan Another</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : isScanning ? (
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {verifyingProgress > 0
                  ? `Confirming read (${verifyingProgress}/${requiredReads})...`
                  : 'Scanning for barcodes...'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.scanActionButton}
              onPress={handleStartScanning}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Scan Barcode</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  camera: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 36,
  },
  header: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  reticleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: 260,
    height: 160,
    borderWidth: 2.5,
    borderColor: '#38BDF8',
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
  },
  reticlePhotoFrame: {
    width: 260,
    height: 260,
    borderColor: '#A855F7',
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
  },
  reticleIdle: {
    borderColor: 'rgba(148, 163, 184, 0.5)',
    backgroundColor: 'rgba(15, 23, 42, 0.15)',
  },
  reticleVerifying: {
    borderColor: '#FACC15',
    backgroundColor: 'rgba(250, 204, 21, 0.10)',
  },
  reticleActive: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  footer: {
    minHeight: 150,
    justifyContent: 'flex-end',
  },
  scanActionButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  statusPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  statusPillText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  resultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  resultLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeNew: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: '#22C55E',
  },
  statusBadgeOld: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  statusBadgeTextNew: {
    color: '#4ADE80',
  },
  statusBadgeTextOld: {
    color: '#FBBF24',
  },
  resultData: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  storageMessage: {
    color: '#CBD5E1',
    fontSize: 14,
    marginBottom: 14,
  },
  photoPromptSection: {
    marginTop: 4,
    gap: 12,
  },
  photoPromptBanner: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.45)',
    borderRadius: 12,
    padding: 12,
  },
  photoPromptTitle: {
    color: '#E9D5FF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  photoPromptSubtitle: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
  },
  photoCaptureButton: {
    backgroundColor: '#9333EA',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondaryButton: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
  },
  savedPhotoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  savedPhotoThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  savedPhotoInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  savedPhotoTitle: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  savedPhotoUri: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 6,
  },
  retakeLinkText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
  permissionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
