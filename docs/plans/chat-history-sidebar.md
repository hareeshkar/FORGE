# Chat History Sidebar — Implementation Plan

**Status:** Draft, ready for implementation
**Owner:** TBD
**Scope:** Add a ChatGPT-style chat history sidebar so users can resume past conversations. Each conversation owns its own project (files + messages), persisted client-side.

---

## 0. Current State (as of writing)

Single-project, single-session app. The data flow is:

- `useProject()` (`src/hooks/useProject.ts`) — loads a single `Project` from `localStorage["forge-project-v3"]` or seeds with `createDefaultProject()`. Auto-saves to the same key on every change.
- `useChat()` (`src/hooks/useChat.ts`) — pure in-memory `useState<ChatMessage[]>`. **Messages are lost on refresh.**
- `useGenerate()` (`src/hooks/useGenerate.ts`) — fires SSE to `/api/generate`, streams `file_update`, `tool_call_start`, `tool_call_result`, `done`, etc. Stateful via `isGenerating`.
- `ForgeBuilder.tsx` — composes the three hooks; the left `<aside>` is `w-[360px]` and holds the FORGE header, demo/edit badges, optional `<TemplateStarters>`, and `<ChatPanel>`.
- `src/app/page.tsx` — `export default function Home() { return <ForgeBuilder />; }`. No dynamic routes besides `/dev/*` and `/api/*`.

The smallest unit we have today is a `Project`. There is no notion of a "session" or "conversation" — everything is anonymous global state.

---

## 1. Data Model

### 1.1 New types (extend `src/lib/types.ts`)

```ts
export type Session = {
  id: string;                 // crypto.randomUUID()
  title: string;              // auto-derived; user-renamable
  projectId: string;          // 1:1 mapping with Project.id (see §1.3)
  createdAt: string;          // ISO
  updatedAt: string;          // ISO — bumped on any message or file change
  messageCount: number;       // denormalized for the sidebar
  lastMessagePreview: string; // first 80 chars of last user/assistant content
};

export type SessionRecord = {
  session: Session;
  messages: ChatMessage[];
  project: Project;
};

export type SessionStore = {
  version: 1;
  sessions: Session[];        // index only — sorted by updatedAt desc
  activeSessionId: string | null;
};
```

The lightweight `Session` lives in the index; the heavy `SessionRecord` (messages + project) lives in its own storage key. This keeps the sidebar render cheap and avoids parsing every project on load.

### 1.2 Title generation

```ts
function deriveSessionTitle(firstUserPrompt: string | undefined): string {
  if (!firstUserPrompt?.trim()) {
    return `Untitled — ${new Date().toLocaleDateString()}`;
  }
  const clean = firstUserPrompt.trim().replace(/\s+/g, " ");
  return clean.length > 40 ? `${clean.slice(0, 40).trimEnd()}…` : clean;
}
```

Title is set on the first user message via `addMessage`. Once set, it sticks unless the user renames.

### 1.3 Project ownership — one project per session

**Recommendation: each session owns its own `Project`.**

Justification:
- File edits diverge per conversation. If a user starts session A ("build a todo app") and session B ("build a landing page"), they cannot share `index.html`, `app.js`, etc. Sharing would either clobber files or force a confusing "which project does this chat edit?" prompt.
- ChatGPT's mental model (each chat is sandboxed) is what users expect.
- Storage cost is modest: a default project is ~2 KB. Even 100 sessions with sizable files stays under 1 MB.

The cost is that there is no "global library" of reusable files yet. We can layer "fork session" / "duplicate project" later — outside this plan's scope.

`Session.projectId` is kept as a separate field rather than inlining the project, because (a) we may later add multi-project-per-session, and (b) it lets us store the project in its own slot for cheap incremental writes.

---

## 2. Storage Strategy

### 2.1 Choice: localStorage for v1

