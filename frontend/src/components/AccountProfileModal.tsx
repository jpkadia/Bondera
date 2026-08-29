import * as ImagePicker from "expo-image-picker";
import {
  AtSign,
  ImagePlus,
  Mail,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable } from "react-native";
import { styled } from "styled-components/native";

import {
  normalizeUsernameInput,
  USERNAME_PATTERN,
  USERNAME_REQUIREMENTS,
} from "@/constants/auth";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/api";
import {
  formatIsoBirthDate,
  parseBirthDateText,
} from "@/services/birth-date";
import { colors } from "@/theme";
import { Avatar } from "./Avatar";
import { BirthDateField } from "./BirthDateField";
import { IconButton } from "./IconButton";
import {
  ProfilePhotoCropModal,
  type CroppedProfilePhoto,
  type ProfileCropSource,
} from "./ProfilePhotoCropModal";

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

const PhotoSection = styled.View`
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: 8px;
  background-color: ${colors.surfaceMuted};
`;

const PhotoActions = styled.View`
  width: 100%;
  flex-direction: row;
  gap: 8px;
`;

const Button = styled(Pressable)<{ $secondary?: boolean; $danger?: boolean }>`
  min-height: 46px;
  flex-direction: row;
  gap: 7px;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border-width: 1px;
  border-color: ${({ $danger, $secondary }) =>
    $danger ? colors.coral : $secondary ? colors.border : colors.brand};
  border-radius: 8px;
  background-color: ${({ $danger, $secondary }) =>
    $danger ? colors.coralSoft : $secondary ? colors.surface : colors.brand};
`;

const PhotoButton = styled(Button)`
  flex: 1;
`;

const ButtonText = styled.Text<{ $secondary?: boolean; $danger?: boolean }>`
  color: ${({ $danger, $secondary }) =>
    $danger ? colors.coral : $secondary ? colors.ink : colors.white};
  font-size: 14px;
  font-weight: 800;
`;

type BusyAction =
  | "profile"
  | "profile-picture"
  | "profile-picture-remove"
  | "email-request"
  | "email-verify"
  | null;
type FocusedField = "fullName" | "username" | "email" | "otp" | null;

export function AccountProfileModal({ onClose, onNotice }: AccountProfileModalProps) {
  const {
    user,
    isDemo,
    updateProfile,
    updateProfilePicture,
    removeProfilePicture,
    requestEmailChange,
    verifyEmailChange,
  } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [birthDateText, setBirthDateText] = useState(
    formatIsoBirthDate(user?.birthDate),
  );
  const [email, setEmail] = useState(user?.email ?? "");
  const [otp, setOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [focused, setFocused] = useState<FocusedField>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [cropSource, setCropSource] = useState<ProfileCropSource | null>(null);

  if (!user) return null;

  const saveProfile = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setError(USERNAME_REQUIREMENTS);
      return;
    }
    const birthDate = birthDateText
      ? parseBirthDateText(birthDateText)
      : undefined;
    if (birthDateText && !birthDate) {
      setError("Enter a valid birthdate in DD/MM/YYYY format.");
      return;
    }

    setBusy("profile");
    setError("");
    try {
      await updateProfile({
        fullName,
        username: normalizedUsername,
        birthDate,
      });
      setUsername(normalizedUsername);
      onNotice("Profile details updated.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Profile could not be updated.");
    } finally {
      setBusy(null);
    }
  };

  const changeProfilePicture = async () => {
    if (isDemo) {
      setError("Profile photo changes are unavailable in preview mode.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (!asset.width || !asset.height) {
      setError("The selected image dimensions could not be read.");
      return;
    }

    setCropSource({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      fileName: asset.fileName,
    });
  };

  const uploadCroppedProfilePicture = async (
    photo: CroppedProfilePhoto,
  ) => {
    setBusy("profile-picture");
    setError("");
    try {
      const form = new FormData();
      if (Platform.OS === "web") {
        const response = await fetch(photo.uri);
        const blob = await response.blob();
        form.append("file", blob, photo.fileName);
      } else {
        form.append(
          "file",
          ({
            uri: photo.uri,
            name: photo.fileName,
            type: photo.mimeType,
          } as unknown as Blob),
        );
      }

      const { cleanupPending } = await updateProfilePicture(form);
      onNotice(
        cleanupPending
          ? "Profile photo updated. Previous photo cleanup will be retried."
          : "Profile photo updated.",
      );
      setCropSource(null);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Profile photo could not be updated.",
      );
      throw caught;
    } finally {
      setBusy(null);
    }
  };

  const removeCurrentProfilePicture = async () => {
    if (isDemo || !user.profilePicture?.url) return;

    setBusy("profile-picture-remove");
    setError("");
    try {
      const { cleanupPending } = await removeProfilePicture();
      onNotice(
        cleanupPending
          ? "Profile photo removed. Cloud cleanup will be retried."
          : "Profile photo removed.",
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Profile photo could not be removed.",
      );
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
    <>
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

            <SectionTitle>Profile photo</SectionTitle>
            <PhotoSection>
              <Avatar user={user} size={76} />
              <Hint>
                Google photos can be replaced. Photos uploaded to Bondera are
                removed from Cloudinary when replaced or deleted.
              </Hint>
              <PhotoActions>
                <PhotoButton
                  $secondary
                  disabled={locked || isDemo}
                  onPress={changeProfilePicture}
                >
                  {busy === "profile-picture" ? (
                    <ActivityIndicator color={colors.brand} />
                  ) : (
                    <>
                      <ImagePlus size={17} color={colors.ink} />
                      <ButtonText $secondary>
                        {user.profilePicture?.url ? "Change" : "Add photo"}
                      </ButtonText>
                    </>
                  )}
                </PhotoButton>
                {user.profilePicture?.url ? (
                  <PhotoButton
                    $danger
                    disabled={locked || isDemo}
                    onPress={removeCurrentProfilePicture}
                  >
                    {busy === "profile-picture-remove" ? (
                      <ActivityIndicator color={colors.coral} />
                    ) : (
                      <>
                        <Trash2 size={17} color={colors.coral} />
                        <ButtonText $danger>Remove</ButtonText>
                      </>
                    )}
                  </PhotoButton>
                ) : null}
              </PhotoActions>
            </PhotoSection>

            <Divider />

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
            <Label>Birthdate</Label>
            <BirthDateField
              disabled={locked}
              invalid={
                Boolean(birthDateText) && !parseBirthDateText(birthDateText)
              }
              value={birthDateText}
              onChangeText={(value) => {
                setBirthDateText(value);
                setError("");
              }}
            />
            <Hint>Enter as DD/MM/YYYY or choose from the calendar.</Hint>
            <Button disabled={locked} onPress={saveProfile}>
              {busy === "profile" ? <ActivityIndicator color={colors.white} /> : <ButtonText>Save profile details</ButtonText>}
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
      {cropSource ? (
        <ProfilePhotoCropModal
          key={cropSource.uri}
          source={cropSource}
          onCancel={() => !locked && setCropSource(null)}
          onConfirm={uploadCroppedProfilePicture}
        />
      ) : null}
    </>
  );
}
