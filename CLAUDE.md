# BTN_BVC-Company-Database-Dashboard — Project Instructions

Read `PROJECT_LOG.md` for full project context, schema documentation, completed tasks, and pending tasks.

---

## On every session start

1. **Check `reference-data/unprocessed/`** for any files that have not yet been processed.
   - If files are found: list them and ask Julian whether to process them now.
   - If the folder is empty: remind Julian that new images or reference files can be dropped into `reference-data/unprocessed/` to queue them for extraction.

2. **Report current data status** — read record counts from all data/*.json files — so Julian has an instant overview without opening anything.

Example session-start message:
> I found 4 unprocessed files in `reference-data/unprocessed/`:
> - `2026-02_Components_Europe.jpg`
> - `2026-02_Equipment_Europe.jpg`
> - `2026-02_Active-Materials_Europe.jpg`
> - `2026-02_Solid-State_Europe.jpg`
>
> Should I process these now?
>
> Current database: 213 records across 3 active files (38 cell manufacturers, 110 module & pack, 65 recyclers). 2 files pending first extraction.

---

## Image processing workflow

When processing an image:

1. **Save image** to `reference-data/unprocessed/` using the naming convention below — do this before any extraction if the image was shared directly in chat and not yet saved to disk.
2. **Vision extraction** — read all visible text: company names, cities, countries, years, capacities, status markers.
3. **Logo research** — web-search any logos without readable text names; set `logo_research_needed: true` in `attributes{}` if still unresolved.
4. **Geocoding** — look up lat/lon for each city.
5. **Stage assessment** — set `stage` field: `commercial`, `pilot`, `rd`, or `unknown`. For solid-state and early-stage companies, default to `rd` or `pilot` unless evidence of commercial production exists.
6. **Open questions** — add entries to `attributes.open_questions[]` for anything that could not be confirmed from the image (capacity figures, stage, current status, etc.).
7. **Deduplication** — check existing records across all data/*.json files using the rules below (see *Deduplication rules*).
8. **Append** — write new records to the appropriate sector JSON file; update `meta.last_updated` and `meta.record_count`.
9. **Move image** — move from `reference-data/unprocessed/` → `reference-data/processed/`.
10. **Update** `PROJECT_LOG.md` — mark the image as processed, update record counts, add session entry to Completed Tasks.
11. **Confirm** — report: N new records added, M skipped (already existed), P flagged as potential updates, K logos still need research, J open questions flagged.

---

## Deduplication rules

Match is by **name + city** (case-insensitive). Three outcomes:

| Case | Condition | Action |
|---|---|---|
| **True duplicate** | Same name, same city, same or identical source image | Skip silently — no write, no flag |
| **Potential update** | Same name, same city, different or newer source image | Do NOT skip. Add to `open_questions`: `"Potential data update from [source] — verify capacity/status/year"`. Report to Julian in the confirmation summary. |
| **New site** | Same company name, different city | Treat as a new record — this is a separate facility. Write normally. |

The "potential update" flag exists because a newer source image may carry updated capacity figures or a changed status that would be silently lost if the record were skipped. Julian reviews flagged records and applies updates manually or via a research pass.

---

## Company research workflow

When Julian says **"research [Company Name]"** or **"research all open_questions companies"**:

1. Load `WebSearch` tool
2. Search: `"[Company Name]" battery production capacity 2025 2026`
3. Read 1–2 top result pages with `WebFetch`
4. Write a 2–5 sentence `summary` focused on: current capacity, planned capacity, status, recent news
5. Update the company's record in the appropriate JSON file — set `research.summary`, `research.source`, `research.date`
6. If the research resolves an open question, remove it from `attributes.open_questions[]`
7. If new uncertainties emerge, add them to `open_questions`
8. Report findings and any remaining gaps

```json
"research": {
  "summary": "Northvolt operates the Ett gigafactory in Skellefteå. Filed for bankruptcy in Nov 2024; restructuring ongoing as of Q1 2026. Production capacity was ~8 GWh at peak.",
  "source": "https://northvolt.com/articles/...",
  "date": "2026-05-12"
}
```

In the app: a teal dot (fresh) or grey dot (stale / never researched) appears next to the company name in the table; the map popup shows the summary and a clickable source link.

---

## Research freshness

Research data goes stale. The **threshold is 365 days** — a record is considered outdated if its `research.date` is more than one year ago, or if no `research` field exists at all.

**Visual indicators in the table (Company name cell):**
| Dot | Meaning |
|---|---|
| Teal dot | Research done within the last 12 months — current |
| Grey dot | Research overdue: either never done, or older than 1 year |
| Orange dot | Logo still needs identification (`logo_research_needed: true`) |

During any research pass, prioritize records with grey dots. When research is completed, `research.date` is updated to today's date, which automatically shifts the dot from grey to teal on the next app reload.

**When running a batch research pass**, Claude should:
1. Identify all records with no `research.date` or with `research.date` older than 365 days
2. Report the count to Julian before starting
3. Work through them in order: Operational → Planned → Paused/Cancelled

---

## Key schema fields (v1.3)

**`status`** — current project status:
- `Operational` — capacity is live and producing
- `Planned` — facility/capacity not yet built; has a target year
- `Paused` — project paused or cancelled (displayed as "Paused / Cancelled" in app)
- `Cancelled` — project cancelled (same display and color as Paused)
- `Unknown` — status unclear

**Capacity `type`** — whether a capacity figure is current or future:
- `current` — already operational (no target year; company status is Operational)
- `planned` — not yet reached; associated with a target year via `target_year` on the capacity object or `year` on the company record

Extraction rule: if the image shows a capacity figure with a future year ("X GWh by 2030"), set `type: "planned"` and `target_year: 2030`. If a company is shown as operational with no year qualifier, set `type: "current"`. A company can have both a current and a planned capacity entry in `capacities[]` (e.g. producing 5 GWh now, targeting 40 GWh by 2030).

```json
"capacities": [
  { "value": 5,  "unit": "GWh", "known": true, "type": "current", "label": "current production" },
  { "value": 40, "unit": "GWh", "known": true, "type": "planned", "target_year": 2030, "label": "planned capacity" }
]
```

**`stage`** — commercial maturity of the company/site:
- `commercial` — full-scale commercial production
- `pilot` — pilot line or demonstration scale
- `rd` — R&D / lab stage, no commercial output
- `unknown` — not enough information
- `null` — not yet assessed

**`open_questions`** — list of strings in `attributes{}`:
- Set during extraction for unconfirmed data
- Julian also adds notes here manually (e.g. "paused as of Q1 2026 — verify")
- Used as a to-do list for focused research passes

```json
"attributes": {
  "logo_research_needed": false,
  "open_questions": [
    "confirm GWh capacity — figures vary by source",
    "verify stage — pilot or commercial as of 2026?"
  ]
}
```

---

## Reference data naming convention

```
reference-data/
├── unprocessed/   ← new files go here
└── processed/     ← moved here after extraction
```

File naming: `YYYY-MM_[Category]_[Region].jpg`

Categories: `Cell-Manufacturers` · `Module-Pack` · `Recycling` · `Components` · `Equipment` · `Active-Materials` · `Solid-State`

---

## Data files

| File | Sector | Records |
|---|---|---|
| `data/companies.json` | cell_manufacturer | 38 |
| `data/module-pack.json` | module_pack_manufacturer | 110 |
| `data/recycling.json` | recycler | 65 |
| `data/active-materials.json` | active_material_producer | 29 |
| `data/solid-state.json` | cell_manufacturer (solid-state) | 17 |
| `data/components.json` | component_manufacturer | 50 |
| `data/equipment.json` | equipment_provider | 87 |

**Total: 396 records. All source images processed. `reference-data/unprocessed/` is empty.**

---

## Running the app

```bash
python3 server.py
```
→ Open http://localhost:8080/app/
