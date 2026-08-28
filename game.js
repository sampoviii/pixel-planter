// ═══════════════════════════════════════════════
//  GROW MARIGOLD  –  game.js
// ═══════════════════════════════════════════════

// ── Assets ────────────────────────────────────
const ASSETS = {
  pot:        "sprites/Pot.png",
  seed:       "sprites/Marigold Seeds.png",
  water:      "sprites/Watering Can.png",
  fertilizer: "sprites/Fertilizer.png"
};

// ── Stage groups ──────────────────────────────
const STAGE_GROUPS = [
  ["sprites/Seed Sprouting Sprite 1.png","sprites/Seed Sprouting Sprite 2.png","sprites/Seed Sprouting Sprite 3.png","sprites/Seed Sprouting Sprite 4.png"],
  ["sprites/True Leaves 1.png","sprites/True Leaves 2.png","sprites/True Leaves 3.png","sprites/True Leaves 4.png"],
  ["sprites/Flower Buds 1.png","sprites/Flower Buds 2.png","sprites/Flower Buds 3.png"],
  ["sprites/Flower Open 1.png","sprites/Flower Open 2.png","sprites/Flower Open 3.png","sprites/Flower Open 4.png","sprites/Flower Open 5.png","sprites/Flower Open 6.png"],
  ["sprites/Near End Stage 1.png","sprites/Near End Stage 2.png","sprites/Near End Stage 3.png","sprites/Near End Stage 4.png","sprites/Near End Stage 5.png","sprites/Near End Stage 6.png"],
  ["sprites/End Stage (Can Claim Seeds).png"]
];
const LAST_GROUP     = STAGE_GROUPS.length - 1;
const FRAME_INTERVAL = 500;   // ms between sub-frames within a group
const GROW_DELAY     = 3000;  // ms to wait after care is satisfied before next group

// ── State ─────────────────────────────────────
let seeds       = 3;
let activePots  = [];
let dragTool    = null;
let draggingPot = null, dragOffX = 0, dragOffY = 0;

// ── DOM refs ──────────────────────────────────
const gardenBed = document.getElementById("garden-bed");
const seedCount = document.getElementById("seed-count");
const toast     = document.getElementById("toast");
const hint      = document.getElementById("garden-hint");
const fxCanvas  = document.getElementById("fx-canvas");
const fxCtx     = fxCanvas.getContext("2d");

// ═══════════════════════════════════════════════
//  FX PARTICLES  (water mist / soil / glitter)
// ═══════════════════════════════════════════════
let particles = [];

function resizeFX() {
  fxCanvas.width  = gardenBed.offsetWidth;
  fxCanvas.height = gardenBed.offsetHeight;
}

function spawnParticles(x, y, type) {
  const count = type === "water" ? 28 : type === "soil" ? 20 : 34;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 3.2;
    let color;
    if      (type === "water")  color = ["#60b8ff","#80d0ff","#a0e4ff","#c0f0ff","#4090e0"][Math.floor(Math.random()*5)];
    else if (type === "soil")   color = ["#8B5E3C","#a06830","#c08840","#6B3A1F","#d4a060"][Math.floor(Math.random()*5)];
    else                        color = `hsl(${Math.floor(Math.random()*360)},100%,70%)`;
    particles.push({
      x, y,
      vx: Math.cos(angle)*speed,
      vy: Math.sin(angle)*speed - (type==="water" ? 2 : 1),
      life: 1,
      decay: 0.022 + Math.random()*0.025,
      size: type==="glitter" ? 3+Math.random()*4 : 3+Math.random()*5,
      color, type,
      gravity: type==="soil" ? 0.18 : type==="water" ? 0.10 : 0.04
    });
  }
}

