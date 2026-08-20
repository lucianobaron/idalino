// check-skills.mjs — verifica se as skills vendored (fable-method, hallmark,
// i-have-adhd) estão sincronizadas com a branch main dos repositórios originais.
//
// Uso: node check-skills.mjs   (a partir da raiz do projeto)
// Exit: 0 = sincronizadas · 1 = alguma divergência · 2 = erro de execução
//
// Como funciona: compara o blob SHA (git) de cada arquivo local com o blob SHA
// do upstream (GitHub API, árvore recursiva da branch main). Não depende de
// `git`: o hash é calculado em Node sobre o conteúdo em disco, com CRLF→LF para
// arquivos de texto (imune a autocrlf; o upstream guarda LF) e bytes crus para
// binários (detecção por NUL).
//
// Divergências esperadas (intencionais, não são erro):
//   - hallmark/update.mjs  — script local de atualização (não existe no upstream);
//   - .claude/skills/i-have-adhd/SKILL.md (e cópia .github) — tem a seção local
//     "Estrutura obrigatória de resposta (diretriz do projeto)"; a comparação
//     remove essa seção antes de comparar com o upstream.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const headers = { "User-Agent": "dsh-agent" };

// --- config das skills vendored -------------------------------------------

const SKILLS = [
  {
    nome: "fable-method",
    repo: "Sahir619/fable-method",
    dir: "fable-method",
    // upstream inteiro -> fable-method/<path>
    map: (p) => `fable-method/${p}`,
    extrasPermitidos: [],
  },
  {
    nome: "hallmark",
    repo: "Nutlope/hallmark",
    dir: "hallmark",
    // upstream: LICENSE + skills/hallmark/* -> hallmark/*
    map: (p) =>
      p === "LICENSE"
        ? "hallmark/LICENSE"
        : p.startsWith("skills/hallmark/")
          ? "hallmark/" + p.slice("skills/hallmark/".length)
          : null,
    extrasPermitidos: ["hallmark/update.mjs"],
  },
  {
    nome: "i-have-adhd",
    repo: "ayghri/i-have-adhd",
    dir: ".claude/skills/i-have-adhd",
    // upstream: skills/i-have-adhd/* -> .claude/skills/i-have-adhd/*
    map: (p) =>
      p.startsWith("skills/i-have-adhd/")
        ? ".claude/skills/i-have-adhd/" + p.slice("skills/i-have-adhd/".length)
        : null,
    extrasPermitidos: [],
    // arquivo com seção local adicionada pelo projeto (comparação especial)
    patched: [".claude/skills/i-have-adhd/SKILL.md"],
    // cópia espelhada (DEC-20) que deve ser idêntica ao diretório principal
    copia: ".github/skills/i-have-adhd",
  },
];

const SECAO_LOCAL = "## Estrutura obrigatória de resposta (diretriz do projeto)";
const MARCO_FIM = "## Pre-send check";

// --- helpers ---------------------------------------------------------------

function blobSha(bytes) {
  const h = createHash("sha1");
  h.update(`blob ${bytes.length}\0`);
  h.update(bytes);
  return h.digest("hex");
}

// hash do arquivo local como o git o veria (LF para texto, bytes crus p/ binário)
function localSha(rel) {
  const buf = readFileSync(path.join(ROOT, rel));
  if (buf.includes(0)) return blobSha(buf); // binário (ex.: fable-method/assets/cover.png)
  return blobSha(Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n"), "utf8"));
}

// remove a seção local adicionada ao SKILL.md do i-have-adhd antes de comparar
function semSecaoLocal(content) {
  const s = content.indexOf(SECAO_LOCAL);
  const e = s === -1 ? -1 : content.indexOf(MARCO_FIM, s);
  if (s === -1 || e === -1) return content; // seção ausente: compara integral (vai sinalizar)
  return content.slice(0, s).trimEnd() + "\n\n" + content.slice(e);
}

function arquivosLocais(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = path.join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(path.relative(ROOT, p).split(path.sep).join("/"));
    }
  };
  walk(path.join(ROOT, dir));
  return out;
}

