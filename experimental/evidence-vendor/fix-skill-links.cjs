// Repair the sibling links the flattening missed.
//
// Upstream, `measurement/running.md` links to a peer as `plain-review.md`,
// because they share a directory. Flattened, that peer is
// `measurement-plain-review.md`. Only a document that came from a group needs
// this, and only for names that exist in that same group.
const fs = require("node:fs");
const path = require("node:path");

const dir = "D:/github/samchon/ttsc/.agents/skills/evidence-benchmark";
const files = fs.readdirSync(dir);
const exists = new Set(files);

let repaired = 0;
for (const file of files) {
  const group = /^(measurement|intervention)(?:-|\.md$)/.exec(file)?.[1];
  if (!group) continue; // SKILL.md already uses fully qualified links
  const full = path.join(dir, file);
  const before = fs.readFileSync(full, "utf8");
  const after = before.replace(
    /\]\((?!https?:|\/|\.\.\/)([a-z][a-z-]*\.md)(#[^)]*)?\)/g,
    (whole, name, anchor = "") => {
      if (exists.has(name)) return whole; // already flattened or unrelated
      const flat = `${group}-${name}`;
      return exists.has(flat) ? `](${flat}${anchor})` : whole;
    },
  );
  if (after !== before) {
    fs.writeFileSync(full, after, "utf8");
    repaired++;
  }
}
console.log("files repaired:", repaired);

// Re-verify.
let checked = 0;
const missing = [];
for (const file of files) {
  const text = fs.readFileSync(path.join(dir, file), "utf8");
  for (const m of text.matchAll(/\]\(([^)#]+\.md)(#[^)]*)?\)/g)) {
    checked++;
    if (!fs.existsSync(path.resolve(dir, m[1])))
      missing.push(`${file} -> ${m[1]}`);
  }
}
console.log("links checked:", checked, "| broken:", missing.length);
for (const m of missing) console.log("  ", m);
