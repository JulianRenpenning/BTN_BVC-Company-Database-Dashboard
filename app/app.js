/* Battery Industry Company Database — app.js */

const DATA_FILES = [
  "../data/cell-manufacturers.json",
  "../data/recycling.json",
  "../data/module-pack.json",
  "../data/components.json",
  "../data/equipment.json",
  "../data/active-materials.json",
];

const STATUS_COLORS = {
  Operational: "#1e8c45",
  Planned:     "#f4a523",
  Paused:      "#d93025",
  Cancelled:   "#d93025",
  Unknown:     "#9e9e9e",
};

const STATUS_LABELS = {
  Paused:    "Paused / Cancelled",
  Cancelled: "Paused / Cancelled",
};

const SECTOR_LABELS = {
  cell_manufacturer:        "Cell Manufacturer",
  module_pack_manufacturer: "Module & Pack",
  recycler:                 "Recycler",
  component_manufacturer:   "Component Manufacturer",
  equipment_provider:       "Equipment Provider",
  active_material_producer: "Active Materials",
};

let allCompanies = [];
let filtered     = [];
let map, markersLayer;
let capacityChart, statusChart;
let sortKey = "name", sortAsc = true;

// ── Bootstrap ──────────────────────────────────────────────────────────────

async function init() {
  const results = await Promise.allSettled(
    DATA_FILES.map(url =>
      fetch(url)
        .then(r => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); })
    )
  );

  allCompanies = results.flatMap(r =>
    r.status === "fulfilled" ? (r.value.companies || []) : []
  );

  // Show the most recent last_updated date across all loaded files
  const dates = results
    .filter(r => r.status === "fulfilled" && r.value.meta?.last_updated)
    .map(r => r.value.meta.last_updated);
  if (dates.length) {
    const latest = dates.sort().at(-1);           // ISO strings sort lexicographically
    const formatted = new Date(latest + "T00:00:00")
      .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    document.getElementById("last-updated").textContent = `Updated ${formatted}`;
  }

  populateCountryFilter();
  populateSectorFilter();
  bindFilters();
  bindTabs();
  bindTableSort();

  applyFilters();
  initMap();
  renderMap();
}

// ── Filters ────────────────────────────────────────────────────────────────

function populateCountryFilter() {
  const sel      = document.getElementById("filter-country");
  const countries = [...new Set(allCompanies.map(c => c.country))].sort();
  countries.forEach(ct => {
    const o = document.createElement("option");
    o.value = ct; o.textContent = ct;
    sel.appendChild(o);
  });
}

function populateSectorFilter() {
  const sel     = document.getElementById("filter-sector");
  const sectors = [...new Set(allCompanies.map(c => c.sector).filter(Boolean))].sort();
  sectors.forEach(s => {
    const o = document.createElement("option");
    o.value = s; o.textContent = SECTOR_LABELS[s] || s;
    sel.appendChild(o);
  });
}

function bindFilters() {
  ["filter-country","filter-sector","filter-status","filter-known-only"]
    .forEach(id => document.getElementById(id).addEventListener("change", applyFilters));
  document.getElementById("btn-reset").addEventListener("click", resetFilters);
}

function resetFilters() {
  document.getElementById("filter-country").value    = "";
  document.getElementById("filter-sector").value     = "";
  document.getElementById("filter-status").value     = "";
document.getElementById("filter-known-only").checked = false;
  applyFilters();
}

