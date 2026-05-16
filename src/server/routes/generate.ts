import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { ForgeSSEEvent, GenerationRequest } from "@/lib/types";
import { hasMiniMaxKey } from "@/server/minimax/client";
import { runAgentLoop } from "@/server/minimax/agentLoop";
import { mockGenerateStream } from "@/server/minimax/mock";
import { ProjectFileStore, extractImageHints } from "@/server/minimax/tools";
import { analyzeDesign } from "@/server/minimax/vlm";

export const generateRoutes = new Hono();

generateRoutes.post("/", async (c) => {
  const body = await c.req.json<GenerationRequest>();

  // ── Demo mode: no API key ────────────────────────────────────────────────
  if (!hasMiniMaxKey()) {
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
    return streamSSE(c, async (stream) => {
      for await (const event of mockGenerateStream(body)) {
        await stream.writeSSE({ data: JSON.stringify(event) });
      }
    });
  }

  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");

  const { prompt, currentFiles, mode, uploadedImageBase64, uploadedImageMime } = body;

  return streamSSE(c, async (stream) => {
    const emit = async (event: ForgeSSEEvent) => {
      await stream.writeSSE({ data: JSON.stringify(event) });
    };

    try {
      const agentMode = mode === "create" || currentFiles.length === 0 ? "create" : "edit";
      await emit({ type: "generating", message: agentMode === "edit" ? "Agent reading existing files…" : "Agent building from scratch…" });

      // ── Optional: VLM screenshot analysis ──────────────────────────────
      let imageAnalysis: string | undefined;
      if (uploadedImageBase64 && uploadedImageMime) {
        await emit({ type: "generating", message: "Reading your design screenshot…" });
        try {
          const rawBuf = Buffer.from(uploadedImageBase64, "base64");
          const slice = rawBuf.buffer.slice(
            rawBuf.byteOffset,
            rawBuf.byteOffset + rawBuf.byteLength
          );
          imageAnalysis = await analyzeDesign(slice, uploadedImageMime);
        } catch {
          await emit({ type: "generating", message: "Could not read screenshot — continuing without it." });
        }
      }

      // ── Build the user message ──────────────────────────────────────────
      // Give the agent context about the current state, then let it decide
      // how to search, read, and edit.
      const userMessage = [
        imageAnalysis
          ? `Design to recreate (from uploaded screenshot):\n${imageAnalysis}\n\n`
          : "",
        `User request: ${prompt}`,
        agentMode === "edit"
          ? `\n\nEDIT MODE: This is an existing project. Files: ${currentFiles.map((f) => f.name).join(", ")}.` +
            "\nDo NOT use create_file for files that already exist." +
            "\nStrategy: 1) list_files to confirm what exists, 2) read_file to get exact content, 3) edit_file to make surgical changes. Only create_file for brand-new files."
          : "\nCREATE MODE: This is a new project — create index.html, styles.css, and app.js from scratch.",
      ]
        .filter(Boolean)
        .join("");

      // ── Initialise file store ───────────────────────────────────────────
      const store = new ProjectFileStore(agentMode === "create" ? [] : currentFiles);

      // ── Run the agent loop ──────────────────────────────────────────────
      const { summary, filesChanged } = await runAgentLoop({
        userMessage,
        store,
        emit,
        maxTurns: 12,
      });

      // ── Emit image hints for any <!-- IMAGE:... --> found in final files ─
      const imageHints = extractImageHints(store.getAll());
      for (const hint of imageHints) {
        await emit({ type: "image_hint", hint });
      }

      // ── Done ────────────────────────────────────────────────────────────
      await emit({ type: "done", summary, filesChanged });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await emit({ type: "error", message });
    }
  });
});
