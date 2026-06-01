"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { ThoughtChain } from "@/components/thought-chain";
import type { ThoughtStep } from "@/hooks/use-stream-chat";
import {
  User, Link as LinkIcon, Check, X, ShieldAlert, AlertTriangle, RefreshCw, Copy, ThumbsUp, ThumbsDown, School, GraduationCap
} from "lucide-react";

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

function ErrorCard({ content }: { content: string }) {
  const isConnectionError =
    content.toLowerCase().includes("fetch") ||
    content.toLowerCase().includes("network") ||
    content.toLowerCase().includes("connect");

  const userMessage = isConnectionError
    ? "Không thể kết nối tới hệ thống. Vui lòng kiểm tra backend đang chạy và thử lại."
    : content.startsWith("Error:")
    ? content.replace(/^Error:\s*/i, "")
    : content;

  return (
    <div
      className="flex items-start gap-3 rounded-2xl p-4 border animate-slide-up"
      style={{
        background: "var(--error-bg)",
        borderColor: "var(--error-border)",
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "color-mix(in srgb, var(--error-text) 12%, transparent)" }}
      >
        <AlertTriangle className="h-4 w-4" style={{ color: "var(--error-text)" }} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--error-text)" }}>
          Đã xảy ra lỗi
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          {userMessage}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 hover:opacity-90"
          style={{
            background: "var(--error-text)",
            color: "#ffffff",
          }}
        >
          <RefreshCw className="h-3 w-3" />
          Tải lại trang
        </button>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="text-xs ml-1" style={{ color: "var(--muted-foreground)" }}>
        Đang trả lời...
      </span>
    </div>
  );
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
    isAssistant && isStreaming && streamingThoughts ? streamingThoughts : thoughts;
  const displayContent =
    isAssistant && isStreaming && streamingContent !== undefined
      ? streamingContent
      : content;
  const displaySources =
    isAssistant && isStreaming && streamingSources ? streamingSources : sources;
  const displayClarifyPrompt =
    isAssistant && isStreaming && streamingClarifyPrompt !== undefined
      ? streamingClarifyPrompt
      : clarifyPrompt;

  // Remove emojis only at the start of headings
  const sanitizeHeadings = (text: string) => {
    return text.replace(/^(#+)\s+(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])+\s*/gm, '$1 ');
  };

  const safeDisplayContent = displayContent ? sanitizeHeadings(displayContent) : displayContent;

  // Error detection
  const isError =
    isAssistant &&
    !isStreaming &&
    (content.startsWith("Error:") ||
      content.toLowerCase().includes("failed to fetch") ||
      content.toLowerCase().includes("loi xu ly"));

  return (
    <div
      className={cn(
        "flex w-full gap-3 px-2 py-3 animate-fade-in items-start",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* Bot Avatar */}
      {isAssistant && (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5 shadow-sm"
          style={{
            background: "linear-gradient(135deg, #C8102E 0%, #E62040 100%)",
          }}
        >
          <GraduationCap className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Content Bubble */}
      <div
        className={cn(
          "flex flex-col gap-2 w-full",
          isUser ? "max-w-[85%] md:max-w-[70%] items-end" : "max-w-[95%] md:max-w-[92%] items-start"
        )}
      >
        {/* User bubble */}
        {isUser && (
          <div
            className="rounded-[18px] px-5 py-3.5 shadow-sm"
            style={{
              background: "#D41A2A",
              color: "#ffffff",
            }}
          >
            <p className="text-[15px] font-normal whitespace-pre-wrap break-words leading-relaxed">
              {content}
            </p>
          </div>
        )}

        {/* Assistant bubble */}
        {isAssistant && (
          <div className="w-full pt-1">
            {isError ? (
              <ErrorCard content={content} />
            ) : (
              <div className="flex flex-col gap-3 w-full overflow-hidden">
                {/* Thought Chain */}
                <div>
                  <ThoughtChain
                    thoughts={displayThoughts}
                    isStreaming={isStreaming && !displayContent}
                  />
                </div>

                {/* Answer */}
                <div className="prose prose-sm dark:prose-invert max-w-full overflow-x-auto break-words">
                  {safeDisplayContent ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {safeDisplayContent}
                    </ReactMarkdown>
                  ) : isStreaming ? (
                    <TypingIndicator />
                  ) : (
                    <span className="text-sm italic" style={{ color: "var(--muted-foreground)" }}>
                      (Không có nội dung)
                    </span>
                  )}

                  {/* Blinking cursor */}
                  {isStreaming && safeDisplayContent && (
                    <span
                      className="inline-block w-1.5 h-4 ml-0.5 rounded-sm align-middle animate-cursor-blink"
                      style={{ background: "var(--accent)" }}
                    />
                  )}
                </div>

                {/* Sources */}
                {displaySources && displaySources.length > 0 && (
                  <div
                    className="mt-1 pt-3"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <div
                      className="text-[11px] font-semibold mb-2 flex items-center gap-1.5"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <LinkIcon className="h-3 w-3" />
                      Nguồn tham khảo:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {displaySources.map((src, index) => {
                        const isUrl =
                          src.startsWith("http://") || src.startsWith("https://");
                        return isUrl ? (
                          <a
                            key={index}
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 hover:opacity-80"
                            style={{
                              background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                              color: "var(--accent)",
                              border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                            }}
                          >
                            {src}
                          </a>
                        ) : (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium"
                            style={{
                              background: "var(--muted)",
                              color: "var(--muted-foreground)",
                            }}
                          >
                            {src}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Clarify Prompt (HITL) */}
                {displayClarifyPrompt && (
                  <div
                    className="mt-2 p-4 rounded-xl border animate-pulse-subtle"
                    style={{
                      background: "color-mix(in srgb, var(--accent) 6%, var(--card))",
                      borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
                    }}
                  >
                    <div className="flex gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                        }}
                      >
                        <ShieldAlert className="h-4 w-4" style={{ color: "var(--accent)" }} />
                      </div>
                      <div className="flex-1">
                        <p
                          className="text-sm font-medium mb-3 leading-relaxed"
                          style={{ color: "var(--foreground)" }}
                        >
                          {displayClarifyPrompt}
                        </p>
                        {!isStreaming && onClarifyResponse && (
                          <div className="flex gap-2.5 flex-wrap">
                            <button
                              onClick={() => onClarifyResponse(true)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:opacity-90"
                              style={{
                                background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                                color: "#ffffff",
                              }}
                            >
                              <Check className="h-3.5 w-3.5" /> Đồng ý
                            </button>
                            <button
                              onClick={() => onClarifyResponse(false)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:opacity-80"
                              style={{
                                background: "var(--muted)",
                                color: "var(--foreground)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <X className="h-3.5 w-3.5" /> Từ chối
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {/* Action Buttons & Timestamp */}
                {!isStreaming && !isError && safeDisplayContent && (
                  <div className="flex items-center justify-between mt-2 pt-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigator.clipboard.writeText(safeDisplayContent)}
                        className="p-1.5 rounded-md transition-colors hover:bg-muted"
                        style={{ color: "var(--muted-foreground)" }}
                        aria-label="Copy"
                        title="Copy"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="p-1.5 rounded-md transition-colors hover:bg-muted"
                        style={{ color: "var(--muted-foreground)" }}
                        aria-label="Helpful"
                        title="Helpful"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="p-1.5 rounded-md transition-colors hover:bg-muted"
                        style={{ color: "var(--muted-foreground)" }}
                        aria-label="Not helpful"
                        title="Not helpful"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                      Vừa xong
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl mt-1 shadow-sm"
          style={{
            background: "var(--muted)",
            border: "1px solid var(--border)",
          }}
        >
          <User className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
        </div>
      )}
    </div>
  );
}
