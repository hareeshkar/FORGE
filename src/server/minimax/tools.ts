import type { ForgeSSEEvent, ImageHint, ProjectFile } from "@/lib/types";
import { inferLanguage } from "@/lib/files/defaultProject";
import { searchAndStreamDocs } from "./search";

// ---------------------------------------------------------------------------
// Tool JSON schema type (OpenAI-compatible, accepted by MiniMax M2.7)
// ---------------------------------------------------------------------------

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, {
        type: string;
        description?: string;
        enum?: string[];
        items?: {
          type: string;
          properties?: Record<string, { type: string; description?: string }>;
          required?: string[];
        };
      }>;
      required: string[];
    };
  };
};

// ---------------------------------------------------------------------------
// Mutable in-memory file store — shared across all tool executions in a loop
// ---------------------------------------------------------------------------

export class ProjectFileStore {
  private files: Map<string, ProjectFile>;

  constructor(initialFiles: ProjectFile[]) {
    this.files = new Map(initialFiles.map((f) => [f.name, f]));
  }

  list(): string[] {
    return Array.from(this.files.keys());
  }

  read(name: string): ProjectFile | undefined {
    return this.files.get(name);
  }

  write(name: string, content: string): ProjectFile {
    const existing = this.files.get(name);
    const file: ProjectFile = {
      name,
      content,
      language: existing?.language ?? inferLanguage(name),
    };
    this.files.set(name, file);
    return file;
  }

  remove(name: string): boolean {
    return this.files.delete(name);
  }

  getAll(): ProjectFile[] {
    return Array.from(this.files.values());
  }
}

// ---------------------------------------------------------------------------
// Tool result returned by executeTool
// ---------------------------------------------------------------------------

export type ToolResult = {
  ok: boolean;
  /** Returned to M2.7 as the tool_result content string */
  content: string;
  /** Set when a file was created or modified */
  fileUpdate?: ProjectFile;
};

type Emit = (event: ForgeSSEEvent) => Promise<void>;

type StringReplacement = {
  old_string: string;
  new_string: string;
};

export function applyStringReplacements(content: string, replacements: StringReplacement[]): {
  ok: boolean;
  content: string;
  error?: string;
  changedCount: number;
} {
  if (replacements.length === 0) {
    return { ok: false, content, error: "replace_strings requires at least one replacement.", changedCount: 0 };
  }

  for (const [index, replacement] of replacements.entries()) {
    if (!replacement.old_string) {
      return { ok: false, content, error: `Replacement ${index + 1} is missing old_string.`, changedCount: 0 };
    }
    const occurrences = content.split(replacement.old_string).length - 1;
    if (occurrences === 0) {
      return { ok: false, content, error: `Replacement ${index + 1} old_string not found.`, changedCount: 0 };
    }
    if (occurrences > 1) {
      return {
        ok: false,
        content,
        error: `Replacement ${index + 1} old_string appears ${occurrences} times. Include more context or use edit_file.`,
        changedCount: 0,
      };
    }
  }

  let next = content;
  for (const replacement of replacements) {
    next = next.replace(replacement.old_string, replacement.new_string);
  }

  return { ok: true, content: next, changedCount: replacements.length };
}

export function projectToolFileUpdate(
  name: string,
  args: Record<string, unknown>,
  store: ProjectFileStore
): { ok: true; file: ProjectFile } | { ok: false; error: string } {
  switch (name) {
    case "create_file": {
      const path = String(args.path ?? "");
      const content = String(args.content ?? "");
      if (!path) return { ok: false, error: "create_file requires path and content." };
      if (store.read(path)) return { ok: false, error: `${path} already exists.` };
      return { ok: true, file: { name: path, content, language: inferLanguage(path) } };
    }

    case "edit_file": {
      const path = String(args.path ?? "");
      const oldStr = String(args.old_string ?? "");
      const newStr = String(args.new_string ?? "");
      const file = path ? store.read(path) : undefined;
      if (!path || !oldStr || !file) return { ok: false, error: "edit_file cannot be projected." };
      const occurrences = file.content.split(oldStr).length - 1;
      if (occurrences !== 1) return { ok: false, error: `edit_file expected one match, found ${occurrences}.` };
      return { ok: true, file: { ...file, content: file.content.replace(oldStr, newStr) } };
    }

    case "replace_strings": {
      const path = String(args.path ?? "");
      const file = path ? store.read(path) : undefined;
      const replacements = Array.isArray(args.replacements)
        ? args.replacements.map((item) => {
            const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
            return {
              old_string: String(record.old_string ?? ""),
              new_string: String(record.new_string ?? ""),
            };
          })
        : [];
      if (!path || !file) return { ok: false, error: "replace_strings cannot be projected." };
      const result = applyStringReplacements(file.content, replacements);
      return result.ok
        ? { ok: true, file: { ...file, content: result.content } }
        : { ok: false, error: result.error ?? "replace_strings failed." };
    }

    default:
      return { ok: false, error: "Tool does not produce a file update." };
  }
}

// ---------------------------------------------------------------------------
// Tool schemas — exactly what M2.7 receives in the `tools` array
// ---------------------------------------------------------------------------

