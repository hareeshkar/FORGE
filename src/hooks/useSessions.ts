"use client";

import { useCallback, useEffect, useReducer } from "react";
import { inferLanguage } from "@/lib/files/defaultProject";
import {
  createBlankSessionRecord,
  deleteSessionRecord,
  deriveSessionTitle,
  loadSessionRecord,
  loadSessions,
  saveSessionRecord,
  saveSessionStore,
  sortSessions,
} from "@/lib/storage/sessionStore";
import type { ChatMessage, ProjectFile, Session, SessionRecord, SessionStore } from "@/lib/types";

const PERSIST_DEBOUNCE_MS = 500;

type State = {
  ready: boolean;
  store: SessionStore | null;
  activeRecord: SessionRecord | null;
};

type Action =
  | { type: "loaded"; store: SessionStore; activeRecord: SessionRecord }
  | { type: "set_active"; store: SessionStore; activeRecord: SessionRecord }
  | { type: "set_record"; activeRecord: SessionRecord }
  | { type: "update_record"; updater: (record: SessionRecord) => SessionRecord }
  | { type: "set_sessions"; sessions: Session[]; activeRecord?: SessionRecord };

const initialState: State = {
  ready: false,
  store: null,
  activeRecord: null,
};

export function sessionsReducer(state: State, action: Action): State {
  switch (action.type) {
    case "loaded":
      return { ready: true, store: action.store, activeRecord: action.activeRecord };
    case "set_active":
      return { ready: true, store: action.store, activeRecord: action.activeRecord };
    case "set_record": {
      if (!state.store) return state;
      const sessions = sortSessions(
        state.store.sessions.map((s) =>
          s.id === action.activeRecord.session.id ? action.activeRecord.session : s
        )
      );
      return {
        ...state,
        store: { ...state.store, sessions, activeSessionId: action.activeRecord.session.id },
        activeRecord: action.activeRecord,
      };
    }
    case "update_record": {
      if (!state.activeRecord) return state;
      return sessionsReducer(state, {
        type: "set_record",
        activeRecord: action.updater(state.activeRecord),
      });
    }
    case "set_sessions": {
      if (!state.store) return state;
      return {
        ...state,
        store: { ...state.store, sessions: sortSessions(action.sessions) },
        activeRecord: action.activeRecord ?? state.activeRecord,
      };
    }
    default:
      return state;
  }
}

function summarizeMessage(content: string): string {
  return content.trim().replace(/\s+/g, " ").slice(0, 88);
}

function updateSessionMeta(record: SessionRecord, messages: ChatMessage[]): Session {
  const last = [...messages].reverse().find((m) => m.role !== "system");
  const firstUser = messages.find((m) => m.role === "user");
  const shouldRetitle =
    record.messages.length === 0 &&
    record.session.title === "New FORGE build" &&
    firstUser?.content;

  return {
    ...record.session,
    title: shouldRetitle
      ? deriveSessionTitle(firstUser.content)
      : record.session.title,
    updatedAt: new Date().toISOString(),
    messageCount: messages.length,
    lastMessagePreview: last ? summarizeMessage(last.content) : record.session.lastMessagePreview,
  };
}

