# FORGE — Hackathon Win Plan v2

> **Status:** Drafted 2026-05-16 (post Phase 5)
> **Goal:** Turn FORGE from "MiniMax-powered Bolt clone" into the only AI builder that
> demonstrates a **transparent, multi-modal, tool-using agent loop** in a single live demo.
> **Constraint:** Everything runs on **one MiniMax key**, no Supabase, no auth.

---

## 0. Where we are right now (honest audit)

| Capability | State | Limit |
|---|---|---|
| Live search → M2.7 codegen → Sandpack preview | ✅ Works end-to-end | ~60-90s per turn |
| VLM (screenshot → code) | ✅ Implemented, untested in demo | Base64 only |
| image-01 hero image inline | ✅ Implemented but rarely fires | 50/day |
| TTS (speech-2.8-hd) | ❌ Not wired | 4,000 chars/day |
| Music gen | ❌ Not wired | 100/day |
| **Incremental edits** | ❌ Every prompt rewrites every file | Wastes 5-10K tokens + loses user edits |
| **Tool use / function calling** | ❌ Single shot text → JSON parse | No multi-turn reasoning, no diff |
| Code editor edits persist | ✅ Saved to localStorage | But wiped on next generation |
| Source attribution | ✅ Chips on assistant messages | Real URLs from /v1/coding_plan/search |
| Mobile/Tablet preview toggle | ✅ Just shipped | — |
| ZIP export | ✅ JSZip | — |
| Open in CodeSandbox | ✅ Just fixed (server proxy) | — |
| 5 template starters | ✅ Just shipped | — |

**The gap that loses the hackathon:** Every other AI builder (Bolt, Lovable, v0, Replit
Agent) shows an **agent reasoning, calling tools, editing one file at a time, and verifying
its own work**. We currently show one long M2.7 call that returns three full files. That's
1990s "generate" UX, not 2026 agent UX.

---

## 1. The new positioning (what we say on stage)

> **"Every AI builder hides the agent. FORGE is the agent."**
>
> Watch it think out loud, search the web for current docs, edit one file at a time,
> generate its own images, and see its own work — all on one MiniMax key.

Three things judges remember in 90 seconds:

1. **Transparent agent loop** — they see the model decide "I need to search Stripe docs",
   call the search tool, get results, decide "now I'll edit `index.html`", call edit_file,
   re-look at the preview, then write the next file. Each tool call is a chip in the chat.
2. **Multi-modal output baked in** — screenshot → code (VLM), prompt → hero asset
   (image-01), landing page → soundtrack snippet (music-2.6, demo button).
3. **Incremental edits with diff view** — second prompt does not rewrite everything;
   it edits a span. The Monaco editor highlights the changed lines in orange like git diff.

---

## 2. Architecture upgrade — from "single-shot codegen" to "ReAct agent loop"

### 2.1 What M2.7 actually supports

Confirmed via the MiniMax tool-use docs and our smoke tests on `/v1/text/chatcompletion_v2`:

- **OpenAI-style `tools` array** — `[{ type: "function", function: { name, description, parameters } }]`
- **Response contains `tool_calls`** — `[{ id, type: "function", function: { name, arguments: "json string" } }]`
- **Interleaved thinking** — pass `extra_body: { reasoning_split: true }` to get
  `reasoning_details` separated from `content`
- **Multi-turn** — must append the assistant message (with `tool_calls` + `reasoning_details`)
  to history, then add `role: "tool"` messages with `tool_call_id`
- Available also via Anthropic SDK at `https://api.minimax.io/anthropic`

### 2.2 The FORGE tool set (8 tools, narrow on purpose)

| Tool | Purpose | Destructive? | Latency |
|---|---|---|---|
| `read_file(path)` | Re-read current contents of a file | No | instant |
| `list_files()` | List all files in the project | No | instant |
| `edit_file(path, old_string, new_string)` | Surgical search-replace (Claude Code style) | **Yes** | instant |
| `create_file(path, content)` | Create a new file (must not exist) | **Yes** | instant |
| `delete_file(path)` | Delete an existing file | **Yes** | instant |
| `search_web(query)` | MiniMax `/v1/coding_plan/search` — top 3 results | No | ~2s |
| `generate_image(prompt, target_file, placeholder_marker, aspect_ratio?)` | image-01 + inline `<img>` swap | No (one I/O) | 15-50s |
| `analyze_preview(question)` | Screenshot current Sandpack iframe → VLM | No | ~7s |