| Concern | localStorage | IndexedDB (via `idb-keyval`) |
| --- | --- | --- |
| Capacity | ~5 MB hard cap per origin | ~hundreds of MB |
| API | Sync; trivial | Async; needs await everywhere |
| Bundle cost | 0 | ~1 KB gzipped |
| SSR | Window-only (already handled via `useEffect`) | Same |
| Migration friction | Native string blobs | Needs hydration shim |

A typical FORGE session is small (3 files × few KB + 10–30 messages × few hundred bytes ≈ 10–30 KB). 50 sessions ≈ 0.5–1.5 MB. 200 sessions ≈ 2–6 MB — at which point we *should* migrate.

**Decision:** ship localStorage now, design the storage layer so swapping to `idb-keyval` is a one-file change.

### 2.2 Storage keys

| Key | Value | Notes |
| --- | --- | --- |
| `forge-sessions-v1` | `SessionStore` JSON | Read on app boot, written on session create/rename/delete/switch |
| `forge-session-{id}` | `SessionRecord` JSON | Read on session open, written debounced on any message/file change |
| `forge-project-v3` | *(legacy)* | Migrated then deleted on first boot — see §8 |

### 2.3 Storage abstraction (`src/lib/storage/sessionStore.ts`)

All localStorage access goes through this module so that v2 can swap backends:

```ts
export interface SessionStorage {
  loadIndex(): Promise<SessionStore | null>;
  saveIndex(store: SessionStore): Promise<void>;
  loadRecord(id: string): Promise<SessionRecord | null>;
  saveRecord(record: SessionRecord): Promise<void>;
  deleteRecord(id: string): Promise<void>;
  usageBytes(): Promise<number>;
}

export const localStorageBackend: SessionStorage = { /* ... */ };
```

### 2.4 Graceful degradation when full

`localStorage.setItem` throws `QuotaExceededError` once we exceed ~5 MB. Wrap every write:

```ts
async function safeSave(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    if (isQuotaError(err)) {
      // 1. Drop oldest archived session record (keep its index entry so the
      //    user sees it greyed out as "archived — re-open to regenerate").
      // 2. Retry once.
      // 3. If still failing, emit a system chat message:
      //    "Storage full. Delete old chats to keep saving this conversation."
      //    and set a global `storageFull` flag that disables auto-save until
      //    the user clears space.
    }
    throw err;
  }
}
```

Surface the state via `useSessions()` so the sidebar can show a banner.

---

## 3. URL / Routing

### 3.1 Decision: `/s/[id]` for session pages, `/` for "new chat" landing

- `/` — boot path. If `activeSessionId` exists, redirect to `/s/{activeSessionId}`. Otherwise show an empty "Start a new conversation" state with `<TemplateStarters>`.
- `/s/[id]` — loads `SessionRecord` for `id`, sets it active. 404 → redirect to `/` and toast "Session not found".
- The active session id lives in **both** the URL and the `SessionStore` index. The URL is the source of truth for what the user sees; the index value is a "last opened" hint used only on bare `/` navigation.

### 3.2 Why `/s/{id}` and not `/c/{id}` or `/chat/{id}`

- `/s/` is shorter, distinctive, and avoids colliding with future `/chat` API or marketing routes.
- ChatGPT uses `/c/`; we deliberately differentiate to avoid a "is this ChatGPT?" reaction.

### 3.3 Next.js 16 routing details

Per `AGENTS.md`: this is **not** the Next.js you know. Before writing the route, read `node_modules/next/dist/docs/` for the current App Router patterns (params types, dynamic segments, client/server boundary, `redirect()` semantics). In particular, double-check whether `params` is a Promise (Next 15+) and update destructuring accordingly.

Skeleton (verify against installed Next docs):

```tsx
// src/app/s/[id]/page.tsx
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ForgeBuilder sessionId={id} />;
}
```

`ForgeBuilder` accepts an optional `sessionId` prop and, when present, calls `openSession(id)` on mount. If absent (route `/`), it creates a fresh blank state.

---

## 4. Hooks Refactor

