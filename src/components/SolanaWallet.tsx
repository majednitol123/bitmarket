import React, { useState } from "react";
import {
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import styled, { useTheme } from "styled-components/native";
import { useSelector, useDispatch } from "react-redux";
import Toast from "react-native-toast-message";
import type { RootState, AppDispatch } from "../store";
import { setSelectedNetwork, fetchSolanaBalance, fetchSolanaTransactions, setCustomRpcUrl } from "../store/solanaSlice";
import { ThemeType } from "../styles/theme";
import EditIcon from "../assets/svg/edit.svg";
import CloseIcon from "../assets/svg/close.svg";
import { BlockchainIcon } from "./BlockchainIcon/BlockchainIcon";
import MoreIcon from "../assets/svg/more.svg";

const ScrollWrapper = styled.View`
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

const ActiveDot = styled.View`
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background-color: #f0b90b;
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

const Label = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.small};
  color: ${(props) => props.theme.colors.lightGrey};
  margin-bottom: 6px;
  margin-top: 8px;
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

const ReadOnlyBox = styled.View<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.dark};
  border-radius: 12px;
  padding: 14px 16px;
  border: 1px solid ${(props) => props.theme.colors.border};
  margin-bottom: 12px;
  opacity: 0.6;
`;

const ReadOnlyText = styled.Text<{ theme: ThemeType }>`
  color: ${(props) => props.theme.colors.white};
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
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

const getDefaultRpcUrl = (networkId: "mainnet" | "devnet") => {
  return networkId === "mainnet"
    ? "https://mainnet.helius-rpc.com/?api-key=4ea6a1a7-e963-4e68-8b02-5e072f7e77a8"
    : "https://devnet.helius-rpc.com/?api-key=800c9b64-37ba-4cd3-a7e9-807406f383a9";
};

const SOLANA_NETWORKS = [
  {
    id: "mainnet",
    name: "Solana Mainnet",
    rpcUrl: "Solana Mainnet RPC (Helius)",
    symbol: "SOL",
  },
  {
    id: "devnet",
    name: "Solana devnet",
    rpcUrl: "Solana devnet RPC (Helius)",
    symbol: "SOL",
  },
];

const DEFAULT_CUSTOM_RPC_URLS = {};

