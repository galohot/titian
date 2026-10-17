#!/usr/bin/env node
// Merge authoring/ into the published data/ files. Zero dependencies.
//   node scripts/build.mjs
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJson, loadAuthoring, topicId } from './lib.mjs';

const VERSION = 'v1';
const standardsDoc = readJson(join(ROOT, 'data/standards.json'));
const elemenName = new Map(standardsDoc.mapel.flatMap((m) => m.elemen.map((e) => [`${m.code}.${e.code}`, e.name])));
const { files, crossEdges, clusters } = loadAuthoring();

const topics = [];
const dependencies = [];
for (const { doc } of files) {
  for (const t of doc.topics) {
    const id = topicId(doc.mapel, t);
    topics.push({
      id,
      mapel: doc.mapel,
      elemen: elemenName.get(`${doc.mapel}.${t.elemen}`) ?? t.elemen,
      elemenCode: t.elemen,
      fase: doc.fase,
      kelas: t.kelas,
      type: t.type,
      name: t.name,
      description: t.description,
      evidence: t.evidence,
      parentPrompt: t.parentPrompt,
      standards: [...new Set(t.cp.map((c) => c.standard))],
      cp: t.cp,
      review: { status: 'draf-ai' },
    });
    for (const r of t.requires ?? []) {
      dependencies.push({ topic: id, requires: r.id, strength: r.strength, reason: r.reason });
    }
  }
}
for (const e of crossEdges) dependencies.push({ topic: e.topic, requires: e.requires, strength: e.strength, reason: e.reason, cross: true });

// Centrality = share of all topics that (transitively) depend on this one.
const dependents = new Map(topics.map((t) => [t.id, []]));
for (const d of dependencies) dependents.get(d.requires)?.push(d.topic);
const reach = new Map();
function descendants(id, seen = new Set()) {
  if (reach.has(id)) return reach.get(id);
  const out = new Set();
  for (const next of dependents.get(id) ?? []) {
    if (seen.has(next)) continue; // cycles are reported by validate.mjs
    seen.add(next);
    out.add(next);
    for (const x of descendants(next, seen)) out.add(x);
  }
  reach.set(id, out);
  return out;
}
for (const t of topics) {
  const n = descendants(t.id, new Set([t.id])).size;
  t.unlocks = n;
  t.centrality = Number((n / Math.max(1, topics.length - 1)).toFixed(4));
}

const write = (name, obj) => {
  const body = JSON.stringify(obj, null, 2) + '\n';
  writeFileSync(join(ROOT, 'data', name), body);
  return { file: `data/${name}`, sha256: createHash('sha256').update(body).digest('hex'), bytes: Buffer.byteLength(body) };
};

const out = [
  write('topics.json', { version: VERSION, topicCount: topics.length, topics }),
  write('dependencies.json', { version: VERSION, dependencyCount: dependencies.length, dependencies }),
  write('clusters.json', { version: VERSION, clusterCount: clusters.length, clusters }),
];
const stdBody = readFileSync(join(ROOT, 'data/standards.json'));
out.unshift({ file: 'data/standards.json', sha256: createHash('sha256').update(stdBody).digest('hex'), bytes: stdBody.length });

const perMapel = {};
for (const t of topics) {
  perMapel[t.mapel] ??= { topics: 0, A: 0, B: 0, C: 0 };
  perMapel[t.mapel].topics++;
  perMapel[t.mapel][t.fase]++;
}
writeFileSync(
  join(ROOT, 'data/manifest.json'),
  JSON.stringify(
    {
      name: 'Titian — peta belajar SD Indonesia',
      version: VERSION,
      license: { data: 'CC BY 4.0', code: 'MIT', standards: 'Public government decree (UU 28/2014 Pasal 42)' },
      source: standardsDoc.source.decree,
      counts: { standards: standardsDoc.standards.length, topics: topics.length, dependencies: dependencies.length, clusters: clusters.length },
      perMapel,
      files: out,
    },
    null,
    2,
  ) + '\n',
);
console.log(`built ${topics.length} topics, ${dependencies.length} dependencies, ${clusters.length} clusters`);
