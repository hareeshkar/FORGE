import { Hono } from "hono";
import { devMiniMaxRoutes } from "./routes/devMiniMax";
import { generateRoutes } from "./routes/generate";
import { healthRoutes } from "./routes/health";
import { imageRoutes } from "./routes/image";

const app = new Hono().basePath("/api");

app.route("/health", healthRoutes);
app.route("/generate", generateRoutes);
app.route("/image", imageRoutes);
app.route("/dev/minimax", devMiniMaxRoutes);

export default app;
