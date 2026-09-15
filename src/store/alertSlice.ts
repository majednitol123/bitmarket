import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  alertApi,
  PriceAlert,
  CreateAlertParams,
  UpdateAlertParams,
  AlertStatus,
} from '../api/alertApi';
import { GeneralStatus } from './types';

export interface AlertState {
  alerts: PriceAlert[];
  status: GeneralStatus;
  createStatus: GeneralStatus;
  updateStatus: GeneralStatus;
  rearmStatus: GeneralStatus;
  deleteStatus: GeneralStatus;
  error: string | null;
  lastFetchedAt: number | null;
  lastTriggeredAlert: PriceAlert | null;
}

const initialState: AlertState = {
  alerts: [],
  status: GeneralStatus.Idle,
  createStatus: GeneralStatus.Idle,
  updateStatus: GeneralStatus.Idle,
  rearmStatus: GeneralStatus.Idle,
  deleteStatus: GeneralStatus.Idle,
  error: null,
  lastFetchedAt: null,
  lastTriggeredAlert: null,
};

const extractErrMsg = (err: any, fallback: string): string => {
  if (typeof err?.response?.data?.error === 'string') {
    return err.response.data.error;
  }
  return err?.response?.data?.error?.message || err?.message || fallback;
};

// Async Thunks
export const fetchAlerts = createAsyncThunk<
  PriceAlert[],
  { walletAddress: string; tokenId?: string; status?: AlertStatus; chain?: string }
>('alerts/fetchAlerts', async ({ walletAddress, tokenId, status, chain }, { rejectWithValue }) => {
  try {
    return await alertApi.getAlerts(walletAddress, tokenId, status, chain);
  } catch (err: any) {
    return rejectWithValue(extractErrMsg(err, 'Failed to fetch alerts'));
  }
});

export const createAlert = createAsyncThunk<PriceAlert, CreateAlertParams>(
  'alerts/createAlert',
  async (params, { rejectWithValue }) => {
    try {
      return await alertApi.createAlert(params);
    } catch (err: any) {
      return rejectWithValue(extractErrMsg(err, 'Failed to create alert'));
    }
  }
);

export const updateAlert = createAsyncThunk<
  PriceAlert,
  { id: number; walletAddress: string; updates: UpdateAlertParams }
>('alerts/updateAlert', async ({ id, walletAddress, updates }, { rejectWithValue }) => {
  try {
    return await alertApi.updateAlert(id, walletAddress, updates);
  } catch (err: any) {
    return rejectWithValue(extractErrMsg(err, 'Failed to update alert'));
  }
});

export const toggleAlertEnabled = createAsyncThunk<
  PriceAlert,
  { id: number; walletAddress: string; enabled: boolean }
>('alerts/toggleEnabled', async ({ id, walletAddress, enabled }, { rejectWithValue }) => {
  try {
    return await alertApi.updateAlert(id, walletAddress, { enabled });
  } catch (err: any) {
    return rejectWithValue(extractErrMsg(err, 'Failed to toggle alert'));
  }
});

export const rearmAlert = createAsyncThunk<
  PriceAlert,
  { id: number; walletAddress: string }
>('alerts/rearmAlert', async ({ id, walletAddress }, { rejectWithValue }) => {
  try {
    return await alertApi.rearmAlert(id, walletAddress);
  } catch (err: any) {
    return rejectWithValue(extractErrMsg(err, 'Failed to re-arm alert'));
  }
});

export const deleteAlert = createAsyncThunk<
  number,
  { id: number; walletAddress: string }
>('alerts/deleteAlert', async ({ id, walletAddress }, { rejectWithValue }) => {
  try {
    await alertApi.deleteAlert(id, walletAddress);
    return id;
  } catch (err: any) {
    return rejectWithValue(extractErrMsg(err, 'Failed to delete alert'));
  }
});

