import type { SandpackFiles } from "@codesandbox/sandpack-react";
import type { ProjectFile } from "@/lib/types";

const PATH_MAP: Record<string, string> = {
  "index.html": "/index.html",
  "styles.css": "/styles.css",
  "app.js": "/index.js",
  "app.ts": "/index.ts",
};

/** Sandpack vanilla = Parcel; CSS must be imported from the JS entry for HMR. `<link href="styles.css">` does not reliably hot-reload. */
const PARCEL_CSS_IMPORT = `import "./styles.css";\n\n`;

function ensureParcelCssImport(js: string): string {
  if (/^\s*import\s+["']\.\/styles\.css["']\s*;?/m.test(js)) {
    return js;
  }
  return `${PARCEL_CSS_IMPORT}${js}`;
}

/**
 * Parcel entry is `/index.js`. HTML often references `app.js` + `<link>` — normalize so bundler owns CSS.
 * Also injects a script tag if M2.7 forgot to include one.
 */
function normalizeHtmlForSandpack(html: string): string {
  let out = html;
  /* Parcel bundles CSS from JS — strip link tags so we don't load stale CSS outside HMR */
  out = out.replace(/<link\s+[^>]*href=["'](?:\.\/)?styles\.css["'][^>]*>\s*/gi, "");
  /* Entry file is always /index.js in Sandpack */
  out = out.replace(/src=["'](?:\.\/)?app\.js["']/g, 'src="index.js"');
  /* Parcel serves plain script tag for bundled entry */
  out = out.replace(/\stype=["']module["']/gi, "");
  /* Inject script tag before </body> if M2.7 omitted it entirely */
  if (!/<script/i.test(out)) {
    out = out.replace(/<\/body>/i, '  <script src="index.js"></script>\n</body>');
  }
  return out;
}

export function toSandpackFiles(files: ProjectFile[]): SandpackFiles {
  const out: SandpackFiles = {};

  for (const f of files) {
    if (f.name === "app.js") {
      out["/index.js"] = {
        code: ensureParcelCssImport(f.content),
        active: false,
      };
      continue;
    }
    if (f.name === "index.html") {
      out["/index.html"] = {
        code: normalizeHtmlForSandpack(f.content),
        active: true,
      };
      continue;
    }

    const path = PATH_MAP[f.name] ?? `/${f.name}`;
    out[path] = { code: f.content, active: false };
  }

  return out;
}
