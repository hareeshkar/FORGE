import type { DiagnosticBatch, ForgeDiagnostic } from "./types";

function normalizeMessage(message: string): string {
  return message.toLowerCase().replace(/\s+/g, " ").trim();
}

export function fingerprintDiagnostic(diagnostic: ForgeDiagnostic): string {
  return [
    diagnostic.source,
    diagnostic.severity,
    diagnostic.code,
    diagnostic.fileName ?? "",
    diagnostic.line ?? "",
    diagnostic.column ?? "",
    normalizeMessage(diagnostic.message),
  ].join("|");
}

export function fingerprintBatch(batch: Pick<DiagnosticBatch, "diagnostics">): string {
  return batch.diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map(fingerprintDiagnostic)
    .sort()
    .join("~");
}
