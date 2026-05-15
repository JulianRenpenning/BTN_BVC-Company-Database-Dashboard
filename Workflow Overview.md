# Battery Value Chain — Database Workflow Overview

*How information flows from a raw source image to an interactive visualization.*

---

## What the system does

The Battery Industry Company Database turns static reference images — market maps, slide decks, industry reports — into a live, searchable, and filterable database of European battery value chain companies. The extraction, enrichment, and visualization are handled entirely by Claude Code without any manual data entry.

---

## The three-stage pipeline

```
1. INTAKE          →     2. ENRICHMENT          →     3. VISUALIZATION
   Raw image                 Research & QA                 Web app
   ↓                         ↓                             ↓
   Text extraction           Web search                    Map (Leaflet)
   Company identification    Gap filling                   Table (sortable)
   Geocoding                 Flagging open questions       Charts (Chart.js)
   Deduplication             Status resolution
   JSON storage
```

---

## Stage 1 — Intake: from image to structured data

### 1.1 The input

The workflow starts when a reference image is dropped into the `reference-data/unprocessed/` folder. Typical sources:
- A market map showing battery plants across Europe (logos, city names, capacity figures)
- A slide from an industry report
- A regional overview from a trade publication

Images are named with a standard convention: `YYYY-MM_[Category]_[Region].jpg` — for example, `2026-02_Cell-Manufacturers_Europe.jpg`.

### 1.2 Visual extraction

Claude reads the image directly. It identifies:
- **Company names** — either as text or as logos (see 1.3 below)
- **Locations** — city and country shown on or near each marker
- **Capacity figures** — GWh, MWh, t/year, etc., if labeled
- **Status signals** — color coding, icons, or footnotes indicating whether a site is operational, planned, or paused
- **Year markers** — target years for planned capacity ("X GWh by 2030")

Everything Claude reads from the image is treated as the raw claim. Uncertain or ambiguous data is flagged, not invented.

### 1.3 Logo identification

Many market maps show only a company logo without a text label. When Claude cannot read a name from an image, it runs a targeted web search to identify the company behind the logo. If a logo remains unresolvable, the record is created with `name: "Unknown"` and a flag (`logo_research_needed: true`) that causes an orange dot to appear next to the entry in the app — a visual reminder that the name still needs to be confirmed.

### 1.4 Geocoding

Every company location needs latitude/longitude coordinates to appear as a pin on the map. Claude looks up the coordinates for each city during extraction. If no specific city is given (common for equipment providers or pan-European entities), the record is stored without coordinates — it will appear in the table and charts, but not on the map.

### 1.5 Deduplication

Before writing anything, Claude checks all existing records across all database files. Any company that already exists — matched by name and city — is skipped. This prevents duplicate entries when overlapping source images are processed.

### 1.6 Writing to the database

New records are appended to the relevant sector file:

| Sector | File |
|---|---|
| Cell manufacturers | `data/companies.json` |
| Module & pack producers | `data/module-pack.json` |
| Battery recyclers | `data/recycling.json` |
| Component manufacturers | `data/components.json` |
| Equipment providers | `data/equipment.json` |
| Active material producers | `data/active-materials.json` |
| Solid-state manufacturers | `data/solid-state.json` |

Each file is plain JSON — human-readable, version-controllable, and structured to map directly to Airtable when a migration is needed.

### 1.7 Image archiving

Once extraction is complete, the source image is moved from `unprocessed/` to `processed/`. This keeps the intake queue clean and signals that the image has been handled.

---

## Stage 2 — Enrichment: research and quality assurance

Extraction from an image has limits — logos are sometimes ambiguous, capacity figures are often undisclosed, and project status changes faster than any static image is updated. Enrichment fills those gaps.

### 2.1 Open questions

During extraction, anything that could not be confirmed with confidence is added to an `open_questions` list on the company record. Examples:
- *"confirm GWh capacity — figures vary by source"*
- *"verify stage — pilot or commercial as of 2026?"*
- *"paused as of Q1 2026 — verify"*

Julian also adds notes here manually when he knows something has changed. The open questions list acts as a prioritized research to-do list.

### 2.2 Company research

When triggered (either for a single company or in a batch sweep), Claude:
1. Searches the web for recent news about the company and their battery operations
2. Reads 1–2 primary sources (company announcements, industry reports, press releases)
3. Writes a concise 2–5 sentence summary of the most relevant facts: current capacity, planned ramp-up, status, and recent developments
4. Records the primary source URL and the date the research was performed

This research summary is stored directly on the company record and surfaced in two places in the app:
- A **teal dot** appears next to the company name in the table — hover to see "Research available"
- The **map popup** shows the full research summary with a clickable link to the source

### 2.3 Status resolution

Companies extracted from images often have an `Unknown` status because the image gives no clear signal. During a research pass, Claude looks up the current project status and resolves it to `Operational`, `Planned`, or `Paused / Cancelled`. Resolved statuses immediately change the color of the marker on the map and the tag in the table.

### 2.4 Flagging misclassifications

The research process sometimes reveals that a company was assigned to the wrong sector — for example, a recycler that turns out to process steel dust rather than EV batteries, or a gigafactory that was incorrectly logged under recyclers. These are flagged in the `open_questions` list for Julian's review before any record is moved between files.

---

## Stage 3 — Visualization: the web app

The visualization app runs locally at `http://localhost:8080/app/` and reads all seven database files on startup. It has three views:

### 3.1 Map

Each company with known coordinates appears as a bubble on a Leaflet.js map of Europe. The bubble's **color** reflects the company's current status (green = Operational, yellow = Planned, red = Paused/Cancelled). The bubble's **size** scales with known capacity — larger bubbles represent higher GWh output. Clicking a bubble opens a popup with key facts and, if available, the research summary.

### 3.2 Table

All companies — including those without coordinates — appear in a filterable, sortable table. Filters on the left sidebar narrow results by country, sector, and status. Columns include current capacity, planned capacity with target year, chemistry, and status. Two small dots may appear next to a company name:
- **Orange dot** — logo still needs identification
- **Teal dot** — research summary available

### 3.3 Charts

The chart view provides two aggregate views:
- **Capacity by country** — a stacked horizontal bar chart showing total announced GWh per country, segmented by status (green/yellow/red per bar)
- **Status breakdown** — a doughnut chart showing the share of sites that are Operational, Planned, or Paused/Cancelled across the current filter selection

Both charts update automatically whenever a filter is applied.

---

## The feedback loop

The workflow is iterative, not one-shot:

```
New image → Extraction → Gaps flagged → Research → Records updated → App reflects changes
     ↑                                                                        |
     └──────────────── Julian adds new images or manual notes ────────────────┘
```

Every change — a resolved logo, a status update, a research summary — is written directly to the JSON files. The app reads fresh data on every load, so no separate "publish" step is needed.

---

## Data quality signals at a glance

| Signal | Where visible | Meaning |
|---|---|---|
| Orange dot | Table, company name | Logo not yet identified |
| Teal dot | Table, company name | Research summary available |
| Grey bubble on map | Map | Status Unknown |
| "undisclosed" in capacity cell | Table | Capacity exists but figure not public |
| "—" in capacity cell | Table | No capacity data at all |

---

## Running the system

```
python3 server.py
→ http://localhost:8080/app/
```

One command starts a local web server. No cloud dependency, no build step. All data lives in plain JSON files on disk.
