import type { SyncedWorkspaceRecord } from './workspaceSyncCodec.js';

const MAX_MEMORY_WORKSPACES = 500;

export const memoryWorkspaces = new Map<string, SyncedWorkspaceRecord>();

/** Stores a synced workspace in the bounded in-memory cache with FIFO eviction. */
export function cacheWorkspace(ws: SyncedWorkspaceRecord): SyncedWorkspaceRecord {
  if (memoryWorkspaces.size >= MAX_MEMORY_WORKSPACES && !memoryWorkspaces.has(ws.workspaceKey)) {
    const oldest = memoryWorkspaces.keys().next().value;
    if (oldest !== undefined) {
      memoryWorkspaces.delete(oldest);
    }
  }
  memoryWorkspaces.set(ws.workspaceKey, ws);
  return ws;
}

export function findMemoryWorkspaceByChat(chatId: string): SyncedWorkspaceRecord | null {
  return [...memoryWorkspaces.values()].find((w) => w.telegramChatId === chatId) ?? null;
}

export function findMemoryWorkspaceByCode(code: string): SyncedWorkspaceRecord | null {
  const lower = code.toLowerCase();
  return (
    [...memoryWorkspaces.values()].find((w) => w.telegramLinkCode?.toLowerCase() === lower) ?? null
  );
}

export function clearMemoryChatConflict(chatId: string, keepKey: string): void {
  for (const prev of memoryWorkspaces.values()) {
    if (prev.telegramChatId === chatId && prev.workspaceKey !== keepKey) {
      memoryWorkspaces.set(prev.workspaceKey, { ...prev, telegramChatId: null });
    }
  }
}
