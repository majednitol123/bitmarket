import { useEffect, useRef } from "react";
import { useAccount } from "@reown/appkit-react-native";
import {
  registerForPushNotificationsAsync,
  notifyWalletConnected,
  notifyWalletDisconnected,
} from "../services/notificationService";
import * as Notifications from "expo-notifications";

/**
 * Hook to manage push notification lifecycle:
 * - Registers for push notifications on mount
 * - Fires a local notification when wallet connects/disconnects
 * - Sets up notification response listener (tap handler)
 */
export function useWalletNotifications() {
  const { address, isConnected } = useAccount();
  const prevConnected = useRef<boolean>(false);
  const pushTokenRef = useRef<string | null>(null);

  // ─── Register for push notifications on mount ───
  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      pushTokenRef.current = token;
      if (__DEV__ && token) {
        console.log("[useWalletNotifications] Push token ready:", token);
      }
    });

    // Listen for notification taps (user interaction)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (__DEV__) {
          console.log("[useWalletNotifications] Notification tapped:", data);
        }
        // TODO: Navigate to relevant screen based on notification type
        // e.g. if (data.type === "swap_ready") router.push("/swap-details");
      }
    );

    // Listen for notifications received while app is in foreground
    const notificationSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        if (__DEV__) {
          console.log("[useWalletNotifications] Notification received in foreground:", notification.request.content.title);
        }
      }
    );

    return () => {
      responseSubscription.remove();
      notificationSubscription.remove();
    };
  }, []);

  // ─── Watch wallet connection state changes ───
  useEffect(() => {
    const wasConnected = prevConnected.current;
    prevConnected.current = isConnected;

    // Skip the first render (don't fire on initial mount)
    if (wasConnected === false && isConnected && address) {
      // Wallet just connected
      notifyWalletConnected(address);
    } else if (wasConnected === true && !isConnected) {
      // Wallet just disconnected
      notifyWalletDisconnected();
    }
  }, [isConnected, address]);

  return {
    pushToken: pushTokenRef.current,
  };
}
