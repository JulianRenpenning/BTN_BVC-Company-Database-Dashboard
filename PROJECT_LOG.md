# BTN_BVC-Company-Database-Dashboard — Project Log

**Last updated:** 2026-05-18 (Session 7 — Cell manufacturer file consolidation; continent field added)  
**Owner:** Julian Renpenning (Battery-Tech Network)

---

## Project Goal

A tool to extract structured company data from images (maps, slides, reports) — company names, locations, capacities, production details, chemistries, recycling processes — and store it in a local JSON database with a browser-based visualization app. Claude Code is the extraction engine: Julian shares an image in chat, Claude identifies all companies (including logo-only entries via web search), geocodes locations, deduplicates against existing records, and appends new data.

**Scope:** European battery value chain — cell manufacturers, module & pack producers, recyclers, passive component makers, and equipment providers.

**Visualization:** Local web app (Leaflet map + sortable/filterable table + Chart.js charts), served via `python server.py` → `http://localhost:8080/app/`

**Future path:** One-time migration to Airtable via MCP when needed. Schema is designed to map directly.

---

## Folder Structure

```
Claude Code/BTN_BVC-Company-Database-Dashboard/
├── data/
│   ├── cell-manufacturers.json      ← Cell manufacturers — global (170 records: 52 EU, 39 NA, 79 Asia)
│   ├── recycling.json               ← Battery recyclers (65 records)
│   ├── module-pack.json             ← Module & pack producers (110 records)
│   ├── active-materials.json        ← Active material producers (29 records)
│   ├── components.json              ← Passive cell components (50 records)
│   └── equipment.json               ← Production equipment providers (64 records)
├── app/
│   ├── index.html           ← Visualization app (map + table + chart)
│   ├── app.js               ← Data loading, filtering, rendering
│   └── styles.css           ← Styles incl. sector and status tag colors
├── reference-data/
│   ├── NAMING_CONVENTION.txt
│   └── [source images — see naming convention below]
├── server.py                ← python server.py → http://localhost:8080/app/
└── PROJECT_LOG.md           ← This file
```

---

## Data Schema (v1.4)

One JSON file per sector. Each file has a `meta` block and a `companies` array.

**Schema changelog:**
- `v1.0` — Initial schema
- `v1.1` — Added `sector` field
- `v1.2` — Added `stage` field; added `open_questions` list inside `attributes{}`
- `v1.3` — Formalized deduplication rules (3-case: skip / flag potential update / new site); added research freshness logic (365-day threshold); three-state research dot in table (teal = fresh, grey = stale, light grey = never researched)
- `v1.4` — Added `continent` field (`"Europe"` · `"North America"` · `"Asia"`) to `cell-manufacturers.json`; consolidated 4 cell manufacturer files into one global file (170 records, one per physical facility)

**Core record fields:**

| Field | Type | Notes |
|---|---|---|
| `id` | string | kebab-case unique ID, e.g. `powerco-salzgitter` |
| `name` | string | Company name |
| `sector` | string | See sector values below |
| `continent` | string or null | `"Europe"` · `"North America"` · `"Asia"` — present in `cell-manufacturers.json`; null in other sector files |
| `country` | string | Country name; `"Pan-European"` for pan-EU entities |
| `city` | string or null | null for equipment providers without a specific site |
| `lat` / `lon` | number or null | null = no map pin (still shown in table) |
| `year` | number or null | Numeric year for filtering |
| `year_label` | string or null | Display string, e.g. `"2027"`, `"202X"`, `"2025*"` |
| `status` | string | `Operational` · `Planned` · `Paused` · `Unknown` |
| `stage` | string or null | `commercial` · `pilot` · `rd` · `unknown` · `null` (not yet assessed) |
| `capacities` | array | See below |
| `products` | array | See below |
| `materials` | array | For material producers |
| `attributes` | object | Includes `logo_research_needed` (bool) and `open_questions` (array) |
| `source_image` | string | Filename of source image |
| `date_added` | string | ISO date |
| `notes` | string | Free text |

**Sector values:**
- `cell_manufacturer`
- `module_pack_manufacturer`
- `recycler`
- `component_manufacturer`
- `equipment_provider`
- `active_material_producer`

**Stage values:**

| Value | Meaning |
|---|---|
| `commercial` | Full-scale commercial production |
| `pilot` | Pilot line or demonstration scale |
| `rd` | R&D / lab stage, no commercial output |
| `unknown` | Not enough information to assess |
| `null` | Not yet assessed |

