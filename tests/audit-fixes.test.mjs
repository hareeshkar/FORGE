import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("agent loop uses current MiniMax token parameter", () => {
  const source = read("src/server/minimax/agentLoop.ts");

  assert.match(source, /max_completion_tokens:\s*10_?240/);
  assert.doesNotMatch(source, /max_tokens:\s*8192/);
});

test("client timeout is aligned with server agent budget", () => {
  const client = read("src/hooks/useGenerate.ts");

  assert.match(client, /timeoutMs\s*=\s*1_500_000/);
  assert.match(client, /25 min/);
});

test("generate route uses request mode as source of truth", () => {
  const source = read("src/server/routes/generate.ts");

  assert.match(source, /mode\s*===\s*"create"/);
  assert.match(source, /CREATE MODE:/);
  assert.match(source, /EDIT MODE:/);
  assert.doesNotMatch(source, /const agentMode = currentFiles\.length > 0/);
});

test("image generation requests base64 directly from MiniMax", () => {
  const image = read("src/server/minimax/image.ts");
  const route = read("src/server/routes/image.ts");

  assert.match(image, /response_format:\s*"base64"/);
  assert.match(image, /prompt_optimizer:\s*true/);
  assert.match(route, /data:image\/jpeg;base64/);
  assert.doesNotMatch(route, /const imgRes = await fetch\(url\)/);
});

