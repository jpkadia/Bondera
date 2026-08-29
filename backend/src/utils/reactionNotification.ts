const MAX_REACTION_PREVIEW_LENGTH = 80;

export const shouldNotifyMessageOwnerOfReaction = (
  reactorId: string,
  messageOwnerId: string,
  reactionWasAdded: boolean
): boolean => reactionWasAdded && reactorId !== messageOwnerId;

export const reactionMessagePreview = (
  text: string | undefined,
  mediaCount: number
): string => {
  const rawPreview = text?.trim() ||
    (mediaCount > 0
      ? mediaCount === 1
        ? "Photo or attachment"
        : `${mediaCount} attachments`
      : "Message");

  return rawPreview.length > MAX_REACTION_PREVIEW_LENGTH
    ? `${rawPreview.slice(0, MAX_REACTION_PREVIEW_LENGTH - 3)}...`
    : rawPreview;
};
