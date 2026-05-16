import ts from "node:module";
import { readFileSync } from "node:fs";

const { stripTypeScriptTypes } = ts;
const loaded = new Map();

function strip(path) {
  return stripTypeScriptTypes(readFileSync(new URL(path, import.meta.url), "utf8"), { mode: "strip" });
}

export async function loadTsModule(path) {
  if (loaded.has(path)) return loaded.get(path);
  let stripped = strip(path);

  if (path.endsWith("staticChecks.ts")) {
    stripped = `${strip("../src/lib/diagnostics/fingerprint.ts").replace(/export /g, "")}\n${stripped.replace(/import .*?;\n/g, "")}`;
  } else if (path.endsWith("tools.ts")) {
    stripped = `function inferLanguage(name) {
  if (name.endsWith(".html")) return "html";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".ts")) return "typescript";
  return "javascript";
}
${stripped.replace(/import .*?;\n/g, "")}`;
  } else if (path.endsWith("toolProjection.ts")) {
    const tools = strip("../src/server/minimax/tools.ts")
      .replace(/import .*?;\n/g, "")
      .replace(/export /g, "");
    stripped = `function inferLanguage(name) {
  if (name.endsWith(".html")) return "html";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".ts")) return "typescript";
  return "javascript";
}
${tools}
${stripped.replace(/import .*?;\n/g, "")}`;
  } else {
    stripped = stripped.replace(/import .*?;\n/g, "");
  }

  const encoded = encodeURIComponent(stripped);
  const mod = await import(`data:text/javascript,${encoded}`);
  loaded.set(path, mod);
  return mod;
}
