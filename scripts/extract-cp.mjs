#!/usr/bin/env node
// Extract SD (Fase A–C) Capaian Pembelajaran from Keputusan Kepala BSKAP 046/H/KR/2025
// into data/standards.json. Needs `pdftotext` (poppler). Zero npm dependencies.
//
//   node scripts/extract-cp.mjs [path/to/bskap-046-H-KR-2025.pdf]

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PDF = process.argv[2] ?? join(ROOT, 'sources/raw/bskap-046-H-KR-2025.pdf');
const EXPECTED_SHA256 = '86beda147795100e5d79801b8440f82d4a7f5503470f2379dd1b4dd76173180c';

// Lampiran II mapel sections used in SD. `heading` matches the section title line.
// `elemen` lists the canonical element names in decree order; the decree numbers them
// <fase>.<n>. and some names wrap onto a second line, so we match by number, not by text.
const MAPEL = [
  { code: 'ppkn', name: 'Pendidikan Pancasila', section: 'II', heading: /^\s*II\s+CAPAIAN PEMBELAJARAN PENDIDIKAN PANCASILA/,
    elemen: [['pancasila', 'Pancasila'], ['uud', 'Undang-Undang Dasar Negara Republik Indonesia Tahun 1945'], ['bti', 'Bhinneka Tunggal Ika'], ['nkri', 'Negara Kesatuan Republik Indonesia']] },
  { code: 'bind', name: 'Bahasa Indonesia', section: 'III.1', heading: /^\s*III\.1\.\s+CAPAIAN PEMBELAJARAN BAHASA INDONESIA\s*$/,
    elemen: [['simak', 'Menyimak'], ['baca', 'Membaca dan Memirsa'], ['bicara', 'Berbicara dan Mempresentasikan'], ['tulis', 'Menulis']] },
  { code: 'mat', name: 'Matematika', section: 'IV.1', heading: /^\s*IV\.1\.\s+CAPAIAN PEMBELAJARAN MATEMATIKA\s*$/,
    elemen: [['bil', 'Bilangan'], ['alj', 'Aljabar'], ['ukur', 'Pengukuran'], ['geo', 'Geometri'], ['data', 'Analisis Data dan Peluang']] },
  { code: 'bing', name: 'Bahasa Inggris', section: 'V.1', heading: /^\s*V\.1\.\s+CAPAIAN PEMBELAJARAN BAHASA INGGRIS\s*$/,
    elemen: [['simak-bicara', 'Menyimak - Berbicara (Listening - Speaking)'], ['baca', 'Membaca - Memirsa (Reading - Viewing)'], ['tulis', 'Menulis - Mempresentasikan (Writing - Presenting)']] },
  { code: 'ipas', name: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', section: 'VI', heading: /^\s*VI\.\s+CAPAIAN PEMBELAJARAN ILMU PENGETAHUAN ALAM DAN SOSIAL/,
    elemen: [['paham', 'Pemahaman IPAS'], ['proses', 'Keterampilan Proses']] },
  ...[['musik', 'Seni Musik', '1', 'MUSIK'], ['rupa', 'Seni Rupa', '2', 'RUPA'], ['tari', 'Seni Tari', '3', 'TARI'], ['teater', 'Seni Teater', '4', 'TEATER']].map(([c, n, i, H]) => ({
    code: `seni-${c}`, name: n, section: `XVIII.${i}`, heading: new RegExp(`^\\s*XVIII\\.${i}\\.\\s+CAPAIAN PEMBELAJARAN SENI ${H}`),
    elemen: [['alami', 'Mengalami (Experiencing)'], ['refleksi', 'Merefleksikan (Reflecting)'], ['artistik', 'Berpikir dan Bekerja Artistik (Thinking and Working Artistically)', ['Berpikir dan Bekerja Secara Artistik', 'Bekerja Secara Artistik']], ['cipta', 'Menciptakan (Making/Creating)'], ['dampak', 'Berdampak (Impacting)']],
  })),
  { code: 'pjok', name: 'Pendidikan Jasmani, Olahraga, dan Kesehatan', section: 'XXI', heading: /^\s*XXI\.\s+CAPAIAN PEMBELAJARAN PENDIDIKAN JASMANI/,
    elemen: [['gerak', 'Terampil Bergerak'], ['belajar-gerak', 'Belajar Melalui Gerak'], ['aktif', 'Bergaya Hidup Aktif'], ['sehat', 'Memilih Hidup yang Menyehatkan']] },
  { code: 'kka', name: 'Koding dan Kecerdasan Artifisial', section: 'XXVIII', heading: /^\s*XXVIII\.\s+CAPAIAN PEMBELAJARAN KODING DAN KECERDASAN ARTIFISIAL/,
    elemen: [['komputasional', 'Berpikir Komputasional'], ['digital', 'Literasi Digital'], ['etika-ka', 'Literasi dan Etika Kecerdasan Artifisial'], ['manfaat-ka', 'Pemanfaatan dan Pengembangan Kecerdasan Artifisial']] },
];

