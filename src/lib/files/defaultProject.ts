import type { Project, ProjectFile } from "@/lib/types";

export const DEFAULT_FILES: ProjectFile[] = [
  {
    name: "index.html",
    language: "html",
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FORGE — Build apps at the speed of thought</title>
</head>
<body>
  <div class="grain" aria-hidden="true"></div>
  <div class="mesh" aria-hidden="true">
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="blob blob-3"></div>
  </div>

  <header class="nav">
    <a href="#top" class="brand">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path d="M6 14c0-4 3-8 7-8 2 0 3 1 3 3 0 3-4 3-4 6 0 1.5 1 3 3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
          <circle cx="15" cy="18" r="2" fill="currentColor"/>
        </svg>
      </span>
      <span class="brand-name">FORGE</span>
    </a>
    <nav class="nav-links" aria-label="Primary">
      <a href="#features">Features</a>
      <a href="#showcase">Showcase</a>
      <a href="#start">Start</a>
    </nav>
    <a href="#start" class="nav-cta">Open app →</a>
  </header>

  <main id="top">
    <section class="hero">
      <div class="hero-badge">
        <span class="pulse-dot" aria-hidden="true"></span>
        <span>Powered by MiniMax M2.7 · Tool calling enabled</span>
      </div>

      <h1 id="headline" class="display">
        Build apps at the<br />
        <span class="hot">speed of thought.</span>
      </h1>

      <p class="lede"><span id="typewriter">Build a SaaS dashboard…</span><span class="caret" aria-hidden="true">|</span></p>

      <p class="sub">
        FORGE turns natural language into running web apps — agentic tool calls, live preview, and built-in image generation in a single canvas.
      </p>

      <div class="cta-row">
        <button id="cta" class="btn btn-primary" type="button">
          <span>Start building</span>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <a href="#showcase" class="btn btn-ghost">
          <span class="play-tri" aria-hidden="true"></span>
          Watch demo
        </a>
      </div>
    </section>

    <section id="features" class="features">
      <article class="card">
        <div class="card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path d="M4 7h10M4 12h16M4 17h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="18" cy="7" r="2.2" fill="currentColor"/>
            <circle cx="18" cy="17" r="2.2" fill="currentColor"/>
          </svg>
        </div>
        <h3>Agentic Tool Calls</h3>
        <p>FORGE plans, searches docs, writes diffs, and edits files — orchestrating itself like a senior engineer.</p>
      </article>

      <article class="card">
        <div class="card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <rect x="3" y="4" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>
            <path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M10 9l4 2.5L10 14V9z" fill="currentColor"/>
          </svg>
        </div>
        <h3>Live Preview</h3>
        <p>Sandboxed Parcel preview hot-reloads as the model edits. Watch your app come alive token by token.</p>
      </article>

      <article class="card">
        <div class="card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>
            <circle cx="9" cy="10" r="1.8" fill="currentColor"/>
            <path d="M4 18l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3>Built-in Image Gen</h3>
        <p>Generate hero art, icons, and textures inline — no CDN round-trips, no API keys to wrangle.</p>
      </article>
    </section>

    <section id="showcase" class="showcase">
      <span class="section-eyebrow">From prompt to product</span>
      <h2 class="section-title">Code on the left. Reality on the right.</h2>

      <div class="ide">
        <div class="ide-bar">
          <span class="dot r" aria-hidden="true"></span>
          <span class="dot y" aria-hidden="true"></span>
          <span class="dot g" aria-hidden="true"></span>
          <span class="ide-title">app.jsx</span>
        </div>
        <div class="ide-body">
          <pre class="code"><code><span class="c">// generated by FORGE in 3.2s</span>
<span class="k">import</span> { <span class="f">useState</span> } <span class="k">from</span> <span class="s">"react"</span>;

<span class="k">export default function</span> <span class="f">Counter</span>() {
  <span class="k">const</span> [count, setCount] = <span class="f">useState</span>(<span class="t">0</span>);

  <span class="k">return</span> (
    &lt;<span class="t">button</span>
      onClick={() =&gt; <span class="f">setCount</span>(count + <span class="t">1</span>)}
      className=<span class="s">"glow"</span>
    &gt;
      Pressed {count} times
    &lt;/<span class="t">button</span>&gt;
  );
}</code></pre>
          <div class="preview">
            <div class="preview-bar">live preview</div>
            <div class="preview-body">
              <button class="demo-btn" type="button">Pressed 0 times</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="start" class="finale">
      <h2>Your next app starts<br />with a single prompt.</h2>
      <p class="finale-sub">No setup. No boilerplate. Just describe it.</p>
      <button class="btn btn-primary btn-glow" type="button" onclick="document.getElementById('cta').click()">
        <span>Start building</span>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </section>
  </main>

  <footer class="foot">
    <span>FORGE · 2026</span>
    <span class="muted">Built inside a FORGE-generated FORGE preview.</span>
  </footer>

  <script src="index.js"></script>
</body>
</html>`,
  },
  {
    name: "styles.css",
    language: "css",
    content: `* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #08070a;
  --panel: #131110;
  --edge: rgba(255, 232, 200, 0.09);
  --edge-bright: rgba(255, 232, 200, 0.2);
  --fg: #f6efe6;
  --muted: #9a8b7c;
  --molt: #f97316;
  --molt-bright: #fb923c;
  --ember: #fbbf24;
  --violet: #7c3aed;
  --azure: #2563eb;
}

html, body {
  background: var(--bg);
  color: var(--fg);
  font-family: ui-sans-serif, system-ui, -apple-system, "Inter", sans-serif;
  font-feature-settings: "ss01", "cv11";
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  overflow-x: hidden;
}

a { color: inherit; text-decoration: none; }
button { font: inherit; cursor: pointer; }

/* Atmospheric background layers */
.grain {
  position: fixed; inset: 0; pointer-events: none; z-index: 1;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.35 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: 0.08;
  mix-blend-mode: overlay;
}

.mesh {
  position: fixed; inset: -20%; z-index: 0; pointer-events: none;
  filter: blur(90px); opacity: 0.7;
}
.blob {
  position: absolute; width: 38rem; height: 38rem; border-radius: 50%;
  mix-blend-mode: screen;
  animation: drift 24s ease-in-out infinite alternate;
}
.blob-1 { background: radial-gradient(circle, var(--molt) 0%, transparent 60%); top: -15%; left: -10%; }
.blob-2 { background: radial-gradient(circle, var(--violet) 0%, transparent 60%); top: 5%; right: -15%; animation-delay: -8s; }
.blob-3 { background: radial-gradient(circle, var(--azure) 0%, transparent 60%); bottom: -25%; left: 30%; animation-delay: -16s; }

@keyframes drift {
  0%   { transform: translate3d(0, 0, 0) scale(1); }
  100% { transform: translate3d(4rem, -3rem, 0) scale(1.12); }
}

main { position: relative; z-index: 2; max-width: 78rem; margin: 0 auto; padding: 0 1.5rem; }

/* Nav */
.nav {
  position: relative; z-index: 3;
  display: flex; align-items: center; justify-content: space-between;
  max-width: 78rem; margin: 0 auto; padding: 1.1rem 1.5rem;
}
.brand { display: inline-flex; align-items: center; gap: 0.55rem; font-weight: 700; letter-spacing: 0.05em; }
.brand-mark { color: var(--molt); display: inline-flex; }
.brand-name { font-size: 0.95rem; }
.nav-links { display: flex; gap: 1.6rem; font-size: 0.875rem; color: var(--muted); }
.nav-links a:hover { color: var(--fg); }
.nav-cta {
  font-size: 0.85rem; color: var(--fg);
  padding: 0.45rem 0.95rem; border-radius: 999px;
  border: 1px solid var(--edge);
  background: color-mix(in oklab, var(--panel) 75%, transparent);
  backdrop-filter: blur(10px);
  transition: border-color 0.2s, background 0.2s;
}
.nav-cta:hover { border-color: var(--edge-bright); background: color-mix(in oklab, var(--panel) 90%, transparent); }

/* Hero */
.hero { padding: 4.5rem 0 5.5rem; text-align: center; }
.hero-badge {
  display: inline-flex; align-items: center; gap: 0.55rem;
  padding: 0.4rem 0.9rem; border-radius: 999px;
  background: color-mix(in oklab, var(--panel) 65%, transparent);
  border: 1px solid var(--edge);
  font-size: 0.78rem; color: var(--muted);
  margin-bottom: 1.75rem;
  backdrop-filter: blur(10px);
}
.pulse-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--molt); box-shadow: 0 0 12px var(--molt);
  animation: pulse 1.8s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.7; transform: scale(0.9); }
  50%      { opacity: 1;   transform: scale(1.2); }
}

