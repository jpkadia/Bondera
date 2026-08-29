import { Redirect } from "expo-router";
import { ActivityIndicator } from "react-native";
import { styled } from "styled-components/native";

import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme";

const LoadingScreen = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  background-color: ${colors.canvas};
`;

export default function IndexScreen() {
  const { isBootstrapping, user } = useAuth();

  if (isBootstrapping) {
    return (
      <LoadingScreen>
        <ActivityIndicator color={colors.brand} size="large" />
      </LoadingScreen>
    );
  }

  return (
    <Redirect
      href={!user ? "/login" : user.birthDate ? "/home" : "/complete-birthdate"}
    />
  );
}
