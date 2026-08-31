import React, { useState, useEffect } from "react";
import { View, ScrollView, TextInput, Modal, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform, Button } from "react-native";
import styled, { useTheme } from "styled-components/native";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store";
import { addToken, fetchTrackedTokenBalances } from "../store/tokenSlice";
import CryptoInfoCard from "./CryptoInfoCard/CryptoInfoCard";
import { SafeAreaContainer } from "./Styles/Layout.styles";
const Container = styled.View`
  flex: 1;
  padding: ${(props) => props.theme.spacing.medium};
  background-color: ${(props) => props.theme.colors.dark};
`;

const Title = styled.Text`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.header};
  color: ${(props) => props.theme.fonts.colors.primary};
  margin-bottom: ${(props) => props.theme.spacing.medium};
`;

const EmptyMessage = styled.Text`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.lightGrey};
  text-align: center;
  margin-top: 50px;
`;

const ERC20TokensScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const theme = useTheme();

  const activeChainId = useSelector((state: RootState) => state.ethereum.activeChainId);

  const tokenAddress = useSelector(
    (state: RootState) => state.ethereum.globalAddresses?.[0]?.address ?? ""
  );

  const erc20Tokens = useSelector(
    (state: RootState) =>
      state.erc20.trackedTokens?.filter((t) => t.chainId === activeChainId)
  );

  const erc20Balances = useSelector((state: RootState) => state.erc20.balances);

  const [erc20ModalVisible, setErc20ModalVisible] = useState(false);
  const [erc20Contract, setErc20Contract] = useState("");

  // Fetch balances in one batch whenever tokens, active chain, or wallet address change
  useEffect(() => {
    if (!tokenAddress || !erc20Tokens || erc20Tokens.length === 0) return;
    dispatch(fetchTrackedTokenBalances({ chainId: activeChainId, tokens: erc20Tokens, wallet: tokenAddress }));
  }, [erc20Tokens, tokenAddress, activeChainId, dispatch]);

  const renderErc20Modal = () => (
    <Modal
      visible={erc20ModalVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setErc20ModalVisible(false)}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.65)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", alignItems: "center" }}
          >
            <View
              style={{
                width: "90%",
                maxWidth: 420,
                backgroundColor: theme.colors.dark,
                borderRadius: 16,
                padding: 20,
              }}
            >
              <Title>Add ERC-20 Token</Title>
              <TextInput
                placeholder="ERC-20 contract address"
                placeholderTextColor="#888"
                value={erc20Contract}
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setErc20Contract}
                style={{
                  borderWidth: 1,
                  borderColor: "#444",
                  padding: 14,
                  borderRadius: 10,
                  color: "#fff",
                  marginBottom: 16,
                }}
              />

              <Button
                title="Add Token"
                onPress={() => {
                  if (!erc20Contract) return;
                  dispatch(addToken({ chainId: activeChainId, token: erc20Contract.trim() }));
                  setErc20Contract("");
                  setErc20ModalVisible(false);
                }}
              />
              <View style={{ height: 10 }} />
              <Button title="Cancel" onPress={() => setErc20ModalVisible(false)} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  return (
    <SafeAreaContainer>
      <Button title="Add New ERC-20 Token" onPress={() => setErc20ModalVisible(true)} />

      {erc20Tokens && erc20Tokens.length > 0 ? (
        <View style={{ marginTop: 20 }}>
          {erc20Tokens.map((t) => {
            const key = `${t.chainId}:${t.token}`;
            const data = erc20Balances[key];
            if (!data) return null;
            return (
              <CryptoInfoCard
                    key={key}
                    title={data.name}
                    caption={data.symbol}
                    details={`${data.balance} ${data.symbol}`}
                    icon={""} onPress={function (): void {
                        throw new Error("Function not implemented.");
                    } }              />
            );
          })}
        </View>
      ) : (
        <EmptyMessage>You don’t have any tokens. You can add one.</EmptyMessage>
      )}

      {renderErc20Modal()}
    </SafeAreaContainer>
  );
};

export default ERC20TokensScreen;
