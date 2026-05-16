"use client";

import { useCallback, useState } from "react";
import type { ChatMessage } from "@/lib/types";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const addMessage = useCallback((partial: Partial<ChatMessage>) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: partial.role ?? "system",
      content: partial.content ?? "",
      timestamp: new Date().toISOString(),
      meta: partial.meta,
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, addMessage, clearMessages };
}
