export type ProjectFile = {
  name: string;
  content: string;
  language: "html" | "css" | "javascript" | "typescript";
};

export type Project = {
  id: string;
  name: string;
  files: ProjectFile[];
  activeFile: string;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  id: string;
  title: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessagePreview: string;
};

export type SessionRecord = {
  session: Session;
  messages: ChatMessage[];
  project: Project;
};

export type SessionStore = {
  version: 1;
  sessions: Session[];
  activeSessionId: string | null;
};

export type ResearchSource = {
  query: string;
  title: string;
  snippet: string;
  url: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  meta?: {
    searchQueries?: string[];
    sources?: Array<{ query: string; urls: string[] }>;
    imageGenerated?: boolean;
    filesChanged?: string[];
  };
};

export type GenerationRequest = {
  prompt: string;
  currentFiles: ProjectFile[];
  uploadedImageBase64?: string;
  uploadedImageMime?: string;
  mode: "create" | "modify" | "add-feature" | "fix-bug";
  researchMode?: boolean;
  approvedSearchContext?: string;
};

export type GenerationResponse = {
  files: ProjectFile[];
  summary: string;
  searchQueries: string[];
  imageHints: ImageHint[];
};

export type ImageHint = {
  placeholder: string;
  description: string;
  targetFile: string;
};

export type ForgeSSEEvent =
  | { type: "search_start"; query: string }
  | { type: "search_result"; query: string; title: string; snippet: string; url: string }
  | { type: "search_done"; query: string; resultCount: number }
  | { type: "research_ready"; queries: string[]; searchContext: string }
  | { type: "generating"; message: string }
  | { type: "file_stream_start"; file: ProjectFile }
  | { type: "file_stream_chunk"; fileName: string; chunk: string }
  | { type: "file_stream_done"; file: ProjectFile }
  | { type: "file_update"; file: ProjectFile }
  | { type: "image_hint"; hint: ImageHint }
  | { type: "done"; summary: string; filesChanged: string[] }
  | { type: "error"; message: string }
  /** Agent loop events */
  | { type: "tool_call_start"; callId: string; toolName: string; args: Record<string, unknown> }
  | { type: "tool_call_result"; callId: string; ok: boolean; summary: string }
  | { type: "agent_thinking"; text: string };
