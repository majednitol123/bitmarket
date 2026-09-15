import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { useAccount } from "@reown/appkit-react-native";
import {
  registerForPushNotificationsAsync,
  syncDeviceRegistrationAsync,
  notifyWalletConnected,
  notifyWalletDisconnected,
} from "../services/notificationService";
import * as Notifications from "expo-notifications";

/**
 * Hook to manage push notification lifecycle:
 * - Registers for push notifications on mount & authenticates device with backend
 * - Syncs wallet address & notification preferences with backend database
 * - Fires local alerts when wallet connects/disconnects (if enabled)
 * - Sets up notification response listener (tap handler)
 */
export function useWalletNotifications() {
  const { address, isConnected } = useAccount();
  const prevConnected = useRef<boolean>(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");

  const notificationsEnabled = useSelector(
    (state: RootState) => state.settings?.notificationsEnabled ?? true
  );

  // ─── Register for push notifications on mount & when wallet updates ───
  useEffect(() => {
    let isMounted = true;

    registerForPushNotificationsAsync(address).then(({ token, deviceId: devId }) => {
      if (isMounted) {
        setPushToken(token);
        setDeviceId(devId);
        if (__DEV__ && token) {
          console.log("[useWalletNotifications] Push registration active:", { token: token.slice(0, 25), devId });
        }
      }
    });

    // Listen for notification taps (user interaction)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (__DEV__) {
          console.log("[useWalletNotifications] Notification tapped:", data);
        }
      }
    );

    // Listen for notifications received while app is in foreground
    const notificationSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        if (__DEV__) {
          console.log(
            "[useWalletNotifications] Notification received in foreground:",
            notification.request.content.title
          );
        }
      }
    );

    return () => {
      isMounted = false;
      responseSubscription.remove();
      notificationSubscription.remove();
    };
  }, [address]);

  // ─── Sync preference changes with backend ───
  useEffect(() => {
    if (address) {
      syncDeviceRegistrationAsync(address, notificationsEnabled);
    }
  }, [notificationsEnabled, address]);

  // ─── Watch wallet connection state changes ───
  useEffect(() => {
    const wasConnected = prevConnected.current;
    prevConnected.current = isConnected;

    // Skip the first render (don't fire on initial mount)
    if (wasConnected === false && isConnected && address && notificationsEnabled) {
      notifyWalletConnected(address);
    } else if (wasConnected === true && !isConnected && notificationsEnabled) {
      notifyWalletDisconnected();
    }
  }, [isConnected, address, notificationsEnabled]);

  return {
    pushToken,
    deviceId,
  };
}