async function arvoreUpstream(repo) {
  const r = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/main?recursive=1`,
    { headers }
  );
  if (!r.ok) throw new Error(`${repo} -> HTTP ${r.status}`);
  const j = await r.json();
  const map = {};
  for (const t of j.tree) if (t.type === "blob") map[t.path] = t.sha;
  return map;
}

// --- comparação ------------------------------------------------------------

async function checaSkill(skill) {
  const up = await arvoreUpstream(skill.repo);
  // rel local -> { pathUpstream, shaUpstream } (só paths que o escopo vendored exige)
  const esperados = new Map();
  for (const p of Object.keys(up)) {
    const rel = skill.map(p);
    if (rel) esperados.set(rel, { path: p, sha: up[p] });
  }
  const locais = arquivosLocais(skill.dir);

  const divergidos = [];
  const faltando = [];
  const extras = [];
  const divergenciasCopia = [];

  for (const [rel, info] of esperados) {
    if (!locais.includes(rel)) {
      faltando.push(rel);
      continue;
    }
    if (skill.patched?.includes(rel)) {
      const local = readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
      const upstream = await fetch(
        `https://raw.githubusercontent.com/${skill.repo}/main/${info.path}`,
        { headers }
      ).then((r) => {
        if (!r.ok) throw new Error(`raw ${info.path} -> HTTP ${r.status}`);
        return r.text();
      });
      if (semSecaoLocal(local) !== upstream.replace(/\r\n/g, "\n")) divergidos.push(rel);
    } else if (localSha(rel) !== info.sha) {
      divergidos.push(rel);
    }
  }
  for (const rel of locais) {
    if (!esperados.has(rel) && !skill.extrasPermitidos.includes(rel)) extras.push(rel);
  }
  if (skill.copia) {
    const dirCopia = skill.dir.replace(/^\.claude\//, ".github/");
    for (const rel of locais) {
      const espelho = rel.replace(skill.dir, dirCopia);
      if (!arquivosLocais(dirCopia).includes(espelho)) {
        divergenciasCopia.push(`${rel} -> ausente na cópia ${dirCopia}`);
      } else if (localSha(rel) !== localSha(espelho)) {
        divergenciasCopia.push(`${rel} -> difere da cópia ${dirCopia}`);
      }
    }
  }

  return { divergidos, faltando, extras, divergenciasCopia };
}

// --- relatório -------------------------------------------------------------

function resumo(skill, r) {
  const problemas =
    r.divergidos.length + r.faltando.length + r.extras.length + r.divergenciasCopia.length;
  console.log(`\n=== ${skill.nome} (${skill.repo} @ main) ===`);
  if (problemas === 0) {
    console.log("SINCRONIZADA com o upstream.");
    return false;
  }
  if (r.divergidos.length) console.log(`DIVERGENTES:\n  ${r.divergidos.join("\n  ")}`);
  if (r.faltando.length) console.log(`FALTANDO LOCALMENTE:\n  ${r.faltando.join("\n  ")}`);
  if (r.extras.length) console.log(`EXTRAS LOCAIS (fora do escopo vendored):\n  ${r.extras.join("\n  ")}`);
  if (r.divergenciasCopia.length)
    console.log(`CÓPIA ESPELHADA DIVERGENTE:\n  ${r.divergenciasCopia.join("\n  ")}`);
  return true;
}

let falhas = 0;
try {
  for (const skill of SKILLS) {
    if (resumo(skill, await checaSkill(skill))) falhas++;
  }
  console.log(
    `\n${falhas === 0 ? "OK: todas as skills vendored estão em sincronia com o upstream." : `DIVERGÊNCIA em ${falhas} skill(s) — atualize seguindo os procedimentos §3.4 (fable-method), §3.11 (hallmark) e a seção de atualização do i-have-adhd em docs/DIRETRIZES.md.`}`
  );
  process.exitCode = falhas === 0 ? 0 : 1;
} catch (e) {
  console.error(`\nERRO: ${e.message}`);
  console.error("Não foi possível concluir a checagem (rede/GitHub indisponíveis?).");
  process.exitCode = 2;
}
