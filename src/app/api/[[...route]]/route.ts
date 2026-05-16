import { handle } from "hono/vercel";
import app from "@/server";

/** MiniMax client uses Node APIs (Buffer); avoid Edge bundle surprises */
export const runtime = "nodejs";

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
