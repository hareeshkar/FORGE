"use client";

type Props = {
  files: { name: string }[];
  activeFile: string;
  onSelect: (name: string) => void;
};

export function FileTabs({ files, activeFile, onSelect }: Props) {
  return (
    <div className="flex shrink-0 gap-0.5 border-b border-[color-mix(in_oklab,var(--forge-edge)_55%,transparent)] bg-[color-mix(in_oklab,var(--forge-panel)_90%,black)] px-2">
      {files.map((f) => (
        <button
          key={f.name}
          type="button"
          onClick={() => onSelect(f.name)}
          className={`font-mono px-3 py-2 text-[11px] font-medium tracking-tight transition ${
            activeFile === f.name
              ? "border-b-[3px] border-[var(--forge-molt)] text-[var(--forge-molt)]"
              : "border-b-[3px] border-transparent text-[var(--forge-muted)] hover:text-[var(--forge-fg)]"
          }`}
        >
          {f.name}
        </button>
      ))}
    </div>
  );
}
