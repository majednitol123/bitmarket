import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

export const getApiBaseUrl = (): string => {

  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

 
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).manifest?.debuggerHost;

  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:4000`;
    }
  }


  if (Platform.OS === 'android') {
    if (!Device.isDevice) {
      // Android Emulator
      return 'http://10.0.2.2:4000';
    }
    // Real physical Android device
    return 'http://192.168.110.2:4000';
  }

  // 4. iOS Simulator 
  return envUrl || 'http://localhost:4000';
};
