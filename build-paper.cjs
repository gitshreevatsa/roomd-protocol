// Build the typeset paper (HTML + optional PDF) from the markdown source.
//
// Usage, from the protocol/ directory:
//   npm i
//   node build-paper.cjs          # HTML only (~tens of KB; Mermaid from CDN)
//   node build-paper.cjs --pdf    # also print PDF via headless Chrome
//
// Inputs:  the-room-protocol-whitepaper.md
// Outputs: the-room-protocol.html, (optional) the-room-protocol.pdf
//          copies HTML to roomd-web/public/the-room-protocol.html

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { marked } = require("marked");

const REPO = path.resolve(__dirname, "..");
const SRC = path.join(REPO, "protocol/the-room-protocol-whitepaper.md");
const OUT = path.join(REPO, "protocol/the-room-protocol.html");
const OUT_PDF = path.join(REPO, "protocol/the-room-protocol.pdf");
const WEB_COPY = path.join(REPO, "roomd-web/public/the-room-protocol.html");
const WANT_PDF = process.argv.includes("--pdf");

const MERMAID_CDN =
  "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "google-chrome",
  "chromium",
  "chromium-browser",
].filter(Boolean);

// --- markdown -> html body -------------------------------------------------

const renderer = new marked.Renderer();
renderer.code = (code, infostring) => {
  const lang = (infostring || "").trim();
  if (lang === "mermaid") {
    // Keep diagram source intact for Mermaid; only escape HTML closers.
    const safe = code.replace(/<\/(script|pre)/gi, "<\\/$1");
    return `<figure class="diagram"><pre class="mermaid">${safe}</pre></figure>`;
  }
  const esc = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre class="code"><code>${esc}</code></pre>`;
};

marked.use({ renderer, gfm: true, headerIds: true, mangle: false });

let body = marked.parse(fs.readFileSync(SRC, "utf8"));

body = body.replace(
  /<p><strong>Shreyas Padmakiran<\/strong>/,
  '<p class="byline"><strong>Shreyas Padmakiran</strong>'
);
body = body.replace(
  /<p><strong>(Figure|Table) /g,
  '<p class="caption"><strong>$1 '
);
body = body.replace(/<p>(\[\d+\]) /g, '<p class="ref">$1 ');

// --- template --------------------------------------------------------------

const css = `
:root { --ink:#1a1a1a; --muted:#5b6069; --rule:#e2e4e8; --accent:#2f6fed; --code-bg:#f6f7f9; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  color: var(--ink);
  background: #fff;
  font-family: Charter, "Bitstream Charter", "Iowan Old Style", Georgia, Cambria, "Times New Roman", serif;
  font-size: 12pt;
  line-height: 1.62;
  margin: 0;
}
.page { max-width: 46rem; margin: 0 auto; padding: 4.5rem 1.5rem 6rem; }

h1 {
  font-size: 2.15rem; line-height: 1.15; font-weight: 700; letter-spacing: -0.01em;
  text-align: center; margin: 0 0 0.4rem;
}
h1 + h3 {
  text-align: center; font-weight: 400; font-style: italic;
  font-size: 1.2rem; color: var(--muted); margin: 0 0 1.6rem; letter-spacing: 0;
}
.byline {
  text-align: center; color: var(--muted); font-size: 0.92rem; line-height: 1.7;
  margin: 0 0 0.5rem;
}
.byline strong { color: var(--ink); }
.byline a { color: var(--accent); text-decoration: none; }

h2 {
  font-size: 1.28rem; font-weight: 700; letter-spacing: -0.005em;
  margin: 2.6rem 0 0.8rem; padding-top: 0.2rem;
}
h3 { font-size: 1.06rem; font-weight: 700; margin: 1.8rem 0 0.6rem; }
h4 { font-size: 0.98rem; font-weight: 700; margin: 1.3rem 0 0.5rem; }

p { margin: 0 0 0.9rem; }
a { color: var(--accent); }

#abstract { text-align: center; font-size: 1.1rem; margin-top: 2.2rem; }
#abstract + p {
  font-size: 0.96rem; color: #2a2d33; margin: 0 1.4rem 1.2rem;
}

hr { border: 0; border-top: 1px solid var(--rule); margin: 2rem 0; }

ul, ol { margin: 0 0 0.9rem; padding-left: 1.3rem; }
li { margin: 0.25rem 0; }

