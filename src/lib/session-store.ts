import type { ChatMessage } from "@/hooks/use-stream-chat";

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "hust-qa-sessions";
const ACTIVE_SESSION_KEY = "hust-qa-active-session";

let sessionIdCounter = Date.now();

function generateSessionId(): string {
  return `session-${++sessionIdCounter}`;
}

function readSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage full or unavailable
  }
}

export function loadSessions(): ChatSession[] {
  return readSessions();
}

export function loadActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function saveActiveSessionId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(ACTIVE_SESSION_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
}

export function createSession(firstMessage?: string): ChatSession {
  const session: ChatSession = {
    id: generateSessionId(),
    name: firstMessage
      ? firstMessage.length > 60
        ? firstMessage.slice(0, 60) + "..."
        : firstMessage
      : "New chat",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const sessions = readSessions();
  sessions.unshift(session);
  writeSessions(sessions);
  saveActiveSessionId(session.id);

  return session;
}

export function getSession(id: string): ChatSession | undefined {
  return readSessions().find((s) => s.id === id);
}

export function deleteSession(id: string): string | null {
  const sessions = readSessions().filter((s) => s.id !== id);
  writeSessions(sessions);

  if (getActiveSessionId() === id) {
    const next = sessions[0];
    if (next) {
      saveActiveSessionId(next.id);
      return next.id;
    } else {
      saveActiveSessionId(null);
      return null;
    }
  }
  return getActiveSessionId();
}

export function getActiveSessionId(): string | null {
  return loadActiveSessionId();
}

export function updateSessionMessages(
  sessionId: string,
  messages: ChatMessage[]
): void {
  const sessions = readSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return;

  sessions[idx].messages = messages;
  sessions[idx].updatedAt = Date.now();

  // Auto-name from first user message if still default
  if (sessions[idx].name === "New chat" && messages.length > 0) {
    const firstUser = messages.find((m) => m.role === "user");
    if (firstUser) {
      sessions[idx].name =
        firstUser.content.length > 60
          ? firstUser.content.slice(0, 60) + "..."
          : firstUser.content;
    }
  }

  writeSessions(sessions);
}

export function renameSession(id: string, name: string): void {
  const sessions = readSessions();
  const session = sessions.find((s) => s.id === id);
  if (session) {
    session.name = name || "Untitled";
    session.updatedAt = Date.now();
    writeSessions(sessions);
  }
}
