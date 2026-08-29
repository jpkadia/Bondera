interface MessageActionVisibility {
  isWeb: boolean;
  isHovered: boolean;
  isDeleted: boolean;
  isPending: boolean;
}

export const shouldShowMessageAction = ({
  isWeb,
  isHovered,
  isDeleted,
  isPending,
}: MessageActionVisibility): boolean =>
  isWeb && isHovered && !isDeleted && !isPending;
