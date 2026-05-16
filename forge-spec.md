# FORGE — Full Technical Specification

> **Product:** FORGE — AI web app builder  
> **Tagline:** Searches current docs before writing a single line  
> **Stack:** Next.js 16 · TypeScript · Hono v4 · Monaco Editor · Sandpack · MiniMax APIs  
> **Scope:** 24-hour hackathon build  
> **Date:** 2026-05-16

---

## 1. What FORGE Is (and Isn't)

**Is:** A browser-based web app builder where the **context pipeline is the product**.
Describe what you want → FORGE **streams live doc snippets** into a Research Log →
generates HTML/CSS/JS with **clickable source attribution** → you see it in a
**reactive Sandpack preview** that hot-reloads as files change. Upload a design
screenshot → it codes it. Ask for a hero image → it generates one.

**Is not:** A VS Code clone, a terminal, a package manager, a git client, a
multi-language backend IDE, or an agentic self-correction loop. That's ten years
of engineering. This is not that.

**The one-sentence pitch that wins the demo:**
> "Every other AI builder is a black box. FORGE makes search-before-generate
> visible, auditable, and interactive — then forges code from the docs you just watched it read."

### What makes FORGE unique (the wedge)

Most AI builders hide RAG behind a spinner. FORGE **weaponizes transparency**:

| Enhancement | What judges see | Why it wins |
|---|---|---|
| **Live Research Trace** | Real doc titles, snippets, and URLs stream into a Research Log *before* any code appears | Proves FORGE isn't guessing from stale training data |
| **Source-attributed chat** | Assistant messages show clickable source chips tied to the exact URLs used | One click = audit trail from docs → code |
| **Doc-first toggle** | Optional "Research Mode" frames the pipeline as user-controlled context | Turns hidden RAG into an interactive workflow |

These three enhancements cost ~1.5 hours of UI work, fit the existing SSE architecture,
and do not require new databases, auth, or agentic loops.

---

## 2. Why MiniMax Is the Right Choice

| Capability | MiniMax stat | What it means for FORGE |
|---|---|---|
| M2.7 coding | 78% SWE-Bench Verified | Outperforms Claude Opus 4.6 (55%) on real code tasks |
| M2.7 projects | 55.6% VIBE-Pro | End-to-end full project delivery, not just snippets |
| Context window | 200K tokens | The entire project — all files — fits in one request |
| Web search | Native API | Search before generate is a first-class feature, not a hack |
| VLM | Native API | Screenshot-to-code without a third-party OCR service |
| image-01 | Native API | Asset generation baked into the same key |
| Multi-language | 10+ languages | Python, Go, TypeScript, Rust, Kotlin, Java, JS, PHP, Dart, Ruby |

Everything from one API key. One billing relationship. One platform story.

---

## 3. Architecture

```
Browser
  ├─ ChatPanel           Prompts + ResearchLog (live doc snippets) + SourceChips
  ├─ CodeEditor          Monaco — controlled value, streams in on file_update
  └─ PreviewPanel        Sandpack vanilla bundler — hot-reloads on file changes
        │
        └──► Hono v4 API (mounted in Next.js Route Handler)
                │
                ├─ POST /api/generate     ← flagship route (SSE, linear)
                │    ├─ 1. AnalyzeDesign()     → VLM (optional)
                │    ├─ 2. ExtractQueries()   → M2.7 (small call)
                │    ├─ 3. SearchAndStream()  → web search × N, emits search_result
                │    ├─ 4. [optional] research_ready pause if researchMode
                │    ├─ 5. GenerateCode()     → M2.7 (full call)
                │    └─ 6. Stream file_update + image_hint + done
                │
                ├─ POST /api/analyze      ← VLM screenshot analysis
                ├─ POST /api/image        ← image-01 asset generation
                └─ POST /api/refine       ← modify existing code
                        │
                        └──► MiniMax APIs (api.minimax.io)
                                M2.7, VLM, web search, image-01
```

**Why Sandpack + Monaco (not iframe `srcdoc`):**

- **Monaco** owns the editing UX — VS Code engine, syntax highlighting, controlled
  updates as M2.7 streams `file_update` events.
- **Sandpack** owns the **live reactive runtime** — updating the provider `files` map
  triggers the CodeSandbox bundler to hot-reload the preview without rewriting
  `iframe.srcdoc` on every keystroke. Judges see edits and AI output land instantly.

No Supabase. No database. No auth. Everything in memory + localStorage.
This is the right call for 24h — eliminate all infrastructure that isn't the product.

### Strict scope guards (do not cross)

- No agentic self-correction loops
- No syntax validation or linting pipelines
- No multi-file diffing or git-style history
- No auth, sessions, or cloud storage
- No custom Monaco language servers or complex themes
- Keep SSE **linear**: search → generate → stream files → done
- Trust M2.7's JSON output; handle failures with **1 retry max**
- Use `localStorage` for project persistence only

---

## 4. Tech Stack

