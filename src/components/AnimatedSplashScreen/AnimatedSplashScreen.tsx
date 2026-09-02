import { FC, ReactNode } from "react";
import styled from "styled-components/native";
import { ThemeType } from "../../styles/theme";

interface StyledComponentThemeProps {
  theme: ThemeType;
}

const AppContainer = styled.View<StyledComponentThemeProps>`
  flex: 1;
`;

interface AnimatedSplashScreenProps {
  children: ReactNode;
  appReady?: boolean;
  userExists?: boolean;
}

const AnimatedSplashScreen: FC<AnimatedSplashScreenProps> = ({
  children,
}) => {
  return <AppContainer>{children}</AppContainer>;
};

export default AnimatedSplashScreen;
