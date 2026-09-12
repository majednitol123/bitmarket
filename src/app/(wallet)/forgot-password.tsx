import { useState, useEffect, useCallback } from "react";
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDispatch, useSelector } from "react-redux";
import { router } from "expo-router";
import { ThemeType } from "../../styles/theme";
import { AppDispatch, RootState } from "../../store";
import {
  resetWalletPassword,
  clearResetState,
  recordFailedVerification,
} from "../../store/biometricsSlice";
import { LinearGradientBackground } from "../(app)/_layout";
import Button from "../../components/Button/Button";
import { ROUTES } from "../../constants/routes";
import { MotiView } from "moti";
import {
  LockIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
  CheckCircleIcon,
  HelpCircleIcon,
} from "../../components/Icons/AppIcons";
import {
  getRandomQuestionsForVerification,
  verifySecurityAnswers,
  hasSecurityQuestions,
  SecurityQuestionView,
} from "../../services/securityQuestionsService";

export default function ForgotPasswordScreen() {
  const theme = useTheme() as ThemeType;
  const dispatch = useDispatch<AppDispatch>();
  const styles = createStyles(theme);

  const { unlocked, errorMessage, status, resetAttempts, resetLockedUntil } =
    useSelector((state: RootState) => state.biometrics);

  // Wizard state: "questions" -> "password"
  const [step, setStep] = useState<"questions" | "password">("questions");

  // Questions verification state
  const [randomQuestions, setRandomQuestions] = useState<SecurityQuestionView[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [questionsLoaded, setQuestionsLoaded] = useState(false);
  const [hasConfiguredQuestions, setHasConfiguredQuestions] = useState(true);

  // New password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isFocusedPw1, setFocusedPw1] = useState(false);
  const [isFocusedPw2, setFocusedPw2] = useState(false);

  // Lockout countdown timer
  const [lockdownSeconds, setLockdownSeconds] = useState(0);

  // Load 3 random security questions on mount
  const loadQuestions = useCallback(async () => {
    try {
      const hasQuestions = await hasSecurityQuestions();
      setHasConfiguredQuestions(hasQuestions);

      if (!hasQuestions) {
        setQuestionsLoaded(true);
        return;
      }

      const selected = await getRandomQuestionsForVerification(3);
      setRandomQuestions(selected);
      const initialAnswers: Record<string, string> = {};
      selected.forEach((q) => {
        initialAnswers[q.id] = "";
      });
      setAnswers(initialAnswers);
    } catch (err) {
      console.warn("Failed to load security questions for verification:", err);
    } finally {
      setQuestionsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      dispatch(clearResetState());
    };
  }, [dispatch]);

  // Navigate to home after successful reset
  useEffect(() => {
    if (unlocked) {
      router.replace(ROUTES.home);
    }
  }, [unlocked]);

  // Lockout countdown timer
  useEffect(() => {
    if (!resetLockedUntil) {
      setLockdownSeconds(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((resetLockedUntil - Date.now()) / 1000));
      setLockdownSeconds(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [resetLockedUntil]);

  // Password strength calculator
  const getStrength = (pass: string) => {
    if (pass.length === 0) return 0;
    if (pass.length < 6) return 1;
    if (pass.length < 10) return 2;
    return 3;
  };

  const strength = getStrength(newPassword);
  const strengthLabel = ["", "Weak", "Medium", "Strong"][strength];
  const strengthColors = ["transparent", "#ff5252", "#ffb74d", "#66bb6a"];

  const isLocked = lockdownSeconds > 0;
  const isLoading = status === "loading" || isVerifying;

  const handleAnswerChange = (id: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [id]: text,
    }));
  };

  // ─── Step 1 Verification ───
  const handleVerifyAnswers = async () => {
    if (isLocked) return;

    // Ensure all 3 questions have non-empty answers
    for (let i = 0; i < randomQuestions.length; i++) {
      const q = randomQuestions[i];
      const ans = (answers[q.id] || "").trim();
      if (!ans) {
        Alert.alert(
          "Incomplete Answers",
          `Please answer Question ${i + 1}: "${q.question}"`
        );
        return;
      }
    }

    setIsVerifying(true);
    try {
      const isValid = await verifySecurityAnswers(answers);
      if (isValid) {
        dispatch(clearResetState());
        setStep("password");
      } else {
        dispatch(recordFailedVerification("One or more answers are incorrect. Please try again."));
      }
    } catch (err: any) {
      Alert.alert("Verification Error", err.message || "Failed to verify answers.");
    } finally {
      setIsVerifying(false);
    }
  };

  // ─── Step 2 New Password Submission ───
  const handleResetPassword = useCallback(() => {
    if (isLocked) return;

    // Validate new password rules
    if (!newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in both passcode fields.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Weak Passcode", "Passcode must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "Passcodes do not match.");
      return;
    }

    // Dispatch password reset (updates password without modifying security questions)
    dispatch(resetWalletPassword({ newPassword }));
  }, [newPassword, confirmPassword, isLocked, dispatch]);

  const formatLockdownTime = (seconds: number) => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return `${seconds}s`;
  };

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaView style={styles.container}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.backButton}
            onPress={() => {
              if (step === "password") {
                setStep("questions");
                setNewPassword("");
                setConfirmPassword("");
                dispatch(clearResetState());
              } else if (router.canGoBack()) {
                router.back();
              } else {
                router.replace(ROUTES.unlock);
              }
            }}
            hitSlop={12}
          >
            <ChevronLeftIcon size={20} color={theme.colors.white} strokeWidth={2.2} />
          </TouchableOpacity>

          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>
              {step === "password"
                ? "Step 2 of 2: New Passcode"
                : "Step 1 of 2: Security Verification"}
            </Text>
          </View>
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={60}
        >
          <View style={styles.card}>
            {/* Header Block */}
            <MotiView
              from={{ opacity: 0, translateY: -16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 400 }}
              style={{ alignItems: "center" }}
            >
              <View style={styles.iconCircle}>
                {step === "password" ? (
                  <LockIcon size={30} color={theme.colors.primary} />
                ) : (
                  <ShieldCheckIcon size={30} color={theme.colors.primary} />
                )}
              </View>
              <Text style={styles.title}>
                {step === "password" ? "Create New Passcode" : "Security Verification"}
              </Text>
              <Text style={styles.subtitle}>
                {step === "password"
                  ? "Enter and confirm your new passcode to unlock BitMarket."
                  : hasConfiguredQuestions
                  ? "Answer the 3 security questions below to verify your identity."
                  : "No security questions were configured for this wallet."}
              </Text>
            </MotiView>

            {/* Form Block */}
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 400, delay: 150 }}
              style={{ width: "100%" }}
            >
              {/* Lockout warning */}
              {isLocked && (
                <MotiView
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: "timing", duration: 300 }}
                  style={styles.lockoutContainer}
                >
                  <Text style={styles.lockoutIcon}>⏳</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lockoutTitle}>Too many attempts</Text>
                    <Text style={styles.lockoutText}>
                      Try again in {formatLockdownTime(lockdownSeconds)}
                    </Text>
                  </View>
                </MotiView>
              )}

              {/* Error message */}
              {errorMessage && !isLoading && !isLocked ? (
                <MotiView
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: "timing", duration: 300 }}
                  style={styles.errorContainer}
                >
                  <View style={styles.errorDot} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </MotiView>
              ) : null}

              {!questionsLoaded ? (
                <View style={{ paddingVertical: 32, alignItems: "center" }}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
              ) : step === "questions" && hasConfiguredQuestions ? (
                /* ─── Step 1: 3 Random Security Questions ─── */
                <View>
                  {randomQuestions.map((q, index) => {
                    const isFocused = focusedQuestionId === q.id;
                    const hasAnswer = (answers[q.id] || "").trim().length > 0;

                    return (
                      <View key={q.id} style={styles.questionBlock}>
                        <View style={styles.questionLabelRow}>
                          <View
                            style={[
                              styles.questionBadge,
                              {
                                backgroundColor: hasAnswer
                                  ? "rgba(16, 185, 129, 0.18)"
                                  : "rgba(139, 92, 246, 0.15)",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.questionBadgeText,
                                {
                                  color: hasAnswer ? "#10B981" : theme.colors.primaryLight,
                                },
                              ]}
                            >
                              {index + 1}
                            </Text>
                          </View>
                          <Text style={styles.questionText}>{q.question}</Text>
                        </View>

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
                          style={styles.inputWrapper}
                        >
                          <TextInput
                            style={styles.input}
                            placeholder="Type your answer"
                            placeholderTextColor={theme.colors.lightGrey}
                            value={answers[q.id] || ""}
                            onChangeText={(text) => handleAnswerChange(q.id, text)}
                            autoCapitalize="none"
                            autoCorrect={false}
                            onFocus={() => setFocusedQuestionId(q.id)}
                            onBlur={() => setFocusedQuestionId(null)}
                            editable={!isLocked}
                            returnKeyType={index === randomQuestions.length - 1 ? "done" : "next"}
                          />
                          {hasAnswer && (
                            <View style={{ marginLeft: 8 }}>
                              <CheckCircleIcon size={18} color="#10B981" />
                            </View>
                          )}
                        </MotiView>
                      </View>
                    );
                  })}

                  <View style={styles.buttonWrapper}>
                    <Button
                      title={isVerifying ? "Verifying Answers..." : "Verify Answers"}
                      backgroundColor={theme.colors.primary}
                      color={theme.colors.realWhite}
                      onPress={handleVerifyAnswers}
                      disabled={isLocked || isVerifying}
                    />
                  </View>
                </View>
              ) : step === "questions" && !hasConfiguredQuestions ? (
                /* No security questions configured */
                <View>
                  <View style={styles.warningBox}>
                    <HelpCircleIcon size={20} color={theme.colors.primaryLight} />
                    <Text style={styles.warningBoxText}>
                      Security questions were not configured for this wallet. Security recovery is unavailable.
                    </Text>
                  </View>

                  <Button
                    title="Back to Unlock"
                    backgroundColor={theme.colors.primary}
                    color={theme.colors.realWhite}
                    onPress={() => router.replace(ROUTES.unlock)}
                  />
                </View>
              ) : (
                /* ─── Step 2: Create New Passcode ─── */
                <View>
                  {/* New Password */}
                  <MotiView
                    animate={{
                      borderColor: isFocusedPw1
                        ? "rgba(139, 92, 246, 0.85)"
                        : "rgba(139, 92, 246, 0.25)",
                      backgroundColor: theme.colors.dark,
                    }}
                    transition={{ type: "timing", duration: 200 }}
                    style={styles.inputWrapper}
                  >
                    <View style={{ marginRight: 10 }}>
                      <LockIcon
                        size={18}
                        color={isFocusedPw1 ? theme.colors.primaryLight : theme.colors.lightGrey}
                      />
                    </View>
                    <TextInput
                      style={styles.input}
                      secureTextEntry
                      placeholder="New passcode (min 6 characters)"
                      placeholderTextColor={theme.colors.lightGrey}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      autoFocus
                      onFocus={() => setFocusedPw1(true)}
                      onBlur={() => setFocusedPw1(false)}
                    />
                  </MotiView>

                  {/* Strength Bar */}
                  {newPassword.length > 0 && (
                    <View style={{ marginBottom: 16 }}>
                      <View style={styles.strengthContainer}>
                        {[1, 2, 3].map((level) => (
                          <View
                            key={level}
                            style={[
                              styles.strengthBar,
                              {
                                backgroundColor:
                                  strength >= level
                                    ? strengthColors[strength]
                                    : theme.colors.grey,
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={[styles.strengthText, { color: strengthColors[strength] }]}>
                        {strengthLabel}
                      </Text>
                    </View>
                  )}

                  {/* Confirm New Password */}
                  <MotiView
                    animate={{
                      borderColor: isFocusedPw2
                        ? "rgba(139, 92, 246, 0.85)"
                        : "rgba(139, 92, 246, 0.25)",
                      backgroundColor: theme.colors.dark,
                    }}
                    transition={{ type: "timing", duration: 200 }}
                    style={styles.inputWrapper}
                  >
                    <View style={{ marginRight: 10 }}>
                      <LockIcon
                        size={18}
                        color={isFocusedPw2 ? theme.colors.primaryLight : theme.colors.lightGrey}
                      />
                    </View>
                    <TextInput
                      style={styles.input}
                      secureTextEntry
                      placeholder="Confirm new passcode"
                      placeholderTextColor={theme.colors.lightGrey}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedPw2(true)}
                      onBlur={() => setFocusedPw2(false)}
                      onSubmitEditing={handleResetPassword}
                      returnKeyType="done"
                    />
                  </MotiView>

                  <View style={styles.buttonWrapper}>
                    <Button
                      title="Update Passcode"
                      backgroundColor={theme.colors.primary}
                      color={theme.colors.realWhite}
                      onPress={handleResetPassword}
                      loading={isLoading}
                      disabled={isLocked}
                    />
                  </View>
                </View>
              )}

              {/* Attempt Counter */}
              {resetAttempts > 0 && !isLocked && (
                <Text style={styles.attemptText}>
                  {resetAttempts} failed attempt{resetAttempts > 1 ? "s" : ""}
                </Text>
              )}
            </MotiView>
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </LinearGradientBackground>
  );
}

function createStyles(theme: ThemeType) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: parseFloat(theme.spacing.large as string),
      paddingTop: 12,
    },
    headerRow: {
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    stepBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      backgroundColor: "rgba(139, 92, 246, 0.15)",
      borderColor: "rgba(139, 92, 246, 0.3)",
    },
    stepBadgeText: {
      fontSize: 12,
      fontFamily: theme.fonts.families.openBold,
      color: theme.colors.primaryLight,
    },
    card: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 24,
      padding: 26,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      width: "100%",
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "rgba(139, 92, 246, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(139, 92, 246, 0.25)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 18,
      alignSelf: "center",
    },
    title: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: 22,
      color: theme.colors.white,
      textAlign: "center",
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.normal as string),
      color: theme.colors.lightGrey,
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 22,
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
      fontFamily: theme.fonts.families.openBold,
    },
    questionText: {
      fontSize: 14,
      fontFamily: theme.fonts.families.openBold,
      color: theme.colors.white,
      flex: 1,
    },
    inputWrapper: {
      backgroundColor: theme.colors.dark,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      height: 52,
    },
    input: {
      flex: 1,
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.normal as string),
      height: 52,
    },
    warningBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(139, 92, 246, 0.1)",
      borderWidth: 1,
      borderColor: "rgba(139, 92, 246, 0.25)",
      borderRadius: 12,
      padding: 14,
      marginBottom: 20,
      gap: 12,
    },
    warningBoxText: {
      fontSize: 13,
      fontFamily: theme.fonts.families.openRegular,
      color: theme.colors.primaryLight,
      flex: 1,
      lineHeight: 18,
    },
    strengthContainer: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 4,
    },
    strengthBar: {
      flex: 1,
      height: 4,
      borderRadius: 2,
    },
    strengthText: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.small as string),
      textAlign: "right",
    },
    buttonWrapper: {
      marginTop: 12,
    },
    errorContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255, 82, 82, 0.15)",
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 16,
    },
    errorDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#ff5252",
      marginRight: 8,
    },
    errorText: {
      color: "#ff5252",
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.small as string),
      flex: 1,
    },
    lockoutContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255, 152, 0, 0.12)",
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 16,
      gap: 12,
    },
    lockoutIcon: {
      fontSize: 24,
    },
    lockoutTitle: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: parseFloat(theme.fonts.sizes.normal as string),
      color: "#ffb74d",
      marginBottom: 2,
    },
    lockoutText: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.small as string),
      color: "#ffb74d",
    },
    attemptText: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.small as string),
      color: theme.colors.lightGrey,
      textAlign: "center",
      marginTop: 12,
    },
  });
}
