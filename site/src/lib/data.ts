// Build-time access to the Titian dataset in ../data. Nothing here runs in the browser.
import topicsDoc from '../../../data/topics.json';
import depsDoc from '../../../data/dependencies.json';
import clustersDoc from '../../../data/clusters.json';
import standardsDoc from '../../../data/standards.json';
import manifest from '../../../data/manifest.json';

export type Fase = 'A' | 'B' | 'C';
export interface Topic {
  id: string;
  mapel: string;
  elemen: string;
  elemenCode: string;
  fase: Fase;
  kelas: number[];
  type: string;
  name: string;
  description: string;
  evidence: string[];
  parentPrompt: string;
  standards: string[];
  cp: { standard: string; phrase: string }[];
  review: { status: string };
  unlocks: number;
  centrality: number;
}
export interface Dep {
  topic: string;
  requires: string;
  strength: 'wajib' | 'bantu';
  reason: string;
  cross?: boolean;
}
export interface Standard {
  id: string;
  mapel: string;
  fase: Fase;
  kelas: number[];
  elemen: string;
  elemenCode: string;
  text: string;
  source: { decree: string; lampiran: string; section: string };
}

export const topics = topicsDoc.topics as Topic[];
export const deps = depsDoc.dependencies as Dep[];
export const clusters = clustersDoc.clusters as { mapel: string; elemenCode: string; fase: Fase; summary: string }[];
export const standards = standardsDoc.standards as Standard[];
export const standardsSource = standardsDoc.source;
export { manifest };

export const FASES: Fase[] = ['A', 'B', 'C'];
export const FASE_KELAS: Record<Fase, string> = { A: 'Kelas 1–2', B: 'Kelas 3–4', C: 'Kelas 5–6' };

// The three mapel with topics in v1, in display order, with a short line for parents.
export const MAPEL = [
  { code: 'mat', name: 'Matematika', short: 'Matematika', blurb: 'Bilangan, aljabar, pengukuran, geometri, dan data.' },
  { code: 'bind', name: 'Bahasa Indonesia', short: 'B. Indonesia', blurb: 'Menyimak, membaca, berbicara, dan menulis.' },
  { code: 'ipas', name: 'Ilmu Pengetahuan Alam dan Sosial', short: 'IPAS', blurb: 'Alam, tubuh, energi, lingkungan sosial, dan cara meneliti. Mulai kelas 3.' },
] as const;
export const mapelByCode = new Map<string, (typeof MAPEL)[number]>(MAPEL.map((m) => [m.code, m]));

export const TYPE_LABEL: Record<string, string> = {
  konsep: 'Pemahaman',
  prosedur: 'Keterampilan',
  representasi: 'Gambar & model',
  bahasa: 'Bahasa',
  meta: 'Cara belajar',
};

export const topicById = new Map(topics.map((t) => [t.id, t]));
export const standardById = new Map(standards.map((s) => [s.id, s]));

export const prereqsOf = (id: string) => deps.filter((d) => d.topic === id);
export const unlocksOf = (id: string) => deps.filter((d) => d.requires === id);

// Elemen of a mapel in decree order, from standards.json.
export function elemenOf(mapel: string): { code: string; name: string }[] {
  return standardsDoc.mapel.find((m) => m.code === mapel)?.elemen ?? [];
}

// Kelas first, then prerequisite depth, then name — so lists read easy → hard.
export function ordered(list: Topic[]): Topic[] {
  const ids = new Set(list.map((t) => t.id));
  const depth = new Map<string, number>();
  const visit = (id: string, stack = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (stack.has(id)) return 0;
    stack.add(id);
    const d = Math.max(-1, ...prereqsOf(id).filter((p) => ids.has(p.requires)).map((p) => visit(p.requires, stack))) + 1;
    depth.set(id, d);
    return d;
  };
  list.forEach((t) => visit(t.id));
  return [...list].sort((a, b) => a.kelas[0] - b.kelas[0] || depth.get(a.id)! - depth.get(b.id)! || a.name.localeCompare(b.name, 'id'));
}

// Every topic needed (transitively) before this one.
export function ancestors(id: string): Set<string> {
  const out = new Set<string>();
  const walk = (x: string) => {
    for (const d of prereqsOf(x)) if (!out.has(d.requires)) { out.add(d.requires); walk(d.requires); }
  };
  walk(id);
  return out;
}

export const kelasLabel = (k: number[]) => (k.length > 1 ? `Kelas ${k[0]}–${k[k.length - 1]}` : `Kelas ${k[0]}`);
