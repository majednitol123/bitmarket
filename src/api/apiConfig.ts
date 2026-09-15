import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

import axios, { AxiosInstance } from 'axios';

export const getApiBaseUrl = (): string => {
  // 1. Explicit environment variable
  const rawEnvUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (rawEnvUrl) {
    const envUrl = rawEnvUrl.replace(/\/+$/, '');
    // Android emulator cannot reach host via "localhost", rewrite to 10.0.2.2
    if (Platform.OS === 'android' && !Device.isDevice && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return envUrl.replace(/localhost|127\.0\.0\.1/, '10.0.2.2');
    }
    return envUrl;
  }


  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).experienceUrl;

  if (hostUri && typeof hostUri === 'string') {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:4000`;
    }
  }

  // 3. Android Emulator fallback
  if (Platform.OS === 'android' && !Device.isDevice) {
    return 'http://10.0.2.2:4000';
  }


  return 'http://localhost:4000';
};

export const getWebSocketUrl = (): string => {
  const httpUrl = getApiBaseUrl();
  return httpUrl.replace(/^http/, 'ws') + '/ws';
};

export const generateRequestId = (): string => {
  return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
};

export const attachRequestTracing = (instance: AxiosInstance): void => {
  instance.interceptors.request.use((config) => {
    if (!config.headers['X-Request-ID']) {
      config.headers['X-Request-ID'] = generateRequestId();
    }
    return config;
  });
};

// Attach to default global Axios instance
axios.interceptors.request.use((config) => {
  if (!config.headers['X-Request-ID']) {
    config.headers['X-Request-ID'] = generateRequestId();
  }
  return config;
});


