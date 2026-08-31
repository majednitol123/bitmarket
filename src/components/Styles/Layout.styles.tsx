import { SafeAreaView } from "react-native-safe-area-context";
import styled from "styled-components/native";
import type { ThemeType } from "../../styles/theme";
import { LinearGradient } from "expo-linear-gradient";

export const SafeAreaContainer = styled(SafeAreaView)<{ theme: ThemeType }>`
  flex: 1;
  background-color: ${(props) => props.theme.colors.dark};
`;

export const GradientBackground = styled(LinearGradient)`
  flex: 1;
`;

export const BalanceContainer = styled.View<{ theme: ThemeType }>`
  margin-top: 10px;
  margin-bottom: ${(props) => props.theme.spacing.huge};
`;
