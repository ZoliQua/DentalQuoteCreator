
/**
 * Tooth SVG Test UI (no build tools)
 * - Loads 11.svg, 13.svg, 14.svg templates
 * - Renders a 16+16 dental chart
 * - Click a tooth -> control layers with v1.2-like rules
 */

const MANIFEST = window.Manifest || window.manifest || null; // if present as global (optional)

// ---------- chart mapping (per your instruction) ----------
const TOOTH_MAP = [
  // Upper row: 18..11, 21..28
  { n:18, t:"14", rot:false },{ n:17, t:"14", rot:false },{ n:16, t:"14", rot:false },{ n:15, t:"14", rot:false },
  { n:14, t:"14", rot:false },{ n:13, t:"13", rot:false },{ n:12, t:"11", rot:false },{ n:11, t:"11", rot:false },
  { n:21, t:"11", rot:false },{ n:22, t:"11", rot:false },{ n:23, t:"13", rot:false },{ n:24, t:"14", rot:false },
  { n:25, t:"14", rot:false },{ n:26, t:"14", rot:false },{ n:27, t:"14", rot:false },{ n:28, t:"14", rot:false },

  // Lower row: 38..31, 41..48 (rotated 180)
  { n:38, t:"14", rot:true },{ n:37, t:"14", rot:true },{ n:36, t:"14", rot:true },{ n:35, t:"14", rot:true },
  { n:34, t:"14", rot:true },{ n:33, t:"13", rot:true },{ n:32, t:"11", rot:true },{ n:31, t:"11", rot:true },
  { n:41, t:"11", rot:true },{ n:42, t:"11", rot:true },{ n:43, t:"13", rot:true },{ n:44, t:"14", rot:true },
  { n:45, t:"14", rot:true },{ n:46, t:"14", rot:true },{ n:47, t:"14", rot:true },{ n:48, t:"14", rot:true },
];

const TEMPLATE_CACHE = new Map(); // t -> svgText

// ---------- helpers ----------
function $(sel, root=document) { return root.querySelector(sel); }
function $all(sel, root=document) { return Array.from(root.querySelectorAll(sel)); }

function cloneSvgFromText(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  return doc.documentElement;
}

function stripDisplayFromStyle(styleStr) {
  // remove display: none or display:none; from inline style; keep other styles
  if (!styleStr) return "";
  const parts = styleStr.split(";").map(s => s.trim()).filter(Boolean);
  const kept = parts.filter(p => !/^display\s*:/i.test(p));
  return kept.join("; ") + (kept.length ? ";" : "");
}

function normalizeSvg(svgEl) {
  // 1) Ensure there is a global rule inside the SVG (if missing)
  // Your SVG already includes: [data-active="0"] { display: none; }
  // We'll add it if not found.
  const hasRule = svgEl.querySelector("style")?.textContent?.includes('[data-active="0"]');
  if (!hasRule) {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = '[data-active="0"] { display: none; }';
    svgEl.insertBefore(style, svgEl.firstChild);
  }

  // 2) Convert inline style display:none -> data-active="0" and remove display from style
  const nodesWithStyle = $all("[style]", svgEl);
  for (const el of nodesWithStyle) {
    const style = el.getAttribute("style") || "";
    const hasDisplayNone = /display\s*:\s*none/i.test(style);
    if (hasDisplayNone) {
      if (!el.hasAttribute("data-active")) el.setAttribute("data-active", "0");
      const cleaned = stripDisplayFromStyle(style);
      if (cleaned) el.setAttribute("style", cleaned);
      else el.removeAttribute("style");
    }
  }

  // 3) Default data-active="1" for all toggleable ids that lack it (DOM uniformity)
  const roots = ["mods","tooth-variants","endos","surfaces","restorations","tooth"];
  for (const rootId of roots) {
    const root = svgEl.querySelector(`#${CSS.escape(rootId)}`);
    if (!root) continue;
    const withId = $all("[id]", root);
    for (const el of withId) {
      if (!el.hasAttribute("data-active")) el.setAttribute("data-active", "1");
    }
  }

  // Base always ON (but still normalize ids under base)
  const base = svgEl.querySelector("#base");
  if (base) {
    for (const el of $all("[id]", base)) {
      if (!el.hasAttribute("data-active")) el.setAttribute("data-active", "1");
      el.setAttribute("data-active", "1");
    }
  }
}