**Why these specifically:**
- `edit_file` with **exact-string-replace** is the same diff strategy Claude Code ships.
  Errors are deterministic ("old_string not unique" → model adds context) and it never
  silently corrupts a file. (See [How AI Coding Agents Actually Work, Approach C].)
- No `bash`, no `npm install`, no `git`. The sandbox is Sandpack vanilla; nothing else
  is even possible. Keeping the action space tiny is what makes M2.7 reliable.
- `analyze_preview` is the wildcard — VLM looking at the model's own rendered output is
  a closed visual feedback loop. No competitor has this.

### 2.3 The agent loop, end-to-end

```
User: "Add a footer with our social links to the landing page"
                  │
                  ▼
┌──────────────────────────────────────────────────────────────┐
│ Server-side ReAct loop (max 12 turns, max 90s wall clock)   │
├──────────────────────────────────────────────────────────────┤
│ Round 1                                                       │
│   M2.7 → tool_calls: [list_files()]                          │
│   exec → ["index.html", "styles.css", "app.js"]              │
│   emit SSE: { type: "tool_call", name, args, result }        │
│                                                               │
│ Round 2                                                       │
│   M2.7 → tool_calls: [read_file("index.html")]               │
│   exec → "<html>..."                                          │
│                                                               │
│ Round 3                                                       │
│   M2.7 → tool_calls: [edit_file(                             │
│     "index.html",                                             │
│     "</main>\n</body>",                                       │
│     "</main>\n<footer>...</footer>\n</body>"                  │
│   )]                                                          │
│   exec → { applied: true, file: updated_file }               │
│   emit SSE: { type: "file_update", file }                    │
│                                                               │
│ Round 4                                                       │
│   M2.7 → tool_calls: [edit_file("styles.css", "...", "...")] │
│                                                               │
│ Round 5                                                       │
│   M2.7 → content: "Done. Added a footer with..."             │
│   loop exits (no tool_calls)                                  │
│   emit SSE: { type: "done", summary }                        │
└──────────────────────────────────────────────────────────────┘
```

