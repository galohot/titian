#!/usr/bin/env node
// Validate authoring/ + data/: fields, references, verbatim CP phrases, acyclic graph,
// and clause-level CP coverage. Zero dependencies. Exit 1 on any error.
//   node scripts/validate.mjs            # errors + summary
//   node scripts/validate.mjs --warn     # also print warnings
import { join } from 'node:path';
import { ROOT, FASES, TYPES, STRENGTHS, readJson, loadAuthoring, topicId, clauses } from './lib.mjs';

const showWarn = process.argv.includes('--warn');
const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const std = readJson(join(ROOT, 'data/standards.json'));
const standards = new Map(std.standards.map((s) => [s.id, s]));
const elemen = new Set(std.mapel.flatMap((m) => m.elemen.map((e) => `${m.code}.${e.code}`)));
const mapelCodes = new Set(std.mapel.map((m) => m.code));

// --- standards ---
const seenStd = new Set();
for (const s of std.standards) {
  if (seenStd.has(s.id)) err(s.id, 'duplicate standard id');
  seenStd.add(s.id);
  if (!s.text || s.text.length < 20) err(s.id, 'standard text missing or too short');
  if (!FASES.includes(s.fase)) err(s.id, `bad fase ${s.fase}`);
}

// --- topics ---
const { files, crossEdges, clusters } = loadAuthoring();
const topics = new Map(); // id -> { mapel, fase, t, where }
const faseRank = (f) => FASES.indexOf(f);
for (const { path, doc } of files) {
  if (!mapelCodes.has(doc.mapel)) err(path, `unknown mapel ${doc.mapel}`);
  if (!FASES.includes(doc.fase)) err(path, `bad fase ${doc.fase}`);
  if (!Array.isArray(doc.topics) || !doc.topics.length) err(path, 'no topics');
  for (const t of doc.topics ?? []) {
    const id = topicId(doc.mapel, t);
    const where = `${path} ${id}`;
    if (topics.has(id)) err(where, 'duplicate topic id');
    topics.set(id, { mapel: doc.mapel, fase: doc.fase, t, where });
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.slug ?? '')) err(where, 'slug must be lowercase words joined by -');
    if (!elemen.has(`${doc.mapel}.${t.elemen}`)) err(where, `unknown elemen ${t.elemen}`);
    for (const f of ['name', 'description', 'parentPrompt']) if (typeof t[f] !== 'string' || !t[f].trim()) err(where, `missing ${f}`);
    if (t.name && t.name.split(/\s+/).length > 10) warn(where, 'name longer than 10 words');
    if (!TYPES.includes(t.type)) err(where, `type must be one of ${TYPES.join('/')}`);
    const k = { A: [1, 2], B: [3, 4], C: [5, 6] }[doc.fase];
    if (!Array.isArray(t.kelas) || !t.kelas.length || t.kelas.some((x) => !k?.includes(x))) err(where, `kelas must be within ${k}`);
    if (!Array.isArray(t.evidence) || t.evidence.length < 2 || t.evidence.length > 4) err(where, 'evidence must have 2–4 items');
    if (t.parentPrompt && !t.parentPrompt.includes('{{nama}}')) err(where, 'parentPrompt must contain {{nama}}');
    if (!Array.isArray(t.cp) || !t.cp.length) err(where, 'needs at least one cp link');
    for (const c of t.cp ?? []) {
      const s = standards.get(c.standard);
      if (!s) { err(where, `unknown standard ${c.standard}`); continue; }
      if (s.fase !== doc.fase) warn(where, `links a standard of fase ${s.fase}`);
      if (!c.phrase || !s.text.includes(c.phrase)) err(where, `cp phrase is not a verbatim substring of ${c.standard}: "${c.phrase}"`);
    }
  }
}

