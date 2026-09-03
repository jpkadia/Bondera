import { router } from "expo-router";
import { CalendarDays, LogOut } from "lucide-react-native";
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

import { BirthDateField } from "@/components/BirthDateField";
import { BrandSymbol } from "@/components/BrandLogo";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/api";
import { parseBirthDateText } from "@/services/birth-date";
import { colors } from "@/theme";

const Screen = styled(SafeAreaView)`
  flex: 1;
  background-color: ${colors.canvas};
`;

const Shell = styled(KeyboardAvoidingView)`
  flex: 1;
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

const IconWrap = styled.View`
  width: 52px;
  height: 52px;
  align-items: center;
  justify-content: center;
  border-radius: 26px;
  background-color: ${colors.brandSoft};
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

const ErrorText = styled.Text`
  color: ${colors.coral};
  font-size: 13px;
  line-height: 18px;
`;

const ButtonText = styled.Text<{ $muted?: boolean }>`
  color: ${({ $muted }) => ($muted ? colors.inkMuted : colors.white)};
  font-size: 15px;
  font-weight: 800;
`;

export default function CompleteBirthDateScreen() {
  const { completeBirthDate, logout, user } = useAuth();
  const [birthDateText, setBirthDateText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.birthDate) router.replace("/home");
  }, [user?.birthDate]);

  const submit = async () => {
    if (busy) return;
    const birthDate = parseBirthDateText(birthDateText);
    if (!birthDate) {
      setError("Enter a valid birthdate in DD/MM/YYYY format.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await completeBirthDate(birthDate);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Birthdate could not be saved. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    await logout();
    router.replace("/login");
  };

  return (
    <Screen>
      <Shell behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <Panel>
          <BrandRow>
            <BrandSymbol size={48} />
            <BrandCopy>
              <Brand>Bondera</Brand>
              <Eyebrow>Your private circles</Eyebrow>
            </BrandCopy>
          </BrandRow>

          <Form>
            <IconWrap>
              <CalendarDays size={26} color={colors.brand} />
            </IconWrap>
            <Title>Add your birthdate</Title>
            <Subtitle>
              Your birthdate is required to finish setting up your account.
            </Subtitle>
            <Label>Birthdate</Label>
            <BirthDateField
              disabled={busy}
              invalid={Boolean(error)}
              value={birthDateText}
              onChangeText={(value) => {
                setBirthDateText(value);
                if (error) setError("");
              }}
            />
            <Subtitle>Enter as DD/MM/YYYY or choose from the calendar.</Subtitle>
            {error ? <ErrorText accessibilityRole="alert">{error}</ErrorText> : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={submit}
              style={({ pressed }) => ({
                minHeight: 50,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                backgroundColor: colors.brand,
                opacity: pressed || busy ? 0.76 : 1,
              })}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <ButtonText>Continue</ButtonText>
              )}
            </Pressable>
            <Pressable
              accessibilityLabel="Sign out"
              accessibilityRole="button"
              disabled={busy}
              onPress={signOut}
              style={({ pressed }) => ({
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: pressed || busy ? 0.65 : 1,
              })}
            >
              <LogOut size={17} color={colors.inkMuted} />
              <ButtonText $muted>Sign out</ButtonText>
            </Pressable>
          </Form>
          </Panel>
        </ScrollView>
      </Shell>
    </Screen>
  );
}
