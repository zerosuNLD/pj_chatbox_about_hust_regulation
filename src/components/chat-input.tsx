"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
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

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      <div
        className={cn(
          "relative flex items-end gap-2 rounded-2xl border border-border bg-card",
          "shadow-sm transition-shadow duration-200",
          "focus-within:border-accent/40 focus-within:shadow-md",
          "p-2"
        )}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Hoi ve quy che dao tao HUST..."
          rows={1}
          disabled={isStreaming || disabled}
          className={cn(
            "flex-1 resize-none bg-transparent px-3 py-2",
            "text-sm text-foreground placeholder:text-muted-foreground",
            "outline-none",
            "max-h-[200px]"
          )}
        />

        {isStreaming ? (
          <button
            onClick={onStop}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              "bg-foreground text-background",
              "hover:opacity-80 transition-opacity",
              "shrink-0"
            )}
            aria-label="Stop generating"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              "transition-all duration-200 shrink-0",
              input.trim()
                ? "bg-accent text-accent-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        HUST Q&A may produce inaccurate information. Please verify with official sources.
      </p>
    </div>
  );
}
