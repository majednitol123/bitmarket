import React from "react";
import renderer, { act } from "react-test-renderer";

// Mock React.lazy to resolve synchronously to our mocked WebView
jest.spyOn(React, "lazy").mockImplementation((fn: any) => {
  const MockWebView = require("react-native-webview").WebView;
  return {
    $$typeof: Symbol.for("react.lazy"),
    _payload: {
      _status: 1, // Resolved
      _result: MockWebView,
    },
    _init: (payload: any) => payload._result,
  } as any;
});

const DAppBrowser = require("../app/(app)/settings/dapp-browser").default;

// Mock styled-components
jest.mock("styled-components/native", () => ({
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
    },
  }),
}));

// Mock expo-router
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock react-redux
const mockState = {
  ethereum: {
    activeIndex: 0,
    globalAddresses: [
      { address: "0x1111222233334444555566667777888899990000" },
    ],
    networks: {
      34: { chainId: 34, chainName: "SecureChain", symbol: "SCA", rpcUrl: "https://rpc.securechain.org" },
      1: { chainId: 1, chainName: "Ethereum Mainnet", symbol: "ETH", rpcUrl: "https://ethereum.publicnode.com" },
      56: { chainId: 56, chainName: "BNB Smart Chain", symbol: "BNB", rpcUrl: "https://binance.llamarpc.com" },
    },
  },
  importedAccounts: {
    activeEvmAddress: null,
  },
};

jest.mock("react-redux", () => ({
  useSelector: (selector: any) => selector(mockState),
  useDispatch: () => jest.fn(),
}));

// Mock SVG
jest.mock("../assets/svg/left-arrow.svg", () => {
  const React = require("react");
  return (props: any) => React.createElement("SvgMock", props);
});

// Mock web3 services
jest.mock("../services/web3Provider", () => ({
  generateWeb3ProviderScript: jest.fn().mockReturnValue("mock provider script"),
}));

jest.mock("../hooks/useStorageState", () => ({
  getPhrase: jest.fn().mockResolvedValue("mock seed phrase"),
}));

jest.mock("../services/EthereumService", () => ({
  EVMService: {
    deriveWalletByIndex: jest.fn().mockReturnValue({
      wallet: {
        privateKey: "0xmockprivatekey",
      },
    }),
  },
}));

jest.mock("../utils/importedKeyStorage", () => ({
  getImportedEvmKey: jest.fn().mockResolvedValue("0xmockkey"),
}));

// Mock react-native-webview and expose its ref handlers for spying
const mockInjectJavaScript = jest.fn();
const mockReload = jest.fn();
const mockGoBack = jest.fn();

jest.mock("react-native-webview", () => {
  const React = require("react");
  const MockWebView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: mockInjectJavaScript,
      reload: mockReload,
      goBack: mockGoBack,
    }));
    return React.createElement("WebView", props);
  });
  return { WebView: MockWebView };
});

