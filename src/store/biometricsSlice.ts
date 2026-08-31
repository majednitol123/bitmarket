import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { REHYDRATE } from "redux-persist";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { RootState } from ".";

// ─── Secure Storage Keys ───
const PASSWORD_KEY = "WALLET_PASSWORD";
const UNLOCKED_AT_KEY = "WALLET_UNLOCKED_AT";
const BIOMETRIC_PREF_KEY = "WALLET_BIOMETRIC_PREF";

// 10 minutes auto-lock timeout
export const UNLOCK_TIMEOUT = 10 * 60 * 1000;

// 5 minutes background auto-lock timeout
export const BACKGROUND_LOCK_TIMEOUT = 5 * 60 * 1000;

// ═══════════════════════════════════════════════════════════
// ASYNC THUNKS
// ═══════════════════════════════════════════════════════════

/**
 * Check if the device has biometric hardware AND enrollment.
 * Returns true only if both are present.
 */
export const checkBiometricAvailability = createAsyncThunk<
  boolean,
  void,
  { state: RootState; rejectValue: string }
>("auth/checkBiometricAvailability", async (_, { rejectWithValue }) => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();
    return (
      enrolledLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG ||
      enrolledLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK
    );
  } catch {
    return rejectWithValue("Failed to check biometric availability.");
  }
});

/**
 * Trigger the OS biometric prompt.
 * Returns true/false — NEVER mutates biometric preference.
 * This is a pure authentication check.
 */
export const authenticateBiometric = createAsyncThunk<
  boolean,
  void,
  { state: RootState; rejectValue: string }
>("auth/authenticateBiometric", async (_, { rejectWithValue }) => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return rejectWithValue("Biometric hardware not available.");

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to access your wallet",
      fallbackLabel: "Use password instead",
      disableDeviceFallback: true,
      cancelLabel: "Cancel",
    });

    if (!result.success) {
      return rejectWithValue("Biometric authentication cancelled or failed.");
    }
    return true;
  } catch {
    return rejectWithValue("Biometric authentication error.");
  }
});

/**
 * Load the user's biometric preference from SecureStore.
 * Called once on app start from _layout.tsx.
 */
export const loadBiometricPreference = createAsyncThunk<
  boolean,
  void,
  { state: RootState }
>("auth/loadBiometricPreference", async () => {
  const pref = await SecureStore.getItemAsync(BIOMETRIC_PREF_KEY);
  return pref === "true";
});

/**
 * Save the user's biometric preference to SecureStore.
 * Called from settings toggle and biometric setup screen.
 */
export const saveBiometricPreference = createAsyncThunk<
  boolean,
  boolean,
  { state: RootState }
>("auth/saveBiometricPreference", async (enabled) => {
  await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, enabled ? "true" : "false");
  return enabled;
});

/**
 * Set wallet password — stores in SecureStore (hardware-encrypted).
 * On iOS: Keychain. On Android: Keystore.
 */
export const setWalletPassword = createAsyncThunk<
  boolean,
  string,
  { state: RootState; rejectValue: string }
>("auth/setWalletPassword", async (password, { rejectWithValue }) => {
  try {
    await SecureStore.setItemAsync(PASSWORD_KEY, password);
    return true;
  } catch {
    return rejectWithValue("Failed to save password securely.");
  }
});

/**
 * Verify wallet password against SecureStore.
 */
export const verifyWalletPassword = createAsyncThunk<
  boolean,
  string,
  { state: RootState; rejectValue: string }
>("auth/verifyWalletPassword", async (password, { rejectWithValue }) => {
  try {
    const saved = await SecureStore.getItemAsync(PASSWORD_KEY);
    if (saved === password) return true;
    return rejectWithValue("Incorrect password.");
  } catch {
    return rejectWithValue("Failed to verify password.");
  }
});

/**
 * Reset wallet password using seed phrase verification.
 * Compares the user-entered phrase against the stored encrypted phrase.
 * If match: overwrites the password in SecureStore and unlocks the wallet.
 */
export const resetWalletPassword = createAsyncThunk<
  boolean,
  { seedPhrase: string; newPassword: string },
  { state: RootState; rejectValue: string }
