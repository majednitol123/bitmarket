import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { store } from "../store";

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

// ─── Register for push notifications and get the Expo Push Token ───
export async function registerForPushNotificationsAsync(): Promise<string | null> {
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

  // Push notifications only work on physical devices for remote push
  if (!Device.isDevice) {
    if (__DEV__) console.log("[Notifications] Running on simulator — push token unavailable, local notifications active.");
    return null;
  }

  // Request permissions (iOS requires explicit alert/badge/sound options)
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowProvisional: true, // iOS 12+ quiet notifications without explicit permission
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    if (__DEV__) console.log("[Notifications] Permission not granted.");
    return null;
  }

  // Get push token (requires a real device + EAS project + FCM credentials on Android)
  try {
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId: "7e6399b3-7de1-4548-bfe8-7d91129eeeeb",
    });
    token = pushToken.data;
    if (__DEV__) console.log("[Notifications] Expo Push Token:", token);
  } catch (e: any) {
    if (__DEV__) console.log("[Notifications] Remote push token unavailable (FCM credentials not configured):", e?.message || e);
  }

  // Also get the native device push token (APNs for iOS, FCM for Android)
  try {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    if (__DEV__) console.log("[Notifications] Native Device Token:", deviceToken.data);
  } catch (e: any) {
    if (__DEV__) console.log("[Notifications] Native device token unavailable:", e?.message || e);
  }

  return token;
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
    "🔗 Account Connected",
    `Your account ${shortAddr} is now connected to BitMarket.`,
    { type: "wallet_connected", address }
  );
}

export async function notifyWalletDisconnected(): Promise<void> {
  await sendLocalNotification(
    "🔓 Account Disconnected",
    "Your account has been disconnected from BitMarket.",
    { type: "wallet_disconnected" }
  );
}

export async function notifySwapReady(
  fromToken: string,
  toToken: string,
  amount: string
): Promise<void> {
  await sendLocalNotification(
    "🔄 Swap Direction Updated",
    `Ready to swap ${amount || "0"} ${fromToken} → ${toToken}`,
    { type: "swap_ready", fromToken, toToken, amount }
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

export async function notifyChainChanged(chainName: string): Promise<void> {
  await sendLocalNotification(
    "🌐 Network Switched",
    `Active blockchain switched to ${chainName}`,
    { type: "chain_changed", chainName }
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
