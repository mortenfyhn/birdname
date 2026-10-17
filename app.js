const STORAGE_KEY = "bn-langs";
const DEFAULT_LANGS = ["no", "fr", "en", "sci"];
const SCIENTIFIC = { code: "sci", label: "Scientific", short: "sci" };
const WEIGHTS = {
  exact: 100000, prefix: 10000, suffix: 2000, firstLetterSubseq: 1000,
  substring: 500, subseq: 100, typo: 20, completeness: 0.2,
};

const q = document.querySelector("#q");
const results = document.querySelector("#results");
const settings = document.querySelector("#settings");
const langList = document.querySelector("#langlist");
const clearButton = document.querySelector("#clear");
const languagesButton = document.querySelector("#languages-button");
const searchBox = document.querySelector(".searchbox");

let data;
let enabled;
let aliases = [];
let queryBeforePicker = "";

function loadEnabled() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return new Set(saved.map(code => String(code).toLowerCase() === "la" ? "sci" : String(code).toLowerCase()));
  } catch {}
  return new Set(DEFAULT_LANGS);
}

function saveEnabled() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...enabled])); } catch {}
}

function fold(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tight(text) {
  return fold(text).replace(/[\s-]/g, "");
}

function prepareAliases() {
  aliases = [];
  for (const bird of data.birds) {
    for (const language of data.languages) {
      const name = bird.names[language.code];
      if (name) aliases.push({ bird, code: language.code, name, folded: tight(name) });
    }
    aliases.push({ bird, code: "sci", name: bird.scientific, folded: tight(bird.scientific) });
  }
}

function subsequenceSpan(query, text) {
  let qi = 0, start = -1, end = -1;
  for (let i = 0; i < text.length; i++) {
    if (qi < query.length && text[i] === query[qi]) {
      if (qi === 0) start = i;
      end = i;
      if (++qi === query.length) break;
    }
  }
  return qi === query.length ? end - start + 1 : -1;
}

function osaCapped(a, b, cap) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const d = Array.from({ length: a.length + 1 }, () => new Int16Array(b.length + 1));
  for (let i = 0; i <= a.length; i++) d[i][0] = i;
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, d[i - 2][j - 2] + 1);
      }
      d[i][j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > cap) return cap + 1;
  }
  return d[a.length][b.length] <= cap ? d[a.length][b.length] : cap + 1;
}

function tierAndQuality(query, name) {
  if (name === query) return [WEIGHTS.exact, 1];
  const completeness = (1 - WEIGHTS.completeness) + WEIGHTS.completeness * query.length / name.length;
  if (name.startsWith(query)) return [WEIGHTS.prefix, completeness];
  if (name.endsWith(query)) return [WEIGHTS.suffix, completeness];
  if (name.includes(query)) return [WEIGHTS.substring, completeness];
  const span = subsequenceSpan(query, name);
  if (span > 0) {
    return [query[0] === name[0] ? WEIGHTS.firstLetterSubseq : WEIGHTS.subseq, query.length / span];
  }
  if (query.length >= 4) {
    const cap = query.length <= 5 ? 1 : 2;
    const distance = Math.min(
      osaCapped(query, name.slice(0, query.length), cap),
      osaCapped(query, name.slice(0, query.length + cap), cap),
    );
    if (distance <= cap) return [WEIGHTS.typo, 1 - distance / query.length];
  }
  return null;
}

