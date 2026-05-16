import { Hono } from "hono";
import { hasMiniMaxKey, minimaxPost } from "@/server/minimax/client";
import { searchAndStreamDocs } from "@/server/minimax/search";

/** Dev-only: probe MiniMax params from docs. Blocked in production. */
export const devMiniMaxRoutes = new Hono();

devMiniMaxRoutes.use("*", async (c, next) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Not available" }, 404);
  }
  await next();
});

devMiniMaxRoutes.get("/status", (c) => {
  return c.json({
    nodeEnv: process.env.NODE_ENV,
    minimaxConfigured: hasMiniMaxKey(),
    docs: "See /docs/minimax-api-reference.md",
  });
});

devMiniMaxRoutes.post("/probe-chat", async (c) => {
  if (!hasMiniMaxKey()) {
    return c.json({ error: "MINIMAX_API_KEY not set" }, 400);
  }

  type M27 = { choices: Array<{ message: { content: string } }> };

  const body = await c.req.json<{ prompt?: string }>();
  const prompt =
    body.prompt ??
    'Reply with exactly three words: forge demo ok';

  const resp = await minimaxPost<M27>("/v1/text/chatcompletion_v2", {
    model: "MiniMax-M2.7",
    messages: [{ role: "user", content: prompt }],
    temperature: 1.0,
    max_tokens: 384,
    n: 1,
  });

  const msg = resp.choices[0]?.message;
  return c.json({
    ok: true,
    content: msg?.content ?? "",
    note: "max_tokens≥256 required for M2.7 reasoning (see docs/smoke-test-results.md)",
  });
});

devMiniMaxRoutes.post("/probe-search", async (c) => {
  if (!hasMiniMaxKey()) {
    return c.json({ error: "MINIMAX_API_KEY not set" }, 400);
  }

  const body = await c.req.json<{ q?: string }>();
  const q = body.q ?? "Tailwind CSS grid utilities";

  const noop = async () => {};
  const { context, resultCount } = await searchAndStreamDocs(q, noop);

  return c.json({
    ok: true,
    q,
    resultCount,
    contextPreview: context.slice(0, 400),
    note: 'Body must use { "q": "..." } not "query"',
  });
});
