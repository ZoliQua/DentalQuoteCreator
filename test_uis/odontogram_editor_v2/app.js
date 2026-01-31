/* Tooth SVG Test UI (v2) - vanilla JS */

const TEMPLATES = {
  11: "./svgs/11.svg",
  13: "./svgs/13.svg",
  14: "./svgs/14.svg",
  16: "./svgs/16.svg",
};

// Tooth mapping in details:
// 11: 11,12 -> no rotate, no mirror; 21,22 -> no rotate, mirror Y
//     31,32 -> rotate 180; 41,42 -> rotate 180 + mirror Y
// 13: 13 -> no rotate; 23 -> mirror Y; 33 -> rotate 180; 43 -> rotate 180 + mirror Y
// 14: 14,15 -> no rotate; 24,25 -> mirror Y; 34,35 -> rotate 180; 44,45 -> rotate 180 + mirror Y
// 16: 16,17,18 -> no rotate; 26,27,28 -> mirror Y; 36,37,38 -> rotate 180; 46,47,48 -> rotate 180 + mirror Y
const TOOTH_TEMPLATE = new Map([
  // 11 template
  [11, {tpl:11, rot:0, mirror:false}], [12,{tpl:11,rot:0,mirror:false}],
  [21,{tpl:11,rot:0,mirror:true}], [22,{tpl:11,rot:0,mirror:true}],
  [31, {tpl:11, rot:180, mirror:false}], [32,{tpl:11,rot:180,mirror:false}],
  [41,{tpl:11,rot:180,mirror:true}], [42,{tpl:11,rot:180,mirror:true}],
  // 13 template
  [13,{tpl:13,rot:0,mirror:false}],
  [23,{tpl:13,rot:0,mirror:true}],
  [33,{tpl:13,rot:180,mirror:false}],
  [43,{tpl:13,rot:180,mirror:true}],
  // 14 template
  [14,{tpl:14,rot:0,mirror:false}],[15,{tpl:14,rot:0,mirror:false}],
  [24,{tpl:14,rot:0,mirror:true}],[25,{tpl:14,rot:0,mirror:true}],
  [34,{tpl:14,rot:180,mirror:false}],[35,{tpl:14,rot:180,mirror:false}],
  [44,{tpl:14,rot:180,mirror:true}],[45,{tpl:14,rot:180,mirror:true}],
  // 16 template
  [16,{tpl:16,rot:0,mirror:false}],[17,{tpl:16,rot:0,mirror:false}],[18,{tpl:16,rot:0,mirror:false}],
  [26,{tpl:16,rot:0,mirror:true}],[27,{tpl:16,rot:0,mirror:true}],[28,{tpl:16,rot:0,mirror:true}],
  [36,{tpl:16,rot:180,mirror:false}],[37,{tpl:16,rot:180,mirror:false}],[38,{tpl:16,rot:180,mirror:false}],
  [46,{tpl:16,rot:180,mirror:true}],[47,{tpl:16,rot:180,mirror:true}],[48,{tpl:16,rot:180,mirror:true}],
]);

const ALL_TEETH = [
  18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,
  48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38
];

const GROUPS = {
  variants: [
    "tooth-broken-inicisal",
    "tooth-broken-distal-inicisal",
    "tooth-broken-distal",
    "tooth-broken-mesial-inicisal",
    "tooth-broken-mesial",
    "tooth-crownprep",
  ],
  mods: ["inflammation", "parodontal"],
  endo: ["endo-filling", "endo-glass-pin", "endo-metal-pin"],
  caries: ["caries-subcrown","caries-buccal","caries-mesial","caries-distal","caries-occlusal"],
  fillingSurfaces: ["buccal","mesial","distal","occlusal"],
  crownMaterial: ["zircon","metal","temporary","telescope"],
};

function defaultState(){
  return {
    toothSelection: "tooth-base", // none | tooth-base | implant | variants
    pulpInflam: false,
    mods: new Set(),
    endo: "none", // none | endo-filling | endo-glass-pin | endo-metal-pin
    caries: new Set(),
    fillingMaterial: "none", // none | amalgam | composite
    fillingSurfaces: new Set(), // buccal/mesial/distal/occlusal
    removable: "none", // none | prosthesis
    crownMaterial: "natural",   // natural | zircon | metal | temporary | telescope
  };
}

// ---- DOM helpers ----
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