function setActive(svgEl, id, on) {
  if (!id) return;
  const el = svgEl.querySelector(`#${CSS.escape(id)}`);
  if (!el) return;
  el.setAttribute("data-active", on ? "1" : "0");
}

function isActive(svgEl, id) {
  const el = svgEl.querySelector(`#${CSS.escape(id)}`);
  if (!el) return false;
  return (el.getAttribute("data-active") ?? "1") === "1";
}

function listActiveIds(svgEl) {
  const nodes = $all('[id][data-active="1"]', svgEl);
  return nodes.map(n => n.id);
}

// ---------- state model ----------
function defaultState() {
  return {
    toothBody: true,          // tooth-base + pulp visible
    pulpMode: "healthy",      // healthy | inflam
    toothVariant: "none",     // id or none
    mods: { inflammation:false, parodontal:false },
    endoMode: "none",         // none | endo | glass | metal
    caries: { subcrown:false, buccal:false, mesial:false, distal:false, occlusal:false },
    fillMaterial: "none",     // none | amalgam | composite
    fillSurfaces: { buccal:false, mesial:false, distal:false, occlusal:false },
    restMain: "none",         // none | implant | prosthesis | telescope
    crownMat: "none",         // none | zircon | metal | temporary
  };
}

// ids (from your SVGs)
const IDS = {
  toothBase: "tooth-base",
  pulpHealthy: "tooth-healthy-pulp",
  pulpInflamGroup: "tooth-inflam-pulp", // group <g>
  toothVariants: [
    "tooth-broken-inicisal",
    "tooth-broken-distal-inicisal",
    "tooth-broken-distal",
    "tooth-broken-mesial-inicisal",
    "tooth-broken-mesial",
    "tooth-crownprep",
  ],
  mods: [
    { key:"inflammation", id:"inflammation" },
    { key:"parodontal", id:"parodontal" },
  ],
  endo: {
    filling:"endo-filling",
    glass:"endo-glass-pin",
    metal:"endo-metal-pin",
  },
  caries: {
    subcrown:"caries-subcrown",
    buccal:"caries-buccal",
    mesial:"caries-mesial",
    distal:"caries-distal",
    occlusal:"caries-occlusal",
  },
  fillings: {
    amalgam: {
      buccal:"filling-amalgam-buccal",
      mesial:"filling-amalgam-mesial",
      distal:"filling-amalgam-distal",
      occlusal:"filling-amalgam-occlusal",
    },
    composite: {
      buccal:"filling-composite-buccal",
      mesial:"filling-composite-mesial",
      distal:"filling-composite-distal",
      occlusal:"filling-composite-occlusal",
    },
  },
  restorations: {
    implant:"implant",
    prosthesis:"prosthesis",
    telescope:"telescope",
    crown: { zircon:"zircon", metal:"metal", temporary:"temporary" }, // groups
  }
};

function applyRules(state) {
  // 1) tooth variant exclusivity
  if (state.toothVariant !== "none") {
    state.toothBody = false; // rule: variant ON -> tooth-base OFF (body toggle)
  }

  // 2) endo pins imply endo
  if (state.endoMode === "glass" || state.endoMode === "metal") {
    // ok, endo implied
  }

  // 3) restorations exclusivity
  if (state.restMain === "prosthesis" || state.restMain === "telescope") {
    state.crownMat = "none"; // forced OFF
  }

  // crownMat only makes sense with implant
  if (state.restMain !== "implant") {
    state.crownMat = "none";
  }

  // 4) caries restrictions with restorations
  const hasRest = (state.restMain !== "none");
  if (hasRest) {
    // keep subcrown allowed; other surfaces forced off
    state.caries.buccal = false;
    state.caries.mesial = false;
    state.caries.distal = false;
    state.caries.occlusal = false;
  } else {
    // ok
  }

  // 5) caries vs filling conflict on same surface
  const surfaces = ["buccal","mesial","distal","occlusal"];
  for (const s of surfaces) {
    const fillingOn = (state.fillMaterial !== "none") && !!state.fillSurfaces[s];
    if (fillingOn && state.caries[s]) state.caries[s] = false;
  }

  return state;
}

