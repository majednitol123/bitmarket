// components/EvmWallet.tsx
import React, { useState } from "react";
import {
  View,
  TextInput,
  Modal,
  Alert,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import styled, { useTheme } from "styled-components/native";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store";
import { CustomNetwork } from "../store/types";
import {
  addNetwork,
  removeNetwork,
  setActiveChain,
  updateNetwork,
  fetchEvmBalance,
  fetchEvmTransactions,
} from "../store/ethereumSlice";
import { registerEvmService } from "../services/EthereumService";
import { store } from "../store";
import { ThemeType } from "../styles/theme";
import EditIcon from "../assets/svg/edit.svg";
import TrashIcon from "../assets/svg/clear.svg";
import CloseIcon from "../assets/svg/close.svg";
import CheckIcon from "../assets/svg/check.svg";
import { BlockchainIcon } from "./BlockchainIcon/BlockchainIcon";
import NETWORKS from "../services/defaultNetwork";
import Toast from "react-native-toast-message";
import MoreIcon from "../assets/svg/more.svg";

const DEFAULT_CHAIN_IDS = new Set(NETWORKS.map((n) => n.chainId));

const isValidRpcUrl = (url: string) => {
  const pattern = /^(https?|wss?):\/\/([a-zA-Z0-9.-]+)(:\d+)?(\/.*)?$/;
  return pattern.test(url);
};

const isValidExplorerUrl = (url: string) => {
  const pattern = /^https?:\/\/([a-zA-Z0-9.-]+)(:\d+)?(\/.*)?$/;
  return pattern.test(url);
};

const ScrollWrapper = styled.ScrollView`
  flex: 1;
`;

const ListContent = styled.View`
  padding: 16px;
  padding-top: 8px;
  padding-bottom: 32px;
`;

const SectionTitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.header};
  color: ${(props) => props.theme.fonts.colors.primary};
  margin-bottom: 16px;
`;

const NetworkCard = styled.TouchableOpacity<{ theme: ThemeType; isActive?: boolean }>`
  flex-direction: row;
  align-items: center;
  background-color: ${({ theme, isActive }) =>
    isActive ? "rgba(240, 185, 11, 0.1)" : theme.colors.cardBackground};
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid ${({ theme, isActive }) =>
    isActive ? "rgba(240, 185, 11, 0.4)" : theme.colors.border};
`;

const NetworkIconContainer = styled.View`
  justify-content: center;
  align-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background-color: rgba(240, 185, 11, 0.12);
  margin-right: 14px;
`;

const NetworkInfo = styled.View`
  flex: 1;
  margin-right: 12px;
`;

const NetworkName = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.white};
  margin-bottom: 2px;
`;

const NetworkMeta = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.small};
  color: ${(props) => props.theme.colors.lightGrey};
`;

const ActionButtons = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

const IconButton = styled.TouchableOpacity`
  justify-content: center;
  align-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colors.primary};
`;

const AddButton = styled.TouchableOpacity<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.primary};
  border-radius: 12px;
  padding: 16px;
  align-items: center;
  margin-top: 8px;
`;

const AddButtonText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.realWhite};
`;

const EmptyState = styled.View`
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
`;

const EmptyText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.lightGrey};
`;

const ModalOverlay = styled.View`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.7);
  justify-content: center;
  align-items: center;
  padding: 20px;
`;

const ModalContent = styled.View<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-radius: 20px;
  padding: 24px;
  width: 100%;
  max-width: 400px;
  border: 1px solid ${(props) => props.theme.colors.border};
`;

const ModalHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const ModalTitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.title};
  color: ${(props) => props.theme.colors.white};
`;

const CloseButton = styled.TouchableOpacity`
  justify-content: center;
  align-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background-color: ${({ theme }) => theme.colors.grey};
`;

const Input = styled.TextInput<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.dark};
  border-radius: 12px;
  padding: 14px 16px;
  color: ${(props) => props.theme.colors.white};
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  margin-bottom: 12px;
  border: 1px solid ${(props) => props.theme.colors.border};
`;

const ModalButtons = styled.View`
  flex-direction: row;
  gap: 12px;
  margin-top: 8px;
