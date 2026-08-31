import React from "react";
import styled from "styled-components/native";
import { ThemeType } from "../../styles/theme";

const SendConfCardContainer = styled.View`
  width: 100%;
  background-color: ${({ theme }) => theme.colors.cardBackground};
  border-radius: 20px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;
`;

const TokenSectionRow = styled.View<{ theme: ThemeType; isFirst?: boolean; isLast?: boolean }>`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom-width: ${({ isLast }) => (isLast ? "0px" : "1px")};
  border-bottom-color: ${({ theme }) => theme.colors.border};
`;

const TokenNameLabel = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${({ theme }) => theme.colors.lightGrey};
`;

const TokenNameText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${({ theme }) => theme.colors.white};
  max-width: 60%;
  text-align: right;
`;

const TokenNameTextGold = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${({ theme }) => theme.colors.primary};
  text-align: right;
`;

const TokenNameTextGoldContainer = styled.View`
  align-items: flex-end;
  justify-content: center;
`;

interface SendConfCardProps {
  toAddress: string;
  network: string;
  networkFee: React.ReactNode;
}

const SendConfCard: React.FC<SendConfCardProps> = ({
  toAddress,
  network,
  networkFee,
}) => {
  return (
    <SendConfCardContainer>
      <TokenSectionRow isFirst>
        <TokenNameLabel>Address</TokenNameLabel>
        <TokenNameText>{toAddress}</TokenNameText>
      </TokenSectionRow>
      <TokenSectionRow>
        <TokenNameLabel>Network</TokenNameLabel>
        <TokenNameText>{network}</TokenNameText>
      </TokenSectionRow>
      <TokenSectionRow isLast>
        <TokenNameLabel>Network Fee</TokenNameLabel>
        {typeof networkFee === "string" ? (
          <TokenNameTextGold>{networkFee}</TokenNameTextGold>
        ) : (
          <TokenNameTextGoldContainer>{networkFee}</TokenNameTextGoldContainer>
        )}
      </TokenSectionRow>
    </SendConfCardContainer>
  );
};

export default SendConfCard;
