import React from "react";
import renderer, { act } from "react-test-renderer";
import { Alert } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { ROUTES } from "../constants/routes";

let mockImportedAccounts: any[] = [];
jest.mock("../store", () => ({
  clearPersistedState: jest.fn(),
  store: {
    getState: () => ({
      importedAccounts: {
        accounts: mockImportedAccounts,
      },
    }),
  },
}));

jest.mock("../utils/importedKeyStorage", () => ({
  deleteImportedEvmKey: jest.fn(),
  deleteImportedSolKey: jest.fn(),
}));

// Mock styled-components before requiring the component
jest.mock("styled-components/native", () => {
  const actual = jest.requireActual("styled-components/native");
  return {
    ...actual,
    __esModule: true,
    useTheme: () => ({
      colors: {
        darker: "#000",
        cardBackground: "#111",
        border: "#222",
        white: "#fff",
        primary: "#ffd700",
        grey: "#888",
        error: "#ff0000",
        lightGrey: "#ccc",
        realWhite: "#fff",
        primaryLinearGradient: ["#000", "#111"],
      },
      fonts: {
        families: {
          openBold: "OpenSans_Bold",
          openRegular: "OpenSans_Regular",
        },
        sizes: {
          title: "20px",
          normal: "16px",
          small: "12px",
        },
        colors: {
          primary: "#fff",
        },
      },
      spacing: {
        medium: "16px",
      },
    }),
  };
});

import { ThemeProvider } from "styled-components/native";
const SettingsIndex = require("../app/(app)/settings/settings-modal").default;

const mockTheme = {
  colors: {
    darker: "#000",
    cardBackground: "#111",
    border: "#222",
    white: "#fff",
    primary: "#ffd700",
    grey: "#888",
    error: "#ff0000",
    lightGrey: "#ccc",
    realWhite: "#fff",
    primaryLinearGradient: ["#000", "#111"],
  },
  fonts: {
    families: {
      openBold: "OpenSans_Bold",
      openRegular: "OpenSans_Regular",
    },
    sizes: {
      title: "20px",
      normal: "16px",
      small: "12px",
    },
    colors: {
      primary: "#fff",
    },
  },
  spacing: {
    medium: "16px",
  },
};

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock alchemy-sdk
jest.mock("alchemy-sdk", () => ({
  Alchemy: jest.fn(),
  Network: {},
}));

// Mock expo-router
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  },
}));

// Mock react-redux
let mockState = {
  biometrics: {
    biometricPreference: false,
    biometricAvailable: false,
  },
  settings: {
    themeMode: "dark",
  },
};

const mockDispatch = jest.fn();
jest.mock("react-redux", () => ({
  useSelector: (selector: any) => selector(mockState),
  useDispatch: () => mockDispatch,
}));

// Mock react-native-safe-area-context
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20 }),
}));

// Mock SVG icons
jest.mock("../assets/svg/edit.svg", () => "FingerprintIcon");
jest.mock("../assets/svg/clear.svg", () => "TrashIcon");
jest.mock("../assets/svg/import-wallet.svg", () => "ImportIcon");
jest.mock("../assets/svg/globe-browser.svg", () => "BrowserIcon");

// Mock EvmWallet and SolanaWallet
jest.mock("../components/EvmWallet", () => ({ EvmWallet: "EvmWallet" }));
jest.mock("../components/SolanaWallet", () => ({ SolanaWallet: "SolanaWallet" }));

// Mock expo-local-authentication
jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
  SecurityLevel: {
    NONE: 0,
    SECRET: 1,
    BIOMETRIC_WEAK: 2,
    BIOMETRIC_STRONG: 3,
  },
}));

jest.mock("../hooks/useStorageState", () => ({
  clearStorage: jest.fn(),
}));

jest.mock("../components/Styles/Layout.styles", () => {
  const React = require("react");
  return {
    SafeAreaContainer: (props: any) => React.createElement("SafeAreaContainer", props),
  };
});

jest.mock("../components/Styles/Gradient", () => {
  const React = require("react");
  return {
    LinearGradientBackground: (props: any) => React.createElement("LinearGradientBackground", props),
  };
});

