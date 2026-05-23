const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface SSEChatEvent {
  type: "thought" | "answer" | "done" | "error";
  content: string;
}

/**
 * Sends a question to the FastAPI SSE endpoint and yields parsed events.
 * Uses fetch with ReadableStream to parse SSE text/event-stream.
 */
export async function* streamAsk(
  question: string,
  model: string,
  threadId: string,
  userId: string,
  signal?: AbortSignal
): AsyncGenerator<SSEChatEvent, void, undefined> {
  const response = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ question, model, thread_id: threadId, user_id: userId }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API error ${response.status}: ${body}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;

        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6);
          try {
            const event: SSEChatEvent = JSON.parse(jsonStr);
            yield event;
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
