import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

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

// ─── Register for push notifications and get the Expo Push Token ───
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  // Push notifications only work on physical devices for remote push
  if (!Device.isDevice) {
    if (__DEV__) console.log("[Notifications] Running on simulator — push token unavailable, local notifications still work.");
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

  // Get push token (requires a real device + EAS project)
  try {
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId: "7e6399b3-7de1-4548-bfe8-7d91129eeeeb",
    });
    token = pushToken.data;
    if (__DEV__) console.log("[Notifications] Expo Push Token:", token);
  } catch (e) {
    if (__DEV__) console.log("[Notifications] Could not get push token (expected on simulator):", e);
  }

  // Also get the native device push token (APNs for iOS, FCM for Android)
  // This is useful when you implement your own backend push service
  try {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    if (__DEV__) console.log("[Notifications] Native Device Token:", deviceToken.data);
  } catch (e) {
    if (__DEV__) console.log("[Notifications] Could not get device token:", e);
  }

  // Android notification channel (iOS uses categories instead, handled by the OS)
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("wallet", {
      name: "Wallet Notifications",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#3772FF",
    });
  }

  return token;
}

// ─── Send a local notification (for testing) ───
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
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

// ─── Wallet-specific notification helpers ───
export async function notifyWalletConnected(address: string): Promise<void> {
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
  await sendLocalNotification(
    "🔗 Wallet Connected",
    `Your wallet ${shortAddr} is now connected to BitMarket.`,
    { type: "wallet_connected", address }
  );
}

export async function notifyWalletDisconnected(): Promise<void> {
  await sendLocalNotification(
    "🔓 Wallet Disconnected",
    "Your wallet has been disconnected from BitMarket.",
    { type: "wallet_disconnected" }
  );
}

export async function notifySwapReady(
  fromToken: string,
  toToken: string,
  amount: string
): Promise<void> {
  await sendLocalNotification(
    "🔄 Swap Ready",
    `Ready to swap ${amount} ${fromToken} → ${toToken}`,
    { type: "swap_ready", fromToken, toToken, amount }
  );
}
