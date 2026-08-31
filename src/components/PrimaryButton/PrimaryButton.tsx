import styled, { useTheme } from "styled-components/native";
import { ThemeType } from "../../styles/theme";
import React from "react";
import { LinearGradient } from "expo-linear-gradient";

interface ButtonTextProps {
  color?: string;
  theme: ThemeType;
  disabled?: boolean;
}

interface ButtonContainerProps {
  backgroundColor?: string;
  theme: ThemeType;
  variant?: "primary" | "secondary" | "outline";
}

const PrimaryButtonContainer = styled.TouchableOpacity<ButtonContainerProps>`
  flex: 1;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme, variant }) =>
    variant === "outline"
      ? "transparent"
      : theme.colors.cardBackground};
  border-radius: ${(props) => props.theme.borderRadius.medium};
  height: 50px;
  padding: 0 16px;
  border: ${({ theme, variant }) =>
    variant === "outline" ? `1.5px solid ${theme.colors.border}` : "none"};
`;

const GradientContainer = styled(LinearGradient)`
  flex: 1;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  border-radius: ${(props) => props.theme.borderRadius.medium};
  height: 50px;
  padding: 0 16px;
`;

const PrimaryButtonText = styled.Text<ButtonTextProps & { variant?: string }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${({ theme, variant }) =>
    variant === "primary" ? theme.colors.darkText : theme.colors.white};
  letter-spacing: 0.5px;
  text-align: center;
  flex: 1;
`;

const Circle = styled.View`
  justify-content: center;
  align-items: center;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background-color: rgba(240, 185, 11, 0.15);
  margin-right: 6px;
  flex-shrink: 0;
`;

interface ButtonProps {
  onPress: () => void;
  btnText: string;
  disabled?: boolean;
  color?: string;
  backgroundColor?: string;
  icon: React.ReactNode;
  iconBackgroundColor?: string;
  variant?: "primary" | "secondary" | "outline";
  useGradient?: boolean;
}

const PrimaryButton: React.FC<ButtonProps> = ({
  onPress,
  btnText,
  backgroundColor,
  disabled = false,
  icon,
  variant = "secondary",
  useGradient = false,
}) => {
  const theme = useTheme();

  if (useGradient) {
    return (
      <GradientContainer
        colors={["#F0B90B", "#D4A009"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Circle style={{ backgroundColor: "rgba(0,0,0,0.2)" }}>{icon}</Circle>
        <PrimaryButtonText 
          variant="primary"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {btnText}
        </PrimaryButtonText>
      </GradientContainer>
    );
  }

  return (
    <PrimaryButtonContainer
      disabled={disabled}
      backgroundColor={backgroundColor}
      onPress={disabled ? undefined : onPress}
      variant={variant}
      activeOpacity={0.7}
    >
      <Circle>{icon}</Circle>
      <PrimaryButtonText 
        variant={variant}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {btnText}
      </PrimaryButtonText>
    </PrimaryButtonContainer>
  );
};

export default PrimaryButton;
