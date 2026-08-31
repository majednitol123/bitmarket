import React from "react";
import { router } from "expo-router";
import styled, { useTheme } from "styled-components/native";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import { ThemeType } from "../../styles/theme";
import SettingsIcon from "../../assets/svg/settings.svg";
import { ROUTES } from "../../constants/routes";
import Svg, { Path, Circle as SvgCircle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";
import { widthPercentageToDP as wp } from "react-native-responsive-screen";
import BlockieAvatar from "../BlockieAvatar/BlockieAvatar";

interface ThemeComponent {
  theme: ThemeType;
}

const GradientHeader = styled(LinearGradient)`
  width: 100%;
  z-index: 10;
`;

const Container = styled.View<ThemeComponent>`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-left: ${(props) => props.theme.spacing.medium};
  padding-right: ${(props) => props.theme.spacing.medium};
  padding-bottom: ${(props) => props.theme.spacing.small};
`;

const LeftContainer = styled.View<ThemeComponent>``;

const CenterContainer = styled.View<ThemeComponent>`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-radius: ${(props) => props.theme.borderRadius.pill};
  padding-vertical: 6px;
  padding-horizontal: 16px;
  border: 1px solid ${(props) => props.theme.colors.border};
  flex: 1;
  margin-horizontal: 12px;
`;

const RightContainer = styled.View<ThemeComponent>``;

const HeaderText = styled.Text<ThemeComponent>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.white};
  letter-spacing: 0.3px;
  padding-right: 2px;
`;

const IconTouchContainer = styled.TouchableOpacity`
  padding: 10px;
  justify-content: center;
  align-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background-color: ${(props) => props.theme.colors.cardBackground};
  border: 1px solid ${(props) => props.theme.colors.border};
`;

const NetworkDot = styled.View`
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background-color: ${(props) => props.theme.colors.success};
  margin-right: 8px;
`;

const AccountIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    {/* Wallet Body */}
    <Path
      d="M19 7H5C3.89543 7 3 7.89543 3 9V18C3 19.1046 3.89543 20 5 20H19C20.1046 20 21 19.1046 21 18V9C21 7.89543 20.1046 7 19 7Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Wallet Top Part */}
    <Path
      d="M16 7V5C16 3.89543 15.1046 3 14 3H10C8.89543 3 8 3.89543 8 5V7"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Token/Coin Detail */}
    <Path
      d="M12 11V16"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <Path
      d="M10 13.5H14"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </Svg>
);

const Header: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const activeIndex = useSelector(
    (state: RootState) => state.ethereum.activeIndex ?? 0
  );

  const activeAccountName = useSelector((state: RootState) => {
    // Check for active imported account first
    const importedEvm = state.importedAccounts?.activeEvmAddress;
    const importedSol = state.importedAccounts?.activeSolAddress;
    if (importedEvm || importedSol) {
      const imported = state.importedAccounts?.accounts?.find(
        (acc) =>
          (importedEvm && acc.evmAddress?.toLowerCase() === importedEvm.toLowerCase()) ||
          (importedSol && acc.solAddress === importedSol)
      );
      if (imported) return imported.accountName;
    }
    const accounts = state.ethereum.globalAddresses;
    const activeIndex = state.ethereum.activeIndex ?? 0;
    return accounts?.[activeIndex]?.accountName ?? "Account";
  });

  // Get the active account's EVM address for the identicon avatar
  const activeAddress = useSelector((state: RootState) => {
    const importedEvm = state.importedAccounts?.activeEvmAddress;
    if (importedEvm) return importedEvm;
    const accounts = state.ethereum.globalAddresses;
    const idx = state.ethereum.activeIndex ?? 0;
    return accounts?.[idx]?.address ?? "";
  });

  return (
    <GradientHeader
      colors={theme.colors.headerGradient}
      locations={[0, 1]}
      style={{ paddingTop: insets.top + 12, paddingBottom: 0 }}
    >
      <Container>
        <LeftContainer>
          <IconTouchContainer onPress={() => router.push(ROUTES.settings)}>
            <SettingsIcon width={20} height={20} fill={theme.colors.lightGrey} />
          </IconTouchContainer>
        </LeftContainer>

        <CenterContainer>
          <NetworkDot />
          {/* 
            CRITICAL FIX: Wrap Text in a View with flex:1.
            On Android, Text with numberOfLines inside a flex-direction:row 
            parent gets its width measured BEFORE the flex layout resolves.
            The text engine sees 0 available width and truncates everything.
            The View wrapper receives its definite width from flex first,
            then Text fills the View's known width without truncation.
          */}
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: theme.fonts.families.openBold,
                fontSize: 14,
                color: theme.colors.white,
                textAlign: "center",
                includeFontPadding: false,
              }}
            >
              {activeAccountName}
            </Text>
          </View>
        </CenterContainer>

        <RightContainer>
          <View
            style={{
              width: 44,
              height: 44,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{ position: "absolute", zIndex: 1 }}
              pointerEvents="none"
            />
            <IconTouchContainer
              onPress={() => router.push(ROUTES.accounts)}
              style={{
                padding: 0,
                overflow: "hidden",
                backgroundColor: "transparent",
                borderWidth: 0,
              }}
            >
              <BlockieAvatar
                address={activeAddress}
                size={36}
                borderWidth={2}
                borderColor={theme.colors.border}
              />
            </IconTouchContainer>
          </View>
        </RightContainer>
      </Container>
    </GradientHeader>
  );
};

export default Header;
