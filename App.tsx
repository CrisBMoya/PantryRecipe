import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { BarcodeScannerView } from './src/components/BarcodeScannerView';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <BarcodeScannerView />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