export const SolanaWallet = () => {
  const dispatch = useDispatch<AppDispatch>();
  const theme = useTheme();
  const activeNetwork = useSelector((state: RootState) => state.solana.selectedNetwork ?? "devnet");
  const addresses = useSelector((state: RootState) => state.solana.addresses);
  const activeIndex = useSelector((state: RootState) => state.solana.activeIndex);
  const customRpcUrls = useSelector((state: RootState) => state.solana.customRpcUrls ?? DEFAULT_CUSTOM_RPC_URLS);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState<"mainnet" | "devnet" | null>(null);
  const [rpcUrlInput, setRpcUrlInput] = useState("");
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false);
  const [selectedNetworkForMenu, setSelectedNetworkForMenu] = useState<{
    id: string;
    name: string;
    rpcUrl: string;
    symbol: string;
  } | null>(null);

  const handleOpenMenu = (network: { id: string; name: string; rpcUrl: string; symbol: string }) => {
    setSelectedNetworkForMenu(network);
    setOptionsMenuVisible(true);
  };

  const handleSetActive = (network: "mainnet" | "devnet") => {
    if (network === activeNetwork) return; // only guard: don't re-select same network
    dispatch(setSelectedNetwork(network));
    const activeAddress = addresses[activeIndex]?.address;
    if (activeAddress) {
      dispatch(fetchSolanaBalance({ address: activeAddress, network }));
      dispatch(fetchSolanaTransactions({ address: activeAddress, network }));
    }
  };

  const handleEditRpc = (networkId: "mainnet" | "devnet") => {
    setEditingNetwork(networkId);
    setRpcUrlInput(customRpcUrls[networkId] || getDefaultRpcUrl(networkId));
    setModalVisible(true);
  };

  const handleUpdate = () => {
    if (!editingNetwork) return;

    const trimmedUrl = rpcUrlInput.trim();
    if (trimmedUrl && !trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      Toast.show({
        type: "error",
        text1: "Invalid RPC URL",
        text2: "Endpoint URL must start with http:// or https://",
      });
      return;
    }

    dispatch(setCustomRpcUrl({ network: editingNetwork, rpcUrl: rpcUrlInput }));
    
    // Refresh active Solana balance and transactions instantly if active
    const activeAddress = addresses[activeIndex]?.address;
    if (activeAddress && activeNetwork === editingNetwork) {
      dispatch(fetchSolanaBalance({ address: activeAddress, network: activeNetwork }));
      dispatch(fetchSolanaTransactions({ address: activeAddress, network: activeNetwork }));
    }
    
    resetForm();
  };

  const resetForm = () => {
    setRpcUrlInput("");
    setEditingNetwork(null);
    setModalVisible(false);
  };

  return (
    <ScrollWrapper>
      <ListContent>
        <SectionTitle>Solana Networks</SectionTitle>

        {SOLANA_NETWORKS.map((item) => {
          const isActive = item.id === activeNetwork;
          const currentRpcUrl = customRpcUrls[item.id as "mainnet" | "devnet"] || getDefaultRpcUrl(item.id as "mainnet" | "devnet");
          return (
            <NetworkCard
              key={item.id}
              isActive={isActive}
              onPress={() => handleSetActive(item.id as "mainnet" | "devnet")}
              activeOpacity={0.7}
            >
              <NetworkIconContainer>
                <BlockchainIcon symbol={item.symbol} chainName={item.name} size={28} />
              </NetworkIconContainer>
              <NetworkInfo>
                <NetworkName numberOfLines={1} ellipsizeMode="tail">
                  {item.name} {isActive && "• Active"}
                </NetworkName>
                <NetworkMeta numberOfLines={1} ellipsizeMode="tail">
                  {currentRpcUrl}
                </NetworkMeta>
              </NetworkInfo>
              <ActionButtons>
                <IconButton onPress={(e) => {
                  e.stopPropagation();
                  handleOpenMenu(item);
                }}>
                  <MoreIcon width={20} height={20} fill={theme.colors.realWhite} />
                </IconButton>
              </ActionButtons>
              {isActive && <ActiveDot style={{ marginLeft: 8 }} />}
            </NetworkCard>
          );
        })}
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
                    <ModalTitle>Edit Solana RPC URL</ModalTitle>
                    <CloseButton onPress={resetForm}>
                      <CloseIcon width={18} height={18} fill={theme.colors.lightGrey} />
                    </CloseButton>
                  </ModalHeader>

                  <Label>Network Name</Label>
                  <ReadOnlyBox>
                    <ReadOnlyText>
                      {editingNetwork === "mainnet" ? "Solana Mainnet" : "Solana devnet"}
                    </ReadOnlyText>
                  </ReadOnlyBox>

                  <Label>RPC URL</Label>
                  <Input
                    placeholder="RPC URL"
                    placeholderTextColor={theme.colors.lightGrey}
                    value={rpcUrlInput}
                    onChangeText={setRpcUrlInput}
                    autoCapitalize="none"
                    multiline
                  />

                  <Label>Symbol</Label>
                  <ReadOnlyBox>
                    <ReadOnlyText>SOL</ReadOnlyText>
                  </ReadOnlyBox>

                  <Label>Environment</Label>
                  <ReadOnlyBox>
                    <ReadOnlyText>
                      {editingNetwork === "mainnet" ? "Mainnet" : "Devnet"}
                    </ReadOnlyText>
                  </ReadOnlyBox>

                  <ModalButtons>
                    <CancelButton onPress={resetForm}>
                      <CancelButtonText>Cancel</CancelButtonText>
                    </CancelButton>
                    <SaveButton onPress={handleUpdate}>
                      <SaveButtonText>Update</SaveButtonText>
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
                  <BottomSheetTitle>{selectedNetworkForMenu?.name}</BottomSheetTitle>
                  <BottomSheetSubtitle>Symbol: {selectedNetworkForMenu?.symbol}</BottomSheetSubtitle>
                </BottomSheetHeader>

                <BottomSheetButtons>
                  <MenuButton
                    onPress={() => {
                      setOptionsMenuVisible(false);
                      if (selectedNetworkForMenu) {
                        handleEditRpc(selectedNetworkForMenu.id as "mainnet" | "devnet");
                      }
                    }}
                  >
                    <EditIcon width={20} height={20} fill={theme.colors.white} />
                    <MenuButtonText>Edit RPC URL</MenuButtonText>
                  </MenuButton>

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
