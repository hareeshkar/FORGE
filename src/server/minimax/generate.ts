import type { GenerationResponse, ImageHint, ProjectFile } from "@/lib/types";
import { inferLanguage } from "@/lib/files/defaultProject";
import { minimaxPost } from "./client";

const SYSTEM_PROMPT = `You are FORGE, an expert web developer AI that generates complete,
working web applications from descriptions and existing code.

CRITICAL RULES:
1. ALWAYS return valid JSON matching the exact schema below — no exceptions
2. Generate COMPLETE file contents, never partial snippets or diffs
3. Use modern, accessible, production-quality code
4. Include all CSS in styles.css, all JS in app.js, root HTML in index.html (FORGE preview bundles CSS via Parcel: use \`<script src="index.js"></script>\` — no type="module"; omit \`<link href="styles.css">\` — CSS is auto-imported from the JS entry)
5. For React: use CDN imports (no npm) — import React from 'https://esm.sh/react@18'
6. Images: mark placeholders as <!-- IMAGE:description --> (no spaces inside markers) in HTML
7. Never include placeholder comments like "// add your code here"
8. Never truncate — write the complete implementation
9. In app.js for Sandpack vanilla: do NOT use optional chaining (?.) or nullish coalescing (??); use explicit null checks (var el = document.getElementById("x"); if (el) { ... })

RESPONSE FORMAT — return ONLY this JSON, nothing before or after:
{
  "files": [
    { "name": "index.html", "content": "complete HTML content" },
    { "name": "styles.css", "content": "complete CSS content" },
    { "name": "app.js", "content": "complete JS content" }
  ],
  "summary": "One sentence describing what was built or changed",
  "image_hints": [
    { "placeholder": "<!-- IMAGE:hero mountain sunrise -->", "description": "hero mountain sunrise", "targetFile": "index.html" }
  ]
}
Only include image_hints when the HTML contains <!-- IMAGE:... --> markers.`;

type M27Response = {
  choices: Array<{ message: { content: string } }>;
};

function parseGenerationJson(raw: string): {
  files: Array<{ name: string; content: string }>;
  summary: string;
  image_hints?: ImageHint[];
} {
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as {
    files: Array<{ name: string; content: string }>;
    summary: string;
    image_hints?: ImageHint[];
  };
}

async function callM27(userMessage: string): Promise<string> {
  const resp = await minimaxPost<M27Response>(
    "/v1/text/chatcompletion_v2",
    {
      model: "MiniMax-M2.7",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 1.0,
      max_tokens: 8192,
      n: 1,
    },
    120_000
  );

  const content = resp.choices[0]?.message?.content ?? "";
  return content;
}

export async function generateCode(
  prompt: string,
  currentFiles: ProjectFile[],
  searchContext: string,
  imageAnalysis?: string
): Promise<GenerationResponse> {
  const filesContext =
    currentFiles.length > 0
      ? `=== Current project files ===\n\n` +
        currentFiles.map((f) => `--- ${f.name} ---\n${f.content}`).join("\n\n")
      : "No existing files. Create a new project from scratch.";

  const imageContext = imageAnalysis
    ? `=== Uploaded design (analyzed by vision AI) ===\n${imageAnalysis}\n\nRecreate this design in code.`
    : "";

  const baseUserMessage = [
    searchContext,
    imageContext,
    filesContext,
    `=== User request ===\n${prompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let raw = await callM27(baseUserMessage);

  if (!raw.trim()) {
    raw = await callM27(
      `${baseUserMessage}\n\nYour previous reply had empty content. Output ONLY the JSON object now — complete files, valid syntax.`
    );
  }

  let parsed: ReturnType<typeof parseGenerationJson>;
  try {
    parsed = parseGenerationJson(raw);
  } catch {
    raw = await callM27(
      `${baseUserMessage}\n\nYour previous reply was not valid JSON. Return ONLY the JSON object matching the schema — no markdown fences, no commentary.`
    );
    try {
      parsed = parseGenerationJson(raw);
    } catch (err) {
      throw new Error(
        `Generation returned invalid JSON after retry: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const files: ProjectFile[] = parsed.files.map((f) => ({
    name: f.name,
    content: f.content,
    language: inferLanguage(f.name),
  }));

  return {
    files,
    summary: parsed.summary,
    searchQueries: [],
    imageHints: parsed.image_hints ?? [],
  };
}