strong { font-weight: 700; }
code {
  font-family: "SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.85em; background: var(--code-bg); padding: 0.1em 0.35em; border-radius: 4px;
}
pre.code {
  background: var(--code-bg); border: 1px solid var(--rule); border-radius: 8px;
  padding: 0.9rem 1.1rem; overflow-x: auto; font-size: 0.82rem; line-height: 1.5;
  margin: 0 0 1.1rem;
}
pre.code code { background: none; padding: 0; font-size: inherit; }

table {
  width: 100%; border-collapse: collapse; margin: 0.4rem 0 0.5rem;
  font-size: 0.86rem; line-height: 1.45;
}
thead th {
  text-align: left; font-weight: 700; border-bottom: 1.5px solid #cfd3da;
  padding: 0.45rem 0.6rem;
}
tbody td { padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--rule); vertical-align: top; }
tbody tr:last-child td { border-bottom: 1.5px solid #cfd3da; }
table code { background: none; padding: 0; font-size: 0.92em; }

.caption {
  text-align: center; font-size: 0.85rem; color: var(--muted);
  margin: 0.5rem auto 1.6rem; max-width: 40rem;
}
.caption strong { color: var(--ink); }

figure.diagram { margin: 1.6rem 0 0.4rem; text-align: center; }
figure.diagram .mermaid { display: inline-block; max-width: 100%; }
figure.diagram svg { max-width: 100%; height: auto; }

.ref {
  font-size: 0.86rem; line-height: 1.5; color: #2a2d33;
  padding-left: 1.7rem; text-indent: -1.7rem; margin: 0 0 0.5rem;
}
.ref a { word-break: break-word; }

@media print {
  body { font-size: 10.5pt; }
  .page { max-width: none; padding: 0; }
  h2 { break-after: avoid; }
  figure.diagram, table, pre.code { break-inside: avoid; }
  .caption { break-before: avoid; }
  a { color: var(--ink); text-decoration: none; }
}
@page { margin: 18mm 17mm 20mm; }
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Room Protocol</title>
<meta name="author" content="Shreyas Padmakiran">
<meta name="description" content="Shared-State Coordination for Multi-Agent Software Development. A technical report.">
<style>${css}</style>
</head>
<body>
<main class="page">
${body}
</main>
<script src="${MERMAID_CDN}"></script>
<script>
  mermaid.initialize({
    startOnLoad: true,
    theme: "neutral",
    securityLevel: "loose",
    fontFamily: 'Charter, Georgia, "Times New Roman", serif',
    sequence: { useMaxWidth: true, mirrorActors: false, actorMargin: 48 },
    flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" }
  });
  // Signal for headless PDF: wait until every diagram has an SVG child.
  window.__diagramsReady = (async () => {
    const nodes = Array.from(document.querySelectorAll("pre.mermaid"));
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (nodes.every((n) => n.querySelector("svg") || n.getAttribute("data-processed"))) {
        // data-processed is set before SVG paint; give one frame.
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
        if (nodes.every((n) => n.querySelector("svg"))) return true;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  })();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html);
fs.mkdirSync(path.dirname(WEB_COPY), { recursive: true });
fs.copyFileSync(OUT, WEB_COPY);
console.log("wrote", OUT, `(${(html.length / 1024).toFixed(0)} KB)`);
console.log("copied", WEB_COPY);

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate.includes("/") || candidate.startsWith(".")) {
      if (fs.existsSync(candidate)) return candidate;
    } else {
      const which = spawnSync("which", [candidate], { encoding: "utf8" });
      if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
    }
  }
  return null;
}

if (WANT_PDF) {
  const chrome = findChrome();
  if (!chrome) {
    console.error("Chrome not found; HTML built but PDF skipped. Set CHROME_PATH.");
    process.exitCode = 1;
  } else {
    // Allow Mermaid CDN fetch + diagram paint before print.
    // Note: headless Chrome needs network access to load the CDN script.
    const result = spawnSync(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--virtual-time-budget=45000",
        "--run-all-compositor-stages-before-draw",
        `--print-to-pdf=${OUT_PDF}`,
        `file://${OUT}`,
      ],
      { encoding: "utf8", timeout: 90000 }
    );
    if (result.error) {
      console.error(result.error.message);
      process.exitCode = 1;
    } else if (result.status !== 0) {
      console.error(result.stderr || result.stdout || `chrome exited ${result.status}`);
      process.exitCode = 1;
    } else if (!fs.existsSync(OUT_PDF)) {
      console.error("chrome reported success but PDF missing");
      process.exitCode = 1;
    } else {
      const kb = (fs.statSync(OUT_PDF).size / 1024).toFixed(0);
      console.log("wrote", OUT_PDF, `(${kb} KB)`);
    }
  }
}
