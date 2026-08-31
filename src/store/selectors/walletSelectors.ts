import { RootState } from "..";

/* ===================== EVM ===================== */

export const selectActiveChainId = (state: RootState): number | null =>
  state.ethereum.activeChainId;

export const selectEvmNetworks = (state: RootState) =>
  state.ethereum.networks;

export const selectActiveEvmNetwork = (state: RootState) => {
  const chainId = selectActiveChainId(state);
  if (!chainId) return null;
  return state.ethereum.networks[chainId] ?? null;
};

export const selectEvmAddresses = (state: RootState) => {
  return state.ethereum.globalAddresses ?? [];
};

export const selectActiveEvmIndex = (state: RootState): number => {
  return state.ethereum.activeIndex ?? 0;
};

export const selectActiveEvmAddress = (state: RootState): string => {
  const addresses = selectEvmAddresses(state);
  const index = selectActiveEvmIndex(state);
  return addresses[index]?.address ?? "";
};

export const selectActiveEvmBalance = (state: RootState): number => {
  const chainId = selectActiveChainId(state);
  const addresses = selectEvmAddresses(state);
  const index = selectActiveEvmIndex(state);
  if (!chainId) return 0;
  return addresses[index]?.balanceByChain?.[chainId] ?? 0;
};

/* ===================== SOLANA ===================== */

export const selectActiveSolanaIndex = (state: RootState): number =>
  state.solana.activeIndex ?? 0;

export const selectActiveSolanaAddress = (state: RootState): string => {
  const index = selectActiveSolanaIndex(state);
  return state.solana.addresses?.[index]?.address ?? "";
};

export const selectSolanaBalance = (state: RootState): number => {
  const index = selectActiveSolanaIndex(state);
  return state.solana.addresses?.[index]?.balance ?? 0;
};
