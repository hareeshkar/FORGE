import type { ForgeSSEEvent, ProjectFile } from "@/lib/types";

type Emit = (event: ForgeSSEEvent) => Promise<void>;
type HarnessPhase = Extract<ForgeSSEEvent, { type: "harness_phase" }>["phase"];

const STREAM_CHUNK_SIZE = 480;
const STREAM_CHUNK_DELAY_MS = 8;

export async function emitHarnessPhase(
  emit: Emit,
  phase: HarnessPhase,
  message: string,
  elapsedMs?: number
): Promise<void> {
  await emit({ type: "harness_phase", phase, message, elapsedMs });
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

export async function emitFileUpdate(emit: Emit, file: ProjectFile): Promise<void> {
  await emit({ type: "file_update", file });
}
