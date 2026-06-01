"use client";

import { useState, useCallback, useEffect } from "react";
import { GraduationCap } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatInterface } from "@/components/chat-interface";
import { SessionSidebar } from "@/components/session-sidebar";
import {
  loadActiveSessionId,
  createSession,
} from "@/lib/session-store";

export default function Home() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hasMessages, setHasMessages] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const savedId = loadActiveSessionId();
    if (savedId) {
      setActiveSessionId(savedId);
      setHasMessages(true);
    } else {
      const newSession = createSession();
      setActiveSessionId(newSession.id);
      setHasMessages(false);
    }
    setHydrated(true);
  }, []);

  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setHasMessages(true);
  }, []);

  const handleNewSession = useCallback(() => {
    const newId = loadActiveSessionId() ?? createSession().id;
    setActiveSessionId(newId);
    setHasMessages(false);
  }, []);

  const handleFirstMessage = useCallback(() => {
    setHasMessages(true);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]" suppressHydrationWarning>
      {/* Session Sidebar */}
      {hydrated && (
        <SessionSidebar
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
        />
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header — compact & polished */}
        <header
          className="flex items-center justify-between px-5 py-2 shrink-0 border-b"
          style={{
            background: "var(--background)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex items-center gap-3">
            {/* Logo badge */}
            <div
              className="flex h-6 w-6 items-center justify-center rounded-lg"
              style={{ background: "linear-gradient(135deg, #C8102E 0%, #E62040 100%)" }}
            >
              <GraduationCap className="h-3 w-3 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight" style={{ color: "var(--foreground)", lineHeight: 1.2 }}>
                HUST Q&amp;A
              </h1>
              <p className="text-[10px] font-medium opacity-80" style={{ color: "var(--muted-foreground)", lineHeight: 1 }}>
                Trợ lý Quy chế Đào tạo
              </p>
            </div>
          </div>
          <ThemeToggle />
        </header>

        {/* Main Content — full height column with radial gradient bg */}
        <div
          className="flex flex-col flex-1 min-h-0"
          style={{
            background: "radial-gradient(circle at top, var(--background), var(--muted))",
          }}
        >
          <ChatInterface
            sessionId={activeSessionId}
            onFirstMessage={handleFirstMessage}
            hasMessages={hasMessages}
          />
        </div>
      </div>
    </div>
  );
}
