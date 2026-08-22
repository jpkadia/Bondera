import { Image } from "expo-image";
import { styled } from "styled-components/native";

import { colors } from "@/theme";
import type { PublicUser } from "@/types/api";
import { initials } from "@/utils/format";

const Wrap = styled.View<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: ${({ $size }) => $size / 2}px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background-color: ${colors.brandSoft};
`;

const Initials = styled.Text<{ $size: number }>`
  color: ${colors.brandDark};
  font-size: ${({ $size }) => Math.max(12, Math.round($size * 0.36))}px;
  font-weight: 800;
`;

export function Avatar({ user, size = 44 }: { user: PublicUser; size?: number }) {
  return (
    <Wrap $size={size}>
      {user.profilePicture?.url ? (
        <Image source={{ uri: user.profilePicture.url }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Initials $size={size}>{initials(user)}</Initials>
      )}
    </Wrap>
  );
}
