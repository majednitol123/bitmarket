/**
 * web3Provider.ts
 *
 * Generates the JavaScript string injected into the WebView BEFORE any page loads.
 * It creates a fully EIP-1193 compliant `window.ethereum` object that the website
 * can interact with, exactly as if MetaMask were installed.
 *
 * Communication with React Native happens via:
 *   WebView → RN:  window.ReactNativeWebView.postMessage(JSON.stringify(payload))
 *   RN → WebView:  webViewRef.injectJavaScript(`window._rn_resolveWeb3(id, result)`)
 */

export function generateWeb3ProviderScript(
  address: string,
  chainId: number
): string {
  const hexChainId = `0x${chainId.toString(16)}`;

  return `
    (function() {
      // Prevent double-injection
      if (window.__web3Injected) return;
      window.__web3Injected = true;

      // ─── Pending request store ───
      const _pending = {};
      let _requestId = 0;

      // ─── EIP-1193 Event Emitter ───
      const _listeners = {};

      function _emit(event, data) {
        if (_listeners[event]) {
          _listeners[event].forEach(function(fn) {
            try { fn(data); } catch(e) { console.error('[web3] listener error', e); }
          });
        }
      }

      // ─── Resolve callback from React Native ───
      window._rn_resolveWeb3 = function(id, error, result) {
        const p = _pending[id];
        if (!p) return;
        delete _pending[id];
        if (error) {
          p.reject(new Error(error));
        } else {
          p.resolve(result);
        }
      };

      // ─── State ───
      let _connected = false;
      let _accounts = [];
      let _chainId = '${hexChainId}';

      // ─── The Provider ───
      const ethereum = {
        isMetaMask: true,
        isCoinMask: true,
        _metamask: { isUnlocked: function() { return Promise.resolve(true); } },
        chainId: _chainId,
        networkVersion: '${chainId}',
        selectedAddress: null,

        // EIP-1193 request method
        request: function(args) {
          var method = args.method;
          var params = args.params || [];

          // ── Methods handled locally ──
          if (method === 'eth_accounts') {
            if (_accounts.length > 0) {
              return Promise.resolve(_accounts);
            }
            return _sendToRN(method, params).then(function(accounts) {
              _accounts = accounts;
              if (accounts && accounts.length > 0) {
                _connected = true;
                ethereum.selectedAddress = accounts[0];
              }
              return accounts;
            });
          }

          if (method === 'eth_requestAccounts') {
            if (_accounts.length > 0) {
              return Promise.resolve(_accounts);
            }
            // Ask React Native for the account
            return _sendToRN(method, params).then(function(accounts) {
              _accounts = accounts;
              _connected = true;
              ethereum.selectedAddress = accounts[0];
              _emit('connect', { chainId: _chainId });
              _emit('accountsChanged', accounts);
              return accounts;
            });
          }

          if (method === 'eth_chainId') {
            return Promise.resolve(_chainId);
          }

          if (method === 'net_version') {
            return Promise.resolve('${chainId}');
          }

          if (method === 'wallet_switchEthereumChain') {
            return _sendToRN(method, params);
          }

          // ── Methods forwarded to React Native ──
          if (
            method === 'eth_sendTransaction' ||
            method === 'personal_sign' ||
            method === 'eth_sign' ||
            method === 'eth_signTypedData' ||
            method === 'eth_signTypedData_v4'
          ) {
            return _sendToRN(method, params);
          }

          // ── Read-only methods → proxy to RPC ──
          return _sendToRN(method, params);
        },

        // EIP-1193 events
        on: function(event, fn) {
          if (!_listeners[event]) _listeners[event] = [];
          _listeners[event].push(fn);
        },
        removeListener: function(event, fn) {
          if (!_listeners[event]) return;
          _listeners[event] = _listeners[event].filter(function(f) { return f !== fn; });
        },
        removeAllListeners: function(event) {
          if (event) delete _listeners[event];
          else Object.keys(_listeners).forEach(function(k) { delete _listeners[k]; });
        },

        // Legacy methods
        enable: function() {
          return ethereum.request({ method: 'eth_requestAccounts' });
        },
        send: function(method, params) {
          if (typeof method === 'string') {
            return ethereum.request({ method: method, params: params });
          }
          return ethereum.request(method);
        },
        sendAsync: function(payload, callback) {
          ethereum.request({ method: payload.method, params: payload.params })
            .then(function(result) {
              callback(null, { id: payload.id, jsonrpc: '2.0', result: result });
            })
            .catch(function(error) {
              callback(error, null);
            });
        },

        isConnected: function() { return _connected; },
      };

      // ─── Send to React Native ───
      function _sendToRN(method, params) {
        return new Promise(function(resolve, reject) {
          var id = ++_requestId;
          _pending[id] = { resolve: resolve, reject: reject };
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'web3',
            id: id,
            method: method,
            params: params
          }));
        });
      }

      // ─── Handle disconnect from RN ───
      window._rn_disconnect = function() {
        _accounts = [];
        _connected = false;
        ethereum.selectedAddress = null;
        _emit('accountsChanged', []);
        _emit('disconnect', { code: 4900, message: 'Disconnected' });
      };

      // ─── Handle account change from RN ───
      window._rn_updateAccount = function(newAddress) {
        _accounts = [newAddress];
        ethereum.selectedAddress = newAddress;
        _emit('accountsChanged', _accounts);
      };

      // ─── Handle chain change from RN ───
      window._rn_updateChain = function(newChainId) {
        _chainId = newChainId;
        ethereum.chainId = newChainId;
        ethereum.networkVersion = parseInt(newChainId, 16).toString();
        _emit('chainChanged', newChainId);
      };

      // ─── Inject into window ───
      window.ethereum = ethereum;

      // EIP-6963: announce provider
      window.dispatchEvent(new Event('ethereum#initialized'));

      // Some dApps check for window.web3
      window.web3 = { currentProvider: ethereum };

      console.log('[CoinMask Wallet] Web3 provider injected for chain ${chainId}');
    })();
    true; // Required for injectedJavaScriptBeforeContentLoaded
  `;
}
