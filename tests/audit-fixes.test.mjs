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

  assert.match(types, /type:\s*"file_stream_start"/);
  assert.match(types, /type:\s*"file_stream_chunk"/);
  assert.match(types, /type:\s*"file_stream_done"/);
  assert.match(agentLoop, /await streamFileUpdate\(/);
  assert.match(agentLoop, /type:\s*"file_stream_chunk"/);
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
