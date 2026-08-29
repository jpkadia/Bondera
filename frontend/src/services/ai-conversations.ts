interface ConversationIdentity {
  id: string;
}

export const upsertAiConversation = <T extends ConversationIdentity>(
  conversations: T[],
  conversation: T,
): T[] => [
  conversation,
  ...conversations.filter((item) => item.id !== conversation.id),
];

export const removeAiConversation = <T extends ConversationIdentity>(
  conversations: T[],
  conversationId: string,
): T[] => conversations.filter((item) => item.id !== conversationId);

export const shouldShowAiSuggestions = (
  turnCount: number,
  isSending: boolean,
): boolean => turnCount === 0 && !isSending;