function applyStateToSvg(svgEl, state, debug=false) {
  state = applyRules(structuredClone(state));

  // Tooth body
  setActive(svgEl, IDS.toothBase, state.toothBody);
  // Tooth variants (exclusive)
  for (const vid of IDS.toothVariants) {
    setActive(svgEl, vid, state.toothVariant === vid);
  }

  // Pulp logic
  const showPulp = state.toothBody || (state.toothVariant !== "none");
  setActive(svgEl, IDS.pulpHealthy, showPulp && state.pulpMode === "healthy");
  setActive(svgEl, IDS.pulpInflamGroup, showPulp && state.pulpMode === "inflam");

  // Mods
  for (const m of IDS.mods) setActive(svgEl, m.id, !!state.mods[m.key]);

  // Endo
  const endoOn = state.endoMode !== "none";
  setActive(svgEl, IDS.endo.filling, endoOn);
  setActive(svgEl, IDS.endo.glass, state.endoMode === "glass");
  setActive(svgEl, IDS.endo.metal, state.endoMode === "metal");

  // Restorations main
  setActive(svgEl, IDS.restorations.implant, state.restMain === "implant");
  setActive(svgEl, IDS.restorations.prosthesis, state.restMain === "prosthesis");
  setActive(svgEl, IDS.restorations.telescope, state.restMain === "telescope");

  // Crown material (implant only)
  setActive(svgEl, IDS.restorations.crown.zircon, state.restMain === "implant" && state.crownMat === "zircon");
  setActive(svgEl, IDS.restorations.crown.metal, state.restMain === "implant" && state.crownMat === "metal");
  setActive(svgEl, IDS.restorations.crown.temporary, state.restMain === "implant" && state.crownMat === "temporary");

  // Caries
  const hasRest = (state.restMain !== "none");
  setActive(svgEl, IDS.caries.subcrown, !!state.caries.subcrown); // allowed always
  setActive(svgEl, IDS.caries.buccal, !hasRest && !!state.caries.buccal);
  setActive(svgEl, IDS.caries.mesial, !hasRest && !!state.caries.mesial);
  setActive(svgEl, IDS.caries.distal, !hasRest && !!state.caries.distal);
  setActive(svgEl, IDS.caries.occlusal, !hasRest && !!state.caries.occlusal);

  // Fillings: material selection + surfaces
  // turn everything off first
  for (const mat of ["amalgam","composite"]) {
    for (const s of ["buccal","mesial","distal","occlusal"]) {
      setActive(svgEl, IDS.fillings[mat][s], false);
    }
  }
  if (state.fillMaterial !== "none") {
    for (const s of ["buccal","mesial","distal","occlusal"]) {
      const on = !!state.fillSurfaces[s];
      setActive(svgEl, IDS.fillings[state.fillMaterial][s], on);
    }
  }

  if (debug) {
    console.log("Active IDs:", listActiveIds(svgEl));
  }

  return state; // normalized state after rules
}

// ---------- UI / App ----------
const toothNodes = new Map(); // toothNumber -> {card, svgEl, state}
let selectedTooth = null;

async function loadTemplate(name) {
  if (TEMPLATE_CACHE.has(name)) return TEMPLATE_CACHE.get(name);
  const res = await fetch(`${name}.svg`, { cache: "no-store" });
  const txt = await res.text();
  TEMPLATE_CACHE.set(name, txt);
  return txt;
}

function makeToothCard(def) {
  const card = document.createElement("div");
  card.className = "toothCard";
  card.dataset.tooth = String(def.n);

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = String(def.n);

  const wrap = document.createElement("div");
  wrap.className = "svgWrap" + (def.rot ? " rot180" : "");
  card.appendChild(label);
  card.appendChild(wrap);

  card.addEventListener("click", () => selectTooth(def.n));
  return { card, wrap };
}