function tickFX() {
  resizeFX();
  fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.x  += p.vx; p.y  += p.vy;
    p.vy += p.gravity;
    p.life -= p.decay;
    fxCtx.save();
    fxCtx.globalAlpha = Math.max(0, p.life);
    if (p.type === "glitter") {
      fxCtx.fillStyle  = p.color;
      fxCtx.shadowColor = p.color;
      fxCtx.shadowBlur  = 6;
      fxCtx.beginPath();
      const s = p.size;
      fxCtx.moveTo(p.x,p.y-s); fxCtx.lineTo(p.x+s*.4,p.y-s*.4);
      fxCtx.lineTo(p.x+s,p.y); fxCtx.lineTo(p.x+s*.4,p.y+s*.4);
      fxCtx.lineTo(p.x,p.y+s); fxCtx.lineTo(p.x-s*.4,p.y+s*.4);
      fxCtx.lineTo(p.x-s,p.y); fxCtx.lineTo(p.x-s*.4,p.y-s*.4);
      fxCtx.closePath(); fxCtx.fill();
    } else {
      fxCtx.fillStyle = p.color;
      if (p.type === "water") { fxCtx.shadowColor = "#60b8ff"; fxCtx.shadowBlur = 4; }
      fxCtx.beginPath();
      fxCtx.arc(p.x, p.y, Math.max(0.5, p.size*p.life*0.7), 0, Math.PI*2);
      fxCtx.fill();
    }
    fxCtx.restore();
  }
  requestAnimationFrame(tickFX);
}

function potFxPos(pot, yRatio = 0.5) {
  const pr = pot.element.getBoundingClientRect();
  const gr = gardenBed.getBoundingClientRect();
  return { x: pr.left-gr.left+pr.width/2, y: pr.top-gr.top+pr.height*yRatio };
}

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
window.addEventListener("DOMContentLoaded", () => {
  resizeFX();
  requestAnimationFrame(tickFX);
  updateSeedUI();
  setupToolbar();
  setupGardenDrop();
  setupPotDrag();
  updateHint();
});
window.addEventListener("resize", resizeFX);

// ── Helpers ───────────────────────────────────
function updateSeedUI() {
  seedCount.textContent = `Seeds: ${seeds}`;
  document.getElementById("tool-seeds").classList.toggle("disabled", seeds <= 0);
}

let toastId = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  if (toastId) clearTimeout(toastId);
  toastId = setTimeout(() => toast.classList.remove("show"), 2800);
}

function updateHint() {
  hint.style.display = activePots.length === 0 ? "block" : "none";
}

// ── Toolbar ───────────────────────────────────
function setupToolbar() {
  document.querySelectorAll(".tool").forEach(tool => {
    tool.addEventListener("dragstart", e => {
      dragTool = tool.dataset.tool;
      e.dataTransfer.effectAllowed = "copy";
      const b = document.createElement("canvas"); b.width=1; b.height=1;
      e.dataTransfer.setDragImage(b, 0, 0);
    });
    tool.addEventListener("dragend",   () => { dragTool = null; });
    tool.addEventListener("touchstart",() => { dragTool = tool.dataset.tool; }, { passive: true });
    tool.addEventListener("touchend",  () => { setTimeout(() => { dragTool = null; }, 50); }, { passive: true });
  });
}

// ── Garden drag-drop ──────────────────────────
function setupGardenDrop() {
  gardenBed.addEventListener("dragover", e => e.preventDefault());
  gardenBed.addEventListener("drop", e => {
    e.preventDefault();
    if (dragTool !== "pot") return;
    const r = gardenBed.getBoundingClientRect();
    createPot(e.clientX-r.left, e.clientY-r.top);
    updateHint();
  });

  gardenBed.addEventListener("touchend", e => {
    if (!dragTool) return;
    const t  = e.changedTouches[0];
    const r  = gardenBed.getBoundingClientRect();
    if (dragTool === "pot") {
      createPot(t.clientX-r.left, t.clientY-r.top);
      updateHint();
      return;
    }
    const el   = document.elementFromPoint(t.clientX, t.clientY);
    const slot = el?.closest(".pot-slot");
    if (slot) {
      const pot = activePots.find(p => p.element === slot);
      if (pot) applyTool(pot, dragTool);
    }
  }, { passive: true });
}

// ── Pot repositioning ─────────────────────────
// potWasDragged tracks whether the pot actually moved during a mousedown,
// so we can suppress the click (harvest) if the user was repositioning.
let potWasDragged = false;

