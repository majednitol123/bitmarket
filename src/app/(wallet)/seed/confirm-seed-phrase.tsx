import React, { useState } from "react";
import { Dimensions, ScrollView, SafeAreaView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import styled from "styled-components/native";
import { useTheme } from "styled-components/native";
import * as Clipboard from "expo-clipboard";
import { savePhrase } from "../../../hooks/useStorageState";
import { ThemeType } from "../../../styles/theme";
import Button from "../../../components/Button/Button";
import Bubble from "../../../components/Bubble/Bubble";
import { ROUTES } from "../../../constants/routes";
import PasteIcon from "../../../assets/svg/paste.svg";
import ShieldCheckIcon from "../../../assets/svg/shield-check.svg";
import { LinearGradientBackground } from "../../../components/Styles/Gradient";
import { MotiView } from "moti";
import { StyleSheet, View } from "react-native";

const SafeAreaContainer = styled(SafeAreaView)<{ theme: ThemeType }>`
  flex: 1;
`;

const ContentContainer = styled.View<{ theme: ThemeType }>`
  flex: 1;
  align-items: center;
  padding: ${(props) => props.theme.spacing.medium};
`;

const HeaderSection = styled.View`
  align-items: center;
  margin-bottom: 20px;
`;

const IconCircle = styled.View<{ theme: ThemeType }>`
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background-color: rgba(240, 185, 11, 0.12);
  justify-content: center;
  align-items: center;
  margin-bottom: 16px;
`;

const VerifyIcon = styled.View`
  justify-content: center;
  align-items: center;
`;

const Title = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 24px;
  color: ${(props) => props.theme.colors.white};
  text-align: center;
  margin-bottom: 8px;
`;

const Subtitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.lightGrey};
  text-align: center;
  padding-horizontal: ${(props) => props.theme.spacing.small};
`;

const SelectedCard = styled.View<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-radius: 20px;
  border: 1px solid ${(props) => props.theme.colors.border};
  padding: 16px;
  min-height: 120px;
  width: 100%;
  margin-bottom: 16px;
`;

const SelectedLabel = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.small};
  color: ${(props) => props.theme.colors.lightGrey};
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const SelectedWordsRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-start;
`;

const WordBankCard = styled.View<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-radius: 20px;
  border: 1px solid ${(props) => props.theme.colors.border};
  padding: 16px;
  width: 100%;
  flex: 1;
  margin-bottom: 16px;
`;

const WordBankLabel = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.small};
  color: ${(props) => props.theme.colors.lightGrey};
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const WordBankRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-start;
`;

const PasteButton = styled.TouchableOpacity<{ theme: ThemeType }>`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => props.theme.colors.cardBackground};
  border: 1px dashed ${(props) => props.theme.colors.primary};
  border-radius: 12px;
  padding: 12px 20px;
  margin-bottom: 16px;
`;

const PasteButtonText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.primary};
  margin-left: 8px;
`;

const ErrorContainer = styled.View<{ theme: ThemeType }>`
  background-color: rgba(255, 82, 82, 0.1);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 12px;
  width: 100%;
`;

const ErrorText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.small};
  color: #ff5252;
  text-align: center;
`;

const ButtonContainer = styled.View<{ theme: ThemeType }>`
  padding-left: ${(props) => props.theme.spacing.large};
  padding-right: ${(props) => props.theme.spacing.large};
  padding-bottom: ${(props) => props.theme.spacing.medium};
  width: 100%;
`;

