# Production Agent Harness Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make FORGE's MiniMax-driven build, edit, preview, and self-repair loop feel instant and production-grade while preserving correctness, diagnostics, and token efficiency.

**Architecture:** Keep MiniMax M2.7 as the reasoning and tool-calling engine, but harden FORGE's local harness around it: normalized tool projections, responsive UI streaming, deterministic diagnostic repair state, and robust verification gates. Build from public docs and clean-room patterns only; do not use leaked proprietary agent implementations or other private source.

**Tech Stack:** Next.js 16 App Router, Hono SSE routes, MiniMax M2.7 `chatcompletion_v2`, Sandpack/Parcel, Monaco, React 19, Node test runner, public references from MiniMax docs, MiniMax `mini-agent`, OpenAI Codex OSS, Claude Code public docs, and OpenHarness public docs.

---

## Verified Constraints

- MiniMax supports streaming text responses through `/v1/text/chatcompletion_v2` and `/v1/chat/completions`, but the current FORGE tool loop receives complete tool-call arguments before executing tools.
- FORGE must preserve assistant reasoning content in model history because MiniMax interleaved thinking depends on it.
- MiniMax tool calls follow a JSON-schema function-call model; FORGE must define tool schema and execution in one place.
- `tool_choice: "auto"` remains the safest documented choice for this app's current MiniMax path.
- Generated code runs inside Sandpack/Parcel 1.x: no optional chaining, no nullish coalescing, no CSS `<link>`, no module script.
- Public harness patterns agree on the same production shape: gather context, act with tools, stream progress, verify with tests/diagnostics, compact context, and expose permissions/observability.
- Leaked proprietary source is out of scope. Use public docs, public OSS, and clean-room reimplementation.

## Current State

FORGE already has:

- Visible tool-call trace in chat.
- `create_file`, `edit_file`, and `replace_strings` tool execution.
- Projected file streaming into Monaco as soon as tool args are received.
- Sandpack static/runtime/compiler/test diagnostics.
- Manual `Fix with AI`.
- Automatic repair loop after generation and after repair passes.
- Diagnostic fingerprinting to detect repeated unresolved states.
- Tests, lint, and production build passing after the last harness update.

Remaining production gaps:

- Streaming is projected from complete tool args, not true token-by-token tool-argument streaming.
- The agent harness still mixes loop orchestration, tool streaming, and error policy in `agentLoop.ts`.
- Diagnostics and repair status are client-driven only; there is no server-side repair transcript or replayable state machine.
- The editor/preview panes do not yet expose fine-grained phase timing, debounce budgets, or responsiveness metrics.
- The harness has no eval fixtures for multi-pass repair convergence, repeated diagnostics, or large-file replacement efficiency.

---

## Task 1: Document MiniMax Capability Matrix

**Files:**
- Create: `docs/research/minimax-agent-harness-capability-matrix.md`
- Modify: `FORGE.md`
- Test: `tests/audit-fixes.test.mjs`

- [ ] **Step 1: Write the failing audit test**

```js
test("agent guide links current MiniMax harness capability matrix", () => {
  const guide = read("FORGE.md");
  const matrix = read("docs/research/minimax-agent-harness-capability-matrix.md");

  assert.match(guide, /minimax-agent-harness-capability-matrix\.md/);
  assert.match(matrix, /chatcompletion_v2/);
  assert.match(matrix, /tool-call arguments/);
  assert.match(matrix, /projected streaming/);
  assert.match(matrix, /clean-room/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL because the matrix file and `FORGE.md` link do not exist yet.

- [ ] **Step 3: Create the matrix**

Create `docs/research/minimax-agent-harness-capability-matrix.md`:

```md
# MiniMax Agent Harness Capability Matrix

Last verified: May 16, 2026.

## Source Rules

Use only MiniMax official docs, MiniMax public `mini-agent`, public OSS projects, and public product documentation. Do not use leaked proprietary agent implementations or other private source.

## MiniMax API Facts

| Capability | Verified Status | FORGE Interpretation |
|---|---|---|
| `/v1/text/chatcompletion_v2` | Supports MiniMax M2.7, tools, multimodal input, and streaming text chunks. | Keep as primary endpoint for tool loop. |
| Tool calls | Model returns complete function-call arguments for local execution. | Stream projected tool output once complete args arrive. |
| Text streaming | Supported for assistant text deltas. | Useful for assistant narration and future planner mode, not enough alone for safe file writes. |
| `reasoning_content` / `<think>` | Must be preserved in model history. | Never strip history content sent back to MiniMax. |
| `tool_choice` | Use automatic tool choice for current FORGE loop. | Keep `tool_choice: "auto"` unless docs and tests prove a stronger mode. |
| Token limits | Use current documented MiniMax parameter names and verify by endpoint. | Keep tests around `max_completion_tokens` and timeout budgets. |