// The decree says which kelas a fase "generally" covers. Fase C of Bahasa Inggris is
// printed as "Kelas III dan IV" in the decree — a typo; SD Fase C is kelas V–VI everywhere else.
const KELAS = { A: [1, 2], B: [3, 4], C: [5, 6] };

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function loadText(pdf) {
  const raw = execFileSync('pdftotext', ['-layout', pdf, '-'], { maxBuffer: 1 << 28 }).toString('utf8');
  return raw
    .replace(/\u200b/g, '')
    .split('\n')
    .filter((l) => !/komunitasbelajar\.id/.test(l)) // mirror watermark, one per page
    .map((l) => l.replace(/\f/g, ''));
}

const collapse = (s) =>
  s.replace(/\s+/g, ' ')
    .replace(/(\w)- (\w)/g, (m, a, b) => (/[a-z]/.test(a) && /[a-z]/.test(b) ? `${a}-${b}` : m))
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();

function sectionLines(lines, mapel) {
  // Lampiran II starts at the second "LAMPIRAN II" heading area; search after the first match
  // of the section heading that sits inside Lampiran II (the first occurrence is fine: headings
  // with these numbers appear only once in Lampiran II, and Lampiran III restarts numbering).
  const lamp2 = lines.findIndex((l) => /^\s*LAMPIRAN II\s*$/.test(l));
  const lamp3 = lines.findIndex((l) => /^\s*LAMPIRAN III\s*$/.test(l));
  const start = lines.findIndex((l, i) => i > lamp2 && i < lamp3 && mapel.heading.test(l));
  if (start < 0) throw new Error(`heading not found: ${mapel.code}`);
  let end = lines.findIndex((l, i) => i > start + 2 && i < lamp3 && /^\s*[IVX]+(\.\d+)?\.?\s+CAPAIAN PEMBELAJARAN /.test(l) && !mapel.heading.test(l));
  if (end < 0) end = lamp3;
  return lines.slice(start, end);
}

