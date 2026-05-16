"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import TemplateStarters from "@/components/chat/TemplateStarters";
import type { PromptPayload } from "@/components/chat/ChatInput";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { ChatHistorySidebar } from "@/components/session/ChatHistorySidebar";
import { useGenerate } from "@/hooks/useGenerate";
import { useSessions } from "@/hooks/useSessions";
import { formatDiagnosticRepairPrompt } from "@/lib/diagnostics/repairPrompt";
import type { DiagnosticBatch, RepairStatus } from "@/lib/diagnostics/types";
import { downloadProjectZip } from "@/lib/export/zipExport";
import { openInCodeSandbox } from "@/lib/export/openInCodeSandbox";
import type { ImageHint, ResearchSource } from "@/lib/types";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type MainView = "preview" | "code";

const MAX_AUTO_REPAIR_PASSES = 12;
const MAX_REPEATED_DIAGNOSTIC_PASSES = 2;

export function ForgeBuilder() {
  const {
    ready,
    sessions,
    activeSessionId,
    activeSession,
    messages,
    addMessage,
    project,
    activeFile,
    setActiveFile,
    updateFileContent,
    upsertFile,
    patchFileContent,
    createSession,
    openSession,
    deleteSession,
    renameSession,
  } = useSessions();
  const { generate, isGenerating } = useGenerate();
  const [researchMode, setResearchMode] = useState(true);
  const [researchEntries, setResearchEntries] = useState<ResearchSource[]>([]);
  const [mainView, setMainView] = useState<MainView>("preview");
  const [changedFiles, setChangedFiles] = useState<Set<string>>(new Set());
  const [backendMode, setBackendMode] = useState<"loading" | "live" | "demo">("loading");
  const [exportError, setExportError] = useState<string | null>(null);
  const [latestDiagnostics, setLatestDiagnostics] = useState<DiagnosticBatch | null>(null);
  const [awaitingDiagnostics, setAwaitingDiagnostics] = useState(false);
  const [autoRepairPass, setAutoRepairPass] = useState(0);
  const [repairStatus, setRepairStatus] = useState<RepairStatus>({
    state: "idle",
    pass: 0,
    maxPasses: MAX_AUTO_REPAIR_PASSES,
  });
  const seenRepairFingerprints = useRef<Set<string>>(new Set());
  const repairRepeatCounts = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { mode?: string }) => {
        if (cancelled) return;
        setBackendMode(d.mode === "live" ? "live" : "demo");
      })
      .catch(() => {
        if (!cancelled) setBackendMode("demo");
      });
    return () => { cancelled = true; };
  }, []);

  const applyImageHint = useCallback(
    (hint: ImageHint, imageUrl: string) => {
      const alt = hint.description.replace(/"/g, "&quot;");
      const imgTag = `<img src="${imageUrl}" alt="${alt}" class="forge-generated-img" loading="lazy" />`;
      patchFileContent(hint.targetFile, (html) => {
        if (html.includes(hint.placeholder)) return html.split(hint.placeholder).join(imgTag);
        const relaxed = escapeRegExp(hint.placeholder).replace(/\\s+/g, "\\s*");
        const next = html.replace(new RegExp(relaxed, "gi"), imgTag);
        return next === html ? html : next;
      });
    },
    [patchFileContent]
  );

  const resetRepairLoop = useCallback(() => {
    seenRepairFingerprints.current.clear();
    repairRepeatCounts.current.clear();
    setLatestDiagnostics(null);
    setAwaitingDiagnostics(false);
    setAutoRepairPass(0);
    setRepairStatus({ state: "idle", pass: 0, maxPasses: MAX_AUTO_REPAIR_PASSES });
  }, []);

  const launchDiagnosticRepair = useCallback(
    (batch: DiagnosticBatch, manual = false) => {
      if (!project || isGenerating || batch.blockingCount === 0) return;

      const fingerprint = batch.fingerprint ?? "";
      const repeatCount = fingerprint ? (repairRepeatCounts.current.get(fingerprint) ?? 0) + 1 : 0;
      if (!manual && fingerprint && repeatCount > MAX_REPEATED_DIAGNOSTIC_PASSES) {
        setRepairStatus({
          state: "stopped",
          pass: autoRepairPass,
          maxPasses: MAX_AUTO_REPAIR_PASSES,
          message: "Stopped after repeated diagnostic fingerprint.",
        });
        addMessage({
          role: "system",
          content: "Still failing after repeated diagnostic fingerprint; review diagnostics or ask for a different approach.",
        });
        return;
      }

      if (!manual && autoRepairPass >= MAX_AUTO_REPAIR_PASSES) {
        setRepairStatus({
          state: "stopped",
          pass: autoRepairPass,
          maxPasses: MAX_AUTO_REPAIR_PASSES,
          message: `Emergency stop after ${MAX_AUTO_REPAIR_PASSES} repair passes.`,
        });
        addMessage({
          role: "system",
          content: `Emergency stop after ${MAX_AUTO_REPAIR_PASSES} repair passes; review diagnostics or ask for a different approach.`,
        });
        return;
      }

      if (fingerprint) {
        seenRepairFingerprints.current.add(fingerprint);
        repairRepeatCounts.current.set(fingerprint, repeatCount);
      }
      const nextPass = manual ? autoRepairPass + 1 : autoRepairPass + 1;
      setAutoRepairPass(nextPass);
      setRepairStatus({
        state: "fixing",
        pass: nextPass,
        maxPasses: MAX_AUTO_REPAIR_PASSES,
        message: `Fixing pass ${nextPass}/${MAX_AUTO_REPAIR_PASSES}`,
      });
      addMessage({
        role: "system",
        content: `Diagnostics found ${batch.blockingCount} blocking error${batch.blockingCount === 1 ? "" : "s"}; starting auto-repair pass ${nextPass}/${MAX_AUTO_REPAIR_PASSES}.`,
      });

      void generate(
        {
          prompt: formatDiagnosticRepairPrompt({
            diagnostics: batch.diagnostics,
            files: project.files,
            pass: nextPass,
            maxPasses: MAX_AUTO_REPAIR_PASSES,
          }),
          currentFiles: project.files,
          mode: "fix-bug",
          researchMode,
        },
        {
          onFileUpdate: (file) => {
            upsertFile(file);
            setMainView("preview");
          },
          onFileStreamUpdate: (file) => {
            upsertFile(file);
            setMainView("code");
          },
          onChatMessage: addMessage,
          onSearchResult: (result) => setResearchEntries((prev) => [...prev, result]),
          onImageResolved: applyImageHint,
          onDone: (files) => {
            setChangedFiles(new Set(files));
            setAwaitingDiagnostics(true);
          },
        }
      );
    },
    [
      addMessage,
      applyImageHint,
      autoRepairPass,
      generate,
      isGenerating,
      project,
      researchMode,
      upsertFile,
    ]
  );

  const handleDiagnosticsChange = useCallback(
    (batch: DiagnosticBatch) => {
      setLatestDiagnostics(batch);
      if (!awaitingDiagnostics || batch.status === "checking") return;

      setAwaitingDiagnostics(false);
      if (batch.blockingCount === 0) {
        if (autoRepairPass > 0) {
          setRepairStatus({
            state: "healed",
            pass: autoRepairPass,
            maxPasses: MAX_AUTO_REPAIR_PASSES,
            message: `Preview healed after pass ${autoRepairPass}.`,
          });
          addMessage({
            role: "system",
            content: `Preview healed after pass ${autoRepairPass}.`,
          });
        } else {
          setRepairStatus({ state: "idle", pass: 0, maxPasses: MAX_AUTO_REPAIR_PASSES });
        }
        seenRepairFingerprints.current.clear();
        setAutoRepairPass(0);
        return;
      }

      launchDiagnosticRepair(batch);
    },
    [addMessage, autoRepairPass, awaitingDiagnostics, launchDiagnosticRepair]
  );

  const handleFixDiagnostics = useCallback(() => {
    if (latestDiagnostics) {
      launchDiagnosticRepair(latestDiagnostics, true);
    }
  }, [latestDiagnostics, launchDiagnosticRepair]);

  const handleSubmit = useCallback(
    (payload: PromptPayload) => {
      if (!project) return;
      resetRepairLoop();
      addMessage({ role: "user", content: payload.prompt });
      setResearchEntries([]);
      setChangedFiles(new Set());
      const mode = messages.length === 0 ? "create" : "modify";
      void generate(
        {
          prompt: payload.prompt,
          currentFiles: project.files,
          mode,
          researchMode,
          uploadedImageBase64: payload.uploadedImageBase64,
          uploadedImageMime: payload.uploadedImageMime,
        },
        {
          onFileUpdate: (file) => {
            upsertFile(file);
            setMainView("preview");
          },
          onFileStreamUpdate: (file) => {
            upsertFile(file);
            setMainView("code");
          },
          onChatMessage: addMessage,
          onSearchResult: (result) => setResearchEntries((prev) => [...prev, result]),
          onImageResolved: applyImageHint,
          onDone: (files) => {
            setChangedFiles(new Set(files));
            setAwaitingDiagnostics(true);
          },
        }
      );
    },
    [project, messages.length, researchMode, generate, addMessage, upsertFile, applyImageHint, resetRepairLoop]
  );

  const handleTemplateSelect = useCallback(
    (prompt: string) => handleSubmit({ prompt }),
    [handleSubmit]
  );

  const handleNewSession = useCallback(() => {
    if (isGenerating) {
      setExportError("Generation in progress — wait before starting a new chat.");
      return;
    }
    setExportError(null);
    setResearchEntries([]);
    setChangedFiles(new Set());
    resetRepairLoop();
    setMainView("preview");
    createSession();
  }, [isGenerating, createSession, resetRepairLoop]);

  const handleOpenSession = useCallback(
    (id: string) => {
      if (isGenerating) {
        setExportError("Generation in progress — wait before switching chats.");
        return;
      }
      setExportError(null);
      setResearchEntries([]);
      setChangedFiles(new Set());
      resetRepairLoop();
      setMainView("preview");
      openSession(id);
    },
    [isGenerating, openSession, resetRepairLoop]
  );

  const handleDownloadZip = useCallback(async () => {
    if (!project) return;
    setExportError(null);
    try {
      await downloadProjectZip(project.files, project.name);
    } catch {
      setExportError("ZIP export failed — try again.");
    }
  }, [project]);

  const handleOpenCodeSandbox = useCallback(() => {
    if (!project) return;
    setExportError(null);
    try {
      openInCodeSandbox(project.files);
    } catch {
      setExportError("CodeSandbox open failed — check your popup blocker.");
    }
  }, [project]);

  if (!ready || !project || !activeFile) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--forge-bg)] text-[var(--forge-muted)]">
        Loading studio…
      </div>
    );
  }

  const showDevLink = process.env.NODE_ENV === "development";
  const hasFiles = project.files.some((f) => f.content.length > 50);

  return (
    <div className="forge-app flex h-screen overflow-hidden bg-[var(--forge-bg)] text-[var(--forge-fg)]">

      {/* ── Left sidebar ──────────────────────────────────────────── */}
      <aside className="relative z-10 flex w-[360px] shrink-0 flex-col border-r border-[color-mix(in_oklab,var(--forge-edge)_55%,transparent)] bg-[color-mix(in_oklab,var(--forge-panel)_60%,black)]">

        {/* Sidebar header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[color-mix(in_oklab,var(--forge-edge)_55%,transparent)] px-4 py-3">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="font-forge-display text-lg font-bold tracking-tight text-[var(--forge-molt)]">
                FORGE
              </span>
              {backendMode === "live" && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live
                </span>
              )}
              {backendMode === "demo" && (
                <span className="flex items-center gap-1 text-[10px] text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Demo
                </span>
              )}
            </div>
            <p className="font-forge-body text-[10px] italic text-[var(--forge-muted)]">
              Search-first codegen
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {showDevLink && (
              <Link
                href="/dev/minimax"
                className="rounded-md px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--forge-muted)] transition hover:text-[var(--forge-molt)]"
              >
                probe
              </Link>
            )}
            <button
              type="button"
              onClick={handleNewSession}
              className="rounded-md border border-[color-mix(in_oklab,var(--forge-edge)_70%,transparent)] px-2.5 py-1 text-[11px] text-[var(--forge-muted)] transition hover:border-[var(--forge-molt)] hover:text-[var(--forge-fg)]"
            >
              New
            </button>
          </div>
        </div>

        {/* Demo mode warning */}
        {backendMode === "demo" && (
          <div className="shrink-0 border-b border-amber-800/40 bg-amber-950/60 px-4 py-2 text-[11px] text-amber-200/90">
            No <code className="rounded bg-black/40 px-1">MINIMAX_API_KEY</code> — add to{" "}
            <code className="rounded bg-black/40 px-1">.env.local</code> and restart dev server.
          </div>
        )}

        {/* Edit mode badge — shown after first generation when files exist */}
        {hasFiles && messages.length > 0 && !isGenerating && (
          <div className="shrink-0 border-b border-[color-mix(in_oklab,var(--forge-edge)_45%,transparent)] bg-[color-mix(in_oklab,var(--forge-panel)_40%,black)] px-4 py-2">
            <p className="text-[10px] text-[var(--forge-muted)]">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-sky-400 align-middle" />
              Editing {project.files.length} file{project.files.length !== 1 ? "s" : ""} — describe your change
            </p>
          </div>
        )}

        {activeSession && (
          <div className="shrink-0 border-b border-[color-mix(in_oklab,var(--forge-edge)_45%,transparent)] px-4 py-2">
            <p className="truncate text-[10px] text-[var(--forge-muted)]">
              Session: <span className="text-[var(--forge-fg)]">{activeSession.title}</span>
            </p>
          </div>
        )}

        {/* Template starters — shown only before first generation */}
        {messages.length === 0 && !isGenerating && (
          <div className="shrink-0 border-b border-[color-mix(in_oklab,var(--forge-edge)_45%,transparent)] px-4 py-3">
            <TemplateStarters
              onSelect={handleTemplateSelect}
              disabled={isGenerating}
            />
          </div>
        )}

        {/* Chat — fills remaining height */}
        <div className="min-h-0 flex-1">
          <ChatPanel
            messages={messages}
            researchEntries={researchEntries}
            onSubmit={handleSubmit}
            disabled={isGenerating}
            researchMode={researchMode}
            onResearchModeChange={setResearchMode}
          />
        </div>
      </aside>

      <ChatHistorySidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isGenerating={isGenerating}
        onNewSession={handleNewSession}
        onOpenSession={handleOpenSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
      />

      {/* ── Main content ──────────────────────────────────────────── */}
      <main className="relative flex min-w-0 flex-1 flex-col">

        {/* Top bar */}
        <div className="flex shrink-0 items-center border-b border-[color-mix(in_oklab,var(--forge-edge)_55%,transparent)] bg-[color-mix(in_oklab,var(--forge-panel)_70%,black)]">

          {/* File tabs (code view) / label (preview view) */}
          <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
            {mainView === "code" ? (
              project.files.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => {
                    setActiveFile(f.name);
                    setChangedFiles((prev) => { const n = new Set(prev); n.delete(f.name); return n; });
                  }}
                  className={`shrink-0 border-b-2 px-4 py-3 font-mono text-[11px] font-medium tracking-tight transition ${
                    activeFile.name === f.name
                      ? "border-[var(--forge-molt)] text-[var(--forge-molt)]"
                      : "border-transparent text-[var(--forge-muted)] hover:text-[var(--forge-fg)]"
                  }`}
                >
                  <span className="relative">
                    {f.name}
                    {changedFiles.has(f.name) && (
                      <span className="absolute -right-2 -top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    )}
                  </span>
                </button>
              ))
            ) : (
              <span className="px-4 py-3 font-forge-body text-[10px] uppercase tracking-[0.18em] text-[var(--forge-muted)]">
                Live preview
              </span>
            )}
          </div>

          {/* Export actions + Code/Preview toggle */}
          <div className="flex shrink-0 items-center gap-2 px-3 py-2">
            {/* Export error toast */}
            {exportError && (
              <span className="text-[10px] text-red-400">{exportError}</span>
            )}

            {/* Open in CodeSandbox */}
            {hasFiles && (
              <button
                type="button"
                onClick={handleOpenCodeSandbox}
                title="Open in CodeSandbox"
                className="flex items-center gap-1.5 rounded-md border border-[color-mix(in_oklab,var(--forge-edge)_60%,transparent)] px-2.5 py-1.5 text-[11px] text-[var(--forge-muted)] transition hover:border-[color-mix(in_oklab,var(--forge-molt)_50%,transparent)] hover:text-[var(--forge-fg)]"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9" />
                  <path d="M10 2h4v4" />
                  <path d="M14 2L8 8" />
                </svg>
                CodeSandbox
              </button>
            )}

            {/* Download ZIP */}
            {hasFiles && (
              <button
                type="button"
                onClick={() => void handleDownloadZip()}
                title="Download project as ZIP"
                className="flex items-center gap-1.5 rounded-md border border-[color-mix(in_oklab,var(--forge-edge)_60%,transparent)] px-2.5 py-1.5 text-[11px] text-[var(--forge-muted)] transition hover:border-[color-mix(in_oklab,var(--forge-molt)_50%,transparent)] hover:text-[var(--forge-fg)]"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v9M5 8l3 3 3-3" />
                  <path d="M2 13h12" />
                </svg>
                Export ZIP
              </button>
            )}

            {/* Code / Preview toggle */}
            <div className="flex rounded-lg border border-[color-mix(in_oklab,var(--forge-edge)_60%,transparent)] bg-black/30 p-0.5">
              <button
                type="button"
                onClick={() => setMainView("code")}
                className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition ${
                  mainView === "code"
                    ? "bg-[var(--forge-molt)] text-black"
                    : "text-[var(--forge-muted)] hover:text-[var(--forge-fg)]"
                }`}
              >
                Code
              </button>
              <button
                type="button"
                onClick={() => setMainView("preview")}
                className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition ${
                  mainView === "preview"
                    ? "bg-[var(--forge-molt)] text-black"
                    : "text-[var(--forge-muted)] hover:text-[var(--forge-fg)]"
                }`}
              >
                Preview
              </button>
            </div>
          </div>
        </div>

        {/* Main panel — code editor and preview always mounted */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className={`absolute inset-0 transition-opacity duration-150 ${mainView === "code" ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"}`}>
            <div className="h-full bg-[#141414]">
              <CodeEditor
                file={activeFile}
                onChange={(content) => updateFileContent(activeFile.name, content)}
                isGenerating={isGenerating}
                isChanged={changedFiles.has(activeFile.name)}
              />
            </div>
          </div>
          <div className={`absolute inset-0 transition-opacity duration-150 ${mainView === "preview" ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"}`}>
            <PreviewPanel
              files={project.files}
              diagnostics={latestDiagnostics}
              repairStatus={repairStatus}
              onDiagnosticsChange={handleDiagnosticsChange}
              onFixDiagnostics={handleFixDiagnostics}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
