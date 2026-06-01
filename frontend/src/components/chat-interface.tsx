"use client";

import { useEffect, useState, useCallback } from "react";
import { ChatInput } from "@/components/chat-input";
import { Message } from "@/components/message";
import { WelcomeScreen } from "@/components/welcome-screen";
import { useStreamChat } from "@/hooks/use-stream-chat";
import { DEFAULT_MODEL, type ModelOption } from "@/lib/models";

interface ChatInterfaceProps {
  sessionId: string | null;
  onFirstMessage?: () => void;
  hasMessages?: boolean;
}

export function ChatInterface({ sessionId, onFirstMessage, hasMessages }: ChatInterfaceProps) {
  const {
    messages,
    isStreaming,
    streamingAnswer,
    streamingThoughts,
    streamingSources,
    streamingClarifyPrompt,
    sendMessage,
    respondToClarify,
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

  const showWelcome = messages.length === 0;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Messages area */}
      {showWelcome ? (
        <div className="flex flex-col flex-1 items-center justify-center min-h-0 w-full px-4 mb-20">
          <WelcomeScreen onPromptSelect={handleSend} />
          <div className="w-full mt-8">
            <ChatInput
              onSend={handleSend}
              onStop={stopStreaming}
              isStreaming={isStreaming}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[760px] mx-auto w-full py-4 px-6">
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
                    sources={msg.sources}
                    clarifyPrompt={msg.clarifyPrompt}
                    isStreaming={isLastAssistant && isStreaming}
                    streamingContent={
                      isLastAssistant && isStreaming ? streamingAnswer : undefined
                    }
                    streamingThoughts={
                      isLastAssistant && isStreaming ? streamingThoughts : undefined
                    }
                    streamingSources={
                      isLastAssistant && isStreaming ? streamingSources : undefined
                    }
                    streamingClarifyPrompt={
                      isLastAssistant && isStreaming ? streamingClarifyPrompt : undefined
                    }
                    onClarifyResponse={(approved) => respondToClarify(msg.id, approved)}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* Input area — no background, blends with page */}
          <div className="shrink-0 py-4 z-10">
            <ChatInput
              onSend={handleSend}
              onStop={stopStreaming}
              isStreaming={isStreaming}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
            />
          </div>
        </>
      )}
    </div>
  );
}
