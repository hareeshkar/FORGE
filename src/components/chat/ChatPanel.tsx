"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage, ResearchSource } from "@/lib/types";
import type { PromptPayload } from "./ChatInput";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
import { ResearchLog } from "./ResearchLog";

type Props = {
  messages: ChatMessage[];
  researchEntries: ResearchSource[];
  onSubmit: (payload: PromptPayload) => void;
  disabled?: boolean;
  researchMode: boolean;
  onResearchModeChange: (v: boolean) => void;
};

export function ChatPanel({
  messages,
  researchEntries,
  onSubmit,
  disabled,
  researchMode,
  onResearchModeChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, researchEntries]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[color-mix(in_oklab,var(--forge-panel)_88%,black)]">
      <div ref={scrollRef} className="forge-chat-scroll flex-1 space-y-5 overflow-y-auto p-5">
        <ResearchLog entries={researchEntries} />
        <MessageList messages={messages} />
        {disabled && (
          <div className="flex items-center gap-2 px-1 py-1 font-forge-body text-xs italic text-[var(--forge-muted)]">
            <span className="inline-flex gap-1">
              <span className="forge-dot-pulse" style={{ animationDelay: "0ms" }} />
              <span className="forge-dot-pulse" style={{ animationDelay: "180ms" }} />
              <span className="forge-dot-pulse" style={{ animationDelay: "360ms" }} />
            </span>
            MiniMax running — search + M2.7 active…
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput
        onSubmit={onSubmit}
        disabled={disabled}
        researchMode={researchMode}
        onResearchModeChange={onResearchModeChange}
      />
    </div>
  );
}
