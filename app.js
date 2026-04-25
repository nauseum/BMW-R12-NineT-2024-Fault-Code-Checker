const CSV_PATH = "data/error_codes.csv";
const AI_PATH = "data/AiAssist.csv";
const ICON_PATH = "data/icons/";
const MANUAL_PDF = "R_0N01_RM_1123_01.pdf";
const PDF_PAGE_OFFSET = 6;

let records = [];
let aiAssist = new Map();
let activeFilter = "all";

const q = document.getElementById("q");
const results = document.getElementById("results");
const statusEl = document.getElementById("status");

load();

q.addEventListener("input", render);

document.querySelectorAll("[data-filter]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    render();
  });
});

async function load() {
  try {
    const res = await fetch(CSV_PATH);
    if (!res.ok) throw new Error(`Could not load ${CSV_PATH}`);
    const text = await res.text();
    records = parseCSV(text);

    try {
      const aiRes = await fetch(AI_PATH);
      if (aiRes.ok) {
        const aiText = await aiRes.text();
        parseCSV(aiText).forEach(row => aiAssist.set(row.code, row));
      }
    } catch (e) {
      console.warn("AI assist file not loaded", e);
    }

    statusEl.textContent = `Loaded ${records.length} records from ${CSV_PATH}`;
    render();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Could not load data/error_codes.csv. Run this through a local server.";
    results.innerHTML = `<div class="empty">Open this folder with: <strong>python -m http.server 8000</strong></div>`;
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (quoted) {
      if (c === '"' && n === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else {
      if (c === '"') quoted = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c !== "\r") cell += c;
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }

  const headers = rows.shift();
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] || ""])));
}

function render() {
  const term = q.value.trim().toLowerCase();

  let filtered = records.filter(r => {
    const matchesFilter = activeFilter === "all" || r.severity === activeFilter;
    const haystack = Object.values(r).join(" ").toLowerCase();
    return matchesFilter && (!term || haystack.includes(term));
  });

  statusEl.textContent = `${filtered.length} result${filtered.length === 1 ? "" : "s"} shown`;

  if (!filtered.length) {
    results.innerHTML = `<div class="empty">No matching error code found.</div>`;
    return;
  }

  results.innerHTML = filtered.map(card).join("");

  document.querySelectorAll(".ai-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const box = document.getElementById(btn.dataset.target);
      if (!box) return;
      const isOpen = box.hidden === false;
      box.hidden = isOpen;
      btn.textContent = isOpen ? "More Info" : "Hide More Info";
    });
  });
}

function card(r) {
  const codeList = r.codes.split(";");
  const codes = codeList.map(c => `<span class="code">${esc(c)}</span>`).join("");
  const icon = r.icon ? `<img class="icon" src="${ICON_PATH + esc(r.icon)}" alt="">` : `<div></div>`;
  const aiRows = codeList.map(c => aiAssist.get(c)).filter(Boolean);
  const id = "ai-" + codeList.join("-").replace(/[^A-Za-z0-9_-]/g, "");
  const aiBlock = aiRows.length ? `
    <div class="ai-actions">
      <button class="ai-btn" type="button" data-target="${id}">More Info</button>
    </div>
    <div class="ai-box" id="${id}" hidden>
      ${aiRows.map(ai => `
        <div class="ai-item">
          <div class="label">${esc(ai.code)} research notes</div>
          <p class="txt">${esc(ai.ai_research)}</p>
          <p class="sources"><strong>Sources:</strong> ${linkSources(ai.sources)}</p>
        </div>
      `).join("")}
    </div>` : "";

  return `<article class="card ${esc(r.severity)}">
    <div class="head">
      ${icon}
      <div>
        <div class="codes">${codes}</div>
        <h2 class="title">${esc(r.meaning)}</h2>
        <p class="display">${esc(r.display_text)}</p>
      </div>
      <a class="page" href="${MANUAL_PDF}#page=${encodeURIComponent(pdfPage(r.manual_page))}" target="_blank" rel="noopener">Manual page ${esc(r.manual_page)}</a>
    </div>
    <div class="content">
      <div>
        <div class="label">Possible cause</div>
        <p class="txt">${esc(r.possible_cause)}</p>
      </div>
      <div>
        <div class="label">Recommended action</div>
        <p class="txt">${esc(r.recommended_action)}</p>
      </div>
    </div>
    ${aiBlock}
  </article>`;
}

function linkSources(value) {
  return String(value || "")
    .split("|")
    .map(s => s.trim())
    .filter(Boolean)
    .map(url => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(new URL(url).hostname)}</a>`)
    .join(" · ");
}

function pdfPage(manualPage) {
  const page = Number(manualPage);
  return Number.isFinite(page) ? page + PDF_PAGE_OFFSET : manualPage;
}

function esc(v) {
  return String(v).replace(/[&<>"']/g, s => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[s]));
}