### 4.1 Strategy: introduce `useSessions`, derive `useChat`/`useProject` from it

We keep `useChat` and `useProject` as **thin adapters** over the new `useSessions` hook so that `ForgeBuilder.tsx` only needs to grab one extra value (the sidebar actions) and existing call sites keep working.

### 4.2 `useSessions` signature

```ts
// src/hooks/useSessions.ts
export type UseSessionsReturn = {
  // Index
  sessions: Session[];                // sorted updatedAt desc
  activeSession: Session | null;
  storageFull: boolean;

  // Active record (derived from activeSessionId)
  messages: ChatMessage[];
  project: Project | null;

  // Mutations — session lifecycle
  createSession: (opts?: { activate?: boolean }) => Session;
  openSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;

  // Mutations — active record (delegated to useChat/useProject internals)
  addMessage: (partial: Partial<ChatMessage>) => ChatMessage;
  upsertFile: (file: ProjectFile) => void;
  updateFileContent: (name: string, content: string) => void;
  patchFileContent: (name: string, updater: (prev: string) => string) => void;
  setActiveFile: (name: string) => void;
};
```

### 4.3 Backward-compat shims

`useChat()` and `useProject()` keep their existing return shape but read/write through a shared `SessionsContext`:

```ts
// src/hooks/useChat.ts (rewritten)
export function useChat() {
  const { messages, addMessage } = useSessionsContext();
  const clearMessages = useCallback(() => { /* now a no-op or session reset */ }, []);
  return { messages, addMessage, clearMessages };
}
```

`ForgeBuilder.tsx` change is minimal: wrap the tree in `<SessionsProvider>` (or call `useSessions()` directly at the top) and forward the new `createSession` / `openSession` / `deleteSession` / `renameSession` actions down to the new `<ChatHistorySidebar>`.

### 4.4 SessionsProvider

```tsx
// src/components/providers/SessionsProvider.tsx
export function SessionsProvider({ initialSessionId, children }: {
  initialSessionId?: string;
  children: React.ReactNode;
}) {
  const value = useSessionsInternal(initialSessionId);
  return <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>;
}
```

Mounted once in `src/app/layout.tsx` (server-safe wrapper around a client child) or inside `ForgeBuilder.tsx`. Pick **inside `ForgeBuilder.tsx`** to keep server boundaries clean (no client provider in the root layout).

### 4.5 Persistence wiring

Inside `useSessionsInternal`:
- `useEffect` on `[messages, project]` → debounced (300 ms) write to `forge-session-{activeSessionId}`.
- `useEffect` on `[sessions, activeSessionId]` → immediate write to `forge-sessions-v1`.
- On `addMessage({ role: "user" })` *and* the session is still titled `Untitled — *`: derive a title from the prompt and bump the index entry.
- On every message or file change: bump `updatedAt`, refresh `messageCount`, `lastMessagePreview` in the index entry.

---

## 5. UI Components

### 5.1 Recommended layout: replace the single `aside` with a two-column shell

**Recommendation:** dedicate `260px` to the new `<ChatHistorySidebar>` and keep the existing `360px` chat column as-is. Total left-side width grows from `360px` → `620px`. On screens narrower than ~1100px collapse the history sidebar behind a hamburger (deferred to Phase 4+).

We considered a 60 px slim rail. Rejected: avatars/initials for sessions are not meaningful (every session is just text), and the rail would force a popover for titles. A 260 px column matches ChatGPT/Claude conventions and is the established muscle memory.

### 5.2 JSX skeleton (`ForgeBuilder.tsx` left half)

```tsx
<div className="forge-app flex h-screen overflow-hidden bg-[var(--forge-bg)] text-[var(--forge-fg)]">
  <ChatHistorySidebar
    sessions={sessions}
    activeSessionId={activeSession?.id}
    onNewSession={() => createSession({ activate: true })}
    onOpenSession={openSession}
    onRenameSession={renameSession}
    onDeleteSession={deleteSession}
    disabled={isGenerating} // see §6
  />
  <aside className="w-[360px] shrink-0 ..."> {/* unchanged */} </aside>
  <main className="..."> {/* unchanged */} </main>
</div>
```