>("auth/resetWalletPassword", async ({ seedPhrase, newPassword }, { getState, rejectWithValue }) => {
  try {
    // Check lockout
    const { resetLockedUntil } = getState().biometrics;
    if (resetLockedUntil && Date.now() < resetLockedUntil) {
      const secondsLeft = Math.ceil((resetLockedUntil - Date.now()) / 1000);
      return rejectWithValue(`Too many attempts. Try again in ${secondsLeft}s.`);
    }

    // Retrieve stored phrase (dynamic import to avoid pulling crypto-es into module graph at import time)
    const { getPhrase } = await import("../hooks/useStorageState");
    const storedPhrase = await getPhrase();
    if (!storedPhrase) {
      return rejectWithValue("No recovery phrase found on this device.");
    }

    // Normalize and compare: trim whitespace, collapse multiple spaces, lowercase
    const normalize = (p: string) => p.trim().toLowerCase().replace(/\s+/g, " ");
    if (normalize(seedPhrase) !== normalize(storedPhrase)) {
      return rejectWithValue("Seed phrase does not match. Please try again.");
    }

    // Phrase matches — overwrite password
    await SecureStore.setItemAsync(PASSWORD_KEY, newPassword);
    return true;
  } catch {
    return rejectWithValue("Failed to reset password.");
  }
});

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════

export interface LockState {
  /** Whether the wallet is currently unlocked */
  unlocked: boolean;
  /** Timestamp when wallet was last unlocked (for timeout calculation) */
  unlockedAt?: number;
  /** Whether the user has set a password (persisted via redux-persist) */
  passwordSet: boolean;
  /** Whether the device supports biometrics */
  biometricAvailable: boolean;
  /** Whether the user explicitly opted in to biometrics (loaded from SecureStore) */
  biometricPreference: boolean;
  /** Loading state for async operations */
  status: "idle" | "loading" | "rejected";
  /** Human-readable error message */
  errorMessage: string;
  /** Consecutive failed reset attempts (for anti-brute-force) */
  resetAttempts: number;
  /** Timestamp when reset lockout expires */
  resetLockedUntil: number | undefined;
}

const initialState: LockState = {
  unlocked: false,
  unlockedAt: undefined,
  passwordSet: false,
  biometricAvailable: false,
  biometricPreference: false,
  status: "idle",
  errorMessage: "",
  resetAttempts: 0,
  resetLockedUntil: undefined,
};

// ═══════════════════════════════════════════════════════════
// SLICE
// ═══════════════════════════════════════════════════════════

