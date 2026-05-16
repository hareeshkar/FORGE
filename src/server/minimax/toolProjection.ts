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

type PartialStringValue = { value: string; complete: boolean };

function extractPartialStringValue(source: string, key: string): PartialStringValue | null {
  const keyIndex = source.indexOf(`"${key}"`);
  if (keyIndex === -1) return null;

  const colonIndex = source.indexOf(":", keyIndex + key.length + 2);
  if (colonIndex === -1) return null;

  let quoteIndex = colonIndex + 1;
  while (quoteIndex < source.length && /\s/.test(source[quoteIndex])) quoteIndex += 1;
  if (source[quoteIndex] !== '"') return null;

  let value = "";
  for (let i = quoteIndex + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '"') return { value, complete: true };
    if (ch !== "\\") {
      value += ch;
      continue;
    }

    if (i + 1 >= source.length) return { value, complete: false };
    const escaped = source[i + 1];
    i += 1;
    switch (escaped) {
      case '"':
      case "\\":
      case "/":
        value += escaped;
        break;
      case "b":
        value += "\b";
        break;
      case "f":
        value += "\f";
        break;
      case "n":
        value += "\n";
        break;
      case "r":
        value += "\r";
        break;
      case "t":
        value += "\t";
        break;
      case "u": {
        const hex = source.slice(i + 1, i + 5);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          value += String.fromCharCode(Number.parseInt(hex, 16));
          i += 4;
        }
        break;
      }
      default:
        value += escaped;
    }
  }

  return { value, complete: false };
}

export function projectLiveToolArgumentUpdate(
  name: string,
  partialArguments: string,
  store: ProjectFileStore
): ProjectFile | null {
  switch (name) {
    case "create_file": {
      const path = extractPartialStringValue(partialArguments, "path");
      const content = extractPartialStringValue(partialArguments, "content");
      if (!path?.complete || !path.value || !content) return null;
      return {
        name: path.value,
        content: content.value,
        language: inferLanguage(path.value),
      };
    }

    case "edit_file": {
      const path = extractPartialStringValue(partialArguments, "path");
      const oldString = extractPartialStringValue(partialArguments, "old_string");
      const newString = extractPartialStringValue(partialArguments, "new_string");
      if (!path?.complete || !oldString?.complete || !newString) return null;

      const file = store.read(path.value);
      if (!file) return null;

      const occurrences = file.content.split(oldString.value).length - 1;
      if (occurrences !== 1) return null;
      return {
        ...file,
        content: file.content.replace(oldString.value, newString.value),
      };
    }

    default:
      return null;
  }
}