### 5.3 `<ChatHistorySidebar>` (`src/components/sidebar/ChatHistorySidebar.tsx`)

Skeleton:

```tsx
type Props = {
  sessions: Session[];
  activeSessionId: string | null;
  onNewSession: () => void;
  onOpenSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
  disabled?: boolean;
};

export function ChatHistorySidebar({ sessions, activeSessionId, ... }: Props) {
  const groups = useMemo(() => groupByRelativeDate(sessions), [sessions]);

  return (
    <nav className="flex w-[260px] shrink-0 flex-col border-r border-[var(--forge-edge)] bg-[color-mix(in_oklab,var(--forge-panel)_75%,black)]">
      <div className="shrink-0 p-3">
        <button
          type="button"
          onClick={onNewSession}
          disabled={disabled}
          className="flex w-full items-center gap-2 rounded-md border border-[var(--forge-edge)] px-3 py-2 text-sm hover:border-[var(--forge-molt)]"
        >
          <PlusIcon /> New chat
        </button>
      </div>

      <ul className="forge-chat-scroll flex-1 overflow-y-auto px-2 pb-3">
        {groups.map(({ label, items }) => (
          <li key={label}>
            <h3 className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-[0.18em] text-[var(--forge-muted)]">
              {label}
            </h3>
            <ul>
              {items.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  active={s.id === activeSessionId}
                  disabled={disabled}
                  onOpen={() => onOpenSession(s.id)}
                  onRename={(title) => onRenameSession(s.id, title)}
                  onDelete={() => onDeleteSession(s.id)}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

`<SessionRow>`:
- Two-line layout: title (truncate) + preview (truncate, dimmer).
- Right side: relative time on default, swap to rename/delete icons on `:hover` / `:focus-within`.
- Rename via inline `<input>` (Enter to commit, Esc to cancel).
- Delete via confirm dialog (a simple `window.confirm` for v1 — replace with a styled modal later).

### 5.4 Date grouping (`src/lib/sessions/groupByDate.ts`)

```ts
type Group = { label: "Today" | "Yesterday" | "Previous 7 days" | "Older"; items: Session[] };