function extractMapel(lines, mapel) {
  const sec = sectionLines(lines, mapel);
  const dIdx = sec.findIndex((l) => /^\s*D\.\s+Capaian Pembelajaran\s*$/.test(l));
  if (dIdx < 0) throw new Error(`no "D. Capaian Pembelajaran" in ${mapel.code}`);
  const body = sec.slice(dIdx + 1);

  // Find fase headings: "<n>. Fase X (Umumnya untuk ..." (number optional).
  const faseAt = [];
  body.forEach((l, i) => {
    const m = l.match(/^\s*(?:(\d+)\.\s+)?Fase ([A-F]) \(Umumnya/);
    if (m) faseAt.push({ i, num: m[1], fase: m[2] });
  });
  const out = [];
  for (let k = 0; k < faseAt.length; k++) {
    const { i, num, fase } = faseAt[k];
    if (!KELAS[fase]) continue;
    const block = body.slice(i, k + 1 < faseAt.length ? faseAt[k + 1].i : body.length);
    // Elemen headings: "<num>.<n>. Name"
    const elAt = [];
    block.forEach((l, j) => {
      const m = l.match(/^\s*(\d+)\.(\d+)\.\s+(\S.*)$/);
      if (m && m[1] === num) elAt.push({ j, n: Number(m[2]), head: m[3] });
    });
    // Text between the fase heading and the first elemen = fase intro (minus the boilerplate).
    const intro = collapse(block.slice(1, elAt.length ? elAt[0].j : block.length).join(' '))
      .replace(/^(?:SD\/MI\/Program\s+)?Paket A\)\s*/, '')
      .replace(/^SD\/MI\)\s*/, '')
      .replace(/Pada akhir Fase [A-C],? murid memiliki kemampuan sebagai berikut\.?/i, '')
      .trim();
    if (intro.length > 40) {
      out.push(std(mapel, fase, 'umum', 'Umum', intro, `${mapel.section}.D.${num}`));
    }
    for (let e = 0; e < elAt.length; e++) {
      const { j, n } = elAt[e];
      const def = mapel.elemen[n - 1];
      if (!def) throw new Error(`${mapel.code} fase ${fase}: unexpected elemen ${n}`);
      const [ecode, ename] = def;
      const raw = collapse(block.slice(j, e + 1 < elAt.length ? elAt[e + 1].j : block.length).join(' '))
        .replace(/^\d+\.\d+\.\s+/, '');
      const text = stripName(raw, [ename, ...(def[2] ?? [])]);
      out.push(std(mapel, fase, ecode, ename, text, `${mapel.section}.D.${num}.${n}`));
    }
  }
  return out;
}

// Remove the printed elemen name (and an optional English gloss in brackets) from the start
// of its paragraph. Spacing around hyphens varies and the gloss is sometimes typo'd, so the
// gloss is matched as "any bracketed text".
function stripName(text, names) {
  for (const name of names) {
    const id = name.replace(/\s*\(.*\)\s*$/, '');
    const words = id.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/-/g, '\\s*-\\s*'));
    const re = new RegExp('^' + words.join('\\s+') + '(?:\\s*\\([^)]*\\))?\\s*', 'i');
    if (re.test(text)) return text.replace(re, '').trim();
  }
  throw new Error(`elemen name not found at start of: ${text.slice(0, 80)}`);
}

function std(mapel, fase, ecode, ename, text, section) {
  return {
    id: `cp046.${mapel.code}.${fase}.${ecode}`,
    mapel: mapel.code,
    fase,
    kelas: KELAS[fase],
    elemen: ename,
    elemenCode: ecode,
    text,
    source: { decree: '046/H/KR/2025', lampiran: 'II', section },
  };
}

const actual = sha256(PDF);
if (actual !== EXPECTED_SHA256) {
  console.warn(`warning: PDF sha256 ${actual} differs from the recorded ${EXPECTED_SHA256}`);
}
const lines = loadText(PDF);
const standards = MAPEL.flatMap((m) => extractMapel(lines, m));
const doc = {
  version: 'v1',
  source: {
    title: 'Keputusan Kepala Badan Standar, Kurikulum, dan Asesmen Pendidikan Kementerian Pendidikan Dasar dan Menengah Nomor 046/H/KR/2025 tentang Capaian Pembelajaran pada Pendidikan Anak Usia Dini, Jenjang Pendidikan Dasar, dan Jenjang Pendidikan Menengah',
    decree: '046/H/KR/2025',
    set: '2025-07-16',
    amendedBy: 'Keputusan Kepala BKPDM Nomor 020 Tahun 2026 (Agama dan Budi Pekerti only; not included here)',
    pdfSha256: actual,
    note: 'Verbatim text of Lampiran II, Fase A–C, extracted with pdftotext. Images and tables inside the decree are not captured. Government decrees carry no copyright under UU 28/2014 Pasal 42.',
  },
  mapel: MAPEL.map(({ code, name, section, elemen }) => ({ code, name, section, elemen: elemen.map(([c, n]) => ({ code: c, name: n })) })),
  standards,
};
writeFileSync(join(ROOT, 'data/standards.json'), JSON.stringify(doc, null, 2) + '\n');
const counts = {};
for (const s of standards) counts[`${s.mapel}.${s.fase}`] = (counts[`${s.mapel}.${s.fase}`] ?? 0) + 1;
console.log(`${standards.length} standards`, counts);
