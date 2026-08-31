import React, { useRef, useState, useCallback, useEffect, Suspense } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Platform,
  BackHandler,
  TextInput,
  ScrollView,
} from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";

const WebView = React.lazy(() =>
  import("react-native-webview").then((m) => ({ default: m.WebView }))
);
import { useSelector } from "react-redux";
import { router } from "expo-router";
import { useTheme } from "styled-components/native";
import { Wallet, parseEther, formatEther, JsonRpcProvider, Network as EthersNetwork } from "ethers";
import type { RootState } from "../../../store";
import type { ThemeType } from "../../../styles/theme";
import { generateWeb3ProviderScript } from "../../../services/web3Provider";
import { getPhrase } from "../../../hooks/useStorageState";
import { EVMService } from "../../../services/EthereumService";
import { getImportedEvmKey } from "../../../utils/importedKeyStorage";
import { truncateWalletAddress } from "../../../utils/truncateWalletAddress";
import NETWORKS from "../../../services/defaultNetwork";
import LeftIcon from "../../../assets/svg/left-arrow.svg";

const DAPP_URL = "https://lite.coinmask.org/";
const SECURECHAIN_CHAIN_ID = 34;

interface Web3Message {
  type: "web3";
  id: number;
  method: string;
  params: any[];
}

interface TxRequest {
  id: number;
  to: string;
  value: string;
  data?: string;
  from?: string;
}

interface SignRequest {
  id: number;
  message: string;
  from: string;
}

