"use client";

import { useEffect, useState, useCallback } from "react";
import { ChatInput } from "@/components/chat-input";
import { Message } from "@/components/message";
import { useStreamChat } from "@/hooks/use-stream-chat";
import { DEFAULT_MODEL, type ModelOption } from "@/lib/models";

interface ChatInterfaceProps {
  sessionId: string | null;
  onFirstMessage?: () => void;
}

export function ChatInterface({ sessionId, onFirstMessage }: ChatInterfaceProps) {
  const {
    messages,
    isStreaming,
    streamingAnswer,
    streamingThoughts,
    sendMessage,
    stopStreaming,
    messagesEndRef,
  } = useStreamChat(sessionId);

  const [selectedModel, setSelectedModel] = useState<ModelOption>(DEFAULT_MODEL);

  const handleSend = useCallback(
    (text: string) => {
      if (messages.length === 0 && onFirstMessage) {
        onFirstMessage();
      }
      sendMessage(text, selectedModel.id);
    },
    [messages, onFirstMessage, sendMessage, selectedModel.id]
  );

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingAnswer, streamingThoughts, messagesEndRef]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col justify-end">
        <div className="flex-1" />
        <ChatInput
          onSend={handleSend}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-border">
          {messages.map((msg) => {
            const isLastAssistant =
              msg.role === "assistant" && msg.id === messages[messages.length - 1]?.id;

            return (
              <Message
                key={msg.id}
                id={msg.id}
                role={msg.role}
                content={msg.content}
                thoughts={msg.thoughts}
                isStreaming={isLastAssistant && isStreaming}
                streamingContent={
                  isLastAssistant && isStreaming
                    ? streamingAnswer
                    : undefined
                }
                streamingThoughts={
                  isLastAssistant && isStreaming
                    ? streamingThoughts
                    : undefined
                }
              />
            );
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="py-4">
        <ChatInput
          onSend={handleSend}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
        />
      </div>
    </div>
  );
}