**`open_questions` — research and to-do notes:**

A list of strings inside `attributes{}`. Used for:
- Things Claude could not confirm during extraction (e.g. `"confirm GWh capacity"`)
- Notes Julian adds when he knows something has changed (e.g. `"paused as of Q1 2026 — verify"`)
- Targeted research tasks for a later research pass

```json
"attributes": {
  "logo_research_needed": false,
  "open_questions": [
    "confirm current production capacity — reported figures vary",
    "verify stage — pilot or commercial as of 2026?"
  ]
}
```

**Capacity object:**
```json
{ "value": 40, "unit": "GWh", "known": true, "label": "annual cell production", "target_year": 2030 }
```
- `unit`: any string — `GWh`, `MWh`, `t/y`, `tpa`, `kt`, `MW`
- `known: false` when image shows an undisclosed figure (e.g. "X GWh")
- `target_year`: optional, used when a record has both current and target capacity

**Product object:**
```json
{ "category": "chemistry", "name": "NMC" }
```
- Categories in use: `chemistry`, `cell_type`, `recycling_process`
- Recycling processes: `Mechanical`, `Hydrometallurgy`, `Pyrometallurgy`, `Direct`

---

## Image Naming Convention & Status

Images are stored in two subfolders under `reference-data/`:

```
reference-data/
├── unprocessed/   ← drop new images here
└── processed/     ← moved here after extraction is complete
```

**Naming format:** `YYYY-MM_[Category]_[Region].jpg`  
**Categories:** `Cell-Manufacturers` · `Module-Pack` · `Recycling` · `Components` · `Equipment`  
**Region:** `Europe` · `Global` · `Asia` · `North-America` etc.

**Current image status:**

| File | Folder | JSON target | Records |
|---|---|---|---|
| `2026-02_Cell-Manufacturers_Europe.jpg` | processed | cell-manufacturers.json | 35 (EU records) |
| `2026-02_Module-Pack_Europe.jpg` | processed | module-pack.json | 110 |
| `2026-02_Recycling_Europe.jpg` | processed | recycling.json | 65 |
| `2026-02_Active-Materials_Europe.jpg` | processed | active-materials.json | 29 |
| `2026-02_Components_Europe.jpg` | processed | components.json | 50 |
| `2026-02_Equipment_Europe.jpg` | processed | equipment.json | 64 |
| `2026-02_Solid-State_Europe.jpg` | processed | cell-manufacturers.json | 17 (EU solid-state) |
| `240716_Battery-Cell-Production_North-America.jpg` | processed | cell-manufacturers.json | 39 (NA records) |
| `230804_Asia_battery manufacturers.png` | processed | cell-manufacturers.json | 79 (Asia facility records) |

**Total: 488 records across 6 files. All source images processed.**

---

## Extraction Workflow (per image)

1. **Save image** to `reference-data/unprocessed/` using naming convention (before anything else)
2. **Vision extraction** — read all text: company names, cities, countries, years, capacities, status markers
3. **Logo research** — web search for any logos without readable text names; set `logo_research_needed: true` in `attributes` if unresolved
4. **Geocoding** — look up lat/lon for each city
5. **Deduplication** — check existing records (match by name + city); skip duplicates
6. **Append** — write new records to the appropriate sector JSON file; update `meta.last_updated` and `meta.record_count`
7. **Move image** — `reference-data/unprocessed/` → `reference-data/processed/`
8. **Confirm** — report: N new records added, M skipped (already existed), K logos still need research

---

## Completed Tasks

### Session 1 — 2026-05-11

- [x] Designed extensible JSON schema (v1.0 → v1.1) with `capacities[]`, `products[]`, `materials[]`, `attributes{}` arrays
- [x] Added `sector` field (schema v1.1) to distinguish value chain position
- [x] Stress-tested schema against 5 image types — confirmed schema handles all without breaking changes
- [x] Extracted and wrote **`data/companies.json`** — 38 European cell manufacturers
- [x] Extracted and wrote **`data/recycling.json`** — 65 European battery recyclers
- [x] Extracted and wrote **`data/module-pack.json`** — 110 European module & pack producers
- [x] Built visualization web app: `app/index.html` + `app/app.js` + `app/styles.css`
  - Leaflet.js map with bubble markers (size ∝ capacity, color = status)
  - Sortable/filterable table (Country, Sector, Status, Year range, Known capacity toggle)
  - Chart.js: capacity by country (GWh bar chart) + status breakdown (doughnut)
