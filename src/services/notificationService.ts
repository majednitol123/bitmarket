import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { store } from "../store";
import { notificationApi } from "../api/notificationApi";

const DEVICE_ID_STORAGE_KEY = "@bitmarket_device_id";

// ─── Configure notification handler (how notifications are displayed when app is in foreground) ───
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Check if notifications are globally enabled in Redux settings ───
export function areNotificationsEnabled(): boolean {
  try {
    const state = store.getState();
    return state.settings?.notificationsEnabled ?? true;
  } catch (e) {
    return true;
  }
}

/**
 * Retrieves or generates a persistent device UUID for this installation
 */
export async function getOrCreateDeviceIdAsync(): Promise<string> {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!deviceId) {
      deviceId = Crypto.randomUUID();
      await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch (e) {
    return "dev-" + Math.random().toString(36).substring(2, 12);
  }
}

// ─── Register for push notifications and get the Expo Push Token ───
export async function registerForPushNotificationsAsync(
  walletAddress?: string
): Promise<{ token: string | null; deviceId: string }> {
  const deviceId = await getOrCreateDeviceIdAsync();
  let token: string | null = null;

  // Android notification channel (must run even on simulator so local notifications work)
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("wallet", {
        name: "BitMarket Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#8B5CF6",
      });
    } catch (e) {
      if (__DEV__) console.log("[Notifications] Could not set Android notification channel:", e);
    }
  }

  // Push notifications on physical devices
  if (Device.isDevice) {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowProvisional: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus === "granted") {
        try {
          const pushToken = await Notifications.getExpoPushTokenAsync({
            projectId: "7e6399b3-7de1-4548-bfe8-7d91129eeeeb",
          });
          token = pushToken.data;
          console.log("[Notifications] Expo Push Token:", token);
        } catch (e: any) {
          console.warn("[Notifications] Remote push token unavailable (FCM setup pending):", e?.message || e);
        }
      }
    } catch (e: any) {
      console.warn("[Notifications] Permission/token check error:", e?.message || e);
    }
  } else {
    console.log("[Notifications] Running on simulator/emulator. Using simulated push registration.");
  }


  if (!token) {
    token = `ExponentPushToken[dev-${deviceId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20)}]`;
  }


  const targetWallet = walletAddress?.trim() || "0x0000000000000000000000000000000000000000";
  try {
    await notificationApi.registerDevice({
      walletAddress: targetWallet,
      deviceId,
      expoPushToken: token,
      platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web",
      appVersion: "1.0.0",
      enabled: areNotificationsEnabled(),
    });
    console.log("[Notifications] Device registered with backend for wallet:", targetWallet);
  } catch (err: any) {
    console.warn("[Notifications] Backend registration warning:", err?.message || err);
  }

  return { token, deviceId };
}

/**
 * Synchronizes device registration and push enabled status with backend
 */
export async function syncDeviceRegistrationAsync(
  walletAddress: string,
  enabled?: boolean
): Promise<void> {
  try {
    const deviceId = await getOrCreateDeviceIdAsync();
    const isEnabled = enabled !== undefined ? enabled : areNotificationsEnabled();

    // Re-register or update status
    await registerForPushNotificationsAsync(walletAddress);

    if (!isEnabled) {
      await notificationApi.unregisterDevice({ deviceId });
    }
  } catch (err: any) {
    if (__DEV__) console.warn("[Notifications] syncDeviceRegistration error:", err?.message || err);
  }
}

// ─── Send a local notification (checks user setting) ───
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!areNotificationsEnabled()) {
    if (__DEV__) console.log("[Notifications] Notifications turned off in Settings. Skipping:", title);
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data ?? {},
      sound: true,
    },
    trigger: null, // Fire immediately
  });
}

// ─── Activity Notification Helpers ───

export async function notifyWalletConnected(address: string): Promise<void> {
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
  await sendLocalNotification(
    " Account Connected",
    `Your account ${shortAddr} is now connected to BitMarket.`,
    { type: "wallet_connected", address }
  );
}

export async function notifyWalletDisconnected(): Promise<void> {
  await sendLocalNotification(
    " Account Disconnected",
    "Your account has been disconnected from BitMarket.",
    { type: "wallet_disconnected" }
  );
}

export async function notifySwapExecuted(
  fromToken: string,
  toToken: string,
  fromAmount: string,
  toAmount: string
): Promise<void> {
  await sendLocalNotification(
    "⚡ Swap Executed",
    `Successfully swapped ${fromAmount} ${fromToken} for ${toAmount} ${toToken}`,
    { type: "swap_executed", fromToken, toToken, fromAmount, toAmount }
  );
}

export async function notifyNotificationsToggled(enabled: boolean): Promise<void> {
  if (enabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🔔 Notifications Enabled",
        body: "You will now receive activity alerts for wallet connections, token swaps, and trade execution.",
        data: { type: "settings_update" },
        sound: true,
      },
      trigger: null,
    });
  }
}