test("project persistence is debounced instead of per keystroke", () => {
  const source = read("src/hooks/useProject.ts");

  assert.match(source, /PERSIST_DEBOUNCE_MS\s*=\s*500/);
  assert.match(source, /setTimeout\(\(\) => \{/);
  assert.match(source, /clearTimeout\(timer\)/);
});

test("agent streams file content chunks before final file update", () => {
  const types = read("src/lib/types.ts");
  const agentLoop = read("src/server/minimax/agentLoop.ts");
  const events = read("src/server/minimax/harnessEvents.ts");

  assert.match(types, /type:\s*"file_stream_start"/);
  assert.match(types, /type:\s*"file_stream_chunk"/);
  assert.match(types, /type:\s*"file_stream_done"/);
  assert.match(agentLoop, /await emitFileStream\(/);
  assert.match(agentLoop, /emitFileStream/);
  assert.match(events, /type:\s*"file_stream_start"/);
  assert.match(events, /type:\s*"file_stream_chunk"/);
  assert.match(events, /type:\s*"file_stream_done"/);
  assert.ok(
    events.indexOf('type: "file_stream_start"') < events.indexOf('type: "file_stream_chunk"')
  );
  assert.ok(
    events.indexOf('type: "file_stream_chunk"') < events.indexOf('type: "file_stream_done"')
  );
  assert.doesNotMatch(agentLoop, /type:\s*"file_stream_chunk"/);
});

test("agent loop uses typed harness event helpers", () => {
  const events = read("src/server/minimax/harnessEvents.ts");
  const agentLoop = read("src/server/minimax/agentLoop.ts");

  assert.match(events, /emitToolCallStart/);
  assert.match(events, /emitToolCallResult/);
  assert.match(events, /emitFileStream/);
  assert.match(events, /emitFileUpdate/);
  assert.match(events, /emitHarnessPhase/);
  assert.match(agentLoop, /emitFileUpdate/);
  assert.doesNotMatch(agentLoop, /Agent is calling MiniMax/);
  assert.doesNotMatch(agentLoop, /type:\s*"file_update"/);
  assert.doesNotMatch(agentLoop, /type:\s*"file_stream_chunk"/);
});

test("agent loop preserves MiniMax reasoning in model history only", () => {
  const agentLoop = read("src/server/minimax/agentLoop.ts");

  assert.match(agentLoop, /content:\s*message\.content\s*\?\?\s*""/);
  assert.match(agentLoop, /summary\s*=\s*sanitizeDisplaySummary\(message\.content\s*\?\?\s*""\)\s*\|\|\s*summary/);
  assert.doesNotMatch(agentLoop, /summary\s*=\s*message\.content\?\.trim\(\)\s*\|\|\s*summary/);
});

test("agent streams projected tool edits as soon as tool args arrive", () => {
  const agentLoop = read("src/server/minimax/agentLoop.ts");
  const tools = read("src/server/minimax/tools.ts");

  assert.match(agentLoop, /streamProjectedToolUpdate/);
  assert.match(tools, /applyStringReplacements/);
  assert.match(agentLoop, /const streamedPreview = await streamProjectedToolUpdate\(toolName, args, store, emit\)/);
  assert.match(agentLoop, /if \(!streamedPreview\)/);
  assert.match(agentLoop, /case "create_file"/);
  assert.match(agentLoop, /case "edit_file"/);
  assert.match(agentLoop, /case "replace_strings"/);
});

test("client routes streamed chunks to a live editor update handler", () => {
  const hook = read("src/hooks/useGenerate.ts");
  const builder = read("src/components/layout/ForgeBuilder.tsx");

  assert.match(hook, /onFileStreamUpdate\?:/);
  assert.match(hook, /streamBuffers:\s*Map<string,\s*ProjectFile>/);
  assert.match(hook, /case "file_stream_chunk"/);
  assert.match(builder, /onFileStreamUpdate:/);
  assert.match(builder, /setMainView\("code"\)/);
});

test("code editor shows a non-blocking live streaming state", () => {
  const editor = read("src/components/editor/CodeEditor.tsx");

  assert.match(editor, /Streaming generated code/);
  assert.match(editor, /readOnly:\s*isGenerating/);
  assert.doesNotMatch(editor, /pointer-events-none absolute inset-0/);
});

test("preview panel wires Sandpack diagnostics bridge", () => {
  const preview = read("src/components/preview/PreviewPanel.tsx");
  const bridge = read("src/components/preview/SandpackDiagnosticsBridge.tsx");

  assert.match(preview, /SandpackDiagnosticsBridge/);
  assert.match(preview, /onDiagnosticsChange/);
  assert.match(bridge, /useSandpack\(/);
  assert.match(bridge, /useSandpackConsole/);
  assert.match(bridge, /analyzeStaticDiagnostics/);
  assert.match(bridge, /action === "show-error"/);
  assert.match(bridge, /event === "test_end"/);
});

test("preview panel renders diagnostic panel with manual fix action", () => {
  const preview = read("src/components/preview/PreviewPanel.tsx");
  const panel = read("src/components/preview/DiagnosticPanel.tsx");

  assert.match(preview, /DiagnosticPanel/);
  assert.match(preview, /onFixDiagnostics/);
  assert.match(panel, /Fix with AI/);
  assert.match(panel, /Clean/);
  assert.match(panel, /Checking/);
  assert.match(panel, /Fixing pass/);
});

test("builder runs guarded automatic diagnostic repair loop", () => {
  const builder = read("src/components/layout/ForgeBuilder.tsx");

  assert.match(builder, /MAX_AUTO_REPAIR_PASSES\s*=\s*12/);
  assert.match(builder, /MAX_REPEATED_DIAGNOSTIC_PASSES\s*=\s*2/);
  assert.match(builder, /seenRepairFingerprints/);
  assert.match(builder, /repairRepeatCounts/);
  assert.match(builder, /formatDiagnosticRepairPrompt/);
  assert.match(builder, /mode:\s*"fix-bug"/);
  assert.match(builder, /Diagnostics found/);
  assert.match(builder, /Preview healed after pass/);
  assert.match(builder, /repeated diagnostic fingerprint/);
  assert.doesNotMatch(builder, /Still failing after \$\{MAX_AUTO_REPAIR_PASSES\} passes/);
  assert.match(builder, /onFixDiagnostics/);
});

test("agent exposes targeted multi-replacement editing tool", () => {
  const tools = read("src/server/minimax/tools.ts");
  const agentLoop = read("src/server/minimax/agentLoop.ts");
  const hook = read("src/hooks/useGenerate.ts");

  assert.match(tools, /name:\s*"replace_strings"/);
  assert.match(tools, /replacements/);
  assert.match(tools, /applyStringReplacements/);
  assert.match(agentLoop, /replace_strings/);
  assert.match(hook, /case "replace_strings"/);
});

test("chat sessions are first-class persisted records", () => {
  const types = read("src/lib/types.ts");
  const storage = read("src/lib/storage/sessionStore.ts");
  const hook = read("src/hooks/useSessions.ts");

  assert.match(types, /export type Session =/);
  assert.match(types, /export type SessionRecord =/);
  assert.match(storage, /forge-sessions-v1/);
  assert.match(storage, /forge-session-\$\{id\}/);
  assert.match(storage, /migrateLegacyProject/);
  assert.match(hook, /function sessionsReducer/);
});

test("builder renders the chat history sidebar and creates fresh sessions", () => {
  const builder = read("src/components/layout/ForgeBuilder.tsx");
  const sidebar = read("src/components/session/ChatHistorySidebar.tsx");

  assert.match(builder, /useSessions/);
  assert.match(builder, /ChatHistorySidebar/);
  assert.match(builder, /handleNewSession/);
  assert.doesNotMatch(builder, /useProject/);
  assert.doesNotMatch(builder, /useChat/);
  assert.match(sidebar, /\+ New chat/);
  assert.match(sidebar, /Previous 7 days/);
});

test("agent guide links current MiniMax harness capability matrix", () => {
  const guide = read("FORGE.md");
  const matrix = read("docs/research/minimax-agent-harness-capability-matrix.md");

  assert.match(guide, /minimax-agent-harness-capability-matrix\.md/);
  assert.match(matrix, /chatcompletion_v2/);
  assert.match(matrix, /tool-call arguments/);
  assert.match(matrix, /projected streaming/);
  assert.match(matrix, /clean-room/);
});
