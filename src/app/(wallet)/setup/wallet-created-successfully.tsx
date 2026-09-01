import React, { useState, useEffect } from "react";
import { BackHandler, SafeAreaView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import styled, { useTheme } from "styled-components/native";
import { useDispatch, useSelector } from "react-redux";
import { MotiView } from "moti";
import { useIsFocused } from "expo-router/react-navigation";

import Button from "../../../components/Button/Button";
import { LinearGradientBackground } from "../../../components/Styles/Gradient";
import { ThemeType } from "../../../styles/theme";
import CheckMark from "../../../assets/svg/check-mark.svg";
import ShieldCheckIcon from "../../../assets/svg/shield-check.svg";
import { RootState } from "../../../store";

const SafeAreaContainer = styled(SafeAreaView)<{ theme: ThemeType }>`
  flex: 1;
  justify-content: flex-end;
`;

const ContentContainer = styled.View<{ theme: ThemeType }>`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding-horizontal: ${(props) => props.theme.spacing.large};
`;

const HeroSection = styled.View`
  align-items: center;
  margin-bottom: 32px;
`;

const HaloContainer = styled.View`
  justify-content: center;
  align-items: center;
  margin-bottom: 40px;
`;

const SuccessCircleBase = styled.View<{ theme: ThemeType }>`
  width: 100px;
  height: 100px;
  border-radius: 50px;
  background-color: ${(props) => props.theme.colors.primary};
  justify-content: center;
  align-items: center;
  z-index: 2;
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
`;

export default function WalletCreationSuccessPage() {
  const { successState } = useLocalSearchParams();
  const theme = useTheme();
  const dispatch = useDispatch();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("You're All Set!");
  const [subtitle, setSubtitle] = useState(
    "Your new multichain wallet is ready. Let's start tracking and securing your assets."
  );

  const chainId = useSelector((state: RootState) => state.ethereum.activeChainId);
  const globalAddresses = useSelector((state: RootState) => state.ethereum.globalAddresses);

  useEffect(() => {
    if (successState === "import") {
      setTitle("Wallet Imported!");
      setSubtitle(
        "Your imported multichain wallet is ready. Let's start tracking and securing your assets."
      );
    }
  }, [successState]);

  useEffect(() => {
    if (!isFocused) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [isFocused]);

  const handleContinue = () => {
    router.push("/(wallet)/setup/set-password");
  };

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaContainer>
        <ContentContainer>
          <HeroSection>
            <HaloContainer>
              {/* Outer pulsing halo */}
              <MotiView
                from={{ scale: 1, opacity: 0.3 }}
                animate={isFocused ? { scale: 1.5, opacity: 0 } : { scale: 1, opacity: 0.3 }}
                transition={{
                  type: "timing",
                  duration: 2000,
                  loop: isFocused,
                  repeatReverse: false,
                }}
                style={{
                  position: "absolute",
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  backgroundColor: theme.colors.primary,
                }}
              />
              <MotiView
                from={{ scale: 1, opacity: 0.5 }}
                animate={isFocused ? { scale: 1.2, opacity: 0 } : { scale: 1, opacity: 0.5 }}
                transition={{
                  type: "timing",
                  duration: 2000,
                  loop: isFocused,
                  repeatReverse: false,
                  delay: 500,
                }}
                style={{
                  position: "absolute",
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  backgroundColor: theme.colors.primary,
                }}
              />
              <SuccessCircleBase>
                <ShieldCheckIcon color={theme.colors.white} width={48} height={48} />
              </SuccessCircleBase>
            </HaloContainer>

            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 800, delay: 300 }}
              style={{ alignItems: "center" }}
            >
              <Title>{title}</Title>
              <Subtitle>{subtitle}</Subtitle>
            </MotiView>
          </HeroSection>
        </ContentContainer>

        <MotiView
          from={{ opacity: 0, translateY: 40 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 800, delay: 600 }}
        >
          <ButtonContainer>
            <Button
              backgroundColor={theme.colors.primary}
              color={theme.colors.realWhite}
              loading={loading}
              disabled={loading}
              onPress={handleContinue}
              title="Continue"
              icon={<CheckMark width={20} height={20} fill={theme.colors.realWhite} />}
            />
          </ButtonContainer>
        </MotiView>
      </SafeAreaContainer>
    </LinearGradientBackground>
  );
}
