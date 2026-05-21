"use client";

import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface WelcomeScreenProps {
  className?: string;
}

const EXAMPLE_PROMPTS = [
  "Hoc phi cua HUST duoc tinh nhu the nao?",
  "Dieu kien xet tot nghiep dai hoc la gi?",
  "Quy dinh ve hoc lai, hoc cai thien nhu the nao?",
  "Sinh vien duoc bao luu ket qua hoc tap trong nhung truong hop nao?",
];

export function WelcomeScreen({ className }: WelcomeScreenProps) {
  const handlePromptClick = (prompt: string) => {
    const textarea = document.querySelector("textarea");
    if (textarea) {
      textarea.value = prompt;
      textarea.focus();

      // Trigger input event for auto-resize
      const event = new Event("input", { bubbles: true });
      textarea.dispatchEvent(event);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center px-4 animate-fade-in",
        className
      )}
    >
      {/* Logo / Icon */}
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-2xl mb-6",
          "bg-accent/10"
        )}
      >
        <GraduationCap className="h-8 w-8 text-accent" />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-semibold text-foreground mb-2">
        HUST &mdash; Quy Che Dao Tao
      </h1>
      <p className="text-sm text-muted-foreground mb-8 max-w-md text-center leading-relaxed">
        Ask questions about training regulations, academic policies, and
        procedures at Hanoi University of Science and Technology.
      </p>

      {/* Example prompts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl w-full">
        {EXAMPLE_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handlePromptClick(prompt)}
            className={cn(
              "text-left text-xs text-muted-foreground p-3 rounded-xl",
              "border border-border bg-card hover:bg-muted",
              "transition-colors duration-150 cursor-pointer",
              "hover:text-foreground"
            )}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
