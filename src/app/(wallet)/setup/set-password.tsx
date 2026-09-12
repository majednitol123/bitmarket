import { useState, useCallback } from "react";
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import styled, { useTheme } from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDispatch } from "react-redux";
import { router } from "expo-router";
import { ThemeType } from "../../../styles/theme";
import { setWalletPassword } from "../../../store/biometricsSlice";
import { ROUTES } from "../../../constants/routes";
import { LinearGradientBackground } from "../../(app)/_layout";
import Button from "../../../components/Button/Button";
import { MotiView } from "moti";
import {
  DEFAULT_SECURITY_QUESTIONS,
  saveSecurityQuestionsAndAnswers,
} from "../../../services/securityQuestionsService";
import {
  LockIcon,
  ShieldCheckIcon,
  HelpCircleIcon,
  ChevronLeftIcon,
  CheckCircleIcon,
} from "../../../components/Icons/AppIcons";

/* ---------------- STYLES ---------------- */

const Container = styled(SafeAreaView)<{ theme: ThemeType }>`
  flex: 1;
  padding: ${(p) => p.theme.spacing.large};
  padding-top: 12px;
`;

const Card = styled.View<{ theme: ThemeType }>`
  background-color: ${(p) => p.theme.colors.cardBackground};
  border-radius: 24px;
  padding: 28px 20px;
  border: 1px solid ${(p) => p.theme.colors.border};
  width: 100%;
`;

const IconCircle = styled.View<{ theme: ThemeType }>`
  width: 64px;
  height: 64px;
  border-radius: 32px;
  background-color: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(139, 92, 246, 0.25);
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
  align-self: center;
`;

const Title = styled.Text<{ theme: ThemeType }>`
  font-family: ${(p) => p.theme.fonts.families.openBold};
  fontSize: 24px;
  color: ${(p) => p.theme.colors.white};
  text-align: center;
  margin-bottom: 8px;
`;

const Subtitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(p) => p.theme.fonts.families.openRegular};
  font-size: ${(p) => p.theme.fonts.sizes.normal};
  color: ${(p) => p.theme.colors.lightGrey};
  text-align: center;
  margin-bottom: 24px;
  line-height: 22px;
`;

const StrengthContainer = styled.View`
  flex-direction: row;
  margin-bottom: 16px;
  gap: 6px;
`;

const StrengthBar = styled.View<{ active: boolean; theme: ThemeType }>`
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background-color: ${({ active, theme }) =>
    active ? theme.colors.primary : theme.colors.grey};
`;

const StrengthText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(p) => p.theme.fonts.families.openRegular};
  font-size: ${(p) => p.theme.fonts.sizes.small};
  color: ${(p) => p.theme.colors.lightGrey};
  margin-bottom: 16px;
  text-align: right;
`;

const ButtonWrapper = styled.View`
  margin-top: 12px;
  width: 100%;
`;