function el(tag, attrs={}, children=[]){
  const n=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){
    if(k==="class") n.className=v;
    else if(k==="html") n.innerHTML=v;
    else if(k.startsWith("on") && typeof v==="function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k,v);
  }
  for(const c of children) n.appendChild(c);
  return n;
}

function setActive(node, on){
  if(!node) return;
  node.setAttribute("data-active", on ? "1":"0");
}

function stripDisplayNoneToDataActive(root){
  // Convert inline style display:none -> data-active=0, and remove display property from style.
  const nodes = $$("[id]", root);
  for(const n of nodes){
    const style = n.getAttribute("style");
    if(style && /display\s*:\s*none/i.test(style)){
      n.setAttribute("data-active","0");
      // remove display: none; (and possible surrounding semicolons/spaces)
      const newStyle = style
        .replace(/display\s*:\s*none\s*;?/ig, "")
        .replace(/;;+/g,";")
        .trim();
      if(newStyle) n.setAttribute("style", newStyle);
      else n.removeAttribute("style");
    }
  }
}

function ensureDataActiveForSwitchables(root){
  // Every element that is inside these switchable groups and has an id should get data-active (default 0 if missing)
  const switchableGroups = ["mods","tooth-variants","endos","surfaces","restorations"];
  for(const gId of switchableGroups){
    const g = root.getElementById ? root.getElementById(gId) : $("#"+gId, root);
    if(!g) continue;
    for(const n of $$("[id]", g)){
      if(!n.hasAttribute("data-active")) n.setAttribute("data-active","0");
    }
  }
  // Tooth base + pulps should also be consistent
  for(const id of ["tooth-base","tooth-healthy-pulp","tooth-inflam-pulp"]){
    const n = $("#"+id, root);
    if(n && !n.hasAttribute("data-active")) n.setAttribute("data-active","0");
  }
}

function rotate180(svgRoot){
  // rotate around center using a wrapper group
  const vb = svgRoot.getAttribute("viewBox") || "0 0 32 64";
  const parts = vb.trim().split(/\s+/).map(Number);
  const cx = parts[0] + parts[2]/2;
  const cy = parts[1] + parts[3]/2;
  // wrap existing content into a new group
  const g = document.createElementNS("http://www.w3.org/2000/svg","g");
  while(svgRoot.firstChild){
    g.appendChild(svgRoot.firstChild);
  }
  g.setAttribute("transform", `rotate(180 ${cx} ${cy})`);
  svgRoot.appendChild(g);
}

function mirrorVertical(svgRoot){
  // mirror vertically (left-right) around center using a wrapper group
  const vb = svgRoot.getAttribute("viewBox") || "0 0 32 64";
  const parts = vb.trim().split(/\s+/).map(Number);
  const cx = parts[0] + parts[2]/2;
  const g = document.createElementNS("http://www.w3.org/2000/svg","g");
  while(svgRoot.firstChild){
    g.appendChild(svgRoot.firstChild);
  }
  g.setAttribute("transform", `scale(-1 1) translate(${-2*cx} 0)`);
  svgRoot.appendChild(g);
}

function svgGetById(root, id){
  return root.getElementById ? root.getElementById(id) : $("#"+id, root);
}

function setManyActive(root, ids, on){
  for(const id of ids){
    setActive(svgGetById(root,id), on);
  }
}

function clearAllInGroup(root, ids){
  setManyActive(root, ids, false);
}

// ---- App state ----
const toothState = new Map(); // toothNo -> state
const toothSvgRoot = new Map(); // toothNo -> svg element (inline)
const toothTile = new Map(); // toothNo -> tile element
let activeTooth = null;
let selectedTeeth = new Set();
let edentulous = false;
let wisdomMissing = false;
let showBase = true;
let suppressEdentulousSync = false;

// ---- UI builders ----
function buildRadios(container, name, options, onChange){
  container.innerHTML = "";
  for(const opt of options){
    const id = `${name}-${opt.value}`;
    const label = el("label", {}, [
      el("input", { type:"radio", name, id, value:opt.value }),
      el("span", { html: opt.label })
    ]);
    label.querySelector("input").addEventListener("change", (e)=>onChange(e.target.value));
    container.appendChild(label);
  }
}

