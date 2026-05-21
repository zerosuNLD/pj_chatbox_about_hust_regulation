"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { ThoughtChain } from "@/components/thought-chain";
import type { ThoughtStep } from "@/hooks/use-stream-chat";
import { Bot, User } from "lucide-react";

interface MessageProps {
  id: string;
  role: "user" | "assistant";
  content: string;
  thoughts: ThoughtStep[];
  isStreaming: boolean;
  streamingContent?: string;
  streamingThoughts?: ThoughtStep[];
}

export function Message({
  role,
  content,
  thoughts,
  isStreaming,
  streamingContent,
  streamingThoughts,
}: MessageProps) {
  const isUser = role === "user";
  const isAssistant = role === "assistant";

  const displayThoughts =
    isAssistant && isStreaming && streamingThoughts
      ? streamingThoughts
      : thoughts;

  const displayContent =
    isAssistant && isStreaming && streamingContent !== undefined
      ? streamingContent
      : content;

  return (
    <div
      className={cn(
        "flex w-full gap-4 px-4 py-6",
        "animate-slide-up",
        isUser
          ? "bg-card/50"
          : "bg-card"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-muted text-muted-foreground"
            : "bg-accent/10 text-accent"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 max-w-[calc(100%-3rem)]">
        {/* User message: simple text */}
        {isUser && (
          <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
            {content}
          </p>
        )}

        {/* Assistant message: thought chain + markdown answer */}
        {isAssistant && (
          <div>
            {/* Thought Chain */}
            <ThoughtChain
              thoughts={displayThoughts}
              isStreaming={isStreaming && !displayContent}
            />

            {/* Answer */}
            {(displayContent || (isStreaming && !displayContent)) && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {displayContent ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {displayContent}
                  </ReactMarkdown>
                ) : (
                  <span className="text-muted-foreground animate-pulse-subtle">
                    Generating response...
                  </span>
                )}

                {/* Blinking cursor while streaming */}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-accent animate-cursor-blink align-middle" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
