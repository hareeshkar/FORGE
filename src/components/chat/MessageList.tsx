"use client";

import type { ChatMessage } from "@/lib/types";
import { SourceChips } from "./SourceChips";

type Props = {
  messages: ChatMessage[];
};

export function MessageList({ messages }: Props) {
  if (!messages.length) {
    return (
      <p className="font-forge-body text-sm leading-relaxed text-[var(--forge-muted)]">
        Prompt the furnace. With Research Mode on, MiniMax web search streams real snippets into the log before M2.7 writes files.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((msg, i) => (
        <div
          key={msg.id}
          style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          className={`forge-msg-enter rounded-xl px-3.5 py-2.5 text-sm shadow-[inset_0_1px_0_color-mix(in_oklab,white_6%,transparent)] ${
            msg.role === "user"
              ? "ml-5 border border-[color-mix(in_oklab,var(--forge-molt)_28%,transparent)] bg-[color-mix(in_oklab,var(--forge-molt)_14%,black)] font-forge-body text-[var(--forge-fg)]"
              : msg.role === "assistant"
                ? "mr-2 border border-[color-mix(in_oklab,var(--forge-edge)_55%,transparent)] bg-[color-mix(in_oklab,var(--forge-panel)_70%,black)] font-forge-body text-[color-mix(in_oklab,var(--forge-fg)_95%,transparent)]"
                : "font-forge-body text-[color-mix(in_oklab,var(--forge-muted)_95%,transparent)] italic"
          }`}
        >
          <p className="whitespace-pre-wrap">{msg.content}</p>
          {msg.meta?.sources && <SourceChips sources={msg.meta.sources} />}
        </div>
      ))}
    </div>
  );
}