function buildChecks(container, items, onToggle){
  container.innerHTML = "";
  for(const it of items){
    const id = `chk-${it.value}`;
    const labelId = `lbl-${it.value}`;
    const label = el("label", {}, [
      el("input", { type:"checkbox", id, value:it.value }),
      el("span", { id: labelId, html: it.label })
    ]);
    label.querySelector("input").addEventListener("change", (e)=>onToggle(it.value, e.target.checked));
    container.appendChild(label);
  }
}

function buildSelect(selectEl, options, onChange){
  selectEl.innerHTML = "";
  for(const opt of options){
    const o = el("option", { value: opt.value, html: opt.label });
    selectEl.appendChild(o);
  }
  selectEl.addEventListener("change", (e)=>onChange(e.target.value));
}

function updateWarnings(state){
  const w = $("#warnings");
  if(!w) return;
  w.innerHTML = "";
}

function setToggleButton(btn, on){
  btn.setAttribute("aria-pressed", on ? "true" : "false");
}

function isToothPresent(sel){
  return sel !== "none" && sel !== "implant";
}

// ---- SVG apply logic ----
function applyStateToSvg(toothNo){
  const state = toothState.get(toothNo);
  const svg = toothSvgRoot.get(toothNo);
  if(!state || !svg) return;

  // 0) Start from a clean baseline: turn OFF all switchables, then apply ON flags.
  // (Base stays as in SVG; we don't toggle #base)
  const switchable = ["mods","tooth-variants","endos","surfaces","restorations","tooth"];
  for(const gId of switchable){
    const g = svgGetById(svg, gId);
    if(!g) continue;
    // Keep group itself active; we toggle children by id
    // But for simplicity, if group has data-active, keep at 1 so children can show.
    if(g.hasAttribute("data-active")) g.setAttribute("data-active","1");
  }

  // Turn OFF all known items
  setActive(svgGetById(svg, "tooth-base"), false);
  setActive(svgGetById(svg, "tooth-healthy-pulp"), false);
  setActive(svgGetById(svg, "tooth-inflam-pulp"), false);
  clearAllInGroup(svg, GROUPS.variants);
  clearAllInGroup(svg, GROUPS.mods);
  clearAllInGroup(svg, GROUPS.endo);
  // Caries: subcrown and surface groups
  // caries-distal etc are groups, buccal/subcrown are paths
  for(const id of ["caries-subcrown","caries-buccal","caries-distal","caries-mesial","caries-occlusal"]){
    setActive(svgGetById(svg,id), false);
  }
  // Fillings
  for(const mat of ["amalgam","composite"]){
    for(const s of GROUPS.fillingSurfaces){
      setActive(svgGetById(svg, `filling-${mat}-${s}`), false);
    }
  }
  // Restorations
  for(const id of ["implant","prosthesis","telescope","zircon","metal","temporary","crown-zircon","crown-metal","crown-temporary","crown-telescope-inside","crown-telescope-outside"]){
    setActive(svgGetById(svg,id), false);
  }

  const hasCrown = state.crownMaterial !== "natural";
  const hasRemovable = state.toothSelection === "none" && state.removable !== "none";
  const hasRestoration = hasCrown || hasRemovable;

  // base visibility toggle
  setActive(svgGetById(svg, "base"), showBase);

  // 1) Tooth selection
  if(state.toothSelection === "implant"){
    setActive(svgGetById(svg, "implant"), true);
  }else if(isToothPresent(state.toothSelection)){
    if(state.toothSelection === "tooth-base"){
      setActive(svgGetById(svg, "tooth-base"), true);
    }else{
      setActive(svgGetById(svg, state.toothSelection), true);
    }
    // Pulpa: show when tooth is present
    setActive(svgGetById(svg, state.pulpInflam ? "tooth-inflam-pulp" : "tooth-healthy-pulp"), true);
  }

  // 2) Mods
  for(const id of state.mods){
    setActive(svgGetById(svg, id), true);
  }

  // 3) Endo exclusivity (only if tooth present)
  if(isToothPresent(state.toothSelection)){
    if(state.endo === "endo-filling"){
      setActive(svgGetById(svg, "endo-filling"), true);
    } else if(state.endo === "endo-glass-pin"){
      setActive(svgGetById(svg, "endo-filling"), true);
      setActive(svgGetById(svg, "endo-glass-pin"), true);
    } else if(state.endo === "endo-metal-pin"){
      setActive(svgGetById(svg, "endo-filling"), true);
      setActive(svgGetById(svg, "endo-metal-pin"), true);
    }
  }

  // 4) Removable prosthesis
  if(hasRemovable && state.removable === "prosthesis"){
    setActive(svgGetById(svg, "prosthesis"), true);
  }

  // crown materials (zircon/metal/temporary/telescope)
  if(hasCrown){
    setActive(svgGetById(svg, state.crownMaterial), true);
    if(state.crownMaterial === "zircon"){
      setActive(svgGetById(svg, "crown-zircon"), true);
    } else if(state.crownMaterial === "metal"){
      setActive(svgGetById(svg, "crown-metal"), true);
    } else if(state.crownMaterial === "temporary"){
      setActive(svgGetById(svg, "crown-temporary"), true);
    } else if(state.crownMaterial === "telescope"){
      setActive(svgGetById(svg, "crown-telescope-inside"), true);
      setActive(svgGetById(svg, "crown-telescope-outside"), true);
    }
  }

  // 5) Surfaces
  // Caries: if any restoration active => disable surface caries (except subcrown allowed)
  for(const id of state.caries){
    if(id === "caries-subcrown"){
      if(hasCrown){
        setActive(svgGetById(svg, "caries-subcrown"), true);
      }
      continue;
    }
    if(hasRestoration || hasCrown) continue;
    // map surface ids to svg ids: buccal is path; others are groups
    setActive(svgGetById(svg, id), true);
  }

  // Fillings: any material with surfaces
  if(state.fillingMaterial !== "none" && !hasCrown){
    for(const s of state.fillingSurfaces){
      setActive(svgGetById(svg, `filling-${state.fillingMaterial}-${s}`), true);
    }
  }

  // 6) Caries vs Filling same surface: if filling ON on surface, caries OFF on that surface
  // (Prefer filling)
  if(state.fillingMaterial !== "none" && !hasRestoration && !hasCrown){
    for(const s of state.fillingSurfaces){
      const cariesId = `caries-${s}`;
      setActive(svgGetById(svg, cariesId), false);
    }
  }

  updateWarnings(state);
}