export default function SetPasswordScreen() {
  const theme = useTheme() as ThemeType;
  const dispatch = useDispatch();

  // Wizard state: step 1 (passcode) -> step 2 (security questions)
  const [step, setStep] = useState<"password" | "questions">("password");

  // Passcode state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isFocused1, setFocused1] = useState(false);
  const [isFocused2, setFocused2] = useState(false);

  // Security questions state
  const [answers, setAnswers] = useState<Record<string, string>>({
    q1: "",
    q2: "",
    q3: "",
    q4: "",
    q5: "",
    q6: "",
  });
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getStrength = (pass: string) => {
    if (pass.length === 0) return 0;
    if (pass.length < 6) return 1;
    if (pass.length < 10) return 2;
    return 3;
  };

  const strength = getStrength(password);
  const strengthLabel = ["", "Weak", "Medium", "Strong"][strength];
  const strengthColors = ["transparent", "#ff5252", "#ffb74d", "#66bb6a"];

  const handleProceedToQuestions = () => {
    if (!password || !confirmPassword) {
      Alert.alert("Required Fields", "Please fill both passcode fields.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak Passcode", "Passcode must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Mismatch", "Passcodes do not match.");
      return;
    }

    // Passcode is valid, advance to 6 Security Questions
    setStep("questions");
  };

  const handleAnswerChange = (id: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [id]: text,
    }));
  };

  const handleSaveAndComplete = async () => {
    // Verify all 6 questions are answered
    for (let i = 0; i < DEFAULT_SECURITY_QUESTIONS.length; i++) {
      const q = DEFAULT_SECURITY_QUESTIONS[i];
      const ans = answers[q.id]?.trim();
      if (!ans) {
        Alert.alert(
          "Incomplete Answers",
          `Please answer Question ${i + 1}: "${q.question}"`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Prepare the 6 questions & answers payload
      const questionsToSave = DEFAULT_SECURITY_QUESTIONS.map((q) => ({
        id: q.id,
        question: q.question,
        answer: answers[q.id].trim(),
      }));

      // Hash answers securely and persist to SecureStore
      await saveSecurityQuestionsAndAnswers(questionsToSave);

      // Save the wallet password
      await dispatch(setWalletPassword(password) as any);

      // Navigate to Biometrics setup / confirmation
      router.replace(ROUTES.biometrics);
    } catch (e: any) {
      Alert.alert("Error Saving Setup", e.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const answeredCount = Object.values(answers).filter(
    (a) => a.trim().length > 0
  ).length;

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <Container>
        {/* Navigation / Header Row */}
        <View style={localStyles.headerRow}>
          {step === "questions" ? (
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                localStyles.backButton,
                {
                  backgroundColor: theme.colors.cardBackground,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => setStep("password")}
              hitSlop={12}
            >
              <ChevronLeftIcon size={20} color={theme.colors.white} strokeWidth={2.2} />
            </TouchableOpacity>
          ) : (
            <View style={{ height: 42 }} />
          )}

          {/* Step Pill */}
          <View
            style={[
              localStyles.stepPill,
              {
                backgroundColor: "rgba(139, 92, 246, 0.15)",
                borderColor: "rgba(139, 92, 246, 0.3)",
              },
            ]}
          >
            <Text style={[localStyles.stepPillText, { color: theme.colors.primaryLight }]}>
              {step === "password" ? "Step 1 of 2: Passcode" : "Step 2 of 2: Security Questions"}
            </Text>
          </View>
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={60}
        >
          <Card>
            {step === "password" ? (
              /* ═════════════════════════════════════════
                 STEP 1: PASSCODE SETUP
                 ═════════════════════════════════════════ */
              <View>
                <MotiView
                  from={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", damping: 12, delay: 100 }}
                >
                  <IconCircle>
                    <LockIcon size={28} color={theme.colors.primary} />
                  </IconCircle>
                </MotiView>

                <MotiView
                  from={{ opacity: 0, translateY: 16 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: "timing", duration: 400, delay: 200 }}
                >
                  <Title>Protect BitMarket</Title>
                  <Subtitle>
                    Create a passcode to secure BitMarket and protect your assets. You’ll use this passcode to unlock the app.
                  </Subtitle>
                </MotiView>

                <MotiView
                  from={{ opacity: 0, translateY: 16 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: "timing", duration: 400, delay: 300 }}
                >
                  {/* Password Input */}
                  <MotiView
                    animate={{
                      borderColor: isFocused1
                        ? "rgba(139, 92, 246, 0.85)"
                        : "rgba(139, 92, 246, 0.25)",
                      backgroundColor: theme.colors.dark,
                    }}
                    transition={{ type: "timing", duration: 200 }}
                    style={localStyles.inputWrapper}
                  >
                    <View style={{ marginRight: 10 }}>
                      <LockIcon
                        size={18}
                        color={isFocused1 ? theme.colors.primaryLight : theme.colors.lightGrey}
                      />
                    </View>
                    <TextInput
                      style={[localStyles.input, { color: theme.colors.white }]}
                      secureTextEntry
                      placeholder="Enter passcode (min 6 characters)"
                      placeholderTextColor={theme.colors.lightGrey}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocused1(true)}
                      onBlur={() => setFocused1(false)}
                    />
                  </MotiView>

                  {/* Password Strength Indicator */}
                  {password.length > 0 && (
                    <MotiView
                      from={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      style={{ marginBottom: 12 }}
                    >
                      <StrengthContainer>
                        {[1, 2, 3].map((lvl) => (
                          <StrengthBar
                            key={lvl}
                            active={strength >= lvl}
                            theme={theme}
                            style={{
                              backgroundColor:
                                strength >= lvl
                                  ? strengthColors[strength]
                                  : theme.colors.grey,
                            }}
                          />
                        ))}
                      </StrengthContainer>
                      <StrengthText
                        theme={theme}
                        style={{ color: strengthColors[strength] }}
                      >
                        {strengthLabel}
                      </StrengthText>
                    </MotiView>
                  )}

                  {/* Confirm Password Input */}
                  <MotiView
                    animate={{
                      borderColor: isFocused2
                        ? "rgba(139, 92, 246, 0.85)"
                        : "rgba(139, 92, 246, 0.25)",
                      backgroundColor: theme.colors.dark,
                    }}
                    transition={{ type: "timing", duration: 200 }}
                    style={localStyles.inputWrapper}
                  >
                    <View style={{ marginRight: 10 }}>
                      <LockIcon
                        size={18}
                        color={isFocused2 ? theme.colors.primaryLight : theme.colors.lightGrey}
                      />
                    </View>
                    <TextInput
                      style={[localStyles.input, { color: theme.colors.white }]}
                      secureTextEntry
                      placeholder="Confirm passcode"
                      placeholderTextColor={theme.colors.lightGrey}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocused2(true)}
                      onBlur={() => setFocused2(false)}
                      onSubmitEditing={handleProceedToQuestions}
                      returnKeyType="next"
                    />
                  </MotiView>

                  <ButtonWrapper>
                    <Button
                      title="Continue to Security Questions"
                      backgroundColor={theme.colors.primary}
                      color={theme.colors.realWhite}
                      onPress={handleProceedToQuestions}
                    />
                  </ButtonWrapper>
                </MotiView>
              </View>
            ) : (
              /* ═════════════════════════════════════════
                 STEP 2: 6 SECURITY QUESTIONS
                 ═════════════════════════════════════════ */
              <View>
                <MotiView
                  from={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", damping: 12 }}
                >
                  <IconCircle>
                    <ShieldCheckIcon size={28} color={theme.colors.primary} />
                  </IconCircle>
                </MotiView>

                <MotiView
                  from={{ opacity: 0, translateY: 16 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: "timing", duration: 350 }}
                >
                  <Title>Security Questions</Title>
                  <Subtitle>
                    Answer all 6 questions to protect your account. These will be required to reset your passcode if you ever forget it.
                  </Subtitle>

                  {/* Answer Progress Banner */}
                  <View
                    style={[
                      localStyles.progressCard,
                      {
                        backgroundColor:
                          answeredCount === 6
                            ? "rgba(16, 185, 129, 0.12)"
                            : "rgba(139, 92, 246, 0.1)",
                        borderColor:
                          answeredCount === 6
                            ? "rgba(16, 185, 129, 0.3)"
                            : "rgba(139, 92, 246, 0.25)",
                      },
                    ]}
                  >
                    {answeredCount === 6 ? (
                      <CheckCircleIcon size={18} color="#10B981" />
                    ) : (
                      <HelpCircleIcon size={18} color={theme.colors.primaryLight} />
                    )}
                    <Text
                      style={[
                        localStyles.progressCardText,
                        {
                          color:
                            answeredCount === 6 ? "#10B981" : theme.colors.primaryLight,
                        },
                      ]}
                    >
                      {answeredCount === 6
                        ? "All 6 questions answered"
                        : `${answeredCount} of 6 questions answered`}
                    </Text>
                  </View>
                </MotiView>

                {/* 6 Questions List */}
                <View style={{ marginTop: 8 }}>
                  {DEFAULT_SECURITY_QUESTIONS.map((q, index) => {
                    const isFocused = focusedQuestionId === q.id;
                    const hasAnswer = (answers[q.id] || "").trim().length > 0;

                    return (
                      <MotiView
                        key={q.id}
                        from={{ opacity: 0, translateY: 12 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: "timing", duration: 300, delay: index * 60 }}
                        style={localStyles.questionBlock}
                      >
                        {/* Question Label */}
                        <View style={localStyles.questionLabelRow}>
                          <View
                            style={[
                              localStyles.questionBadge,
                              {
                                backgroundColor: hasAnswer
                                  ? "rgba(16, 185, 129, 0.18)"
                                  : "rgba(139, 92, 246, 0.15)",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                localStyles.questionBadgeText,
                                {
                                  color: hasAnswer ? "#10B981" : theme.colors.primaryLight,
                                },
                              ]}
                            >
                              {index + 1}
                            </Text>
                          </View>
                          <Text
                            style={[
                              localStyles.questionText,
                              { color: theme.colors.white },
                            ]}
                          >
                            {q.question}
                          </Text>
                        </View>

                        {/* Answer Input */}
                        <MotiView
                          animate={{
                            borderColor: isFocused
                              ? "rgba(139, 92, 246, 0.85)"
                              : hasAnswer
                              ? "rgba(16, 185, 129, 0.4)"
                              : "rgba(139, 92, 246, 0.25)",
                            backgroundColor: theme.colors.dark,
                          }}
                          transition={{ type: "timing", duration: 200 }}
                          style={localStyles.answerInputWrapper}
                        >
                          <TextInput
                            style={[localStyles.input, { color: theme.colors.white }]}
                            placeholder="Type your answer"
                            placeholderTextColor={theme.colors.lightGrey}
                            value={answers[q.id]}
                            onChangeText={(text) => handleAnswerChange(q.id, text)}
                            autoCapitalize="none"
                            autoCorrect={false}
                            onFocus={() => setFocusedQuestionId(q.id)}
                            onBlur={() => setFocusedQuestionId(null)}
                            returnKeyType={index === 5 ? "done" : "next"}
                          />
                          {hasAnswer && (
                            <View style={{ marginLeft: 8 }}>
                              <CheckCircleIcon size={18} color="#10B981" />
                            </View>
                          )}
                        </MotiView>
                      </MotiView>
                    );
                  })}
                </View>

                {/* Submit Button */}
                <ButtonWrapper>
                  <Button
                    title={isSubmitting ? "Securing BitMarket..." : "Complete Setup"}
                    backgroundColor={theme.colors.primary}
                    color={theme.colors.realWhite}
                    onPress={handleSaveAndComplete}
                    disabled={isSubmitting}
                  />
                </ButtonWrapper>
              </View>
            )}
          </Card>
        </KeyboardAwareScrollView>
      </Container>
    </LinearGradientBackground>
  );
}

const localStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  stepPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  stepPillText: {
    fontSize: 12,
    fontFamily: "OpenSans-Bold",
  },
  inputWrapper: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    height: 54,
  },
  input: {
    flex: 1,
    fontFamily: "OpenSans-Regular",
    fontSize: 15,
    height: 54,
  },
  progressCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  progressCardText: {
    fontSize: 13,
    fontFamily: "OpenSans-Bold",
  },
  questionBlock: {
    marginBottom: 14,
  },
  questionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  questionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  questionBadgeText: {
    fontSize: 12,
    fontFamily: "OpenSans-Bold",
  },
  questionText: {
    fontSize: 14,
    fontFamily: "OpenSans-Bold",
    flex: 1,
  },
  answerInputWrapper: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    height: 50,
  },
});
