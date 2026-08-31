import { FC } from "react";
import styled from "styled-components/native";
import type { ThemeType } from "../../styles/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "styled-components/native";

const EmptyContainer = styled(LinearGradient)`
  align-items: center;
  justify-content: center;
  border-radius: ${(props) => props.theme.borderRadius.medium};
  padding: ${(props) => props.theme.spacing.large};
  padding-top: 20px;
  padding-bottom: 20px;
  margin-top: ${(props) => props.theme.spacing.small};
  border: 1px solid ${(props) => props.theme.colors.border};
`;

const EmptyTitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.white};
  margin-bottom: 4px;
`;

const EmptySubtext = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.small};
  color: ${(props) => props.theme.colors.lightGrey};
`;

const InfoBanner: FC = () => {
  const theme = useTheme();
  return (
    <EmptyContainer
      colors={theme.colors.cardGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <EmptyTitle>No activity yet</EmptyTitle>
      <EmptySubtext>Your transactions will appear here</EmptySubtext>
    </EmptyContainer>
  );
};

export default InfoBanner;
