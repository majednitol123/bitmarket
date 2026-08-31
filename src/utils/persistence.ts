import AsyncStorage from "@react-native-async-storage/async-storage";
import { CustomNetwork, AddressState } from "../store/types";

const NETWORKS_KEY = "CUSTOM_NETWORKS";
const ADDRESSES_KEY = "CUSTOM_ADDRESSES";
const ACTIVE_CHAIN_KEY = "ACTIVE_CHAIN";

export async function saveNetworks(networks: Record<number, CustomNetwork>) {
  await AsyncStorage.setItem(NETWORKS_KEY, JSON.stringify(networks));
}

export async function saveAddresses(addresses: Record<number, AddressState[]>) {
  await AsyncStorage.setItem(ADDRESSES_KEY, JSON.stringify(addresses));
}

export async function saveActiveChain(chainId: number | null) {
  if (chainId !== null) await AsyncStorage.setItem(ACTIVE_CHAIN_KEY, chainId.toString());
}

export async function loadWallet() {
  const networksRaw = await AsyncStorage.getItem(NETWORKS_KEY);
  const addressesRaw = await AsyncStorage.getItem(ADDRESSES_KEY);
  const activeChainRaw = await AsyncStorage.getItem(ACTIVE_CHAIN_KEY);

  return {
    networks: networksRaw ? JSON.parse(networksRaw) : {},
    addresses: addressesRaw ? JSON.parse(addressesRaw) : {},
    activeChainId: activeChainRaw ? Number(activeChainRaw) : null,
  };
}
