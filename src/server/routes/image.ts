import { Hono } from "hono";
import { hasMiniMaxKey } from "@/server/minimax/client";
import { generateAsset } from "@/server/minimax/image";

export const imageRoutes = new Hono();

imageRoutes.post("/", async (c) => {
  const { description } = await c.req.json<{ description: string }>();

  if (!description?.trim()) {
    return c.json({ error: "description required" }, 400);
  }

  if (!hasMiniMaxKey()) {
    const placeholderUrl = `https://placehold.co/800x450/1c1917/f97316?text=${encodeURIComponent(description.slice(0, 28))}`;
    try {
      const imgRes = await fetch(placeholderUrl);
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        const b64 = Buffer.from(buf).toString("base64");
        const contentType = imgRes.headers.get("content-type") ?? "image/png";
        return c.json({ url: `data:${contentType};base64,${b64}`, demo: true });
      }
    } catch {
      // fall through to returning the raw URL if fetch fails
    }
    return c.json({ url: placeholderUrl, demo: true });
  }

  try {
    const b64 = await generateAsset(description);
    return c.json({ url: `data:image/jpeg;base64,${b64}`, demo: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    return c.json({ error: message }, 502);
  }
});
