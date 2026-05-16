import type { ForgeSSEEvent, ProjectFile } from "@/lib/types";
import { minimaxPost } from "./client";
import { executeTool, FORGE_TOOLS, projectToolFileUpdate, ProjectFileStore } from "./tools";

// ---------------------------------------------------------------------------
// Internal message types — OpenAI-compatible, accepted by MiniMax M2.7
// ---------------------------------------------------------------------------

type ToolCallRef = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type ConvMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCallRef[] }
  | { role: "tool"; tool_call_id: string; content: string };

type M27Response = {
  choices: Array<{
    message: {
      role: "assistant";
      content: string;
      tool_calls?: ToolCallRef[];
    };
    finish_reason: "stop" | "tool_calls" | "length" | "content_filter";
  }>;
  base_resp: { status_code: number; status_msg: string };
};

type Emit = (event: ForgeSSEEvent) => Promise<void>;

const STREAM_CHUNK_SIZE = 480;
const STREAM_CHUNK_DELAY_MS = 8;

// ---------------------------------------------------------------------------
// System prompt — defines FORGE's coding conventions for the agent
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are FORGE, an expert web developer AI that builds and edits HTML/CSS/JS web apps.
Your project runs in a Sandpack (Parcel) bundler with this file structure:
  - index.html  — root HTML
  - styles.css  — all styles
  - app.js      — all JavaScript

CRITICAL CODING RULES:
1. HTML: ALWAYS include <script src="app.js"></script> before </body> — it is MANDATORY. Do NOT use type="module". Do NOT include <link> for styles.css (Parcel handles that via JS import).
2. CSS: put ALL styles in styles.css, never inline or in <style> tags.
3. JS: put ALL scripts in app.js. NEVER use optional chaining (?.) or nullish coalescing (??) — Parcel cannot parse them. Use explicit null checks: var el = document.getElementById("x"); if (el) { ... }
4. Images: mark placeholders as <!-- IMAGE:description --> (single-word-or-hyphenated description, no spaces inside) in index.html. Do NOT use placeholder <img src=""> tags.
5. Code must be modern, accessible, and complete — never truncate or write placeholder comments.

TOOL STRATEGY (follow this order):
1. list_files → understand what exists
2. read_file → get exact content before any edit
3. search_web → look up current docs before writing library-specific code
4. replace_strings → preferred for several small exact replacements in one file; atomic, no partial writes
5. edit_file → surgical single replacement (old_string must appear exactly once)
6. create_file → only for brand-new files
7. When ALL changes are done, write a concise one-sentence summary and stop calling tools.

IMPORTANT: edit_file and replace_strings require old_string to match byte-for-byte. If either fails, use read_file again to get exact text.`;

// ---------------------------------------------------------------------------
// Agent loop — runs multi-turn M2.7 with tools until done or maxTurns
// ---------------------------------------------------------------------------

export type AgentLoopResult = {
  summary: string;
  filesChanged: string[];
};

export async function runAgentLoop(params: {
  userMessage: string;
  store: ProjectFileStore;
  emit: Emit;
  /** Hard cap on M2.7 round-trips. Each tool call = 1 round-trip. Default 12. */
  maxTurns?: number;
}): Promise<AgentLoopResult> {
  const { userMessage, store, emit, maxTurns = 12 } = params;

  const messages: ConvMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  const filesChanged = new Set<string>();
  let summary = "Done.";

  for (let turn = 0; turn < maxTurns; turn++) {
    let resp: M27Response;
    try {
      resp = await minimaxPost<M27Response>(
        "/v1/text/chatcompletion_v2",
        {
          model: "MiniMax-M2.7",
          messages,
          tools: FORGE_TOOLS,
          tool_choice: "auto",
          temperature: 1.0,
          max_completion_tokens: 10_240,
        },
        120_000 // 2-minute per-call timeout
      );
    } catch (err) {
      // If we already made file changes, treat this as done rather than an error.
      // M2.7 sometimes drops the final "summary" call after all tools succeed.
      if (filesChanged.size > 0) {
        const changed = Array.from(filesChanged);
        summary = `Updated ${changed.join(", ")}.`;
        break;
      }
      throw err;
    }

    const choice = resp.choices[0];
    if (!choice) throw new Error("M2.7 returned no choices");

    const { message, finish_reason } = choice;

    // Append assistant turn to history (critical for interleaved thinking continuity)
    messages.push({
      role: "assistant",
      content: message.content ?? "",
      tool_calls: message.tool_calls,
    });

    // ── No tool calls → agent is done ────────────────────────────────────────
    if (finish_reason === "stop" || !message.tool_calls?.length) {
      summary = message.content?.trim() || summary;
      break;
    }

    // ── Execute each requested tool call ─────────────────────────────────────
    for (const tc of message.tool_calls!) {
      const toolName = tc.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        // malformed JSON args — leave empty, executor will return error
      }

      // Tell the client what the agent is about to do
      await emit({
        type: "tool_call_start",
        callId: tc.id,
        toolName,
        args,
      });

      const streamedPreview = await streamProjectedToolUpdate(toolName, args, store, emit);

      // Run the tool
      const result = await executeTool(toolName, args, store, emit);

      // If a file changed, stream it to the client immediately
      if (result.fileUpdate) {
        if (!streamedPreview) {
          await streamFileUpdate(result.fileUpdate, emit);
        }
        await emit({ type: "file_update", file: result.fileUpdate });
        filesChanged.add(result.fileUpdate.name);
      }

      // Tell the client what happened
      await emit({
        type: "tool_call_result",
        callId: tc.id,
        ok: result.ok,
        summary: result.ok
          ? result.fileUpdate
            ? `${result.fileUpdate.name} updated`
            : result.content.slice(0, 80)
          : result.content.slice(0, 100),
      });

      // Feed result back to M2.7 for next round
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result.content,
      });
    }
  }

  return { summary, filesChanged: Array.from(filesChanged) };
}

async function streamProjectedToolUpdate(
  toolName: string,
  args: Record<string, unknown>,
  store: ProjectFileStore,
  emit: Emit
): Promise<boolean> {
  switch (toolName) {
    case "create_file":
    case "edit_file":
    case "replace_strings": {
      const preview = projectToolFileUpdate(toolName, args, store);
      if (!preview.ok) return false;
      await streamFileUpdate(preview.file, emit);
      return true;
    }
    default:
      return false;
  }
}

async function streamFileUpdate(file: ProjectFile, emit: Emit): Promise<void> {
  await emit({
    type: "file_stream_start",
    file: { ...file, content: "" },
  });

  for (let i = 0; i < file.content.length; i += STREAM_CHUNK_SIZE) {
    await emit({
      type: "file_stream_chunk",
      fileName: file.name,
      chunk: file.content.slice(i, i + STREAM_CHUNK_SIZE),
    });
    if (i + STREAM_CHUNK_SIZE < file.content.length) {
      await new Promise((resolve) => setTimeout(resolve, STREAM_CHUNK_DELAY_MS));
    }
  }

  await emit({ type: "file_stream_done", file });
}
