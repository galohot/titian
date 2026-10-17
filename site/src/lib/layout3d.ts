// Build-time 3D layout for the prerequisite graph. Height is kelas (1 at the bottom, 6 at the top).
// Each mapel owns a third of the circle; each elemen owns a slice of its mapel's third.
// A short force pass then pulls linked topics together. Seeded, so every build is identical.
import { topics, deps, MAPEL, elemenOf } from './data';

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Layout3D {
  // Per node: x, y, z (y is height), mapel index, size 0–1.
  p: number[];
  m: number[];
  s: number[];
  ids: string[];
  names: string[];
  kelas: number[];
  // Edges as pairs of node indexes: requires → topic. w = 1 for wajib, 0 for bantu.
  e: number[];
  w: number[];
}

export function layout3d(): Layout3D {
  const rand = mulberry32(2025046);
  const mapelIdx = new Map<string, number>(MAPEL.map((m, i) => [m.code, i]));
  const list = topics.filter((t) => mapelIdx.has(t.mapel));
  const index = new Map(list.map((t, i) => [t.id, i]));

  // Angle range per elemen, sized by topic count.
  const range = new Map<string, [number, number]>();
  MAPEL.forEach((m, mi) => {
    const els = elemenOf(m.code).map((e) => ({ code: e.code, n: list.filter((t) => t.mapel === m.code && t.elemenCode === e.code).length })).filter((e) => e.n);
    const total = els.reduce((a, e) => a + e.n, 0);
    const span = (Math.PI * 2) / MAPEL.length;
    let a0 = mi * span + span * 0.06;
    const usable = span * 0.88;
    for (const e of els) {
      const a1 = a0 + (usable * e.n) / total;
      range.set(`${m.code}.${e.code}`, [a0, a1]);
      a0 = a1;
    }
  });

  const maxUnlock = Math.max(...list.map((t) => t.unlocks), 1);
  const x: number[] = [], y: number[] = [], z: number[] = [], home: number[] = [];
  for (const t of list) {
    const [a0, a1] = range.get(`${t.mapel}.${t.elemenCode}`)!;
    const a = a0 + (a1 - a0) * (0.1 + 0.8 * rand());
    const r = 0.3 + 0.7 * Math.sqrt(rand());
    const k = t.kelas.reduce((s, v) => s + v, 0) / t.kelas.length;
    x.push(Math.cos(a) * r);
    z.push(Math.sin(a) * r);
    y.push(((k - 1) / 5) * 2 - 1 + (rand() - 0.5) * 0.22);
    home.push(a);
  }

  const edges = deps.filter((d) => index.has(d.topic) && index.has(d.requires)).map((d) => [index.get(d.requires)!, index.get(d.topic)!, d.strength === 'wajib' ? 1 : 0]);

  // Force pass in the horizontal plane only, so height keeps meaning kelas.
  const n = list.length;
  for (let it = 0; it < 120; it++) {
    const fx = new Float64Array(n), fz = new Float64Array(n);
    const cool = 1 - it / 120;
    for (const [a, b] of edges) {
      const dx = x[b] - x[a], dz = z[b] - z[a];
      fx[a] += dx * 0.004; fz[a] += dz * 0.004;
      fx[b] -= dx * 0.004; fz[b] -= dz * 0.004;
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = x[j] - x[i], dy = (y[j] - y[i]) * 2, dz = z[j] - z[i];
        const d2 = dx * dx + dy * dy + dz * dz + 1e-4;
        if (d2 > 0.04) continue;
        const f = 0.0006 / d2;
        fx[i] -= dx * f; fz[i] -= dz * f;
        fx[j] += dx * f; fz[j] += dz * f;
      }
      // Spring back toward the topic's own slice and toward a ring, so mapel stay apart.
      const r = Math.hypot(x[i], z[i]) || 1e-3;
      fx[i] += (Math.cos(home[i]) * r - x[i]) * 0.05 + (x[i] / r) * (0.75 - r) * 0.05;
      fz[i] += (Math.sin(home[i]) * r - z[i]) * 0.05 + (z[i] / r) * (0.75 - r) * 0.05;
    }
    for (let i = 0; i < n; i++) {
      x[i] += Math.max(-0.03, Math.min(0.03, fx[i])) * cool;
      z[i] += Math.max(-0.03, Math.min(0.03, fz[i])) * cool;
    }
  }

  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    p: list.flatMap((_, i) => [r3(x[i]), r3(y[i]), r3(z[i])]),
    m: list.map((t) => mapelIdx.get(t.mapel)!),
    s: list.map((t) => r3(Math.sqrt(t.unlocks / maxUnlock))),
    ids: list.map((t) => t.id),
    names: list.map((t) => t.name),
    kelas: list.map((t) => t.kelas[0]),
    e: edges.flatMap(([a, b]) => [a, b]),
    w: edges.map((e) => e[2]),
  };
}
