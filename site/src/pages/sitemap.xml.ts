import { topics, MAPEL } from '../lib/data';

export function GET() {
  const site = 'https://titian.irawan.dev';
  const paths = ['/', '/graf/', '/tentang/', '/data/', ...MAPEL.map((m) => `/mapel/${m.code}/`), ...topics.map((t) => `/topik/${t.id}/`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${site}${p}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml' } });
}
