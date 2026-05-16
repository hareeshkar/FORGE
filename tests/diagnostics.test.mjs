import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTsModule } from "./ts-loader.mjs";

const diagnostics = await loadTsModule("../src/lib/diagnostics/staticChecks.ts");
const fingerprinting = await loadTsModule("../src/lib/diagnostics/fingerprint.ts");
const repairPrompt = await loadTsModule("../src/lib/diagnostics/repairPrompt.ts");
const editTools = await loadTsModule("../src/server/minimax/tools.ts");
const agentLoop = await loadTsModule("../src/server/minimax/agentLoop.ts");

const file = (name, content, language = "javascript") => ({ name, content, language });

test("static diagnostics catch Sandpack build blockers", () => {
  const batch = diagnostics.analyzeStaticDiagnostics([
    file("index.html", '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><script type="module" src="app.js"></script></body></html>', "html"),
    file("styles.css", "body { color: red; }", "css"),
    file("app.js", 'const label = user?.name ?? "Guest";', "javascript"),
  ]);

  assert.equal(batch.blockingCount, 3);
  assert.deepEqual(
    batch.diagnostics.map((d) => d.code).sort(),
    ["html-css-link", "html-module-script", "js-unsupported-syntax"]
  );
});

test("static diagnostics require expected FORGE files and meaningful content", () => {
  const batch = diagnostics.analyzeStaticDiagnostics([
    file("index.html", "<!-- TODO -->", "html"),
    file("app.js", "   ", "javascript"),
  ]);

  assert.ok(batch.diagnostics.some((d) => d.code === "missing-file" && d.fileName === "styles.css"));
  assert.ok(batch.diagnostics.some((d) => d.code === "html-missing-script"));
  assert.ok(batch.diagnostics.some((d) => d.code === "empty-file" && d.fileName === "app.js"));
  assert.ok(batch.diagnostics.some((d) => d.code === "placeholder-file" && d.fileName === "index.html"));
});

test("diagnostic fingerprints are stable for equivalent errors", () => {
  const a = {
    source: "compiler",
    severity: "error",
    code: "syntax",
    message: "Unexpected token ? at generated line",
    fileName: "/index.js",
    line: 12,
    column: 5,
  };
  const b = {
    ...a,
    message: "Unexpected token ? at generated line",
    raw: { ignored: Math.random() },
  };

  assert.equal(fingerprinting.fingerprintDiagnostic(a), fingerprinting.fingerprintDiagnostic(b));
  assert.equal(fingerprinting.fingerprintBatch({ diagnostics: [a], status: "error", blockingCount: 1 }), fingerprinting.fingerprintBatch({ diagnostics: [b], status: "error", blockingCount: 1 }));
});

test("repair prompt includes blocking diagnostics and FORGE constraints", () => {
  const prompt = repairPrompt.formatDiagnosticRepairPrompt({
    diagnostics: [
      {
        source: "compiler",
        severity: "error",
        code: "syntax",
        message: "Unexpected token ?",
        fileName: "/index.js",
        line: 12,
        column: 5,
      },
    ],
    files: [file("index.html", "<body></body>", "html"), file("styles.css", "", "css"), file("app.js", "const x = user?.name;", "javascript")],
    pass: 2,
    maxPasses: 5,
  });

  assert.match(prompt, /AUTO-REPAIR/);
  assert.match(prompt, /\[compiler\] \/index\.js:12:5 Unexpected token \?/);
  assert.match(prompt, /Do not add npm dependencies/);
  assert.match(prompt, /Parcel rules/);
  assert.match(prompt, /Current authored files: index\.html, styles\.css, app\.js/);
});

test("display summary strips MiniMax reasoning blocks", () => {
  assert.equal(agentLoop.sanitizeDisplaySummary("<think>secret</think> Built app"), "Built app");
  assert.equal(
    agentLoop.sanitizeDisplaySummary("Intro <think>private\nreasoning</think> Done"),
    "Intro Done"
  );
});

test("diagnostic status resolves clean after Sandpack settle timeout", async () => {
  const bridge = await loadTsModule("../src/components/preview/SandpackDiagnosticsBridge.tsx");

  assert.equal(bridge.resolveDiagnosticStatus("running", 801, 0), "clean");
  assert.equal(bridge.resolveDiagnosticStatus("running", 799, 0), "checking");
  assert.equal(bridge.resolveDiagnosticStatus("done", 0, 1), "error");
});

test("replace_strings applies multiple exact replacements atomically", () => {
  const result = editTools.applyStringReplacements("one two three two", [
    { old_string: "one", new_string: "ONE" },
    { old_string: "three", new_string: "THREE" },
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.content, "ONE two THREE two");
});

test("replace_strings rejects ambiguous or missing replacements without partial writes", () => {
  const repeated = editTools.applyStringReplacements("same same", [
    { old_string: "same", new_string: "changed" },
  ]);
  const missing = editTools.applyStringReplacements("alpha beta", [
    { old_string: "gamma", new_string: "changed" },
  ]);

  assert.equal(repeated.ok, false);
  assert.match(repeated.error, /appears 2 times/);
  assert.equal(missing.ok, false);
  assert.match(missing.error, /not found/);
});

test("replace_strings can project replacements without mutating the original file", () => {
  const store = new editTools.ProjectFileStore([
    file("app.js", "var label = 'Old';\nconsole.log(label);"),
  ]);
  const original = store.read("app.js").content;
  const projected = editTools.projectToolFileUpdate("replace_strings", {
    path: "app.js",
    replacements: [
      { old_string: "'Old'", new_string: "'New'" },
      { old_string: "console.log(label);", new_string: "document.body.textContent = label;" },
    ],
  }, store);

  assert.equal(projected.ok, true);
  assert.equal(projected.file.name, "app.js");
  assert.match(projected.file.content, /'New'/);
  assert.equal(store.read("app.js").content, original);
});

test("create_file and edit_file projection validate exact matches before streaming", () => {
  const store = new editTools.ProjectFileStore([
    file("index.html", "<main>Old</main>", "html"),
  ]);
  const created = editTools.projectToolFileUpdate("create_file", {
    path: "extra.css",
    content: "body { color: red; }",
  }, store);
  const edited = editTools.projectToolFileUpdate("edit_file", {
    path: "index.html",
    old_string: "Old",
    new_string: "New",
  }, store);
  const missing = editTools.projectToolFileUpdate("edit_file", {
    path: "index.html",
    old_string: "Missing",
    new_string: "New",
  }, store);

  assert.equal(created.ok, true);
  assert.equal(created.file.name, "extra.css");
  assert.equal(edited.ok, true);
  assert.equal(edited.file.content, "<main>New</main>");
  assert.equal(missing.ok, false);
});
