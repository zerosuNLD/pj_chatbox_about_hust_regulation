"use client";

import { cn } from "@/lib/utils";

interface WelcomeScreenProps {
  className?: string;
  onPromptSelect?: (prompt: string) => void;
}

export function WelcomeScreen({ className }: WelcomeScreenProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center w-full animate-fade-in",
        className
      )}
    >
      <h1
        className="text-2xl md:text-3xl font-serif font-medium mb-4 text-center"
        style={{ color: "var(--foreground)" }}
      >
        <span style={{ color: "var(--accent)" }}>✦</span> Xin chào! Tôi là HUST Q&amp;A
      </h1>
      <p
        className="text-sm text-center"
        style={{ color: "var(--muted-foreground)" }}
      >
        Hỏi bất kỳ điều gì về Quy chế Đào tạo của Đại học Bách Khoa Hà Nội.
      </p>
    </div>
  );
}