export const alertSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    alertTriggeredRealtime: (
      state,
      action: PayloadAction<{
        alertId: number;
        tokenSymbol?: string;
        currentPrice?: number;
        status?: AlertStatus;
        isOneShot?: boolean;
      }>
    ) => {
      const { alertId, currentPrice, status, isOneShot } = action.payload;
      const idx = state.alerts.findIndex((a) => a.id === alertId);
      if (idx !== -1) {
        const existing = state.alerts[idx];
        const newStatus: AlertStatus = status || (isOneShot ? 'DISABLED' : 'TRIGGERED');
        state.alerts[idx] = {
          ...existing,
          status: newStatus,
          enabled: isOneShot ? false : existing.enabled,
          triggeredAt: new Date().toISOString(),
          triggerCount: existing.triggerCount + 1,
          lastEvaluatedPrice: currentPrice ?? existing.lastEvaluatedPrice,
          lastEvaluatedAt: new Date().toISOString(),
        };
        state.lastTriggeredAlert = state.alerts[idx];
      }
    },
    alertRearmedRealtime: (
      state,
      action: PayloadAction<{
        alertId: number;
        currentPrice?: number;
      }>
    ) => {
      const { alertId, currentPrice } = action.payload;
      const idx = state.alerts.findIndex((a) => a.id === alertId);
      if (idx !== -1) {
        state.alerts[idx] = {
          ...state.alerts[idx],
          status: 'ARMED',
          cooldownUntil: null,
          lastEvaluatedPrice: currentPrice ?? state.alerts[idx].lastEvaluatedPrice,
        };
      }
    },
    clearAlertError: (state) => {
      state.error = null;
    },
    clearLastTriggeredAlert: (state) => {
      state.lastTriggeredAlert = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Alerts
    builder.addCase(fetchAlerts.pending, (state) => {
      state.status = GeneralStatus.Loading;
      state.error = null;
    });
    builder.addCase(fetchAlerts.fulfilled, (state, action) => {
      state.status = GeneralStatus.Success;
      state.alerts = action.payload;
      state.lastFetchedAt = Date.now();
    });
    builder.addCase(fetchAlerts.rejected, (state, action) => {
      state.status = GeneralStatus.Failed;
      state.error = action.payload as string;
    });

    // Create Alert
    builder.addCase(createAlert.pending, (state) => {
      state.createStatus = GeneralStatus.Loading;
      state.error = null;
    });
    builder.addCase(createAlert.fulfilled, (state, action) => {
      state.createStatus = GeneralStatus.Success;
      const idx = state.alerts.findIndex((a) => a.id === action.payload.id);
      if (idx !== -1) {
        state.alerts[idx] = action.payload;
      } else {
        state.alerts.unshift(action.payload);
      }
    });
    builder.addCase(createAlert.rejected, (state, action) => {
      state.createStatus = GeneralStatus.Failed;
      state.error = action.payload as string;
    });

    // Update Alert
    builder.addCase(updateAlert.fulfilled, (state, action) => {
      state.updateStatus = GeneralStatus.Success;
      const idx = state.alerts.findIndex((a) => a.id === action.payload.id);
      if (idx !== -1) {
        state.alerts[idx] = action.payload;
      }
    });

    // Toggle Enabled
    builder.addCase(toggleAlertEnabled.fulfilled, (state, action) => {
      const idx = state.alerts.findIndex((a) => a.id === action.payload.id);
      if (idx !== -1) {
        state.alerts[idx] = action.payload;
      }
    });

    // Rearm Alert
    builder.addCase(rearmAlert.pending, (state) => {
      state.rearmStatus = GeneralStatus.Loading;
    });
    builder.addCase(rearmAlert.fulfilled, (state, action) => {
      state.rearmStatus = GeneralStatus.Success;
      const idx = state.alerts.findIndex((a) => a.id === action.payload.id);
      if (idx !== -1) {
        state.alerts[idx] = action.payload;
      }
    });
    builder.addCase(rearmAlert.rejected, (state, action) => {
      state.rearmStatus = GeneralStatus.Failed;
      state.error = action.payload as string;
    });

    // Delete Alert
    builder.addCase(deleteAlert.pending, (state) => {
      state.deleteStatus = GeneralStatus.Loading;
    });
    builder.addCase(deleteAlert.fulfilled, (state, action) => {
      state.deleteStatus = GeneralStatus.Success;
      state.alerts = state.alerts.filter((a) => a.id !== action.payload);
    });
    builder.addCase(deleteAlert.rejected, (state, action) => {
      state.deleteStatus = GeneralStatus.Failed;
      state.error = action.payload as string;
    });
  },
});

export const {
  alertTriggeredRealtime,
  alertRearmedRealtime,
  clearAlertError,
  clearLastTriggeredAlert,
} = alertSlice.actions;

export default alertSlice.reducer;
