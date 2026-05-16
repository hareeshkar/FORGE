import type { ProjectFile } from "@/lib/types";
import type { DiagnosticBatch, ForgeDiagnostic } from "./types";
import { fingerprintBatch } from "./fingerprint";

const REQUIRED_FILES = ["index.html", "styles.css", "app.js"] as const;

function diagnostic(input: Omit<ForgeDiagnostic, "source" | "severity">): ForgeDiagnostic {
  return {
    source: "static",
    severity: "error",
    ...input,
  };
}

function isPlaceholder(content: string): boolean {
  const normalized = content.trim().toLowerCase();
  return normalized === "<!-- todo -->" || normalized === "todo" || normalized === "placeholder";
}

export function analyzeStaticDiagnostics(files: ProjectFile[]): DiagnosticBatch {
  const diagnostics: ForgeDiagnostic[] = [];
  const byName = new Map(files.map((file) => [file.name, file]));

  for (const name of REQUIRED_FILES) {
    if (!byName.has(name)) {
      diagnostics.push(diagnostic({
        code: "missing-file",
        fileName: name,
        message: `Missing required generated file: ${name}.`,
      }));
    }
  }

  for (const file of files) {
    if (file.content.trim().length === 0) {
      diagnostics.push(diagnostic({
        code: "empty-file",
        fileName: file.name,
        message: `${file.name} is empty.`,
      }));
    } else if (isPlaceholder(file.content)) {
      diagnostics.push(diagnostic({
        code: "placeholder-file",
        fileName: file.name,
        message: `${file.name} only contains placeholder content.`,
      }));
    }
  }

  const html = byName.get("index.html")?.content ?? "";
  if (html) {
    if (!/<script\b[^>]*\bsrc=["'](?:\.\/)?(?:app|index)\.js["'][^>]*>/i.test(html)) {
      diagnostics.push(diagnostic({
        code: "html-missing-script",
        fileName: "index.html",
        message: "index.html must include <script src=\"app.js\"></script> before </body>.",
      }));
    }
    if (/<script\b[^>]*\btype=["']module["'][^>]*>/i.test(html)) {
      diagnostics.push(diagnostic({
        code: "html-module-script",
        fileName: "index.html",
        message: "Sandpack's Parcel preview expects a plain script tag, not type=\"module\".",
      }));
    }
    if (/<link\b[^>]*\bhref=["'](?:\.\/)?styles\.css["'][^>]*>/i.test(html)) {
      diagnostics.push(diagnostic({
        code: "html-css-link",
        fileName: "index.html",
        message: "styles.css must be imported by app.js for Sandpack HMR; remove the HTML link tag.",
      }));
    }
  }

  const js = byName.get("app.js")?.content ?? "";
  if (js && /(\?\.)|(\?\?)/.test(js)) {
    diagnostics.push(diagnostic({
      code: "js-unsupported-syntax",
      fileName: "app.js",
      message: "Sandpack's Parcel version cannot parse optional chaining or nullish coalescing.",
    }));
  }

  const batch: DiagnosticBatch = {
    diagnostics,
    status: diagnostics.length > 0 ? "error" : "clean",
    blockingCount: diagnostics.length,
    updatedAt: new Date().toISOString(),
  };

  return { ...batch, fingerprint: fingerprintBatch(batch) };
}