// ---- Control sync ----
function syncControlsFromState(state){
  $("#pulpInflam").checked = !!state.pulpInflam;

  // tooth selection
  $("#toothSelect").value = state.toothSelection;
  $("#crownSelect").value = state.crownMaterial;
  $("#endoSelect").value = state.endo;
  $("#fillingSelect").value = state.fillingMaterial;
  $("#removableSelect").value = state.removable;

  // mods
  $$("#modsChecks input[type=checkbox]").forEach(c => c.checked = state.mods.has(c.value));

  // caries
  $$("#cariesChecks input[type=checkbox]").forEach(c => c.checked = state.caries.has(c.value));

  // filling surfaces
  $$("#fillingSurfaceChecks input[type=checkbox]").forEach(c => c.checked = state.fillingSurfaces.has(c.value));

  // disable logic in UI
  const hasCrown = state.crownMaterial !== "natural";
  const hasRemovable = state.toothSelection === "none" && state.removable !== "none";
  const hasRestoration = hasCrown || hasRemovable;
  $$("#cariesChecks input[type=checkbox]").forEach(c => {
    if(c.value === "caries-subcrown") c.disabled = !hasCrown;
    else c.disabled = hasRestoration || hasCrown;
  });
  const showFillingSurfaces = state.fillingMaterial !== "none" && !hasCrown;
  $("#fillingSurfaceChecks").classList.toggle("hidden", !showFillingSurfaces);

  // removable section only if tooth base is none
  $("#removableSection").classList.toggle("hidden", state.toothSelection !== "none");

  // endo only if tooth present
  const endoDisabled = !isToothPresent(state.toothSelection);
  $("#endoSelect").disabled = endoDisabled;
  $("#pulpInflam").disabled = endoDisabled;

  const hiddenSelected = selectedTeeth.size > 0 && Array.from(selectedTeeth).some(t => {
    const sel = toothState.get(t)?.toothSelection;
    return sel === "implant" || sel === "none";
  });
  const hideByBase = state.toothSelection === "implant" || state.toothSelection === "none" || hiddenSelected;
  const noneSelected = selectedTeeth.size > 0 && Array.from(selectedTeeth).some(t => toothState.get(t)?.toothSelection === "none");
  const implantSelected = selectedTeeth.size > 0 && Array.from(selectedTeeth).some(t => toothState.get(t)?.toothSelection === "implant");
  const hideByNone = state.toothSelection === "none" || noneSelected;
  $("#cariesSection").classList.toggle("hidden", hideByBase);
  $("#endoSection").classList.toggle("hidden", hideByBase);
  $("#fillingSection").classList.toggle("hidden", hideByBase);
  $("#crownRow").classList.toggle("hidden", hideByNone);
  $("#inflammationSection").classList.toggle("hidden", hideByNone);
  const periImplant = state.toothSelection === "implant" || implantSelected;
  const parodontLabel = $("#lbl-parodontal");
  if(parodontLabel){
    parodontLabel.textContent = periImplant ? "Periimplantitis" : "parodontális gyulladás";
  }
}

