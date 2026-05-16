"use client";

import type { DiagnosticBatch, RepairStatus } from "@/lib/diagnostics/types";

type Props = {
  diagnostics?: DiagnosticBatch | null;
  repairStatus?: RepairStatus;
  onFixDiagnostics?: () => void;
};

function statusLabel(diagnostics?: DiagnosticBatch | null, repairStatus?: RepairStatus): string {
  if (repairStatus?.state === "fixing") return `Fixing pass ${repairStatus.pass}/${repairStatus.maxPasses}`;
  if (repairStatus?.state === "stopped") return repairStatus.message ?? "Repair stopped";
  if (repairStatus?.state === "healed") return repairStatus.message ?? "Preview healed";
  if (!diagnostics || diagnostics.status === "checking") return "Checking...";
  if (diagnostics.blockingCount === 0) return "Clean";
  return `${diagnostics.blockingCount} issue${diagnostics.blockingCount === 1 ? "" : "s"} found`;
}

export function DiagnosticPanel({ diagnostics, repairStatus, onFixDiagnostics }: Props) {
  const blocking = diagnostics?.diagnostics.filter((diagnostic) => diagnostic.severity === "error").slice(0, 2) ?? [];
  const canFix = blocking.length > 0 && repairStatus?.state !== "fixing";

  return (
    <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-none">
      <div className="pointer-events-auto mx-auto flex max-w-3xl items-start justify-between gap-3 rounded-xl border border-[color-mix(in_oklab,var(--forge-edge)_65%,transparent)] bg-[color-mix(in_oklab,var(--forge-panel)_92%,black)] px-3 py-2 text-[11px] shadow-2xl shadow-black/35">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${blocking.length > 0 ? "bg-red-400" : diagnostics?.status === "checking" ? "bg-amber-300" : "bg-emerald-400"}`} />
            <span className="font-medium text-[var(--forge-fg)]">{statusLabel(diagnostics, repairStatus)}</span>
          </div>
          {blocking.length > 0 && (
            <div className="mt-1 space-y-0.5 text-[var(--forge-muted)]">
              {blocking.map((diagnostic, index) => (
                <p key={`${diagnostic.code}-${index}`} className="truncate">
                  [{diagnostic.source}] {diagnostic.fileName ? `${diagnostic.fileName}: ` : ""}{diagnostic.message}
                </p>
              ))}
            </div>
          )}
        </div>
        {canFix && (
          <button
            type="button"
            onClick={onFixDiagnostics}
            className="shrink-0 rounded-md bg-[var(--forge-molt)] px-2.5 py-1 text-[10px] font-semibold text-black transition hover:brightness-110"
          >
            Fix with AI
          </button>
        )}
      </div>
    </div>
  );
}
