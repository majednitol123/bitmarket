import React from "react";
import styled from "styled-components/native";
import { ThemeType } from "../../styles/theme";
import { formatDollar } from "../../utils/formatDollars";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";

const CardContainer = styled.View<{ theme: ThemeType }>`
  background-color: ${({ theme }) => theme.colors.cardBackground};
  border-radius: 20px;
  padding: 8px 20px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  width: 100%;
`;

const InfoRow = styled.View<{ theme: ThemeType; isLast?: boolean }>`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-vertical: 16px;
  border-bottom-width: ${({ isLast }) => (isLast ? "0px" : "1px")};
  border-bottom-color: ${({ theme }) => theme.colors.border};
`;

const LabelContainer = styled.View`
  flex-direction: row;
  align-items: center;
`;

const LabelDot = styled.View<{ theme: ThemeType }>`
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background-color: ${({ theme }) => theme.colors.primary};
  margin-right: 12px;
`;

const LabelText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${({ theme }) => theme.colors.lightGrey};
`;

const ValueText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${({ theme }) => theme.colors.white};
  text-align: right;
  flex-shrink: 1;
  margin-left: 16px;
`;

interface TokenInfoCardProps {
  tokenName: string;
  tokenSymbol: string;
  network: string;
  price?: number;
}

const TokenInfoCard: React.FC<TokenInfoCardProps> = ({
  tokenName,
  tokenSymbol,
  network,
}) => {
  const activeChainId = useSelector(
    (state: RootState) => state.ethereum.activeChainId
  );
  const prices = useSelector((state: RootState) => state.price.data);
  const solPrice = prices[101]?.usd ?? 0;
  const ethPrice = prices[activeChainId]?.usd ?? 0;

  const rows = [
    { label: "Token Name", value: `${tokenName} (${tokenSymbol})` },
    { label: "Network", value: network },
    {
      label: "Price",
      value: tokenSymbol === "SOL" ? formatDollar(solPrice) : formatDollar(ethPrice),
    },
  ];

  return (
    <CardContainer>
      {rows.map((row, index) => (
        <InfoRow key={row.label} isLast={index === rows.length - 1}>
          <LabelContainer>
            <LabelDot />
            <LabelText>{row.label}</LabelText>
          </LabelContainer>
          <ValueText numberOfLines={1} ellipsizeMode="tail">{row.value}</ValueText>
        </InfoRow>
      ))}
    </CardContainer>
  );
};

export default TokenInfoCard;
