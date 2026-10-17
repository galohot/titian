import { topics, mapelByCode, kelasLabel } from '../lib/data';

export function GET() {
  const items = topics.map((t) => ({
    id: t.id,
    n: t.name,
    m: `${mapelByCode.get(t.mapel)?.short ?? t.mapel} · ${t.elemen}`,
    k: kelasLabel(t.kelas),
    d: t.description,
  }));
  return new Response(JSON.stringify(items), { headers: { 'content-type': 'application/json' } });
}
