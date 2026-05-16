import type { RepairPromptInput } from "./types";

function formatLocation(fileName?: string, line?: number, column?: number): string {
  if (!fileName) return "";
  if (line == null) return `${fileName} `;
  if (column == null) return `${fileName}:${line} `;
  return `${fileName}:${line}:${column} `;
}

export function formatDiagnosticRepairPrompt(input: RepairPromptInput): string {
  const blocking = input.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const diagnosticsText = blocking
    .slice(0, 8)
    .map((diagnostic, index) => (
      `${index + 1}. [${diagnostic.source}] ${formatLocation(diagnostic.fileName, diagnostic.line, diagnostic.column)}${diagnostic.message}`
    ))
    .join("\n");

  return [
    `AUTO-REPAIR: The Sandpack preview reported build/runtime diagnostics after your last change (pass ${input.pass}/${input.maxPasses}).`,
    "Fix the root cause while preserving the requested design and behavior.",
    "Do not add npm dependencies. Keep generated code compatible with FORGE's Parcel rules.",
    "Never use optional chaining (?.), nullish coalescing (??), type=\"module\", or an HTML link tag for styles.css.",
    "Diagnostics:",
    diagnosticsText || "No blocking diagnostics were provided.",
    `Current authored files: ${input.files.map((file) => file.name).join(", ")}.`,
  ].join("\n");
}