- [x] Built `server.py` — one-command local server (`python3 server.py`)
- [x] Updated app.js for multi-file loading (all JSON files merged at startup)
- [x] Added Sector filter dropdown to filter bar and Sector column to table
- [x] Created `reference-data/` folder with `processed/` and `unprocessed/` subfolders
- [x] Created placeholder shells for `data/components.json` and `data/equipment.json`
- [x] Renamed project from "Company Data Extractor" to "Battery Industry Company Database"
- [x] Created `CLAUDE.md` for automatic session-start checks
- [x] Schema v1.2 — added `stage` field and `open_questions` in `attributes{}`; applied to all existing records
- [x] Renamed new reference images to naming convention; two new image types identified (Active Materials, Solid-State)
- [x] Extracted and wrote **`data/active-materials.json`** — 29 European active material producers (source: `2026-02_Active-Materials_Europe.jpg`). New sector: `active_material_producer`. Covers pCAM, CAM, AAM, and Electrolyte producers across Norway, Netherlands, UK, Belgium, France, Spain, Sweden, Finland, Estonia, Denmark, Germany, Poland, Hungary, Italy. 13 entries flagged `logo_research_needed`, with targeted `open_questions` for follow-up research.
- [x] Restructured app layout — filters moved to left sidebar, map now fills full remaining height
- [x] Added `active_material_producer` sector label and tag colour (purple) to app
- [x] Fixed Chart tab rendering — charts were blank on first load due to rendering while tab was hidden; fixed by re-rendering on tab activation
- [x] Fixed chart dimensions — charts now use a responsive two-column grid on desktop (bar chart 60% / doughnut 40%), stacked single-column on screens < 900px; added `maintainAspectRatio: false` for proper fill

### Session 2 — 2026-05-12