describe("SettingsIndex Biometric Toggle Tests", () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockState.biometrics.biometricPreference = false;
    mockState.biometrics.biometricAvailable = false;
  });

  test("renders instruction note when biometrics are not set up", async () => {
    mockState.biometrics.biometricAvailable = false;
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <ThemeProvider theme={mockTheme}>
          <SettingsIndex />
        </ThemeProvider>
      );
    });

    const root = tree.root;
    // InstructionText should exist since biometricAvailable is false
    const instructionText = root.findAll((el) => {
      if (el.type !== "Text") return false;
      const textVal = Array.isArray(el.props.children)
        ? el.props.children.join("")
        : el.props.children?.toString() || "";
      return textVal.includes("Note:");
    });
    expect(instructionText.length).toBeGreaterThan(0);
  });

  test("hides instruction note when biometrics are enabled", async () => {
    mockState.biometrics.biometricAvailable = true;
    mockState.biometrics.biometricPreference = true;
    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <ThemeProvider theme={mockTheme}>
          <SettingsIndex />
        </ThemeProvider>
      );
    });

    const root = tree.root;
    // InstructionText should NOT exist
    const instructionText = root.findAll((el) => {
      if (el.type !== "Text") return false;
      const textVal = Array.isArray(el.props.children)
        ? el.props.children.join("")
        : el.props.children?.toString() || "";
      return textVal.includes("Note:");
    });
    expect(instructionText.length).toBe(0);
  });

  test("shows 'Biometrics Not Supported' alert when hardware is missing", async () => {
    mockState.biometrics.biometricAvailable = false;
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);

    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <ThemeProvider theme={mockTheme}>
          <SettingsIndex />
        </ThemeProvider>
      );
    });

    const root = tree.root;
    const optionCard = root.findAll((el) => el.props.onPress && el.props.activeOpacity === 0.7)[0];

    await act(async () => {
      // Toggle to true
      await optionCard.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "Biometrics Not Supported",
      "Your device does not support biometric authentication (Face ID or Touch ID/Fingerprint)."
    );
  });

  test("shows 'Biometrics Not Set Up' alert when templates are not enrolled", async () => {
    mockState.biometrics.biometricAvailable = false;
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(1); // 1 = SECRET (passcode only, no biometrics)

    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <ThemeProvider theme={mockTheme}>
          <SettingsIndex />
        </ThemeProvider>
      );
    });

    const root = tree.root;
    const optionCard = root.findAll((el) => el.props.onPress && el.props.activeOpacity === 0.7)[0];

    await act(async () => {
      await optionCard.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "Biometrics Not Set Up",
      "No enrolled face or fingerprint templates found.\n\nPlease configure Face ID or Touch ID/Fingerprint passcode in your device settings to enable this feature."
    );
  });

  test("shows alert error when biometric authentication fails with lockout", async () => {
    mockState.biometrics.biometricAvailable = true;
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.getEnrolledLevelAsync as jest.Mock).mockResolvedValue(3); // BIOMETRIC_STRONG

    mockDispatch.mockImplementation((thunk) => {
      const mockUnwrapped = {
        unwrap: () => Promise.reject("Biometrics locked out due to too many attempts. Please lock and unlock your device to reset."),
      };
      return mockUnwrapped;
    });

    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <ThemeProvider theme={mockTheme}>
          <SettingsIndex />
        </ThemeProvider>
      );
    });

    const root = tree.root;
    const optionCard = root.findAll((el) => el.props.onPress && el.props.activeOpacity === 0.7)[0];

    await act(async () => {
      await optionCard.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "Biometric Authentication Failed",
      "Biometrics locked out due to too many attempts. Please lock and unlock your device to reset."
    );
  });

  test("clear wallets deletes imported private keys, clears redux persisted state, clearStorage, and navigates", async () => {
    mockImportedAccounts = [
      { id: "1", evmAddress: "0x1111", solAddress: "sol111" },
    ];

    const { deleteImportedEvmKey, deleteImportedSolKey } = require("../utils/importedKeyStorage");
    const { clearPersistedState } = require("../store");
    const { clearStorage } = require("../hooks/useStorageState");
    const { router } = require("expo-router");

    let tree: any;
    await act(async () => {
      tree = renderer.create(
        <ThemeProvider theme={mockTheme}>
          <SettingsIndex />
        </ThemeProvider>
      );
    });

    const root = tree.root;
    const clearOptionCard = root.find((el) => {
      if (!el.props.onPress) return false;
      const textNodes = el.findAll((child) => child.type === "Text");
      return textNodes.some((tn) => {
        const textVal = Array.isArray(tn.props.children)
          ? tn.props.children.join("")
          : tn.props.children?.toString() || "";
        return textVal === "Clear Wallets";
      });
    });

    await act(async () => {
      await clearOptionCard.props.onPress();
    });

    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const clearButtonPress = alertCalls[alertCalls.length - 1][2][1].onPress;

    await act(async () => {
      await clearButtonPress();
    });

    expect(deleteImportedEvmKey).toHaveBeenCalledWith("0x1111");
    expect(deleteImportedSolKey).toHaveBeenCalledWith("sol111");
    expect(clearPersistedState).toHaveBeenCalled();
    expect(clearStorage).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(ROUTES.walletSetup);
  });
});
