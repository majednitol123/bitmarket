import { useSelector } from "react-redux";
import type { RootState } from "../store";
import { GeneralStatus } from "../store/types";

/**
 * Hook to determine if EVM wallet is currently loading.
 */
export const useLoadingState = (): boolean => {
  return useSelector((state: RootState) => {
    const activeChainId = state.ethereum.activeChainId;
    const activeIndex = state.ethereum.activeIndex ?? 0;
    const ethAccount = state.ethereum.globalAddresses[activeIndex];
    return activeChainId != null && ethAccount?.statusByChain?.[activeChainId] === GeneralStatus.Loading;
  });
};
