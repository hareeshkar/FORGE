"use client";

import type { ResearchSource } from "@/lib/types";

type Props = {
  entries: ResearchSource[];
};

export function ResearchLog({ entries }: Props) {
  if (!entries.length) return null;

  return (
    <div className="space-y-3 border-l-[3px] border-[color-mix(in_oklab,var(--forge-molt)_42%,transparent)] pl-4">
      <p className="font-forge-display text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--forge-molt)]">
        Research Log
      </p>
      {entries.map((e, i) => (
        <div
          key={`${e.url}-${i}`}
          className="rounded-xl border border-[color-mix(in_oklab,var(--forge-edge)_55%,transparent)] bg-[color-mix(in_oklab,var(--forge-panel)_75%,black)] p-3 text-xs shadow-[inset_0_1px_0_color-mix(in_oklab,white_5%,transparent)]"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="line-clamp-1 font-forge-body font-medium text-[var(--forge-fg)]">{e.title}</span>
            <a
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[var(--forge-molt)] hover:text-[var(--forge-ember)]"
            >
              ↗
            </a>
          </div>
          <p className="mt-1.5 line-clamp-2 font-forge-body text-[color-mix(in_oklab,var(--forge-muted)_92%,transparent)]">
            {e.snippet}
          </p>
          <p className="mt-2 font-mono text-[10px] text-[color-mix(in_oklab,var(--forge-muted)_75%,transparent)]">
            q: {e.query}
          </p>
        </div>
      ))}
    </div>
  );
}
