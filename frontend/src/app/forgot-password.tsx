import { router } from "expo-router";
import {
  ArrowLeft,
  AtSign,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { styled } from "styled-components/native";

import { IconButton } from "@/components/IconButton";
import { BrandSymbol } from "@/components/BrandLogo";
import { api, ApiError } from "@/services/api";
import { colors } from "@/theme";

type Step = "identifier" | "otp" | "password" | "success";
type FocusedField = "identifier" | "otp" | "password" | "confirm" | null;

const Screen = styled(SafeAreaView)`
  flex: 1;
  background-color: ${colors.canvas};
`;

const KeyboardShell = styled(KeyboardAvoidingView)`
  flex: 1;
`;

const Content = styled.View`
  width: 100%;
  max-width: 460px;
  align-self: center;
  gap: 18px;
  padding: 16px;
`;

const BrandRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const BrandCopy = styled.View`
  flex: 1;
`;

const Brand = styled.Text`
  color: ${colors.ink};
  font-size: 26px;
  font-weight: 900;
`;

const Eyebrow = styled.Text`
  color: ${colors.brand};
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
`;

const Form = styled.View`
  gap: 13px;
  padding: 20px;
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: 8px;
  background-color: ${colors.surface};
`;

const Header = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
`;

const HeaderCopy = styled.View`
  flex: 1;
  gap: 4px;
`;

const Title = styled.Text`
  color: ${colors.ink};
  font-size: 22px;
  font-weight: 800;
`;

const Subtitle = styled.Text`
  color: ${colors.inkMuted};
  font-size: 13px;
  line-height: 19px;
`;

const Label = styled.Text`
  color: ${colors.ink};
  font-size: 13px;
  font-weight: 700;
`;

const Field = styled.View<{ $focused: boolean; $invalid?: boolean }>`
  min-height: 50px;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 0 13px;
  border-width: 1px;
  border-color: ${({ $focused, $invalid }) =>
    $invalid ? colors.coral : $focused ? colors.brand : colors.border};
  border-radius: 8px;
  background-color: ${colors.surface};
`;

const Input = styled.TextInput`
  flex: 1;
  min-width: 0;
  color: ${colors.ink};
  font-size: 15px;
`;

const OtpInput = styled(Input)`
  text-align: center;
  font-size: 22px;
  font-weight: 900;
`;

const Hint = styled.Text<{ $error?: boolean; $success?: boolean }>`
  color: ${({ $error, $success }) =>
    $error ? colors.coral : $success ? colors.brand : colors.inkMuted};
  font-size: 12px;
  line-height: 17px;
`;

const PrimaryButton = styled(Pressable)`
  min-height: 50px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background-color: ${colors.brand};
`;

const ButtonText = styled.Text`
  color: ${colors.white};
  font-size: 15px;
  font-weight: 800;
`;

const LinkRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4px;
`;

const SuccessIcon = styled.View`
  width: 62px;
  height: 62px;
  align-self: center;
  align-items: center;
  justify-content: center;
  border-radius: 31px;
  background-color: ${colors.brandSoft};
`;

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<FocusedField>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(
      () => setResendSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const requestOtp = async () => {
    if (busy) return;
    if (identifier.trim().replace(/^@/, "").length < 3) {
      setError("Enter your email address or username.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const result = await api.requestPasswordResetOtp(identifier);
      setResendSeconds(result.retryAfterSeconds);
      setStep("otp");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "The reset request could not be completed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (busy) return;
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit OTP sent to your account email.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const result = await api.verifyPasswordResetOtp(identifier, otp);
      setResetToken(result.resetToken);
      setStep("password");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "OTP verification failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (busy) return;
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/.test(password)) {
      setError(
        "Password must include an uppercase letter, number, and special character.",
      );
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!resetToken) {
      setError("Your reset session has expired. Start again.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await api.resetPassword(resetToken, password);
      setResetToken("");
      setPassword("");
      setConfirm("");
      setStep("success");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Password could not be reset. Start again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setStep("identifier");
    setOtp("");
    setResetToken("");
    setPassword("");
    setConfirm("");
    setError("");
  };

  const goBack = () => {
    if (step === "identifier") {
      router.back();
    } else {
      restart();
    }
  };

  const title = {
    identifier: "Forgot password",
    otp: "Verify your OTP",
    password: "Create new password",
    success: "Password updated",
  }[step];
  const subtitle = {
    identifier: "Enter your account email or username to continue.",
    otp: "If the account exists, a 6-digit OTP was sent to its registered email.",
    password: "Choose a strong new password for your Bondera account.",
    success: "Your password was changed and existing sessions were signed out.",
  }[step];

  return (
    <Screen>
      <KeyboardShell behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        >
          <Content>
            <BrandRow>
              <BrandSymbol size={46} />
              <BrandCopy>
                <Brand>Bondera</Brand>
                <Eyebrow>Your private circles</Eyebrow>
              </BrandCopy>
            </BrandRow>

            <Form>
              <Header>
                {step !== "success" ? (
                  <IconButton icon={ArrowLeft} label="Go back" onPress={goBack} />
                ) : null}
                <HeaderCopy>
                  <Title>{title}</Title>
                  <Subtitle>{subtitle}</Subtitle>
                </HeaderCopy>
              </Header>

              {step === "identifier" ? (
                <>
                  <Label>Email or username</Label>
                  <Field $focused={focused === "identifier"} $invalid={Boolean(error)}>
                    <AtSign size={19} color={colors.inkMuted} />
                    <Input
                      accessibilityLabel="Password reset email or username"
                      autoCapitalize="none"
                      autoComplete="username"
                      autoCorrect={false}
                      editable={!busy}
                      value={identifier}
                      onBlur={() => setFocused(null)}
                      onChangeText={(value) => {
                        setIdentifier(value);
                        setError("");
                      }}
                      onFocus={() => setFocused("identifier")}
                      onSubmitEditing={requestOtp}
                      placeholder="Email or username"
                      placeholderTextColor={colors.inkMuted}
                    />
                  </Field>
                  <Hint>
                    For privacy, Bondera shows the same response whether or not an account exists.
                  </Hint>
                </>
              ) : null}

              {step === "otp" ? (
                <>
                  <Label>Verification OTP</Label>
                  <Field $focused={focused === "otp"} $invalid={Boolean(error)}>
                    <ShieldCheck size={19} color={colors.inkMuted} />
                    <OtpInput
                      accessibilityLabel="Password reset OTP"
                      autoComplete="one-time-code"
                      editable={!busy}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otp}
                      onBlur={() => setFocused(null)}
                      onChangeText={(value) => {
                        setOtp(value.replace(/\D/g, ""));
                        setError("");
                      }}
                      onFocus={() => setFocused("otp")}
                      onSubmitEditing={verifyOtp}
                      placeholder="000000"
                      placeholderTextColor={colors.inkMuted}
                    />
                  </Field>
                  <LinkRow>
                    <Hint>Did not receive it?</Hint>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy || resendSeconds > 0}
                      onPress={requestOtp}
                    >
                      <Hint $success={resendSeconds === 0}>
                        {resendSeconds > 0
                          ? `Resend in ${resendSeconds}s`
                          : "Resend OTP"}
                      </Hint>
                    </Pressable>
                  </LinkRow>
                </>
              ) : null}

              {step === "password" ? (
                <>
                  <Label>Create new password</Label>
                  <Field $focused={focused === "password"}>
                    <LockKeyhole size={19} color={colors.inkMuted} />
                    <Input
                      accessibilityLabel="Create new password"
                      autoComplete="new-password"
                      autoCorrect={false}
                      editable={!busy}
                      secureTextEntry={!showPassword}
                      value={password}
                      onBlur={() => setFocused(null)}
                      onChangeText={(value) => {
                        setPassword(value);
                        setError("");
                      }}
                      onFocus={() => setFocused("password")}
                      placeholder="New password"
                      placeholderTextColor={colors.inkMuted}
                    />
                    <Pressable
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? (
                        <EyeOff size={19} color={colors.inkMuted} />
                      ) : (
                        <Eye size={19} color={colors.inkMuted} />
                      )}
                    </Pressable>
                  </Field>
                  <Hint>
                    Minimum 6 characters with uppercase, number, and special character.
                  </Hint>
                  <Label>Confirm new password</Label>
                  <Field $focused={focused === "confirm"}>
                    <LockKeyhole size={19} color={colors.inkMuted} />
                    <Input
                      accessibilityLabel="Confirm new password"
                      autoComplete="new-password"
                      autoCorrect={false}
                      editable={!busy}
                      secureTextEntry={!showPassword}
                      value={confirm}
                      onBlur={() => setFocused(null)}
                      onChangeText={(value) => {
                        setConfirm(value);
                        setError("");
                      }}
                      onFocus={() => setFocused("confirm")}
                      onSubmitEditing={resetPassword}
                      placeholder="Repeat new password"
                      placeholderTextColor={colors.inkMuted}
                    />
                  </Field>
                </>
              ) : null}

              {step === "success" ? (
                <SuccessIcon>
                  <CheckCircle2 size={34} color={colors.brand} />
                </SuccessIcon>
              ) : null}

              {error ? <Hint $error accessibilityRole="alert">{error}</Hint> : null}

              <PrimaryButton
                accessibilityRole="button"
                disabled={busy}
                onPress={
                  step === "identifier"
                    ? requestOtp
                    : step === "otp"
                      ? verifyOtp
                      : step === "password"
                        ? resetPassword
                        : () => router.replace("/login")
                }
                style={({ pressed }) => ({ opacity: pressed || busy ? 0.76 : 1 })}
              >
                {busy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <ButtonText>
                    {step === "identifier"
                      ? "Send reset OTP"
                      : step === "otp"
                        ? "Verify OTP"
                        : step === "password"
                          ? "Reset password"
                          : "Back to sign in"}
                  </ButtonText>
                )}
              </PrimaryButton>
            </Form>
          </Content>
        </ScrollView>
      </KeyboardShell>
    </Screen>
  );
}