Compared to today (1 M2.7 call rewrites everything), this is:
- **Same or fewer total tokens** (only diffs ship up, full files come down once)
- **Visible reasoning** in chat (each tool_call is a chip)
- **Preserves user edits** (we never touch what the model didn't touch)
- **Stops on first error** the model can fix (tool errors come back as observations)

### 2.4 SSE event additions

Today: `search_*`, `generating`, `file_update`, `image_hint`, `done`.

New events for the agent loop:

```ts
| { type: "tool_call_start"; toolCallId: string; name: string; args: unknown }
| { type: "tool_call_result"; toolCallId: string; ok: boolean; summary: string }
| { type: "thinking"; text: string }       // streamed from reasoning_details
| { type: "turn_complete"; turn: number; tokensUsed: number }
```

Each `tool_call_start` becomes a colored chip in chat. `thinking` is collapsed by
default behind a "Show reasoning" toggle (Lovable shipped this exact UX in Agent mode).

### 2.5 Cost ceiling per task

- **Max 12 turns** per user prompt (Claude Code defaults to 50–200; ours is smaller
  because the action space is tiny).
- **Max 1 image per turn** (image-01 is 50/day).
- **Hard 90s wall clock** — abort and emit `error` if exceeded.
- **Token budget displayed in UI** ("Used 4,210 / 50,000 tokens" tickdown).

---

## 3. Better use of MiniMax's multi-modal stack (the second judge moment)

We are leaving four of MiniMax's eight endpoints on the table. Wiring them well is what
turns FORGE from "another codegen demo" into "a Token Plan demo MiniMax themselves can
brag about."

### 3.1 VLM — make it the **debugger**, not just the import tool

Today: user uploads a screenshot, VLM describes it, M2.7 rebuilds it. Useful but one-shot.

**New:** `analyze_preview` tool the agent itself can call.
1. Server captures the rendered Sandpack iframe via Playwright/`puppeteer-core` (or the
   `getSnapshot()` Sandpack client API — needs verification).
2. Encodes the screenshot as a base64 data URI.
3. Sends to `/v1/coding_plan/vlm` with prompt: "Does this match the user's request: '...'?
   What's wrong? Be specific about element, color, spacing."
4. Returns description back to M2.7 as a tool_result.
5. M2.7 decides on a follow-up edit.

**Demo line:** "Watch — it's looking at its own work."

### 3.2 image-01 — auto-decorate, don't wait for prompts

The agent should generate **one signature asset per landing page** without being asked.
Current `<!-- IMAGE:... -->` flow only fires when M2.7 puts a placeholder in the HTML.
New system-prompt rule: "For any landing/hero section, always emit one `<!-- IMAGE:hero ... -->`
marker." Then our existing `image_hint` pipeline auto-fires image-01 and inlines the URL.

**Demo line:** "I didn't ask for an image. It generated one because the layout needed one."

### 3.3 TTS — voice prompt input + voice-over demos

Two surfaces, one endpoint:

- **Voice input.** A mic button in the chat input → browser MediaRecorder → POST audio
  blob to our server → server transcribes via OpenAI Whisper API... **wait, we don't
  have OpenAI**. Re-spec: use MiniMax M2.7 itself for transcription? **No** — M2.7 is
  text-only. Skip Whisper. Use the **Web Speech API** (browser-native, zero cost) for
  speech→text, then send the transcript to /api/generate. TTS only for output.
- **Voice-over on the generated page.** A small button in the preview toolbar — "Read
  this page" — TTS-narrates the H1 + first paragraph using the
  `English_expressive_narrator` voice. Wow factor: zero, but it ticks the TTS box for
  judges who score on "endpoint coverage."

### 3.4 Music-2.6 — the unfair demo moment

Music gen is what no other AI builder ships. Cost: 100/day, ~140s per track.

Add a `🎵 Generate soundtrack` button next to the Forge button. Strategy:
1. Take the generated page's H1 + tagline as input.
2. Server calls M2.7 with a tiny system prompt: "Output a single sentence describing a
   music style that fits this page mood."
3. Forward that to `/v1/music_generation` with `is_instrumental: true` (skip lyrics so
   we don't need to negotiate vocals).
4. Pipe the hex audio back to the browser, attach `<audio>` tag in a corner of the preview.

**Demo line:** "I'll click here. While we keep coding, FORGE will compose a soundtrack
for the page. One key. One platform."

Use sparingly — 100/day means ~30 demo runs maximum.

---

## 4. Editor UX — making the agent visible

### 4.1 Live diff highlights in Monaco

When `edit_file` fires:
- Pre-edit content is stashed.
- Post-edit content is set.
- Compute line-level diff (`diff` npm package or a tiny LCS).
- Monaco `deltaDecorations` paints changed lines with `background: rgba(249, 115, 22, .12)`
  (forge-molt orange, 12% alpha) for 3 seconds, then fades out.

### 4.2 Tool-call chips in chat

Each `tool_call_start` SSE → a small bordered chip with:
- Icon by tool type (file, search, image, eye for VLM)
- Tool name + truncated args
- Spinner while pending
- Result preview when `tool_call_result` arrives (collapsed by default; click to expand)

Lovable's Agent mode "Tasks" panel is exactly this. Bolt's "Actions" sidebar is the same idea.

### 4.3 Thinking drawer

Below the chat, a collapsed "Reasoning" drawer that streams `reasoning_details` text in
muted italics. Off by default, opt-in for demo. Shows judges the model's chain of thought
without overwhelming the chat.

### 4.4 Prompt queue (Lovable shipped this)

While the agent is running, the chat input stays enabled. Subsequent prompts go into a
visible queue above the input. After current task completes, the next queued prompt
auto-fires. Saves judge time on stage.

---

## 5. Persistent project memory (Lovable's `memory/` pattern, scaled down)

Right now, project state = `localStorage["forge-project-v3"]` = files + active file.
Add **two** more keys:

- `forge-decisions-v1`: append-only log of `{ ts, prompt, summary, filesChanged[] }`.
  Last 20 entries injected into M2.7 system prompt as "Project history (most recent first):".
- `forge-preferences-v1`: free-form user notes ("Use Tailwind", "No emojis", "Prefer
  vanilla JS"). Surfaced in a settings drawer; injected into every system prompt.

**Why:** Lovable agents persist "what we've done and what the user prefers" across turns
because it's the single biggest reliability win. Costs zero quota. ~50 lines of code.

---

## 6. Reliability & rate-limit handling

| Endpoint | Quota | Strategy |
|---|---|---|
| M2.7 chat | 4,500 / 5h rolling | Per-turn limit (above). Show countdown if 429. |
| Web search | shared 4,500 / 5h | Cache hits in memory for the session (key: q). |
| VLM | shared 4,500 / 5h | Only fire on explicit upload or `analyze_preview` tool call. |
| image-01 | 50 / day | Hard-stop after 40. Show banner. |
| TTS | 4,000 chars / day | Cap output text length to 800 chars per request. |
| Music | 100 / day | Demo-only button, behind a confirmation modal. |

Plus a **friendlier 1002/2056 message** in chat ("Rate limited by MiniMax — please wait
~3 minutes") instead of the current raw error.

### 6.1 Image URL expiry

`/v1/image_generation` returns URLs that **expire in 24 hours**. For ZIP export and
CodeSandbox handoff, fetch the image server-side and either:
- Inline as base64 data URI (best for ZIP — works forever, but bloats file size)
- Upload to our server's `/public/generated/<uuid>.png` (best for live deploys, but
  needs Vercel persistent storage which the hobby plan doesn't have)

Decision for hackathon: **inline as base64 in the HTML** before ZIP export. Costs
~50-200 KB per image, no infra needed.

---

## 7. Phased implementation (24 hours from "now")

> Each phase is shippable on its own. If we run out of time, ship through Phase B and
> stop. The agent loop + tool chips alone are the headline.

### Phase A — Agent loop core (6h) **← biggest lift, do first**

```
□ Define ToolDefinition + ToolCall + ToolResult TypeScript types
□ Implement 5 base tools: list_files, read_file, edit_file, create_file, delete_file
□ src/server/minimax/agentLoop.ts — multi-turn driver with M2.7 tools array
□ Replace src/server/routes/generate.ts with agent-loop call
□ Add tool_call_start / tool_call_result / thinking SSE events
□ Client: handle new events in useGenerate.ts
□ Verify: "Build a Stripe form" still works end-to-end with new pipeline
```

**Checkpoint:** Same demo as today, but chat shows tool chips streaming.

### Phase B — Agent visibility UI (3h)

```
□ ToolChip component (icon, name, args, status)
□ Live Monaco diff highlights on edit_file
□ ThinkingDrawer (collapsed reasoning_details stream)
□ Update spec text in chat: "Show reasoning" toggle
□ Reorder events: search → edit → image → done into a Tasks panel like Lovable
```

**Checkpoint:** A judge can watch the agent decide each step.

### Phase C — Multi-modal expansion (4h)

```
□ Add 3 more tools: search_web, generate_image, analyze_preview
□ Server-side iframe screenshot for analyze_preview (use html-to-image or playwright?)
□ Wire image-01 hero auto-injection rule into system prompt
□ Add 🎵 soundtrack button (music-2.6) — separate /api/music route
□ Add 🔊 read-aloud button (TTS) — separate /api/tts route
□ Add 🎙️ voice input via Web Speech API in ChatInput
```

**Checkpoint:** Five MiniMax endpoints visibly used during one demo.

### Phase D — Memory, polish, demo hardening (4h)

```
□ Decisions log + preferences in localStorage + injected into system prompt
□ Prompt queue (Lovable pattern)
□ Token budget tickdown in header
□ Better 1002/2056 rate-limit UI
□ Base64-inline images before ZIP export
□ Rehearse the 3 demo moments × 3 times
□ Record a 90s screen capture as a fallback
```

### Phase E — Optional (only if time) (3h)

```
□ Vercel deploy + a public URL on the slide
□ Add Anthropic SDK example to docs (shows API breadth)
□ ENV var override for n=2 on image-01 (faster perceived gen)
□ /dev/agent page that lets us inspect the raw tool_calls log
```

---

## 8. The three demo moments (rehearsed)

### Moment 1 — "Watch the agent" (40s)
1. Prompt: `"Build a Stripe checkout form using their current SDK"`
2. Point to **tool chips streaming in chat**:
   - `search_web("Stripe.js loadStripe payment intent 2026")` → 3 results chip
   - `create_file("index.html", ...)` → file appears in editor
   - `edit_file("index.html", "<!-- pay button -->", "<button id='pay'>...</button>")` →
     orange diff highlight in Monaco
   - `create_file("app.js", ...)` → preview updates
3. Click a search result chip → opens stripe.com docs in a new tab
4. **Line:** "Every chip is a tool the agent decided to call. No black box. No
   guessing. It searched the current docs. It edited one file at a time. You can audit
   every move."

### Moment 2 — "Multi-modal in 60s" (60s)
1. New project. Prompt: `"Build a landing page for an AI music app"`
2. While it runs, click `🎵 Generate soundtrack`.
3. Page renders with a generated hero image (image-01 fired automatically).
4. Music starts playing in the preview corner (music-2.6 returned ~120s in).
5. Click `🔊 Read this page` — narrator reads the H1.
6. **Line:** "Page, image, soundtrack, voice-over. One key. One bill. MiniMax."

### Moment 3 — "See its own work" (30s)
1. Prompt: `"The hero text is too small, make it bolder"`
2. Tool chips:
   - `analyze_preview("Is the hero text prominent enough?")` → returns "too small, ~24px"
   - `edit_file("styles.css", "h1 { font-size: 2.5rem", "h1 { font-size: 4rem")` →
     diff highlight
3. **Line:** "Notice the second chip — it looked at its own rendered page using VLM,
   diagnosed the size, then edited the CSS. The agent sees what you see."

---

## 9. What we are explicitly NOT building

| Skipped | Why |
|---|---|
| Multi-file diff/git history | Out of scope; localStorage decisions log covers the demo need |
| Real backend (Supabase, Postgres) | One MiniMax key; no auth story |
| Multi-language support (Python, Go) | Sandpack vanilla is HTML/CSS/JS only |
| Real package install / `npm i` | Sandpack vanilla has CDN only; can't install |
| Cloud deploy from inside the app | CodeSandbox button already covers this |
| Custom apply-model | We don't have a small fine-tuned model. Use Approach C (search/replace) |
| User accounts / sharing | One demo, one user, no infra |
| Token-streaming for content | M2.7 SSE streaming is doable but not worth the complexity for the demo length |

---

## 10. Reference / sources

- MiniMax Tool Use docs: `/docs/minimax-api-reference.md` + live docs at
  https://platform.minimax.io/docs/guides/text-m2-function-call (cached at
  `agent-tools/cc1a5151...`)
- Lovable agent docs: `https://docs.lovable.dev/llms-full.txt` (cached, 980 KB)
- "How AI Coding Agents Actually Work" (April 2026, Akshay Ghalme) — diff-application
  strategies A/B/C/D, cached at `agent-tools/0d7949e8...`
- Claude Code's exact-string-replace pattern (our `edit_file` is a direct port)
- OpenAI Node SDK `runTools` helper (Context7 `/openai/openai-node`) — reference
  implementation for the multi-turn driver

---

## 11. The one-line elevator on demo day

> **FORGE is the only AI builder that lets you watch the agent —
> search, edit, generate images, even look at its own preview —
> all powered by one MiniMax key.**
