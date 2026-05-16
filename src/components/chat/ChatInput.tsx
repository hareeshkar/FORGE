"use client";

import { useCallback, useRef, useState } from "react";

export type PromptPayload = {
  prompt: string;
  uploadedImageBase64?: string;
  uploadedImageMime?: string;
};

type Props = {
  onSubmit: (payload: PromptPayload) => void;
  disabled?: boolean;
  researchMode: boolean;
  onResearchModeChange: (v: boolean) => void;
};

function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const m = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

export function ChatInput({
  onSubmit,
  disabled,
  researchMode,
  onResearchModeChange,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [attachment, setAttachment] = useState<{ mime: string; base64: string; preview: string } | null>(
    null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const parsed = parseDataUrl(dataUrl);
      if (!parsed) return;
      setAttachment({
        mime: parsed.mime,
        base64: parsed.base64,
        preview: dataUrl,
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = prompt.trim();
      if (!trimmed || disabled) return;
      onSubmit({
        prompt: trimmed,
        uploadedImageBase64: attachment?.base64,
        uploadedImageMime: attachment?.mime,
      });
      setPrompt("");
      setAttachment(null);
    },
    [prompt, disabled, onSubmit, attachment]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="forge-chat-input flex shrink-0 flex-col gap-3 border-t border-[color-mix(in_oklab,var(--forge-edge)_85%,transparent)] p-4"
    >
      <label className="flex cursor-pointer items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--forge-muted)]">
        <input
          type="checkbox"
          checked={researchMode}
          onChange={(e) => onResearchModeChange(e.target.checked)}
          className="rounded border-[var(--forge-edge)] accent-[var(--forge-molt)]"
        />
        Research Mode
        {researchMode && (
          <span className="rounded-sm border border-[color-mix(in_oklab,var(--forge-molt)_35%,transparent)] bg-[color-mix(in_oklab,var(--forge-molt)_12%,transparent)] px-2 py-0.5 normal-case tracking-normal text-[var(--forge-molt)]">
            Docs injected before codegen
          </span>
        )}
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
        className="rounded-lg border border-dashed border-[color-mix(in_oklab,var(--forge-edge)_70%,transparent)] bg-[color-mix(in_oklab,var(--forge-panel)_40%,black)] px-3 py-2 text-left text-[11px] text-[var(--forge-muted)] transition hover:border-[color-mix(in_oklab,var(--forge-molt)_45%,transparent)] hover:text-[var(--forge-fg)] disabled:opacity-40"
      >
        {attachment ? "Replace design screenshot…" : "+ Optional: screenshot for vision (VLM)"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      {attachment && (
        <div className="flex items-center gap-2 rounded-lg bg-black/40 p-2 ring-1 ring-[color-mix(in_oklab,var(--forge-molt)_22%,transparent)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview */}
          <img src={attachment.preview} alt="" className="h-12 w-16 rounded object-cover" />
          <span className="flex-1 text-[11px] text-[var(--forge-muted)]">Attached — sent with next prompt</span>
          <button
            type="button"
            className="text-[11px] text-[var(--forge-molt)] hover:underline"
            onClick={() => setAttachment(null)}
          >
            Remove
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={disabled}
          placeholder={
            researchMode
              ? "Describe what to build — current docs load first."
              : "Describe what to build…"
          }
          rows={3}
          className="forge-textarea flex-1 resize-none rounded-xl border border-[color-mix(in_oklab,var(--forge-edge)_80%,transparent)] bg-[color-mix(in_oklab,var(--forge-panel)_55%,black)] px-3 py-2.5 text-sm text-[var(--forge-fg)] placeholder:text-[color-mix(in_oklab,var(--forge-muted)_65%,transparent)] focus:border-[color-mix(in_oklab,var(--forge-molt)_55%,transparent)] focus:outline-none disabled:opacity-50"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={disabled || !prompt.trim()}
          className="self-end rounded-xl bg-[var(--forge-molt)] px-5 py-2.5 text-sm font-semibold text-black shadow-[0_0_24px_-6px_var(--forge-molt)] transition hover:bg-[color-mix(in_oklab,var(--forge-molt)_88%,white)] disabled:opacity-35"
        >
          Forge
        </button>
      </div>
    </form>
  );
}
