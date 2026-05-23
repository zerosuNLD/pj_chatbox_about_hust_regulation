"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { streamAsk } from "@/lib/api";
import {
  getSession,
  updateSessionMessages,
} from "@/lib/session-store";

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

function getOrGenerateUserId(): string {
  if (typeof window === "undefined") return "default_user";
  let uid = localStorage.getItem("hust-qa-user-id");
  if (!uid) {
    uid = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem("hust-qa-user-id", uid);
  }
  return uid;
}

export function useStreamChat(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [streamingThoughts, setStreamingThoughts] = useState<ThoughtStep[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSavedRef = useRef<string>("");

  // Load messages when session changes
  useEffect(() => {
    if (sessionId) {
      const session = getSession(sessionId);
      setMessages(session?.messages ?? []);
      lastSavedRef.current = JSON.stringify(session?.messages ?? []);
    } else {
      setMessages([]);
      lastSavedRef.current = "[]";
    }
    setIsStreaming(false);
    setStreamingAnswer("");
    setStreamingThoughts([]);
  }, [sessionId]);

  // Persist messages to localStorage on changes
  const persistIfNeeded = useCallback(
    (msgs: ChatMessage[]) => {
      if (!sessionId) return;
      const json = JSON.stringify(msgs);
      if (json !== lastSavedRef.current) {
        updateSessionMessages(sessionId, msgs);
        lastSavedRef.current = json;
      }
    },
    [sessionId]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingAnswer("");
    setStreamingThoughts([]);
    lastSavedRef.current = "[]";
    if (sessionId) updateSessionMessages(sessionId, []);
  }, [sessionId]);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const sendMessage = useCallback(
    async (question: string, model: string) => {
      if (!question.trim() || isStreaming) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: question.trim(),
        thoughts: [],
      };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      persistIfNeeded(updatedMessages);

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

      setMessages((prev) => [...prev, assistantMsg]);

      try {
        const thoughtList: ThoughtStep[] = [];
        let answerText = "";

        for await (const event of streamAsk(
          question.trim(),
          model,
          sessionId || "default_thread",
          getOrGenerateUserId(),
          abortController.signal
        )) {
          if (event.type === "thought") {
            const thought: ThoughtStep = { content: event.content };
            thoughtList.push(thought);
            setStreamingThoughts([...thoughtList]);
          } else if (event.type === "answer") {
            answerText += event.content;
            setStreamingAnswer(answerText);
          } else if (event.type === "done") {
            break;
          } else if (event.type === "error") {
            setStreamingAnswer(`Error: ${event.content}`);
            break;
          }
        }

        // Finalize the message
        setMessages((prev) => {
          const final = prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: answerText, thoughts: thoughtList }
              : msg
          );
          persistIfNeeded(final);
          return final;
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((prev) => {
            const final = prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: streamingAnswer || "(stopped)",
                    thoughts:
                      streamingThoughts.length > 0 ? streamingThoughts : [],
                  }
                : msg
            );
            persistIfNeeded(final);
            return final;
          });
        } else {
          const errorMsg =
            err instanceof Error ? err.message : "Unknown error";
          setMessages((prev) => {
            const final = prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: `Error: ${errorMsg}`, thoughts: [] }
                : msg
            );
            persistIfNeeded(final);
            return final;
          });
        }
      } finally {
        setIsStreaming(false);
        setStreamingAnswer("");
        setStreamingThoughts([]);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, messages, streamingAnswer, streamingThoughts, persistIfNeeded]
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
