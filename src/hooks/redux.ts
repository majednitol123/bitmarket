// hooks/useLoadingState.ts
import { useSelector } from "react-redux";
import type { RootState } from "../store";
import { GeneralStatus } from "../store/types";

/**
 * Hook to determine if any wallet (EVM or Solana) is currently loading.
 * FIX 5: Uses a single useSelector call instead of two separate ones,
 * reducing the number of subscription points and preventing double re-renders.
 */
export const useLoadingState = (): boolean => {
  return useSelector((state: RootState) => {
    // ── EVM ──
    const activeChainId = state.ethereum.activeChainId;
    const activeIndex = state.ethereum.activeIndex ?? 0;
    const ethAccount = state.ethereum.globalAddresses[activeIndex];
    const ethLoading = ethAccount?.statusByChain?.[activeChainId] === GeneralStatus.Loading;

    // ── Solana ──
    const importedSolAddr = state.importedAccounts?.activeSolAddress;
    const solIdx = state.solana.activeIndex ?? 0;
    const solAccount = importedSolAddr
      ? state.solana.addresses?.find(a => a.address === importedSolAddr)
      : state.solana.addresses?.[solIdx];
    const solLoading = solAccount?.status === GeneralStatus.Loading;

    return ethLoading || solLoading;
  });
};
