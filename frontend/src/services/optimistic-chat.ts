import type {
  ChatMessage,
  MessageMedia,
  MessageReaction,
} from "../types/api";

interface OptimisticMediaInput {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

export function createOptimisticMessage(input: {
  clientMessageId: string;
  connectionId: string;
  senderId: string;
  recipientId: string;
  text?: string;
  files: OptimisticMediaInput[];
  now?: Date;
}): ChatMessage {
  const timestamp = (input.now ?? new Date()).toISOString();
  const media: MessageMedia[] = input.files.map((file, index) => ({
    id: `${input.clientMessageId}:${index}`,
    url: file.uri,
    resourceType: file.mimeType.startsWith("image/")
      ? "image"
      : file.mimeType.startsWith("video/")
        ? "video"
        : "raw",
    originalName: file.name,
    mimeType: file.mimeType,
    bytes: file.size ?? 0,
  }));
  const text = input.text?.trim() || undefined;

  return {
    id: `pending:${input.clientMessageId}`,
    connectionId: input.connectionId,
    senderId: input.senderId,
    recipientId: input.recipientId,
    clientMessageId: input.clientMessageId,
    text,
    media,
    kind: text && media.length ? "mixed" : media.length ? "media" : "text",
    reactions: [],
    receipts: [],
    isDeleted: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    pending: true,
  };
}

export function toggleOwnReaction(
  reactions: MessageReaction[],
  userId: string,
  emoji: string,
  now = new Date(),
): MessageReaction[] {
  const others = reactions.filter((reaction) => reaction.userId !== userId);
  const own = reactions.find((reaction) => reaction.userId === userId);
  if (own?.emoji === emoji) return others;
  return [...others, { userId, emoji, reactedAt: now.toISOString() }];
}

export function restoreOwnReaction(
  current: MessageReaction[],
  previous: MessageReaction[],
  userId: string,
): MessageReaction[] {
  const currentOthers = current.filter((reaction) => reaction.userId !== userId);
  const previousOwn = previous.find((reaction) => reaction.userId === userId);
  return previousOwn ? [...currentOthers, previousOwn] : currentOthers;
}