```bash
npx create-next-app@latest forge --typescript --tailwind --app --src-dir
npm install hono @hono/node-server zod
npm install @monaco-editor/react              # VS Code editor in browser
npm install @codesandbox/sandpack-react       # Live reactive preview bundler
npm install jszip                              # ZIP export
npm install framer-motion                      # panel transitions
```

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** App Router + TypeScript | Latest App Router; Route Handlers support Web Streams for SSE ([docs](https://github.com/vercel/next.js/blob/v16.2.2/docs/01-app/02-guides/streaming.mdx)) |
| Backend | Hono v4 (mounted in `api/[[...route]]`) | Lightweight, `streamSSE` support; set `Cache-Control: no-store` on SSE responses |
| Editor | `@monaco-editor/react` | VS Code engine; use **controlled** `value` + `onChange` when AI streams updates |
| Preview | `@codesandbox/sandpack-react` + `template="vanilla"` | Hot-reloads preview when `files` prop changes — no full iframe reload |
| Styling | Tailwind CSS | Fast iteration |
| Animation | Framer Motion v11 | Panel transitions |
| Export | JSZip | ZIP download of project files |
| Storage | `localStorage` | Session persistence, no backend needed |

**Explicit non-choice for 24h:** WebContainers, full VS Code OSS embedding, or custom language servers — too heavy.

**Sandpack fallback:** If bundler load fails on judge Wi‑Fi, keep a minimal `buildPreviewDocument()` + iframe `srcdoc` path behind a feature flag (do not build both in parallel unless needed).

---

## 5. Data Structures

```typescript
// src/lib/types.ts

export type ProjectFile = {
  name: string;          // "index.html" | "styles.css" | "app.js"
  content: string;
  language: "html" | "css" | "javascript" | "typescript";
};

export type Project = {
  id: string;
  name: string;
  files: ProjectFile[];
  activeFile: string;
  createdAt: string;
  updatedAt: string;
};

export type ResearchSource = {
  query: string;
  title: string;
  snippet: string;
  url: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  meta?: {
    searchQueries?: string[];       // "Searched: Tailwind v4, React hooks"
    sources?: Array<{ query: string; urls: string[] }>;  // Source chips — URLs from Research Log
    imageGenerated?: boolean;
    filesChanged?: string[];
  };
};

export type GenerationRequest = {
  prompt: string;
  currentFiles: ProjectFile[];      // ALL current files — full 200K context
  uploadedImageBase64?: string;     // VLM screenshot-to-code
  uploadedImageMime?: string;
  mode: "create" | "modify" | "add-feature" | "fix-bug";
  researchMode?: boolean;           // Demo-tier: UX copy only. Stretch: pause after search
  approvedSearchContext?: string;   // Stretch-tier: user-approved context from research_ready gate
};

export type GenerationResponse = {
  files: ProjectFile[];
  summary: string;
  searchQueries: string[];          // What was searched
  imageHints: ImageHint[];          // Images M2.7 flagged to generate
};

export type ImageHint = {
  placeholder: string;   // "<!-- IMAGE:hero mountain sunrise -->"
  description: string;   // "hero mountain sunrise"
  targetFile: string;    // "index.html"
};

// SSE event types streamed from /api/generate (linear pipeline only)
export type ForgeSSEEvent =
  | { type: "search_start";   query: string }
  | { type: "search_result";  query: string; title: string; snippet: string; url: string }
  | { type: "search_done";    query: string; resultCount: number }
  | { type: "research_ready"; queries: string[]; searchContext: string }  // Stretch-tier only
  | { type: "generating";     message: string }
  | { type: "file_update";    file: ProjectFile }
  | { type: "image_hint";     hint: ImageHint }
  | { type: "done";           summary: string; filesChanged: string[] }
  | { type: "error";          message: string };
```

---

## 6. MiniMax API Integration

### 6.1 Base client

```typescript
// src/server/minimax/client.ts

const BASE = "https://api.minimax.io";

export class MiniMaxError extends Error {
  constructor(public code: number, public msg: string) {
    super(`MiniMax ${code}: ${msg}`);
  }
}

export async function minimaxPost<T>(
  path: string,
  body: unknown,
  timeoutMs = 30_000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.MINIMAX_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json() as T & {
      base_resp?: { status_code: number; status_msg: string };
    };
    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new MiniMaxError(data.base_resp.status_code, data.base_resp.status_msg);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}
```

### 6.2 Step 1 — Extract search queries from prompt

```typescript
// src/server/minimax/extractQueries.ts
// Small M2.7 call — just identifies what to search for.
// max_tokens: 256 because we only need a short JSON array.

export async function extractSearchQueries(prompt: string): Promise<string[]> {
  const resp = await minimaxPost<M27Response>("/v1/text/chatcompletion_v2", {
    model: "MiniMax-M2.7",
    messages: [
      {
        role: "user",
        content: `A developer wants to build this: "${prompt}"

List the specific libraries, frameworks, or APIs that need current documentation.
Return ONLY a JSON array of short search queries (max 3), e.g.:
["Tailwind CSS v4 utility classes", "Stripe.js checkout", "React useState hook"]

If no specific libraries are mentioned, return: ["vanilla HTML CSS JS best practices 2026"]
Return ONLY the JSON array, nothing else.`,
      },
    ],
    temperature: 1.0,
    max_tokens: 256,  // We only need a short array
  });

  const raw = resp.choices[0].message.content.trim();
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as string[];
  } catch {
    // Fallback: one generic search
    return [`${prompt.slice(0, 60)} web development 2026`];
  }
}
```

### 6.3 Step 2 — Web search for current docs (streaming-friendly)

```typescript
// src/server/minimax/search.ts
// GOTCHA: field is "q" not "query"
// Emits search_result SSE events so the Research Log shows real snippets

export async function searchAndStreamDocs(
  query: string,
  emit: (event: ForgeSSEEvent) => Promise<void>
): Promise<string> {
  const resp = await minimaxPost<{
    organic: Array<{ title: string; snippet: string; link: string }>;
    base_resp: BaseResp;
  }>("/v1/coding_plan/search", { q: query });

  let context = "";
  for (const r of resp.organic.slice(0, 3)) {
    await emit({
      type: "search_result",
      query,
      title: r.title,
      snippet: r.snippet,
      url: r.link,
    });
    context += `[${r.title}]\n${r.snippet}\n\n`;
  }
  return context.slice(0, 800); // Cap per query to control token size
}

export async function buildSearchContext(queries: string[]): Promise<string> {
  // Legacy batch helper — prefer searchAndStreamDocs in generate route
  const results = await Promise.all(
    queries.map(async (q) => {
      const resp = await minimaxPost<{ organic: Array<{ title: string; snippet: string }> }>(
        "/v1/coding_plan/search",
        { q }
      );
      return resp.organic.slice(0, 3).map(r => `[${r.title}]\n${r.snippet}`).join("\n\n").slice(0, 800);
    })
  );
  return `=== Current documentation (searched ${new Date().toISOString().slice(0, 10)}) ===\n\n` +
    queries.map((q, i) => `--- ${q} ---\n${results[i]}`).join("\n\n");
}
```

### 6.4 Step 3 — Main code generation

```typescript
// src/server/minimax/generate.ts
// This is the flagship call. 200K context holds the entire project.

const SYSTEM_PROMPT = `You are FORGE, an expert web developer AI that generates complete,
working web applications from descriptions and existing code.

CRITICAL RULES:
1. ALWAYS return valid JSON matching the exact schema below — no exceptions
2. Generate COMPLETE file contents, never partial snippets or diffs
3. Use modern, accessible, production-quality code
4. Include all CSS in styles.css, all JS in app.js, root HTML in index.html
5. For React: use CDN imports (no npm) — import React from 'https://esm.sh/react@18'
6. Images: mark placeholders as <!-- IMAGE: description --> in HTML
7. Never include placeholder comments like "// add your code here"
8. Never truncate — write the complete implementation

RESPONSE FORMAT — return ONLY this JSON, nothing before or after:
{
  "files": [
    { "name": "index.html", "content": "complete HTML content" },
    { "name": "styles.css", "content": "complete CSS content" },
    { "name": "app.js", "content": "complete JS content" }
  ],
  "summary": "One sentence describing what was built or changed",
  "image_hints": [
    { "placeholder": "<!-- IMAGE: hero mountain sunrise -->", "description": "hero mountain sunrise", "targetFile": "index.html" }
  ]
}
Only include image_hints when the HTML contains <!-- IMAGE: ... --> markers.`;

export async function generateCode(
  prompt: string,
  currentFiles: ProjectFile[],
  searchContext: string,
  imageAnalysis?: string
): Promise<GenerationResponse> {
  const filesContext = currentFiles.length > 0
    ? `=== Current project files ===\n\n` +
      currentFiles.map(f => `--- ${f.name} ---\n${f.content}`).join("\n\n")
    : "No existing files. Create a new project from scratch.";

  const imageContext = imageAnalysis
    ? `=== Uploaded design (analyzed by vision AI) ===\n${imageAnalysis}\n\nRecreate this design in code.`
    : "";

  const userMessage = [
    searchContext,
    imageContext,
    filesContext,
    `=== User request ===\n${prompt}`,
  ].filter(Boolean).join("\n\n");

  const resp = await minimaxPost<M27Response>("/v1/text/chatcompletion_v2", {
    model: "MiniMax-M2.7",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 1.0,
    max_tokens: 8192,  // Large — we need complete files
  }, 60_000);  // 60s timeout — big codebases take time

  const raw = resp.choices[0].message.content;
  const clean = raw.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(clean) as {
      files: ProjectFile[];
      summary: string;
      image_hints?: ImageHint[];
    };
    return {
      files: parsed.files,
      summary: parsed.summary,
      searchQueries: [],  // Filled in by caller
      imageHints: parsed.image_hints ?? [],
    };
  } catch (err) {
    // JSON parse failed — try to extract manually
    throw new Error(`Generation returned invalid JSON: ${raw.slice(0, 200)}`);
  }
}
```

### 6.5 VLM — Screenshot to code

```typescript
// src/server/minimax/vlm.ts
// GOTCHA: image_url MUST be base64 data URI. Plain HTTPS returns error 2013.

export async function analyzeDesign(
  imageBuffer: ArrayBuffer,
  mimeType: string
): Promise<string> {
  const b64 = Buffer.from(imageBuffer).toString("base64");
  const dataUri = `data:${mimeType};base64,${b64}`;

  const resp = await minimaxPost<{ content: string; base_resp: BaseResp }>(
    "/v1/coding_plan/vlm",
    {
      prompt: `You are analyzing a UI design screenshot for a developer who will code it.

Describe in precise detail:
1. LAYOUT: The overall structure — header, hero, sections, sidebar, footer. Column counts, grid patterns.
2. COLORS: Background colors (give hex if visible), text colors, button colors, accent colors.
3. TYPOGRAPHY: Heading sizes (approximate), body text size, font weight (bold/regular), font family style (serif/sans).
4. COMPONENTS: Every UI element — buttons (shape, size, color), input fields, cards, nav items, icons.
5. SPACING: Generous or tight? Padding on sections, gaps between elements.
6. INTERACTIONS: Any hover states, animations, or interactive elements visible.
7. CONTENT: Actual text visible (headlines, labels, placeholder text).

Be extremely specific. The developer will use this description alone to recreate the design.`,
      image_url: dataUri,
    },
    15_000
  );

  return resp.content;
}
```

### 6.6 image-01 — Asset generation

```typescript
// src/server/minimax/image.ts
// GOTCHA: metadata.success_count is a STRING — parseInt() required
// GOTCHA: URLs expire in 24h — for demo this is fine; production should proxy

export async function generateAsset(description: string): Promise<string> {
  const resp = await minimaxPost<ImageResponse>("/v1/image_generation", {
    model: "image-01",
    prompt: `${description}. Professional quality, suitable for a modern website.
Clean composition, good lighting. Photorealistic or high-quality illustration style.`,
    aspect_ratio: "16:9",
    response_format: "url",
    n: 1,
  }, 90_000);

  if (parseInt(resp.metadata.success_count, 10) < 1) {
    throw new Error("Image generation produced no output");
  }

  return resp.data.image_urls[0];
  // Returns direct URL — valid for 24h
  // For production: fetch → upload to own storage → return stable URL
}
```

---

## 7. The Generate Route (Flagship SSE Endpoint)

```typescript
// src/server/routes/generate.ts
// This is the entire pipeline: extract → search → generate → stream events
// Uses Hono's streamSSE to push events to the client as each step completes

import { streamSSE } from "hono/streaming";
import { extractSearchQueries } from "../minimax/extractQueries";
import { searchAndStreamDocs } from "../minimax/search";
import { analyzeDesign } from "../minimax/vlm";
import { generateCode } from "../minimax/generate";
import type { GenerationRequest, ForgeSSEEvent } from "../../lib/types";

app.post("/generate", async (c) => {
  const body = await c.req.json() as GenerationRequest;
  const {
    prompt,
    currentFiles,
    uploadedImageBase64,
    uploadedImageMime,
    researchMode,
    approvedSearchContext,
  } = body;

  return streamSSE(c, async (stream) => {
    const emit = async (event: ForgeSSEEvent) => {
      await stream.writeSSE({ data: JSON.stringify(event) });
    };

    try {
      // ─────────────────────────────────────────────────────────────
      // STEP 1: Analyze uploaded screenshot (if any)
      // ─────────────────────────────────────────────────────────────
      let imageAnalysis: string | undefined;
      if (uploadedImageBase64 && uploadedImageMime) {
        await emit({ type: "generating", message: "Reading your design..." });
        const buffer = Buffer.from(uploadedImageBase64, "base64").buffer;
        imageAnalysis = await analyzeDesign(buffer, uploadedImageMime);
      }

      // ─────────────────────────────────────────────────────────────
      // STEP 2: Extract what to search for
      // ─────────────────────────────────────────────────────────────
      const fullPrompt = imageAnalysis
        ? `${prompt}\n\nDesign to recreate:\n${imageAnalysis}`
        : prompt;

      const queries = await extractSearchQueries(fullPrompt);

      // ─────────────────────────────────────────────────────────────
      // STEP 3: Search current docs — THE FLAGSHIP FEATURE (streams snippets)
      // ─────────────────────────────────────────────────────────────
      let searchContext = approvedSearchContext ?? "";
      if (!approvedSearchContext) {
        for (const query of queries) {
          await emit({ type: "search_start", query });
          try {
            const result = await searchAndStreamDocs(query, emit);
            searchContext += `--- ${query} ---\n${result}\n\n`;
            await emit({ type: "search_done", query, resultCount: 3 });
          } catch {
            await emit({ type: "search_done", query, resultCount: 0 });
          }
        }
        searchContext =
          `=== Current documentation (searched ${new Date().toISOString().slice(0, 10)}) ===\n\n` +
          searchContext;
      }

      // Stretch-tier: pause after search for user approval (researchMode + no approved context)
      if (researchMode && !approvedSearchContext) {
        await emit({ type: "research_ready", queries, searchContext });
        return; // Client shows "Review Context → Generate"; resends with approvedSearchContext
      }

      // ─────────────────────────────────────────────────────────────
      // STEP 4: Generate code
      // ─────────────────────────────────────────────────────────────
      await emit({ type: "generating", message: "Writing your app..." });

      const result = await generateCode(
        prompt,
        currentFiles,
        searchContext,
        imageAnalysis
      );
      result.searchQueries = queries;

      // ─────────────────────────────────────────────────────────────
      // STEP 5: Stream generated files back
      // ─────────────────────────────────────────────────────────────
      for (const file of result.files) {
        await emit({ type: "file_update", file });
      }

      // ─────────────────────────────────────────────────────────────
      // STEP 6: Generate images for any <!-- IMAGE: ... --> hints
      // ─────────────────────────────────────────────────────────────
      for (const hint of result.imageHints) {
        await emit({ type: "image_hint", hint });
        // Client handles image generation separately via /api/image
        // (keeps this route from timing out on long image gen)
      }

      // ─────────────────────────────────────────────────────────────
      // DONE
      // ─────────────────────────────────────────────────────────────
      await emit({
        type: "done",
        summary: result.summary,
        filesChanged: result.files.map(f => f.name),
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await emit({ type: "error", message });
    }
  });
});
```

---

## 8. Live Reactive Preview — Sandpack

Sandpack maps `ProjectFile[]` to a `files` object. Updating the prop hot-reloads the
preview without rewriting `iframe.srcdoc` on every keystroke.

**Validate file paths in Phase 1** via Context7 (`/codesandbox/sandpack`) — vanilla
template keys are typically `/index.html`, `/styles.css`, `/index.js` (leading slash).

```typescript
// src/lib/preview/toSandpackFiles.ts
import type { SandpackFiles } from "@codesandbox/sandpack-react";
import type { ProjectFile } from "@/lib/types";

const PATH_MAP: Record<string, string> = {
  "index.html": "/index.html",
  "styles.css": "/styles.css",
  "app.js": "/index.js",
  "app.ts": "/index.ts",
};

export function toSandpackFiles(files: ProjectFile[]): SandpackFiles {
  const out: SandpackFiles = {};
  for (const f of files) {
    const path = PATH_MAP[f.name] ?? `/${f.name}`;
    out[path] = { code: f.content, active: f.name === "index.html" };
  }
  return out;
}
```

```tsx
// src/components/preview/PreviewPanel.tsx
// Sandpack preview-only — Monaco owns editing in the center panel

"use client";
import { useMemo } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
} from "@codesandbox/sandpack-react";
import type { ProjectFile } from "@/lib/types";
import { toSandpackFiles } from "@/lib/preview/toSandpackFiles";

export function PreviewPanel({ files }: { files: ProjectFile[] }) {
  const sandpackFiles = useMemo(() => toSandpackFiles(files), [files]);

  return (
    <SandpackProvider
      template="vanilla"
      theme="dark"
      files={sandpackFiles}
      options={{ autorun: true, recompileMode: "immediate" }}
    >
      <SandpackLayout style={{ border: "none", height: "100%" }}>
        <SandpackPreview
          showOpenInCodeSandbox={false}
          showRefreshButton
          style={{ height: "100%" }}
        />
      </SandpackLayout>
    </SandpackProvider>
  );
}
```

```typescript
// src/lib/preview/buildDocument.ts — FALLBACK ONLY (iframe srcdoc)
// Keep for Wi‑Fi failure fallback; do not use as primary preview path.

export function buildPreviewDocument(files: ProjectFile[]): string {
  // ... same inject CSS/JS into index.html logic as before
}
```

---

## 9. Monaco Editor Integration

Use **controlled mode** (`value` + `onChange`) so `file_update` SSE events and manual
edits stay in sync with React state and Sandpack. Switch to uncontrolled (`defaultValue`
only) only if profiling shows rerender pressure during long generations.

```tsx
// src/components/editor/CodeEditor.tsx
// Monaco is the exact VS Code editor running in the browser.
// @monaco-editor/react lazy-loads WASM; show loading spinner until onMount.

"use client";
import Editor from "@monaco-editor/react";
import type { ProjectFile } from "@/lib/types";

type Props = {
  file: ProjectFile;
  onChange: (content: string) => void;
  isGenerating: boolean;
};

export function CodeEditor({ file, onChange, isGenerating }: Props) {
  return (
    <div className="relative h-full">
      {isGenerating && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-10
                        flex items-center justify-center pointer-events-none">
          <span className="text-sm text-muted-foreground animate-pulse">
            FORGE is building...
          </span>
        </div>
      )}
      <Editor
        height="100%"
        language={file.language}
        value={file.content}
        onChange={(value) => onChange(value ?? "")}
        theme="vs-dark"
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          padding: { top: 16 },
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      />
    </div>
  );
}
```

---

## 10. Client-Side Generation Hook

```typescript
// src/hooks/useGenerate.ts
// Handles the SSE stream from /api/generate.
// Updates files as each file_update event arrives.
// Shows search progress in chat.

import { useState, useCallback } from "react";
import type {
  ProjectFile, ChatMessage, ForgeSSEEvent, GenerationRequest, ResearchSource
} from "@/lib/types";

export function useGenerate() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (
    request: GenerationRequest,
    onFileUpdate: (file: ProjectFile) => void,
    onChatMessage: (msg: Partial<ChatMessage>) => void,
    onSearchResult?: (result: ResearchSource) => void
  ) => {
    setIsGenerating(true);
    const searchedQueries: string[] = [];
    const sourcesByQuery = new Map<string, string[]>();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        // SSE lines: "data: {...}\n\n"
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as ForgeSSEEvent;
            handleEvent(event, onFileUpdate, onChatMessage, searchedQueries, sourcesByQuery, onSearchResult);
          } catch {
            // Partial SSE line — ignore
          }
        }
      }
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generate, isGenerating };
}

function handleEvent(
  event: ForgeSSEEvent,
  onFileUpdate: (f: ProjectFile) => void,
  onChatMessage: (m: Partial<ChatMessage>) => void,
  searchedQueries: string[],
  sourcesByQuery: Map<string, string[]>,
  onSearchResult?: (r: ResearchSource) => void
) {
  switch (event.type) {
    case "search_start":
      onChatMessage({ content: `Searching: ${event.query}…`, role: "system" });
      break;
    case "search_result":
      onSearchResult?.(event);
      const urls = sourcesByQuery.get(event.query) ?? [];
      urls.push(event.url);
      sourcesByQuery.set(event.query, urls);
      break;
    case "search_done":
      searchedQueries.push(event.query);
      break;
    case "research_ready":
      // Stretch-tier: parent shows Review Context UI; user resends with approvedSearchContext
      onChatMessage({ content: "Research complete — review docs, then generate.", role: "system" });
      break;
    case "generating":
      onChatMessage({ content: event.message, role: "system" });
      break;
    case "file_update":
      onFileUpdate(event.file);  // Monaco + Sandpack update from shared project state
      break;
    case "image_hint":
      generateImage(event.hint.description, event.hint).catch(console.error);
      break;
    case "done":
      onChatMessage({
        content: `✅ ${event.summary}`,
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
      break;
    case "error":
      onChatMessage({ content: `Error: ${event.message}`, role: "system" });
      break;
  }
}

async function generateImage(description: string, hint: ImageHint) {
  // Called automatically when M2.7 flags <!-- IMAGE: ... --> in generated code
  const res = await fetch("/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  const { url } = await res.json();
  // Replace placeholder in current HTML with actual image URL
  // This is handled by the parent component via a callback
}
```

### 10.1 Transparency UI components

```tsx
// src/components/chat/ResearchLog.tsx
// Appends cards on search_result SSE events; persists after generation

export function ResearchLog({ entries }: { entries: ResearchSource[] }) {
  if (!entries.length) return null;
  return (
    <motion.div className="space-y-2 border-l-2 border-orange-500/30 pl-3">
      <p className="text-xs font-medium text-orange-400 uppercase tracking-wide">
        Research Log
      </p>
      {entries.map((e, i) => (
        <div key={i} className="rounded-md bg-zinc-900/80 p-2 text-xs">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-zinc-200 line-clamp-1">{e.title}</span>
            <a href={e.url} target="_blank" rel="noopener noreferrer"
               className="shrink-0 text-orange-400 hover:text-orange-300">↗</a>
          </div>
          <p className="mt-1 text-zinc-400 line-clamp-2">{e.snippet}</p>
          <p className="mt-1 text-zinc-600">Query: {e.query}</p>
        </div>
      ))}
    </motion.div>
  );
}
```

```tsx
// src/components/chat/SourceChips.tsx
// Render below assistant messages — clickable proof of doc attribution

export function SourceChips({
  sources,
}: {
  sources: Array<{ query: string; urls: string[] }>;
}) {
  if (!sources.length) return null;
  const links = sources.flatMap((s) =>
    s.urls.slice(0, 2).map((url) => ({ url, query: s.query }))
  );
  if (!links.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {links.map(({ url }, i) => (
        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full
                      bg-orange-500/10 text-orange-400 border border-orange-500/20
                      hover:bg-orange-500/20 transition">
          📖 {new URL(url).hostname.replace("www.", "")}
        </a>
      ))}
    </div>
  );
}
```

**Doc-first toggle (demo-tier, ~0 backend):**

- Add `researchMode` to `GenerationRequest` and a toggle beside the prompt input.
- When enabled: change placeholder to *"Describe what to build. I'll search current docs first."*
  and show a subtle badge: `🔍 Docs will be injected`.
- Stretch-tier: wire toggle to `research_ready` pause + "Review Context → Generate" button.

---

## 11. Image Generation Route

```typescript
// src/server/routes/image.ts

app.post("/image", async (c) => {
  const { description } = await c.req.json() as { description: string };

  const url = await generateAsset(description);
  return c.json({ url });
});
```

**Auto-replacement in HTML:**
When M2.7 generates HTML with `<!-- IMAGE: hero mountain sunrise -->`, the client:
1. Receives `image_hint` SSE event
2. Calls `/api/image` with the description
3. Replaces the comment in `index.html` with `<img src="{url}" alt="hero mountain sunrise">`
4. Preview updates

---

## 12. File Structure

```text
forge/
  src/
    app/
      page.tsx                     Main builder UI (3-panel layout)
      layout.tsx                   Root layout
      globals.css
      api/[[...route]]/
        route.ts                   Hono mount (GET + POST)

    components/
      layout/
        ThreePanelLayout.tsx       ResizablePanels or fixed 3-column
      chat/
        ChatPanel.tsx              Chat sidebar
        MessageList.tsx
        ChatInput.tsx              Prompt + upload + Research Mode toggle
        ResearchLog.tsx            Live doc snippet cards (search_result)
        SourceChips.tsx            Clickable source attribution on assistant msgs
        SearchIndicator.tsx        "Searching Tailwind v4..." animation
        TemplateButtons.tsx        Quick-start prompts
      editor/
        CodeEditor.tsx             Monaco wrapper (controlled)
        FileTabs.tsx               index.html | styles.css | app.js
      preview/
        PreviewPanel.tsx           Sandpack vanilla preview (primary)
        PreviewToolbar.tsx         Device size toggle (Sandpack options)
      upload/
        ImageUpload.tsx            Drag-drop + clipboard paste for VLM

    hooks/
      useProject.ts               Project state (files, active file)
      useGenerate.ts              SSE generation hook
      useChat.ts                  Chat message state

    lib/
      types.ts                    All TypeScript types
      preview/
        toSandpackFiles.ts        ProjectFile[] → Sandpack files map
        buildDocument.ts          iframe srcdoc fallback only
      search/
        formatContext.ts          Search results → context string
      files/
        templates.ts              Default starter templates
        parseGenerated.ts         JSON → ProjectFile[] with validation
      export/
        buildZip.ts               JSZip export of all files

    server/
      index.ts                    Hono app + route registration
      minimax/
        client.ts                 Base fetch + MiniMaxError
        extractQueries.ts         Prompt → search query array
        search.ts                 Web search → formatted context
        generate.ts               M2.7 code generation
        vlm.ts                    Screenshot analysis
        image.ts                  image-01 asset generation
        types.ts                  MiniMax API response types
      routes/
        generate.ts               POST /api/generate (SSE — flagship)
        analyze.ts                POST /api/analyze (VLM only)
        image.ts                  POST /api/image
        refine.ts                 POST /api/refine (modify existing code)
        health.ts                 GET /api/health

  .env.local                      MINIMAX_API_KEY
  package.json
  next.config.ts
  tailwind.config.ts
  tsconfig.json
```

---

## 13. Default Project Templates

```typescript
// src/lib/files/templates.ts
// Available as quick-start buttons in the UI.
// Each maps to a prompt sent through the full search-before-generate pipeline.

export const TEMPLATES = [
  {
    id: "landing",
    label: "Landing page",
    prompt: "Build a modern SaaS landing page with a hero section, 3 feature cards, pricing table with 3 tiers, and a footer. Use Tailwind CSS via CDN.",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    prompt: "Build an admin dashboard with a sidebar navigation, stats cards at the top, a line chart using Chart.js, and a recent activity table.",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    prompt: "Build a minimal personal portfolio with a centered hero, projects grid, skills section, and contact form. Clean, modern typography.",
  },
  {
    id: "ecommerce",
    label: "Product page",
    prompt: "Build an e-commerce product page with image gallery, product details, add to cart button, and reviews section. Modern, conversion-focused design.",
  },
  {
    id: "auth",
    label: "Login / signup",
    prompt: "Build a split-screen auth page with a login form on the right and a testimonial/feature panel on the left. Include social login buttons.",
  },
];
```

---

## 14. Export — ZIP Download

```typescript
// src/lib/export/buildZip.ts

import JSZip from "jszip";
import type { ProjectFile } from "../types";

export async function buildProjectZip(
  files: ProjectFile[],
  projectName: string
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(projectName) ?? zip;

  for (const file of files) {
    folder.file(file.name, file.content);
  }

  // Add a README
  folder.file("README.md", `# ${projectName}\n\nBuilt with FORGE — AI web app builder.\nPowered by MiniMax M2.7.\n\nOpen index.html in your browser to run.`);

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

// In the UI:
async function handleExport(project: Project) {
  const blob = await buildProjectZip(project.files, project.name);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## 15. 24-Hour Build Timeline (Phased)

Six phases aligned to the transparency wedge + Sandpack reactive preview.
Total transparency UI work: ~1.5 hours (fits Phase 3).

| Phase | Hours | Focus | Acceptance check |
|-------|-------|-------|------------------|
| **1 — Reactive shell** | 0–4 | Next 16 scaffold, 3-panel layout, Monaco tabs, Sandpack preview | Typing in Monaco hot-reloads Sandpack without full iframe reload |
| **2 — Linear generate loop** | 4–8 | SSE `/api/generate`, `file_update` → state, JSON parsing | Prompt produces 3 files; preview updates as events arrive |
| **3 — Transparency wedge** | 8–11 | `search_result` SSE, ResearchLog, SourceChips, demo-tier Research toggle | Judges click source chips that match streamed doc URLs |
| **4 — Vision + assets** | 11–15 | VLM screenshot, image-01, `<!-- IMAGE: -->` replacement | Demo moments 2 & 3 work end-to-end |
| **5 — Polish + export** | 15–21 | Chat history, templates, Cmd+Enter, localStorage, ZIP, CodeSandbox | Refine loop + export work |
| **6 — Demo hardening** | 21–24 | Brand, rehearse 90s script, deploy Vercel, edge-case fixes | Stable demo on judge Wi‑Fi |

### Phase 1 — Reactive shell (0–4h)

```
□ npx create-next-app@latest (Next 16) + install deps incl. sandpack-react
□ 3-panel layout (fixed columns)
□ Monaco editor + FileTabs in center panel
□ Sandpack PreviewPanel in right panel (validate /index.html paths via Context7)
□ Chat input in left panel
□ Basic project state (3 files, active file switching)
□ toSandpackFiles() mapper
```

Checkpoint: Edit CSS in Monaco → Sandpack preview updates immediately.

### Phase 2 — Linear generate loop (4–8h)

```
□ POST /api/generate with Hono streamSSE
□ useGenerate hook parses SSE, applies file_update to project state
□ Robust JSON parsing (strip fences, 1 retry on malformed output)
□ Loading overlay on Monaco during generation
□ Modify vs Create mode when files exist
```

Checkpoint: "build hello world" → files appear in editor + Sandpack preview.

### Phase 3 — Transparency wedge (8–11h) — THE DIFFERENTIATOR

```
□ searchAndStreamDocs() + search_result SSE events
□ ResearchLog component (cards with title, snippet, ↗ link)
□ SourceChips on assistant messages (URLs from accumulated search_result)
□ extractSearchQueries + context injection unchanged
□ Demo-tier Research Mode toggle (UX copy + badge only)
□ [Stretch] research_ready pause + approvedSearchContext resend
```

Checkpoint: "Stripe checkout form" → Research Log shows live Stripe docs → source chips match.

### Phase 4 — Vision + assets (11–15h)

```
□ ImageUpload (drag-drop + paste)
□ VLM with base64 data URI (never plain HTTPS URL)
□ POST /api/image + <!-- IMAGE: --> auto-replace
□ Image progress in chat; 90s timeout handling
```

Checkpoint: Screenshot → code; hero image appears in Sandpack preview.

### Phase 5 — Polish + export (15–21h)

```
□ Chat history, 5 template buttons, Cmd+Enter
□ Sandpack device width toggle / refresh
□ localStorage persistence
□ ZIP export + Open in CodeSandbox + copy-all
```

### Phase 6 — Demo hardening (21–24h)

```
□ FORGE brand (dark + orange-500 accent)
□ Rehearse 3 demo moments twice (see §17)
□ Sandpack fallback to iframe srcdoc if bundler fails on Wi‑Fi
□ Deploy Vercel; fix rehearsal breakages
```

---

## 16. UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ FORGE                              [New] [Export ZIP] [Open ↗]  │
├─────────────┬──────────────────────┬───────────────────────────┤
│  Chat       │  [index.html] [css]  │   Live Preview (Sandpack) │
│  ─────────  │  [app.js]            │   ────────────────────    │
│  Messages   │  ────────────────────│   [hot-reloads on edit]   │
│  Research   │   Monaco Editor      │                           │
│  Log        │   (streams on        │   [Desktop] [Mobile]      │
│  (live docs)│    file_update)      │   [Refresh]               │
│  ─────────  │                      │                           │
│  [🔍 Research Mode]               │                           │
│  [prompt   ] [📎] [Send]          │                           │
└─────────────┴──────────────────────┴───────────────────────────┘
```

Dark theme: `#0A0A0A` background, `#1A1A1A` panels, `#F97316` (orange-500) accent.
The orange accent signals "forge" — heat, creation, metal.

---

## 17. The Three Demo Moments

Practice these three specifically. Each takes under 90 seconds total.

**Demo moment 1 — Search before generate (transparency):**
1. Type: `"Build a payment form using Stripe.js"`
2. Point to **Research Log**: live Stripe doc snippets streaming in before any code
3. Wait for generation (~15s)
4. Click **source chips** under the assistant message — same URLs from the Research Log
5. Open code — point to `loadStripe` / `confirmPayment` using current Stripe.js API
6. Say: *"Watch the left panel. FORGE isn't guessing — it pulled live Stripe docs. Click these chips. That's the exact documentation it used 8 seconds ago."*

**Demo moment 2 — Screenshot to code:**
1. Screenshot any website on your screen
2. Drag it into the chat upload area
3. Watch: `"Analyzing your design..."`
4. Code generates matching the screenshot
5. Say: *"No prompt needed. Just show it what you want."*

**Demo moment 3 — Image generation:**
1. Type: `"Add a hero image of a cityscape at night for this landing page"`
2. Watch: code generates + `"Generating hero image..."` → image appears in preview
3. Say: *"Copy, design, and assets — one platform, one API key."*

---

## 18. Quota Budget

| Operation | Per generation | Daily limit | Sessions/day |
|---|---|---|---|
| extractQueries (M2.7) | 1 call | 4,500 / 5hr | > 1,000 |
| Web search | 1–3 calls | 4,500 / 5hr | > 500 |
| generateCode (M2.7) | 1 call | 4,500 / 5hr | > 1,000 |
| analyzeDesign (VLM) | 0–1 calls | 4,500 / 5hr | > 1,000 |
| generateAsset (image-01) | 0–1 calls | 50 / day | 50 |
| **Total per generation** | **4–6 calls** | | |

**The only real limit is image-01 at 50/day.** Everything else is far more than enough.
For the demo: budget ~10 images. Use the rest for the main generation flow.

No TTS. No music. No Supabase. No other billing relationships.

---

## 19. Environment Variables

```bash
# .env.local
MINIMAX_API_KEY=sk-cp-...

# Optional — app config
NEXT_PUBLIC_APP_NAME=FORGE
```

That's it. No Supabase, no auth, no additional services.

---

## 20. Known Risks and Mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| M2.7 returns invalid JSON | Medium | Retry once with stricter prompt: "Return ONLY the JSON object, absolutely nothing else." |
| M2.7 truncates large files | Medium | Set `max_tokens: 8192`. If still truncates, split into smaller generation requests. |
| Search context bloat | Medium | Hard cap at 800 chars/result, max 3 results. Total context budget: 2,400 chars. |
| image-01 times out (>90s) | Low | 90s timeout set. Show "Image taking longer..." message. Offer manual retry. |
| VLM returns 2013 | High if URL used | Always base64 encode. Never pass HTTPS URL directly to VLM. This will definitely bite you if you forget. |
| Sandpack bundler slow on Wi‑Fi | Medium | Lazy-load Sandpack; keep iframe `srcdoc` fallback behind flag |
| Sandpack wrong file paths | Medium | Validate vanilla template keys via Context7 in Phase 1 (`/index.html`, `/index.js`) |
| Monaco WASM loads slowly | Medium | `@monaco-editor/react` lazy-loads. Add spinner until `onMount` fires |
| Controlled Monaco rerenders | Low | Debounce onChange if needed; fall back to uncontrolled for huge files |
| M2.7 writes inline styles | Low | Prompt explicitly says "all CSS in styles.css" — M2.7 follows this well. |
| Generated React imports fail | Medium | Prompt specifies `import React from 'https://esm.sh/react@18'`. Test this early. |

---

## 21. The Pitch Deck Slide

**Slide 1 — The problem:**
> "AI builders generate from training data.
> When you ask for a Stripe integration, they use whatever Stripe syntax
> they learned — months or years ago. It's usually wrong."

**Slide 2 — FORGE:**
> "FORGE searches the actual current docs before writing a single line."

**Slide 3 — Under the hood:**
> "One API key. M2.7 coding (78% SWE-Bench, outperforms Claude Opus 4.6).
> 200K context — your entire project, always. Native web search, vision, image generation."

**Slide 4 — Live demo**
*(The three demo moments above)*

---

## 22. Context7 MCP — Implementation Playbook

Before coding unfamiliar APIs, use the Context7 MCP tools to pull current docs.
Batch queries by milestone (max ~3 calls per session).

### Library IDs (validated 2026-05-16)

| Library | Context7 ID | Use for |
|---------|-------------|---------|
| Next.js 16 | `/vercel/next.js/v16.2.2` | App Router, Route Handlers, Web Streams / SSE headers |
| Monaco React | `/suren-atoyan/monaco-react` | Controlled vs uncontrolled Editor, `onMount`, options |
| Sandpack | `/codesandbox/sandpack` | `SandpackProvider`, `files` prop, vanilla template paths |

### Workflow

1. **`resolve-library-id`** — pass `libraryName` + a task-specific `query`.
2. **`query-docs`** — pass the resolved `libraryId` + a specific question.

### Checkpoints by phase

| Phase | Context7 query (example) |
|-------|--------------------------|
| **1 — Sandpack shell** | `SandpackProvider vanilla template files prop hot reload` |
| **2 — SSE** | `Next.js Route Handler ReadableStream text/event-stream Cache-Control no-store` |
| **3 — Transparency** | *(no new libs — wire existing SSE types)* |
| **4 — Vision** | *(MiniMax docs only — VLM base64 gotcha in §6.5)* |
| **5 — Export** | `JSZip generateAsync blob download` (optional) |

### Example calls

```
resolve-library-id  libraryName: "@codesandbox/sandpack-react"
                    query: "vanilla template files map hot reload preview"

query-docs          libraryId: "/codesandbox/sandpack"
                    query: "SandpackProvider template vanilla files prop paths index.html"

query-docs          libraryId: "/vercel/next.js/v16.2.2"
                    query: "Route Handler POST streaming Response ReadableStream SSE"
```
