"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send, Square, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelSelector } from "@/components/model-selector";
import type { ModelOption } from "@/lib/models";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  selectedModel: ModelOption;
  onSelectModel: (model: ModelOption) => void;
}

export function ChatInput({ onSend, onStop, isStreaming, disabled, selectedModel, onSelectModel }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isStreaming || disabled) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasInput = input.trim().length > 0;

  return (
    <div className="w-full max-w-[760px] mx-auto px-6">
      {/* Main input box */}
      <div
        className={cn(
          "relative flex flex-col rounded-[14px] border transition-all duration-200",
          "p-1.5"
        )}
        style={{
          background: "var(--card)",
          borderColor: focused ? "var(--accent)" : "transparent",
          boxShadow: focused
            ? "0 0 0 1px var(--accent), 0 4px 24px rgba(0,0,0,0.12)"
            : "0 4px 24px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Hỏi về quy chế đào tạo HUST..."
          rows={1}
          disabled={isStreaming || disabled}
          className={cn(
            "flex-1 resize-none bg-transparent px-2 pt-2 pb-0.5",
            "text-[14px] placeholder:text-[#AAAAAA] dark:placeholder:text-[#555555]",
            "outline-none max-h-[120px] leading-relaxed",
            "text-[var(--foreground)]"
          )}
          style={{
            color: "var(--foreground)",
          }}
        />

        {/* Bottom Action Bar */}
        <div className="flex items-center justify-between mt-1 pt-0">
          {/* Left: Attachment */}
          <div className="flex items-center">
            <button
              className="flex items-center justify-center h-8 w-8 rounded-lg text-[#AAAAAA] hover:bg-muted transition-colors"
              aria-label="Add attachment"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
            </button>
          </div>

          {/* Right: Model Selector & Send */}
          <div className="flex items-center gap-2">
            <ModelSelector
              selectedModel={selectedModel}
              onSelectModel={onSelectModel}
              disabled={isStreaming}
            />
            
            <button
              className="flex items-center justify-center h-8 w-8 rounded-lg text-[#AAAAAA] hover:bg-muted transition-colors"
              aria-label="Voice input"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </button>

            {isStreaming ? (
              <button
                onClick={onStop}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 hover:opacity-80"
                style={{
                  background: "var(--foreground)",
                  color: "var(--card)",
                }}
                aria-label="Stop generating"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              hasInput ? (
                <button
                  onClick={handleSend}
                  disabled={!hasInput || disabled}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 hover:opacity-90 hover:scale-105 active:scale-95"
                  style={{
                    background: "#C8102E",
                    color: "#ffffff",
                    boxShadow: "0 2px 8px color-mix(in srgb, #C8102E 35%, transparent)",
                  }}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              ) : (
                <button
                  disabled
                  className="flex h-8 w-8 items-center justify-center rounded-lg opacity-40 cursor-not-allowed"
                  style={{
                    background: "var(--muted)",
                    color: "var(--muted-foreground)",
                  }}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-center mt-2 gap-1.5">
        <Keyboard className="h-3 w-3" style={{ color: "var(--muted-foreground)" }} />
        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          Enter để gửi · Shift+Enter xuống dòng
        </p>
      </div>
    </div>
  );
}