export function useSessions() {
  const [state, dispatch] = useReducer(sessionsReducer, initialState);

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({ type: "loaded", ...loadSessions() });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!state.store || !state.activeRecord) return;
    const timer = setTimeout(() => {
      try {
        saveSessionStore(state.store!);
        saveSessionRecord(state.activeRecord!);
      } catch {
        /* ignore storage quota/private mode failures */
      }
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.store, state.activeRecord]);

  function dispatchRecord(updater: (record: SessionRecord) => SessionRecord): void {
    dispatch({ type: "update_record", updater });
  }

  const setActiveFile = useCallback((name: string) => {
    dispatchRecord((record) => ({
      ...record,
      project: { ...record.project, activeFile: name, updatedAt: new Date().toISOString() },
    }));
  }, []);

  const updateFileContent = useCallback((name: string, content: string) => {
    dispatchRecord((record) => ({
      ...record,
      project: {
        ...record.project,
        updatedAt: new Date().toISOString(),
        files: record.project.files.map((f) => (f.name === name ? { ...f, content } : f)),
      },
      session: { ...record.session, updatedAt: new Date().toISOString() },
    }));
  }, []);

  const upsertFile = useCallback((file: ProjectFile) => {
    dispatchRecord((record) => {
      const exists = record.project.files.some((f) => f.name === file.name);
      const nextFile = { ...file, language: file.language ?? inferLanguage(file.name) };
      const updatedAt = new Date().toISOString();
      return {
        ...record,
        session: { ...record.session, updatedAt },
        project: {
          ...record.project,
          activeFile: file.name,
          updatedAt,
          files: exists
            ? record.project.files.map((f) => (f.name === file.name ? nextFile : f))
            : [...record.project.files, nextFile],
        },
      };
    });
  }, []);

  const patchFileContent = useCallback((name: string, updater: (prev: string) => string) => {
    dispatchRecord((record) => {
      const updatedAt = new Date().toISOString();
      return {
        ...record,
        session: { ...record.session, updatedAt },
        project: {
          ...record.project,
          updatedAt,
          files: record.project.files.map((f) =>
            f.name === name ? { ...f, content: updater(f.content) } : f
          ),
        },
      };
    });
  }, []);

  const addMessage = useCallback((partial: Partial<ChatMessage>) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: partial.role ?? "system",
      content: partial.content ?? "",
      timestamp: new Date().toISOString(),
      meta: partial.meta,
    };

    dispatchRecord((record) => {
      const messages = [...record.messages, msg];
      return {
        ...record,
        messages,
        session: updateSessionMeta(record, messages),
      };
    });
    return msg;
  }, []);

  const createSession = useCallback(() => {
    const fresh = createBlankSessionRecord();
    if (!state.store) {
      dispatch({ type: "loaded", store: { version: 1, sessions: [fresh.session], activeSessionId: fresh.session.id }, activeRecord: fresh });
      return;
    }
    const store = {
      ...state.store,
      activeSessionId: fresh.session.id,
      sessions: sortSessions([fresh.session, ...state.store.sessions]),
    };
    saveSessionRecord(fresh);
    saveSessionStore(store);
    dispatch({ type: "set_active", store, activeRecord: fresh });
  }, [state.store]);

  const openSession = useCallback((id: string): boolean => {
    if (!state.store) return false;
    const record = loadSessionRecord(id);
    if (!record) return false;
    const store = { ...state.store, activeSessionId: id };
    saveSessionStore(store);
    dispatch({ type: "set_active", store, activeRecord: record });
    return true;
  }, [state.store]);

  const deleteSession = useCallback((id: string) => {
    if (!state.store) return;
    const remaining = state.store.sessions.filter((s) => s.id !== id);
    deleteSessionRecord(id);

    if (!remaining.length) {
      const fresh = createBlankSessionRecord();
      const store: SessionStore = {
        version: 1,
        sessions: [fresh.session],
        activeSessionId: fresh.session.id,
      };
      saveSessionRecord(fresh);
      saveSessionStore(store);
      dispatch({ type: "set_active", store, activeRecord: fresh });
      return;
    }

    const nextId = state.store.activeSessionId === id ? remaining[0].id : state.store.activeSessionId;
    const nextRecord = loadSessionRecord(nextId ?? remaining[0].id);
    if (!nextRecord) return;
    const store = { ...state.store, sessions: remaining, activeSessionId: nextRecord.session.id };
    saveSessionStore(store);
    dispatch({ type: "set_active", store, activeRecord: nextRecord });
  }, [state.store]);

  const renameSession = useCallback((id: string, title: string) => {
    const clean = title.trim();
    if (!state.store || !clean) return;

    const sessions = state.store.sessions.map((session) =>
      session.id === id
        ? { ...session, title: clean, updatedAt: new Date().toISOString() }
        : session
    );
    const activeRecord =
      state.activeRecord?.session.id === id
        ? {
            ...state.activeRecord,
            session: {
              ...state.activeRecord.session,
              title: clean,
              updatedAt: new Date().toISOString(),
            },
          }
        : undefined;
    dispatch({ type: "set_sessions", sessions, activeRecord });
  }, [state.store, state.activeRecord]);

  const activeRecord = state.activeRecord;
  const project = activeRecord?.project ?? null;
  const activeFile = project?.files.find((f) => f.name === project.activeFile) ?? project?.files[0];

  return {
    ready: state.ready,
    sessions: state.store?.sessions ?? [],
    activeSessionId: state.store?.activeSessionId ?? null,
    activeSession: activeRecord?.session ?? null,
    messages: activeRecord?.messages ?? [],
    project,
    activeFile,
    addMessage,
    setActiveFile,
    updateFileContent,
    upsertFile,
    patchFileContent,
    createSession,
    openSession,
    deleteSession,
    renameSession,
  };
}
