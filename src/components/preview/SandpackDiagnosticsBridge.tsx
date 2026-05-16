"use client";

import { useEffect, useMemo, useState } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";
import { useSandpackConsole } from "@codesandbox/sandpack-react";
import type { SandpackMessage } from "@codesandbox/sandpack-client";
import type { ProjectFile } from "@/lib/types";
import type { DiagnosticBatch, ForgeDiagnostic } from "@/lib/diagnostics/types";
import { analyzeStaticDiagnostics } from "@/lib/diagnostics/staticChecks";
import { fingerprintBatch } from "@/lib/diagnostics/fingerprint";

type Props = {
  files: ProjectFile[];
  onDiagnosticsChange?: (batch: DiagnosticBatch) => void;
};

const SETTLE_DEBOUNCE_MS = 800;
const RUNNING_SETTLE_MS = 800;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringifyConsoleData(data: Array<string | Record<string, string>> | undefined): string {
  if (!data?.length) return "Console error";
  return data
    .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    .join(" ");
}

function sandpackErrorFromState(error: unknown): ForgeDiagnostic | null {
  if (!isRecord(error)) return null;
  const message = String(error.message ?? error.title ?? "Sandpack build error");
  return {
    source: "compiler",
    severity: "error",
    code: "sandpack-state-error",
    message,
    fileName: typeof error.path === "string" ? error.path : undefined,
    line: typeof error.line === "number" ? error.line : undefined,
    column: typeof error.column === "number" ? error.column : undefined,
    raw: error,
  };
}

function diagnosticFromMessage(message: SandpackMessage): ForgeDiagnostic | null {
  if (!isRecord(message)) return null;

  if (message.type === "action" && message.action === "show-error") {
    return {
      source: "compiler",
      severity: "error",
      code: "sandpack-show-error",
      message: String(message.message ?? message.title ?? "Sandpack compiler error"),
      fileName: typeof message.path === "string" ? message.path : undefined,
      line: typeof message.line === "number" ? message.line : undefined,
      column: typeof message.column === "number" ? message.column : undefined,
      raw: message,
    };
  }

  if (message.type === "action" && message.action === "notification" && message.notificationType === "error") {
    return {
      source: "compiler",
      severity: "error",
      code: "sandpack-notification-error",
      message: String(message.title ?? "Sandpack error notification"),
      raw: message,
    };
  }

  if (message.type === "test" && message.event === "file_error") {
    const error = isRecord(message.error) ? message.error : null;
    return {
      source: "test",
      severity: "error",
      code: "test-file-error",
      message: String(error?.message ?? "Test file error"),
      fileName: typeof message.path === "string" ? message.path : undefined,
      raw: message,
    };
  }

  if (message.type === "test" && message.event === "test_end") {
    const test = isRecord(message.test) ? message.test : null;
    if (test?.status !== "fail") return null;
    const errors = Array.isArray(test.errors) ? test.errors : [];
    const firstError = isRecord(errors[0]) ? errors[0] : null;
    return {
      source: "test",
      severity: "error",
      code: "test-failed",
      message: String(firstError?.message ?? `${String(test.name ?? "Test")} failed`),
      fileName: typeof test.path === "string" ? test.path : undefined,
      raw: message,
    };
  }

  if (message.type === "done" && message.compilatonError === true) {
    return {
      source: "compiler",
      severity: "error",
      code: "compile-failed",
      message: "Sandpack finished with a compilation error.",
      raw: message,
    };
  }

  return null;
}

export function resolveDiagnosticStatus(
  sandpackStatus: string,
  runningForMs: number,
  blockingCount: number
): DiagnosticBatch["status"] {
  if (blockingCount > 0) return "error";
  if ((sandpackStatus === "running" || sandpackStatus === "initial") && runningForMs < RUNNING_SETTLE_MS) {
    return "checking";
  }
  return "clean";
}

export function SandpackDiagnosticsBridge({ files, onDiagnosticsChange }: Props) {
  const { sandpack, listen } = useSandpack();
  const { logs } = useSandpackConsole({
    showSyntaxError: true,
    resetOnPreviewRestart: true,
    maxMessageCount: 50,
  });
  const [messageDiagnostics, setMessageDiagnostics] = useState<ForgeDiagnostic[]>([]);
  const [statusStartedAt, setStatusStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    return listen((message) => {
      const diagnostic = diagnosticFromMessage(message);
      if (diagnostic) {
        setMessageDiagnostics((prev) => [...prev.slice(-20), diagnostic]);
      }
    });
  }, [listen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextNow = Date.now();
      setStatusStartedAt(nextNow);
      setNow(nextNow);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sandpack.status]);

  useEffect(() => {
    if (sandpack.status !== "running" && sandpack.status !== "initial") return;
    const timer = window.setTimeout(() => setNow(Date.now()), RUNNING_SETTLE_MS + 50);
    return () => window.clearTimeout(timer);
  }, [sandpack.status]);

  const consoleDiagnostics = useMemo<ForgeDiagnostic[]>(
    () => logs
      .filter((log) => log.method === "error" || log.method === "assert")
      .map((log) => ({
        source: "runtime",
        severity: "error",
        code: "console-error",
        message: stringifyConsoleData(log.data),
        raw: log,
      })),
    [logs]
  );

  const batch = useMemo<DiagnosticBatch>(() => {
    const staticBatch = analyzeStaticDiagnostics(files);
    const stateDiagnostic = sandpackErrorFromState(sandpack.error);
    const diagnostics = [
      ...staticBatch.diagnostics,
      ...(stateDiagnostic ? [stateDiagnostic] : []),
      ...messageDiagnostics,
      ...consoleDiagnostics,
    ];
    const blockingCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
    const status = resolveDiagnosticStatus(sandpack.status, now - statusStartedAt, blockingCount);

    return {
      diagnostics,
      status,
      blockingCount,
      fingerprint: fingerprintBatch({ diagnostics }),
      updatedAt: new Date().toISOString(),
    };
  }, [consoleDiagnostics, files, messageDiagnostics, now, sandpack.error, sandpack.status, statusStartedAt]);

  useEffect(() => {
    if (!onDiagnosticsChange) return;
    const timer = window.setTimeout(() => onDiagnosticsChange(batch), SETTLE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [batch, onDiagnosticsChange]);

  return null;
}
