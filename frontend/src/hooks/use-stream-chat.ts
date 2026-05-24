"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { streamAsk, streamResume } from "@/lib/api";
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
  sources?: string[];
  clarifyPrompt?: string;
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
  const [streamingSources, setStreamingSources] = useState<string[]>([]);
  const [streamingClarifyPrompt, setStreamingClarifyPrompt] = useState<string | null>(null);
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
    setStreamingSources([]);
    setStreamingClarifyPrompt(null);
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
    setStreamingSources([]);
    setStreamingClarifyPrompt(null);
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
      setStreamingSources([]);
      setStreamingClarifyPrompt(null);

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
        let sourcesList: string[] = [];
        let clarifyVal: string | null = null;

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
          } else if (event.type === "answer_retract") {
            // Backend detected that streamed tokens were intermediate thought — retract them
            const retracted = event.content as string;
            // Remove retracted text from the end of answerText
            if (answerText.endsWith(retracted)) {
              answerText = answerText.slice(0, -retracted.length);
            } else {
              // Fallback: best-effort trim (may differ slightly due to whitespace)
              answerText = answerText.slice(0, Math.max(0, answerText.length - retracted.length));
            }
            setStreamingAnswer(answerText);
            // Add retracted content to thoughts
            thoughtList.push({ content: retracted });
            setStreamingThoughts([...thoughtList]);
          } else if (event.type === "sources") {
            sourcesList = [...sourcesList, ...event.content];
            setStreamingSources(sourcesList);
          } else if (event.type === "clarify") {
            clarifyVal = event.content;
            setStreamingClarifyPrompt(clarifyVal);
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
              ? {
                  ...msg,
                  content: answerText,
                  thoughts: thoughtList,
                  sources: sourcesList.length > 0 ? sourcesList : undefined,
                  clarifyPrompt: clarifyVal || undefined,
                }
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
                    sources: streamingSources.length > 0 ? streamingSources : undefined,
                    clarifyPrompt: streamingClarifyPrompt || undefined,
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
        setStreamingSources([]);
        setStreamingClarifyPrompt(null);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, messages, streamingAnswer, streamingThoughts, streamingSources, streamingClarifyPrompt, persistIfNeeded, sessionId]
  );

  const respondToClarify = useCallback(
    async (messageId: string, approved: boolean) => {
      if (isStreaming) return;

      // Update message to remove clarity prompt
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, clarifyPrompt: undefined }
            : msg
        )
      );

      setIsStreaming(true);
      setStreamingAnswer("");
      setStreamingThoughts([]);
      setStreamingSources([]);
      setStreamingClarifyPrompt(null);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        let answerText = "";
        let sourcesList: string[] = [];
        const thoughtList: ThoughtStep[] = [];
        let clarifyVal: string | null = null;

        for await (const event of streamResume(
          sessionId || "default_thread",
          getOrGenerateUserId(),
          approved,
          abortController.signal
        )) {
          if (event.type === "thought") {
            const thought: ThoughtStep = { content: event.content };
            thoughtList.push(thought);
            setStreamingThoughts([...thoughtList]);
          } else if (event.type === "answer") {
            answerText += event.content;
            setStreamingAnswer(answerText);
          } else if (event.type === "sources") {
            sourcesList = [...sourcesList, ...event.content];
            setStreamingSources(sourcesList);
          } else if (event.type === "clarify") {
            clarifyVal = event.content;
            setStreamingClarifyPrompt(clarifyVal);
          } else if (event.type === "done") {
            break;
          } else if (event.type === "error") {
            setStreamingAnswer(`Error: ${event.content}`);
            break;
          }
        }

        // Finalize the resumed response
        setMessages((prev) => {
          const final = prev.map((msg) => {
            if (msg.id === messageId) {
              const mergedThoughts = [...msg.thoughts, ...thoughtList];
              const mergedSources = Array.from(
                new Set([...(msg.sources || []), ...sourcesList])
              );
              const updatedContent = msg.content
                ? msg.content + "\n\n" + answerText
                : answerText;
              return {
                ...msg,
                content: updatedContent,
                thoughts: mergedThoughts,
                sources: mergedSources.length > 0 ? mergedSources : undefined,
                clarifyPrompt: clarifyVal || undefined,
              };
            }
            return msg;
          });
          persistIfNeeded(final);
          return final;
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((prev) => {
            const final = prev.map((msg) => {
              if (msg.id === messageId) {
                return {
                  ...msg,
                  content: msg.content + (streamingAnswer ? "\n\n" + streamingAnswer : ""),
                  thoughts: [...msg.thoughts, ...streamingThoughts],
                  sources: Array.from(
                    new Set([...(msg.sources || []), ...streamingSources])
                  ),
                  clarifyPrompt: streamingClarifyPrompt || undefined,
                };
              }
              return msg;
            });
            persistIfNeeded(final);
            return final;
          });
        } else {
          const errorMsg =
            err instanceof Error ? err.message : "Unknown error";
          setMessages((prev) => {
            const final = prev.map((msg) =>
              msg.id === messageId
                ? { ...msg, content: msg.content + `\n\nError: ${errorMsg}` }
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
        setStreamingSources([]);
        setStreamingClarifyPrompt(null);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, streamingAnswer, streamingThoughts, streamingSources, streamingClarifyPrompt, persistIfNeeded, sessionId]
  );

  return {
    messages,
    isStreaming,
    streamingAnswer,
    streamingThoughts,
    streamingSources,
    streamingClarifyPrompt,
    sendMessage,
    respondToClarify,
    stopStreaming,
    clearMessages,
    messagesEndRef,
  };
}