async function renderChart() {
  const upper = $("#rowUpper");
  const lower = $("#rowLower");

  for (const def of TOOTH_MAP) {
    const { card, wrap } = makeToothCard(def);
    (def.n <= 28 ? upper : lower).appendChild(card);

    const svgText = await loadTemplate(def.t);
    const svgEl = cloneSvgFromText(svgText);

    // make ids unique per tooth (so CSS.escape selectors stay correct)
    // We'll keep original ids inside the svg; but to avoid collisions in DOM, we wrap each svg in its own shadow-ish area.
    // Since we select within svgEl only, collisions are fine. Still, unique root id helps debug.
    svgEl.setAttribute("data-tooth", String(def.n));
    svgEl.setAttribute("aria-label", `tooth-${def.n}`);

    normalizeSvg(svgEl);

    wrap.appendChild(svgEl);

    const state = defaultState();
    const applied = applyStateToSvg(svgEl, state, false);

    toothNodes.set(def.n, { card, svgEl, state: applied });
  }

  // select first tooth by default
  selectTooth(11);
}

function selectTooth(n) {
  if (!toothNodes.has(n)) return;
  if (selectedTooth !== null && toothNodes.has(selectedTooth)) {
    toothNodes.get(selectedTooth).card.classList.remove("selected");
  }
  selectedTooth = n;
  const t = toothNodes.get(n);
  t.card.classList.add("selected");

  $("#panelTitle").textContent = `Fog: ${n}`;
  syncPanelFromState(t.state);
  refreshDisableHints();
}

function current() {
  if (selectedTooth === null) return null;
  return toothNodes.get(selectedTooth) || null;
}

function updateCurrentState(mutator) {
  const cur = current();
  if (!cur) return;
  const next = structuredClone(cur.state);
  mutator(next);
  const debug = $("#chkShowIds").checked;
  const applied = applyStateToSvg(cur.svgEl, next, debug);
  cur.state = applied;
  syncPanelFromState(cur.state);
  refreshDisableHints();
}

function syncPanelFromState(state) {
  $("#chkToothBody").checked = !!state.toothBody;

  $("#radPulpHealthy").checked = state.pulpMode === "healthy";
  $("#radPulpInflam").checked = state.pulpMode === "inflam";

  $("#selVariant").value = state.toothVariant;

  // mods
  for (const m of IDS.mods) {
    const el = $(`#modsBox input[data-key="${m.key}"]`);
    if (el) el.checked = !!state.mods[m.key];
  }

  // endo
  const endo = $all('input[name="endoMode"]');
  for (const r of endo) r.checked = (r.value === state.endoMode);

  // caries
  for (const k of Object.keys(state.caries)) {
    const el = $(`#cariesBox input[data-key="${k}"]`);
    if (el) el.checked = !!state.caries[k];
  }

  // filling
  for (const r of $all('input[name="fillMaterial"]')) r.checked = (r.value === state.fillMaterial);
  for (const k of Object.keys(state.fillSurfaces)) {
    const el = $(`#fillSurfBox input[data-key="${k}"]`);
    if (el) el.checked = !!state.fillSurfaces[k];
  }

  // restorations
  for (const r of $all('input[name="restMain"]')) r.checked = (r.value === state.restMain);
  for (const r of $all('input[name="crownMat"]')) r.checked = (r.value === state.crownMat);
}

function refreshDisableHints() {
  const cur = current();
  if (!cur) return;

  // caries disable when restorations on (except subcrown)
  const hasRest = cur.state.restMain !== "none";
  const cariesInputs = $all("#cariesBox input");
  for (const inp of cariesInputs) {
    const k = inp.dataset.key;
    if (k === "subcrown") {
      inp.disabled = false;
    } else {
      inp.disabled = hasRest;
    }
  }
  $("#cariesHint").textContent = hasRest ? "Restoráció mellett a buccal/mesial/distal/occlusal caries letiltva (subcrown maradhat)." : "";

  // crown material only with implant
  const isImplant = cur.state.restMain === "implant";
  const crownInputs = $all('input[name="crownMat"]');
  for (const inp of crownInputs) inp.disabled = !isImplant;

  $("#restHint").textContent = !isImplant ? "Crown material csak implant mellett aktív." : "";
}

