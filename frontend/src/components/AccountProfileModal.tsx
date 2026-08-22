import {
  AtSign,
  Mail,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable } from "react-native";
import { styled } from "styled-components/native";

import {
  normalizeUsernameInput,
  USERNAME_PATTERN,
  USERNAME_REQUIREMENTS,
} from "@/constants/auth";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/api";
import { colors } from "@/theme";
import { Avatar } from "./Avatar";
import { IconButton } from "./IconButton";

interface AccountProfileModalProps {
  onClose(): void;
  onNotice(message: string, error?: boolean): void;
}

const Backdrop = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: ${colors.overlay};
`;

const Dialog = styled.View`
  width: 100%;
  max-width: 460px;
  max-height: 92%;
  border-radius: 8px;
  background-color: ${colors.surface};
  overflow: hidden;
`;

const Scroll = styled.ScrollView.attrs({
  contentContainerStyle: { padding: 20, gap: 13 },
  keyboardShouldPersistTaps: "handled",
})``;

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const HeaderCopy = styled.View`
  flex: 1;
  min-width: 0;
`;

const Title = styled.Text`
  color: ${colors.ink};
  font-size: 19px;
  font-weight: 800;
`;

const Subtitle = styled.Text.attrs({ numberOfLines: 1 })`
  color: ${colors.inkMuted};
  font-size: 12px;
`;

const SectionTitle = styled.Text`
  margin-top: 5px;
  color: ${colors.ink};
  font-size: 14px;
  font-weight: 800;
`;

const Label = styled.Text`
  color: ${colors.ink};
  font-size: 12px;
  font-weight: 700;
`;

const Field = styled.View<{ $focused: boolean }>`
  min-height: 48px;
  flex-direction: row;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  border-width: 1px;
  border-color: ${({ $focused }) => $focused ? colors.brand : colors.border};
  border-radius: 8px;
  background-color: ${colors.surface};
`;

const Input = styled.TextInput`
  flex: 1;
  min-width: 0;
  color: ${colors.ink};
  font-size: 14px;
`;

const Hint = styled.Text<{ $error?: boolean }>`
  color: ${({ $error }) => $error ? colors.coral : colors.inkMuted};
  font-size: 12px;
  line-height: 17px;
`;

const Divider = styled.View`
  height: 1px;
  margin: 5px 0;
  background-color: ${colors.border};
`;

const Button = styled(Pressable)<{ $secondary?: boolean }>`
  min-height: 46px;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border-width: 1px;
  border-color: ${({ $secondary }) => $secondary ? colors.border : colors.brand};
  border-radius: 8px;
  background-color: ${({ $secondary }) => $secondary ? colors.surface : colors.brand};
`;

const ButtonText = styled.Text<{ $secondary?: boolean }>`
  color: ${({ $secondary }) => $secondary ? colors.ink : colors.white};
  font-size: 14px;
  font-weight: 800;
