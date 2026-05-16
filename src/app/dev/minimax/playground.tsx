"use client";

import { useCallback, useState } from "react";

export function MiniMaxPlayground() {
  const [status, setStatus] = useState<string>("");
  const [chatOut, setChatOut] = useState<string>("");
  const [searchOut, setSearchOut] = useState<string>("");
  const [prompt, setPrompt] = useState("Reply with exactly three words: forge studio live");
  const [q, setQ] = useState("Stripe.js Payment Element documentation");

  const runStatus = useCallback(async () => {
    const res = await fetch("/api/dev/minimax/status");
    setStatus(JSON.stringify(await res.json(), null, 2));
  }, []);

  const runChat = useCallback(async () => {
    const res = await fetch("/api/dev/minimax/probe-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    setChatOut(JSON.stringify(await res.json(), null, 2));
  }, [prompt]);

  const runSearch = useCallback(async () => {
    const res = await fetch("/api/dev/minimax/probe-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q }),
    });
    setSearchOut(JSON.stringify(await res.json(), null, 2));
  }, [q]);

  return (
    <div className="forge-app min-h-screen bg-[var(--forge-bg)] px-6 py-10 text-[var(--forge-fg)]">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2 border-b border-[color-mix(in_oklab,var(--forge-edge)_60%,transparent)] pb-8">
          <h1 className="font-forge-display text-3xl font-bold text-[var(--forge-molt)]">
            MiniMax probe
          </h1>
          <p className="font-forge-body text-sm text-[var(--forge-muted)]">
            Validates live parameters from{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5 text-[var(--forge-ember)]">
              docs/minimax-api-reference.md
            </code>
            . Requires{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5">MINIMAX_API_KEY</code> and{" "}
            <strong>development</strong> mode.
          </p>
        </header>

        <section className="space-y-3">
          <button
            type="button"
            onClick={runStatus}
            className="rounded-xl bg-[var(--forge-molt)] px-5 py-2.5 text-sm font-semibold text-black"
          >
            GET /api/dev/minimax/status
          </button>
          {status && (
            <pre className="overflow-x-auto rounded-xl bg-black/50 p-4 font-mono text-xs text-[var(--forge-ember)]">
              {status}
            </pre>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-forge-display text-lg text-[var(--forge-fg)]">M2.7 smoke fields</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-[color-mix(in_oklab,var(--forge-edge)_70%,transparent)] bg-black/40 p-3 font-mono text-sm"
          />
          <button
            type="button"
            onClick={runChat}
            className="rounded-xl border border-[color-mix(in_oklab,var(--forge-molt)_45%,transparent)] px-5 py-2.5 text-sm text-[var(--forge-molt)]"
          >
            POST probe-chat · model MiniMax-M2.7 · max_tokens 384 · n 1 · temperature 1
          </button>
          {chatOut && (
            <pre className="overflow-x-auto rounded-xl bg-black/50 p-4 font-mono text-xs text-emerald-300/90">
              {chatOut}
            </pre>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-forge-display text-lg text-[var(--forge-fg)]">Web search body</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-[color-mix(in_oklab,var(--forge-edge)_70%,transparent)] bg-black/40 p-3 font-mono text-sm"
          />
          <button
            type="button"
            onClick={runSearch}
            className="rounded-xl border border-[color-mix(in_oklab,var(--forge-molt)_45%,transparent)] px-5 py-2.5 text-sm text-[var(--forge-molt)]"
          >
            POST probe-search · JSON &#123; &quot;q&quot;: &quot;…&quot; &#125; only
          </button>
          {searchOut && (
            <pre className="overflow-x-auto rounded-xl bg-black/50 p-4 font-mono text-xs text-sky-300/90">
              {searchOut}
            </pre>
          )}
        </section>
      </div>
    </div>
  );
}
