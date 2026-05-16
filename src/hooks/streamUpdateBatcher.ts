import type { ProjectFile } from "@/lib/types";

type StreamUpdateHandler = (file: ProjectFile) => void;
type ScheduleFrame = (callback: () => void) => number;
type CancelFrame = (id: number) => void;

function scheduleNextFrame(callback: () => void): number {
  if (typeof requestAnimationFrame === "function") {
    return requestAnimationFrame(callback);
  }
  return setTimeout(callback, 16) as unknown as number;
}

function cancelNextFrame(id: number) {
  if (typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(id);
    return;
  }
  clearTimeout(id);
}

export function createStreamUpdateBatcher(
  scheduleFrame: ScheduleFrame = scheduleNextFrame,
  cancelFrame: CancelFrame = cancelNextFrame
) {
  const pendingStreamUpdates = new Map<string, { file: ProjectFile; handler?: StreamUpdateHandler }>();
  let streamFlushId: number | null = null;
  let streamFlushVersion = 0;

  function flushPendingStreamUpdates(expectedVersion = streamFlushVersion) {
    if (expectedVersion !== streamFlushVersion) return;
    streamFlushId = null;
    for (const { file, handler } of pendingStreamUpdates.values()) {
      handler?.(file);
    }
    pendingStreamUpdates.clear();
  }

  function scheduleStreamFlush() {
    if (streamFlushId !== null) return;
    const scheduledVersion = streamFlushVersion;
    streamFlushId = scheduleFrame(() => flushPendingStreamUpdates(scheduledVersion));
  }

  return {
    schedule(file: ProjectFile, handler?: StreamUpdateHandler) {
      pendingStreamUpdates.set(file.name, { file, handler });
      scheduleStreamFlush();
    },
    flush() {
      if (streamFlushId !== null) {
        cancelFrame(streamFlushId);
        streamFlushId = null;
      }
      streamFlushVersion += 1;
      flushPendingStreamUpdates();
    },
  };
}