const lockSlice = createSlice({
  name: "lock",
  initialState,
  reducers: {
    /** Lock the wallet and clear the unlock timestamp */
    lockWallet(state) {
      state.unlocked = false;
      state.unlockedAt = undefined;
      state.errorMessage = "";
      // Clear persisted timestamp
      SecureStore.deleteItemAsync(UNLOCKED_AT_KEY).catch(() => {});
    },

    /** Unlock the wallet and record the timestamp */
    unlockWallet(state) {
      state.unlocked = true;
      state.unlockedAt = Date.now();
      state.errorMessage = "";
      SecureStore.setItemAsync(UNLOCKED_AT_KEY, state.unlockedAt.toString()).catch(() => {});
    },

    /** Restore unlock state from a persisted timestamp (app cold start) */
    unlockWalletFromPersisted(state, action: PayloadAction<number>) {
      state.unlocked = true;
      state.unlockedAt = action.payload;
      state.errorMessage = "";
    },

    /** Clear error message */
    clearAuthError(state) {
      state.errorMessage = "";
      state.status = "idle";
    },

    /** Full reset — used when clearing all wallets */
    resetLockState(state) {
      state.unlocked = false;
      state.unlockedAt = undefined;
      state.passwordSet = false;
      state.biometricAvailable = false;
      state.biometricPreference = false;
      state.errorMessage = "";
      state.status = "idle";
      state.resetAttempts = 0;
      state.resetLockedUntil = undefined;
      // Wipe all secure data
      SecureStore.deleteItemAsync(PASSWORD_KEY).catch(() => {});
      SecureStore.deleteItemAsync(UNLOCKED_AT_KEY).catch(() => {});
      SecureStore.deleteItemAsync(BIOMETRIC_PREF_KEY).catch(() => {});
    },

    /** Clear reset attempt counter */
    clearResetState(state) {
      state.resetAttempts = 0;
      state.resetLockedUntil = undefined;
      state.errorMessage = "";
    },
  },

  extraReducers: (builder) => {
    // ─── Biometric Availability ───
    builder.addCase(checkBiometricAvailability.fulfilled, (state, action) => {
      state.biometricAvailable = action.payload;
    });

    // ─── Biometric Authentication ───
    builder.addCase(authenticateBiometric.pending, (state) => {
      state.status = "loading";
      state.errorMessage = "";
    });
    builder.addCase(authenticateBiometric.fulfilled, (state) => {
      state.unlocked = true;
      state.unlockedAt = Date.now();
      state.status = "idle";
      state.errorMessage = "";
      SecureStore.setItemAsync(UNLOCKED_AT_KEY, state.unlockedAt!.toString()).catch(() => {});
    });
    builder.addCase(authenticateBiometric.rejected, (state, action) => {
      state.status = "rejected";
      state.errorMessage = action.payload || "Biometric authentication failed.";
    });

    // ─── Load Biometric Preference (from SecureStore) ───
    builder.addCase(loadBiometricPreference.fulfilled, (state, action) => {
      state.biometricPreference = action.payload;
    });

    // ─── Save Biometric Preference (to SecureStore) ───
    builder.addCase(saveBiometricPreference.fulfilled, (state, action) => {
      state.biometricPreference = action.payload;
    });

    // ─── Set Password ───
    builder.addCase(setWalletPassword.pending, (state) => {
      state.status = "loading";
      state.errorMessage = "";
    });
    builder.addCase(setWalletPassword.fulfilled, (state) => {
      state.passwordSet = true;
      state.unlocked = true;
      state.unlockedAt = Date.now();
      state.status = "idle";
      SecureStore.setItemAsync(UNLOCKED_AT_KEY, state.unlockedAt!.toString()).catch(() => {});
    });
    builder.addCase(setWalletPassword.rejected, (state, action) => {
      state.status = "rejected";
      state.errorMessage = action.payload || "Failed to set password.";
    });

    // ─── Verify Password ───
    builder.addCase(verifyWalletPassword.pending, (state) => {
      state.status = "loading";
      state.errorMessage = "";
    });
    builder.addCase(verifyWalletPassword.fulfilled, (state) => {
      state.unlocked = true;
      state.unlockedAt = Date.now();
      state.status = "idle";
      state.errorMessage = "";
      SecureStore.setItemAsync(UNLOCKED_AT_KEY, state.unlockedAt!.toString()).catch(() => {});
    });
    builder.addCase(verifyWalletPassword.rejected, (state, action) => {
      state.unlocked = false;
      state.status = "rejected";
      state.errorMessage = action.payload || "Incorrect password.";
    });

    // ─── Reset Password (Seed Phrase Recovery) ───
    builder.addCase(resetWalletPassword.pending, (state) => {
      state.status = "loading";
      state.errorMessage = "";
    });
    builder.addCase(resetWalletPassword.fulfilled, (state) => {
      state.unlocked = true;
      state.unlockedAt = Date.now();
      state.passwordSet = true;
      state.status = "idle";
      state.errorMessage = "";
      state.resetAttempts = 0;
      state.resetLockedUntil = undefined;
      SecureStore.setItemAsync(UNLOCKED_AT_KEY, state.unlockedAt!.toString()).catch(() => {});
    });
    builder.addCase(resetWalletPassword.rejected, (state, action) => {
      state.status = "rejected";
      state.errorMessage = action.payload || "Failed to reset password.";
      // Anti-brute-force: increment attempts and apply lockout
      state.resetAttempts += 1;
      if (state.resetAttempts >= 5) {
        state.resetLockedUntil = Date.now() + 5 * 60 * 1000; // 5 minutes
      } else if (state.resetAttempts >= 4) {
        state.resetLockedUntil = Date.now() + 60 * 1000; // 60 seconds
      } else if (state.resetAttempts >= 3) {
        state.resetLockedUntil = Date.now() + 30 * 1000; // 30 seconds
      }
    });

    // ─── REHYDRATE: Force lock on every cold start ───
    // Must come AFTER all addCase calls (Redux Toolkit requirement).
    // redux-persist restores the entire biometrics slice from AsyncStorage,
    // including unlocked: true. We override this on cold start.
    builder.addMatcher(
      (action) => action.type === REHYDRATE,
      (state, action: any) => {
        if (action.payload?.biometrics) {
          state.passwordSet = action.payload.biometrics.passwordSet ?? false;
          state.unlocked = false;
          state.unlockedAt = undefined;
          state.biometricAvailable = false;
          state.errorMessage = "";
          state.status = "idle";
        }
      }
    );
  },
});

export const {
  lockWallet,
  unlockWallet,
  unlockWalletFromPersisted,
  clearAuthError,
  resetLockState,
  clearResetState,
} = lockSlice.actions;

export default lockSlice.reducer;