function rank(query) {
  const foldedQuery = tight(query);
  if (!foldedQuery) return [];
  const bestBySpecies = new Map();
  for (const candidate of aliases) {
    if (!enabled.has(candidate.code)) continue;
    const tier = tierAndQuality(foldedQuery, candidate.folded);
    if (!tier) continue;
    const score = tier[0] * tier[1];
    const previous = bestBySpecies.get(candidate.bird.scientific);
    if (!previous || score > previous.score) bestBySpecies.set(candidate.bird.scientific, { ...candidate, score });
  }
  return [...bestBySpecies.values()].sort((a, b) => b.score - a.score || a.bird.scientific.localeCompare(b.bird.scientific));
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function markedName(name, query) {
  const foldedQuery = tight(query);
  let folded = "";
  const positions = [];
  let offset = 0;
  for (const character of name) {
    const end = offset + character.length;
    for (const part of character.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
      if (!/[\s-]/.test(part)) {
        folded += part;
        positions.push([offset, end]);
      }
    }
    offset = end;
  }
  const index = folded.indexOf(foldedQuery);
  if (index < 0) return escapeHtml(name);
  const start = positions[index][0];
  const end = positions[index + foldedQuery.length - 1][1];
  return `${escapeHtml(name.slice(0, start))}<mark>${escapeHtml(name.slice(start, end))}</mark>${escapeHtml(name.slice(end))}`;
}

function updateClearButton() {
  clearButton.classList.toggle("show", q.value.length > 0);
}

function renderResults() {
  if (!q.value.trim()) {
    results.replaceChildren();
    return;
  }
  // Scientific name is pinned above the alphabetical spoken languages.
  const selected = data.languages.filter(language => enabled.has(language.code));
  if (enabled.has("sci")) selected.unshift(SCIENTIFIC);
  const query = q.value;
  const hits = rank(query);
  results.innerHTML = hits.map(hit => {
    const rows = selected.map(language => {
      const name = language.code === "sci" ? hit.bird.scientific : hit.bird.names[language.code];
      if (!name) return "";
      const matched = language.code === hit.code;
      const label = matched
        ? `<span class="matched">${markedName(name, query)}</span>`
        : escapeHtml(name);
      const scientific = language.code === "sci" ? " scientific" : "";
      return `<div class="row${scientific}"><span class="lang"><span>${language.short}</span></span><span class="name">${label}</span></div>`;
    }).join("");
    return `<article class="bird"><div class="bird-inner">${rows}</div></article>`;
  }).join("");
  if (!hits.length) results.innerHTML = '<p class="hint">No matches.</p>';
}

function renderLanguages() {
  const languages = [SCIENTIFIC, ...data.languages];
  langList.innerHTML = languages.map(language => `
    <li data-code="${language.code}">
      <input type="checkbox" ${enabled.has(language.code) ? "checked" : ""} tabindex="-1" aria-hidden="true">
      <span class="label">${escapeHtml(language.label)}</span>
    </li>`).join("");
  langList.querySelectorAll("li[data-code]").forEach(row => {
    row.addEventListener("click", () => {
      const code = row.dataset.code;
      enabled.has(code) ? enabled.delete(code) : enabled.add(code);
      saveEnabled();
      renderLanguages();
    });
  });
}

function setLanguagesOpen(open) {
  const wasOpen = settings.classList.contains("open");
  if (open === wasOpen) return;
  if (open) {
    queryBeforePicker = q.value;
  } else {
    q.value = queryBeforePicker;
    queryBeforePicker = "";
  }
  updateClearButton();
  q.disabled = open;
  searchBox.classList.toggle("picker-mode", open);
  settings.classList.toggle("open", open);
  results.hidden = open;
  languagesButton.setAttribute("aria-pressed", String(open));
  q.setAttribute("aria-label", open ? "Search bird names (language list open)" : "Search bird names");
  if (!open) renderResults();
}

languagesButton.addEventListener("click", () => setLanguagesOpen(!settings.classList.contains("open")));
// Tap the greyed-out field to leave the picker and type right away; the saved
// query comes back selected so typing overwrites it.
searchBox.addEventListener("pointerdown", event => {
  if (!settings.classList.contains("open")) return;
  event.preventDefault();
  setLanguagesOpen(false);
  q.focus();
  q.select();
});
q.addEventListener("input", () => { updateClearButton(); renderResults(); });
clearButton.addEventListener("click", () => {
  q.value = "";
  updateClearButton();
  renderResults();
  q.focus();
});

async function start() {
  const response = await fetch("data/birds.json");
  if (!response.ok) throw new Error(`Could not load bird data (${response.status})`);
  data = await response.json();
  enabled = loadEnabled();
  prepareAliases();
  renderLanguages();
  updateClearButton();
  renderResults();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  // First visit: open the picker so the app starts usable.
  let firstRun = false;
  try { firstRun = !localStorage.getItem(STORAGE_KEY); } catch {}
  if (firstRun) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...enabled])); } catch {}
    setLanguagesOpen(true);
  }
}

start().catch(error => {
  console.error(error);
  results.innerHTML = '<p class="hint">Bird data could not be loaded. Open this app through a local web server or hosted site.</p>';
});
