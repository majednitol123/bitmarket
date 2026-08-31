import { getRandomValues as expoCryptoGetRandomValues } from "expo-crypto";
import { Buffer } from "buffer";

// Only polyfill missing process properties — do NOT overwrite process.env
// (Expo's babel-preset-expo injects EXPO_PUBLIC_* env vars at build time)
if (typeof global.process !== 'undefined') {
  if (typeof global.process.nextTick !== 'function') {
    global.process.nextTick = (fn: any, ...args: any[]) => setTimeout(() => fn(...args), 0);
  }
  if (!global.process.version) {
    (global.process as any).version = 'v16.0.0';
  }
  if (!global.process.browser) {
    (global.process as any).browser = true;
  }
} else {
  (global as any).process = {
    env: { NODE_ENV: __DEV__ ? 'development' : 'production' },
    version: 'v16.0.0',
    browser: true,
    nextTick: (fn: any, ...args: any[]) => setTimeout(() => fn(...args), 0),
  };
}

global.Buffer = Buffer;

// getRandomValues polyfill
class Crypto {
  getRandomValues = expoCryptoGetRandomValues;
}

const webCrypto = typeof crypto !== "undefined" ? crypto : new Crypto();

(() => {
  if (typeof crypto === "undefined") {
    Object.defineProperty(window, "crypto", {
      configurable: true,
      enumerable: true,
      get: () => webCrypto,
    });
  }
})();