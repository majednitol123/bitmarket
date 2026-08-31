/**
 * Dashboard Selectors
 *
 * These use createSelector (reselect) to produce STABLE references.
 * The dashboard component subscribes to these instead of raw state slices,
 * preventing re-renders from Immer reference changes in globalAddresses/prices.
 */
import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../index";
import { GeneralStatus } from "../types";
import { TESTNET_CHAIN_IDS } from "../../utils/fetchCryptoPrices";

// ─── Base input selectors (cheap, return existing refs) ───
const selectNetworks = (s: RootState) => s.ethereum.networks;
const selectActiveChainId = (s: RootState) => s.ethereum.activeChainId;
const selectGlobalAddresses = (s: RootState) => s.ethereum.globalAddresses;
const selectActiveIndex = (s: RootState) => s.ethereum.activeIndex;
const selectPriceData = (s: RootState) => s.price.data;
const selectSolanaAddresses = (s: RootState) => s.solana.addresses;
const selectSolanaActiveIndex = (s: RootState) => s.solana.activeIndex;
const selectImportedEvmAddress = (s: RootState) => s.importedAccounts?.activeEvmAddress;
const selectImportedSolAddress = (s: RootState) => s.importedAccounts?.activeSolAddress;

// ─── Derived: current EVM account ───
const selectCurrentEvmAccount = createSelector(
  [selectGlobalAddresses, selectActiveIndex, selectImportedEvmAddress],
  (globalAddresses, activeIndex, importedEvm) => {
    if (importedEvm) {
      return globalAddresses?.find(
        (a) => a.address?.toLowerCase() === importedEvm.toLowerCase()
      ) ?? {
        address: importedEvm,
        balanceByChain: {} as Record<number, number>,
        statusByChain: {} as Record<number, GeneralStatus>,
        transactionMetadataByChain: {} as Record<number, any>,
      };
    }
    return globalAddresses?.[activeIndex ?? 0];
  }
);

// ─── Derived: EVM wallet address (primitive string — no re-render unless value changes) ───
export const selectEthWalletAddress = createSelector(
  [selectCurrentEvmAccount],
  (account) => account?.address || ""
);

// ─── Derived: current Solana account ───
const selectCurrentSolAccount = createSelector(
  [selectSolanaAddresses, selectSolanaActiveIndex, selectImportedSolAddress],
  (addresses, activeIndex, importedSol) => {
    if (importedSol) {
      return addresses?.find((a) => a.address === importedSol);
    }
    return addresses?.[activeIndex ?? 0];
  }
);

export const selectSolWalletAddress = createSelector(
  [selectCurrentSolAccount],
  (account) => account?.address || ""
);

export const selectSolBalance = createSelector(
  [selectCurrentSolAccount],
  (account) => account?.balance ?? 0
);

export const selectSolTransactions = createSelector(
  [selectCurrentSolAccount],
  (account) => account?.transactionMetadata?.transactions || []
);

export const selectSolFailed = createSelector(
  [selectCurrentSolAccount],
  (account) => account?.status === GeneralStatus.Failed
);

// ─── Derived: active chain EVM data ───
export const selectEthBalance = createSelector(
  [selectCurrentEvmAccount, selectActiveChainId],
  (account, chainId) => account?.balanceByChain?.[chainId] ?? 0
);

export const selectEthTransactions = createSelector(
  [selectCurrentEvmAccount, selectActiveChainId],
  (account, chainId) =>
    account?.transactionMetadataByChain?.[chainId]?.transactions ?? []
);

export const selectEthFailed = createSelector(
  [selectCurrentEvmAccount, selectActiveChainId],
  (account, chainId) =>
    account?.statusByChain?.[chainId] === GeneralStatus.Failed
);

// ─── Derived: ethereum asset list for the bottom sheet ───
// This is the MOST CRITICAL selector. It builds the full asset list.
// createSelector ensures it only recomputes when networks, prices, or the account changes.
export const selectEthereumAssets = createSelector(
  [selectNetworks, selectPriceData, selectCurrentEvmAccount, selectEthWalletAddress],
  (networks, prices, account, walletAddress) => {
    const list: Array<{
      key: string;
      chainId: number;
      name: string;
      symbol: string;
      balance: number;
      usdValue: number;
      address: string;
      status: GeneralStatus;
    }> = [];

    Object.values(networks).forEach((network) => {
      const chainId = network.chainId;
      const isTestnet = TESTNET_CHAIN_IDS.has(chainId);
      const price = isTestnet ? 0 : (prices?.[chainId]?.usd ?? 0);
      const balance = account?.balanceByChain?.[chainId] ?? 0;

      list.push({
        key: `evm-${chainId}`,
        chainId,
        name: network.chainName,
        symbol: network.symbol,
        balance,
        usdValue: balance * price,
        address: walletAddress,
        status: (account?.statusByChain?.[chainId] as GeneralStatus) ?? GeneralStatus.Idle,
      });
    });

    return list.sort((a, b) => b.usdValue - a.usdValue);
  }
);

const selectSolanaSelectedNetwork = (s: RootState) => s.solana.selectedNetwork ?? "devnet";

// ─── Derived: total USD balance ───
export const selectTotalUsdBalance = createSelector(
  [selectEthereumAssets, selectSolBalance, selectPriceData, selectSolanaSelectedNetwork],
  (assets, solBalance, prices, solNetwork) => {
    const evmTotal = assets.reduce((sum, a) => sum + (a.usdValue ?? 0), 0);
    const solUsd = solNetwork !== "devnet" ? (prices[101]?.usd ?? 0) * solBalance : 0;
    return { totalUsdBalance: evmTotal + solUsd, solUsd };
  }
);

// ─── Derived: chain IDs ───
export const selectEvmChainIds = createSelector(
  [selectNetworks],
  (networks) => Object.keys(networks).map(Number)
);

export const selectAllChainIds = createSelector(
  [selectEvmChainIds],
  (evmIds) => [...evmIds, 101]
);

export const selectActiveChainIds = createSelector(
  [selectCurrentEvmAccount, selectEvmChainIds],
  (account, evmChainIds) => {
    if (!account) return [];
    return evmChainIds.filter(chainId => {
      const balance = account.balanceByChain?.[chainId] ?? 0;
      const hasBalance = balance > 0;
      const hasCachedTxs = (account.transactionMetadataByChain?.[chainId]?.transactions?.length ?? 0) > 0;
      return hasBalance || hasCachedTxs;
    });
  }
);

// ─── Re-export base selectors for dispatch helpers ───
export {
  selectNetworks,
  selectActiveChainId,
  selectPriceData,
};