describe("DAppBrowser dynamic URL functionality", () => {
  beforeEach(() => {
    mockInjectJavaScript.mockClear();
    mockReload.mockClear();
    mockGoBack.mockClear();
  });

  test("renders correctly with default URL", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<DAppBrowser />);
    });

    const root = tree.root;
    // Find TextInput
    const textInput = root.findByType("TextInput");
    expect(textInput.props.value).toBe("https://lite.coinmask.org/");
  });

  test("accepts input and prepends https:// if missing on submit", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<DAppBrowser />);
    });

    const root = tree.root;
    const textInput = root.findByType("TextInput");

    // Simulate user typing Uniswap URL
    await act(async () => {
      textInput.props.onChangeText("uniswap.org");
    });
    expect(textInput.props.value).toBe("uniswap.org");

    // Simulate user submitting URL
    await act(async () => {
      textInput.props.onSubmitEditing();
    });

    // Check formatting
    expect(textInput.props.value).toBe("https://uniswap.org");

    // Verify script was injected to load new URL
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      "window.location.href = 'https://uniswap.org'; true;"
    );

    // Verify source of WebView is updated
    const webView = root.findByType("WebView");
    expect(webView.props.source.uri).toBe("https://uniswap.org");
  });

  test("leaves https:// intact if user explicitly inputs it on submit", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<DAppBrowser />);
    });

    const root = tree.root;
    const textInput = root.findByType("TextInput");

    // Simulate user typing with https://
    await act(async () => {
      textInput.props.onChangeText("https://app.uniswap.org");
    });

    // Submit
    await act(async () => {
      textInput.props.onSubmitEditing();
    });

    expect(textInput.props.value).toBe("https://app.uniswap.org");
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      "window.location.href = 'https://app.uniswap.org'; true;"
    );
  });

  test("ignores empty or whitespace-only inputs on submit", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<DAppBrowser />);
    });

    const root = tree.root;
    const textInput = root.findByType("TextInput");

    // Simulate user entering whitespace
    await act(async () => {
      textInput.props.onChangeText("   ");
    });

    // Submit
    await act(async () => {
      textInput.props.onSubmitEditing();
    });

    // Should not trigger navigate / inject
    expect(mockInjectJavaScript).not.toHaveBeenCalled();
  });

  test("navigates back to home URL when clicking Home button", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<DAppBrowser />);
    });

    const root = tree.root;
    const textInput = root.findByType("TextInput");

    // First change the URL
    await act(async () => {
      textInput.props.onChangeText("uniswap.org");
      textInput.props.onSubmitEditing();
    });
    // Find Home button (it has text "⌂")
    const { TouchableOpacity, Text } = require("react-native");
    const touchables = root.findAllByType(TouchableOpacity);
    const homeButton = touchables.find((t: any) => {
      const texts = t.findAllByType(Text);
      return texts.some((txt: any) => txt.props.children === "⌂");
    });

    expect(homeButton).toBeDefined();

    // Click Home button
    await act(async () => {
      homeButton.props.onPress();
    });

    // Should be reset to default URL
    expect(textInput.props.value).toBe("https://lite.coinmask.org/");
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      "window.location.href='https://lite.coinmask.org/'; true;"
    );
  });

  test("locks address bar update from WebView navigation state change if user has focus", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<DAppBrowser />);
    });

    const root = tree.root;
    const textInput = root.findByType("TextInput");
    const webView = root.findByType("WebView");

    // Focus input
    await act(async () => {
      textInput.props.onFocus();
    });

    // Type something but don't submit yet
    await act(async () => {
      textInput.props.onChangeText("pancakeswap.finance");
    });

    // Simulate WebView navigation state change (e.g. background page redirect or load event)
    await act(async () => {
      webView.props.onNavigationStateChange({
        url: "https://lite.coinmask.org/some-other-path",
        canGoBack: false,
      });
    });

    // The address bar input should NOT be overwritten by the WebView URL
    expect(textInput.props.value).toBe("pancakeswap.finance");

    // Blur input
    await act(async () => {
      textInput.props.onBlur();
    });

    // Simulate another WebView navigation state change while blurred
    await act(async () => {
      webView.props.onNavigationStateChange({
        url: "https://lite.coinmask.org/another-path",
        canGoBack: false,
      });
    });

    // The address bar input SHOULD now be updated to match the WebView URL
    expect(textInput.props.value).toBe("https://lite.coinmask.org/another-path");
  });

  test("persists connection state on refresh", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<DAppBrowser />);
    });

    const root = tree.root;
    const webView = root.findByType("WebView");

    // Simulate connecting the wallet via eth_requestAccounts
    await act(async () => {
      webView.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: "web3",
            id: 100,
            method: "eth_requestAccounts",
            params: [],
          }),
        },
      });
    });

    // Verify the mock resolved the connection successfully
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining("window._rn_resolveWeb3(100, null, [\"0x1111222233334444555566667777888899990000\"])")
    );
    mockInjectJavaScript.mockClear();

    // Open settings menu (button has text "⋮")
    const { TouchableOpacity, Text } = require("react-native");
    const touchables = root.findAllByType(TouchableOpacity);
    const menuButton = touchables.find((t: any) => {
      const texts = t.findAllByType(Text);
      return texts.some((txt: any) => txt.props.children === "⋮");
    });
    expect(menuButton).toBeDefined();

    await act(async () => {
      menuButton.props.onPress();
    });

    // Find and click the Refresh button in the dropdown
    const menuItems = root.findAllByType(TouchableOpacity);
    const refreshButton = menuItems.find((t: any) => {
      const texts = t.findAllByType(Text);
      return texts.some((txt: any) => txt.props.children.includes("Refresh"));
    });
    expect(refreshButton).toBeDefined();

    await act(async () => {
      refreshButton.props.onPress();
    });

    // Verify WebView reload was triggered
    expect(mockReload).toHaveBeenCalled();

    // Simulate the refreshed page querying eth_accounts to auto-connect
    await act(async () => {
      webView.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: "web3",
            id: 101,
            method: "eth_accounts",
            params: [],
          }),
        },
      });
    });

    // Verify that the browser still responds with the account address
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining("window._rn_resolveWeb3(101, null, [\"0x1111222233334444555566667777888899990000\"])")
    );
  });

  test("manually switches network via selector modal", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<DAppBrowser />);
    });

    const root = tree.root;

    // Open settings menu
    const { TouchableOpacity, Text } = require("react-native");
    const touchables = root.findAllByType(TouchableOpacity);
    const menuButton = touchables.find((t: any) => {
      const texts = t.findAllByType(Text);
      return texts.some((txt: any) => txt.props.children === "⋮");
    });
    expect(menuButton).toBeDefined();

    await act(async () => {
      menuButton.props.onPress();
    });

    // Find and click the "Switch Network" option
    const menuItems = root.findAllByType(TouchableOpacity);
    const switchNetworkOption = menuItems.find((t: any) => {
      const texts = t.findAllByType(Text);
      return texts.some((txt: any) => txt.props.children.includes("Switch Network"));
    });
    expect(switchNetworkOption).toBeDefined();

    await act(async () => {
      switchNetworkOption.props.onPress();
    });

    // Modal is open. Find all TouchableOpacity components representing network items.
    // BNB Smart Chain has Chain ID 56. Let's look for a TouchableOpacity containing text with Chain ID 56.
    const modalItems = root.findAllByType(TouchableOpacity);
    const bscItem = modalItems.find((t: any) => {
      const texts = t.findAllByType(Text);
      return texts.some((txt: any) => {
        const children = txt.props.children;
        const textStr = Array.isArray(children) ? children.join("") : String(children || "");
        return textStr.includes("Chain ID: 56");
      });
    });
    expect(bscItem).toBeDefined();

    // Select BNB Smart Chain
    await act(async () => {
      bscItem.props.onPress();
    });

    // Verify injected chain change notification (Chain 56 -> 0x38 in hex)
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      "window._rn_updateChain('0x38'); true;"
    );

    // Verify WebView reload is triggered
    expect(mockReload).toHaveBeenCalled();
  });

  test("automatically switches network when dApp calls wallet_switchEthereumChain", async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<DAppBrowser />);
    });

    const root = tree.root;
    const webView = root.findByType("WebView");

    // Simulate dApp requesting chain switch to BSC (Chain ID 56 -> 0x38 hex)
    await act(async () => {
      webView.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: "web3",
            id: 200,
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x38" }],
          }),
        },
      });
    });

    // Verify injected script notify (0x38 hex)
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      "window._rn_updateChain('0x38'); true;"
    );

    // Verify RPC response resolves successfully (null)
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining("window._rn_resolveWeb3(200, null, null)")
    );

    // Verify WebView reload is triggered to reflect network change
    expect(mockReload).toHaveBeenCalled();
  });
});