`;

const CancelButton = styled.TouchableOpacity<{ theme: ThemeType }>`
  flex: 1;
  background-color: ${(props) => props.theme.colors.grey};
  border-radius: 12px;
  padding: 14px;
  align-items: center;
`;

const CancelButtonText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.white};
`;

const SaveButton = styled.TouchableOpacity<{ theme: ThemeType }>`
  flex: 1;
  background-color: ${(props) => props.theme.colors.primary};
  border-radius: 12px;
  padding: 14px;
  align-items: center;
`;

const SaveButtonText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.realWhite};
`;

const BottomSheetOverlay = styled.View`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.7);
  justify-content: flex-end;
`;

const BottomSheetContent = styled.View<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.lightDark};
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  padding: 24px;
  width: 100%;
  border-top-width: 1px;
  border-top-color: ${(props) => props.theme.colors.border};
`;

const BottomSheetHeader = styled.View`
  align-items: center;
  margin-bottom: 20px;
`;

const BottomSheetTitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 20px;
  color: ${(props) => props.theme.colors.white};
  text-align: center;
  margin-bottom: 4px;
`;

const BottomSheetSubtitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.small};
  color: ${(props) => props.theme.colors.lightGrey};
  text-align: center;
`;

const BottomSheetButtons = styled.View`
  gap: 12px;
  width: 100%;
`;

const MenuButton = styled.TouchableOpacity<{ theme: ThemeType; isDestructive?: boolean }>`
  flex-direction: row;
  align-items: center;
  background-color: ${({ theme, isDestructive }) =>
    isDestructive ? "rgba(235, 87, 87, 0.1)" : (theme.colors.borderLight || theme.colors.border)};
  border-radius: 14px;
  padding: 16px;
  gap: 12px;
  border: 1px solid
    ${({ theme, isDestructive }) =>
      isDestructive ? "rgba(235, 87, 87, 0.2)" : theme.colors.border};
`;

const MenuButtonText = styled.Text<{ theme: ThemeType; isDestructive?: boolean }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${({ theme, isDestructive }) =>
    isDestructive ? theme.colors.error : theme.colors.white};
`;

const CancelMenuButton = styled.TouchableOpacity<{ theme: ThemeType }>`
  background-color: transparent;
  border-radius: 14px;
  padding: 16px;
  align-items: center;
  margin-top: 4px;
`;

const CancelMenuButtonText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.lightGrey};
`;

