"use client";

import type { Session } from "@/lib/types";

type Props = {
  sessions: Session[];
  activeSessionId: string | null;
  isGenerating: boolean;
  onNewSession: () => void;
  onOpenSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
};

type Group = {
  label: string;
  sessions: Session[];
};

function groupSessions(sessions: Session[]): Group[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups: Group[] = [
    { label: "Today", sessions: [] },
    { label: "Yesterday", sessions: [] },
    { label: "Previous 7 days", sessions: [] },
    { label: "Older", sessions: [] },
  ];

  for (const session of sessions) {
    const date = new Date(session.updatedAt);
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diffDays = Math.floor((today - day) / 86_400_000);
    if (diffDays <= 0) groups[0].sessions.push(session);
    else if (diffDays === 1) groups[1].sessions.push(session);
    else if (diffDays <= 7) groups[2].sessions.push(session);
    else groups[3].sessions.push(session);
  }

  return groups.filter((g) => g.sessions.length > 0);
}

function relativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.max(1, Math.round(diffMs / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function ChatHistorySidebar({
  sessions,
  activeSessionId,
  isGenerating,
  onNewSession,
  onOpenSession,
  onDeleteSession,
  onRenameSession,
}: Props) {
  const groups = groupSessions(sessions);

  return (
    <aside className="relative z-20 flex w-[260px] shrink-0 flex-col border-r border-[color-mix(in_oklab,var(--forge-edge)_50%,transparent)] bg-[color-mix(in_oklab,var(--forge-bg)_92%,black)]">
      <div className="border-b border-[color-mix(in_oklab,var(--forge-edge)_50%,transparent)] p-3">
        <button
          type="button"
          onClick={onNewSession}
          disabled={isGenerating}
          className="flex w-full items-center justify-between rounded-xl border border-[color-mix(in_oklab,var(--forge-molt)_45%,transparent)] bg-[color-mix(in_oklab,var(--forge-molt)_14%,black)] px-3 py-2 text-left text-xs font-medium text-[var(--forge-fg)] transition hover:border-[var(--forge-molt)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>+ New chat</span>
          <span className="rounded-full bg-[var(--forge-molt)] px-1.5 py-0.5 text-[9px] font-bold text-black">
            fresh
          </span>
        </button>
        {isGenerating && (
          <p className="mt-2 text-[10px] text-amber-300/80">
            Generation in progress — finish or stop before switching.
          </p>
        )}
      </div>

      <div className="forge-chat-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        {groups.map((group) => (
          <section key={group.label} className="space-y-1.5">
            <h2 className="px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--forge-muted)]">
              {group.label}
            </h2>
            <div className="space-y-1">
              {group.sessions.map((session) => {
                const active = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    className={`group rounded-xl border p-2 transition ${
                      active
                        ? "border-[color-mix(in_oklab,var(--forge-molt)_45%,transparent)] bg-[color-mix(in_oklab,var(--forge-molt)_12%,black)]"
                        : "border-transparent bg-transparent hover:border-[color-mix(in_oklab,var(--forge-edge)_65%,transparent)] hover:bg-white/[0.035]"
                    }`}
                  >
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() => onOpenSession(session.id)}
                      className="block w-full text-left disabled:cursor-not-allowed"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-[var(--forge-fg)]">
                          {session.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-[var(--forge-muted)]">
                          {relativeTime(session.updatedAt)}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-[var(--forge-muted)]">
                        {session.lastMessagePreview || "Beautiful blank canvas"}
                      </span>
                    </button>
                    <div className="mt-2 hidden gap-1 group-hover:flex">
                      <button
                        type="button"
                        disabled={isGenerating}
                        onClick={() => {
                          const title = window.prompt("Rename chat", session.title);
                          if (title) onRenameSession(session.id, title);
                        }}
                        className="rounded-md px-1.5 py-1 text-[10px] text-[var(--forge-muted)] transition hover:bg-white/10 hover:text-[var(--forge-fg)] disabled:opacity-50"
                      >
                        rename
                      </button>
                      <button
                        type="button"
                        disabled={isGenerating}
                        onClick={() => onDeleteSession(session.id)}
                        className="rounded-md px-1.5 py-1 text-[10px] text-red-300/80 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
                      >
                        delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
