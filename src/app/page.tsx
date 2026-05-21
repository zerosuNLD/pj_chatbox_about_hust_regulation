"use client";

import { useState, useCallback, useEffect } from "react";
import { GraduationCap } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatInterface } from "@/components/chat-interface";
import { WelcomeScreen } from "@/components/welcome-screen";
import { SessionSidebar } from "@/components/session-sidebar";
import {
  loadActiveSessionId,
  createSession,
} from "@/lib/session-store";

export default function Home() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hasMessages, setHasMessages] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const savedId = loadActiveSessionId();
    if (savedId) {
      setActiveSessionId(savedId);
      setHasMessages(true);
    }
    setHydrated(true);
  }, []);

  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setHasMessages(true);
  }, []);

  const handleNewSession = useCallback(() => {
    // Sidebar creates session first; fallback create if none exists (e.g. all deleted)
    const newId = loadActiveSessionId() ?? createSession().id;
    setActiveSessionId(newId);
    setHasMessages(false);
  }, []);

  const handleFirstMessage = useCallback(() => {
    setHasMessages(true);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" suppressHydrationWarning>
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
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <GraduationCap className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                HUST Q&A
              </h2>
              <p className="text-[10px] text-muted-foreground">
                Quy che dao tao
              </p>
            </div>
          </div>
          <ThemeToggle />
        </header>

        {/* Main Content */}
        {hasMessages ? (
          <ChatInterface
            sessionId={activeSessionId}
            onFirstMessage={handleFirstMessage}
          />
        ) : (
          <>
            <WelcomeScreen />
            <div className="pb-4">
              <ChatInterface
                sessionId={activeSessionId}
                onFirstMessage={handleFirstMessage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