function applyFilters() {
  const country   = document.getElementById("filter-country").value;
  const sector    = document.getElementById("filter-sector").value;
  const status    = document.getElementById("filter-status").value;
  const knownOnly = document.getElementById("filter-known-only").checked;

  filtered = allCompanies.filter(c => {
    if (country && c.country !== country) return false;
    if (sector  && c.sector  !== sector)  return false;
    if (status) {
      if (status === "Paused") {
        if (c.status !== "Paused" && c.status !== "Cancelled") return false;
      } else {
        if (c.status !== status) return false;
      }
    }
    if (knownOnly && !primaryCapacity(c)?.known) return false;
    return true;
  });

  document.getElementById("record-count").textContent =
    `${filtered.length} / ${allCompanies.length} records`;

  renderMap();
  renderTable();
  renderCharts();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function primaryCapacity(c) {
  return c.capacities?.find(cap => cap.type === "current")
      ?? c.capacities?.find(cap => cap.type === "planned")
      ?? c.capacities?.[0]
      ?? null;
}

function currentCapacity(c) {
  return c.capacities?.find(cap => cap.type === "current") ?? null;
}

function plannedCapacity(c) {
  return c.capacities?.find(cap => cap.type === "planned") ?? null;
}

function capValueLabel(cap) {
  if (!cap) return "—";
  if (!cap.known || cap.value === null) return "—";
  return `${cap.value} ${cap.unit}`;
}

function currentCapacityLabel(c) {
  return capValueLabel(currentCapacity(c));
}

function plannedCapacityLabel(c) {
  const cap = plannedCapacity(c);
  if (!cap) return "—";
  const val = capValueLabel(cap);
  const year = cap.target_year || c.year;
  return year ? `${val} by ${year}` : val;
}

function chemistries(c) {
  return c.products
    .filter(p => p.category === "chemistry")
    .map(p => p.name)
    .join(", ") || "—";
}

function sectorLabel(c) {
  return SECTOR_LABELS[c.sector] || c.sector || "—";
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function researchStatus(c) {
  if (!c.research?.date) return "none";
  const ageDays = (Date.now() - new Date(c.research.date)) / 86400000;
  return ageDays > 365 ? "stale" : "fresh";
}

function statusTag(status, el = "span") {
  const cls   = status === "Cancelled" ? "Paused" : status;
  const label = statusLabel(status);
  return `<${el} class="status-tag tag-${cls}">${label}</${el}>`;
}

// ── Map ────────────────────────────────────────────────────────────────────

function initMap() {
  map = L.map("map", { minZoom: 2 }).setView([50.5, 10], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 18,
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

function bubbleRadius(c) {
  const cap = primaryCapacity(c);
  if (!cap || !cap.known || cap.value === null) return 7;

  // Normalize across units: GWh direct, t/y scaled down
  const normalized = cap.unit === "GWh" ? cap.value : cap.value / 1000;
  return Math.max(7, Math.min(55, Math.sqrt(normalized) * 4));
}

function renderMap() {
  if (!map) return;
  markersLayer.clearLayers();

  filtered.forEach(c => {
    if (c.lat == null || c.lon == null) return;

    const color  = STATUS_COLORS[c.status] || STATUS_COLORS.Unknown;
    const radius = bubbleRadius(c);

    const circle = L.circleMarker([c.lat, c.lon], {
      radius,
      fillColor:   color,
      color:       "#fff",
      weight:      1.5,
      opacity:     1,
      fillOpacity: 0.75,
    });

    const curCap   = currentCapacityLabel(c);
    const plnCap   = plannedCapacityLabel(c);
    const logoWarning = c.attributes?.logo_research_needed
      ? `<div style="margin-top:8px;font-size:11px;color:#b06000;">⚠ Logo needs research</div>` : "";

    const researchSection = c.research
      ? `<div class="popup-research">
           <div class="popup-research-summary">${c.research.summary}</div>
           <div class="popup-research-meta">
             <a href="${c.research.source}" target="_blank" class="popup-research-source">Source ↗</a>
             <span class="popup-research-date">Researched ${c.research.date}</span>
           </div>
         </div>` : "";

    circle.bindPopup(`
      <div style="min-width:200px">
        <div class="popup-name">${c.name}</div>
        <div class="popup-row"><span class="popup-label">Sector</span><span class="popup-value">${sectorLabel(c)}</span></div>
        <div class="popup-row"><span class="popup-label">Location</span><span class="popup-value">${c.city ?? "—"}, ${c.country}</span></div>
        <div class="popup-row"><span class="popup-label">Current cap.</span><span class="popup-value">${curCap}</span></div>
        <div class="popup-row"><span class="popup-label">Planned cap.</span><span class="popup-value">${plnCap}</span></div>
        <div class="popup-row"><span class="popup-label">Chemistry</span><span class="popup-value">${chemistries(c)}</span></div>
        ${statusTag(c.status, "div")}
        ${logoWarning}
        ${c.notes ? `<div style="margin-top:8px;font-size:11px;color:#6b7a8d;border-top:1px solid #eee;padding-top:6px">${c.notes}</div>` : ""}
        ${researchSection}
      </div>
    `);

    markersLayer.addLayer(circle);
  });
}

// ── Table ──────────────────────────────────────────────────────────────────

function bindTableSort() {
  document.querySelectorAll("#company-table th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (sortKey === key) sortAsc = !sortAsc;
      else { sortKey = key; sortAsc = true; }
      renderTable();
    });
  });
}

function sortedFiltered() {
  return [...filtered].sort((a, b) => {
    let va, vb;
    if (sortKey === "capacity") {
      va = currentCapacity(a)?.value ?? -1;
      vb = currentCapacity(b)?.value ?? -1;
    } else if (sortKey === "planned") {
      va = plannedCapacity(a)?.value ?? -1;
      vb = plannedCapacity(b)?.value ?? -1;
    } else {
      va = (a[sortKey] ?? "").toString().toLowerCase();
      vb = (b[sortKey] ?? "").toString().toLowerCase();
    }
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ?  1 : -1;
    return 0;
  });
}

function renderTable() {
  const tbody = document.getElementById("table-body");
  const rows  = sortedFiltered();

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="no-results">No records match the current filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(c => {
    const cur = currentCapacity(c);
    const pln = plannedCapacity(c);

    const curCell = cur?.known && cur.value !== null
      ? `<span class="cell-capacity">${cur.value} ${cur.unit}</span>`
      : `<span class="capacity-unknown">—</span>`;

    const plnCell = pln
      ? (pln.known && pln.value !== null
          ? `<span class="cell-capacity">${pln.value} ${pln.unit}${pln.target_year || c.year ? ` <span class="cap-year">by ${pln.target_year || c.year}</span>` : ""}</span>`
          : `<span class="capacity-unknown">—</span>`)
      : `<span class="capacity-unknown">—</span>`;

    const logoDot     = c.attributes?.logo_research_needed
      ? `<span class="research-flag" title="Logo needs research"></span>` : "";
    const rs = researchStatus(c);
    const researchDot = rs === "fresh"
      ? `<span class="research-dot research-dot--fresh" title="Research current"></span>`
      : rs === "stale"
        ? `<span class="research-dot research-dot--stale" title="Research overdue (> 1 year)"></span>`
        : `<span class="research-dot research-dot--none" title="Not yet researched"></span>`;

    return `<tr>
      <td class="cell-name">${c.name}${logoDot}${researchDot}</td>
      <td><span class="sector-tag sector-${c.sector}">${sectorLabel(c)}</span></td>
      <td>${c.country}</td>
      <td>${c.city ?? "—"}</td>
      <td>${curCell}</td>
      <td>${plnCell}</td>
      <td>${statusTag(c.status)}</td>
      <td>${chemistries(c)}</td>
      <td style="font-size:11px;color:#9e9e9e">${c.source_image ?? "—"}</td>
    </tr>`;
  }).join("");
}

// ── Charts ─────────────────────────────────────────────────────────────────

function renderCharts() {
  renderCapacityChart();
  renderStatusChart();
}

function renderCapacityChart() {
  const STATUS_GROUPS = [
    { key: "Operational", label: "Operational",       color: STATUS_COLORS.Operational },
    { key: "Planned",     label: "Planned",            color: STATUS_COLORS.Planned },
    { key: "Paused",      label: "Paused / Cancelled", color: STATUS_COLORS.Paused },
  ];

  const byCountry = {};
  filtered.forEach(c => {
    const cap = primaryCapacity(c);
    if (!cap || !cap.known || cap.value === null) return;
    if (cap.unit !== "GWh") return;
    if (!byCountry[c.country]) byCountry[c.country] = { Operational: 0, Planned: 0, Paused: 0, total: 0 };
    const group = (c.status === "Cancelled") ? "Paused" : (STATUS_GROUPS.find(g => g.key === c.status) ? c.status : "Planned");
    byCountry[c.country][group] += cap.value;
    byCountry[c.country].total  += cap.value;
  });

  const entries = Object.entries(byCountry).sort((a, b) => b[1].total - a[1].total);
  const labels  = entries.map(e => e[0]);

  if (capacityChart) capacityChart.destroy();

  const ctx = document.getElementById("capacity-chart").getContext("2d");
  capacityChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: STATUS_GROUPS.map(g => ({
        label:           g.label,
        data:            entries.map(e => e[1][g.key] || 0),
        backgroundColor: g.color + "cc",
        borderColor:     g.color,
        borderWidth: 1,
        borderRadius: 2,
      })),
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 12 } } },
        title: { display: true, text: "Announced Capacity by Country (GWh)", font: { size: 14 } },
      },
      scales: {
        x: { stacked: true, title: { display: true, text: "GWh" } },
        y: { stacked: true },
      },
    },
  });
}

function renderStatusChart() {
  const counts = {};
  filtered.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
  const keys   = Object.keys(counts);
  const labels = keys.map(k => STATUS_LABELS[k] || k);
  const data   = keys.map(k => counts[k]);
  const colors = keys.map(k => STATUS_COLORS[k] || STATUS_COLORS.Unknown);

  if (statusChart) statusChart.destroy();

  const ctx = document.getElementById("status-chart").getContext("2d");
  statusChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "right" },
        title: { display: true, text: "Sites by Status", font: { size: 14 } },
      },
    },
  });
}

// ── Tab switching ──────────────────────────────────────────────────────────

function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      if (btn.dataset.tab === "map") map.invalidateSize();
      if (btn.dataset.tab === "chart") renderCharts();
    });
  });
}

// ── Start ──────────────────────────────────────────────────────────────────

init().catch(err => {
  document.body.innerHTML = `<div style="padding:40px;color:red">
    <strong>Failed to load data.</strong><br>${err.message}<br><br>
    Make sure you are running this via <code>python server.py</code>, not opening the file directly.
  </div>`;
});
