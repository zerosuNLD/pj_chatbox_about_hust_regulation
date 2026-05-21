"use client";

import { useState } from "react";
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

  if (thoughts.length === 0 && !isStreaming) return null;

  return (
    <div className={cn("mb-3", className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 text-xs font-medium transition-colors w-full",
          "text-thought-text hover:text-muted-foreground"
        )}
      >
        <Brain
          className={cn(
            "h-3.5 w-3.5",
            isStreaming && "animate-pulse-subtle"
          )}
        />
        <span>
          {thoughts.length > 0
            ? `Thought process (${thoughts.length} step${thoughts.length > 1 ? "s" : ""})`
            : "Thinking..."}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            expanded ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          expanded ? "max-h-[1000px] opacity-100 mt-2" : "max-h-0 opacity-0"
        )}
      >
        <div className="border-l-2 border-thought-border pl-3 space-y-2">
          {thoughts.map((thought, i) => (
            <div
              key={i}
              className={cn(
                "text-xs text-thought-text leading-relaxed py-0.5",
                "animate-slide-up",
                `[animation-delay:${i * 80}ms]`
              )}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {thought.content}
            </div>
          ))}

          {isStreaming && thoughts.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-thought-text py-0.5 animate-pulse-subtle">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse-subtle" />
              Analyzing your question...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