export const EvmWallet = () => {
  const dispatch = useDispatch<AppDispatch>();
  const theme = useTheme();
  const networks = useSelector((state: RootState) => state.ethereum.networks);
  const activeChainId = useSelector((state: RootState) => state.ethereum.activeChainId);

  const [modalVisible, setModalVisible] = useState(false);
  const [networkName, setNetworkName] = useState("");
  const [chainId, setChainId] = useState("");
  const [rpcUrl, setRpcUrl] = useState("");
  const [symbol, setSymbol] = useState("");
  const [explorerUrl, setExplorerUrl] = useState("");
  const [editingNetworkId, setEditingNetworkId] = useState<number | null>(null);
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false);
  const [selectedNetworkForMenu, setSelectedNetworkForMenu] = useState<CustomNetwork | null>(null);

  const handleOpenMenu = (network: CustomNetwork) => {
    setSelectedNetworkForMenu(network);
    setOptionsMenuVisible(true);
  };

  const handleSaveNetwork = () => {
    if (!networkName || !chainId || !rpcUrl || !symbol) return;

    const trimmedRpc = rpcUrl.trim();
    if (!isValidRpcUrl(trimmedRpc)) {
      Toast.show({
        type: "error",
        text1: "Invalid RPC URL",
        text2: "URL must start with http://, https://, ws://, or wss://",
      });
      return;
    }

    const trimmedExplorer = explorerUrl.trim();
    if (trimmedExplorer && !isValidExplorerUrl(trimmedExplorer)) {
      Toast.show({
        type: "error",
        text1: "Invalid Explorer URL",
        text2: "URL must start with http:// or https://",
      });
      return;
    }

    const network: CustomNetwork = {
      chainType: "EVM",
      chainId: Number(chainId),
      chainName: networkName.trim(),
      rpcUrl: trimmedRpc,
      symbol: symbol.trim(),
      explorerUrl: trimmedExplorer || undefined,
    };

    if (editingNetworkId !== null) {
      dispatch(updateNetwork(network));
      // Re-register in case the RPC URL was changed
      registerEvmService(network);
    } else {
      dispatch(addNetwork(network));
      // Register the EVMService so balance/transaction fetches don't fail
      registerEvmService(network);

      // Immediately fetch balance + transactions for the new chain
      const state = store.getState();
      const idx = state.ethereum.activeIndex ?? 0;
      const importedAddr = state.importedAccounts?.activeEvmAddress;
      const addr = importedAddr
        ? state.ethereum.globalAddresses?.find(
            (a) => a.address?.toLowerCase() === importedAddr.toLowerCase()
          )?.address
        : state.ethereum.globalAddresses?.[idx]?.address;

      if (addr) {
        dispatch(fetchEvmBalance({ chainId: Number(chainId), address: addr }));
        dispatch(fetchEvmTransactions({ chainId: Number(chainId), address: addr }));
      }
    }

    resetForm();
  };

  const resetForm = () => {
    setNetworkName("");
    setChainId("");
    setRpcUrl("");
    setSymbol("");
    setExplorerUrl("");
    setEditingNetworkId(null);
    setModalVisible(false);
  };

  const handleEditNetwork = (network: CustomNetwork) => {
    setEditingNetworkId(network.chainId);
    setNetworkName(network.chainName);
    setChainId(network.chainId?.toString());
    setRpcUrl(network.rpcUrl);
    setSymbol(network.symbol);
    setExplorerUrl(network.explorerUrl || "");
    setModalVisible(true);
  };

  const handleRemoveNetwork = (network: CustomNetwork) => {
    Alert.alert(
      "Remove Network",
      `Are you sure you want to remove ${network.chainName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => dispatch(removeNetwork(network.chainId)),
        },
      ]
    );
  };

  const handleSetActive = (chainId: number) => {
    dispatch(setActiveChain(chainId));
  };

  const renderNetwork = ({ item }: { item: CustomNetwork }) => {
    const isActive = item.chainId === activeChainId;

    return (
      <NetworkCard
        isActive={isActive}
        onPress={() => handleSetActive(item.chainId)}
        activeOpacity={0.7}
      >
        <NetworkIconContainer>
          <BlockchainIcon symbol={item.symbol} chainId={item.chainId} chainName={item.chainName} size={28} />
        </NetworkIconContainer>
        <NetworkInfo>
          <NetworkName>
            {item.chainName} {isActive && "• Active"}
          </NetworkName>
          <NetworkMeta>
            Chain ID: {item.chainId} · {item.symbol}
          </NetworkMeta>
        </NetworkInfo>
        <ActionButtons>
          <IconButton onPress={() => handleOpenMenu(item)}>
            <MoreIcon width={20} height={20} fill={theme.colors.lightGrey} />
          </IconButton>
        </ActionButtons>
      </NetworkCard>
    );
  };

  const networkList = Object.values(networks);

  return (
    <ScrollWrapper showsVerticalScrollIndicator={false}>
      <ListContent>
        <SectionTitle>Networks</SectionTitle>

        {networkList.length === 0 ? (
          <EmptyState>
            <EmptyText>No custom networks added yet</EmptyText>
          </EmptyState>
        ) : (
          networkList.map((item, index) => (
            <NetworkCard
              key={item.chainId}
              isActive={item.chainId === activeChainId}
              onPress={() => handleSetActive(item.chainId)}
              activeOpacity={0.7}
            >
              <NetworkIconContainer>
                <BlockchainIcon symbol={item.symbol} chainId={item.chainId} chainName={item.chainName} size={28} />
              </NetworkIconContainer>
              <NetworkInfo>
                <NetworkName numberOfLines={1} ellipsizeMode="tail">
                  {item.chainName} {item.chainId === activeChainId && "• Active"}
                </NetworkName>
                <NetworkMeta numberOfLines={1} ellipsizeMode="tail">
                  Chain ID: {item.chainId} · {item.symbol}
                </NetworkMeta>
              </NetworkInfo>
              <ActionButtons>
                <IconButton onPress={() => handleOpenMenu(item)}>
                  <MoreIcon width={20} height={20} fill={theme.colors.realWhite} />
                </IconButton>
              </ActionButtons>
            </NetworkCard>
          ))
        )}

        <AddButton onPress={() => setModalVisible(true)}>
          <AddButtonText>Add Network</AddButtonText>
        </AddButton>
      </ListContent>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={resetForm}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ModalOverlay>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <ModalContent style={{ maxHeight: "90%" }}>
                <KeyboardAwareScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ flexGrow: 1 }}
                >
                  <ModalHeader>
                    <ModalTitle>
                      {editingNetworkId !== null ? "Edit Network" : "Add EVM Network"}
                    </ModalTitle>
                    <CloseButton onPress={resetForm}>
                      <CloseIcon width={18} height={18} fill={theme.colors.lightGrey} />
                    </CloseButton>
                  </ModalHeader>

                  <Input
                    placeholder="Network Name"
                    placeholderTextColor={theme.colors.lightGrey}
                    value={networkName}
                    onChangeText={setNetworkName}
                  />
                  <Input
                    placeholder="Chain ID"
                    placeholderTextColor={theme.colors.lightGrey}
                    value={chainId}
                    onChangeText={setChainId}
                    keyboardType="numeric"
                    editable={editingNetworkId === null}
                  />
                  <Input
                    placeholder="RPC URL"
                    placeholderTextColor={theme.colors.lightGrey}
                    value={rpcUrl}
                    onChangeText={setRpcUrl}
                    autoCapitalize="none"
                  />
                  <Input
                    placeholder="Symbol"
                    placeholderTextColor={theme.colors.lightGrey}
                    value={symbol}
                    onChangeText={setSymbol}
                    autoCapitalize="characters"
                  />
                  <Input
                    placeholder="Explorer URL (Optional)"
                    placeholderTextColor={theme.colors.lightGrey}
                    value={explorerUrl}
                    onChangeText={setExplorerUrl}
                    autoCapitalize="none"
                  />

                  <ModalButtons>
                    <CancelButton onPress={resetForm}>
                      <CancelButtonText>Cancel</CancelButtonText>
                    </CancelButton>
                    <SaveButton onPress={handleSaveNetwork}>
                      <SaveButtonText>
                        {editingNetworkId !== null ? "Update" : "Add"}
                      </SaveButtonText>
                    </SaveButton>
                  </ModalButtons>
                </KeyboardAwareScrollView>
              </ModalContent>
            </TouchableWithoutFeedback>
          </ModalOverlay>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={optionsMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOptionsMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOptionsMenuVisible(false)}>
          <BottomSheetOverlay>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <BottomSheetContent>
                <BottomSheetHeader>
                  <BottomSheetTitle>{selectedNetworkForMenu?.chainName}</BottomSheetTitle>
                  <BottomSheetSubtitle>Chain ID: {selectedNetworkForMenu?.chainId}</BottomSheetSubtitle>
                </BottomSheetHeader>

                <BottomSheetButtons>
                  <MenuButton
                    onPress={() => {
                      setOptionsMenuVisible(false);
                      if (selectedNetworkForMenu) {
                        handleEditNetwork(selectedNetworkForMenu);
                      }
                    }}
                  >
                    <EditIcon width={20} height={20} fill={theme.colors.white} />
                    <MenuButtonText>Edit Network</MenuButtonText>
                  </MenuButton>

                  {selectedNetworkForMenu && !DEFAULT_CHAIN_IDS.has(selectedNetworkForMenu.chainId) && (
                    <MenuButton
                      onPress={() => {
                        setOptionsMenuVisible(false);
                        if (selectedNetworkForMenu) {
                          handleRemoveNetwork(selectedNetworkForMenu);
                        }
                      }}
                      isDestructive
                    >
                      <TrashIcon width={20} height={20} fill={theme.colors.error} />
                      <MenuButtonText isDestructive>Delete Network</MenuButtonText>
                    </MenuButton>
                  )}

                  <CancelMenuButton onPress={() => setOptionsMenuVisible(false)}>
                    <CancelMenuButtonText>Cancel</CancelMenuButtonText>
                  </CancelMenuButton>
                </BottomSheetButtons>
              </BottomSheetContent>
            </TouchableWithoutFeedback>
          </BottomSheetOverlay>
        </TouchableWithoutFeedback>
      </Modal>
    </ScrollWrapper>
  );
};
