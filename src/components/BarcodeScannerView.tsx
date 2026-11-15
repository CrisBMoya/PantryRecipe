import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BarcodeScannerConfig, ScannedBarcode } from '../types/barcode';
import { SUPPORTED_BARCODE_TYPES } from '../utils/barcodeValidator';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';

export interface BarcodeScannerViewProps {
  /**
   * Optional callback fired as soon as a barcode passes checksum and multi-frame consensus.
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
  const {
    scannedResult,
    verifyingProgress,
    requiredReads,
    handleBarcodeScanned,
    resetScanner,
  } = useBarcodeScanner(config, onScanned);

  const barcodeTypes = config?.barcodeTypes ?? SUPPORTED_BARCODE_TYPES;

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
            We need permission to use your camera to scan barcodes and display their text.
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
        style={styles.camera}
        facing="back"
        autofocus="on"
        onBarcodeScanned={scannedResult ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes,
        }}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Barcode Scanner</Text>
          <Text style={styles.headerSubtitle}>
            {scannedResult
              ? 'Barcode verified!'
              : verifyingProgress > 0
                ? `Verifying barcode (${verifyingProgress}/${requiredReads})...`
                : 'Hold steady over a barcode'}
          </Text>
        </View>

        <View style={styles.reticleContainer} pointerEvents="none">
          <View
            style={[
              styles.reticle,
              verifyingProgress > 0 && !scannedResult
                ? styles.reticleVerifying
                : null,
              scannedResult ? styles.reticleActive : null,
            ]}
          />
        </View>

        <View style={styles.footer}>
          {scannedResult ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>
                VERIFIED BARCODE ({scannedResult.type.toUpperCase()})
              </Text>
              <Text style={styles.resultData} selectable>
                {scannedResult.data}
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={resetScanner}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Scan Another</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {verifyingProgress > 0
                  ? `Confirming read (${verifyingProgress}/${requiredReads})...`
                  : 'Scanning for barcodes...'}
              </Text>
            </View>
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
  resultLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  resultData: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 18,
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
