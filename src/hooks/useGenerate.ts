"use client";

import { useCallback, useState } from "react";
import type {
  ChatMessage,
  ForgeSSEEvent,
  GenerationRequest,
  ImageHint,
  ProjectFile,
  ResearchSource,
} from "@/lib/types";

export type GenerateHandlers = {
  onFileUpdate: (file: ProjectFile) => void;
  onChatMessage: (msg: Partial<ChatMessage>) => void;
  onSearchResult?: (result: ResearchSource) => void;
  /** Swap <!-- IMAGE:...--> for real URL after /api/image */
  onImageResolved?: (hint: ImageHint, imageUrl: string) => void;
  /** Called with partial file contents while the editor streams generated code */
  onFileStreamUpdate?: (file: ProjectFile) => void;
  /** Called once when the agent finishes, with the list of changed file names */
  onDone?: (filesChanged: string[]) => void;
};

export function useGenerate() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (request: GenerationRequest, handlers: GenerateHandlers) => {
    const {
      onFileUpdate,
      onChatMessage,
      onSearchResult,
      onImageResolved,
      onFileStreamUpdate,
      onDone,
    } = handlers;

    setIsGenerating(true);
    const searchedQueries: string[] = [];
    const sourcesByQuery = new Map<string, string[]>();
    const streamBuffers = new Map<string, ProjectFile>();

    try {
      const ac = new AbortController();
      const timeoutMs = 1_500_000; // 25 min: matches 12 server turns × 120s plus buffer.
      const tid = setTimeout(() => ac.abort(), timeoutMs);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: ac.signal,
      });

      clearTimeout(tid);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6)) as ForgeSSEEvent;
              handleEvent(event, {
                onFileUpdate,
                onChatMessage,
                onSearchResult,
                onImageResolved,
                onFileStreamUpdate,
                onDone,
                searchedQueries,
                sourcesByQuery,
                streamBuffers,
              });
            } catch {
              /* partial JSON */
            }
          }
        }
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      onChatMessage({
        role: "system",
        content: aborted
          ? "Timed out waiting for MiniMax (25 min). Try again or shorten the prompt."
          : `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generate, isGenerating };
}

function handleEvent(
  event: ForgeSSEEvent,
  ctx: {
    onFileUpdate: (f: ProjectFile) => void;
    onChatMessage: (m: Partial<ChatMessage>) => void;
    onSearchResult?: (r: ResearchSource) => void;
    onImageResolved?: (hint: ImageHint, url: string) => void;
    onFileStreamUpdate?: (f: ProjectFile) => void;
    onDone?: (filesChanged: string[]) => void;
    searchedQueries: string[];
    sourcesByQuery: Map<string, string[]>;
    streamBuffers: Map<string, ProjectFile>;
  }
) {
  const {
    onFileUpdate,
    onChatMessage,
    onSearchResult,
    onImageResolved,
    onFileStreamUpdate,
    onDone,
    searchedQueries,
    sourcesByQuery,
    streamBuffers,
  } = ctx;

  switch (event.type) {
    case "search_start":
      onChatMessage({ content: `Searching: ${event.query}…`, role: "system" });
      break;
    case "search_result":
      onSearchResult?.(event);
      {
        const urls = sourcesByQuery.get(event.query) ?? [];
        urls.push(event.url);
        sourcesByQuery.set(event.query, urls);
      }
      break;
    case "search_done":
      searchedQueries.push(event.query);
      break;
    case "research_ready":
      onChatMessage({
        content: "Research complete — review docs, then generate.",
        role: "system",
      });
      break;
    case "generating":
      onChatMessage({ content: event.message, role: "system" });
      break;
    case "harness_phase":
      // Observability-only for now; avoid chat spam until a debug UI exists.
      break;
    case "file_stream_start":
      streamBuffers.set(event.file.name, event.file);
      onFileStreamUpdate?.(event.file);
      break;
    case "file_stream_chunk": {
      const prev = streamBuffers.get(event.fileName);
      if (!prev) break;
      const next = { ...prev, content: `${prev.content}${event.chunk}` };
      streamBuffers.set(event.fileName, next);
      onFileStreamUpdate?.(next);
      break;
    }
    case "file_stream_done":
      streamBuffers.delete(event.file.name);
      onFileStreamUpdate?.(event.file);
      break;
    case "file_update":
      onFileUpdate(event.file);
      break;
    case "image_hint":
      void resolveImageHint(event.hint, onImageResolved, onChatMessage);
      break;
    case "done":
      onChatMessage({
        content: `Done — ${event.summary}`,
        role: "assistant",
        meta: {
          searchQueries: searchedQueries,
          filesChanged: event.filesChanged,
          sources: searchedQueries.map((q) => ({
            query: q,
            urls: sourcesByQuery.get(q) ?? [],
          })),
        },
      });
      onDone?.(event.filesChanged ?? []);
      break;
    case "error":
      onChatMessage({ content: `Error: ${event.message}`, role: "system" });
      break;
    // ── Agent loop events ────────────────────────────────────────────────
    case "tool_call_start": {
      const label = formatToolCallLabel(event.toolName, event.args);
      onChatMessage({ content: label, role: "system" });
      break;
    }
    case "tool_call_result":
      onChatMessage({
        content: event.ok ? `  ✓ ${event.summary}` : `  ✗ ${event.summary}`,
        role: "system",
      });
      break;
    case "agent_thinking":
      // Silently swallowed for now — Phase B will add a collapsible drawer
      break;
  }
}

function formatToolCallLabel(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "list_files":
      return "→ list_files()";
    case "read_file":
      return `→ read_file(${String(args.path ?? "")})`;
    case "edit_file":
      return `→ edit_file(${String(args.path ?? "")})`;
    case "replace_strings":
      return `→ replace_strings(${String(args.path ?? "")})`;
    case "create_file":
      return `→ create_file(${String(args.path ?? "")})`;
    case "search_web":
      return `→ search_web("${String(args.query ?? "").slice(0, 60)}")`;
    default:
      return `→ ${toolName}()`;
  }
}

async function resolveImageHint(
  hint: ImageHint,
  onImageResolved?: (hint: ImageHint, url: string) => void,
  onChatMessage?: (m: Partial<ChatMessage>) => void
) {
  try {
    onChatMessage?.({
      role: "system",
      content: `Generating image: ${hint.description}…`,
    });
    const res = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: hint.description }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || data.error) {
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    if (data.url) {
      onImageResolved?.(hint, data.url);
      onChatMessage?.({
        role: "system",
        content: `Image ready — inlined into ${hint.targetFile}`,
      });
    }
  } catch (e) {
    onChatMessage?.({
      role: "system",
      content: `Image generation failed: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}