// ---- Event handlers ----
function applyAndSync(toothNo){
  applyStateToSvg(toothNo);
  if(toothNo === activeTooth){
    syncControlsFromState(toothState.get(toothNo));
  }
  if(edentulous && !suppressEdentulousSync){
    setEdentulous(false);
  }
}

function applyToSelected(fn){
  if(selectedTeeth.size === 0) return;
  for(const toothNo of selectedTeeth){
    const s = toothState.get(toothNo);
    if(!s) continue;
    fn(s, toothNo);
    applyStateToSvg(toothNo);
  }
  if(activeTooth && selectedTeeth.has(activeTooth)){
    syncControlsFromState(toothState.get(activeTooth));
  }
  if(edentulous && !suppressEdentulousSync){
    setEdentulous(false);
  }
}

function updateActiveLabel(){
  const label = $("#activeToothLabel");
  if(!label) return;
  if(selectedTeeth.size === 0){
    label.textContent = "—";
  }else if(selectedTeeth.size === 1){
    label.textContent = String(activeTooth ?? Array.from(selectedTeeth)[0]);
  }else{
    label.textContent = `${selectedTeeth.size} fog`;
  }
}

function setControlsEnabled(enabled){
  $$(".panel-body input, .panel-body select").forEach(el => {
    el.disabled = !enabled;
  });
}

function updateSelectionUI(){
  $$(".tooth-tile").forEach(t => {
    const toothNo = Number(t.dataset.tooth);
    t.classList.toggle("active", selectedTeeth.has(toothNo));
  });
  updateActiveLabel();
  if(activeTooth && selectedTeeth.has(activeTooth)){
    syncControlsFromState(toothState.get(activeTooth));
    setControlsEnabled(true);
  }else{
    syncControlsFromState(defaultState());
    setControlsEnabled(false);
  }
}

function onToothClick(toothNo, evt){
  const multi = evt.metaKey || evt.ctrlKey;
  if(multi){
    if(selectedTeeth.has(toothNo)){
      selectedTeeth.delete(toothNo);
    }else{
      selectedTeeth.add(toothNo);
      activeTooth = toothNo;
    }
  }else{
    selectedTeeth = new Set([toothNo]);
    activeTooth = toothNo;
  }
  if(activeTooth && !selectedTeeth.has(activeTooth)){
    activeTooth = selectedTeeth.values().next().value ?? null;
  }
  updateSelectionUI();
}

function updateToothTileVisibility(){
  const hiddenSet = new Set([18,28,38,48]);
  for(const toothNo of ALL_TEETH){
    const tile = toothTile.get(toothNo);
    if(!tile) continue;
    const hide = wisdomMissing && hiddenSet.has(toothNo);
    tile.classList.toggle("hidden", hide);
  }
  selectedTeeth = new Set([...selectedTeeth].filter(t => !toothTile.get(t)?.classList.contains("hidden")));
  if(activeTooth && !selectedTeeth.has(activeTooth)){
    activeTooth = selectedTeeth.values().next().value ?? null;
  }
  updateSelectionUI();
}

function setEdentulous(on){
  edentulous = on;
  setToggleButton($("#btnEdentulous"), edentulous);
  if(edentulous){
    suppressEdentulousSync = true;
    for(const toothNo of ALL_TEETH){
      const s = defaultState();
      s.toothSelection = "none";
      s.removable = "none";
      toothState.set(toothNo, s);
      applyStateToSvg(toothNo);
    }
    suppressEdentulousSync = false;
    if(activeTooth) syncControlsFromState(toothState.get(activeTooth));
  }
}

