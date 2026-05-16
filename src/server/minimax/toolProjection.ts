import type { ProjectFile } from "@/lib/types";
import { inferLanguage } from "@/lib/files/defaultProject";
import { applyStringReplacements, normalizeStringReplacements, type ProjectFileStore } from "./tools";

export type ProjectedToolUpdate =
  | { ok: true; file: ProjectFile; toolName: string }
  | { ok: false; error: string; toolName: string };

export function projectToolFileUpdate(
  name: string,
  args: Record<string, unknown>,
  store: ProjectFileStore
): ProjectedToolUpdate {
  switch (name) {
    case "create_file": {
      const path = String(args.path ?? "");
      const content = String(args.content ?? "");
      if (!path) return { ok: false, error: "create_file requires path and content.", toolName: name };
      if (store.read(path)) return { ok: false, error: `${path} already exists.`, toolName: name };
      return { ok: true, file: { name: path, content, language: inferLanguage(path) }, toolName: name };
    }

    case "edit_file": {
      const path = String(args.path ?? "");
      const oldStr = String(args.old_string ?? "");
      const newStr = String(args.new_string ?? "");
      const file = path ? store.read(path) : undefined;
      if (!path || !oldStr || !file) return { ok: false, error: "edit_file cannot be projected.", toolName: name };
      const occurrences = file.content.split(oldStr).length - 1;
      if (occurrences !== 1) return { ok: false, error: `edit_file expected one match, found ${occurrences}.`, toolName: name };
      return { ok: true, file: { ...file, content: file.content.replace(oldStr, newStr) }, toolName: name };
    }

    case "replace_strings": {
      const path = String(args.path ?? "");
      const file = path ? store.read(path) : undefined;
      const replacements = normalizeStringReplacements(args.replacements);
      if (!path || !file) return { ok: false, error: "replace_strings cannot be projected.", toolName: name };
      const result = applyStringReplacements(file.content, replacements);
      return result.ok
        ? { ok: true, file: { ...file, content: result.content }, toolName: name }
        : { ok: false, error: result.error ?? "replace_strings failed.", toolName: name };
    }

    default:
      return { ok: false, error: "Tool does not produce a file update.", toolName: name };
  }
}
