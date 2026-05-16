import { createDefaultProject } from "@/lib/files/defaultProject";
import type { Project, Session, SessionRecord, SessionStore } from "@/lib/types";

const INDEX_KEY = "forge-sessions-v1";
const LEGACY_PROJECT_KEY = "forge-project-v3";

function recordKey(id: string): string {
  return `forge-session-${id}`;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function createSession(project: Project, title: string, now: string): Session {
  return {
    id: project.id,
    title,
    projectId: project.id,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    lastMessagePreview: "",
  };
}

export function deriveSessionTitle(firstUserPrompt: string | undefined): string {
  if (!firstUserPrompt?.trim()) {
    return `Untitled — ${new Date().toLocaleDateString()}`;
  }
  const clean = firstUserPrompt.trim().replace(/\s+/g, " ");
  return clean.length > 40 ? `${clean.slice(0, 40).trimEnd()}…` : clean;
}

export function createBlankSessionRecord(title = "New FORGE build"): SessionRecord {
  const project = createDefaultProject();
  const now = new Date().toISOString();
  return {
    session: createSession(project, title, now),
    messages: [],
    project,
  };
}

export function migrateLegacyProject(): SessionRecord | null {
  const legacy = readJson<Project>(LEGACY_PROJECT_KEY);
  if (!legacy) return null;

  const now = new Date().toISOString();
  return {
    session: createSession(legacy, "First project", legacy.updatedAt || now),
    messages: [],
    project: legacy,
  };
}

export function loadSessions(): { store: SessionStore; activeRecord: SessionRecord } {
  const migrated = migrateLegacyProject();
  if (migrated) {
    const store: SessionStore = {
      version: 1,
      sessions: [migrated.session],
      activeSessionId: migrated.session.id,
    };
    saveSessionRecord(migrated);
    saveSessionStore(store);
    localStorage.removeItem(LEGACY_PROJECT_KEY);
    return { store, activeRecord: migrated };
  }

  const existing = readJson<SessionStore>(INDEX_KEY);
  if (existing?.sessions.length && existing.activeSessionId) {
    const active =
      loadSessionRecord(existing.activeSessionId) ??
      loadSessionRecord(existing.sessions[0].id);
    if (active) {
      return {
        store: {
          ...existing,
          activeSessionId: active.session.id,
          sessions: sortSessions(existing.sessions),
        },
        activeRecord: active,
      };
    }
  }

  const fresh = createBlankSessionRecord();
  const store: SessionStore = {
    version: 1,
    sessions: [fresh.session],
    activeSessionId: fresh.session.id,
  };
  saveSessionRecord(fresh);
  saveSessionStore(store);
  return { store, activeRecord: fresh };
}

export function loadSessionRecord(id: string): SessionRecord | null {
  return readJson<SessionRecord>(recordKey(id));
}

export function saveSessionRecord(record: SessionRecord): void {
  writeJson(recordKey(record.session.id), record);
}

export function saveSessionStore(store: SessionStore): void {
  writeJson(INDEX_KEY, {
    ...store,
    sessions: sortSessions(store.sessions),
  });
}

export function deleteSessionRecord(id: string): void {
  localStorage.removeItem(recordKey(id));
}

export function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
