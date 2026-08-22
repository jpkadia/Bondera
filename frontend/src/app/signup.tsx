import { router } from "expo-router";
import {
  ArrowLeft,
  AtSign,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MessageCircleMore,
  ShieldCheck,
  UserRound,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { styled } from "styled-components/native";

import { IconButton } from "@/components/IconButton";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { useAuth } from "@/context/AuthContext";
import {
  normalizeUsernameInput,
  USERNAME_PATTERN,
  USERNAME_REQUIREMENTS,
} from "@/constants/auth";
import { api, ApiError, type SignupDetails } from "@/services/api";
import { colors } from "@/theme";

type FieldName = "fullName" | "username" | "email" | "password" | "confirm" | "otp";

const Screen = styled.SafeAreaView`
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
  padding: 24px;
`;

const BrandRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const BrandMark = styled.View`
  width: 46px;
  height: 46px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background-color: ${colors.brand};
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

const Hint = styled.Text<{ $error?: boolean }>`
  color: ${({ $error }) => $error ? colors.coral : colors.inkMuted};
  font-size: 12px;
  line-height: 17px;
`;

const ButtonText = styled.Text<{ $dark?: boolean }>`
  color: ${({ $dark }) => $dark ? colors.ink : colors.white};
  font-size: 15px;
  font-weight: 800;
`;

const CodeWrap = styled.View`
  align-items: center;
  gap: 12px;
  padding: 6px 0;
`;

const CodeIcon = styled.View`
  width: 54px;
  height: 54px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background-color: ${colors.brandSoft};
`;

const OtpField = styled(Field)`
  width: 100%;
`;

const OtpInput = styled(Input)`
  text-align: center;
  font-size: 22px;
  font-weight: 900;
`;

const LinkRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4px;
`;

const DividerRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
`;

const DividerLine = styled.View`
  flex: 1;
  height: 1px;
  background-color: ${colors.border};
`;

const DividerText = styled.Text`
  color: ${colors.inkMuted};
  font-size: 12px;
`;

function validate(details: SignupDetails, confirm: string): string {
  if (details.fullName && details.fullName.trim().length > 80) {
    return "Full name cannot exceed 80 characters.";
  }
  if (!USERNAME_PATTERN.test(details.username.trim())) {
    return USERNAME_REQUIREMENTS;
  }
  if (!/^\S+@\S+\.\S+$/.test(details.email.trim())) {
    return "Enter a valid email address.";
  }
  if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/.test(details.password)) {
    return "Password must include an uppercase letter, number, and special character.";
  }
  if (details.password !== confirm) return "Passwords do not match.";
  return "";
}

export default function SignupScreen() {
  const { user, signup, loginWithGoogle } = useAuth();
  const [step, setStep] = useState<"details" | "otp">("details");
  const [details, setDetails] = useState<SignupDetails>({
    fullName: "",
    username: "",
    email: "",
    password: "",
  });
  const [confirm, setConfirm] = useState("");
  const [otp, setOtp] = useState("");
  const [focused, setFocused] = useState<FieldName | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (user) router.replace("/home");
  }, [user]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => setResendSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const submitGoogle = useCallback(async (idToken: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await loginWithGoogle(idToken);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Google Sign-In failed. Try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, loginWithGoogle]);

  if (user) return null;

  const update = (key: keyof SignupDetails, value: string) => {
    setDetails((current) => ({
      ...current,
      [key]: key === "username" ? normalizeUsernameInput(value) : value,
    }));
    if (error) setError("");
  };

  const requestOtp = async () => {
    if (busy) return;
    const validationError = validate(details, confirm);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.requestSignupOtp(details);
      setResendSeconds(result.retryAfterSeconds);
      setStep("otp");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "OTP could not be sent. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (busy) return;
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit OTP sent to your email.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signup(details, otp);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "OTP verification failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resendSeconds > 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.requestSignupOtp(details);
      setResendSeconds(result.retryAfterSeconds);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "OTP could not be resent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardShell behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
          <Content>
            <BrandRow>
              <BrandMark><MessageCircleMore size={26} color={colors.white} /></BrandMark>
              <BrandCopy><Brand>Bondera</Brand><Eyebrow>Your private circles</Eyebrow></BrandCopy>
            </BrandRow>
            <Form>
              <Header>
                <IconButton
                  icon={ArrowLeft}
                  label={step === "otp" ? "Back to account details" : "Back to sign in"}
                  onPress={() => step === "otp" ? (setStep("details"), setError("")) : router.back()}
                />
                <HeaderCopy>
                  <Title>{step === "details" ? "Create your account" : "Verify your email"}</Title>
                  <Subtitle>{step === "details" ? "Set up your Bondera identity." : `We sent a 6-digit OTP to ${details.email.trim().toLowerCase()}.`}</Subtitle>
                </HeaderCopy>
              </Header>

              {step === "details" ? <>
                <GoogleAuthButton
                  disabled={busy}
                  onCredential={submitGoogle}
                  onError={setError}
                />
                <DividerRow accessibilityElementsHidden>
                  <DividerLine />
                  <DividerText>OR</DividerText>
                  <DividerLine />
                </DividerRow>
                <Label>Full name</Label>
                <Field $focused={focused === "fullName"}>
                  <UserRound size={19} color={colors.inkMuted} />
                  <Input
                    accessibilityLabel="Full name"
                  autoComplete="name"
                  editable={!busy}
                  value={details.fullName}
                    onChangeText={(value) => update("fullName", value)}
                    onFocus={() => setFocused("fullName")}
                    onBlur={() => setFocused(null)}
                    placeholder="Your name"
                    placeholderTextColor={colors.inkMuted}
                  />
                </Field>
                <Label>Username</Label>
                <Field $focused={focused === "username"}>
                  <AtSign size={19} color={colors.inkMuted} />
                  <Input
                    accessibilityLabel="Username"
                  autoCapitalize="none"
                  autoComplete="username-new"
                  autoCorrect={false}
                  editable={!busy}
                    maxLength={30}
                    value={details.username}
                    onChangeText={(value) => update("username", value)}
                    onFocus={() => setFocused("username")}
                    onBlur={() => setFocused(null)}
                    placeholder="your.username"
                    placeholderTextColor={colors.inkMuted}
                  />
                </Field>
                <Hint>{USERNAME_REQUIREMENTS}</Hint>
                <Label>Email</Label>
                <Field $focused={focused === "email"}>
                  <Mail size={19} color={colors.inkMuted} />
                  <Input
                    accessibilityLabel="Signup email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  editable={!busy}
                    keyboardType="email-address"
                    value={details.email}
                    onChangeText={(value) => update("email", value)}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.inkMuted}
                  />
                </Field>
                <Label>Password</Label>
                <Field $focused={focused === "password"}>
                  <LockKeyhole size={19} color={colors.inkMuted} />
                  <Input
                    accessibilityLabel="Create password"
                  autoComplete="new-password"
                  autoCorrect={false}
                  editable={!busy}
                    secureTextEntry={!showPassword}
                    value={details.password}
                    onChangeText={(value) => update("password", value)}
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused(null)}
                    placeholder="Create password"
                    placeholderTextColor={colors.inkMuted}
                  />
                  <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"} onPress={() => setShowPassword((value) => !value)}>
                    {showPassword ? <EyeOff size={19} color={colors.inkMuted} /> : <Eye size={19} color={colors.inkMuted} />}
                  </Pressable>
                </Field>
                <Hint>Minimum 6 characters with uppercase, number, and special character.</Hint>
                <Label>Confirm password</Label>
                <Field $focused={focused === "confirm"}>
                  <LockKeyhole size={19} color={colors.inkMuted} />
                  <Input
                    accessibilityLabel="Confirm password"
                  autoComplete="new-password"
                  autoCorrect={false}
                  editable={!busy}
                    secureTextEntry={!showPassword}
                    value={confirm}
                    onChangeText={(value) => { setConfirm(value); if (error) setError(""); }}
                    onFocus={() => setFocused("confirm")}
                    onBlur={() => setFocused(null)}
                    onSubmitEditing={requestOtp}
                    placeholder="Repeat password"
                    placeholderTextColor={colors.inkMuted}
                  />
                </Field>
              </> : <CodeWrap>
                <CodeIcon><ShieldCheck size={27} color={colors.brand} /></CodeIcon>
                <OtpField $focused={focused === "otp"} $invalid={Boolean(error)}>
                  <OtpInput
                    accessibilityLabel="Verification OTP"
                    autoComplete="one-time-code"
                    editable={!busy}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={(value) => { setOtp(value.replace(/\D/g, "")); if (error) setError(""); }}
                    onFocus={() => setFocused("otp")}
                    onBlur={() => setFocused(null)}
                    onSubmitEditing={verifyOtp}
                    placeholder="000000"
                    placeholderTextColor={colors.inkMuted}
                  />
                </OtpField>
              </CodeWrap>}

              {error ? <Hint $error accessibilityRole="alert">{error}</Hint> : null}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={step === "details" ? requestOtp : verifyOtp}
                style={({ pressed }) => ({
                  minHeight: 50,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  backgroundColor: colors.brand,
                  opacity: pressed || busy ? 0.76 : 1,
                })}
              >
                {busy ? <ActivityIndicator color={colors.white} /> : <ButtonText>{step === "details" ? "Send verification OTP" : "Verify and create account"}</ButtonText>}
              </Pressable>

              {step === "otp" ? <LinkRow>
                <Hint>Did not receive it?</Hint>
                <Pressable accessibilityRole="button" disabled={resendSeconds > 0 || busy} onPress={resend}>
                  <Hint $error={resendSeconds === 0}>{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend OTP"}</Hint>
                </Pressable>
              </LinkRow> : <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.replace("/login")} style={{ minHeight: 42, alignItems: "center", justifyContent: "center" }}>
                <ButtonText $dark>Already have an account? Sign in</ButtonText>
              </Pressable>}
            </Form>
          </Content>
        </ScrollView>
      </KeyboardShell>
    </Screen>
  );
}