function setWisdomMissing(on){
  wisdomMissing = on;
  setToggleButton($("#btnWisdomMissing"), wisdomMissing);
  updateToothTileVisibility();
}

function setShowBase(on){
  showBase = on;
  setToggleButton($("#btnBoneVisible"), showBase);
  for(const toothNo of ALL_TEETH){
    applyStateToSvg(toothNo);
  }
}

// ---- Load and build grid ----
async function loadSvg(url){
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`SVG fetch failed: ${url}`);
  const txt = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(txt, "image/svg+xml");
  const svg = doc.documentElement;
  // Normalize ids/attrs
  stripDisplayNoneToDataActive(svg);
  ensureDataActiveForSwitchables(svg);
  return svg;
}

async function buildGrid(){
  const grid = $("#toothGrid");
  grid.innerHTML = "";

  // preload SVG templates once
  const tplCache = new Map();
  for(const tplNo of [11,13,14,16]){
    const svg = await loadSvg(TEMPLATES[tplNo]);
    tplCache.set(tplNo, svg);
  }

  for(const toothNo of ALL_TEETH){
    const map = TOOTH_TEMPLATE.get(toothNo);
    const tplNo = map ? map.tpl : 16;
    const rot = map ? map.rot : 0;
    const mirror = map ? map.mirror : false;

    // clone svg
    const svg = tplCache.get(tplNo).cloneNode(true);
    if(rot === 180) rotate180(svg);
    if(mirror) mirrorVertical(svg);
    const scaleX = (tplNo === 11 || tplNo === 13) ? 0.8 : (tplNo === 14 ? 0.9 : 1);
    if(scaleX !== 1){
      svg.style.transformOrigin = "center";
      svg.style.transform = `scaleX(${scaleX})`;
    }

    const tile = el("div", { class:"tooth-tile", "data-tooth": String(toothNo) }, [
      el("div", { class:"tooth-num", html: String(toothNo)}),
      el("div", { class:"tooth-svg" })
    ]);
    $(".tooth-svg", tile).appendChild(svg);

    tile.addEventListener("click", (e)=>onToothClick(toothNo, e));

    grid.appendChild(tile);

    toothSvgRoot.set(toothNo, svg);
    toothTile.set(toothNo, tile);
    toothState.set(toothNo, defaultState());
    applyStateToSvg(toothNo);
  }

  // default active tooth
  selectedTeeth = new Set([11]);
  activeTooth = 11;
  updateSelectionUI();
  updateToothTileVisibility();
}