- [x] App header redesigned — two-line lockup: "Battery Value Chain" (large) / "Company Database" (small, uppercase)
- [x] Record count badge moved from header to sidebar
- [x] Status colors updated — Planned → yellow (#f4a523), Paused/Cancelled → red (#d93025)
- [x] `Paused` and `Cancelled` statuses unified as "Paused / Cancelled" in all display labels (filter, table, chart legend, map popup)
- [x] Capacity `type` field added to schema (`current` / `planned`) — migration applied to all 133 capacity objects across companies.json, active-materials.json, recycling.json
- [x] Table updated — Current Cap. and Planned Cap. as separate columns; Planned Cap. shows target year ("X GWh by YYYY"); Year column removed
- [x] Year range filters removed from sidebar
- [x] `research` field added to schema (`summary`, `source`, `date`) — displayed as teal dot in table and research section in map popup
- [x] Company research workflow documented in CLAUDE.md
- [x] Research performed on ACC Kaiserslautern → status corrected to Paused (shelved Feb 2026)
- [x] Research pass on all 31 `logo_research_needed` records — 17 Unknown names resolved; 2 remain unresolved (Tallinn, Gothenburg)
- [x] Research pass on all Unknown-status records — all 8 resolved (Planned or Paused)
- [x] c<e3 Helmond identified as Eleo (Yanmar) — name corrected, status set to Operational, 500 MWh/yr current capacity added
- [x] Lyten gigafactory (ex-Northvolt Drei) identified — flagged for move from recycling.json to companies.json
- [x] Befesa Erandio flagged for sector review (steel EAF dust recycler, not EV battery)
- [x] Status chart legend fix — "Paused / Cancelled" label now shown correctly (was showing raw "Paused")
- [x] Capacity bar chart converted to stacked bar by status (green / yellow / red segments per country)
- [x] Workflow Overview document created — `Workflow Overview.md` in project root
- [x] Deduplication rules formalized (schema v1.3) — three-case logic: skip / flag potential update / new site
- [x] Research freshness logic added — 365-day threshold; three-state dot in table (teal = fresh, grey = stale, light grey = never researched)
- [x] Extracted and wrote **`data/solid-state.json`** — 17 European solid-state battery companies. Covers UK, NL, BE, ES, NO, DE, FR, CH, IT. Stage mapping: R&D×8, pilot×6, commercial×3 (Blue Solutions, ITEN, ENSURGE). Chemistries: oxide, polymer, sulfide composites. 4 entries with classification open_questions (FAAM, Solvionic, ProLogium, Swiss Clean Battery).
- [x] Extracted and wrote **`data/components.json`** — 50 European passive cell component manufacturers. Covers separators, current collectors, housing, electrolyte additives, binders, coatings, gaskets. 20 entries flagged `logo_research_needed`. 4 Pan-European entries (no map pin). 22 entries for unknown companies with targeted open_questions.
- [x] Extracted and wrote **`data/equipment.json`** — 87 European battery production equipment providers. Categories: electrode manufacturing, cell assembly, cell finishing, module & pack production, atmosphere conditioning. Nearly all records have `city: null` / `lat: null` / `lon: null` per equipment provider schema rule. 34 entries flagged `logo_research_needed`.
- [x] All 3 source images moved from `reference-data/unprocessed/` → `reference-data/processed/`
- [x] DATABASE COMPLETE: 396 total records across 7 sector files. All source images processed.
- [x] PROJECT_LOG.md and CLAUDE.md updated to reflect all session 2 completions

---

### Session 3 — 2026-05-16

- [x] Folder renamed from `Battery Industry Company Database` → `BTN_BVC-Company-Database-Dashboard`; all internal references updated
- [x] Map minimum zoom fixed — `minZoom: 2` added to Leaflet init; grey borders no longer visible when zooming out
- [x] `server.py` patched with `allow_reuse_address = True` — eliminates "Address already in use" error on restart
- [x] GitHub repository created: `github.com/JulianRenpenning/BTN_BVC-Company-Database-Dashboard` (public)
- [x] SSH key generated (`~/.ssh/btn_bvc_deploy`) and added to GitHub for passwordless push
- [x] All project files pushed to GitHub (15 files, 396 records)
- [x] GitHub Pages enabled — app live at: **https://julianrenpenning.github.io/BTN_BVC-Company-Database-Dashboard/app/**
- [x] GitHub Pages publish workflow documented in `CLAUDE.md`

### Session 4 — 2026-05-16

- [x] **Full research pass on `data/companies.json`** — all 38 cell manufacturer records researched, verified, and updated via WebSearch + WebFetch
  - Research summaries (`research.summary`, `research.source`, `research.date: "2026-05-16"`) added to all 38 records (2 already existed from Session 2; 36 added fresh)
  - **Status corrections (Planned → Operational):** PowerCo Salzgitter, Verkor Dunkirk, ACC Douvrin, AESC Sunderland, AESC Douai, EVE Debrecen, CATL Erfurt, SK On Komárom, UniverCell Flintbek, V4Smart Nördlingen, Lyten Skellefteå, CATL Debrecen, Blue Solutions Quimper
  - **Status correction (Paused → Cancelled):** Morrow Batteries — **bankrupt as of 6 May 2026**
  - **Capacity corrections:**
    - LG Energy Solution Wrocław: 115 GWh → 86 GWh current (100 GWh planned Stage IV target)
    - FAAM Teverola: 8 GWh "current" → 0.3 GWh current (Teverola 1) + 8 GWh planned (Teverola 2)
    - CATL Debrecen: 100 GWh "current" → 40 GWh current (Phase 1) + 100 GWh planned (long-term)
    - InoBat Voderady: 10 GWh "current" → ~0.05 GWh (pilot line, 50,000 cells/year max)
    - Leclanché Willstätt: 2.5 GWh → 1 GWh current + 2 GWh planned (EU grant expansion)
    - ACC Douvrin: 40 GWh planned → 13 GWh current + 40 GWh planned (2030)
    - Verkor Dunkirk: 50 GWh planned → 16 GWh current + 50 GWh planned (2030)
    - AESC Sunderland: 35 GWh planned → 15.8 GWh current + 35 GWh planned
    - AESC Douai: 30 GWh planned → 10 GWh current + 30 GWh planned (2030)
    - PowerCo Salzgitter: 40 GWh planned → 20 GWh current + 40 GWh planned
    - SK On Komárom: 47.3 GWh planned → 47.5 GWh current (all 3 Hungarian plants operational)
    - InoBat/Gotion Šurany: 40 GWh → 20 GWh Phase 1 (40–60 GWh long-term)
    - ProLogium Dunkirk: 16 GWh planned → 4 GWh by 2030, 12 GWh by 2032 (phased build)
    - Tesla Grünheide: unknown → 18 GWh planned H1 2027 ($250M investment, announced May 2026)
    - CATL Erfurt: 14 GWh planned → 14 GWh current + 60 GWh planned (end 2026 expansion)
    - Beyonder: unknown → 5 GWh target noted
    - Lyten Skellefteå: unknown → 16 GWh current (acquired Northvolt Ett assets, Feb 2026)
    - Lyten Heide: unknown → 15 GWh under construction
    - AESC Navalmoral: 50 GWh → 30 GWh (confirmed plans); year 2025 → 2026
    - CATL/Stellantis Zaragoza: year 20XX → 2026 (construction started Nov 2025)
    - UniverCell Flintbek: 10 GWh planned → 1.5 GWh current (specialty non-automotive)
  - **City/location corrections:**
    - InoBat Serbia: "Serbia (location TBD)" → Ćuprija (central Serbia), coordinates added
    - TIAMAT: city corrected from Douvrin to Amiens region (actual site near Boves)
  - **Stage field population:** 28 records updated from `null` to appropriate stage (commercial/pilot)
  - Schema version updated: 1.2 → 1.3 in meta
  - Committed and pushed to GitHub; teal research dots now visible on all 38 company pins

### Session 5 — 2026-05-18

- [x] **Fixed "undisclosed" → "—" in capacity display** — `capValueLabel()`, current capacity cell, and planned capacity cell all updated to return `"—"` for unknown/null capacity values
- [x] **Extracted and wrote `data/companies-north-america.json`** — 39 North American cell manufacturer records (facility-level) from `240716_Battery-Cell-Production_North-America.jpg`
  - Full research pass: 14 unknown companies identified, 15 status corrections
  - Key identifications: Manteno IL = Gotion, Liberty NC = Toyota (operational Nov 2025), Bartow County GA = HSAGP Energy (Hyundai+SK On), Bryan County GA = HL-GA Battery (Hyundai+LG)
  - Status corrections: Northvolt Montreal/Quebec → Cancelled, FREYR Georgia → Cancelled, KORE Power Buckeye → Cancelled, Panasonic De Soto → Operational (Jul 2025)
  - Correction: AESC "Smyrna GA" → Smyrna, TN (sold to Fixx Energy Apr 2026)
  - BlueOval SK dissolved — Ford and SK On took individual ownership of respective plants
- [x] **Extracted and wrote `data/companies-asia.json`** — initial 17 company-level records from `230804_Asia_battery manufacturers.png`
  - Full research pass on all 17 companies; 2 unknown logos resolved (ASPILSAN Turkey, Amita Technology Thailand)
  - Turkey: added Siro Gemlik (TOGG/Farasis JV — new company not previously in DB)

### Session 6 — 2026-05-18

- [x] **Expanded `companies-asia.json` from 17 company-level → 79 facility-level records** — one record per physical manufacturing site per company
  - CATL: 13 facilities across China + Indonesia (planned)
  - BYD: 15 facilities across China (Shenzhen, Chongqing, Changsha, Nanning 70 GWh, Xi'an, Jinan, Xuzhou, Zhengzhou, Guiyang, Xining, Bengbu, Changchun, Wenzhou, Wuhan, Yichun)
  - EVE Energy: 7 facilities; SVOLT: 10 facilities; Gotion: 7 China sites; Lishen: 4 sites
  - Sunwoda: 5 sites; Samsung SDI Asia: 4 sites; LG Energy Solution Ochang; SK On Seosan
  - Panasonic: 5 Japan sites incl. Oizumi/Gunma (16 GWh by 2030 joint with Subaru)
  - India: Ola Electric Hosur (2.5 GWh, operational) + Amara Raja Divitipally (planned)
  - Indonesia: HLI Green Power (20 GWh) + CATL Karawang (planned)
  - Turkey: ASPILSAN Kayseri + Siro Gemlik; Thailand: Amita Technology Chachoengsao
  - Status and capacity data research-verified for all 79 records

### Session 7 — 2026-05-18

- [x] **Consolidated 4 cell manufacturer files into `data/cell-manufacturers.json`** — schema v1.4
  - Merged: `companies.json` (35) + `companies-north-america.json` (39) + `companies-asia.json` (79) + `solid-state.json` (17) = **170 facility-level records**
  - Added `continent` field to all records: Europe (52) · North America (39) · Asia (79)
  - Sorted: continent → country → status → city
  - Zero duplicate IDs; zero records lost or modified
  - Deleted 4 source files from repo (`git rm`)
  - Updated `app/app.js` DATA_FILES from 9 → 6 entries
  - Updated CLAUDE.md and PROJECT_LOG.md to reflect new 6-file structure
  - **Database total: 488 records across 6 sector files**

---

## Pending Tasks

### High priority — Airtable enrichment (planned 2026-05-18, not yet executed)

**Goal:** Enrich the dashboard JSON records with data from the BTN Account Database in Airtable.

**Sources:**
- `WP Company Directory` table (1,044 records) — BVC Stage/Category taxonomy, WordPress profile URL, Technology Categories, company descriptions
- `BTN Accounts` table — website domain (match key), LinkedIn URL, overview, key technologies, facilities, recent developments

**Match key:** `domain` field in BTN Accounts (e.g. `catl.com`) matched against company name or website in dashboard records. Domain is the most reliable cross-system identifier.

**Enrichment fields to add to dashboard records:**
- `website` / `domain` — from BTN Accounts
- `linkedin` — from BTN Accounts
- `btn_profile_url` — the battery-tech.net company page URL (from WP Company Directory `URL` field)
- `bvc_category` — detailed BVC Category from WP Company Directory (e.g. "Cell Manufacturing", "Material Recycling")
- `overview` — short company description from BTN Accounts

**Airtable connection:** MCP is live and connected. Base ID: `appOF0MlHF4imAtG5`. WP Company Directory table ID: `tblcBP5HbtaLkuxqi`. BTN Accounts table ID: `tblfZg9UAZQtaSZKV`.

**Next steps when resuming:**
1. Decide which enrichment fields to add to the dashboard schema
2. Build a matching script: for each dashboard record, look up by company name (fuzzy) or domain in Airtable
3. Write matched data into the JSON files
4. Consider adding a `btn_profile_url` link in the map popup and table

---

### High priority — data quality

- [ ] **Move Lyten (ex-Northvolt Drei)** from `recycling.json` to `cell-manufacturers.json` — misclassified; it is a cell manufacturer gigafactory site, not a recycler
- [ ] **Verify Befesa Erandio** — processes steel EAF dust, not EV batteries; may not belong in recycling.json at all
- [ ] **Resolve 2 remaining unknown companies:**
  - Unknown, Tallinn, Estonia — SG anode active material producer, 1,000 t/a
  - Unknown, Gothenburg, Sweden (circular arrow logo) — module & pack sector
- [x] **Research pass on EU cell manufacturers** — completed Session 4 (2026-05-16); all 35 European records have fresh research summaries (now in `cell-manufacturers.json`)
- [x] **Research pass on North America cell manufacturers** — completed Session 5 (2026-05-18); all 39 records researched
- [x] **Research pass on Asia cell manufacturers** — completed Session 6 (2026-05-18); all 79 facility records researched and verified
- [ ] **Research pass on remaining files** — sweep `recycling.json`, `module-pack.json`, `active-materials.json`, `components.json` for records with `open_questions`
- [ ] **Belleville MI (North America)** — company identity still unconfirmed; remains `logo_research_needed: true`

### Medium priority — app improvements

- [ ] **Stage filter** — add Stage dropdown (commercial / pilot / rd) to filter bar
- [ ] **`open_questions` indicator** — show a flag in table rows that have open questions
- [ ] **Sector chart** — third Chart.js chart showing record count by sector
- [ ] **Map cluster layer** — cluster dense pins at low zoom levels

### Low priority / future

- [ ] **Airtable migration script** — one-time script to push all JSON records to Airtable via MCP
- [ ] **Inline editing** — click a table row to edit `notes` or `open_questions` in-place

---

## Known Data Quality Flags

- `logo_research_needed: true` entries exist in `recycling.json` — logos that could not be identified from the source image alone. These appear with an orange dot in the table.
- `northvolt-heide-recycling` — status `Unknown` due to Northvolt bankruptcy proceedings.
- `companies.json` — several entries have `lat: null / lon: null` (no specific site announced). These appear in table and chart but not on the map.
- `equipment.json` — most entries will have `lat: null / lon: null` since equipment providers are often headquartered companies without site-specific battery projects.

---

## How to Run

```bash
cd "_Claude Playground/Claude Code/BTN_BVC-Company-Database-Dashboard"
python server.py
# → open http://localhost:8080/app/
```
