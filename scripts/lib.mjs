// Shared helpers for build.mjs and validate.mjs. Zero dependencies.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FASES = ['A', 'B', 'C'];
export const TYPES = ['konsep', 'prosedur', 'representasi', 'bahasa', 'meta'];
export const STRENGTHS = ['wajib', 'bantu'];

export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Every authoring/<mapel>/<fase>.json file, in mapel then fase order.
export function loadAuthoring() {
  const dir = join(ROOT, 'authoring');
  const files = [];
  for (const mapel of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    for (const fase of FASES) {
      const p = join(dir, mapel, `${fase}.json`);
      if (existsSync(p)) files.push({ path: `authoring/${mapel}/${fase}.json`, doc: readJson(p) });
    }
  }
  const optional = (name, fallback) => {
    const p = join(dir, name);
    return existsSync(p) ? readJson(p) : fallback;
  };
  return {
    files,
    crossEdges: optional('cross-edges.json', { edges: [] }).edges,
    clusters: optional('clusters.json', { clusters: [] }).clusters,
  };
}

export const topicId = (mapel, t) => `${mapel}.${t.elemen}.${t.slug}`;

// Split a CP statement into clauses at ";" and "●" — the decree separates abilities that way.
export function clauses(text) {
  const out = [];
  const re = /[^;●]+/g;
  let m;
  while ((m = re.exec(text))) {
    const lead = m[0].length - m[0].trimStart().length;
    const t = m[0].trim();
    if (t.length > 3) out.push({ text: t, from: m.index + lead, to: m.index + lead + t.length });
  }
  return out;
}
