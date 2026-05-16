const BASE = "https://api.minimax.io";

export class MiniMaxError extends Error {
  constructor(
    public code: number,
    public msg: string
  ) {
    super(formatMiniMaxUserMessage(code, msg));
    this.name = "MiniMaxError";
  }
}

function formatMiniMaxUserMessage(code: number, msg: string): string {
  switch (code) {
    case 1002:
      return `MiniMax rate limit — please wait a minute and try again. (${msg})`;
    case 1004:
    case 2049:
      return `MiniMax authentication failed — check MINIMAX_API_KEY. (${msg})`;
    case 2056:
      return `MiniMax quota exhausted for this window — try again later. (${msg})`;
    default:
      return `MiniMax ${code}: ${msg}`;
  }
}

export function hasMiniMaxKey(): boolean {
  return Boolean(process.env.MINIMAX_API_KEY?.trim());
}

export async function minimaxPost<T>(
  path: string,
  body: unknown,
  timeoutMs = 30_000
): Promise<T> {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) throw new Error("MINIMAX_API_KEY is not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let data: T & {
      base_resp?: { status_code: number; status_msg: string };
    };

    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new Error(
        `MiniMax invalid JSON (HTTP ${res.status}): ${text.slice(0, 200)}`
      );
    }

    if (!res.ok && (!data.base_resp || data.base_resp.status_code === undefined)) {
      throw new Error(`MiniMax HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new MiniMaxError(data.base_resp.status_code, data.base_resp.status_msg);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function minimaxStream<T>(
  path: string,
  body: Record<string, unknown>,
  onEvent: (event: T) => Promise<void> | void,
  parseEvents: (input: string) => { events: T[]; remainder: string },
  timeoutMs = 30_000
): Promise<void> {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) throw new Error("MINIMAX_API_KEY is not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ ...body, stream: true }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MiniMax HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    if (!res.body) throw new Error("MiniMax streaming response had no body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parsed = parseEvents(buffer);
      buffer = parsed.remainder;
      for (const event of parsed.events) {
        const baseResp = (event as { base_resp?: { status_code: number; status_msg: string } }).base_resp;
        if (baseResp && baseResp.status_code !== 0) {
          throw new MiniMaxError(baseResp.status_code, baseResp.status_msg);
        }
        await onEvent(event);
      }
    }

    const final = parseEvents(`${buffer}\n\n`);
    for (const event of final.events) {
      await onEvent(event);
    }
  } finally {
    clearTimeout(timer);
  }
}