export default function DAppBrowser() {
  const theme = useTheme() as ThemeType;
  const webViewRef = useRef<WebView>(null);

  // ── State ──
  const [connected, setConnected] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(DAPP_URL);
  const [urlInput, setUrlInput] = useState(DAPP_URL);
  const [isUrlInputFocused, setIsUrlInputFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const userDisconnected = useRef(false);

  // Approval modals
  const [txRequest, setTxRequest] = useState<TxRequest | null>(null);
  const [signRequest, setSignRequest] = useState<SignRequest | null>(null);
  const [processing, setProcessing] = useState(false);

  // ── Redux state ──
  const activeIndex = useSelector(
    (state: RootState) => state.ethereum.activeIndex ?? 0
  );
  const importedEvm = useSelector(
    (state: RootState) => state.importedAccounts?.activeEvmAddress
  );
  const ethAddress = useSelector((state: RootState) => {
    if (importedEvm) return importedEvm;
    return state.ethereum.globalAddresses?.[state.ethereum.activeIndex ?? 0]?.address ?? "";
  });

  // Use SecureChain as default chain for the browser
  const networksMap = useSelector((state: RootState) => state.ethereum.networks);
  const [chainId, setChainId] = useState(SECURECHAIN_CHAIN_ID);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const network = (networksMap && networksMap[chainId]) || NETWORKS.find((n) => n.chainId === chainId);

  const switchNetwork = useCallback((targetChainId: number) => {
    setChainId(targetChainId);
    setShowNetworkModal(false);

    // Notify injected script in WebView
    const hexChainId = `0x${targetChainId.toString(16)}`;
    webViewRef.current?.injectJavaScript(
      `window._rn_updateChain('${hexChainId}'); true;`
    );
    // Reload page to reflect changes
    webViewRef.current?.reload();
  }, []);

  // ── Injected JS ──
  const injectedScript = generateWeb3ProviderScript(ethAddress, chainId);

  // ── Android back button ──
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [canGoBack]);

  // ── Get private key ──
  const getPrivateKey = useCallback(async (): Promise<string> => {
    if (importedEvm) {
      const key = await getImportedEvmKey(importedEvm);
      if (!key) throw new Error("Failed to retrieve imported private key");
      return key;
    }
    const seedPhrase = await getPhrase();
    if (!seedPhrase) throw new Error("No seed phrase found");
    const { wallet } = EVMService.deriveWalletByIndex(seedPhrase, activeIndex);
    return wallet.privateKey;
  }, [importedEvm, activeIndex]);

  // ── Send response back to WebView ──
  const sendResponse = useCallback(
    (id: number, error: string | null, result: any) => {
      const errorArg = error ? `'${error.replace(/'/g, "\\'")}'` : "null";
      const resultArg = JSON.stringify(result);
      webViewRef.current?.injectJavaScript(
        `window._rn_resolveWeb3(${id}, ${errorArg}, ${resultArg}); true;`
      );
    },
    []
  );

  // ── Handle RPC proxy calls ──
  const handleRpcProxy = useCallback(
    async (id: number, method: string, params: any[]) => {
      try {
        if (!network) throw new Error("Network not configured");
        const ethNetwork = EthersNetwork.from(chainId);
        const provider = new JsonRpcProvider(network.rpcUrl, ethNetwork, {
          staticNetwork: true,
        });
        const result = await provider.send(method, params);
        sendResponse(id, null, result);
      } catch (err: any) {
        sendResponse(id, err.message || "RPC error", null);
      }
    },
    [chainId, network, sendResponse]
  );

  // ── WebView message handler ──
  const onMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      let msg: Web3Message;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return; // Not a Web3 message
      }

      if (msg.type !== "web3") return;

      const { id, method, params } = msg;

      switch (method) {
        case "eth_requestAccounts":
          if (userDisconnected.current) {
            sendResponse(id, "User disconnected", null);
          } else {
            setConnected(true);
            sendResponse(id, null, [ethAddress]);
          }
          break;

        case "eth_accounts":
          sendResponse(id, null, connected ? [ethAddress] : []);
          break;

        case "eth_chainId":
          sendResponse(id, null, `0x${chainId.toString(16)}`);
          break;

        case "net_version":
          sendResponse(id, null, chainId.toString());
          break;

        case "eth_sendTransaction": {
          const txParams = params[0];
          setTxRequest({
            id,
            to: txParams.to || "",
            value: txParams.value || "0x0",
            data: txParams.data,
            from: txParams.from,
          });
          break;
        }

        case "personal_sign": {
          setSignRequest({
            id,
            message: params[0],
            from: params[1],
          });
          break;
        }

        case "eth_sign": {
          setSignRequest({
            id,
            message: params[1],
            from: params[0],
          });
          break;
        }

        case "wallet_switchEthereumChain": {
          const switchParams = params[0];
          if (!switchParams || !switchParams.chainId) {
            sendResponse(id, "Invalid switch params", null);
            break;
          }
          const targetChainIdHex = switchParams.chainId;
          const targetChainId = parseInt(targetChainIdHex, 16);
          const targetNet = (networksMap && networksMap[targetChainId]) || NETWORKS.find((n) => n.chainId === targetChainId);

          if (targetNet) {
            setChainId(targetChainId);
            webViewRef.current?.injectJavaScript(
              `window._rn_updateChain('${targetChainIdHex}'); true;`
            );
            sendResponse(id, null, null);
            webViewRef.current?.reload();
          } else {
            sendResponse(id, `Chain ID ${targetChainId} not configured in wallet`, null);
          }
          break;
        }

      default:
        // Proxy other methods to RPC
        handleRpcProxy(id, method, params);
        break;
      }
    },
    [ethAddress, chainId, connected, sendResponse, handleRpcProxy, networksMap]
  );

  // ── Approve transaction ──
  const approveTx = useCallback(async () => {
    if (!txRequest) return;
    setProcessing(true);
    try {
      const privateKey = await getPrivateKey();
      if (!network) throw new Error("Network not configured");

      const ethNetwork = EthersNetwork.from(chainId);
      const provider = new JsonRpcProvider(network.rpcUrl, ethNetwork, {
        staticNetwork: true,
      });
      const wallet = new Wallet(privateKey, provider);

      const tx = await wallet.sendTransaction({
        to: txRequest.to,
        value: txRequest.value,
        data: txRequest.data || "0x",
      });

      sendResponse(txRequest.id, null, tx.hash);
      setTxRequest(null);
    } catch (err: any) {
      sendResponse(txRequest.id, err.message || "Transaction failed", null);
      setTxRequest(null);
    } finally {
      setProcessing(false);
    }
  }, [txRequest, getPrivateKey, chainId, network, sendResponse]);

  // ── Approve sign ──
  const approveSign = useCallback(async () => {
    if (!signRequest) return;
    setProcessing(true);
    try {
      const privateKey = await getPrivateKey();
      const wallet = new Wallet(privateKey);
      const signature = await wallet.signMessage(
        signRequest.message.startsWith("0x")
          ? Buffer.from(signRequest.message.slice(2), "hex")
          : signRequest.message
      );
      sendResponse(signRequest.id, null, signature);
      setSignRequest(null);
    } catch (err: any) {
      sendResponse(signRequest.id, err.message || "Signing failed", null);
      setSignRequest(null);
    } finally {
      setProcessing(false);
    }
  }, [signRequest, getPrivateKey, sendResponse]);

  // ── Reject handlers ──
  const rejectTx = useCallback(() => {
    if (txRequest) {
      sendResponse(txRequest.id, "User rejected the transaction", null);
      setTxRequest(null);
    }
  }, [txRequest, sendResponse]);

  const rejectSign = useCallback(() => {
    if (signRequest) {
      sendResponse(signRequest.id, "User rejected the request", null);
      setSignRequest(null);
    }
  }, [signRequest, sendResponse]);

  // ── Disconnect ──
  const disconnect = useCallback(() => {
    userDisconnected.current = true;
    setConnected(false);
    setShowMenu(false);
    webViewRef.current?.injectJavaScript(
      `window._rn_disconnect(); true;`
    );
  }, []);

  // ── Refresh ──
  const refresh = useCallback(() => {
    userDisconnected.current = false;
    setShowMenu(false);
    webViewRef.current?.reload();
  }, []);

  // ── Format value for display ──
  const formatTxValue = (hexValue: string): string => {
    try {
      const wei = BigInt(hexValue);
      return formatEther(wei);
    } catch {
      return "0";
    }
  };

  const handleUrlSubmit = () => {
    let formattedUrl = urlInput.trim();
    if (!formattedUrl) return;

    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    setCurrentUrl(formattedUrl);
    setUrlInput(formattedUrl);
    webViewRef.current?.injectJavaScript(
      `window.location.href = '${formattedUrl}'; true;`
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.darker }]}>
      <StatusBar barStyle="light-content" />

      {/* ═══ Top Bar ═══ */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: theme.colors.cardBackground,
            borderBottomColor: theme.colors.border,
            paddingTop: Platform.OS === "ios" ? 50 : StatusBar.currentHeight ?? 24,
          },
        ]}
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.back()}
        >
          <LeftIcon width={32} height={32} fill={theme.colors.white} />
        </TouchableOpacity>

        {/* URL bar */}
        <View
          style={[
            styles.urlBar,
            { backgroundColor: theme.colors.darker, borderColor: theme.colors.border },
          ]}
        >
          <TextInput
            style={[styles.urlText, { color: theme.colors.white, flex: 1, paddingVertical: 0 }]}
            value={urlInput}
            onChangeText={setUrlInput}
            onSubmitEditing={handleUrlSubmit}
            placeholder="Search or enter URL"
            placeholderTextColor={theme.colors.grey}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onFocus={() => setIsUrlInputFocused(true)}
            onBlur={() => setIsUrlInputFocused(false)}
            selectTextOnFocus={true}
          />
        </View>

        {/* Home button */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => {
            setCurrentUrl(DAPP_URL);
            setUrlInput(DAPP_URL);
            webViewRef.current?.injectJavaScript(`window.location.href='${DAPP_URL}'; true;`);
          }}
        >
          <Text style={[styles.navIcon, { color: theme.colors.white }]}>⌂</Text>
        </TouchableOpacity>

        {/* Menu button */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setShowMenu(!showMenu)}
        >
          <Text style={[styles.navIcon, { color: theme.colors.white }]}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ Dropdown Menu ═══ */}
      {showMenu && (
        <View
          style={[
            styles.menuDropdown,
            {
              backgroundColor: theme.colors.cardBackground,
              borderColor: theme.colors.border,
              top: Platform.OS === "ios" ? 100 : (StatusBar.currentHeight ?? 24) + 56,
            },
          ]}
        >
          <TouchableOpacity style={styles.menuItem} onPress={refresh}>
            <Text style={[styles.menuItemText, { color: theme.colors.white }]}>
               Refresh
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setShowNetworkModal(true); }}>
            <Text style={[styles.menuItemText, { color: theme.colors.white }]}>
               Switch Network
            </Text>
          </TouchableOpacity>
          {connected && (
            <TouchableOpacity style={styles.menuItem} onPress={disconnect}>
              <Text style={[styles.menuItemText, { color: theme.colors.error }]}>
                 Disconnect
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ═══ Network Selector Modal ═══ */}
      <Modal
        visible={showNetworkModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNetworkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.lightDark },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.white }]}>
              Switch Network
            </Text>

            <View style={[styles.modalDivider, { backgroundColor: theme.colors.border }]} />

            <View style={{ maxHeight: 300 }}>
              <ScrollView>
                {Object.values(networksMap || {}).map((net: any) => {
                  const isSelected = net.chainId === chainId;
                  return (
                    <TouchableOpacity
                      key={net.chainId}
                      style={[
                        styles.networkItem,
                        {
                          backgroundColor: isSelected
                            ? "rgba(255, 215, 0, 0.08)"
                            : "transparent",
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.border,
                        },
                      ]}
                      onPress={() => switchNetwork(net.chainId)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.networkName,
                            { color: isSelected ? theme.colors.primary : theme.colors.white },
                          ]}
                        >
                          {net.chainName || net.name}
                        </Text>
                        <Text style={{ color: theme.colors.grey, fontSize: 12, marginTop: 2 }}>
                          Chain ID: {net.chainId} • {net.symbol || "ETH"}
                        </Text>
                      </View>
                      {isSelected && (
                        <View
                          style={[
                            styles.selectedDot,
                            { backgroundColor: theme.colors.primary },
                          ]}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={[styles.modalDivider, { backgroundColor: theme.colors.border }]} />

            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.rejectButton,
                { borderColor: theme.colors.border, width: "100%", height: 48 },
              ]}
              onPress={() => setShowNetworkModal(false)}
            >
              <Text style={[styles.rejectText, { color: theme.colors.white }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══ WebView ═══ */}
      <Suspense fallback={<ActivityIndicator size="large" color={theme.colors.primary} style={{ flex: 1 }} />}>
        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          style={styles.webView}
          injectedJavaScriptBeforeContentLoaded={injectedScript}
          onMessage={onMessage}
          onNavigationStateChange={(navState) => {
            setCurrentUrl(navState.url);
            if (!isUrlInputFocused) {
              setUrlInput(navState.url);
            }
            setCanGoBack(navState.canGoBack);
          }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          allowsBackForwardNavigationGestures={true}
          sharedCookiesEnabled={true}
          cacheEnabled={true}
          onShouldStartLoadWithRequest={(request) => {
            // Block navigation away from CoinMask for security
            if (
              request.url.startsWith("https://lite.coinmask.org") ||
              request.url.startsWith("https://coinmask.org") ||
              request.url.startsWith("about:") ||
              request.url.startsWith("data:")
            ) {
              return true;
            }
            // Allow google fonts, etc.
            if (
              request.url.includes("fonts.googleapis.com") ||
              request.url.includes("fonts.gstatic.com") ||
              request.url.includes("googletagmanager.com")
            ) {
              return true;
            }
            return true; // Allow all for now since dApp may load external resources
          }}
        />
      </Suspense>

      {/* ═══ Loading Bar ═══ */}
      {loading && (
        <View style={[styles.loadingBar, { backgroundColor: theme.colors.primary }]} />
      )}

      {/* ═══ Transaction Approval Modal ═══ */}
      <Modal
        visible={!!txRequest}
        transparent
        animationType="slide"
        onRequestClose={rejectTx}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.lightDark },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.white }]}>
              Confirm Transaction
            </Text>

            <View style={[styles.modalDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: theme.colors.lightGrey }]}>
                To
              </Text>
              <Text style={[styles.modalValue, { color: theme.colors.white }]}>
                {txRequest ? truncateWalletAddress(txRequest.to) : ""}
              </Text>
            </View>

            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: theme.colors.lightGrey }]}>
                Value
              </Text>
              <Text style={[styles.modalValue, { color: theme.colors.primary }]}>
                {txRequest ? formatTxValue(txRequest.value) : "0"} {network?.symbol || "ETH"}
              </Text>
            </View>

            {txRequest?.data && txRequest.data !== "0x" && (
              <View style={styles.modalRow}>
                <Text style={[styles.modalLabel, { color: theme.colors.lightGrey }]}>
                  Contract Call
                </Text>
                <Text style={[styles.modalValue, { color: theme.colors.white }]}>
                  Yes
                </Text>
              </View>
            )}

            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: theme.colors.lightGrey }]}>
                Network
              </Text>
              <Text style={[styles.modalValue, { color: theme.colors.white }]}>
                {network?.chainName || "Unknown"}
              </Text>
            </View>

            <View style={[styles.modalDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.rejectButton,
                  { borderColor: theme.colors.error },
                ]}
                onPress={rejectTx}
                disabled={processing}
              >
                <Text style={[styles.rejectText, { color: theme.colors.error }]}>
                  Reject
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.approveButton,
                  { backgroundColor: theme.colors.primary },
                ]}
                onPress={approveTx}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color={theme.colors.realWhite} />
                ) : (
                  <Text style={[styles.approveText, { color: theme.colors.realWhite }]}>
                    Approve
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ Sign Approval Modal ═══ */}
      <Modal
        visible={!!signRequest}
        transparent
        animationType="slide"
        onRequestClose={rejectSign}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.lightDark },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.white }]}>
              Sign Message
            </Text>

            <View style={[styles.modalDivider, { backgroundColor: theme.colors.border }]} />

            <View style={[styles.messageBox, { backgroundColor: theme.colors.dark }]}>
              <Text
                style={[styles.messageText, { color: theme.colors.white }]}
                numberOfLines={10}
              >
                {signRequest?.message || ""}
              </Text>
            </View>

            <View style={styles.modalRow}>
              <Text style={[styles.modalLabel, { color: theme.colors.lightGrey }]}>
                From
              </Text>
              <Text style={[styles.modalValue, { color: theme.colors.white }]}>
                {signRequest ? truncateWalletAddress(signRequest.from) : ""}
              </Text>
            </View>

            <View style={[styles.modalDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.rejectButton,
                  { borderColor: theme.colors.error },
                ]}
                onPress={rejectSign}
                disabled={processing}
              >
                <Text style={[styles.rejectText, { color: theme.colors.error }]}>
                  Reject
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.approveButton,
                  { backgroundColor: theme.colors.primary },
                ]}
                onPress={approveSign}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color={theme.colors.realWhite} />
                ) : (
                  <Text style={[styles.approveText, { color: theme.colors.realWhite }]}>
                    Sign
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    gap: 4,
  },
  navButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  navIcon: {
    fontSize: 20,
    fontWeight: "bold",
  },
  urlBar: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  urlText: {
    fontSize: 13,
  },
  connectedChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4ade80",
  },
  connectedText: {
    fontSize: 11,
    fontWeight: "700",
  },
  menuDropdown: {
    position: "absolute",
    right: 8,
    zIndex: 100,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    minWidth: 160,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: "600",
  },
  webView: {
    flex: 1,
  },
  loadingBar: {
    height: 3,
    width: "100%",
  },
  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  modalDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 16,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  modalLabel: {
    fontSize: 14,
  },
  modalValue: {
    fontSize: 14,
    fontWeight: "700",
    maxWidth: "60%",
    textAlign: "right",
  },
  messageBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  rejectButton: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  approveButton: {},
  rejectText: {
    fontSize: 16,
    fontWeight: "700",
  },
  approveText: {
    fontSize: 16,
    fontWeight: "700",
  },
  networkItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  networkName: {
    fontSize: 16,
    fontWeight: "600",
  },
  selectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
