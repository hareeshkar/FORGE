import { Hono } from "hono";
import { hasMiniMaxKey } from "@/server/minimax/client";

export const healthRoutes = new Hono();

healthRoutes.get("/", (c) => {
  const live = hasMiniMaxKey();
  return c.json({
    ok: true,
    minimax: live,
    mode: live ? "live" : "demo",
    quotaHints: live
      ? {
          llmSearchVlm: "4500 req / 5hr rolling (Token Plan Plus)",
          image01: "50 images / day",
          docs: "/docs/token-plan-api-guide.md",
        }
      : null,
  });
});
