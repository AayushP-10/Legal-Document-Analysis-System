// Chat History Store
// Provides localStorage persistence for chat sessions
// so history works even when Supabase is unreachable.

export interface LocalChatSession {
  id: string;
  title: string;
  messages: unknown[];
  created_at: string;
  updated_at: string;
}

import { getCurrentUser } from "@/lib/auth";

const user = getCurrentUser() || "guest";

const STORAGE_KEY = `legal-hub-chat-history-${user}`;
const MAX_SESSIONS = 50; // Keep last 50 conversations

// ── Read ────────────────────────────────────────────────────

export function getLocalChatHistory(): LocalChatSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

// ── Write ───────────────────────────────────────────────────

function persist(sessions: LocalChatSession[]): void {
  try {
    // Keep only the most recent sessions to avoid localStorage bloat
    const trimmed = sessions.slice(0, MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage might be full — silently degrade
    console.warn("Failed to persist chat history to localStorage");
  }
}

/** Save a new chat session to localStorage. */
export function saveLocalChatSession(session: LocalChatSession): void {
  const existing = getLocalChatHistory();
  // Replace if same ID exists, otherwise prepend
  const filtered = existing.filter((s) => s.id !== session.id);
  const updated = [session, ...filtered];
  persist(updated);
}

/** Remove a chat session from localStorage by ID. */
export function removeLocalChatSession(id: string): void {
  const existing = getLocalChatHistory();
  const filtered = existing.filter((s) => s.id !== id);
  persist(filtered);
}

/** Update an existing session (e.g., when new messages are added). */
export function updateLocalChatSession(id: string, updates: Partial<LocalChatSession>): void {
  const existing = getLocalChatHistory();
  const updated = existing.map((s) =>
    s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s
  );
  persist(updated);
}
