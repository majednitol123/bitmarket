import React from "react";
import styled, { useTheme } from "styled-components/native";
import { LinearGradient } from "expo-linear-gradient";
import { ThemeType } from "../../styles/theme";
import PulseDotLoader from "../Loader/DotLoader";

interface ButtonTextProps {
  color?: string;
  theme: ThemeType;
  disabled?: boolean;
}

interface ButtonContainerProps {
  backgroundColor?: string;
  theme: ThemeType;
}

export const LinearGradientBackground = styled(LinearGradient)`
  padding: 10px 20px;
  align-items: center;
  height: 56px;
  justify-content: center;
  width: 100%;
  border-radius: ${(props) => props.theme.borderRadius.large};
`;

const ButtonContainer = styled.TouchableOpacity<ButtonContainerProps>`
  background-color: ${({ theme, backgroundColor }) =>
    backgroundColor ? backgroundColor : "transparent"};
  align-items: center;
  height: 56px;
  justify-content: center;
  width: 100%;
  border-radius: ${(props) => props.theme.borderRadius.large};
  overflow: hidden;
`;

const ButtonText = styled.Text<ButtonTextProps>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.large};
  color: ${({ color }) => (color ? color : "#FFFFFF")};
  letter-spacing: 0.3px;
`;

const Row = styled.View<{ theme: ThemeType }>`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;

const IconContainer = styled.View<{ theme: ThemeType }>`
  margin-right: ${(props) => props.theme.spacing.small};
`;

interface ButtonProps {
  icon?: React.ReactNode;
  onPress: () => void;
  title: string;
  disabled?: boolean;
  color?: string;
  backgroundColor?: string;
  loading?: boolean;
  linearGradient?: readonly [string, string, ...string[]];
}

const Button: React.FC<ButtonProps> = ({
  icon,
  onPress,
  title,
  color,
  backgroundColor,
  disabled = false,
  loading = false,
  linearGradient,
}) => {
  const theme = useTheme() as ThemeType;
  const gradientColors = linearGradient || theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const);

  if (backgroundColor) {
    return (
      <ButtonContainer
        disabled={disabled}
        backgroundColor={backgroundColor}
        onPress={disabled ? undefined : onPress}
        style={{ opacity: disabled ? 0.5 : 1 }}
      >
        {!loading ? (
          <Row theme={theme}>
            {icon && <IconContainer theme={theme}>{icon}</IconContainer>}
            <ButtonText theme={theme} color={color}>{title}</ButtonText>
          </Row>
        ) : (
          <PulseDotLoader size={50} color="#fff" />
        )}
      </ButtonContainer>
    );
  }

  return (
    <ButtonContainer
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <LinearGradientBackground
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        colors={gradientColors}
        theme={theme}
      >
        {!loading ? (
          <Row theme={theme}>
            {icon && <IconContainer theme={theme}>{icon}</IconContainer>}
            <ButtonText theme={theme} color={color}>{title}</ButtonText>
          </Row>
        ) : (
          <PulseDotLoader size={50} color="#fff" />
        )}
      </LinearGradientBackground>
    </ButtonContainer>
  );
};

export default Button;
