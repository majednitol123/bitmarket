// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { CustomNetwork } from '../types';


// const STORAGE_KEYS = {
//   NETWORKS: 'evm_wallet_networks',
//   ACTIVE_CHAIN_ID: 'evm_wallet_active_chain_id',
//   // Note: We do NOT store private keys or mnemonics here.
// };

// export const persistNetworks = async (networks: Record<number, CustomNetwork>): Promise<void> => {
//   try {
//     const jsonValue = JSON.stringify(networks);
//     await AsyncStorage.setItem(STORAGE_KEYS.NETWORKS, jsonValue);
//   } catch (e) {
//     console.error('Failed to save networks', e);
//   }
// };

// export const loadNetworks = async (): Promise<Record<number, CustomNetwork>> => {
//   try {
//     const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.NETWORKS);
//     return jsonValue != null ? JSON.parse(jsonValue) : {};
//   } catch (e) {
//     console.error('Failed to load networks', e);
//     return {};
//   }
// };

// export const persistActiveChainId = async (chainId: number | null): Promise<void> => {
//   try {
//     await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CHAIN_ID, String(chainId ?? ''));
//   } catch (e) {
//     console.error('Failed to save active chain', e);
//   }
// };

// export const loadActiveChainId = async (): Promise<number | null> => {
//   try {
//     const value = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_CHAIN_ID);
//     return value ? parseInt(value, 10) : null;
//   } catch (e) {
//     return null;
//   }
// };