function setupPotDrag() {
  gardenBed.addEventListener("mousemove", e => {
    if (!draggingPot) return;
    potWasDragged = true;
    movePot(e.clientX, e.clientY);
  });
  const end = () => {
    if (draggingPot) {
      draggingPot.element.classList.remove("dragging-pot");
      draggingPot = null;
    }
  };
  gardenBed.addEventListener("mouseup",    end);
  gardenBed.addEventListener("mouseleave", end);
  gardenBed.addEventListener("touchmove",  e => {
    if (!draggingPot) return;
    e.preventDefault();
    potWasDragged = true;
    movePot(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  gardenBed.addEventListener("touchend", end, { passive: true });
}

function movePot(cx, cy) {
  const r  = gardenBed.getBoundingClientRect();
  const el = draggingPot.element;
  let nx = cx - r.left - dragOffX;
  let ny = cy - r.top  - dragOffY;
  nx = Math.max(0, Math.min(nx, gardenBed.offsetWidth  - el.offsetWidth));
  ny = Math.max(0, Math.min(ny, gardenBed.offsetHeight - el.offsetHeight));
  el.style.left = nx + "px";
  el.style.top  = ny + "px";
}

// ── Create pot ────────────────────────────────
function createPot(cx, cy) {
  const estW = window.innerWidth<=480?100:window.innerWidth<=768?130:175;
  const estH = window.innerWidth<=480?132:window.innerWidth<=768?174:228;

  const el = document.createElement("div");
  el.className  = "pot-slot";
  el.style.left = (cx-estW/2)+"px";
  el.style.top  = (cy-estH/2)+"px";

  // Single image — src is replaced every stage, never stacked
  const img     = document.createElement("img");
  img.className = "current-img";
  img.src       = ASSETS.pot;
  img.alt       = "Pot";
  el.appendChild(img);

  const badge       = document.createElement("div");
  badge.className   = "info-badge label";
  badge.textContent = "Drop seeds!";
  el.appendChild(badge);

  gardenBed.appendChild(el);

  // Soil burst on placement
  setTimeout(() => {
    const p = potFxPos({element:el}, 0.85);
    spawnParticles(p.x, p.y, "soil");
  }, 10);

  const pot = {
    element: el, img, badge, cloudEl: null,
    stage: "EMPTY", groupIndex: -1, frameIndex: -1,
    frameTimer: null, growTimer: null,
    neededCare: null, hasWatered: false, hasFertilized: false
  };
  activePots.push(pot);

  el.addEventListener("dragover", e => { e.preventDefault(); e.stopPropagation(); });
  el.addEventListener("drop",     e => {
    e.preventDefault(); e.stopPropagation();
    if (dragTool && dragTool !== "pot") applyTool(pot, dragTool);
  });

  // Click to harvest — only if pot wasn't just dragged
  el.addEventListener("click", () => {
    if (potWasDragged) { potWasDragged = false; return; }
    if (pot.stage === "HARVESTABLE") harvest(pot);
  });
  el.addEventListener("touchend", () => {
    if (potWasDragged) { potWasDragged = false; return; }
    if (pot.stage === "HARVESTABLE") harvest(pot);
  }, { passive: true });

  // Mousedown on the whole pot slot = start repositioning
  el.addEventListener("mousedown", e => {
    // Don't grab if a toolbar tool is active or if clicking on the cloud/badge
    if (e.button !== 0 || dragTool) return;
    if (e.target.closest(".cloud-bubble") || e.target.closest(".info-badge")) return;
    e.stopPropagation();
    potWasDragged = false;
    const pr = el.getBoundingClientRect();
    dragOffX = e.clientX - pr.left;
    dragOffY = e.clientY - pr.top;
    draggingPot = pot;
    el.classList.add("dragging-pot");
  });

  el.addEventListener("touchstart", e => {
    if (dragTool) return;
    if (e.target.closest(".cloud-bubble") || e.target.closest(".info-badge")) return;
    potWasDragged = false;
    const t = e.touches[0], pr = el.getBoundingClientRect();
    dragOffX = t.clientX - pr.left;
    dragOffY = t.clientY - pr.top;
    draggingPot = pot;
    el.classList.add("dragging-pot");
  }, { passive: true });
}

// ── Apply tool ────────────────────────────────
function applyTool(pot, tool) {

  if (tool === "seed" && pot.stage === "EMPTY") {
    if (seeds <= 0) { showToast("Oh no! No seeds left! Harvest a plant first!"); return; }
    seeds--; updateSeedUI();
    pot.stage = "SEEDED";
    setBadge(pot, "label", "");
    showCloud(pot, ["water"], "Water me please!");
    const p = potFxPos(pot, 0.85); spawnParticles(p.x, p.y, "soil");
    return;
  }

  if (tool === "water" && pot.stage === "SEEDED") {
    removeCloud(pot); setBadge(pot, "label", "");
    pot.stage = "GROWING";
    const p = potFxPos(pot, 0.45); spawnParticles(p.x, p.y, "water");
    setBadge(pot, "timer", "Growing...");
    pot.growTimer = setTimeout(() => beginGroup(pot, 0), GROW_DELAY);
    return;
  }

  if (pot.stage === "CARE") {
    const c = pot.neededCare, p = potFxPos(pot, 0.38);
    if (tool==="water"      && (c==="water"||c==="both"))      { pot.hasWatered=true;    spawnParticles(p.x,p.y,"water");   }
    if (tool==="fertilizer" && (c==="fertilizer"||c==="both")) { pot.hasFertilized=true; spawnParticles(p.x,p.y,"glitter"); }
    checkCareDone(pot);
    return;
  }

  // Friendly feedback
  if (tool==="seed" && pot.stage!=="EMPTY")                                              { showToast("Silly! There's already a plant here!"); return; }
  if ((tool==="water"||tool==="fertilizer") && pot.stage==="EMPTY")                     { showToast("Put some seeds in first!"); return; }
  if ((tool==="water"||tool==="fertilizer") && (pot.stage==="GROWING"||pot.stage==="SEEDED")) { showToast("Not now! The plant is okay!"); }
}

// ── Group animation ───────────────────────────
function beginGroup(pot, groupIdx) {
  pot.groupIndex = groupIdx;
  pot.frameIndex = 0;
  showFrame(pot);
  if (pot.frameTimer) clearInterval(pot.frameTimer);
  const frames = STAGE_GROUPS[groupIdx];
  if (frames.length > 1) {
    pot.frameTimer = setInterval(() => {
      pot.frameIndex++;
      if (pot.frameIndex < frames.length) {
        showFrame(pot);
      } else {
        clearInterval(pot.frameTimer); pot.frameTimer = null;
        afterGroupDone(pot);
      }
    }, FRAME_INTERVAL);
  } else {
    afterGroupDone(pot);
  }
}

function afterGroupDone(pot) {
  if (pot.groupIndex === LAST_GROUP) {
    // End stage — harvestable immediately, no care needed
    pot.stage = "HARVESTABLE";
    pot.element.classList.add("harvestable");
    setBadge(pot, "label", "");
    showCloud(pot, ["seed"], "Tap me for seeds!");
  } else if (pot.groupIndex === LAST_GROUP - 1) {
    // Near End → End: skip care, go straight to end stage after grow delay
    pot.stage = "GROWING";
    setBadge(pot, "timer", "Almost done...");
    if (pot.growTimer) clearTimeout(pot.growTimer);
    pot.growTimer = setTimeout(() => beginGroup(pot, pot.groupIndex + 1), GROW_DELAY);
  } else {
    // All other groups: request care before advancing
    pot.stage = "CARE";
    requestCare(pot);
  }
}

function showFrame(pot) {
  pot.img.src = STAGE_GROUPS[pot.groupIndex][pot.frameIndex];
  if (pot.frameIndex === 0) {
    pot.img.classList.remove("pop");
    void pot.img.offsetWidth;
    pot.img.classList.add("pop");
  }
  setBadge(pot, "label", "");
}

// ── Care ──────────────────────────────────────
// Kid-friendly cloud messages are shown via icons,
// but the toast gives a cute voice to the plant.
const WATER_MSGS       = ["Water me please!", "I'm so thirsty!", "A little water?", "Please water me!"];
const FERTILIZER_MSGS  = ["Feed me please!", "I need food!", "Yummy fertilizer!", "I'm hungry!"];
const BOTH_MSGS        = ["Water AND food please!", "Feed me and water me!", "I need both!"];

function requestCare(pot) {
  const r = Math.random();
  pot.neededCare    = r < 0.34 ? "water" : r < 0.67 ? "fertilizer" : "both";
  pot.hasWatered    = false;
  pot.hasFertilized = false;

  let speech, icons;
  if (pot.neededCare === "water") {
    icons  = ["water"];
    speech = WATER_MSGS[Math.floor(Math.random() * WATER_MSGS.length)];
  } else if (pot.neededCare === "fertilizer") {
    icons  = ["fertilizer"];
    speech = FERTILIZER_MSGS[Math.floor(Math.random() * FERTILIZER_MSGS.length)];
  } else {
    icons  = ["water","fertilizer"];
    speech = BOTH_MSGS[Math.floor(Math.random() * BOTH_MSGS.length)];
  }

  showCloud(pot, icons, speech);
}

function checkCareDone(pot) {
  const {neededCare:c, hasWatered:w, hasFertilized:f} = pot;
  const done = (c==="water"&&w)||(c==="fertilizer"&&f)||(c==="both"&&w&&f);
  if (!done) {
    if (c === "both") {
      const rem = []; if(!w) rem.push("water"); if(!f) rem.push("fertilizer");
      const speech = !w && !f ? BOTH_MSGS[0] : !w ? "Now water me!" : "Now feed me!";
      showCloud(pot, rem, speech);
    }
    return;
  }
  removeCloud(pot); pot.neededCare = null; pot.stage = "GROWING";
  setBadge(pot, "timer", "Growing…");
  if (pot.growTimer) clearTimeout(pot.growTimer);
  pot.growTimer = setTimeout(() => beginGroup(pot, pot.groupIndex+1), GROW_DELAY);
}

// ── Harvest ───────────────────────────────────
function harvest(pot) {
  const gained = Math.floor(Math.random()*4)+5;
  seeds += gained; updateSeedUI();
  showToast(`Woohoo! Got ${gained} seeds! Total: ${seeds}!`);
  const p = potFxPos(pot, 0.3);
  spawnParticles(p.x, p.y, "glitter");
  spawnParticles(p.x, p.y, "glitter");
  if (pot.frameTimer) { clearInterval(pot.frameTimer); pot.frameTimer = null; }
  if (pot.growTimer)  { clearTimeout(pot.growTimer);   pot.growTimer  = null; }
  removeCloud(pot);
  pot.element.remove();
  activePots = activePots.filter(p => p !== pot);
  updateHint();
}

// ── Cloud bubble ──────────────────────────────
// iconKeys: array of asset keys to show as icons
// speech: optional text string the plant "says" — shown below the icons
function showCloud(pot, iconKeys, speech) {
  removeCloud(pot);
  const cloud = document.createElement("div");
  cloud.className = "cloud-bubble";

  if (iconKeys.length > 0) {
    const iconRow = document.createElement("div");
    iconRow.className = "cloud-icons";
    iconKeys.forEach(key => {
      const i = document.createElement("img");
      i.className = "cloud-icon"; i.src = ASSETS[key]; i.alt = key;
      iconRow.appendChild(i);
    });
    cloud.appendChild(iconRow);
  }

  if (speech) {
    const txt = document.createElement("div");
    txt.className   = "cloud-text";
    txt.textContent = speech;
    cloud.appendChild(txt);
  }

  pot.element.appendChild(cloud);
  pot.cloudEl = cloud;
}
function removeCloud(pot) { if (pot.cloudEl) { pot.cloudEl.remove(); pot.cloudEl = null; } }

// ── Badge ─────────────────────────────────────
function setBadge(pot, type, text) {
  pot.badge.className    = `info-badge ${type}`;
  pot.badge.textContent  = text;
  pot.badge.style.display = text ? "" : "none";
}
