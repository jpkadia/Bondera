import { router } from "expo-router";
import {
  ArrowLeft,
  AtSign,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { styled } from "styled-components/native";

import { IconButton } from "@/components/IconButton";
import { BrandSymbol } from "@/components/BrandLogo";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import type { GoogleCredential } from "@/components/GoogleAuthButton.types";
import { BirthDateField } from "@/components/BirthDateField";
import { useAuth } from "@/context/AuthContext";
import {
  normalizeUsernameInput,
  USERNAME_REQUIREMENTS,
} from "@/constants/auth";
import { api, ApiError, type SignupDetails } from "@/services/api";
import { parseBirthDateText } from "@/services/birth-date";
import {
  validateOtp,
  validateSignupValues,
  type SignupErrors,
  type SignupValues,
} from "@/services/auth-validation";
import { colors } from "@/theme";

type FieldName = "fullName" | "username" | "email" | "password" | "confirm" | "otp";

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

export default function SignupScreen() {
  const { user, signup, loginWithGoogle } = useAuth();
  const [step, setStep] = useState<"details" | "otp">("details");
  const [details, setDetails] = useState<SignupDetails>({
    fullName: "",
    username: "",
    email: "",
    password: "",
    birthDate: "",
  });
  const [birthDateText, setBirthDateText] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otp, setOtp] = useState("");
  const [focused, setFocused] = useState<FieldName | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SignupErrors>({});
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (user) {
      router.replace(user.birthDate ? "/home" : "/complete-birthdate");
    }
  }, [user]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => setResendSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const submitGoogle = useCallback(async (credential: GoogleCredential) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await loginWithGoogle(credential);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Google Sign-In failed. Try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, loginWithGoogle]);

  if (user) return null;

  const signupValues = (): SignupValues => ({
    fullName: details.fullName ?? "",
    username: details.username,
    email: details.email,
    password: details.password,
    confirmPassword: confirm,
    birthDateText,
  });

  const validateDetailField = (field: keyof SignupValues) => {
    const next = validateSignupValues(signupValues());
    setFieldErrors((current) => ({ ...current, [field]: next[field] }));
  };

  const update = (key: keyof SignupDetails, value: string) => {
    setDetails((current) => ({
      ...current,
      [key]: key === "username" ? normalizeUsernameInput(value) : value,
    }));
    const errorKey = key === "birthDate" ? "birthDateText" : key;
    if (fieldErrors[errorKey as keyof SignupErrors]) {
      setFieldErrors((current) => ({ ...current, [errorKey]: undefined }));
    }
    if (error) setError("");
  };

  const requestOtp = async () => {
    if (busy) return;
    const birthDate = parseBirthDateText(birthDateText);
    const nextDetails = { ...details, birthDate: birthDate ?? "" };
    const validationErrors = validateSignupValues(signupValues());
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    setBusy(true);
    setError("");
    try {
      setDetails(nextDetails);
      const result = await api.requestSignupOtp(nextDetails);
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
    const otpError = validateOtp(otp);
    setFieldErrors((current) => ({ ...current, otp: otpError }));
    if (otpError) return;
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
              <BrandSymbol size={46} />
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
                <Field $focused={focused === "fullName"} $invalid={Boolean(fieldErrors.fullName)}>
                  <UserRound size={19} color={colors.inkMuted} />
                  <Input
                    accessibilityLabel="Full name"
                  autoComplete="name"
                  editable={!busy}
                  value={details.fullName}
                    onChangeText={(value) => update("fullName", value)}
                    onFocus={() => setFocused("fullName")}
                    onBlur={() => { setFocused(null); validateDetailField("fullName"); }}
                    placeholder="Your name"
                    placeholderTextColor={colors.inkMuted}
                  />
                </Field>
                {fieldErrors.fullName ? <Hint $error accessibilityRole="alert">{fieldErrors.fullName}</Hint> : null}
                <Label>Username</Label>
                <Field $focused={focused === "username"} $invalid={Boolean(fieldErrors.username)}>
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
                    onBlur={() => { setFocused(null); validateDetailField("username"); }}
                    placeholder="your.username"
                    placeholderTextColor={colors.inkMuted}
                  />
                </Field>
                <Hint $error={Boolean(fieldErrors.username)} accessibilityRole={fieldErrors.username ? "alert" : undefined}>
                  {fieldErrors.username ?? USERNAME_REQUIREMENTS}
                </Hint>
                <Label>Email</Label>
                <Field $focused={focused === "email"} $invalid={Boolean(fieldErrors.email)}>
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
                    onBlur={() => { setFocused(null); validateDetailField("email"); }}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.inkMuted}
                  />
                </Field>
                {fieldErrors.email ? <Hint $error accessibilityRole="alert">{fieldErrors.email}</Hint> : null}
                <Label>Birthdate</Label>
                <BirthDateField
                  disabled={busy}
                  invalid={Boolean(fieldErrors.birthDateText)}
                  value={birthDateText}
                  onChangeText={(value) => {
                    setBirthDateText(value);
                    if (fieldErrors.birthDateText) {
                      setFieldErrors((current) => ({ ...current, birthDateText: undefined }));
                    }
                    if (error) setError("");
                  }}
                  onBlur={() => validateDetailField("birthDateText")}
                />
                <Hint $error={Boolean(fieldErrors.birthDateText)} accessibilityRole={fieldErrors.birthDateText ? "alert" : undefined}>
                  {fieldErrors.birthDateText ?? "Enter as DD/MM/YYYY or choose from the calendar."}
                </Hint>
                <Label>Password</Label>
                <Field $focused={focused === "password"} $invalid={Boolean(fieldErrors.password)}>
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
                    onBlur={() => { setFocused(null); validateDetailField("password"); }}
                    placeholder="Create password"
                    placeholderTextColor={colors.inkMuted}
                  />
                  <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"} onPress={() => setShowPassword((value) => !value)}>
                    {showPassword ? <EyeOff size={19} color={colors.inkMuted} /> : <Eye size={19} color={colors.inkMuted} />}
                  </Pressable>
                </Field>
                <Hint $error={Boolean(fieldErrors.password)} accessibilityRole={fieldErrors.password ? "alert" : undefined}>
                  {fieldErrors.password ?? "Minimum 6 characters with uppercase, number, and special character."}
                </Hint>
                <Label>Confirm password</Label>
                <Field $focused={focused === "confirm"} $invalid={Boolean(fieldErrors.confirmPassword)}>
                  <LockKeyhole size={19} color={colors.inkMuted} />
                  <Input
                    accessibilityLabel="Confirm password"
                  autoComplete="new-password"
                  autoCorrect={false}
                  editable={!busy}
                    secureTextEntry={!showPassword}
                    value={confirm}
                    onChangeText={(value) => {
                      setConfirm(value);
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
                      }
                      if (error) setError("");
                    }}
                    onFocus={() => setFocused("confirm")}
                    onBlur={() => { setFocused(null); validateDetailField("confirmPassword"); }}
                    onSubmitEditing={requestOtp}
                    placeholder="Repeat password"
                    placeholderTextColor={colors.inkMuted}
                  />
                </Field>
                {fieldErrors.confirmPassword ? <Hint $error accessibilityRole="alert">{fieldErrors.confirmPassword}</Hint> : null}
              </> : <CodeWrap>
                <CodeIcon><ShieldCheck size={27} color={colors.brand} /></CodeIcon>
                <OtpField $focused={focused === "otp"} $invalid={Boolean(fieldErrors.otp)}>
                  <OtpInput
                    accessibilityLabel="Verification OTP"
                    autoComplete="one-time-code"
                    editable={!busy}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={(value) => {
                      setOtp(value.replace(/\D/g, ""));
                      if (fieldErrors.otp) setFieldErrors((current) => ({ ...current, otp: undefined }));
                      if (error) setError("");
                    }}
                    onFocus={() => setFocused("otp")}
                    onBlur={() => setFocused(null)}
                    onSubmitEditing={verifyOtp}
                    placeholder="000000"
                    placeholderTextColor={colors.inkMuted}
                  />
                </OtpField>
                {fieldErrors.otp ? <Hint $error accessibilityRole="alert">{fieldErrors.otp}</Hint> : null}
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
