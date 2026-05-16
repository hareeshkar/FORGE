import type { ForgeSSEEvent, GenerationRequest, ProjectFile } from "@/lib/types";

/** Dev/demo SSE when MINIMAX_API_KEY is missing */
export async function* mockGenerateStream(
  request: GenerationRequest
): AsyncGenerator<ForgeSSEEvent> {
  const queries = ["vanilla HTML CSS JS best practices 2026"];

  for (const query of queries) {
    yield { type: "search_start", query };
    yield {
      type: "search_result",
      query,
      title: "MDN — HTML basics",
      snippet: "Use semantic elements, link stylesheets, and defer scripts for modern pages.",
      url: "https://developer.mozilla.org/en-US/docs/Learn/HTML",
    };
    yield {
      type: "search_result",
      query,
      title: "MDN — CSS layout",
      snippet: "Flexbox and grid are the primary tools for responsive layouts in 2026.",
      url: "https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout",
    };
    yield { type: "search_done", query, resultCount: 2 };
  }

  yield { type: "generating", message: "Writing your app (demo mode)…" };

  const files: ProjectFile[] = buildMockFiles(request.prompt);

  for (const file of files) {
    await delay(400);
    yield { type: "file_update", file };
  }

  yield {
    type: "done",
    summary: `Built a demo page for: "${request.prompt.slice(0, 80)}" (add MINIMAX_API_KEY for live generation)`,
    filesChanged: files.map((f) => f.name),
  };
}

function buildMockFiles(prompt: string): ProjectFile[] {
  const title = prompt.slice(0, 40) || "FORGE Demo";
  return [
    {
      name: "index.html",
      language: "html",
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <main class="wrap">
    <h1>${escapeHtml(title)}</h1>
    <p>Generated in demo mode. Set MINIMAX_API_KEY for live M2.7 + search.</p>
    <button id="btn">Click me</button>
  </main>
  <script src="index.js"></script>
</body>
</html>`,
    },
    {
      name: "styles.css",
      language: "css",
      content: `body { margin: 0; font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; min-height: 100vh; display: grid; place-items: center; }
.wrap { text-align: center; padding: 2rem; max-width: 28rem; }
h1 { color: #f97316; margin-bottom: 0.5rem; }
p { color: #94a3b8; line-height: 1.6; margin-bottom: 1.25rem; }
#btn { background: #f97316; color: #0f172a; border: none; padding: 0.65rem 1.25rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
#btn:hover { background: #fb923c; }`,
    },
    {
      name: "app.js",
      language: "javascript",
      content: `(function () {
  var btn = document.getElementById("btn");
  if (btn) {
    btn.addEventListener("click", function () {
      alert("FORGE demo — Monaco + Sandpack + research trace ready!");
    });
  }
})();`,
    },
  ];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
