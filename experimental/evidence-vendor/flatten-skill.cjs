// Bring the upstream benchmark-operation skill across, flattened.
//
// Upstream nests it two levels (`measurement/SKILL.md`, `measurement/running.md`).
// AGENTS.md here allows a SKILL.md plus one-level-deep siblings only, so each
// nested document becomes `<group>-<name>.md` and every cross-link is rewritten
// to match. The prose is otherwise untouched.
const fs = require("node:fs");
const path = require("node:path");

const UP = "D:/github/samchon/evidence/.agents/skills/benchmark";
const TO = "D:/github/samchon/ttsc/.agents/skills/evidence-benchmark";

fs.rmSync(TO, { recursive: true, force: true });
fs.mkdirSync(TO, { recursive: true });

const map = new Map(); // upstream relative path -> flattened filename
map.set("SKILL.md", "SKILL.md");
for (const group of ["measurement", "intervention"]) {
  const dir = path.join(UP, group);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const flat = name === "SKILL.md" ? `${group}.md` : `${group}-${name}`;
    map.set(`${group}/${name}`, flat);
  }
}

function rewriteLinks(text) {
  // `measurement/SKILL.md` -> `measurement.md`, `measurement/running.md` ->
  // `measurement-running.md`, and `../measurement/integrity.md` likewise.
  return text
    .replace(/\((?:\.\.\/)?(measurement|intervention)\/SKILL\.md\)/g, "($1.md)")
    .replace(
      /\((?:\.\.\/)?(measurement|intervention)\/([a-z-]+\.md)\)/g,
      "($1-$2)",
    )
    .replace(
      /\[(?:\.\.\/)?(measurement|intervention)\/([a-z-]+\.md)\]/g,
      "[$1-$2]",
    )
    .replace(/@samchon\/lint-plugin-evidence/g, "@ttsc/evidence")
    .replace(/@samchon\/evidence-benchmark/g, "@ttsc/evidence-benchmark")
    .replace(
      /\bbenchmark\/output\//g,
      "experimental/benchmark/evidence/output/",
    )
    .replace(
      /\bbenchmark\/aggregate\b/g,
      "experimental/benchmark/evidence/aggregate",
    );
}

for (const [source, flat] of map) {
  const from = path.join(UP, source);
  if (!fs.existsSync(from)) continue;
  let text = rewriteLinks(fs.readFileSync(from, "utf8"));
  if (flat === "SKILL.md") {
    // The frontmatter name must match the directory.
    text = text.replace(/^name: benchmark$/m, "name: evidence-benchmark");
  }
  fs.writeFileSync(path.join(TO, flat), text, "utf8");
}

console.log("files:", fs.readdirSync(TO).length);
for (const f of fs.readdirSync(TO).sort()) console.log("  ", f);

// Report any link that still points at a nested path.
let stale = 0;
for (const f of fs.readdirSync(TO)) {
  const t = fs.readFileSync(path.join(TO, f), "utf8");
  for (const m of t.matchAll(/\]\(([^)]+\.md)\)/g)) {
    if (m[1].includes("/")) {
      console.log("STALE LINK", f, "->", m[1]);
      stale++;
    }
  }
}
console.log("stale nested links:", stale);