// ---- Controls wiring ----
function wireControls(){
  // Fog alap dropdown
  buildSelect($("#toothSelect"), [
    {value:"none", label:"nincs"},
    {value:"tooth-base", label:"egészséges fog"},
    {value:"implant", label:"implantátum"},
    {value:"tooth-broken-inicisal", label:"törött fog (inicizális)"},
    {value:"tooth-broken-distal-inicisal", label:"törött fog (distal-inicizális)"},
    {value:"tooth-broken-distal", label:"törött fog (distal)"},
    {value:"tooth-broken-mesial-inicisal", label:"törött fog (mesial-inicizális)"},
    {value:"tooth-broken-mesial", label:"törött fog (mesial)"},
    {value:"tooth-crownprep", label:"előkészített fog koronához"},
  ], (value)=>{
    applyToSelected((s)=>{
      s.toothSelection = value;
      if(value === "implant" || value === "none"){
        s.caries.clear();
        s.endo = "none";
        s.pulpInflam = false;
        s.fillingMaterial = "none";
        s.fillingSurfaces.clear();
      }
    });
    if(value !== "none") setEdentulous(false);
  });

  // Koronai rész dropdown
  buildSelect($("#crownSelect"), [
    {value:"natural", label:"természetes korona"},
    {value:"zircon", label:"cirkon korona"},
    {value:"metal", label:"fémkerámia korona"},
    {value:"temporary", label:"ideiglenes korona"},
    {value:"telescope", label:"teleszkóp korona"},
  ], (value)=>{
    applyToSelected((s)=>{
      s.crownMaterial = value;
    });
    setEdentulous(false);
  });

  // Foggyökér dropdown
  buildSelect($("#endoSelect"), [
    {value:"none", label:"egészséges foggyökér"},
    {value:"endo-filling", label:"gyökértömés"},
    {value:"endo-glass-pin", label:"gyökértömés, üvegszálas csappal"},
    {value:"endo-metal-pin", label:"gyökértömés, fémcsappal"},
  ], (value)=>{
    applyToSelected((s)=>{
      s.endo = value;
    });
  });

  // Pulpitis
  $("#pulpInflam").addEventListener("change", (e)=>{
    applyToSelected((s)=>{
      s.pulpInflam = e.target.checked;
    });
  });

  // Gyulladások
  buildChecks($("#modsChecks"), [
    {value:"parodontal", label:"parodontális gyulladás"},
    {value:"inflammation", label:"periapikális gyulladás"},
  ], (id, on)=>{
    applyToSelected((s)=>{
      if(on) s.mods.add(id); else s.mods.delete(id);
    });
  });

  // Caries checks (order)
  buildChecks($("#cariesChecks"), [
    {value:"caries-mesial", label:"mesial"},
    {value:"caries-distal", label:"distal"},
    {value:"caries-buccal", label:"buccal"},
    {value:"caries-occlusal", label:"occlusal"},
    {value:"caries-subcrown", label:"subcrown"},
  ], (id, on)=>{
    applyToSelected((s)=>{
      if(on) s.caries.add(id); else s.caries.delete(id);
    });
  });

  // Filling material dropdown
  buildSelect($("#fillingSelect"), [
    {value:"none", label:"nincs tömés"},
    {value:"amalgam", label:"amalgám tömés"},
    {value:"composite", label:"kompozit tömés"},
  ], (mat)=>{
    applyToSelected((s)=>{
      s.fillingMaterial = mat;
    });
  });

  // Filling surface checks
  buildChecks($("#fillingSurfaceChecks"), GROUPS.fillingSurfaces.map(s=>({value:s,label:s})), (surf,on)=>{
    applyToSelected((s)=>{
      if(on) s.fillingSurfaces.add(surf); else s.fillingSurfaces.delete(surf);
    });
  });

  // Removable prosthesis dropdown
  buildSelect($("#removableSelect"), [
    {value:"none", label:"nincs fogpótlás"},
    {value:"prosthesis", label:"kivehető fogpótlás fog"},
  ], (val)=>{
    applyToSelected((s)=>{
      s.removable = val;
    });
  });

  // Reset buttons
  $("#btnResetTooth").addEventListener("click", ()=>{
    if(selectedTeeth.size === 0) return;
    for(const toothNo of selectedTeeth){
      toothState.set(toothNo, defaultState());
      applyStateToSvg(toothNo);
    }
    if(activeTooth) syncControlsFromState(toothState.get(activeTooth));
  });

  $("#btnResetAll").addEventListener("click", ()=>{
    for(const toothNo of ALL_TEETH){
      toothState.set(toothNo, defaultState());
      applyStateToSvg(toothNo);
    }
    if(activeTooth) syncControlsFromState(toothState.get(activeTooth));
  });

  $("#btnSelectAll").addEventListener("click", ()=>{
    selectedTeeth = new Set(ALL_TEETH);
    activeTooth = ALL_TEETH[0];
    updateToothTileVisibility();
  });
  $("#btnSelectUpper").addEventListener("click", ()=>{
    selectedTeeth = new Set(ALL_TEETH.filter(t => t >= 11 && t <= 28));
    activeTooth = 11;
    updateToothTileVisibility();
  });
  $("#btnSelectLower").addEventListener("click", ()=>{
    selectedTeeth = new Set(ALL_TEETH.filter(t => t >= 31 && t <= 48));
    activeTooth = 31;
    updateToothTileVisibility();
  });
  $("#btnSelectNone").addEventListener("click", ()=>{
    selectedTeeth = new Set();
    activeTooth = null;
    updateSelectionUI();
  });

  $("#btnEdentulous").addEventListener("click", ()=>{
    setEdentulous(!edentulous);
  });
  $("#btnWisdomMissing").addEventListener("click", ()=>{
    setWisdomMissing(!wisdomMissing);
  });
  $("#btnBoneVisible").addEventListener("click", ()=>{
    setShowBase(!showBase);
  });
}

(async function init(){
  wireControls();
  await buildGrid();
  // ensure controls match initial active tooth
  syncControlsFromState(toothState.get(activeTooth));
})();
