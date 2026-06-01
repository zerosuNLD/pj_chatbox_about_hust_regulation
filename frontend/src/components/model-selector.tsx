"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { AVAILABLE_MODELS, type ModelOption } from "@/lib/models";

interface ModelSelectorProps {
  selectedModel: ModelOption;
  onSelectModel: (model: ModelOption) => void;
  disabled?: boolean;
}

export function ModelSelector({
  selectedModel,
  onSelectModel,
  disabled,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5",
          "text-[13px] font-medium transition-colors text-muted-foreground",
          "hover:bg-muted hover:text-foreground",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <span>{selectedModel.name}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute bottom-full left-0 mb-1 w-52",
            "rounded-xl border border-border bg-card shadow-lg",
            "py-1 z-50 animate-fade-in"
          )}
        >
          <p className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Models via Cloudflare
          </p>
          {AVAILABLE_MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                onSelectModel(model);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left",
                "text-sm transition-colors",
                model.id === selectedModel.id
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-foreground hover:bg-muted"
              )}
            >
              <span className="flex-1">{model.name}</span>
              <span
                className={cn(
                  "text-[10px]",
                  model.id === selectedModel.id
                    ? "text-accent"
                    : "text-muted-foreground"
                )}
              >
                {model.provider}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