export function groupByRelativeDate(sessions: Session[], now = new Date()): Group[];
```

Pure function; trivial to unit test.

---

## 6. Generation-in-progress edge case

**Recommendation: option (a) — block session switch while `isGenerating === true`.**

Rationale:
1. Simplest behavior to reason about; zero risk of cross-session writes.
2. The streaming layer (`useGenerate` + `/api/generate`) writes back through `onFileUpdate`, `onChatMessage`, `onImageResolved` callbacks captured in a closure. If we naively switch sessions mid-stream those callbacks still mutate the *new* active session — silent corruption. Fixing this properly requires plumbing a `sessionId` through every SSE event handler.
3. Generation rarely exceeds 60–90 s.

Implementation:
- `useSessions` exposes `storageFull` and `isGenerating` (the latter forwarded from `useGenerate`).
- `<ChatHistorySidebar>` receives `disabled={isGenerating}`. Hover state shows a tooltip: "Generation in progress — wait for it to finish before switching chats."
- `openSession(id)` early-returns and pushes a toast: "Generation in progress. Cancel current chat or wait."
- The "+ New chat" button is also disabled.

We will revisit option (b) — session-bound writes — once we have a real backend with per-session state. Until then, the in-flight callback closure is the bottleneck.

---

## 7. Tool calls and images inside sessions

`useGenerate` already forwards every interesting event (`tool_call_start`, `tool_call_result`, `image_hint` resolution, `agent_thinking` *— currently swallowed*) through `onChatMessage`, which routes to `addMessage`. Since `addMessage` now persists into the active session, this is already correct: resuming a session replays the full system trace.

Action items:
- **Verify**: after Phase 1 lands, manually run a generation, refresh, and confirm the system messages (`→ list_files()`, `→ edit_file(...)`) all replay.
- **Consider**: store `agent_thinking` events as `role: "system"` with a `meta.kind = "thinking"` flag so the resumed view can collapse them under a "Show reasoning" disclosure. Out of scope for v1; leave a TODO.

Image generation is a side effect on a `ProjectFile`'s HTML content. Once the file is updated via `upsertFile`/`patchFileContent` it is persisted with the project, so resuming a session shows the inlined `<img>` tag with the same URL.

---

## 8. Legacy migration

Existing users have a `forge-project-v3` blob. Migrate on first boot:

```ts
// src/lib/storage/migrateLegacyStorage.ts
export function migrateLegacyStorage(): { migrated: boolean; sessionId?: string } {
  const legacyRaw = localStorage.getItem("forge-project-v3");
  if (!legacyRaw) return { migrated: false };
  if (localStorage.getItem("forge-sessions-v1")) {
    // Already on the new schema; if the legacy key is still around, just drop it.
    localStorage.removeItem("forge-project-v3");
    return { migrated: false };
  }
  try {
    const project = JSON.parse(legacyRaw) as Project;
    const now = new Date().toISOString();
    const session: Session = {
      id: crypto.randomUUID(),
      title: "First project",
      projectId: project.id,
      createdAt: project.createdAt ?? now,
      updatedAt: project.updatedAt ?? now,
      messageCount: 0,
      lastMessagePreview: "",
    };
    const record: SessionRecord = { session, messages: [], project };
    const store: SessionStore = { version: 1, sessions: [session], activeSessionId: session.id };
    localStorage.setItem("forge-sessions-v1", JSON.stringify(store));
    localStorage.setItem(`forge-session-${session.id}`, JSON.stringify(record));
    localStorage.removeItem("forge-project-v3");
    return { migrated: true, sessionId: session.id };
  } catch {
    // Malformed legacy blob — preserve it under a backup key and bail.
    localStorage.setItem("forge-project-v3.bak", legacyRaw);
    localStorage.removeItem("forge-project-v3");
    return { migrated: false };
  }
}
```

Called once inside `useSessionsInternal` boot effect, before reading the new index.

---

## 9. Implementation Phases

Ship in four small, independently reviewable PRs.

### Phase 1 — Data layer (no UI changes)

Files **created**:
- `src/lib/storage/sessionStore.ts` — `SessionStorage` interface + `localStorageBackend`.
- `src/lib/storage/migrateLegacyStorage.ts`.
- `src/lib/sessions/groupByDate.ts`.
- `src/hooks/useSessions.ts` — full hook (returns are wired but nothing consumes them yet).
- `src/components/providers/SessionsProvider.tsx` — context wrapper.
- Tests: `src/lib/sessions/groupByDate.test.ts`, `src/lib/storage/migrateLegacyStorage.test.ts`.

Files **modified**:
- `src/lib/types.ts` — add `Session`, `SessionRecord`, `SessionStore`.

Verification: unit tests pass; manual smoke test loads the app with an old `forge-project-v3` key in storage and confirms migration runs (inspect via DevTools).

### Phase 2 — Wire `ForgeBuilder` through `useSessions`

Files **modified**:
- `src/hooks/useChat.ts` — becomes a shim over `useSessionsContext()`.
- `src/hooks/useProject.ts` — becomes a shim over `useSessionsContext()`.
- `src/components/layout/ForgeBuilder.tsx` — wraps tree in `<SessionsProvider>`, otherwise unchanged. The "New" button calls `createSession({ activate: true })` (which also resets files) instead of `resetProject()`.

Verification: app behaves exactly as before. Refresh now restores messages, not just files. No sidebar yet.

### Phase 3 — `<ChatHistorySidebar>`

Files **created**:
- `src/components/sidebar/ChatHistorySidebar.tsx`.
- `src/components/sidebar/SessionRow.tsx`.
- Icon helpers (or import from existing iconography).

Files **modified**:
- `src/components/layout/ForgeBuilder.tsx` — insert `<ChatHistorySidebar>` before the existing `<aside>`. Remove the legacy "New" button from the chat panel header (sidebar now owns "+ New chat").
- `src/app/globals.css` — minor: any new tokens for the sidebar (likely none — reuse existing `--forge-panel`/`--forge-edge`).

Verification: create multiple sessions, switch between them, rename, delete, refresh; verify each round-trips correctly. Try `localStorage.clear()` and confirm migration + bootstrap still works.

### Phase 4 — URL-driven sessions + polish

Files **created**:
- `src/app/s/[id]/page.tsx`.

Files **modified**:
- `src/app/page.tsx` — if `activeSessionId` exists in storage on the client, soft-redirect to `/s/{id}`. (Server `redirect()` cannot read localStorage; do this in a small client component or in `ForgeBuilder`'s boot effect via `router.replace`.)
- `src/components/layout/ForgeBuilder.tsx` — accept optional `sessionId` prop; `openSession(sessionId)` on mount.
- `src/hooks/useSessions.ts` — on `openSession`/`createSession`, `router.replace(\`/s/${id}\`)`.
- `src/components/sidebar/ChatHistorySidebar.tsx` — rows render as `<Link href={\`/s/${id}\`}>` for natural middle-click / right-click / shareable URLs (within the same browser; localStorage is origin-scoped).

Verification: cold-load `/s/{id}` for a known id → correct session; for an unknown id → redirect to `/` with toast. Browser back/forward navigates between sessions correctly.

---

## 10. Risks and Open Questions

### 10.1 SSR hydration mismatch

All persisted state lives in `localStorage`, which is unavailable on the server. The existing pattern (`useEffect` to load, `null` until then) handles this. We must preserve it:
- `useSessions` returns `project: null`, `messages: []`, `sessions: []` until the boot effect fires.
- `<ChatHistorySidebar>` must render a deterministic skeleton (e.g. an empty `<ul>` and the "+ New chat" button) before hydration — no conditional rendering keyed off persisted state on the first render.
- `ForgeBuilder.tsx` already gates on `if (!project || !activeFile) return <Loading/>` — keep that.

### 10.2 Bundle size if/when we add `idb-keyval`

`idb-keyval` is ~1 KB gzipped and tree-shakes well. Measure with `next build` before adopting. If we go further (e.g. full Dexie for queries) the budget is ~25 KB — only worth it if we add cross-session search.

### 10.3 Privacy

All chat content is client-side `localStorage`, **never sent to a server except as prompt context for the active generation request**. Add a one-line note to the new chat empty state ("Chats are stored locally in your browser. Clear them anytime.") so users are not surprised.

If we later add server-side persistence, this plan must be revisited (auth, encryption-at-rest, retention).

### 10.4 Multi-tab coordination

Two tabs open on the same origin will fight over `localStorage`. v1 ignores this — last write wins, the loser sees stale data until next refresh. If it bites, add a `storage` event listener to `useSessions` to invalidate state cross-tab.

### 10.5 Open questions for the implementer

- Should "+ New chat" reuse the user's last template choice or always show the blank `<TemplateStarters>` grid? Default: blank grid.
- Should we cap sessions at, say, 200 with an "archive oldest" eviction? Recommend: no cap in v1, surface usage in settings later.
- Where does the "rename" inline input live visually — replacing the title in place or in a modal? Recommend: in place, with an obvious focus ring.

---

## Done criteria

- A user can have at least 10 concurrent sessions, switch between them, see correct messages + files per session.
- Refreshing the page lands on the last open session and restores all state.
- Legacy users with `forge-project-v3` see their old project preserved as "First project".
- Cold-loading `/s/{validId}` opens the right session; `/s/{invalidId}` redirects.
- No regressions in single-session behavior (template starters, demo mode banner, export buttons, code/preview toggle).