.display {
  font-size: clamp(2.5rem, 6.2vw, 4.75rem);
  line-height: 1.02;
  letter-spacing: -0.035em;
  font-weight: 700;
  margin-bottom: 1.5rem;
  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.display .hot {
  background: linear-gradient(120deg, var(--molt) 0%, var(--ember) 45%, var(--molt-bright) 100%);
  background-size: 220% 100%;
  -webkit-background-clip: text; background-clip: text;
  color: transparent;
  animation: gradientShift 8s ease-in-out infinite;
}
@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}
.display.bump { animation: bump 0.55s cubic-bezier(0.2, 0.8, 0.2, 1); }
@keyframes bump {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.045); }
  100% { transform: scale(1); }
}

.lede {
  font-family: ui-monospace, "JetBrains Mono", monospace;
  font-size: 0.95rem;
  color: var(--ember);
  min-height: 1.5em;
  margin-bottom: 1.1rem;
}
.caret { display: inline-block; margin-left: 2px; color: var(--molt); animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }

.sub {
  max-width: 36rem; margin: 0 auto 2.25rem;
  color: var(--muted); font-size: 1.05rem; line-height: 1.65;
}

.cta-row { display: flex; gap: 0.85rem; justify-content: center; flex-wrap: wrap; }
.btn {
  display: inline-flex; align-items: center; gap: 0.55rem;
  padding: 0.85rem 1.4rem; border-radius: 0.7rem;
  font-weight: 600; font-size: 0.95rem;
  border: 1px solid transparent;
  transition: transform 0.15s, box-shadow 0.25s, background 0.2s, border-color 0.2s;
}
.btn-primary {
  background: linear-gradient(180deg, var(--molt-bright), var(--molt));
  color: #1a0d05;
  box-shadow:
    0 10px 30px -10px color-mix(in oklab, var(--molt) 70%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow:
    0 14px 38px -10px color-mix(in oklab, var(--molt) 85%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.btn-ghost {
  background: color-mix(in oklab, var(--panel) 70%, transparent);
  color: var(--fg);
  border-color: var(--edge);
  backdrop-filter: blur(10px);
}
.btn-ghost:hover { border-color: var(--edge-bright); }
.play-tri {
  width: 0; height: 0; border-left: 7px solid var(--molt);
  border-top: 4px solid transparent; border-bottom: 4px solid transparent;
}

/* Features */
.features {
  display: grid; gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  margin-bottom: 5rem;
}
.card {
  position: relative; overflow: hidden;
  padding: 1.5rem;
  background: color-mix(in oklab, var(--panel) 78%, transparent);
  border: 1px solid var(--edge);
  border-radius: 0.95rem;
  backdrop-filter: blur(12px);
  transition: border-color 0.25s, transform 0.25s;
}
.card::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  background: linear-gradient(135deg, color-mix(in oklab, var(--molt) 22%, transparent), transparent 55%);
  opacity: 0; transition: opacity 0.3s;
  pointer-events: none;
}
.card:hover { border-color: var(--edge-bright); transform: translateY(-2px); }
.card:hover::before { opacity: 1; }
.card-icon {
  width: 2.3rem; height: 2.3rem; border-radius: 0.55rem;
  display: grid; place-items: center;
  background: color-mix(in oklab, var(--molt) 20%, transparent);
  color: var(--molt-bright);
  margin-bottom: 0.9rem;
}
.card h3 { font-size: 1.02rem; margin-bottom: 0.4rem; letter-spacing: -0.01em; font-weight: 600; }
.card p { color: var(--muted); font-size: 0.9rem; line-height: 1.55; }

/* Showcase */
.showcase { margin-bottom: 5rem; }
.section-eyebrow {
  display: block; text-align: center;
  font-size: 0.78rem; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--molt); margin-bottom: 0.75rem;
}
.section-title {
  text-align: center;
  font-size: clamp(1.6rem, 3vw, 2.25rem);
  letter-spacing: -0.02em;
  margin-bottom: 2.25rem;
  font-weight: 600;
}

.ide {
  background: #0c0b09;
  border: 1px solid var(--edge);
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 40px 90px -30px rgba(0, 0, 0, 0.75);
}
.ide-bar {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.7rem 1rem;
  background: #15130f;
  border-bottom: 1px solid var(--edge);
}
.dot { width: 11px; height: 11px; border-radius: 50%; }
.dot.r { background: #ff5f57; }
.dot.y { background: #febc2e; }
.dot.g { background: #28c840; }
.ide-title { margin-left: 0.75rem; font-size: 0.78rem; color: var(--muted); font-family: ui-monospace, monospace; }

.ide-body {
  display: grid; grid-template-columns: 1fr 1fr;
  min-height: 19rem;
}
.code {
  padding: 1.25rem 1.4rem;
  font-family: ui-monospace, "JetBrains Mono", monospace;
  font-size: 0.82rem; line-height: 1.7;
  border-right: 1px solid var(--edge);
  white-space: pre; overflow: auto;
  color: #c9c0b3;
}
.code .k { color: #ff8a65; }
.code .s { color: #fbbf24; }
.code .f { color: #93c5fd; }
.code .c { color: #6b6359; font-style: italic; }
.code .t { color: #a78bfa; }

.preview {
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, #1a1614, #0e0d0b);
}
.preview-bar {
  padding: 0.5rem 1rem; font-size: 0.72rem; color: var(--muted);
  border-bottom: 1px solid var(--edge);
  font-family: ui-monospace, monospace;
}
.preview-body {
  flex: 1; display: grid; place-items: center; padding: 2rem;
  background-image:
    radial-gradient(circle at 30% 30%, color-mix(in oklab, var(--molt) 35%, transparent), transparent 55%),
    radial-gradient(circle at 70% 70%, color-mix(in oklab, var(--violet) 28%, transparent), transparent 55%);
}
.demo-btn {
  padding: 0.7rem 1.2rem; border-radius: 0.55rem;
  background: linear-gradient(180deg, var(--molt-bright), var(--molt));
  color: #1a0d05; font-weight: 600; border: none;
  box-shadow: 0 10px 26px -8px var(--molt);
}

/* Finale */
.finale {
  text-align: center;
  padding: 4.5rem 0 5rem;
  border-top: 1px solid var(--edge);
  margin-top: 1rem;
}
.finale h2 {
  font-size: clamp(2rem, 4.5vw, 3.25rem);
  letter-spacing: -0.03em;
  line-height: 1.05;
  margin-bottom: 0.9rem;
  font-weight: 700;
}
.finale-sub { color: var(--muted); margin-bottom: 1.9rem; }
.btn-glow {
  position: relative;
  animation: glow 2.8s ease-in-out infinite;
}
@keyframes glow {
  0%, 100% {
    box-shadow:
      0 10px 30px -10px color-mix(in oklab, var(--molt) 55%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.28);
  }
  50% {
    box-shadow:
      0 14px 50px -8px color-mix(in oklab, var(--molt) 95%, transparent),
      0 0 0 6px color-mix(in oklab, var(--molt) 14%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.35);
  }
}

/* Footer */
.foot {
  position: relative; z-index: 2;
  max-width: 78rem; margin: 0 auto; padding: 1.5rem;
  display: flex; justify-content: space-between; align-items: center;
  color: var(--muted); font-size: 0.78rem;
}
.muted { opacity: 0.7; }

@media (max-width: 720px) {
  .ide-body { grid-template-columns: 1fr; }
  .code { border-right: none; border-bottom: 1px solid var(--edge); }
  .nav-links { display: none; }
  .foot { flex-direction: column; gap: 0.5rem; text-align: center; }
}`,
  },
  {
    name: "app.js",
    language: "javascript",
    content: `(function () {
  var anchors = document.querySelectorAll('a[href^="#"]');
  for (var i = 0; i < anchors.length; i++) {
    anchors[i].addEventListener("click", function (e) {
      var href = this.getAttribute("href");
      if (href && href.length > 1) {
        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  }

  var cta = document.getElementById("cta");
  var headline = document.getElementById("headline");
  if (cta && headline) {
    cta.addEventListener("click", function () {
      headline.classList.remove("bump");
      void headline.offsetWidth;
      headline.classList.add("bump");
      console.log("Welcome to FORGE — start prompting!");
    });
  }

  var phrases = [
    "Build a SaaS dashboard…",
    "Build a portfolio site…",
    "Build an analytics tool…",
    "Build a real-time chat app…"
  ];
  var typeEl = document.getElementById("typewriter");
  if (typeEl) {
    typeEl.textContent = "";
    var pi = 0;
    var ci = 0;
    var deleting = false;

    var tick = function () {
      var full = phrases[pi];
      if (deleting) {
        ci = ci - 1;
        typeEl.textContent = full.slice(0, ci);
        if (ci <= 0) {
          deleting = false;
          pi = (pi + 1) % phrases.length;
          setTimeout(tick, 320);
          return;
        }
        setTimeout(tick, 25);
      } else {
        ci = ci + 1;
        typeEl.textContent = full.slice(0, ci);
        if (ci >= full.length) {
          deleting = true;
          setTimeout(tick, 1800);
          return;
        }
        setTimeout(tick, 65);
      }
    };
    tick();
  }
})();`,
  },
];

export function createDefaultProject(): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "my-app",
    files: DEFAULT_FILES.map((f) => ({ ...f })),
    activeFile: "index.html",
    createdAt: now,
    updatedAt: now,
  };
}

export function inferLanguage(name: string): ProjectFile["language"] {
  if (name.endsWith(".html")) return "html";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".ts")) return "typescript";
  return "javascript";
}
