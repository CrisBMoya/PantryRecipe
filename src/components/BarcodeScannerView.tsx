import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
  ScrollView,
  BackHandler,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  BarcodeScannerConfig,
  ScannedBarcode,
  StoredBarcodeEntry,
} from '../types/barcode';
import { SUPPORTED_BARCODE_TYPES } from '../utils/barcodeValidator';
import { SCANNED_CODES_FILENAME } from '../utils/barcodeStorage';
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
  const [isSavedModalVisible, setIsSavedModalVisible] =
    useState<boolean>(false);
  const [isRecipeModalVisible, setIsRecipeModalVisible] =
    useState<boolean>(false);
  const [isSendOptionsModalVisible, setIsSendOptionsModalVisible] =
    useState<boolean>(false);
  const [isSelectProductsModalVisible, setIsSelectProductsModalVisible] =
    useState<boolean>(false);
  const [selectedBarcodeIds, setSelectedBarcodeIds] = useState<string[]>([]);
  const [lastSentCount, setLastSentCount] = useState<number | null>(null);

  const {
    isScanning,
    scannedResult,
    verifyingProgress,
    requiredReads,
    isUploadingPhoto,
    uploadError,
    isSendingBarcodes,
    sendBarcodesError,
    sendBarcodesSuccessMessage,
    recipeSuggestion,
    storedBarcodes,
    handleBarcodeScanned,
    startScanning,
    resetScanner,
    attachFrontPhoto,
    uploadFrontPhoto,
    sendStoredBarcodesToServer,
    refreshStoredBarcodes,
    removeStoredBarcode,
  } = useBarcodeScanner(config, onScanned);

  const barcodeTypes = config?.barcodeTypes ?? SUPPORTED_BARCODE_TYPES;

  const isAwaitingFrontPhoto =
    scannedResult !== null &&
    ((scannedResult.status === 'new' && !scannedResult.frontPhotoUri) ||
      isRetakingPhoto);

  const scannedProductName =
    scannedResult?.product_name ?? scannedResult?.productInfo?.product_name;
  const scannedProductBrand =
    scannedResult?.brand ?? scannedResult?.productInfo?.brand;
  const scannedSearchResult =
    scannedResult?.search_result ?? scannedResult?.productInfo?.search_result;
  const hasScannedProductInfo = Boolean(
    scannedProductName || scannedProductBrand || scannedSearchResult
  );

  const handleStartScanning = () => {
    setPhotoError(null);
    setIsRetakingPhoto(false);
    startScanning();
  };

  const handleBackToHome = () => {
    setPhotoError(null);
    setIsRetakingPhoto(false);
    resetScanner();
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isRecipeModalVisible) {
          setIsRecipeModalVisible(false);
          return true;
        }
        if (isSelectProductsModalVisible) {
          setIsSelectProductsModalVisible(false);
          return true;
        }
        if (isSendOptionsModalVisible) {
          setIsSendOptionsModalVisible(false);
          return true;
        }
        if (isSavedModalVisible) {
          setIsSavedModalVisible(false);
          return true;
        }
        if (isRetakingPhoto) {
          setIsRetakingPhoto(false);
          return true;
        }
        if (scannedResult || isScanning) {
          setPhotoError(null);
          setIsRetakingPhoto(false);
          resetScanner();
          return true;
        }
        return false;
      }
    );
    return () => subscription.remove();
  }, [
    isRecipeModalVisible,
    isSelectProductsModalVisible,
    isSendOptionsModalVisible,
    isSavedModalVisible,
    isRetakingPhoto,
    scannedResult,
    isScanning,
    resetScanner,
  ]);

  const handlePressSendBarcodesButton = () => {
    const latest = refreshStoredBarcodes();
    if (latest.length === 0) {
      void handleSendBarcodesForRecipe();
      return;
    }
    setIsSendOptionsModalVisible(true);
  };

  const handleSendAllProducts = async () => {
    setIsSendOptionsModalVisible(false);
    await handleSendBarcodesForRecipe();
  };

  const handleOpenSelectProductsModal = () => {
    const latest = refreshStoredBarcodes();
    setSelectedBarcodeIds((prev) => {
      const validPrev = prev.filter((id) =>
        latest.some((entry) => entry.data === id)
      );
      return validPrev.length > 0
        ? validPrev
        : latest.map((entry) => entry.data);
    });
    setIsSendOptionsModalVisible(false);
    setIsSelectProductsModalVisible(true);
  };

  const handleToggleProductSelection = (barcodeData: string) => {
    setSelectedBarcodeIds((prev) =>
      prev.includes(barcodeData)
        ? prev.filter((id) => id !== barcodeData)
        : [...prev, barcodeData]
    );
  };

  const handleSelectAllProducts = () => {
    setSelectedBarcodeIds(storedBarcodes.map((entry) => entry.data));
  };

  const handleClearProductSelection = () => {
    setSelectedBarcodeIds([]);
  };

  const handleSendSelectedProducts = async () => {
    const selectedEntries = storedBarcodes.filter((entry) =>
      selectedBarcodeIds.includes(entry.data)
    );
    if (selectedEntries.length === 0) {
      return;
    }
    setIsSelectProductsModalVisible(false);
    await handleSendBarcodesForRecipe(selectedEntries);
  };

  const handleSendBarcodesForRecipe = async (
    selectedEntries?: StoredBarcodeEntry[]
  ) => {
    const response = await sendStoredBarcodesToServer(selectedEntries);
    if (response) {
      setLastSentCount(response.received_count);
    }
    if (response?.recipe_suggestion) {
      setIsRecipeModalVisible(true);
    }
  };

  const handleOpenSavedModal = () => {
    refreshStoredBarcodes();
    setIsSavedModalVisible(true);
  };

  const handleDeleteBarcode = (barcodeData: string) => {
    removeStoredBarcode(barcodeData);
    setSelectedBarcodeIds((prev) => prev.filter((id) => id !== barcodeData));
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

  const renderSavedItem = ({ item }: { item: StoredBarcodeEntry }) => {
    const productName =
      item.product_name ?? item.productInfo?.product_name ?? 'Not extracted yet';
    const brandName =
      item.brand ?? item.productInfo?.brand ?? 'Not extracted yet';
    const searchResult =
      item.search_result ?? item.productInfo?.search_result;

    return (
      <View style={styles.savedItemCard}>
        <View style={styles.savedItemTopRow}>
          {item.frontPhotoUri ? (
            <Image
              source={{ uri: item.frontPhotoUri }}
              style={styles.savedItemThumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.savedItemPlaceholderThumb}>
              <Text style={styles.savedItemPlaceholderText}>NO PHOTO</Text>
            </View>
          )}

          <View style={styles.savedItemDetails}>
            <Text style={styles.savedItemProductName} numberOfLines={2}>
              {productName}
            </Text>
            <Text style={styles.savedItemBrand} numberOfLines={1}>
              Brand: {brandName}
            </Text>
            <View style={styles.savedItemBarcodeRow}>
              <Text style={styles.savedItemBarcodeData} selectable>
                {item.data}
              </Text>
              <View style={styles.savedItemTypeBadge}>
                <Text style={styles.savedItemTypeText}>
                  {item.type.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {searchResult ? (
          <View style={styles.savedItemSearchSection}>
            <Text style={styles.savedItemSearchLabel}>
              WEB SEARCH DETAILS
            </Text>
            <Text style={styles.savedItemSearchText} numberOfLines={4}>
              {searchResult}
            </Text>
          </View>
        ) : null}

        <View style={styles.savedItemFooterRow}>
          <Text style={styles.savedItemMetaText}>
            Scanned {item.scanCount ?? 1}x
          </Text>
          <TouchableOpacity
            style={styles.deleteItemButton}
            onPress={() => handleDeleteBarcode(item.data)}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteItemButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSelectableItem = ({ item }: { item: StoredBarcodeEntry }) => {
    const productName =
      item.product_name ?? item.productInfo?.product_name ?? 'Not extracted yet';
    const brandName =
      item.brand ?? item.productInfo?.brand ?? 'Not extracted yet';
    const isSelected = selectedBarcodeIds.includes(item.data);

    return (
      <TouchableOpacity
        style={[
          styles.selectableItemCard,
          isSelected ? styles.selectableItemCardSelected : null,
        ]}
        onPress={() => handleToggleProductSelection(item.data)}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.checkboxBox,
            isSelected ? styles.checkboxBoxSelected : null,
          ]}
        >
          {isSelected && <Text style={styles.checkboxCheckmark}>✓</Text>}
        </View>

        {item.frontPhotoUri ? (
          <Image
            source={{ uri: item.frontPhotoUri }}
            style={styles.selectableItemThumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.selectableItemPlaceholderThumb}>
            <Text style={styles.savedItemPlaceholderText}>NO PHOTO</Text>
          </View>
        )}

        <View style={styles.savedItemDetails}>
          <Text style={styles.savedItemProductName} numberOfLines={2}>
            {productName}
          </Text>
          <Text style={styles.savedItemBrand} numberOfLines={1}>
            Brand: {brandName}
          </Text>
          <View style={styles.savedItemBarcodeRow}>
            <Text style={styles.savedItemBarcodeData}>{item.data}</Text>
            <View style={styles.savedItemTypeBadge}>
              <Text style={styles.savedItemTypeText}>
                {item.type.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
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

        {(!scannedResult || isAwaitingFrontPhoto) && (
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
        )}

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
                      Please take a clear photo of the front of the product. It will be saved on your device and sent to the server for product extraction.
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

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={
                      isRetakingPhoto
                        ? () => setIsRetakingPhoto(false)
                        : handleBackToHome
                    }
                    disabled={isTakingPhoto}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {isRetakingPhoto ? 'Cancel' : 'Back'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {scannedResult.status && (
                    <Text style={styles.storageMessage}>
                      {scannedResult.status === 'new'
                        ? isUploadingPhoto
                          ? 'New code — sending front product photo to server...'
                          : hasScannedProductInfo
                            ? 'New code — product details extracted from server.'
                            : 'New code — barcode and front product photo saved.'
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
                        <View style={styles.photoActionLinksRow}>
                          <TouchableOpacity
                            onPress={() => {
                              setPhotoError(null);
                              setIsRetakingPhoto(true);
                            }}
                            disabled={isUploadingPhoto}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.retakeLinkText}>
                              Retake Front Photo
                            </Text>
                          </TouchableOpacity>
                          {!isUploadingPhoto && !hasScannedProductInfo && (
                            <TouchableOpacity
                              onPress={() => void uploadFrontPhoto()}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.retryUploadLinkText}>
                                {uploadError ? 'Retry Upload' : 'Send to Server'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  {isUploadingPhoto && (
                    <View style={styles.uploadingBanner}>
                      <ActivityIndicator color="#38BDF8" size="small" />
                      <Text style={styles.uploadingBannerText}>
                        Analyzing product photo on server...
                      </Text>
                    </View>
                  )}

                  {uploadError && !isUploadingPhoto && (
                    <View style={styles.uploadErrorContainer}>
                      <Text style={styles.errorText}>
                        Server upload failed: {uploadError}
                      </Text>
                    </View>
                  )}

                  {hasScannedProductInfo && (
                    <View style={styles.productInfoCard}>
                      <Text style={styles.productInfoLabel}>
                        EXTRACTED PRODUCT INFO
                      </Text>
                      <Text style={styles.productInfoName}>
                        {scannedProductName || 'Unknown Product'}
                      </Text>
                      <Text style={styles.productInfoBrand}>
                        Brand: {scannedProductBrand || 'Unknown Brand'}
                      </Text>
                      {scannedSearchResult ? (
                        <Text
                          style={styles.productInfoSearchResult}
                          numberOfLines={4}
                        >
                          {scannedSearchResult}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  <View style={styles.resultActionButtons}>
                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        isUploadingPhoto ? styles.buttonDisabled : null,
                      ]}
                      onPress={handleBackToHome}
                      disabled={isUploadingPhoto}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.primaryButtonText}>Back</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.deleteResultButton,
                        isUploadingPhoto ? styles.buttonDisabled : null,
                      ]}
                      onPress={() => handleDeleteBarcode(scannedResult.data)}
                      disabled={isUploadingPhoto}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.deleteResultButtonText}>
                        Delete Product from JSON
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ) : isScanning ? (
            <>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>
                  {verifyingProgress > 0
                    ? `Confirming read (${verifyingProgress}/${requiredReads})...`
                    : 'Scanning for barcodes...'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleBackToHome}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {sendBarcodesSuccessMessage && !isSendingBarcodes && (
                <View style={styles.syncSuccessBanner}>
                  <Text style={styles.syncSuccessText}>
                    {sendBarcodesSuccessMessage}
                  </Text>
                </View>
              )}

              {sendBarcodesError && !isSendingBarcodes && (
                <View style={styles.syncErrorBanner}>
                  <Text style={styles.errorText}>
                    Send failed: {sendBarcodesError}
                  </Text>
                </View>
              )}

              {recipeSuggestion && !isSendingBarcodes && (
                <View style={styles.recipePreviewCard}>
                  <View style={styles.recipePreviewHeader}>
                    <Text style={styles.recipePreviewLabel}>
                      SUGGESTED COOKING RECIPE
                    </Text>
                    <TouchableOpacity
                      onPress={() => setIsRecipeModalVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.recipeExpandLink}>
                        View Full Recipe
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    style={styles.recipePreviewScroll}
                    nestedScrollEnabled={true}
                  >
                    <Text style={styles.recipePreviewText} selectable>
                      {recipeSuggestion}
                    </Text>
                  </ScrollView>
                </View>
              )}

              <TouchableOpacity
                style={styles.scanActionButton}
                onPress={handleStartScanning}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Scan Barcode</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sendBarcodesButton,
                  isSendingBarcodes ? styles.buttonDisabled : null,
                ]}
                onPress={handlePressSendBarcodesButton}
                disabled={isSendingBarcodes}
                activeOpacity={0.8}
              >
                {isSendingBarcodes ? (
                  <View style={styles.buttonLoadingRow}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.sendBarcodesButtonText}>
                      Generating Recipe from {SCANNED_CODES_FILENAME}...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.sendBarcodesButtonText}>
                    Send {SCANNED_CODES_FILENAME} & Suggest Recipe (
                    {storedBarcodes.length})
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.savedProductsButton}
                onPress={handleOpenSavedModal}
                activeOpacity={0.8}
              >
                <Text style={styles.savedProductsButtonText}>
                  Saved Products ({storedBarcodes.length})
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>

      <Modal
        visible={isSavedModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSavedModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitles}>
                <Text style={styles.modalTitle}>Saved Products</Text>
                <Text style={styles.modalSubtitle}>
                  {SCANNED_CODES_FILENAME} ({storedBarcodes.length}{' '}
                  {storedBarcodes.length === 1 ? 'item' : 'items'})
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsSavedModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActionBar}>
              <TouchableOpacity
                style={[
                  styles.sendBarcodesButton,
                  isSendingBarcodes ? styles.buttonDisabled : null,
                ]}
                onPress={handlePressSendBarcodesButton}
                disabled={isSendingBarcodes}
                activeOpacity={0.8}
              >
                {isSendingBarcodes ? (
                  <View style={styles.buttonLoadingRow}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.sendBarcodesButtonText}>
                      Generating Recipe from {SCANNED_CODES_FILENAME}...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.sendBarcodesButtonText}>
                    Send {SCANNED_CODES_FILENAME} & Suggest Recipe (
                    {storedBarcodes.length})
                  </Text>
                )}
              </TouchableOpacity>

              {sendBarcodesSuccessMessage && !isSendingBarcodes && (
                <Text style={styles.syncSuccessText}>
                  {sendBarcodesSuccessMessage}
                </Text>
              )}

              {sendBarcodesError && !isSendingBarcodes && (
                <Text style={styles.errorText}>
                  Send failed: {sendBarcodesError}
                </Text>
              )}

              {recipeSuggestion && !isSendingBarcodes && (
                <TouchableOpacity
                  style={styles.viewRecipeBannerButton}
                  onPress={() => setIsRecipeModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.viewRecipeBannerText}>
                    View Suggested Cooking Recipe
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {storedBarcodes.length === 0 ? (
              <View style={styles.emptyListContainer}>
                <Text style={styles.emptyListTitle}>No saved products yet</Text>
                <Text style={styles.emptyListSubtitle}>
                  Scan a product barcode and take a front photo to save its
                  barcode, product name, and brand in {SCANNED_CODES_FILENAME}.
                </Text>
              </View>
            ) : (
              <FlatList
                data={[...storedBarcodes].reverse()}
                keyExtractor={(item) => item.data}
                renderItem={renderSavedItem}
                contentContainerStyle={styles.savedListContent}
                showsVerticalScrollIndicator={false}
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>

      <Modal
        visible={isSendOptionsModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsSendOptionsModalVisible(false)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>
              Send {SCANNED_CODES_FILENAME}
            </Text>
            <Text style={styles.dialogSubtitle}>
              Would you like to send all saved products or choose a specific
              selection of products for the recipe suggestion?
            </Text>

            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.sendBarcodesButton}
                onPress={() => void handleSendAllProducts()}
                activeOpacity={0.8}
              >
                <Text style={styles.sendBarcodesButtonText}>
                  Send All Products ({storedBarcodes.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.selectSubsetOptionButton}
                onPress={handleOpenSelectProductsModal}
                activeOpacity={0.8}
              >
                <Text style={styles.selectSubsetOptionButtonText}>
                  Select Products to Send...
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setIsSendOptionsModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isSelectProductsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSelectProductsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitles}>
                <Text style={styles.modalTitle}>Select Products to Send</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedBarcodeIds.length} of {storedBarcodes.length}{' '}
                  selected from {SCANNED_CODES_FILENAME}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsSelectProductsModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.selectionControlsBar}>
              <View style={styles.selectionQuickButtonsRow}>
                <TouchableOpacity
                  style={styles.selectionQuickButton}
                  onPress={handleSelectAllProducts}
                  activeOpacity={0.8}
                >
                  <Text style={styles.selectionQuickButtonText}>
                    Select All ({storedBarcodes.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.selectionQuickButton}
                  onPress={handleClearProductSelection}
                  activeOpacity={0.8}
                >
                  <Text style={styles.selectionQuickButtonText}>
                    Clear Selection
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.sendBarcodesButton,
                  selectedBarcodeIds.length === 0 || isSendingBarcodes
                    ? styles.buttonDisabled
                    : null,
                ]}
                onPress={() => void handleSendSelectedProducts()}
                disabled={selectedBarcodeIds.length === 0 || isSendingBarcodes}
                activeOpacity={0.8}
              >
                <Text style={styles.sendBarcodesButtonText}>
                  Send Selected & Suggest Recipe ({selectedBarcodeIds.length})
                </Text>
              </TouchableOpacity>
            </View>

            {storedBarcodes.length === 0 ? (
              <View style={styles.emptyListContainer}>
                <Text style={styles.emptyListTitle}>No saved products yet</Text>
                <Text style={styles.emptyListSubtitle}>
                  Scan a product barcode first to select and send products.
                </Text>
              </View>
            ) : (
              <FlatList
                data={[...storedBarcodes].reverse()}
                keyExtractor={(item) => item.data}
                renderItem={renderSelectableItem}
                contentContainerStyle={styles.savedListContent}
                showsVerticalScrollIndicator={false}
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>

      <Modal
        visible={isRecipeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsRecipeModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitles}>
                <Text style={styles.modalTitle}>Suggested Cooking Recipe</Text>
                <Text style={styles.modalSubtitle}>
                  Based on {lastSentCount ?? storedBarcodes.length}{' '}
                  {(lastSentCount ?? storedBarcodes.length) === 1
                    ? 'product'
                    : 'products'}{' '}
                  from {SCANNED_CODES_FILENAME}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsRecipeModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.recipeModalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.recipeFullCard}>
                <Text style={styles.recipeFullText} selectable>
                  {recipeSuggestion || 'No recipe suggestion available yet.'}
                </Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
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
    gap: 12,
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
  photoActionLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  retryUploadLinkText: {
    color: '#A855F7',
    fontSize: 13,
    fontWeight: '700',
  },
  uploadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 10,
  },
  uploadingBannerText: {
    color: '#E0F2FE',
    fontSize: 13,
    fontWeight: '600',
  },
  uploadErrorContainer: {
    marginBottom: 14,
  },
  productInfoCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  productInfoLabel: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  productInfoName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  productInfoBrand: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  productInfoSearchResult: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
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
  resultActionButtons: {
    gap: 10,
  },
  deleteResultButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  deleteResultButtonText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '700',
  },
  savedProductsButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  savedProductsButtonText: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '700',
  },
  sendBarcodesButton: {
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  sendBarcodesButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  syncSuccessBanner: {
    backgroundColor: 'rgba(22, 163, 74, 0.2)',
    borderWidth: 1,
    borderColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  syncSuccessText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  syncErrorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  modalActionBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  recipePreviewCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#22C55E',
    maxHeight: 220,
    gap: 8,
  },
  recipePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recipePreviewLabel: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  recipeExpandLink: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  recipePreviewScroll: {
    maxHeight: 165,
  },
  recipePreviewText: {
    color: '#F8FAFC',
    fontSize: 13,
    lineHeight: 19,
  },
  viewRecipeBannerButton: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  viewRecipeBannerText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  recipeModalScrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  recipeFullCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  recipeFullText: {
    color: '#F8FAFC',
    fontSize: 15,
    lineHeight: 22,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modalHeaderTitles: {
    flex: 1,
    marginRight: 12,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  modalCloseButton: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalCloseButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyListContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyListTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyListSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  savedListContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 36,
  },
  savedItemCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  savedItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  savedItemThumbnail: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: '#0F172A',
  },
  savedItemPlaceholderThumb: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  savedItemPlaceholderText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  savedItemDetails: {
    flex: 1,
    gap: 3,
  },
  savedItemProductName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  savedItemBrand: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
  savedItemBarcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  savedItemBarcodeData: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  savedItemTypeBadge: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#475569',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  savedItemTypeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  savedItemSearchSection: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 4,
  },
  savedItemSearchLabel: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  savedItemSearchText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  savedItemFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  savedItemMetaText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  deleteItemButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  deleteItemButtonText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '700',
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialogCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  dialogTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  dialogSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  dialogActions: {
    gap: 10,
  },
  selectSubsetOptionButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  selectSubsetOptionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  selectionControlsBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 10,
  },
  selectionQuickButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  selectionQuickButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  selectionQuickButtonText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  selectableItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#334155',
    gap: 12,
  },
  selectableItemCardSelected: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#64748B',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxSelected: {
    borderColor: '#22C55E',
    backgroundColor: '#22C55E',
  },
  checkboxCheckmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  selectableItemThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#0F172A',
  },
  selectableItemPlaceholderThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
});
