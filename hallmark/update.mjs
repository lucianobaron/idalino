// Atualiza o conteúdo vendored de hallmark/ a partir da branch main de
// Nutlope/hallmark. Mantém apenas a skill (SKILL.md + references/) + LICENSE.
// Uso: node hallmark/update.mjs  (a partir da raiz do projeto)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "Nutlope/hallmark";
const BRANCH = "main";
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

const headers = { "User-Agent": "dsh-agent" };

async function fetchText(url) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url} -> ${r.status} ${r.statusText}`);
  return r.text();
}

const treeUrl = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
const tree = await fetch(treeUrl, { headers }).then((r) => r.json());

const wanted = tree.tree
  .filter((item) => item.type === "blob")
  .map((item) => item.path)
  .filter((p) => p === "LICENSE" || p.startsWith("skills/hallmark/"));

const results = [];
for (const p of wanted) {
  const dest = p === "LICENSE" ? path.join(OUT, "LICENSE") : path.join(OUT, p.replace("skills/hallmark/", ""));
  try {
    const content = await fetchText(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${p}`);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, content, "utf8");
    results.push(`ok   ${p}`);
  } catch (e) {
    results.push(`FAIL ${p} -> ${e.message}`);
  }
}

console.log(results.join("\n"));
const ok = results.filter((r) => r.startsWith("ok")).length;
const fail = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${ok} arquivos atualizados, ${fail} falhas (total ${wanted.length})`);
if (fail > 0) process.exitCode = 1;
