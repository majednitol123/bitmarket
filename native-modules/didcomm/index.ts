import { NativeModules, Platform } from "react-native";
import Constants from "expo-constants";

const isExpoGo = Constants.appOwnership === "expo";

const Didcomm = !isExpoGo && NativeModules.Didcomm
  ? NativeModules.Didcomm
  : null;

export default {
  helloWorld: async (): Promise<string> => {
    if (!Didcomm) {
      console.log("[Didcomm] Native module not available in Expo Go (using JS fallback)");
      return "Hello from JS (Expo Go)";
    }
    return Didcomm.helloWorld();
  },
};
