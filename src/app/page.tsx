"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatInterface } from "@/components/chat-interface";
import { WelcomeScreen } from "@/components/welcome-screen";

export default function Home() {
  const [hasMessages, setHasMessages] = useState(false);

  return (
    <div className="flex flex-col min-h-screen max-h-screen">
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
        <ChatInterface onFirstMessage={() => setHasMessages(true)} />
      ) : (
        <>
          <WelcomeScreen />
          <div className="pb-4">
            <ChatInterface onFirstMessage={() => setHasMessages(true)} />
          </div>
        </>
      )}
    </div>
  );
}
