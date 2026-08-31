import React, { useState, useEffect } from "react";
import { SafeAreaView, ScrollView, View, StyleSheet, Text, TouchableOpacity } from "react-native";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import styled from "styled-components/native";
import { useTheme } from "styled-components/native";
import { ThemeType } from "../../../styles/theme";
import CopyIcon from "../../../assets/svg/copy.svg";
import LockIcon from "../../../assets/svg/lock.svg";
import PhraseIcon from "../../../assets/svg/phrase.svg";
import Button from "../../../components/Button/Button";
import Bubble from "../../../components/Bubble/Bubble";
import { ROUTES } from "../../../constants/routes";
import { getPhrase } from "../../../hooks/useStorageState";
import { LinearGradientBackground } from "../../../components/Styles/Gradient";
import CleanArcSpinner from "../../../components/Loader/CleanArcSpinner";

const SafeAreaContainer = styled(SafeAreaView)<{ theme: ThemeType }>`
  flex: 1;
`;

const ContentContainer = styled.View<{ theme: ThemeType }>`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding: ${(props) => props.theme.spacing.medium};
`;

const HeaderSection = styled.View`
  align-items: center;
  margin-bottom: 16px;
  width: 100%;
`;

const SecurityIconCircle = styled.View<{ theme: ThemeType }>`
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background-color: rgba(240, 185, 11, 0.15);
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
`;

const Title = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 28px;
  color: ${(props) => props.theme.colors.white};
  text-align: center;
  margin-bottom: 10px;
`;

const Subtitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.lightGrey};
  text-align: center;
  padding-horizontal: ${(props) => props.theme.spacing.medium};
`;

const SeedCard = styled.View<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-radius: 20px;
  border: 1px solid ${(props) => props.theme.colors.border};
  padding: 20px;
  margin-vertical: 16px;
  width: 100%;
`;

const SeedPhraseContainer = styled.View<{ theme: ThemeType }>`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
`;

const CopyButton = styled.TouchableOpacity<{ theme: ThemeType }>`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => props.theme.colors.cardBackground};
  border: 1px solid ${(props) => props.theme.colors.border};
  border-radius: 14px;
  padding: 14px 24px;
  margin-top: 8px;
`;

const CopyButtonText = styled.Text<{ theme: ThemeType; copied: boolean }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => (props.copied ? props.theme.colors.primary : props.theme.colors.white)};
  margin-left: 10px;
`;

const ButtonContainer = styled.View<{ theme: ThemeType }>`
  padding-left: ${(props) => props.theme.spacing.large};
  padding-right: ${(props) => props.theme.spacing.large};
  padding-bottom: ${(props) => props.theme.spacing.medium};
  padding-top: ${(props) => props.theme.spacing.small};
  width: 100%;
`;

const WarningContainer = styled.View<{ theme: ThemeType }>`
  flex-direction: row;
  align-items: center;
  background-color: rgba(240, 185, 11, 0.05);
  border-radius: 16px;
  border: 1px solid rgba(240, 185, 11, 0.2);
  padding: 16px;
  margin-bottom: 16px;
  width: 100%;
`;

const WarningDot = styled.View`
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background-color: #f0b90b;
  margin-right: 10px;
`;

const WarningText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.small};
  color: ${(props) => props.theme.colors.lightGrey};
  flex: 1;
`;

export default function Page() {
  const theme = useTheme();
  const { phrase, readOnly } = useLocalSearchParams();
  const seedPhraseParams = phrase ? (phrase as string).split(" ") : [];
  const [seedPhrase, setPhrase] = useState(seedPhraseParams);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const showLoader = isLoading || seedPhrase.length === 0;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(seedPhrase.join(" "));
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 4000);
  };

  useEffect(() => {
    const fetchPhrase = async () => {
      const phraseStorage = await getPhrase();
      setPhrase(phraseStorage.split(" "));
    };
    if (readOnly) {
      fetchPhrase();
    }
  }, [readOnly]);

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaContainer>
        {showLoader ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <CleanArcSpinner size={48} color={theme.colors.primary} />
          </View>
        ) : (
          <>
            <ScrollView 
              contentContainerStyle={{ paddingTop: 40, paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            >
              <ContentContainer>
                <HeaderSection>
                  <SecurityIconCircle>
                    <LockIcon width={32} height={32} fill={theme.colors.primary} />
                  </SecurityIconCircle>
                  <Title>Secret Recovery Phrase</Title>
                  <Subtitle>
                    Write down these 12 words in the exact order shown. They are the
                    only way to recover your funds if you lose access.
                  </Subtitle>
                </HeaderSection>

                <WarningContainer>
                  <WarningDot />
                  <WarningText>
                    Keep this phrase private. Anyone who has it can access and take your funds permanently.
                  </WarningText>
                </WarningContainer>

                <SeedCard>
                  <SeedPhraseContainer>
                    {seedPhrase.map((word, index) => (
                      <Bubble key={index} word={word} number={index + 1} />
                    ))}
                  </SeedPhraseContainer>
                </SeedCard>

                <CopyButton onPress={handleCopy}>
                  <CopyIcon fill={copied ? theme.colors.primary : theme.colors.white} width={18} height={18} />
                  <CopyButtonText copied={copied}>
                    {copied ? "Copied!" : "Copy Phrase"}
                  </CopyButtonText>
                </CopyButton>
              </ContentContainer>
            </ScrollView>

            {readOnly ? null : (
              <ButtonContainer>
                <Button
                  backgroundColor={theme.colors.primary}
                  color={theme.colors.realWhite}
                  onPress={() =>
                    router.push({
                      pathname: ROUTES.confirmSeedPhrase,
                      params: { phrase: seedPhrase },
                    })
                  }
                  title="Done, I have saved it"
                />
              </ButtonContainer>
            )}
          </>
        )}
      </SafeAreaContainer>
    </LinearGradientBackground>
  );
}
