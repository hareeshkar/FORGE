"use client";

import { useMemo, useState } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
} from "@codesandbox/sandpack-react";
import type { ProjectFile } from "@/lib/types";
import { toSandpackFiles } from "@/lib/preview/toSandpackFiles";

type DeviceMode = "mobile" | "tablet" | "desktop";

type Props = {
  files: ProjectFile[];
};

const DEVICE_WIDTHS: Record<DeviceMode, number | null> = {
  mobile: 390,
  tablet: 768,
  desktop: null,
};

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="1" width="8" height="14" rx="1.5" />
      <circle cx="8" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TabletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="1" width="12" height="14" rx="1.5" />
      <circle cx="8" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2" width="14" height="10" rx="1.5" />
      <path d="M5 14h6M8 12v2" />
    </svg>
  );
}

const DEVICE_ICONS: Record<DeviceMode, React.ReactNode> = {
  mobile: <PhoneIcon />,
  tablet: <TabletIcon />,
  desktop: <MonitorIcon />,
};

const DEVICE_LABELS: Record<DeviceMode, string> = {
  mobile: "Mobile (390px)",
  tablet: "Tablet (768px)",
  desktop: "Desktop",
};

export function PreviewPanel({ files }: Props) {
  const sandpackFiles = useMemo(() => toSandpackFiles(files), [files]);
  const [device, setDevice] = useState<DeviceMode>("desktop");

  const constrainedWidth = DEVICE_WIDTHS[device];

  return (
    <SandpackProvider
      template="vanilla"
      theme="dark"
      files={sandpackFiles}
      options={{ autorun: true, recompileMode: "immediate" }}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          padding: "6px 8px",
          background: "var(--forge-panel)",
          borderBottom: "1px solid var(--forge-edge)",
          flexShrink: 0,
        }}
      >
        {(["mobile", "tablet", "desktop"] as DeviceMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setDevice(mode)}
            title={DEVICE_LABELS[mode]}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              background: device === mode ? "color-mix(in srgb, var(--forge-molt) 15%, transparent)" : "transparent",
              color: device === mode ? "var(--forge-molt)" : "var(--forge-muted)",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {DEVICE_ICONS[mode]}
          </button>
        ))}
      </div>

      {/* Preview area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          alignItems: "stretch",
          background: "var(--forge-bg)",
        }}
      >
        <div
          style={{
            width: constrainedWidth != null ? `${constrainedWidth}px` : "100%",
            maxWidth: "100%",
            height: "100%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <SandpackLayout style={{ border: "none", height: "100%", minHeight: 0, borderRadius: 0 }}>
            <SandpackPreview
              showOpenInCodeSandbox={false}
              showRefreshButton
              style={{ height: "100%", minHeight: 0, flex: 1 }}
            />
          </SandpackLayout>
        </div>
      </div>
    </SandpackProvider>
  );
}
