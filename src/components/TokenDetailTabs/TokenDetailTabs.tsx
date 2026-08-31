import React from "react";
import { View, TouchableOpacity, Dimensions } from "react-native";
import styled, { useTheme } from "styled-components/native";
import type { ThemeType } from "../../styles/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type TabType = "info" | "activity" | "token" | "nft";

interface TokenDetailTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TabsContainer = styled.View`
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  padding-horizontal: 16px;
  padding-vertical: 4px;
  border-bottom-width: 1px;
  border-bottom-color: ${({ theme }: { theme: ThemeType }) =>
    theme.colors.border};
`;

const TabButton = styled.TouchableOpacity`
  padding-vertical: 4px;
  padding-horizontal: 12px;
  align-items: center;
`;

const TabText = styled.Text<{ active: boolean; theme: ThemeType }>`
  font-family: ${({ theme }) => theme.fonts.families.openBold};
  font-size: ${({ theme }) => theme.fonts.sizes.normal};
  color: ${({ active, theme }) =>
    active ? theme.colors.primary : theme.colors.grey};
`;

const ActiveIndicator = styled.View<{ theme: ThemeType }>`
  position: absolute;
  bottom: -8px;
  width: 100%;
  height: 3px;
  background-color: ${({ theme }) => theme.colors.primary};
  border-radius: 2px;
`;

const TABS: { key: TabType; label: string }[] = [
  { key: "info", label: "Info" },
  { key: "activity", label: "Activity" },
  { key: "token", label: "Token" },
  { key: "nft", label: "NFT" },
];

const TokenDetailTabs: React.FC<TokenDetailTabsProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <TabsContainer>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TabButton key={tab.key} onPress={() => onTabChange(tab.key)}>
            <TabText active={isActive}>{tab.label}</TabText>
            {isActive && <ActiveIndicator />}
          </TabButton>
        );
      })}
    </TabsContainer>
  );
};

export default TokenDetailTabs;
