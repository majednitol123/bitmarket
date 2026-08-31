import styled from "styled-components/native";
import { ThemeType } from "../../styles/theme";
import React, { memo } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { widthPercentageToDP as wp } from "react-native-responsive-screen";

interface ButtonTextProps {
  color?: string;
  theme: ThemeType;
  disabled?: boolean;
}

interface ButtonContainerProps {
  hideBackground: boolean;
  backgroundColor?: string;
  theme: ThemeType;
}

interface CircleProps {
  iconBackgroundColor?: string;
  theme: ThemeType;
}

const CryptoInfoCardContainer = styled.TouchableOpacity<ButtonContainerProps>`
  flex-direction: row;
  margin-bottom: ${(props) => props.theme.spacing.small};
  justify-content: space-between;
  align-items: center;
  background-color: ${({ theme, hideBackground }) =>
    hideBackground ? "transparent" : theme.colors.cardBackground};
  border-radius: ${(props) => props.theme.borderRadius.medium};
  min-height: 72px;
  padding-vertical: 12px;
  padding-horizontal: ${wp("4%")}px;
  width: 100%;
  border: ${({ theme, hideBackground }) =>
    hideBackground ? "none" : `1px solid ${theme.colors.border}`};
`;

const CryptoInfoCardText = styled.Text<ButtonTextProps>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${({ theme }) => theme.colors.white};
  letter-spacing: 0.2px;
`;

const PrimaryTextContainer = styled.View<{ theme: ThemeType }>`
  flex-direction: column;
  justify-content: center;
  flex: 1;
  min-width: 0;
`;

const DetailsContainer = styled.View`
  flex-direction: column;
  justify-content: center;
  align-items: flex-end;
  flex-shrink: 0;
  margin-left: 8px;
`;

const Circle = styled.View<CircleProps>`
  justify-content: center;
  align-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  margin-right: 12px;
  background-color: ${({ theme, iconBackgroundColor }) =>
    iconBackgroundColor || "rgba(240, 185, 11, 0.1)"};
  border: 1px solid ${(props) => props.theme.colors.borderLight};
`;

const ChainContainer = styled.View`
  flex-direction: row;
  align-items: center;
  flex: 1;
  margin-right: 12px;
`;

const CryptoBalanceText = styled.Text<ButtonTextProps>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.small};
  color: ${({ theme }) => theme.colors.lightGrey};
  margin-top: 2px;
`;

const DetailsText = styled.Text<ButtonTextProps>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${({ theme }) => theme.colors.white};
  text-align: right;
  flex-shrink: 0;
`;

const ChangeIndicator = styled.Text<{ positive?: boolean; theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.tiny};
  color: ${({ positive, theme }) =>
    positive ? theme.colors.success : theme.colors.error};
  margin-top: 2px;
  text-align: right;
`;

interface ButtonProps {
  title: string;
  caption: string;
  details: string;
  backgroundColor?: string;
  icon?: React.ReactNode;
  iconBackgroundColor?: string;
  onPress: () => void;
  hideBackground?: boolean;
  changePercent?: string;
}

const CryptoInfoCard: React.FC<ButtonProps> = ({
  title,
  caption,
  details,
  backgroundColor,
  icon,
  iconBackgroundColor,
  onPress,
  hideBackground = false,
  changePercent,
}) => {
  return (
    <CryptoInfoCardContainer
      onPress={onPress}
      backgroundColor={backgroundColor}
      hideBackground={hideBackground}
      activeOpacity={0.7}
    >
      <ChainContainer>
        {icon ? <Circle iconBackgroundColor={iconBackgroundColor}>{icon}</Circle> : null}
        <PrimaryTextContainer>
          <CryptoInfoCardText 
            numberOfLines={1} 
            adjustsFontSizeToFit 
            minimumFontScale={0.65}
          >
            {title}
          </CryptoInfoCardText>
          <CryptoBalanceText 
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {caption}
          </CryptoBalanceText>
        </PrimaryTextContainer>
      </ChainContainer>
      <DetailsContainer>
        <DetailsText 
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={{ width: "100%" }}
        >
          {details}
        </DetailsText>
        {changePercent && (
          <ChangeIndicator positive={changePercent.startsWith("+")}>
            {changePercent}
          </ChangeIndicator>
        )}
      </DetailsContainer>
    </CryptoInfoCardContainer>
  );
};

export default memo(CryptoInfoCard, (prev, next) => {
  return (
    prev.title === next.title &&
    prev.caption === next.caption &&
    prev.details === next.details &&
    prev.hideBackground === next.hideBackground &&
    prev.changePercent === next.changePercent
  );
});
