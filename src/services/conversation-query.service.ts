import type { Conversation, SidebarItemType } from "@/types/llmchef/chat";
import type { SyncRepo, SyncStatus } from "@/types/llmchef/sync";

export interface ConversationQueryState {
  conversations: Conversation[];
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  syncRepos: SyncRepo[];
  conversationSyncStatus: Record<string, SyncStatus>;
  repoInitializationStatus: Record<string, SyncStatus>;
}

export const getConversationById = (
  conversations: Conversation[],
  id: string | null
): Conversation | undefined => {
  if (!id) return undefined;
  return conversations.find((conversation) => conversation.id === id);
};

export const getConversationSyncStatus = (
  conversation: Pick<Conversation, "syncRepoId" | "lastSyncedAt" | "updatedAt">
): SyncStatus => {
  if (!conversation.syncRepoId) {
    return "idle";
  }

  const lastSyncTime =
    conversation.lastSyncedAt instanceof Date
      ? conversation.lastSyncedAt.getTime()
      : null;
  const updatedTime =
    conversation.updatedAt instanceof Date
      ? conversation.updatedAt.getTime()
      : null;

  if (!lastSyncTime) {
    return "needs-sync";
  }

  return updatedTime && updatedTime > lastSyncTime ? "needs-sync" : "idle";
};

export const buildConversationSyncStatusIndex = (
  conversations: Conversation[]
): Record<string, SyncStatus> =>
  Object.fromEntries(
    conversations.map((conversation) => [
      conversation.id,
      getConversationSyncStatus(conversation),
    ])
  );

export const getLinkedConversations = (
  conversations: Conversation[]
): Conversation[] => conversations.filter((conversation) => Boolean(conversation.syncRepoId));

export const getPendingSyncConversations = (
  state: Pick<ConversationQueryState, "conversations" | "conversationSyncStatus">
): Conversation[] =>
  state.conversations.filter(
    (conversation) =>
      Boolean(conversation.syncRepoId) &&
      state.conversationSyncStatus[conversation.id] === "needs-sync"
  );

export const getUninitializedSyncRepos = (
  state: Pick<ConversationQueryState, "syncRepos" | "repoInitializationStatus">
): SyncRepo[] =>
  state.syncRepos.filter((repo) => {
    const status = state.repoInitializationStatus[repo.id];
    return !status || status === "error";
  });

export const getSelectedConversationId = (
  state: Pick<ConversationQueryState, "selectedItemId" | "selectedItemType">
): string | null =>
  state.selectedItemType === "conversation" ? state.selectedItemId : null;

export const getSelectedConversation = (
  state: Pick<ConversationQueryState, "conversations" | "selectedItemId" | "selectedItemType">
): Conversation | undefined =>
  getConversationById(state.conversations, getSelectedConversationId(state));

export const getCurrentProjectId = (
  state: Pick<ConversationQueryState, "conversations" | "selectedItemId" | "selectedItemType">
): string | null => {
  if (state.selectedItemType === "project") {
    return state.selectedItemId;
  }

  return getSelectedConversation(state)?.projectId ?? null;
};