`;

type BusyAction = "profile" | "email-request" | "email-verify" | null;
type FocusedField = "fullName" | "username" | "email" | "otp" | null;

export function AccountProfileModal({ onClose, onNotice }: AccountProfileModalProps) {
  const {
    user,
    isDemo,
    updateProfile,
    requestEmailChange,
    verifyEmailChange,
  } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [otp, setOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [focused, setFocused] = useState<FocusedField>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState("");

  if (!user) return null;

  const saveProfile = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setError(USERNAME_REQUIREMENTS);
      return;
    }

    setBusy("profile");
    setError("");
    try {
      await updateProfile({ fullName, username: normalizedUsername });
      setUsername(normalizedUsername);
      onNotice("Name and username updated.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Profile could not be updated.");
    } finally {
      setBusy(null);
    }
  };

  const sendEmailOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (normalizedEmail === user.email) {
      setError("Enter a different email address.");
      return;
    }
    if (isDemo) {
      setError("Email changes are unavailable in preview mode.");
      return;
    }

    setBusy("email-request");
    setError("");
    try {
      await requestEmailChange(normalizedEmail);
      setEmail(normalizedEmail);
      setEmailOtpSent(true);
      setOtp("");
      onNotice("Verification OTP sent to the new email.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Verification OTP could not be sent.");
    } finally {
      setBusy(null);
    }
  };

  const confirmEmail = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit OTP sent to your new email.");
      return;
    }

    setBusy("email-verify");
    setError("");
    try {
      await verifyEmailChange(email, otp);
      onNotice("Email address verified and updated.");
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Email could not be verified.");
    } finally {
      setBusy(null);
    }
  };

  const locked = busy !== null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => !locked && onClose()}>
      <Backdrop>
        <Dialog>
          <Scroll>
            <Header>
              <Avatar user={user} size={46} />
              <HeaderCopy>
                <Title>Account profile</Title>
                <Subtitle>{user.uniqueId}</Subtitle>
              </HeaderCopy>
              <IconButton icon={X} label="Close account profile" onPress={() => !locked && onClose()} />
            </Header>

            <SectionTitle>Name and username</SectionTitle>
            <Label>Full name</Label>
            <Field $focused={focused === "fullName"}>
              <UserRound size={18} color={colors.inkMuted} />
              <Input
                accessibilityLabel="Full name"
                editable={!locked}
                maxLength={80}
                value={fullName}
                onChangeText={(value) => { setFullName(value); setError(""); }}
                onFocus={() => setFocused("fullName")}
                onBlur={() => setFocused(null)}
                placeholder="Your name"
                placeholderTextColor={colors.inkMuted}
              />
            </Field>

            <Label>Username</Label>
            <Field $focused={focused === "username"}>
              <AtSign size={18} color={colors.inkMuted} />
              <Input
                accessibilityLabel="Username"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!locked}
                maxLength={30}
                value={username}
                onChangeText={(value) => { setUsername(normalizeUsernameInput(value)); setError(""); }}
                onFocus={() => setFocused("username")}
                onBlur={() => setFocused(null)}
                placeholder="your.username"
                placeholderTextColor={colors.inkMuted}
              />
            </Field>
            <Hint>{USERNAME_REQUIREMENTS}</Hint>
            <Button disabled={locked} onPress={saveProfile}>
              {busy === "profile" ? <ActivityIndicator color={colors.white} /> : <ButtonText>Save name and username</ButtonText>}
            </Button>

            <Divider />
            <SectionTitle>Email address</SectionTitle>
            <Hint>Your new email must be verified before it replaces the current address.</Hint>
            <Label>New email</Label>
            <Field $focused={focused === "email"}>
              <Mail size={18} color={colors.inkMuted} />
              <Input
                accessibilityLabel="New email address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!locked && !emailOtpSent}
                keyboardType="email-address"
                value={email}
                onChangeText={(value) => { setEmail(value); setError(""); }}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                placeholder="new@example.com"
                placeholderTextColor={colors.inkMuted}
              />
            </Field>

            {emailOtpSent ? (
              <>
                <Label>Verification OTP</Label>
                <Field $focused={focused === "otp"}>
                  <ShieldCheck size={18} color={colors.inkMuted} />
                  <Input
                    accessibilityLabel="Email verification OTP"
                    autoComplete="one-time-code"
                    editable={!locked}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={(value) => { setOtp(value.replace(/\D/g, "")); setError(""); }}
                    onFocus={() => setFocused("otp")}
                    onBlur={() => setFocused(null)}
                    onSubmitEditing={confirmEmail}
                    placeholder="000000"
                    placeholderTextColor={colors.inkMuted}
                  />
                </Field>
                <Button disabled={locked} onPress={confirmEmail}>
                  {busy === "email-verify" ? <ActivityIndicator color={colors.white} /> : <ButtonText>Verify and update email</ButtonText>}
                </Button>
                <Button $secondary disabled={locked} onPress={() => { setEmailOtpSent(false); setOtp(""); setError(""); }}>
                  <ButtonText $secondary>Use another email</ButtonText>
                </Button>
              </>
            ) : (
              <Button $secondary disabled={locked || isDemo} onPress={sendEmailOtp}>
                {busy === "email-request" ? <ActivityIndicator color={colors.brand} /> : <ButtonText $secondary>Send verification OTP</ButtonText>}
              </Button>
            )}

            {error ? <Hint $error accessibilityRole="alert">{error}</Hint> : null}
          </Scroll>
        </Dialog>
      </Backdrop>
    </Modal>
  );
}
