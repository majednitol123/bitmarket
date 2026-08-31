import { router } from "expo-router";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import styled, { useTheme } from "styled-components/native";
import { ThemeType } from "../../../styles/theme";
import { ROUTES } from "../../../constants/routes";
import ImportWalletIcon from "../../../assets/svg/import-wallet.svg";
import LockIcon from "../../../assets/svg/lock.svg";
import PhraseIcon from "../../../assets/svg/phrase.svg";
import KeyIcon from "../../../assets/svg/key.svg";
import { SafeAreaContainer } from "../../../components/Styles/Layout.styles";
import { LinearGradientBackground } from "../../../components/Styles/Gradient";
import { MotiView } from "moti";

const ContentContainer = styled.View<{ theme: ThemeType }>`
  flex: 1;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding-horizontal: ${(props) => props.theme.spacing.large};
`;

const HeroSection = styled.View`
  align-items: center;
  margin-bottom: 32px;
`;

const IconGrid = styled.View`
  flex-direction: row;
  justify-content: center;
  align-items: center;
  margin-bottom: 24px;
`;

const IconCircle = styled.View<{ theme: ThemeType }>`
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background-color: rgba(240, 185, 11, 0.15);
  justify-content: center;
  align-items: center;
  margin-horizontal: 8px;
`;

const IconCircleSecondary = styled.View<{ theme: ThemeType }>`
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background-color: rgba(240, 185, 11, 0.08);
  justify-content: center;
  align-items: center;
  margin-horizontal: 8px;
`;

const Title = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 32px;
  color: ${(props) => props.theme.colors.white};
  margin-bottom: 12px;
  text-align: center;
`;

const Subtitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.lightGrey};
  text-align: center;
`;

const ButtonContainer = styled.View<{ theme: ThemeType }>`
  padding-left: ${(props) => props.theme.spacing.large};
  padding-right: ${(props) => props.theme.spacing.large};
  padding-bottom: ${(props) => props.theme.spacing.large};
  padding-top: ${(props) => props.theme.spacing.small};
  width: 100%;
`;

const InfoButtonContainer = styled.TouchableOpacity<{ theme: ThemeType }>`
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.cardBackground};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 16px 20px;
  border-radius: 16px;
  height: 80px;
  width: 100%;
`;

const InfoButtonText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.large};
  color: ${({ theme }) => theme.colors.white};
`;

const InfoText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${({ theme }) => theme.colors.lightGrey};
  margin-top: 2px;
`;

const InfoTextContainer = styled.View<{ theme: ThemeType }>`
  flex-direction: column;
`;

const Circle = styled.View<{ theme: ThemeType }>`
  justify-content: center;
  align-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background-color: rgba(240, 185, 11, 0.15);
  margin-right: ${(props) => props.theme.spacing.large};
`;

interface ImportOptionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
  delay: number;
}

const ImportOption: React.FC<ImportOptionProps> = ({ title, subtitle, icon, onPress, delay }) => {
  const theme = useTheme();
  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: "timing", duration: 600, delay }}
      style={{ width: "100%", marginBottom: 16 }}
    >
      <InfoButtonContainer onPress={onPress}>
        <Circle>
          {icon}
        </Circle>
        <InfoTextContainer>
          <InfoButtonText>{title}</InfoButtonText>
          <InfoText>{subtitle}</InfoText>
        </InfoTextContainer>
      </InfoButtonContainer>
    </MotiView>
  );
};

export default function WalletImportOptions() {
  const theme = useTheme();
  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaContainer>
        <ContentContainer>
          <HeroSection>
            <MotiView
              from={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", damping: 12, delay: 200 }}
            >
              <IconGrid>
                <MotiView
                  from={{ opacity: 0, translateX: -20 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: "timing", duration: 600, delay: 400 }}
                >
                  <IconCircleSecondary>
                    <ImportWalletIcon color={theme.colors.primary} width={24} height={24} fill={theme.colors.primary} />
                  </IconCircleSecondary>
                </MotiView>

                <View style={{ position: "relative", justifyContent: "center", alignItems: "center" }}>
                  <MotiView
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: [0.15, 0.3, 0.15], scale: [1, 1.4, 1] }}
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
                        borderRadius: 32,
                        marginHorizontal: 8,
                      },
                    ]}
                  />
                  <IconCircle>
                    <LockIcon 
                      color={theme.colors.primary} 
                      width={32} 
                      height={32} 
                      fill={theme.colors.primary} 
                    />
                  </IconCircle>
                </View>

                <MotiView
                  from={{ opacity: 0, translateX: 20 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: "timing", duration: 600, delay: 400 }}
                >
                  <IconCircleSecondary>
                    <PhraseIcon color={theme.colors.primary} width={24} height={24} fill={theme.colors.primary} />
                  </IconCircleSecondary>
                </MotiView>
              </IconGrid>
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 800, delay: 600 }}
            >
              <Title>Restore Assets</Title>
              <Subtitle>
                Access your existing holdings securely by importing your recovery credentials.
              </Subtitle>
            </MotiView>
          </HeroSection>
        </ContentContainer>

        <ButtonContainer>
          <ImportOption 
            title="Use Recovery Phrase"
            subtitle="Import an existing wallet"
            icon={<PhraseIcon width={24} height={24} fill={theme.colors.primary} />}
            onPress={() => router.push(ROUTES.walletImportSeedPhrase)}
            delay={800}
          />
        </ButtonContainer>
      </SafeAreaContainer>
    </LinearGradientBackground>
  );
}
