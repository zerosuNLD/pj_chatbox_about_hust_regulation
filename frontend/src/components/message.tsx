"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { ThoughtChain } from "@/components/thought-chain";
import type { ThoughtStep } from "@/hooks/use-stream-chat";
import { Bot, User, Link as LinkIcon, Check, X, ShieldAlert } from "lucide-react";

interface MessageProps {
  id: string;
  role: "user" | "assistant";
  content: string;
  thoughts: ThoughtStep[];
  sources?: string[];
  clarifyPrompt?: string;
  isStreaming: boolean;
  streamingContent?: string;
  streamingThoughts?: ThoughtStep[];
  streamingSources?: string[];
  streamingClarifyPrompt?: string | null;
  onClarifyResponse?: (approved: boolean) => void;
}

export function Message({
  role,
  content,
  thoughts,
  sources,
  clarifyPrompt,
  isStreaming,
  streamingContent,
  streamingThoughts,
  streamingSources,
  streamingClarifyPrompt,
  onClarifyResponse,
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

  const displaySources =
    isAssistant && isStreaming && streamingSources
      ? streamingSources
      : sources;

  const displayClarifyPrompt =
    isAssistant && isStreaming && streamingClarifyPrompt !== undefined
      ? streamingClarifyPrompt
      : clarifyPrompt;

    <div
      className={cn(
        "flex w-full gap-3 px-4 py-4 md:py-6",
        "animate-slide-up",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* Bot Avatar */}
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent mt-1">
          <Bot className="h-4 w-4" />
        </div>
      )}

      {/* Content Bubble */}
      <div 
        className={cn(
          "flex flex-col gap-2 max-w-[85%] md:max-w-[75%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-accent text-accent-foreground rounded-br-sm"
              : "bg-muted/40 text-foreground rounded-bl-sm"
          )}
        >
          {/* User message: simple text */}
          {isUser && (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {content}
            </p>
          )}

          {/* Assistant message: thought chain + markdown answer */}
          {isAssistant && (
            <div className="flex flex-col gap-3 w-full overflow-hidden">
              {/* Thought Chain */}
              <ThoughtChain
                thoughts={displayThoughts}
                isStreaming={isStreaming && !displayContent}
              />

              {/* Answer — always render when assistant */}
              <div className="prose prose-sm dark:prose-invert max-w-full overflow-x-auto break-words">
                {displayContent ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {displayContent}
                  </ReactMarkdown>
                ) : isStreaming ? (
                  <span className="text-muted-foreground animate-pulse-subtle">
                    Generating response...
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">
                    (empty response)
                  </span>
                )}

                {/* Blinking cursor while streaming */}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-accent animate-cursor-blink align-middle" />
                )}
              </div>

              {/* Sources Section */}
              {displaySources && displaySources.length > 0 && (
                <div className="mt-2 pt-3 border-t border-border/60">
                  <div className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <LinkIcon className="h-3 w-3" /> Nguồn tham khảo:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {displaySources.map((src, index) => {
                      const isUrl = src.startsWith("http://") || src.startsWith("https://");
                      return isUrl ? (
                        <a
                          key={index}
                          href={src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-accent/10 hover:bg-accent/20 text-accent transition-colors duration-200"
                        >
                          {src}
                        </a>
                      ) : (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted/60 text-muted-foreground"
                        >
                          {src}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Clarify Prompt (HITL Interrupt) */}
              {displayClarifyPrompt && (
                <div className="mt-2 p-4 rounded-xl border border-accent/20 bg-accent/5 backdrop-blur-sm shadow-sm animate-pulse-subtle">
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent">
                      <ShieldAlert className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground mb-3 leading-relaxed">
                        {displayClarifyPrompt}
                      </p>
                      {!isStreaming && onClarifyResponse && (
                        <div className="flex gap-2.5 flex-wrap">
                          <button
                            onClick={() => onClarifyResponse(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm transition-all duration-200"
                          >
                            <Check className="h-3.5 w-3.5" /> Đồng ý
                          </button>
                          <button
                            onClick={() => onClarifyResponse(false)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-background border border-border text-foreground hover:bg-muted/80 transition-all duration-200"
                          >
                            <X className="h-3.5 w-3.5" /> Từ chối
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
