"use client";

import dynamic from "next/dynamic";
import type { ProjectFile } from "@/lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#1e1e1e] text-sm text-zinc-500">
      Loading editor…
    </div>
  ),
});

type Props = {
  file: ProjectFile;
  onChange: (content: string) => void;
  isGenerating: boolean;
  isChanged?: boolean;
};

export function CodeEditor({ file, onChange, isGenerating, isChanged }: Props) {
  return (
    <div className="relative h-full min-h-0">
      {isChanged && !isGenerating && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 border-b border-emerald-800/40 bg-emerald-950/60 px-4 py-1.5 text-[11px] text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          File updated by FORGE
        </div>
      )}
      {isGenerating && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between border-b border-orange-800/40 bg-[#120c06]/85 px-4 py-1.5 text-[11px] text-orange-300 shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
            Streaming generated code
          </span>
          <span className="font-mono text-[10px] text-orange-200/70">{file.name}</span>
        </div>
      )}
      <MonacoEditor
        height="100%"
        language={file.language}
        value={file.content}
        onChange={(value) => onChange(value ?? "")}
        theme="vs-dark"
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          padding: { top: isGenerating || isChanged ? 40 : 16 },
          fontFamily: "var(--font-geist-mono), 'JetBrains Mono', monospace",
          readOnly: isGenerating,
          domReadOnly: isGenerating,
        }}
      />
    </div>
  );
}
