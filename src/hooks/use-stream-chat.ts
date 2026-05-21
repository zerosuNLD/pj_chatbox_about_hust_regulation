"use client";

import { useState, useRef, useCallback } from "react";
import { streamAsk, SSEChatEvent } from "@/lib/api";

export interface ThoughtStep {
  content: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thoughts: ThoughtStep[];
}

let messageIdCounter = 0;
function generateId(): string {
  return `msg-${++messageIdCounter}`;
}

export function useStreamChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [streamingThoughts, setStreamingThoughts] = useState<ThoughtStep[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingAnswer("");
    setStreamingThoughts([]);
  }, []);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || isStreaming) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: question.trim(),
        thoughts: [],
      };
      setMessages((prev) => [...prev, userMsg]);

      // Start streaming
      setIsStreaming(true);
      setStreamingAnswer("");
      setStreamingThoughts([]);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const assistantId = generateId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        thoughts: [],
      };

      // Add placeholder assistant message
      setMessages((prev) => [...prev, assistantMsg]);

      try {
        let done = false;
        const thoughtList: ThoughtStep[] = [];
        let answerText = "";

        for await (const event of streamAsk(question.trim(), abortController.signal)) {
          if (event.type === "thought") {
            const thought: ThoughtStep = { content: event.content };
            thoughtList.push(thought);
            setStreamingThoughts([...thoughtList]);
          } else if (event.type === "answer") {
            answerText += event.content;
            setStreamingAnswer(answerText);
          } else if (event.type === "done") {
            done = true;
            break;
          } else if (event.type === "error") {
            setStreamingAnswer(`Error: ${event.content}`);
            break;
          }
        }

        // Finalize the message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: answerText, thoughts: thoughtList }
              : msg
          )
        );
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled - finalize with what we have
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: streamingAnswer || "(stopped)",
                    thoughts: streamingThoughts.length > 0 ? streamingThoughts : [],
                  }
                : msg
            )
          );
        } else {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: `Error: ${errorMsg}`, thoughts: [] }
                : msg
            )
          );
        }
      } finally {
        setIsStreaming(false);
        setStreamingAnswer("");
        setStreamingThoughts([]);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, streamingAnswer, streamingThoughts]
  );

  return {
    messages,
    isStreaming,
    streamingAnswer,
    streamingThoughts,
    sendMessage,
    stopStreaming,
    clearMessages,
    messagesEndRef,
  };
}
