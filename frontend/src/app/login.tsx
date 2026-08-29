import { router } from "expo-router";
import { AtSign, Eye, EyeOff, LockKeyhole } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { styled } from "styled-components/native";

import { DEMO_MODE } from "@/config";
import { BrandSymbol } from "@/components/BrandLogo";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import type { GoogleCredential } from "@/components/GoogleAuthButton.types";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/api";
import {
  validateLoginValues,
  type LoginErrors,
} from "@/services/auth-validation";
import { colors } from "@/theme";

const Screen = styled.SafeAreaView`
  flex: 1;
  background-color: ${colors.canvas};
`;

const Shell = styled(KeyboardAvoidingView)`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const Panel = styled.View`
  width: 100%;
  max-width: 420px;
  gap: 20px;
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
  font-size: 28px;
  font-weight: 900;
`;

const Eyebrow = styled.Text`
  color: ${colors.brand};
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
`;

const Form = styled.View`
  gap: 14px;
  padding: 22px;
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: 8px;
  background-color: ${colors.surface};
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

const ErrorText = styled.Text`
  color: ${colors.coral};
  font-size: 13px;
  line-height: 18px;
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

const ButtonText = styled.Text<{ $muted?: boolean }>`
  color: ${({ $muted }) => $muted ? colors.ink : colors.white};
  font-size: 15px;
  font-weight: 800;
`;

const ForgotPasswordText = styled.Text`
  color: ${colors.brand};
  font-size: 13px;
  font-weight: 800;
`;

export default function LoginScreen() {
  const { user, login, loginWithGoogle, enterDemo } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<"identifier" | "password" | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace(user.birthDate ? "/home" : "/complete-birthdate");
    }
  }, [user]);

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

  const validateField = (field: keyof LoginErrors) => {
    const next = validateLoginValues({ identifier, password });
    setFieldErrors((current) => ({ ...current, [field]: next[field] }));
  };

  const submit = async () => {
    if (busy) return;
    const validationErrors = validateLoginValues({ identifier, password });
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    setBusy(true);
    setError("");
    try {
      await login(identifier, password);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Sign in failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const openDemo = () => {
    enterDemo();
  };

  return (
    <Screen>
      <Shell behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Panel>
          <BrandRow>
            <BrandSymbol size={48} />
            <BrandCopy>
              <Brand>Bondera</Brand>
              <Eyebrow>Your private circles</Eyebrow>
            </BrandCopy>
          </BrandRow>
          <Form>
            <Title>Welcome back</Title>
            <Subtitle>Sign in to continue to your private circles.</Subtitle>
            <Label>Email or username</Label>
            <Field
              $focused={focused === "identifier"}
              $invalid={Boolean(fieldErrors.identifier)}
            >
              <AtSign size={19} color={colors.inkMuted} />
              <Input
                accessibilityLabel="Email or username"
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect={false}
                editable={!busy}
                returnKeyType="next"
                value={identifier}
                onChangeText={(value) => {
                  setIdentifier(value);
                  if (fieldErrors.identifier) {
                    setFieldErrors((current) => ({ ...current, identifier: undefined }));
                  }
                  if (error) setError("");
                }}
                onFocus={() => setFocused("identifier")}
                onBlur={() => { setFocused(null); validateField("identifier"); }}
                placeholder="Email or username"
                placeholderTextColor={colors.inkMuted}
              />
            </Field>
            {fieldErrors.identifier ? (
              <ErrorText accessibilityRole="alert">{fieldErrors.identifier}</ErrorText>
            ) : null}
            <Label>Password</Label>
            <Field
              $focused={focused === "password"}
              $invalid={Boolean(fieldErrors.password)}
            >
              <LockKeyhole size={19} color={colors.inkMuted} />
              <Input
                accessibilityLabel="Password"
                autoComplete="current-password"
                autoCorrect={false}
                editable={!busy}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (fieldErrors.password) {
                    setFieldErrors((current) => ({ ...current, password: undefined }));
                  }
                  if (error) setError("");
                }}
                onFocus={() => setFocused("password")}
                onBlur={() => { setFocused(null); validateField("password"); }}
                placeholder="Password"
                placeholderTextColor={colors.inkMuted}
                onSubmitEditing={submit}
              />
              <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"} onPress={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff size={19} color={colors.inkMuted} /> : <Eye size={19} color={colors.inkMuted} />}
              </Pressable>
            </Field>
            {fieldErrors.password ? (
              <ErrorText accessibilityRole="alert">{fieldErrors.password}</ErrorText>
            ) : null}
            <Pressable
              accessibilityRole="link"
              disabled={busy}
              onPress={() => router.push("/forgot-password")}
              style={{ alignSelf: "flex-end", paddingVertical: 3 }}
            >
              <ForgotPasswordText>Forgot password?</ForgotPasswordText>
            </Pressable>
            {error ? <ErrorText accessibilityRole="alert">{error}</ErrorText> : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={submit}
              style={({ pressed }) => ({ minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: colors.brand, opacity: pressed || busy ? 0.76 : 1 })}
            >
              {busy ? <ActivityIndicator color={colors.white} /> : <ButtonText>Sign in</ButtonText>}
            </Pressable>
            <DividerRow accessibilityElementsHidden>
              <DividerLine />
              <DividerText>OR</DividerText>
              <DividerLine />
            </DividerRow>
            <GoogleAuthButton
              disabled={busy}
              onCredential={submitGoogle}
              onError={setError}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => router.push("/signup")}
              style={({ pressed }) => ({ minHeight: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.65 : 1 })}
            >
              <ButtonText $muted>New to Bondera? Create account</ButtonText>
            </Pressable>
            {DEMO_MODE ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={openDemo}
                style={({ pressed }) => ({ minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.76 : 1 })}
              >
                <ButtonText $muted>Open preview workspace</ButtonText>
              </Pressable>
            ) : null}
          </Form>
        </Panel>
      </Shell>
    </Screen>
  );
}
