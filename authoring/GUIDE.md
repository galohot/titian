# Authoring guide — how to write Titian topics

You write micro-topics for one mapel and one fase, from the official CP text only.

## Source rule (hard)
- Your only content source is the CP text in `data/standards.json` for your mapel + fase, plus
  your own knowledge of how Indonesian SD children learn.
- **Never** open, search for, or copy any other curriculum taxonomy (in particular Marble's
  `os-taxonomy`). This dataset is clean-room.

## What a micro-topic is
- One idea a child can learn and **show**. A parent can check it in under 5 minutes at home.
- A CP paragraph usually splits into 4–12 topics. Long paragraphs (IPAS) split into more.
- Not a whole chapter ("Pecahan"), not a single exercise ("3 + 4"). Example of the right size:
  "Mengenal pecahan setengah dari membagi benda".

## File format
Write `authoring/<mapel>/<fase>.json`:
```json
{
  "mapel": "mat",
  "fase": "A",
  "topics": [
    {
      "slug": "membilang-sampai-20",
      "elemen": "bil",
      "name": "Membilang benda sampai 20",
      "description": "Menghitung banyak benda satu per satu sampai 20 dan tahu bahwa angka terakhir yang disebut adalah banyaknya benda.",
      "type": "prosedur",
      "kelas": [1],
      "evidence": [
        "Menghitung 17 butir kelereng dengan menunjuk satu per satu tanpa terlewat",
        "Menjawab 'ada berapa?' dengan angka terakhir tanpa menghitung ulang"
      ],
      "parentPrompt": "Taruh segenggam kelereng atau kacang di meja. Minta {{nama}} menghitungnya. Apakah {{nama}} menunjuk satu per satu dan langsung bisa bilang jumlahnya?",
      "cp": [{ "standard": "cp046.mat.A.bil", "phrase": "pada bilangan cacah sampai 100" }],
      "requires": [
        { "id": "mat.bil.menyebut-urutan-bilangan-sampai-20", "strength": "wajib", "reason": "Harus hafal urutan nama bilangan sebelum bisa membilang benda." }
      ]
    }
  ]
}
```

## Fields
- `slug` — lowercase Indonesian words joined by `-`, unique inside the mapel. The full id is
  `<mapel>.<elemen>.<slug>` (e.g. `mat.bil.membilang-sampai-20`).
- `elemen` — the elemen code from `data/standards.json` → `mapel[].elemen[].code`.
- `name` — short, plain Indonesian, 3–8 words, starts with a verb or a noun phrase a parent
  understands. No jargon a parent would not know; if a term is needed, explain it in `description`.
- `description` — 1–2 sentences, plain Indonesian. What the child understands or can do.
- `type` — one of `konsep` (understanding an idea), `prosedur` (doing a method), `representasi`
  (using pictures, tables, number lines, maps), `bahasa` (vocabulary, reading, writing, speaking),
  `meta` (planning, checking own work, reflecting).
- `kelas` — your best estimate of the kelas inside the fase where this is usually taught
  (Fase A = 1–2, B = 3–4, C = 5–6). One or two numbers. Use the usual order of the Kurikulum
  Merdeka textbooks as your guide.
- `evidence` — 2–4 concrete, observable checks. Each one is a thing the child does or says.
  Use real numbers, real words, real objects.
- `parentPrompt` — 1–3 sentences a parent can do at home tonight, with `{{nama}}` for the child's
  name. Spoken, warm, everyday Indonesian ("Coba minta {{nama}}…", "Tanya {{nama}}…"). Use local
  contexts: rupiah, uang jajan, pasar, warung, angkot, jam dinding, nasi, piring, sandal, hujan,
  sawah, motor. No formal "Ananda", no translated tone, no emoji.
- `cp` — at least one link. `phrase` must be a **verbatim substring** of that standard's `text`
  (copy it exactly, including punctuation inside the phrase). It names the part of the CP this
  topic serves. The validator checks it.
- `requires` — prerequisites: topics the child must (`wajib`) or should (`bantu`) know first.
  - Only ids from **your mapel**: your own fase file, or an earlier fase file you were given.
  - Every topic should have at least one prerequisite unless it is a true starting point.
  - `reason` — one short Indonesian sentence: why this comes first.
  - No cycles.

## Coverage
Every clause of every CP statement in your fase must be served by at least one topic `phrase`.
The validator splits each standard at `;` and `●` and checks that some phrase overlaps each clause.
Read every clause. Do not skip the hard or boring ones.

## Style checks before you finish
- Indonesian is natural and correct (EYD V). Spelling: "mengomunikasikan", "praktik", "analisis".
- No duplicate topics. No topic that only repeats the CP sentence.
- The topics inside one elemen read as a path from easy to hard.
- Run `node scripts/build.mjs && node scripts/validate.mjs` and fix every error in your file.
