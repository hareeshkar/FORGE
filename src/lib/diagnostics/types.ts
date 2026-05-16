import type { ProjectFile } from "@/lib/types";

export type DiagnosticSource = "static" | "compiler" | "runtime" | "test";
export type DiagnosticSeverity = "error" | "warning" | "info";
export type DiagnosticStatus = "checking" | "clean" | "error";
export type RepairState = "idle" | "checking" | "fixing" | "stopped" | "healed";

export type ForgeDiagnostic = {
  source: DiagnosticSource;
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  fileName?: string;
  line?: number;
  column?: number;
  raw?: unknown;
};

export type DiagnosticBatch = {
  diagnostics: ForgeDiagnostic[];
  status: DiagnosticStatus;
  blockingCount: number;
  fingerprint?: string;
  updatedAt?: string;
};

export type RepairStatus = {
  state: RepairState;
  pass: number;
  maxPasses: number;
  message?: string;
};

export type RepairPromptInput = {
  diagnostics: ForgeDiagnostic[];
  files: ProjectFile[];
  pass: number;
  maxPasses: number;
};
