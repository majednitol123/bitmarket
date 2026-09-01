/**
 * Dashboard Selectors
 *
 * These use createSelector (reselect) to produce STABLE references.
 * The dashboard component subscribes to these instead of raw state slices,
 * preventing re-renders from Immer reference changes in globalAddresses.
 */
import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../index";
import { GeneralStatus } from "../types";

// ─── Base input selectors (cheap, return existing refs) ───
const selectNetworks = (s: RootState) => s.ethereum.networks;
const selectActiveChainId = (s: RootState) => s.ethereum.activeChainId;
const selectGlobalAddresses = (s: RootState) => s.ethereum.globalAddresses;
const selectActiveIndex = (s: RootState) => s.ethereum.activeIndex;

// ─── Derived: current EVM account ───
const selectCurrentEvmAccount = createSelector(
  [selectGlobalAddresses, selectActiveIndex],
  (globalAddresses, activeIndex) => globalAddresses?.[activeIndex ?? 0]
);

// ─── Derived: EVM wallet address (primitive string — no re-render unless value changes) ───
export const selectEthWalletAddress = createSelector(
  [selectCurrentEvmAccount],
  (account) => account?.address || ""
);

// ─── Derived: active chain EVM data ───
export const selectEthBalance = createSelector(
  [selectCurrentEvmAccount, selectActiveChainId],
  (account, chainId) => (chainId != null ? account?.balanceByChain?.[chainId] ?? 0 : 0)
);

export const selectEthFailed = createSelector(
  [selectCurrentEvmAccount, selectActiveChainId],
  (account, chainId) =>
    chainId != null && account?.statusByChain?.[chainId] === GeneralStatus.Failed
);

// ─── Derived: ethereum asset list ───
export const selectEthereumAssets = createSelector(
  [selectNetworks, selectCurrentEvmAccount, selectEthWalletAddress],
  (networks, account, walletAddress) => {
    const list: Array<{
      key: string;
      chainId: number;
      name: string;
      symbol: string;
      balance: number;
      address: string;
      status: GeneralStatus;
    }> = [];

    Object.values(networks).forEach((network) => {
      const chainId = network.chainId;
      const balance = account?.balanceByChain?.[chainId] ?? 0;

      list.push({
        key: `evm-${chainId}`,
        chainId,
        name: network.chainName,
        symbol: network.symbol,
        balance,
        address: walletAddress,
        status: (account?.statusByChain?.[chainId] as GeneralStatus) ?? GeneralStatus.Idle,
      });
    });

    return list;
  }
);

// ─── Derived: chain IDs ───
export const selectEvmChainIds = createSelector(
  [selectNetworks],
  (networks) => Object.keys(networks).map(Number)
);

export const selectAllChainIds = createSelector(
  [selectEvmChainIds],
  (evmIds) => evmIds
);

export const selectActiveChainIds = createSelector(
  [selectCurrentEvmAccount, selectEvmChainIds],
  (account, evmChainIds) => {
    if (!account) return [];
    return evmChainIds.filter(chainId => {
      const balance = account.balanceByChain?.[chainId] ?? 0;
      return balance > 0;
    });
  }
);

// ─── Re-export base selectors for dispatch helpers ───
export {
  selectNetworks,
  selectActiveChainId,
};
