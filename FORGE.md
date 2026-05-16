# FORGE — Agent Guide

> **Read this entire file before changing any code.** It is the canonical reference for AI coding agents working on this repository. It supersedes `README.md` and the historical `docs/minimax-api-*.md` files for anything that contradicts.

Last verified: **May 16, 2026**.

---

## 1. What is FORGE

FORGE is an AI web-app builder in the same product category as **Lovable**, **Bolt.new**, and **Vercel v0**. The user types a natural-language prompt, FORGE generates a complete vanilla HTML/CSS/JS project, renders it live in an in-browser Sandpack/Parcel sandbox, and lets the user iterate on it through a chat panel. The differentiator is the model and the loop: **MiniMax M2.7** drives a visible agentic ReAct loop (`list_files → read_file → search_web → edit_file`) rather than a one-shot JSON response, so the user sees the agent's tool calls scroll past as the project is built.

Three things make FORGE distinctive vs. the comparable products:

1. **Visible agent trace.** Every tool call is streamed to the chat as a system message (`→ read_file(index.html)` etc.). The user can see *why* the model made a change, not just what changed.
2. **Search-first.** The agent is instructed and has the tool to call `search_web` (MiniMax's coding-plan web search) before writing library-specific code, then cite sources back to the user via `SourceChips`.
3. **Inline image generation.** When the model writes `<!-- IMAGE:hero sunset --> ` markers in HTML, FORGE post-generates real images via `image-01` and inlines them as **base64 data URIs** (Sandpack's CSP blocks external image hosts).

**Stack**: Next.js 16 (App Router, Node runtime), Hono mounted at `/api/[[...route]]`, Sandpack-React for preview, Monaco for editor, MiniMax M2.7 for codegen, Tailwind v4 + a custom "forge" design system in CSS variables.

---

## 2. Architecture map

```
src/
├── app/
│   ├── layout.tsx                  Root layout, fonts, html/body shell
│   ├── page.tsx                    Mounts <ForgeBuilder/>
│   ├── globals.css                 Design tokens (--forge-bg, --forge-molt, etc.) + grain
│   ├── api/[[...route]]/route.ts   Hono catch-all → runtime: "nodejs"
│   └── dev/minimax/                Dev-only probe playground (gated by NODE_ENV)
│
├── components/
│   ├── layout/ForgeBuilder.tsx     Top-level shell — sidebar / main / mode toggle
│   ├── chat/
│   │   ├── ChatPanel.tsx           Scroll container + dots while generating
│   │   ├── ChatInput.tsx           Prompt textarea + image attach + Research Mode toggle
│   │   ├── MessageList.tsx         Renders user/assistant/system bubbles
│   │   ├── ResearchLog.tsx         Streamed search-result cards
│   │   ├── SourceChips.tsx         Per-message domain chips
│   │   └── TemplateStarters.tsx    First-run prompt suggestions
│   ├── editor/
│   │   ├── CodeEditor.tsx          Dynamic-imported Monaco
│   │   └── FileTabs.tsx            (currently unused — ForgeBuilder inlines tabs)
│   └── preview/PreviewPanel.tsx    SandpackProvider + device-frame toolbar
│
├── server/
│   ├── index.ts                    Hono app: /health /generate /image /dev/minimax
│   └── minimax/
│   │   ├── client.ts               minimaxPost<T>() — base_resp unwrap + AbortController
│   │   ├── agentLoop.ts            The ReAct loop. POSTs to /v1/text/chatcompletion_v2
│   │   ├── tools.ts                FORGE_TOOLS schema + ProjectFileStore + executeTool
│   │   ├── search.ts               POST /v1/coding_plan/search
│   │   ├── vlm.ts                  POST /v1/coding_plan/vlm — design screenshot analysis
│   │   ├── image.ts                POST /v1/image_generation — image-01
│   │   ├── mock.ts                 SSE demo stream when no key
│   │   ├── extractQueries.ts       (DEAD — superseded by in-loop search_web tool)
│   │   └── generate.ts             (DEAD — single-shot JSON, replaced by agentLoop)
│   └── routes/
│       ├── generate.ts             POST /api/generate — SSE entrypoint, calls runAgentLoop
│       ├── image.ts                POST /api/image — fetches and base64-wraps the URL
│       ├── health.ts               GET  /api/health — { mode: "live" | "demo" }
│       ├── codesandbox.ts          (DEAD — not registered; client uses hidden-form POST)
│       └── devMiniMax.ts           Dev probes for chat + search (NODE_ENV=production blocks)
│
├── hooks/
│   ├── useProject.ts               localStorage-backed project state + active file
│   ├── useChat.ts                  In-memory chat messages (no persistence)
│   └── useGenerate.ts              SSE parser → calls back into the page
│
└── lib/
    ├── types.ts                    Project, ChatMessage, ForgeSSEEvent (the SSE union)
    ├── files/defaultProject.ts     Boilerplate index.html / styles.css / app.js
    ├── preview/toSandpackFiles.ts  Normalize app.js → /index.js, strip <link>, inject script
    └── export/
        ├── zipExport.ts            JSZip download
        └── openInCodeSandbox.ts    Hidden-form POST to codesandbox.io/define
```

**Dead code worth deleting in a cleanup PR**: `src/server/minimax/extractQueries.ts`, `src/server/minimax/generate.ts`, `src/server/routes/codesandbox.ts`, `src/components/editor/FileTabs.tsx`. None are imported.

---

## 3. Critical conventions agents MUST follow

These are non-obvious rules. Violating any of them produces a silent failure or a blank preview.

### 3.1 Sandpack / Parcel constraints (apply to *generated* code, enforced via system prompt)

- **No `?.`, no `??`.** Sandpack vanilla runs Parcel 1.x — it cannot parse optional chaining or nullish coalescing. Generated `app.js` must use `var el = document.getElementById("x"); if (el) { ... }`.
- **`<script src="app.js"></script>` is mandatory** before `</body>` in `index.html`. `toSandpackFiles.ts` will inject it as a safety net if missing, but the model should not rely on that.
- **No `<link rel="stylesheet">` for `styles.css`.** Parcel bundles CSS *from the JS entry*. `toSandpackFiles.ts` strips any `<link>` tags and prepends `import "./styles.css";` to `app.js`. If the model emits `<link>`, HMR breaks.
- **No `type="module"`.** Parcel serves a plain bundled script. Adding `type="module"` makes Parcel's auto-injection malfunction.

The system prompt in `agentLoop.ts` enforces these; `toSandpackFiles.ts` is the defensive layer. **Do not relax the system prompt without also updating `toSandpackFiles.ts`.**

### 3.2 MiniMax key and demo mode

- The single env var is **`MINIMAX_API_KEY`** in `.env.local` (`.env.local.example` shows the template).
- Format is `sk-cp-…` for Token Plan Plus keys.
- Without it, `/api/health` returns `mode: "demo"` and `/api/generate` streams a canned response from `src/server/minimax/mock.ts`. The frontend shows an amber `Demo` badge.

### 3.3 Streaming is non-negotiable for `/api/generate`

The route uses `hono/streaming`'s `streamSSE` helper. Every event the server emits is a `ForgeSSEEvent` (typed union in `src/lib/types.ts`). **Do not** add a JSON response variant of this endpoint — the client (`useGenerate.ts`) only knows how to parse `data: <json>\n\n` lines. Required headers: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` (without these, some browsers buffer the whole response and progress feels frozen).

### 3.4 Tool definitions live in **one** place

The OpenAI-compatible tool schema sent to M2.7 is `FORGE_TOOLS` in `src/server/minimax/tools.ts`. The execution dispatcher is `executeTool` in the same file. Adding a tool means:

1. Append a `ToolDefinition` to `FORGE_TOOLS`.
2. Add a `case` to `executeTool`.
3. Add the tool's recommended-use line to the `SYSTEM_PROMPT` in `agentLoop.ts` (under `TOOL STRATEGY`). **If you forget step 3, the model often won't call the new tool at all.**
4. If the tool emits user-visible progress, add an event variant to `ForgeSSEEvent` in `src/lib/types.ts` and a handler in `useGenerate.ts`.

### 3.5 Images: base64 only

`/api/image` (in `src/server/routes/image.ts`) does *not* return the raw MiniMax image URL. It fetches the URL server-side, base64-encodes the bytes, and returns a `data:image/jpeg;base64,…` URI. Sandpack's CSP blocks `https://*.minimax.io` images, so a CDN URL would render as a broken image. The same is true for the demo-mode placeholder fallback. **Never** propose a code path that returns an external image URL to Sandpack.

### 3.6 Edit mode vs Create mode

`generateRoutes` in `src/server/routes/generate.ts` looks at `currentFiles.length` to decide. The user message it builds includes either:

```
EDIT MODE: This is an existing project. Files: index.html, styles.css, app.js. …
```

or:

```
CREATE MODE: This is a new project — create index.html, styles.css, and app.js from scratch.
```

The client (`ForgeBuilder.tsx`) uses a slightly different heuristic: `mode: project.files.some(f => f.content.length > 50) ? "modify" : "create"`. This is a known double-source of truth — if you change the convention, change both. The `mode` field on the request is *currently unused* by the server (server only checks `currentFiles.length`), so it's safe to remove from the type if you do a cleanup.

### 3.7 The reasoning-content rule (MiniMax-specific)

When M2.7 returns an assistant message during a tool loop, the `content` field contains the model's full chain-of-thought wrapped in `<think>…</think>` tags. **These must be preserved verbatim when you append the assistant message back into the next request's `messages` array.** Truncating them breaks Interleaved Thinking and the model starts forgetting why it called the previous tool. See [§5 MiniMax API Reference](#5-minimax-api-reference-verified-may-16-2026) — current `agentLoop.ts` does this correctly by passing `message.content ?? ""` straight through, but if you ever sanitise the content (e.g. strip `<think>` for display), make sure the in-memory copy that goes back to the API still has them.

---

## 4. How the agent loop works

```
┌──────────┐  prompt + files   ┌──────────────────┐
│  Client  │ ────────────────► │ POST /api/generate│
└──────────┘                   └────────┬─────────┘
     ▲                                  │
     │ SSE events                       ▼
     │                         ┌─────────────────────┐
     │                         │  runAgentLoop()     │
     │                         │  src/server/minimax │
     │                         │       /agentLoop.ts │
     │                         └────────┬────────────┘
     │                                  │
     │                                  │ POST /v1/text/chatcompletion_v2
     │                                  │ { model:"MiniMax-M2.7",
     │                                  │   messages, tools, tool_choice:"auto",
     │                                  │   temperature:1.0, max_tokens:8192 }
     │                                  ▼
     │                         ┌─────────────────────┐
     │                         │   MiniMax M2.7      │
     │                         │   (api.minimax.io)  │
     │                         └────────┬────────────┘
     │                                  │  message.tool_calls[]
     │                                  ▼
     │                         ┌─────────────────────┐
     │  tool_call_start ◄──── │   executeTool()      │ ──┐
     │  tool_call_result ◄──── │   (per tool call)   │   │ list_files / read_file
     │  file_update     ◄──── │   ProjectFileStore  │   │ edit_file / create_file
     │  search_result   ◄──── │                     │   │ search_web
     │                         └────────┬────────────┘   ▼
     │                                  │           ┌────────────────────┐
     │                                  │           │  searchAndStream   │
     │                                  │           │  Docs() →          │
     │                                  │           │  /v1/coding_plan/  │
     │                                  │           │  search            │
     │                                  ▼           └────────────────────┘
     │                         ( append tool result to messages )
     │                                  │
     │                                  └──── loop until
     │                                        finish_reason==="stop"
     │                                        || maxTurns(12) reached
     │
     │  image_hint (extractImageHints scan) ──► client kicks /api/image
     │  done { summary, filesChanged }
```

Key invariants:

- **`maxTurns: 12`** is a hard cap. Each tool call is one round-trip. Long edits can exhaust this on complex projects — the loop has a graceful exit: if the model errors *after* at least one successful file edit, the loop returns `Updated <files>.` instead of throwing.
- **Tool calls are executed sequentially** in a `for` loop. M2.7 can return multiple `tool_calls` in one response (parallel function calling), but FORGE walks them one at a time so each result can be fed back in order. This is safe but not optimal for read-only tools.
- **Per-call timeout is 120 s.** Client timeout in `useGenerate.ts` is **240 s** — meaning the client can give up while the agent is still mid-loop. Be aware when modifying timeouts.

---

## 5. MiniMax API Reference (verified May 16, 2026)

This section is the up-to-date research; it supersedes the older `docs/minimax-api-findings.md` and `docs/minimax-api-reference.md` for anything that conflicts. All facts here were re-verified on **May 16, 2026** against the live MiniMax docs index (`https://platform.minimax.io/docs/llms.txt`) via Context7, plus the M2 model card on Hugging Face.

### 5.1 Endpoint & auth

| Item | Value |
|---|---|
| Base URL | `https://api.minimax.io` |
| Chat endpoint (MiniMax-native, with tools) | `POST /v1/text/chatcompletion_v2` ✅ FORGE uses this |
| Chat endpoint (OpenAI-compatible, parallel) | `POST /v1/chat/completions` — same tool surface; the OpenAPI in the docs documents `tools` and `tool_choice` only on `chatcompletion_v2` |
| Auth | `Authorization: Bearer ${MINIMAX_API_KEY}` (no GroupId header) |

Source: <https://platform.minimax.io/docs/api-reference/text-post> (OpenAPI spec for `/v1/text/chatcompletion_v2`).

### 5.2 Tool calling — verified shape

```jsonc
// REQUEST
{
  "model": "MiniMax-M2.7",
  "messages": [ … ],
  "tools": [
    {
      "type": "function",              // only "function" is supported
      "function": {
        "name": "edit_file",
        "description": "…",
        "parameters": { "type": "object", "properties": { … }, "required": [ … ] }
      }
    }
  ],
  "tool_choice": "auto",               // ONLY "none" | "auto" — no "required", no per-function object
  "temperature": 1.0,
  "max_completion_tokens": 8192        // ⚠ "max_tokens" is DEPRECATED; default for M2 family = 10240
}
```

```jsonc
// RESPONSE (tool-call turn)
{
  "choices": [{
    "finish_reason": "tool_calls",      // can also be "stop" | "length"
    "message": {
      "role": "assistant",
      "content": "<think>…long reasoning…</think>\n\n",   // PRESERVE this verbatim when re-appending
      "tool_calls": [
        {
          "id": "call_function_2831178524_1",
          "type": "function",
          "function": {
            "name": "edit_file",
            "arguments": "{\"path\":\"index.html\", …}"   // JSON string, parse before use
          }
        }
      ]
    }
  }],
  "base_resp": { "status_code": 0, "status_msg": "" }
}
```

| Question from the brief | Verified answer |
|---|---|
| Is M2.7 tool calling OpenAI-compatible? | **Yes**, on `/v1/text/chatcompletion_v2`. The `tools[].type=function`, `tools[].function.{name,description,parameters}`, and `tool_calls[].function.{name,arguments}` shape is exactly the OpenAI shape. |
| `tool_choice` options? | **Only `"none"` and `"auto"`.** `"required"` and `{ type:"function", function:{name} }` (OpenAI's forced-call forms) are NOT in the OpenAPI enum. Current `"auto"` is correct. |
| Parallel tool calls? | **Yes** — `message.tool_calls` is an array and the model can emit multiple invocations in one turn (internally via XML `<minimax:tool_call>` containing multiple `<invoke>` blocks). FORGE walks them sequentially, which is safe; switching to `Promise.all` for read-only tools (`list_files`, `read_file`, `search_web`) would shave latency on multi-tool turns. |
| Streaming with tools? | **Technically yes** (`stream: true` is supported), **but tool-call deltas are buffered** — they arrive in the final chunk, not incrementally. This was a documented vLLM/MiniMax bug fixed in vllm-project/vllm#40253 (April 2026) for the open-weights model, but the hosted API still buffers. FORGE's non-streaming approach is the right call until MiniMax fixes the hosted SSE path. |
| Recommended `temperature` for tool calling? | **`1.0`** — explicitly listed as the recommended default for M2 in the OpenAPI (`temperature.description: "MiniMax-M2: recommended 1.0"`). The OpenAI guidance of `0–0.3` does NOT apply. Valid range is `(0, 1]`; `0` is a hard error. Current `1.0` is correct — **do not lower it**. |
| Context window? | **204,800 tokens** for the entire M2 family (M2, M2.1, M2.5, M2.7, and `-highspeed` variants). With FORGE's 12-turn cap × 8 KB output + full file history, you're nowhere near the cap — typical loops use 5–20 K tokens. |
| Recommended `top_p`? | **`0.95`** for M2 (OpenAPI default). FORGE doesn't set it, which is fine — the server uses the default. |
| Best practice specific to MiniMax? | **Preserve `reasoning_content` / `<think>` blocks in re-appended assistant messages.** The official tool-use guide repeats this as the #1 rule. Alternative: use `extra_body: { reasoning_split: true }` to receive thinking in a separate `reasoning_details` field and append both back. |

Sources: <https://platform.minimax.io/docs/guides/text-m2-function-call>, <https://platform.minimax.io/docs/api-reference/text-post>, <https://huggingface.co/MiniMaxAI/MiniMax-M2/blob/main/docs/tool_calling_guide.md>.

### 5.3 Model lineup & is M2.7 the right pick?

Per the OpenAPI enum (verified May 16, 2026):

| Model | Output speed | Pricing (input / output per M tok) | Context | Best for |
|---|---|---|---|---|
| `MiniMax-M2` | ~60 tps | $0.3 / $1.2 | 204,800 | Baseline |
| `MiniMax-M2.1` | ~60 tps | $0.3 / $1.2 | 204,800 | Multi-language coding (Rust, Java, Go, Kotlin, etc.) |
| `MiniMax-M2.5` | ~60 tps | $0.3 / $1.2 | 204,800 | Agent productivity; SOTA on SWE-Bench Verified (80.2%) |
| **`MiniMax-M2.7`** (FORGE) | **~60 tps** | **$0.3 / $1.2** | **204,800** | **Recursive self-improvement; SWE + office productivity** |
| `MiniMax-M2.7-highspeed` | ~100 tps | $0.6 / $2.4 | 204,800 | Latency-sensitive demos |
| `MiniMax-M2.5-highspeed` | ~100 tps | $0.6 / $2.4 | 204,800 | Cheaper highspeed option |

**Recommendation:** M2.7 is the right baseline. For the hackathon demo loop where wait time dominates UX, **`MiniMax-M2.7-highspeed`** doubles output throughput at 2× the output cost — for typical codegen sessions (~5–10K output tokens) that's a few cents extra per generation in exchange for ~40% lower wall time. Consider exposing it behind a "Turbo" toggle.

No model in the lineup is deprecated as of the verification date; the deprecation list is empty in release notes.

Sources: <https://platform.minimax.io/docs/release-notes/models>, <https://www.minimax.io/news/minimax-m27-en>, <https://www.minimax.io/news/minimax-m25>, <https://www.minimax.io/news/minimax-m21>.

### 5.4 Image generation (`/v1/image_generation`)

```jsonc
// FORGE currently sends:
{
  "model": "image-01",
  "prompt": "<desc>. Professional web hero asset, sharp, modern UI illustration or photography style.",
  "aspect_ratio": "16:9",
  "response_format": "url",
  "n": 1
}
```

Verified spec (`/v1/image_generation`):

| Field | Verified |
|---|---|
| `model` | `image-01` ✅, `image-01-live` (subject-reference variant for image-to-image). **No `image-02`** as of May 16, 2026. |
| `prompt` | Max **1500 chars**. |
| `aspect_ratio` | One of `1:1`, `16:9`, `4:3`, `3:2`, `2:3`, `3:4`, `9:16`, **`21:9`** (the cinematic option FORGE doesn't expose). Default `1:1`. |
| `width` / `height` | `image-01` only. Range 512–2048, multiples of 8. If both `aspect_ratio` and `width/height` are present, `aspect_ratio` wins. |
| `response_format` | `url` (24 h expiry) or `base64`. FORGE asks for `url` then immediately fetches and base64-wraps it server-side — that double round-trip can be eliminated by asking for `base64` directly. |
| `n` | 1–9. FORGE locks to 1. |
| `prompt_optimizer` | `boolean`, default `false`. **FORGE does not set this** — turning it on noticeably improves results for the short descriptions M2.7 emits in `<!-- IMAGE:... -->` markers. |
| `seed` | Optional integer for reproducible generation. |
| `subject_reference` | `image-01-live` only — pass a reference image URL for consistent characters. Useful future feature for "generate a hero that matches this logo". |

**Style controls:** there is no separate `style` parameter; style is controlled via the prompt. FORGE's wrapper text ("Professional web hero asset, sharp, modern UI illustration or photography style") works fine.

**Latency:** 15–50 s typical, can spike to 90 s. FORGE's `120_000` ms timeout is appropriate.

Sources: <https://platform.minimax.io/docs/api-reference/image-generation-t2i>, <https://platform.minimax.io/docs/api-reference/image-generation-i2i>.

### 5.5 Vision (`/v1/coding_plan/vlm`)

`POST /v1/coding_plan/vlm` is correct. There is also a multimodal path via `chatcompletion_v2` itself with `content: [{ type:"text", text:"..." }, { type:"image_url", image_url:{ url:"..." } }]` (the OpenAPI's `Image` example uses model `MiniMax-Text-01`), but the dedicated coding-plan VLM endpoint is more cost-efficient on the Token Plan key and is what FORGE uses.

| Field | Verified |
|---|---|
| `prompt` | The instruction. FORGE's "describe layout/colors/typography/components" prompt is good. |
| `image_url` | **Must be a base64 data URI** (`data:image/png;base64,…`). Plain HTTPS URLs return `status_code: 2013`. FORGE handles this correctly. |
| Image formats | JPEG, PNG, WEBP confirmed working. |
| Response | `{ content: "…", base_resp: {…} }` — `content` is the prose answer. |

Sources: existing `docs/minimax-api-reference.md` §6 (live-verified Oct/May 2026), confirmed against current OpenAPI behaviour.

### 5.6 Web search (`/v1/coding_plan/search`)

`POST /v1/coding_plan/search` is correct. Request body uses **`q`** (not `query`). Returns up to 10 results in `organic[]` plus `related_searches[]`. FORGE truncates to top 3 + 800 chars context.

Rate limits on Token Plan Plus: shares the **4,500 req / 5 h** bucket with LLM and VLM. With FORGE's typical 1–3 searches per generation, this is not a practical limit until concurrent users.

Result structure:

```jsonc
{
  "organic": [
    { "title": "…", "link": "https://…", "snippet": "…", "date": "ISO or empty" }
  ],
  "related_searches": [ { "query": "…" } ],
  "base_resp": { "status_code": 0, "status_msg": "" }
}
```

Source: existing `docs/minimax-api-reference.md` §5 (live-verified), confirmed unchanged.

### 5.7 Things in the current FORGE code worth adjusting (non-blocking)

1. **`agentLoop.ts` uses `max_tokens` (deprecated).** Switch to `max_completion_tokens: 10240` (M2 default). Behaviour is identical today but `max_tokens` may be removed.
2. **`agentLoop.ts` doesn't set `top_p`.** The default is `0.95` which is what the docs recommend — no change needed unless you want determinism (`top_p: 0.8` for more focused codegen).
3. **`image.ts` uses `response_format: "url"` then fetches + base64-wraps.** Asking for `response_format: "base64"` directly saves the second hop (the response field becomes `data.image_base64[]`).
4. **`image.ts` does NOT set `prompt_optimizer: true`.** Set it. Free quality win for FORGE's short descriptions.
5. **`agentLoop.ts` does not pass `extra_body: { reasoning_split: true }`.** Optional but cleaner — moves `<think>` content into `reasoning_details` so display-vs-history concerns separate cleanly.

---

## 6. Known Polish Gaps

This is an honest audit, ordered by impact. Each entry cites the file and line.

### 6.1 Correctness / data-flow

| # | Issue | File | Severity |
|---|---|---|---|
| 1 | **`<think>` blocks in assistant content are passed back as-is**, which is the right behaviour — but `useGenerate.ts` displays `event.summary.slice(0, 80)` and the final assistant message via `chatMessage({ content: \`Done — ${event.summary}\` })`. If the model's `summary` ever leaks a `<think>` prefix, it shows up in the UI. The server should strip `<think>…</think>` from the *display copy* only, not the in-history copy. | `src/server/minimax/agentLoop.ts:128`, `src/hooks/useGenerate.ts:158` | Medium |
| 2 | **`useGenerate.ts:82` silently swallows SSE parse errors.** `catch { /* partial JSON */ }` means if the server emits a malformed event, the user sees no error and the loop just freezes. At minimum log to `console.warn`. Better: surface a system message after N consecutive parse failures. | `src/hooks/useGenerate.ts:71-84` | Medium |
| 3 | **Client timeout (240 s) < server max possible duration (12 turns × 120 s/turn = 1440 s).** Long agent loops trigger an `AbortError` on the client while the server happily keeps running and burning quota. Either lower server `maxTurns` to keep total ≤ 240 s, or raise the client timeout to match. | `src/hooks/useGenerate.ts:41`, `src/server/minimax/agentLoop.ts:78` | Medium |
| 4 | **`useProject.ts:25-28` writes the entire project to localStorage on every keystroke** (Monaco onChange → updateFileContent → setProject → useEffect → JSON.stringify). For a 50 KB file this is noticeable. Debounce or write only on blur. | `src/hooks/useProject.ts:25-28` | Medium |
| 5 | **`generateRoutes` does no try/catch around `c.req.json()`.** Malformed JSON in the request body throws and Hono returns an opaque 500 instead of 400. | `src/server/routes/generate.ts:13` | Low |
| 6 | **Backend-mode health check is one-shot at mount with no retry.** If the dev server is still warming up, `setBackendMode("demo")` sticks until full page reload. | `src/components/layout/ForgeBuilder.tsx:42-54` | Low |
| 7 | **Double source of truth for "is this an edit?".** Client uses `files.some(f => f.content.length > 50)`; server uses `currentFiles.length > 0`. The boilerplate default project has all three files at ~30–500 chars, so on a fresh project the client says "create" but the server says "edit". | `src/components/layout/ForgeBuilder.tsx:76`, `src/server/routes/generate.ts:37` | Medium |
| 8 | **`mode` field on `GenerationRequest` is ignored by the server** (server only checks `currentFiles.length`). Either delete the field from the type or actually use it. | `src/lib/types.ts:41`, `src/server/routes/generate.ts` | Low |

### 6.2 Error handling

| # | Issue | File | Severity |
|---|---|---|---|
| 9 | **`tools.ts:307-318` `search_web` swallows the actual error message** in `catch {}` and returns a generic string to the model. The model can't course-correct on rate limits vs network errors. Pass `err.message` through. | `src/server/minimax/tools.ts:303-319` | Medium |
| 10 | **`ChatInput.tsx` FileReader has no `onerror` handler.** Corrupted images silently fail to attach with no UX. | `src/components/chat/ChatInput.tsx:36-50` | Low |
| 11 | **Image generation failure shows a tiny toast in chat but does not retry or downgrade.** A single 502 from `/v1/image_generation` leaves `<!-- IMAGE:... -->` markers in the rendered HTML, breaking the preview's visual layout. | `src/hooks/useGenerate.ts:209-240` | Medium |
| 12 | **`generate.ts:51-52` swallows VLM failure with a tiny system message and continues.** Good fallback behaviour, but a user uploading a 10 MB photo gets no hint that the screenshot was too large — surface the error code. | `src/server/routes/generate.ts:41-54` | Low |

### 6.3 Accessibility

| # | Issue | File | Severity |
|---|---|---|---|
| 13 | **Code/Preview toggle buttons have no `aria-pressed` and no `aria-label`.** Screen readers say "Code button" with no state. | `src/components/layout/ForgeBuilder.tsx:308-330` | Medium |
| 14 | **Device-mode buttons in `PreviewPanel.tsx:91-111` rely on `title` for the label** — screen readers ignore `title`. Add `aria-label`. | `src/components/preview/PreviewPanel.tsx:91-111` | Medium |
| 15 | **`ChatInput.tsx:88-95` screenshot-upload button has visible text only when no file is attached.** When attached, the only label is the body text "Replace design screenshot…" — fine — but the icon-less full-width visual is hard to scan. | `src/components/chat/ChatInput.tsx:88-95` | Low |
| 16 | **No keyboard shortcut to focus the chat input** (Cmd+/ would be a nice convention). Cmd+Enter to submit is supported. | `src/components/chat/ChatInput.tsx:130-135` | Nice-to-have |
| 17 | **No focus ring on the "Forge" submit button** — Tailwind v4 strips defaults and FORGE doesn't add a custom `:focus-visible` style. | `src/components/chat/ChatInput.tsx:137-143`, `src/app/globals.css` | Medium |

### 6.4 Performance / re-renders

| # | Issue | File | Severity |
|---|---|---|---|
| 18 | **`PreviewPanel.tsx:74` uses `recompileMode: "immediate"`**, meaning Sandpack/Parcel recompiles on every keystroke. For a 1000-line generated app this is laggy. `"delayed"` (300 ms debounce) is a one-character fix. | `src/components/preview/PreviewPanel.tsx:74` | Medium |
| 19 | **`ChatPanel.tsx:30-32` smooth-scrolls to bottom on every change to `messages` OR `researchEntries`.** During a search burst (3 results in <1 s) this triggers three overlapping smooth-scroll animations. | `src/components/chat/ChatPanel.tsx:30-32` | Low |
| 20 | **`MessageList.tsx` animates every message** with `animationDelay: i * 40 ms` up to 8. After 100+ messages the keyframe is still firing on initial mount of new items, but capped — fine. | `src/components/chat/MessageList.tsx:24` | Nice-to-have |
| 21 | **`forge-app::before` grain SVG is encoded as a data URL on every paint of the root.** Browsers cache it, but a `background-image: url(data:…)` inside a non-static stylesheet position causes one extra decode on first paint. Move to a real SVG file. | `src/app/globals.css:36-43` | Nice-to-have |

### 6.5 Visible polish

| # | Issue | File | Severity |
|---|---|---|---|
| 22 | **No empty state when `mainView === "code"` but the active file is empty** — Monaco just shows a blank pane. | `src/components/editor/CodeEditor.tsx` | Low |
| 23 | **Export error is a tiny inline `<span>` next to the export buttons** with no dismiss action and no toast — easy to miss. | `src/components/layout/ForgeBuilder.tsx:269-271` | Low |
| 24 | **Demo-mode banner is amber but otherwise unstyled** — no CTA link to `https://platform.minimax.io` to get a key. | `src/components/layout/ForgeBuilder.tsx:188-193` | Low |
| 25 | **The "Live" / "Demo" pill spacing in the header is inconsistent with the New button.** | `src/components/layout/ForgeBuilder.tsx:150-184` | Nice-to-have |
| 26 | **`TemplateStarters.tsx` mixes inline `style={{}}` and Tailwind classes** for the chip styling, making the design tokens harder to refactor. | `src/components/chat/TemplateStarters.tsx:30-46` | Low |
| 27 | **No favicon refresh** — still uses the Next.js default. | `src/app/favicon.ico` | Nice-to-have |
| 28 | **No `metadata.icons` or OG image** on the root layout — link-unfurls look like a default Next.js app. | `src/app/layout.tsx:20-23` | Medium |

### 6.6 Type safety

| # | Issue | File | Severity |
|---|---|---|---|
| 29 | **`useGenerate.ts:72` casts each parsed JSON to `ForgeSSEEvent`** with no runtime validation. If the server union and the client union ever drift, you silently get `event.type` matching the wrong branch. Worth a `zod` parse here. | `src/hooks/useGenerate.ts:72` | Medium |
| 30 | **`tools.ts:14` parameters type is `{ type: string; description: string; enum?: string[] }`** — but JSON Schema supports `items`, `properties`, `oneOf`, etc. Today's tool set doesn't need them, so it's fine, but any nested-object tool will require widening this type. | `src/server/minimax/tools.ts:9-20` | Low |

### 6.7 Dead code (delete in a cleanup PR)

| File | Reason |
|---|---|
| `src/server/minimax/extractQueries.ts` | Not imported. Search is now triggered by the `search_web` tool inside the loop. |
| `src/server/minimax/generate.ts` | Old single-shot JSON path. `generateRoutes` calls `runAgentLoop` instead. |
| `src/server/routes/codesandbox.ts` | Defined but never registered in `src/server/index.ts`. Client uses the hidden-form POST in `src/lib/export/openInCodeSandbox.ts`. |
| `src/components/editor/FileTabs.tsx` | Replaced by inline tabs inside `ForgeBuilder.tsx`. |
| `mode` field on `GenerationRequest` (`src/lib/types.ts:41`) | Never read on the server. |

---

## 7. Common pitfalls (the agent-trap list)

In rough order of "how often this trips up new contributors":

1. **Forgetting "no `?.`, no `??`" in the generated code** → preview crashes at parse time with a Parcel error in the iframe, but the chat thinks everything succeeded. Always grep your system-prompt diffs for those rules.
2. **Omitting `<script src="app.js"></script>` from generated `index.html`** → blank preview. `toSandpackFiles.ts` injects it as a safety net, but if you change the entry filename the safety net must follow.
3. **Using `<link rel="stylesheet">` for `styles.css`** → preview renders but Sandpack HMR breaks; restyles require a manual refresh.
4. **Adding a tool to `FORGE_TOOLS` but forgetting to update `SYSTEM_PROMPT`** → model never calls it. Worse, the model sometimes hallucinates calls with different names that hit `default → "Unknown tool"`.
5. **Returning an external CDN URL for an image** → Sandpack CSP blocks it, broken-image icon. Always base64.
6. **Lowering `temperature` for "more deterministic" tool calls** → degrades M2.7 quality. MiniMax explicitly recommends `1.0`. Don't copy OpenAI's advice here.
7. **Stripping `<think>…</think>` blocks before re-appending the assistant message** → multi-turn coherence collapses around turn 3–5. Either keep them or use `reasoning_split: true` and re-append `reasoning_details`.
8. **Forgetting the SSE response headers** (`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`) → some browsers buffer the whole response, agent appears frozen.
9. **Touching `recompileMode` and the Sandpack template options together** → easy to drop into a state where the preview shows stale CSS. Test by typing into Monaco and watching the preview update without explicit refresh.
10. **Adding npm dependencies for generated apps** → the in-browser Parcel cannot fetch packages. Generated code must use CDNs (`https://esm.sh/...`) or be vanilla.

---

## 8. Testing the live API

Smoke-test `/api/generate` end-to-end (replace `localhost:3000` if `next dev` chose another port):

```bash
curl -N -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "build a centered orange button that alerts when clicked",
    "currentFiles": [],
    "mode": "create",
    "researchMode": false
  }'
```

Expected SSE event sequence (`-N` keeps the stream open):

```
data: {"type":"generating","message":"Agent building from scratch…"}
data: {"type":"tool_call_start","callId":"…","toolName":"list_files","args":{}}
data: {"type":"tool_call_result","callId":"…","ok":true,"summary":"Project files: index.html, styles.css, app.js"}
data: {"type":"tool_call_start","callId":"…","toolName":"read_file","args":{"path":"index.html"}}
data: {"type":"tool_call_result","callId":"…","ok":true,"summary":"<!DOCTYPE html>…"}
...
data: {"type":"tool_call_start","callId":"…","toolName":"edit_file","args":{"path":"index.html",…}}
data: {"type":"file_update","file":{"name":"index.html","language":"html","content":"…"}}
data: {"type":"tool_call_result","callId":"…","ok":true,"summary":"index.html updated"}
...
data: {"type":"done","summary":"Built a centered orange button…","filesChanged":["index.html","styles.css","app.js"]}
```

If you see `data: {"type":"error","message":"…"}`, the message body is the user-facing MiniMax error (already mapped via `formatMiniMaxUserMessage` in `client.ts`).

Probe just the LLM or just search in dev:

```bash
# Dev-only probes (require NODE_ENV !== "production")
curl -X POST http://localhost:3000/api/dev/minimax/probe-chat \
  -H "Content-Type: application/json" -d '{"prompt":"hi"}'
curl -X POST http://localhost:3000/api/dev/minimax/probe-search \
  -H "Content-Type: application/json" -d '{"q":"Tailwind v4 grid"}'
```

Health check:

```bash
curl http://localhost:3000/api/health
# → {"ok":true,"minimax":true,"mode":"live","quotaHints":{…}}
```

---

## 9. Roadmap pointers

Active plans live under [`docs/plans/`](./docs/plans/). At the time of writing this guide, that directory is empty — another agent is preparing a **chat history sidebar plan** that will land there. Other docs to read for context:

- [`docs/HACKATHON-WIN-PLAN.md`](./docs/HACKATHON-WIN-PLAN.md) — strategic positioning vs Lovable/Bolt/v0.
- [`docs/minimax-api-reference.md`](./docs/minimax-api-reference.md) — historical (Kindred Echo) reference. Use §5 of *this* file as the source of truth for anything that conflicts.
- [`docs/token-plan-api-guide.md`](./docs/token-plan-api-guide.md) — Token Plan Plus quota and pricing.
- [`docs/smoke-test-results.md`](./docs/smoke-test-results.md) — last validated run of the 8 endpoints.
- [`forge-spec.md`](./forge-spec.md) — original product spec.
- [`README.md`](./README.md) — Vercel deploy instructions.

When you finish a piece of work, **update this file** — section 5 (MiniMax API reference) and section 6 (Polish gaps) drift fastest.
