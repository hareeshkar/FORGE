type MiniMaxStreamToolDelta = {
  index?: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
};

export type MiniMaxStreamEvent = {
  choices?: Array<{
    delta?: {
      content?: string;
      role?: string;
      tool_calls?: MiniMaxStreamToolDelta[];
    };
    finish_reason?: "stop" | "tool_calls" | "length" | "content_filter" | null;
  }>;
  base_resp?: { status_code: number; status_msg: string };
};

export type MiniMaxStreamToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type MiniMaxStreamResponse = {
  choices: Array<{
    message: {
      role: "assistant";
      content: string;
      tool_calls?: MiniMaxStreamToolCall[];
    };
    finish_reason: "stop" | "tool_calls" | "length" | "content_filter";
  }>;
  base_resp: { status_code: number; status_msg: string };
};

export type MiniMaxStreamAccumulator = {
  content: string;
  finishReason?: "stop" | "tool_calls" | "length" | "content_filter";
  toolCalls: Map<number, MiniMaxStreamToolCall>;
};

export function parseMiniMaxStreamEvents(input: string): {
  events: MiniMaxStreamEvent[];
  remainder: string;
} {
  const events: MiniMaxStreamEvent[] = [];
  const parts = input.split("\n\n");
  const remainder = parts.pop() ?? "";

  for (const part of parts) {
    const payloads = part
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.startsWith("data:") ? line.slice(5).trim() : line);

    for (const payload of payloads) {
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as MiniMaxStreamEvent | MiniMaxStreamEvent[];
        if (Array.isArray(parsed)) {
          events.push(...parsed);
        } else {
          events.push(parsed);
        }
      } catch {
        // Keep parser tolerant of heartbeat/unknown lines.
      }
    }
  }

  return { events, remainder };
}

export function createMiniMaxStreamAccumulator(): MiniMaxStreamAccumulator {
  return { content: "", toolCalls: new Map() };
}

export function applyMiniMaxStreamEvent(
  state: MiniMaxStreamAccumulator,
  event: MiniMaxStreamEvent
): void {
  const choice = event.choices?.[0];
  if (!choice) return;

  if (choice.delta?.content) {
    state.content += choice.delta.content;
  }

  for (const delta of choice.delta?.tool_calls ?? []) {
    const index = delta.index ?? 0;
    const prev = state.toolCalls.get(index) ?? {
      id: delta.id ?? `call_${index}`,
      type: "function" as const,
      function: { name: "", arguments: "" },
    };

    state.toolCalls.set(index, {
      id: delta.id ?? prev.id,
      type: "function",
      function: {
        name: `${prev.function.name}${delta.function?.name ?? ""}`,
        arguments: `${prev.function.arguments}${delta.function?.arguments ?? ""}`,
      },
    });
  }

  if (choice.finish_reason) {
    state.finishReason = choice.finish_reason;
  }
}

export function finalizeMiniMaxStreamResponse(
  state: MiniMaxStreamAccumulator
): MiniMaxStreamResponse {
  const toolCalls = Array.from(state.toolCalls.entries())
    .sort(([a], [b]) => a - b)
    .map(([, call]) => call);

  const finishReason =
    state.finishReason ?? (toolCalls.length > 0 ? "tool_calls" : "stop");

  return {
    choices: [
      {
        message: {
          role: "assistant",
          content: state.content,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finish_reason: finishReason,
      },
    ],
    base_resp: { status_code: 0, status_msg: "" },
  };
}