// ---------- build control UI dynamically ----------
function initControls() {
  // populate variants
  const sel = $("#selVariant");
  for (const vid of IDS.toothVariants) {
    const opt = document.createElement("option");
    opt.value = vid;
    opt.textContent = vid;
    sel.appendChild(opt);
  }

  // mods checkboxes
  const modsBox = $("#modsBox");
  for (const m of IDS.mods) {
    const lab = document.createElement("label");
    lab.innerHTML = `<input type="checkbox" data-key="${m.key}"> ${m.id}`;
    modsBox.appendChild(lab);
  }

  // caries
  const cariesBox = $("#cariesBox");
  const cariesOrder = ["subcrown","buccal","mesial","distal","occlusal"];
  for (const k of cariesOrder) {
    const lab = document.createElement("label");
    lab.innerHTML = `<input type="checkbox" data-key="${k}"> ${k}`;
    cariesBox.appendChild(lab);
  }

  // filling surfaces
  const fillSurfBox = $("#fillSurfBox");
  const fillOrder = ["buccal","mesial","distal","occlusal"];
  for (const k of fillOrder) {
    const lab = document.createElement("label");
    lab.innerHTML = `<input type="checkbox" data-key="${k}"> ${k}`;
    fillSurfBox.appendChild(lab);
  }

  // wire handlers
  $("#chkToothBody").addEventListener("change", (e) => {
    updateCurrentState(s => { s.toothBody = e.target.checked; if (!s.toothBody) s.toothVariant = "none"; });
  });

  $("#radPulpHealthy").addEventListener("change", () => updateCurrentState(s => s.pulpMode = "healthy"));
  $("#radPulpInflam").addEventListener("change", () => updateCurrentState(s => s.pulpMode = "inflam"));

  $("#selVariant").addEventListener("change", (e) => {
    updateCurrentState(s => { s.toothVariant = e.target.value; });
  });

  modsBox.addEventListener("change", (e) => {
    const inp = e.target.closest("input[data-key]");
    if (!inp) return;
    updateCurrentState(s => { s.mods[inp.dataset.key] = inp.checked; });
  });

  for (const r of $all('input[name="endoMode"]')) {
    r.addEventListener("change", () => updateCurrentState(s => { s.endoMode = r.value; }));
  }

  cariesBox.addEventListener("change", (e) => {
    const inp = e.target.closest("input[data-key]");
    if (!inp) return;
    updateCurrentState(s => { s.caries[inp.dataset.key] = inp.checked; });
  });

  for (const r of $all('input[name="fillMaterial"]')) {
    r.addEventListener("change", () => updateCurrentState(s => { s.fillMaterial = r.value; }));
  }
  fillSurfBox.addEventListener("change", (e) => {
    const inp = e.target.closest("input[data-key]");
    if (!inp) return;
    updateCurrentState(s => { s.fillSurfaces[inp.dataset.key] = inp.checked; });
  });

  for (const r of $all('input[name="restMain"]')) {
    r.addEventListener("change", () => updateCurrentState(s => { s.restMain = r.value; }));
  }
  for (const r of $all('input[name="crownMat"]')) {
    r.addEventListener("change", () => updateCurrentState(s => { s.crownMat = r.value; }));
  }

  $("#btnResetTooth").addEventListener("click", () => {
    updateCurrentState(s => Object.assign(s, defaultState()));
  });

  $("#btnClearAll").addEventListener("click", () => {
    updateCurrentState(s => {
      // keep base always on; in our state model base isn't represented
      s.toothBody = false;
      s.toothVariant = "none";
      s.mods = { inflammation:false, parodontal:false };
      s.endoMode = "none";
      s.caries = { subcrown:false, buccal:false, mesial:false, distal:false, occlusal:false };
      s.fillMaterial = "none";
      s.fillSurfaces = { buccal:false, mesial:false, distal:false, occlusal:false };
      s.restMain = "none";
      s.crownMat = "none";
    });
  });
}

// ---------- boot ----------
initControls();
renderChart();
