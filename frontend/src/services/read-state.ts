interface ReadableMessage {
  id: string;
  senderId: string;
  isDeleted: boolean;
  pending?: boolean;
  receipts: { seenAt?: string }[];
}

interface UnreadConnection {
  id: string;
  unreadCount: number;
}

interface SeenReceipt {
  seenAt?: string;
}

interface SeenEligibility {
  isRouteFocused: boolean;
  isAppActive: boolean;
  isDocumentVisible: boolean;
}

export const canAcknowledgeSeen = ({
  isRouteFocused,
  isAppActive,
  isDocumentVisible,
}: SeenEligibility): boolean =>
  isRouteFocused && isAppActive && isDocumentVisible;

export const findFirstUnreadIndex = <T extends { id: string }>(
  messages: T[],
  firstUnreadMessageId: string | null,
): number =>
  firstUnreadMessageId
    ? messages.findIndex((message) => message.id === firstUnreadMessageId)
    : -1;

export const latestViewableUnreadMessage = <T extends ReadableMessage>(
  messages: T[],
  viewableMessageIds: ReadonlySet<string>,
  senderId: string,
): T | undefined =>
  [...messages]
    .reverse()
    .find(
      (message) =>
        viewableMessageIds.has(message.id) &&
        message.senderId === senderId &&
        !message.isDeleted &&
        !message.pending &&
        !message.receipts.some((receipt) => Boolean(receipt.seenAt)),
    );

export const setConnectionUnreadCount = <T extends UnreadConnection>(
  connections: T[],
  connectionId: string,
  unreadCount: number,
): T[] =>
  connections.map((connection) =>
    connection.id === connectionId
      ? { ...connection, unreadCount: Math.max(0, unreadCount) }
      : connection,
  );

export const countUnreadConnections = (
  connections: readonly UnreadConnection[],
): number =>
  new Set(
    connections
      .filter((connection) => connection.unreadCount > 0)
      .map((connection) => connection.id),
  ).size;

export const latestSeenAt = (
  receipts: readonly SeenReceipt[],
): string | undefined =>
  receipts.reduce<string | undefined>((latest, receipt) => {
    if (!receipt.seenAt || Number.isNaN(Date.parse(receipt.seenAt))) {
      return latest;
    }

    return !latest || Date.parse(receipt.seenAt) > Date.parse(latest)
      ? receipt.seenAt
      : latest;
  }, undefined);
