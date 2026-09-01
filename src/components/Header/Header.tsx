import React from "react";
import { router } from "expo-router";
import styled, { useTheme } from "styled-components/native";
import { ThemeType } from "../../styles/theme";
import SettingsIcon from "../../assets/svg/settings.svg";
import { ROUTES } from "../../constants/routes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

interface ThemeComponent {
  theme: ThemeType;
}

const GradientHeader = styled(LinearGradient)`
  width: 100%;
  z-index: 10;
`;

const Container = styled.View<ThemeComponent>`
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  padding-left: ${(props) => props.theme.spacing.medium};
  padding-right: ${(props) => props.theme.spacing.medium};
  padding-bottom: ${(props) => props.theme.spacing.small};
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

const Header: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <GradientHeader
      colors={theme.colors.headerGradient}
      locations={[0, 1]}
      style={{ paddingTop: insets.top + 12, paddingBottom: 0 }}
    >
      <Container>
        <IconTouchContainer onPress={() => router.push(ROUTES.settings)}>
          <SettingsIcon width={20} height={20} fill={theme.colors.lightGrey} />
        </IconTouchContainer>
      </Container>
    </GradientHeader>
  );
};

export default Header;