// --- dependencies ---
const edges = [];
for (const [id, { t, where }] of topics) for (const r of t.requires ?? []) edges.push({ topic: id, ...r, where });
for (const e of crossEdges) edges.push({ ...e, id: e.requires, where: `authoring/cross-edges.json ${e.topic}`, cross: true });
const seenEdge = new Set();
for (const e of edges) {
  const req = e.id ?? e.requires;
  const a = topics.get(e.topic);
  const b = topics.get(req);
  if (!a) { err(e.where, `edge from unknown topic ${e.topic}`); continue; }
  if (!b) { err(e.where, `requires unknown topic ${req}`); continue; }
  if (req === e.topic) err(e.where, 'topic requires itself');
  if (!STRENGTHS.includes(e.strength)) err(e.where, `strength must be wajib/bantu`);
  if (!e.reason || e.reason.length < 10) err(e.where, `edge to ${req} needs a reason`);
  if (faseRank(b.fase) > faseRank(a.fase)) err(e.where, `requires ${req} from a LATER fase (${b.fase})`);
  if (!e.cross && a.mapel !== b.mapel) err(e.where, `cross-mapel edge to ${req} belongs in authoring/cross-edges.json`);
  const key = `${e.topic}<-${req}`;
  if (seenEdge.has(key)) err(e.where, `duplicate edge to ${req}`);
  seenEdge.add(key);
}

// Acyclic check (iterative DFS, colours).
const out = new Map([...topics.keys()].map((id) => [id, []]));
for (const e of edges) if (topics.has(e.topic) && topics.has(e.id ?? e.requires)) out.get(e.topic).push(e.id ?? e.requires);
const colour = new Map();
for (const start of topics.keys()) {
  if (colour.get(start)) continue;
  const stack = [[start, 0]];
  const path = [];
  while (stack.length) {
    const top = stack[stack.length - 1];
    const [node, i] = top;
    if (i === 0) { colour.set(node, 1); path.push(node); }
    const next = out.get(node)[i];
    if (next === undefined) { colour.set(node, 2); path.pop(); stack.pop(); continue; }
    top[1]++;
    const c = colour.get(next);
    if (c === 1) { err('graph', `cycle: ${[...path.slice(path.indexOf(next)), next].join(' -> ')}`); }
    else if (!c) stack.push([next, 0]);
  }
}

// Topics with no prerequisite at all (entry points). Fine in fase A, suspicious later.
const hasReq = new Set(edges.map((e) => e.topic));
for (const [id, { fase, where }] of topics) if (!hasReq.has(id) && fase !== 'A') warn(where, 'no prerequisite (entry point outside fase A)');

// --- coverage: every ";" clause of every standard that has topics in its mapel+fase file ---
const authored = new Set(files.map(({ doc }) => `${doc.mapel}.${doc.fase}`));
const spans = new Map(); // standard -> [[from,to]]
for (const { t } of topics.values()) for (const c of t.cp ?? []) {
  const s = standards.get(c.standard);
  if (!s || !c.phrase) continue;
  let from = s.text.indexOf(c.phrase);
  while (from >= 0) {
    (spans.get(c.standard) ?? spans.set(c.standard, []).get(c.standard)).push([from, from + c.phrase.length]);
    from = s.text.indexOf(c.phrase, from + 1);
  }
}
let clauseTotal = 0;
let clauseCovered = 0;
for (const s of std.standards) {
  if (!authored.has(`${s.mapel}.${s.fase}`)) continue;
  for (const cl of clauses(s.text)) {
    clauseTotal++;
    const hit = (spans.get(s.id) ?? []).some(([a, b]) => a < cl.to && b > cl.from);
    if (hit) clauseCovered++;
    else err(s.id, `clause not covered by any topic phrase: "${cl.text.slice(0, 90)}"`);
  }
}

// --- clusters ---
for (const c of clusters) {
  const where = `authoring/clusters.json ${c.mapel}.${c.elemenCode}.${c.fase}`;
  if (!elemen.has(`${c.mapel}.${c.elemenCode}`)) err(where, 'unknown elemen');
  if (!c.summary || c.summary.length < 40) err(where, 'summary too short');
}

if (showWarn) for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(
  `${errors.length ? 'FAIL' : 'OK'} — ${std.standards.length} standards, ${topics.size} topics, ${edges.length} edges, ` +
    `${clauseCovered}/${clauseTotal} clauses covered, ${clusters.length} clusters, ${warnings.length} warnings`,
);
process.exit(errors.length ? 1 : 0);