export const FORGE_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description:
        "List all files currently in the project. Call this first before editing anything.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the full content of a project file. Read before editing so you have exact strings.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Filename, e.g. index.html or styles.css",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description:
        "Edit a file with exact string replacement. old_string MUST appear exactly once. " +
        "Include enough surrounding lines to make it unique. " +
        "Fails with an error if old_string is not found or appears multiple times — retry with more context.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Filename to edit, e.g. index.html",
          },
          old_string: {
            type: "string",
            description:
              "Exact text to replace — byte-for-byte match, including whitespace and indentation.",
          },
          new_string: {
            type: "string",
            description: "Replacement text.",
          },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_strings",
      description:
        "Apply multiple exact string replacements to one existing file atomically. " +
        "Use this for build-fix passes when several small syntax/import/style fixes are needed in the same file. " +
        "Every old_string must appear exactly once, or no changes are applied.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Filename to edit, e.g. app.js or index.html",
          },
          replacements: {
            type: "array",
            description: "Ordered exact replacements to apply atomically.",
            items: {
              type: "object",
              properties: {
                old_string: {
                  type: "string",
                  description: "Exact text to replace. Must appear exactly once.",
                },
                new_string: {
                  type: "string",
                  description: "Replacement text.",
                },
              },
              required: ["old_string", "new_string"],
            },
          },
        },
        required: ["path", "replacements"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_file",
      description:
        "Create a new file with full content. Only for files that do not exist yet. " +
        "Use edit_file to modify existing files.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "New filename, e.g. about.html",
          },
          content: {
            type: "string",
            description: "Complete file content.",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description:
        "Search the web for current documentation, API references, or best practices. " +
        "Always call this before writing code that depends on an external library or API " +
        "(Stripe, Tailwind v4, React 19, etc.). Returns top 3 snippets.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Specific search query, e.g. 'Stripe.js loadStripe PaymentElement 2026'",
          },
        },
        required: ["query"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Image hint extractor — scans finished files for <!-- IMAGE:... --> markers
// ---------------------------------------------------------------------------

export function extractImageHints(files: ProjectFile[]): ImageHint[] {
  const hints: ImageHint[] = [];
  const rx = /<!--\s*IMAGE:([^>]+?)\s*-->/g;
  for (const file of files) {
    let m: RegExpExecArray | null;
    rx.lastIndex = 0;
    while ((m = rx.exec(file.content)) !== null) {
      const description = m[1].trim();
      if (description) {
        hints.push({
          placeholder: m[0],
          description,
          targetFile: file.name,
        });
      }
    }
  }
  return hints;
}

// ---------------------------------------------------------------------------
// Tool executor — runs a single tool call, returns ToolResult
// ---------------------------------------------------------------------------

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  store: ProjectFileStore,
  emit: Emit
): Promise<ToolResult> {
  switch (name) {
    case "list_files": {
      const names = store.list();
      return {
        ok: true,
        content:
          names.length > 0
            ? `Project files: ${names.join(", ")}`
            : "No files in project yet.",
      };
    }

    case "read_file": {
      const path = String(args.path ?? "");
      const file = store.read(path);
      if (!file) {
        return {
          ok: false,
          content: `File not found: ${path}. Use list_files to see what exists.`,
        };
      }
      return { ok: true, content: file.content };
    }

    case "edit_file": {
      const path = String(args.path ?? "");
      const oldStr = String(args.old_string ?? "");
      const newStr = String(args.new_string ?? "");

      if (!path || !oldStr) {
        return { ok: false, content: "edit_file requires path, old_string, and new_string." };
      }

      const file = store.read(path);
      if (!file) {
        return { ok: false, content: `File not found: ${path}. Use list_files to see what exists.` };
      }

      const occurrences = file.content.split(oldStr).length - 1;
      if (occurrences === 0) {
        return {
          ok: false,
          content:
            `old_string not found in ${path}. Use read_file to see exact content, ` +
            "then provide a larger context window around the change.",
        };
      }
      if (occurrences > 1) {
        return {
          ok: false,
          content:
            `old_string appears ${occurrences} times in ${path}. ` +
            "Include more surrounding lines to make it unique.",
        };
      }

      const newContent = file.content.replace(oldStr, newStr);
      const updated = store.write(path, newContent);
      return {
        ok: true,
        content: `Applied edit to ${path}.`,
        fileUpdate: updated,
      };
    }

    case "replace_strings": {
      const path = String(args.path ?? "");
      const replacements = Array.isArray(args.replacements)
        ? args.replacements.map((item) => {
            const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
            return {
              old_string: String(record.old_string ?? ""),
              new_string: String(record.new_string ?? ""),
            };
          })
        : [];

      if (!path) {
        return { ok: false, content: "replace_strings requires path and replacements." };
      }

      const file = store.read(path);
      if (!file) {
        return { ok: false, content: `File not found: ${path}. Use list_files to see what exists.` };
      }

      const result = applyStringReplacements(file.content, replacements);
      if (!result.ok) {
        return { ok: false, content: result.error ?? "replace_strings failed." };
      }

      const updated = store.write(path, result.content);
      return {
        ok: true,
        content: `Applied ${result.changedCount} replacements to ${path}.`,
        fileUpdate: updated,
      };
    }

    case "create_file": {
      const path = String(args.path ?? "");
      const content = String(args.content ?? "");

      if (!path) {
        return { ok: false, content: "create_file requires path and content." };
      }
      if (store.read(path)) {
        return {
          ok: false,
          content: `${path} already exists. Use edit_file to modify it.`,
        };
      }

      const created = store.write(path, content);
      return {
        ok: true,
        content: `Created ${path} (${content.length} chars).`,
        fileUpdate: created,
      };
    }

    case "search_web": {
      const query = String(args.query ?? "").trim();
      if (!query) return { ok: false, content: "search_web requires a query." };

      try {
        await emit({ type: "search_start", query });
        const { context, resultCount } = await searchAndStreamDocs(query, emit);
        await emit({ type: "search_done", query, resultCount });
        return {
          ok: true,
          content: context.trim() || "No useful results found.",
        };
      } catch {
        await emit({ type: "search_done", query, resultCount: 0 });
        return { ok: false, content: `Web search failed for: ${query}` };
      }
    }

    default:
      return { ok: false, content: `Unknown tool: ${name}` };
  }
}