## Harness Decision

FORGE should treat MiniMax as the reasoning/tool-call producer and build production behavior in the local harness: projection, validation, diagnostics, repair replay, and UI streaming.
```

- [ ] **Step 4: Link it from `FORGE.md`**

Add a short link under the MiniMax reference section:

```md
For harness-specific capability decisions, see [`docs/research/minimax-agent-harness-capability-matrix.md`](./docs/research/minimax-agent-harness-capability-matrix.md).
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`

Expected: PASS.

---

## Task 2: Extract a Typed Harness Event Layer

**Files:**
- Create: `src/server/minimax/harnessEvents.ts`
- Modify: `src/server/minimax/agentLoop.ts`
- Modify: `src/lib/types.ts`
- Test: `tests/audit-fixes.test.mjs`

- [ ] **Step 1: Write the failing audit test**

```js
test("agent loop uses typed harness event helpers", () => {
  const events = read("src/server/minimax/harnessEvents.ts");
  const agentLoop = read("src/server/minimax/agentLoop.ts");

  assert.match(events, /emitToolCallStart/);
  assert.match(events, /emitToolCallResult/);
  assert.match(events, /emitFileStream/);
  assert.match(events, /emitHarnessPhase/);
  assert.match(agentLoop, /emitHarnessPhase/);
  assert.doesNotMatch(agentLoop, /type:\s*"file_stream_chunk"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL because event helpers do not exist.

- [ ] **Step 3: Create event helpers**

Create `src/server/minimax/harnessEvents.ts`:

```ts
import type { ForgeSSEEvent, ProjectFile } from "@/lib/types";

type Emit = (event: ForgeSSEEvent) => Promise<void>;

const STREAM_CHUNK_SIZE = 480;
const STREAM_CHUNK_DELAY_MS = 8;

export async function emitHarnessPhase(emit: Emit, message: string): Promise<void> {
  await emit({ type: "generating", message });
}

export async function emitToolCallStart(
  emit: Emit,
  callId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<void> {
  await emit({ type: "tool_call_start", callId, toolName, args });
}

export async function emitToolCallResult(
  emit: Emit,
  callId: string,
  ok: boolean,
  summary: string
): Promise<void> {
  await emit({ type: "tool_call_result", callId, ok, summary });
}

export async function emitFileStream(emit: Emit, file: ProjectFile): Promise<void> {
  await emit({ type: "file_stream_start", file: { ...file, content: "" } });

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
```

- [ ] **Step 4: Replace inline emissions in `agentLoop.ts`**

Use `emitToolCallStart`, `emitToolCallResult`, `emitFileStream`, and `emitHarnessPhase`. Keep behavior identical.

- [ ] **Step 5: Run tests**

Run: `npm test && npm run lint && npm run build`

Expected: PASS.

---

## Task 3: Make Tool Projection a First-Class Contract

**Files:**
- Create: `src/server/minimax/toolProjection.ts`
- Modify: `src/server/minimax/tools.ts`
- Modify: `src/server/minimax/agentLoop.ts`
- Test: `tests/diagnostics.test.mjs`

- [ ] **Step 1: Write failing projection tests**

```js
test("tool projection reports a stable reason when streaming is unsafe", () => {
  const store = new editTools.ProjectFileStore([
    file("app.js", "var x = 1;\nvar x = 1;"),
  ]);
  const projected = editTools.projectToolFileUpdate("edit_file", {
    path: "app.js",
    old_string: "var x = 1;",
    new_string: "var x = 2;",
  }, store);

  assert.equal(projected.ok, false);
  assert.match(projected.error, /expected one match/);
});
```

- [ ] **Step 2: Run test to verify it fails if contract is missing**

Run: `npm test`

Expected: FAIL until the helper is moved and exported with stable error wording.

- [ ] **Step 3: Extract `toolProjection.ts`**

Move `projectToolFileUpdate` and replacement normalization out of `tools.ts` into `toolProjection.ts`. Export:

```ts
export type ProjectedToolUpdate =
  | { ok: true; file: ProjectFile; toolName: string }
  | { ok: false; error: string; toolName: string };

export function projectToolFileUpdate(
  name: string,
  args: Record<string, unknown>,
  store: ProjectFileStore
): ProjectedToolUpdate;
```

- [ ] **Step 4: Keep `tools.ts` execution authoritative**

`tools.ts` remains the only mutation path. Projection must never call `store.write()`.

- [ ] **Step 5: Run tests**

Run: `npm test && npm run lint && npm run build`

Expected: PASS.

---

## Task 4: Add Harness Observability and Timing

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/hooks/useGenerate.ts`
- Modify: `src/components/chat/MessageList.tsx`
- Modify: `src/server/minimax/agentLoop.ts`
- Test: `tests/audit-fixes.test.mjs`

- [ ] **Step 1: Write failing test**

```js
test("harness emits phase timing events for production observability", () => {
  const types = read("src/lib/types.ts");
  const agentLoop = read("src/server/minimax/agentLoop.ts");
  const hook = read("src/hooks/useGenerate.ts");

  assert.match(types, /type:\s*"harness_phase"/);
  assert.match(types, /elapsedMs/);
  assert.match(agentLoop, /Date\.now\(\)/);
  assert.match(hook, /case "harness_phase"/);
});
```

- [ ] **Step 2: Add event type**

Add to `ForgeSSEEvent`:

```ts
| {
    type: "harness_phase";
    phase: "model_call" | "tool_projection" | "tool_execution" | "diagnostic_wait" | "repair_pass";
    message: string;
    elapsedMs?: number;
  }
```

- [ ] **Step 3: Emit timings**

Emit before and after model call, projection, and execution. Do not expose private reasoning text.

- [ ] **Step 4: Render compactly**

In `useGenerate.ts`, route phase events to system chat messages only for meaningful phase changes. Avoid one message per tiny chunk.

- [ ] **Step 5: Run tests**

Run: `npm test && npm run lint && npm run build`

Expected: PASS.

---

## Task 5: Add Instant Preview/Code Responsiveness Guards

**Files:**
- Modify: `src/hooks/useGenerate.ts`
- Modify: `src/components/layout/ForgeBuilder.tsx`
- Modify: `src/components/editor/CodeEditor.tsx`
- Test: `tests/audit-fixes.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
test("streamed file updates are batched to avoid UI thrash", () => {
  const hook = read("src/hooks/useGenerate.ts");

  assert.match(hook, /requestAnimationFrame/);
  assert.match(hook, /pendingStreamUpdates/);
});
```

- [ ] **Step 2: Add frame-batched stream updates**

In `useGenerate.ts`, buffer chunk updates per file and flush with `requestAnimationFrame`:

```ts
const pendingStreamUpdates = new Map<string, ProjectFile>();
let streamFlushId: number | null = null;

function scheduleStreamFlush(onFileStreamUpdate?: (f: ProjectFile) => void) {
  if (streamFlushId !== null) return;
  streamFlushId = requestAnimationFrame(() => {
    streamFlushId = null;
    for (const file of pendingStreamUpdates.values()) {
      onFileStreamUpdate?.(file);
    }
    pendingStreamUpdates.clear();
  });
}
```

- [ ] **Step 3: Keep final updates immediate**

`file_stream_done` and `file_update` must flush any pending stream update before applying final file content.

- [ ] **Step 4: Run tests**

Run: `npm test && npm run lint && npm run build`

Expected: PASS.

---

## Task 6: Make Repair Loop Server-Replayable

**Files:**
- Create: `src/lib/diagnostics/repairState.ts`
- Modify: `src/components/layout/ForgeBuilder.tsx`
- Test: `tests/diagnostics.test.mjs`

- [ ] **Step 1: Write failing pure state-machine tests**

```js
test("repair state continues on new fingerprints and stops only on repeated impasse", () => {
  const state = repairState.createRepairState({ maxPasses: 12, maxRepeatedFingerprints: 2 });
  const first = repairState.nextRepairAction(state, { fingerprint: "a", blockingCount: 1 });
  const second = repairState.nextRepairAction(first.state, { fingerprint: "b", blockingCount: 1 });
  const third = repairState.nextRepairAction(second.state, { fingerprint: "b", blockingCount: 1 });
  const fourth = repairState.nextRepairAction(third.state, { fingerprint: "b", blockingCount: 1 });

  assert.equal(first.action, "repair");
  assert.equal(second.action, "repair");
  assert.equal(third.action, "repair");
  assert.equal(fourth.action, "stop_repeated");
});
```

- [ ] **Step 2: Extract repair decision logic**

Move pass count, repeated fingerprint counts, healed/stopped decisions into pure functions.

- [ ] **Step 3: Wire `ForgeBuilder` to the pure state machine**

Keep UI state in React, but use the pure module to decide whether to repair, heal, or stop.

- [ ] **Step 4: Run tests**

Run: `npm test && npm run lint && npm run build`

Expected: PASS.

---

## Task 7: Add End-to-End Browser Smoke Coverage

**Files:**
- Create: `tests/browser/manual-smoke-plan.md`
- Modify: `docs/smoke-test-results.md`

- [ ] **Step 1: Write the smoke script document**

Create `tests/browser/manual-smoke-plan.md`:

```md
# FORGE Browser Smoke Plan

## Scenario 1: Clean Create

1. Start `npm run dev`.
2. Open `/`.
3. Submit "Build a responsive landing page for a coffee roaster".
4. Verify Code view appears during generation.
5. Verify "Streaming generated code" appears.
6. Verify Preview returns clean diagnostics.

## Scenario 2: Auto Repair

1. Introduce invalid generated JS through a prompt or editor edit.
2. Wait for diagnostic panel error.
3. Click "Fix with AI".
4. Verify repair pass starts.
5. Verify diagnostics re-run after the fix.
6. Verify loop stops only on clean preview or repeated diagnostic fingerprint.

## Scenario 3: Responsiveness

1. Generate a larger app.
2. Switch Code/Preview during streaming.
3. Verify no frozen UI, no unhandled console errors, and no stale active file.
```

- [ ] **Step 2: Run manually with Playwright MCP**

Use browser snapshots, console messages, and screenshots. Do not rely only on source tests.

- [ ] **Step 3: Record results**

Append results to `docs/smoke-test-results.md` with date, commit, pass/fail, and observed issues.

---

## Task 8: Consider a Clean-Room Patch Tool

**Files:**
- Create: `src/server/minimax/patchTool.ts`
- Modify: `src/server/minimax/tools.ts`
- Modify: `src/server/minimax/agentLoop.ts`
- Test: `tests/diagnostics.test.mjs`

- [ ] **Step 1: Write failing patch parser tests**

```js
test("apply_patch rejects patches that do not match current file content", () => {
  const result = patchTool.applyPatchToFiles([
    file("app.js", "var x = 1;"),
  ], "*** Begin Patch\n*** Update File: app.js\n@@\n-var y = 1;\n+var y = 2;\n*** End Patch\n");

  assert.equal(result.ok, false);
  assert.match(result.error, /context not found/);
});
```

- [ ] **Step 2: Implement only after existing tools hit limits**

Do not add this tool immediately if `replace_strings` and `edit_file` cover current needs. Add it when large coordinated edits become unreliable.

- [ ] **Step 3: Keep format simple**

Use a strict patch grammar with exact context matching. Do not implement fuzzy patching in the first version.

- [ ] **Step 4: Add tool prompt guidance**

Tell MiniMax to prefer:

1. `replace_strings` for multiple small exact replacements in one file.
2. `edit_file` for one exact replacement.
3. `apply_patch` only for multi-hunk edits after reading the file.

- [ ] **Step 5: Run tests**

Run: `npm test && npm run lint && npm run build`

Expected: PASS.

---

## Task 9: Add Harness Evals

**Files:**
- Create: `tests/harness-evals.test.mjs`
- Create: `tests/fixtures/harness/*.json`

- [ ] **Step 1: Add deterministic fixtures**

Create fixtures for:

- Clean create with three files.
- Invalid JS repaired by one `replace_strings`.
- Repeated diagnostic fingerprint stop.
- Large CSS replacement batched via `replace_strings`.
- Unsafe ambiguous edit rejected.

- [ ] **Step 2: Test pure helpers without MiniMax network calls**

Use `ProjectFileStore`, `projectToolFileUpdate`, static diagnostics, fingerprinting, and repair state.

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: PASS with no external API key required.

---

## Execution Order

1. Capability matrix and guide link.
2. Typed harness event helpers.
3. First-class tool projection module.
4. Harness observability and timings.
5. Frame-batched stream flushing for instant UI.
6. Pure repair state machine.
7. Playwright MCP browser smoke pass.
8. Clean-room patch tool only if exact replacement tools prove insufficient.
9. Harness eval fixtures.

## Definition of Done

- No leaked or proprietary source used.
- MiniMax limitations documented and reflected in code.
- Code and preview panes stay responsive during generation and repair.
- Diagnostics re-run after every generation and repair pass.
- Blocking build/runtime/test errors trigger repair until clean or a proven repeated impasse.
- Warning-only diagnostics do not block completion.
- Tool projections never mutate state before tool execution succeeds.
- Tests cover projection, repair decisions, diagnostics, UI stream handling, and harness invariants.
- `npm test`, `npm run lint`, `npm run build`, and Playwright MCP smoke checks pass.
