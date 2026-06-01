"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThoughtStep } from "@/hooks/use-stream-chat";

interface ThoughtChainProps {
  thoughts: ThoughtStep[];
  isStreaming: boolean;
  className?: string;
}

export function ThoughtChain({ thoughts, isStreaming, className }: ThoughtChainProps) {
  const [expanded, setExpanded] = useState(true);
  const prevStreamingRef = useRef(isStreaming);

  // Auto-collapse when streaming finishes (answer starts)
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = isStreaming;
    if (wasStreaming && !isStreaming) {
      setExpanded(false);
    }
  }, [isStreaming]);

  if (thoughts.length === 0 && !isStreaming) return null;

  return (
    <div className={cn("mb-2", className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[12px] transition-opacity hover:opacity-80"
        style={{ color: "#999999" }}
      >
        <span>
          {thoughts.length > 0
            ? `Quy trình phân tích (${thoughts.length} bước)`
            : "Đang phân tích thông tin..."}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            expanded ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out ml-3 mt-1",
          expanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div
          className="border-l-[1.5px] pl-4 space-y-2.5 py-1"
          style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)" }}
        >
          {thoughts.map((thought, i) => (
            <div
              key={i}
              className={cn(
                "text-xs leading-relaxed animate-slide-up",
                `[animation-delay:${i * 80}ms]`
              )}
              style={{
                color: "var(--muted-foreground)",
                animationDelay: `${i * 80}ms`
              }}
            >
              {thought.content}
            </div>
          ))}

          {isStreaming && thoughts.length === 0 && (
            <div className="flex items-center gap-2 text-xs py-0.5 animate-pulse-subtle" style={{ color: "var(--muted-foreground)" }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse-subtle" />
              Đang tiếp nhận dữ liệu...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
