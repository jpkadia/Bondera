import { Image } from "expo-image";
import { useState } from "react";
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

const Photo = styled(Image)`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
`;

export function Avatar({ user, size = 44 }: { user: PublicUser; size?: number }) {
  const photoUrl = user.profilePicture?.url?.trim();
  const [loadFailure, setLoadFailure] = useState({ url: "", attempts: 0 });
  const failureCount = loadFailure.url === photoUrl ? loadFailure.attempts : 0;

  return (
    <Wrap $size={size}>
      <Initials $size={size}>{initials(user)}</Initials>
      {photoUrl && failureCount < 2 ? (
        <Photo
          key={`${photoUrl}:${failureCount}`}
          accessibilityLabel={`${user.fullName?.trim() || user.username} profile picture`}
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() =>
            setLoadFailure((current) => ({
              url: photoUrl,
              attempts: current.url === photoUrl ? current.attempts + 1 : 1,
            }))
          }
          recyclingKey={`${photoUrl}:${failureCount}`}
          source={{ uri: photoUrl }}
          style={{ width: size, height: size }}
          transition={120}
        />
      ) : null}
    </Wrap>
  );
}
