# Titian — peta belajar SD Indonesia

**Titian** memecah Capaian Pembelajaran SD (Kurikulum 2025) menjadi topik kecil yang saling
terhubung. Setiap topik punya tanda anak sudah bisa, pertanyaan untuk dicoba orang tua di rumah,
dan daftar topik yang perlu dikuasai lebih dulu. Jelajahi di **[titian.irawan.dev](https://titian.irawan.dev)**.

*English:* Titian is an open learning map for Indonesian primary school (SD, kelas 1–6). It
splits the official Capaian Pembelajaran into micro-topics, wires them into a prerequisite graph,
and links every topic back to the exact phrase of the decree it serves.

> **Status: v1 draft.** All topics are AI-assisted drafts written from the CP text. No teacher has
> reviewed them yet. Every topic carries `review.status = "draf-ai"`.

## What is in it

| | |
|---|---|
| Source | Keputusan Kepala BSKAP Nomor 046/H/KR/2025 tentang Capaian Pembelajaran (set 16 Jul 2025) |
| CP statements (verbatim) | SD Fase A–C of 11 mapel (Seni counted as 4) — every mapel except Agama |
| Topics in v1 | Matematika, Bahasa Indonesia, IPAS |
| Content language | Indonesian · JSON keys in English |

See [`data/manifest.json`](data/manifest.json) for the current counts and SHA-256 checksums.

## Files

| File | Holds |
|---|---|
| [`data/standards.json`](data/standards.json) | CP statements: one per mapel × fase × elemen, verbatim text, section number |
| [`data/topics.json`](data/topics.json) | Micro-topics (graph nodes) |
| [`data/dependencies.json`](data/dependencies.json) | Prerequisite edges: `topic` requires `requires`, `wajib` or `bantu`, with a reason |
| [`data/clusters.json`](data/clusters.json) | One parent summary per mapel × elemen × fase |
| [`schema/`](schema/) | JSON Schemas for each file |

### A topic

```json
{
  "id": "mat.bil.pasangan-bilangan-yang-jumlahnya-10",
  "mapel": "mat",
  "elemen": "Bilangan",
  "fase": "A",
  "kelas": [1],
  "type": "prosedur",
  "name": "Pasangan bilangan yang jumlahnya 10",
  "description": "Hafal dan paham pasangan bilangan yang bersama-sama menjadi 10, seperti 7 dan 3 atau 6 dan 4.",
  "evidence": ["Langsung menjawab \"3\" saat ditanya \"7 dan berapa supaya jadi 10?\"", "…"],
  "parentPrompt": "Main tebak jari: … {{nama}} menyebut berapa jari lagi supaya jadi 10. …",
  "standards": ["cp046.mat.A.bil"],
  "cp": [{ "standard": "cp046.mat.A.bil", "phrase": "melakukan komposisi (menyusun) dan dekomposisi (mengurai) bilangan" }],
  "review": { "status": "draf-ai" },
  "unlocks": 31,
  "centrality": 0.08
}
```

- `kelas` is an **estimate**. The CP sets only the fase (two years).
- `cp[].phrase` is a verbatim substring of the standard's text.
- `parentPrompt` contains `{{nama}}`. Replace it with the child's name, or with "anak Anda".
- `type`: `konsep`, `prosedur`, `representasi`, `bahasa`, `meta`.
- `unlocks` counts topics that depend on this one, directly or not.

## Use it

```js
import topics from './data/topics.json' with { type: 'json' };
import deps from './data/dependencies.json' with { type: 'json' };

const byId = new Map(topics.topics.map((t) => [t.id, t]));
const before = deps.dependencies
  .filter((d) => d.topic === 'mat.bil.pasangan-bilangan-yang-jumlahnya-10')
  .map((d) => byId.get(d.requires).name);
```

## Build and check

Needs Node 22+ and, only for re-extraction, `pdftotext` (poppler). No npm dependencies.

```bash
node scripts/extract-cp.mjs path/to/bskap-046-H-KR-2025.pdf   # PDF → data/standards.json
node scripts/build.mjs                                          # authoring/ → data/
node scripts/validate.mjs --warn                                # fields, references, DAG, CP coverage
```

The validator checks that every CP phrase is verbatim, that the graph has no cycles, that no
topic requires a topic from a later fase, and that every `;`-clause of every covered CP statement
is served by at least one topic. Topics are written in [`authoring/`](authoring/) following
[`authoring/GUIDE.md`](authoring/GUIDE.md). Never edit `data/topics.json` by hand.

The explorer site lives in [`site/`](site/) (Astro, static, deployed to Cloudflare).

## How it was made

1. The CP text was extracted from the decree PDF and split by mapel, fase and elemen.
2. Each CP statement was split into micro-topics with AI assistance, from the CP text only.
3. Prerequisites were written with a reason for each, then checked by the validator.
4. A human read every file before merge. Teacher review comes next.

The idea of a micro-topic graph with parent prompts comes from Marble's open
[skill taxonomy](https://github.com/withmarbleapp/os-taxonomy) for UK and US curricula. Titian is
built separately from the Indonesian curriculum. **No Marble data was used.**

## Licence

- Topics, edges, clusters, prompts: **[CC BY 4.0](LICENSE-DATA.md)**. Attribution: *Titian — peta
  belajar SD Indonesia (v1), https://titian.irawan.dev*.
- Code: **[MIT](LICENSE)**.
- `data/standards.json`: verbatim text of a government decree. Under UU 28/2014 Pasal 42 it is
  not protected by copyright.

Titian is not affiliated with or endorsed by Kementerian Pendidikan Dasar dan Menengah.
