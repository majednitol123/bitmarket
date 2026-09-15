import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import {
  realtimeService,
  RealtimeMessage,
} from '../services/realtimeService';
import {
  fetchMarketOverview,
  fetchMarketTokens,
  setRealtimeConnected,
  setSnapshotVersion,
  selectSelectedCategory,
  selectRealtimeConnected,
  selectSnapshotVersion,
} from '../store/marketSlice';
import {
  alertTriggeredRealtime,
  alertRearmedRealtime,
} from '../store/alertSlice';
import Toast from 'react-native-toast-message';
import { useAccount } from '@reown/appkit-react-native';

export function useRealtimeSubscription() {
  const dispatch = useDispatch<AppDispatch>();
  const selectedCategory = useSelector(selectSelectedCategory);
  const isConnected = useSelector(selectRealtimeConnected);
  const snapshotVersion = useSelector(selectSnapshotVersion);
  const { address } = useAccount();

  const [lastMessageTime, setLastMessageTime] = useState<number | null>(null);
  const selectedCategoryRef = useRef(selectedCategory);
  selectedCategoryRef.current = selectedCategory;

  useEffect(() => {
    // 1. Hook into connection state
    const unsubConnection = realtimeService.onConnectionChange((connected) => {
      dispatch(setRealtimeConnected(connected));
    });

    // 2. Hook into inbound real-time events
    const unsubMessage = realtimeService.onMessage((msg: RealtimeMessage) => {
      setLastMessageTime(msg.timestamp);

      if (msg.snapshotVersion > 0) {
        dispatch(setSnapshotVersion(msg.snapshotVersion));
      }

      if (msg.eventType === 'reconnected') {
        // Post-reconnect synchronization (Section 39)
        dispatch(fetchMarketOverview({ forceRefresh: false }));
        dispatch(
          fetchMarketTokens({
            category: selectedCategoryRef.current,
            page: 1,
            limit: 50,
            forceRefresh: false,
          })
        );
        return;
      }

      if (msg.eventType === 'snapshot_updated') {
        if (msg.resource === 'market:tokens') {
          // Zero provider overhead: client pulls fresh warmed snapshot from Redis cache
          dispatch(
            fetchMarketTokens({
              category: selectedCategoryRef.current,
              page: 1,
              limit: 50,
              forceRefresh: false,
            })
          );
        } else if (msg.resource === 'market:overview') {
          dispatch(fetchMarketOverview({ forceRefresh: false }));
        }
      }

      if (msg.resource === 'price_alert') {
        if (msg.eventType === 'alert_triggered') {
          const { alertId, tokenSymbol, currentPrice, status, isOneShot } = msg.metadata || {};
          dispatch(
            alertTriggeredRealtime({
              alertId,
              tokenSymbol,
              currentPrice,
              status,
              isOneShot,
            })
          );
          Toast.show({
            type: 'info',
            text1: `🚨 ${tokenSymbol || 'Crypto'} Price Alert!`,
            text2: `${tokenSymbol || 'Token'} reached $${
              typeof currentPrice === 'number'
                ? currentPrice >= 1
                  ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : currentPrice.toFixed(6)
                : currentPrice
            }`,
            visibilityTime: 6000,
          });
        } else if (msg.eventType === 'alert_rearmed') {
          const { alertId, currentPrice } = msg.metadata || {};
          dispatch(alertRearmedRealtime({ alertId, currentPrice }));
        }
      }
    });

    // 3. Connect to backend gateway
    realtimeService.connect(address);

    return () => {
      unsubConnection();
      unsubMessage();
    };
  }, [dispatch, address]);

  return {
    isConnected,
    snapshotVersion,
    lastMessageTime,
  };
}