export default function Page() {
  const theme = useTheme();
  const { phrase } = useLocalSearchParams();
  const seedPhraseParams = phrase
    ? (phrase as string).split(",").sort(() => 0.5 - Math.random())
    : [];

  const [seedPhrase, setSeedPhrase] = useState<string[]>(seedPhraseParams);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [error, setError] = useState<string>("");

  const handleSelectedWord = (word: string) => {
    if (selectedWords.length === 12) return;
    setSelectedWords([...selectedWords, word]);
    setSeedPhrase(seedPhrase.filter((w) => w !== word));
    setError("");
  };

  const handleRemoveSelectedWord = (word: string) => {
    setSelectedWords(selectedWords.filter((w) => w !== word));
    setSeedPhrase([...seedPhrase, word]);
    setError("");
  };

  const handleVerifySeedPhrase = async () => {
    if (selectedWords.length !== 12) {
      setError("Please select all 12 words in the correct order");
      return;
    }

    if (selectedWords.join(",") === phrase) {
      try {
        const originalPhrase = JSON.stringify(phrase.split(",").join(" "));
        await savePhrase(originalPhrase);
      } catch (e) {
        console.error("Failed to save private key", e);
        throw e;
      }
      router.push({
        pathname: ROUTES.walletCreatedSuccessfully,
        params: { successState: "CREATED_WALLET" },
      });
    } else {
      setError("The seed phrase order is incorrect. Please try again.");
    }
  };

  const fetchCopiedText = async () => {
    const copiedText = await Clipboard.getStringAsync();
    const phraseString = phrase as string;
    const originalPhrase = phraseString.split(",").join(" ");
    const isValid = copiedText === originalPhrase;
    if (isValid) {
      setSelectedWords(copiedText.split(" "));
      setSeedPhrase([]);
      setError("");
    } else {
      setError("Clipboard does not contain the correct phrase");
    }
  };

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaContainer>
        <ScrollView 
          contentContainerStyle={{ paddingTop: 30, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <ContentContainer>
            <MotiView
              from={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", damping: 12, delay: 200 }}
            >
              <HeaderSection>
                <View style={{ position: "relative", justifyContent: "center", alignItems: "center" }}>
                  <MotiView
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: [0.1, 0.2, 0.1], scale: [1, 1.4, 1] }}
                    transition={{
                      type: "timing",
                      duration: 2000,
                      loop: true,
                      repeatReverse: true,
                    }}
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        backgroundColor: theme.colors.primary,
                        borderRadius: 28,
                        marginBottom: 16,
                      },
                    ]}
                  />
                  <IconCircle>
                    <ShieldCheckIcon color={theme.colors.success || "#4CAF50"} width={32} height={32} />
                  </IconCircle>
                </View>
                <Title>Verify Backup Phrase</Title>
                <Subtitle>
                  Select the words in the correct sequence to confirm you have backed
                  them up accurately.
                </Subtitle>
              </HeaderSection>
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 600, delay: 400 }}
              style={{ width: "100%" }}
            >
              <SelectedCard>
                <SelectedLabel>
                  {selectedWords.length > 0
                    ? `Selected (${selectedWords.length}/12)`
                    : "Select words from the pool"}
                </SelectedLabel>
                <SelectedWordsRow>
                  {selectedWords.map((word, index) => (
                    <MotiView
                      key={`sel-${index}`}
                      from={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "timing", duration: 300 }}
                    >
                      <Bubble
                        smallBubble
                        hideDetails
                        word={word}
                        number={index + 1}
                        onPress={() => handleRemoveSelectedWord(word)}
                      />
                    </MotiView>
                  ))}
                </SelectedWordsRow>
              </SelectedCard>
            </MotiView>

            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: "timing", duration: 600, delay: 600 }}
              style={{ width: "100%" }}
            >
              <PasteButton onPress={fetchCopiedText}>
                <PasteIcon fill={theme.colors.primary} width={18} height={18} />
                <PasteButtonText>Paste Phrase</PasteButtonText>
              </PasteButton>
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 600, delay: 800 }}
              style={{ width: "100%", flex: 1 }}
            >
              <WordBankCard>
                <WordBankLabel>Available Words</WordBankLabel>
                <WordBankRow>
                  {seedPhrase.map((word, index) => (
                    <MotiView
                      key={`bank-${index}`}
                      from={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "timing", duration: 300, delay: 1000 + index * 30 }}
                    >
                      <Bubble
                        onPress={() => handleSelectedWord(word)}
                        smallBubble
                        hideDetails
                        word={word}
                        number={index + 1}
                      />
                    </MotiView>
                  ))}
                </WordBankRow>
              </WordBankCard>
            </MotiView>

            {error && (
              <MotiView
                from={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                style={{ width: "100%" }}
              >
                <ErrorContainer>
                  <ErrorText>{error}</ErrorText>
                </ErrorContainer>
              </MotiView>
            )}
          </ContentContainer>
        </ScrollView>

        <MotiView
          from={{ opacity: 0, translateY: 40 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 600, delay: 1200 }}
        >
          <ButtonContainer>
            <Button
              color={theme.colors.realWhite}
              backgroundColor={theme.colors.primary}
              onPress={handleVerifySeedPhrase}
              title="Confirm and Finish"
            />
          </ButtonContainer>
        </MotiView>
      </SafeAreaContainer>
    </LinearGradientBackground>
  );
}
