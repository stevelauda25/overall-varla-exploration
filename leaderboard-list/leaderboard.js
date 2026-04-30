/* ---------------------------------------------------------------------------
   Leaderboard — 500 entries, current user at rank 296.
   - Generates 500 rows of fake data
   - Renders into the table body
   - Search filters rows by name
   - "JUMP TO MY RANK" scrolls the user's row into view (centered)
   - When the user's row is in view, the pinned row slides down and a
     floating "back to top" button appears (and vice versa) via
     IntersectionObserver
   --------------------------------------------------------------------------- */

const TOTAL = 500;
const MY_RANK = 296;
const MY_NAME = "Benjamin Anderson";
const MY_AVATAR_URL = "https://i.pravatar.cc/96?img=53";
const MY_GEMS = 12480;
const MY_CHANGE = { type: "up", value: 10 };

/* ---------- Avatar pool ----------
   Combines 3 free portrait sources for ~270 unique faces:
     · pravatar           70 photos  (img=1..70)
     · randomuser men    100 photos  (men/0..99)
     · randomuser women  100 photos  (women/0..99)
   Cycled with a coprime multiplier so adjacent ranks pull from different
   sources — feels like there's "no duplicates" while scrolling. With 270
   unique avatars across 500 ranks, each face appears ~1–2 times total,
   spaced ~270 ranks apart. */
const AVATAR_POOL_SIZE = 270;

function avatarFor(rank) {
  if (rank === MY_RANK) return MY_AVATAR_URL;
  // 31 is coprime with 270, so this LCG-style stride visits every index
  // exactly once before repeating
  const idx = ((rank - 1) * 31 + 7) % AVATAR_POOL_SIZE;
  if (idx < 70) return `https://i.pravatar.cc/96?img=${idx + 1}`;
  if (idx < 170) return `https://randomuser.me/api/portraits/med/men/${idx - 70}.jpg`;
  return `https://randomuser.me/api/portraits/med/women/${idx - 170}.jpg`;
}

// 500 hand-curated unique names mixing real-world first names from many
// cultures, fantasy/RPG names, single-word gamer handles, and quirky
// concept names. Each rank gets the name at index (rank-1).
const ALL_NAMES = [
  // Western first names
  "Adam", "Alex", "Alice", "Amy", "Andrew", "Anna", "Anthony", "Aria", "Aurora", "Ava",
  "Bella", "Ben", "Brian", "Caleb", "Carla", "Carter", "Casey", "Charlie", "Chloe", "Claire",
  "Daniel", "David", "Dean", "Devon", "Diana", "Dylan", "Eli", "Eliza", "Ella", "Emma",
  "Eric", "Ethan", "Evan", "Evelyn", "Felix", "Finn", "Fiona", "Frank", "Gabriel", "Gemma",
  "George", "Grace", "Hailey", "Hannah", "Henry", "Holly", "Ian", "Iris", "Isaac", "Isabel",
  "Jack", "James", "Jane", "Jason", "Jenna", "John", "Jonas", "Jordan", "Joseph", "Julia",
  "Kate", "Kevin", "Kyle", "Lauren", "Leo", "Liam", "Lily", "Lucas", "Maria", "Mark",
  "Matthew", "Maya", "Mia", "Mike", "Nate", "Nathan", "Nicole", "Noah", "Olivia", "Oscar",
  "Owen", "Paige", "Patrick", "Paul", "Peter", "Quinn", "Rachel", "Robert", "Ruby", "Ryan",
  "Sarah", "Scott", "Sean", "Sofia", "Sophia", "Steve", "Thomas", "Tina", "Tom", "Tyler",

  // International first names
  "Aiko", "Akira", "Aleksei", "Amani", "Amir", "Anastasia", "Andrei", "Aoife", "Arjun", "Astrid",
  "Ayaan", "Bao", "Beatriz", "Bjorn", "Camille", "Carmen", "Chen", "Chiara", "Cosima", "Dalia",
  "Diego", "Dimitri", "Eitan", "Elena", "Elias", "Esme", "Esteban", "Fadia", "Farah", "Felipe",
  "Francesca", "Freya", "Gabriela", "Greta", "Hassan", "Hiro", "Ilse", "Imran", "Indira", "Ingrid",
  "Irina", "Ismael", "Iva", "Jaya", "Jin", "Joaquin", "Juliana", "Kai", "Kamila", "Karim",
  "Kasper", "Kenji", "Kiran", "Klaus", "Lakshmi", "Layla", "Leandro", "Leila", "Linh", "Lorenzo",
  "Lucia", "Magnus", "Mai", "Malika", "Mateo", "Mei", "Mikhail", "Misha", "Nadia", "Niamh",
  "Nikolai", "Noemi", "Olga", "Omar", "Paolo", "Pavel", "Pedro", "Petra", "Pilar", "Priya",
  "Rafael", "Rahul", "Rasmus", "Ravi", "Renzo", "Ricardo", "Rosa", "Sakura", "Sasha", "Sebastien",
  "Shen", "Sora", "Stefano", "Sven", "Tomas", "Vera", "Vikram", "Yara", "Yusuf", "Zara",

  // Fantasy / medieval names
  "Aelfric", "Aerion", "Albion", "Aldric", "Alistair", "Alric", "Alyx", "Anwen", "Aragorn", "Arwen",
  "Aurelius", "Avalon", "Baelin", "Belka", "Beren", "Borin", "Brynjar", "Cael", "Caitlyn", "Calliope",
  "Cassia", "Castiel", "Celestia", "Ciara", "Corin", "Cyril", "Dagmar", "Daerys", "Daria", "Darius",
  "Decimus", "Delyth", "Drystan", "Eira", "Eldon", "Elinor", "Elowen", "Emrys", "Endrin", "Eowyn",
  "Erevan", "Ethelred", "Evangeline", "Faelar", "Faramond", "Fenris", "Galadriel", "Gareth", "Gendry", "Glenfindale",
  "Halifax", "Helian", "Hroar", "Idria", "Ilyana", "Imrik", "Ingrith", "Isolde", "Ivara", "Jareth",
  "Jorah", "Jorvik", "Kaelin", "Kalith", "Karis", "Kelmoria", "Kerith", "Kestrel", "Khalwen", "Kira",
  "Kraeven", "Kyran", "Lirael", "Loras", "Loriel", "Lythiel", "Maerwen", "Magnar", "Marik", "Meriadoc",
  "Mireth", "Morgath", "Naela", "Nessian", "Nimue", "Norvik", "Nyssa", "Olwyn", "Orelius", "Orion",
  "Pellinor", "Phaedra", "Quenley", "Rhaegar", "Riven", "Rohanna", "Saorise", "Selene", "Theron", "Ulfric",

  // Gamer handles / single-word
  "Ace", "Ash", "Atlas", "Axiom", "Beacon", "Blaze", "Blitz", "Bolt", "Boomer", "Buster",
  "Byte", "Cadence", "Cipher", "Cobalt", "Comet", "Cosmo", "Crimson", "Cypher", "Daxter", "Decoy",
  "Delta", "Drift", "Echo", "Edge", "Ember", "Falcon", "Flame", "Flynn", "Forge", "Frost",
  "Fury", "Gale", "Ghost", "Glitch", "Glyph", "Granite", "Grim", "Halo", "Hammer", "Harbor",
  "Havoc", "Helix", "Hex", "Hunter", "Hyper", "Indigo", "Ion", "Jett", "Jolt", "Karma",
  "Knox", "Lance", "Laser", "Legacy", "Magnet", "Maverick", "Maze", "Memo", "Mercer", "Moss",
  "Nebula", "Neon", "Nimbus", "Nomad", "Nova", "Onyx", "Orbit", "Pace", "Phoenix", "Photon",
  "Pixel", "Plasma", "Polaris", "Prism", "Pulse", "Quanta", "Quill", "Radar", "Raptor", "Rebel",
  "Recon", "Relic", "Reverb", "Ridge", "Riot", "River", "Rogue", "Rune", "Sable", "Saber",
  "Sage", "Salvo", "Scout", "Sentinel", "Shade", "Shadow", "Shard", "Shift", "Sky", "Slate",

  // Concept / nature / quirky
  "Tempest", "Thorn", "Tide", "Titan", "Torrent", "Trace", "Trinity", "Twist", "Vector", "Volt",
  "Vortex", "Wanderer", "Wave", "Zenith", "Zephyr", "Aether", "Apex", "Arcade", "Avatar", "Axis",
  "Bandit", "Beats", "Bishop", "Blizzard", "Boulder", "Brick", "Bright", "Burner", "Cactus", "Cadet",
  "Caliber", "Cameo", "Carbon", "Cascade", "Citrine", "Clover", "Conch", "Conduit", "Copper", "Corsair",
  "Cricket", "Cyborg", "Dagger", "Dawn", "Diesel", "Dingo", "Dipper", "Doodle", "Doppler", "Dragon",
  "Dune", "Dusk", "Element", "Empire", "Encore", "Enigma", "Equator", "Estate", "Excerpt", "Exhibit",
  "Exodus", "Express", "Fang", "Feather", "Felony", "Ferret", "Flask", "Fjord", "Flake", "Flicker",
  "Flux", "Foggy", "Fraction", "Frenzy", "Galaxy", "Gambit", "Garrison", "Gauntlet", "Goblin", "Grizzly",
  "Halcyon", "Harvest", "Hatchet", "Hazard", "Heron", "Hilt", "Hopper", "Horizon", "Hurricane", "Husk",
  "Iceberg", "Imp", "Inferno", "Inkwell", "Iota", "Javelin", "Jester", "Joust", "Jubilee", "Junction",
];

// Shuffle the curated list once with a fixed seed so ranks get a varied
// mix across all categories instead of all "Western" at the top, all
// "Fantasy" in the middle, etc. Deterministic so rank N always resolves
// to the same name across reloads.
function shuffleSeeded(arr, seed) {
  const result = arr.slice();
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    // Simple LCG → pseudo-random integer
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const SHUFFLED_NAMES = shuffleSeeded(ALL_NAMES, 17);

function nameFor(rank) {
  return SHUFFLED_NAMES[(rank - 1) % SHUFFLED_NAMES.length];
}

// Tier thresholds — purely gem-based:
//   Bronze   <  10,000
//   Silver   <  50,000
//   Gold     < 100,000
//   Platinum < 250,000
//   Diamond  ≥ 250,000
function leagueFor(gems) {
  if (gems >= 250000) return "diamond";
  if (gems >= 100000) return "platinum";
  if (gems >= 50000) return "gold";
  if (gems >= 10000) return "silver";
  return "bronze";
}

function gemsFor(rank) {
  if (rank === MY_RANK) return MY_GEMS;
  // Descending curve calibrated so all 5 tiers appear naturally:
  //   rank 1 starts at 350K (Diamond), rank 296 ≈ 12,480 (Silver),
  //   rank 500 ≈ 1,300 (Bronze).
  const base = Math.round(350000 * Math.pow(0.989, rank - 1));
  const jitter = ((rank * 17) % 200) - 100;
  return Math.max(500, base + jitter);
}

function changeFor(rank) {
  if (rank === MY_RANK) return MY_CHANGE;
  const r = (rank * 7) % 11;
  if (r === 0) return { type: "none" };
  if (r < 6) return { type: "up", value: r };
  return { type: "down", value: r - 5 };
}

function buildData() {
  const rows = [];
  for (let i = 1; i <= TOTAL; i++) {
    const isSelf = i === MY_RANK;
    const gems = isSelf ? MY_GEMS : gemsFor(i);
    rows.push({
      rank: i,
      name: isSelf ? MY_NAME : nameFor(i),
      avatar: avatarFor(i),
      gems,
      league: leagueFor(gems), // tier follows gems, not rank
      change: changeFor(i),
      isSelf,
    });
  }
  return rows;
}

function changeHTML(change) {
  if (change.type === "none") return `<span class="change change--none">-</span>`;
  return `<span class="change change--${change.type}"><span class="change__icon"></span>${change.value}</span>`;
}

function rowHTML(r) {
  const tierLabel = r.league.charAt(0).toUpperCase() + r.league.slice(1);
  const selfAttrs = r.isSelf ? ' data-self="true" id="my-rank-anchor"' : "";
  // Only the user's own row gets the JUMP TO MY RANK button. CSS hides it
  // by default and reveals it whenever .is-sticky is on the row.
  const jumpBtn = r.isSelf
    ? `<button type="button" class="jump-btn" id="jump-btn">JUMP TO MY RANK</button>`
    : "";
  return `
    <div class="row"${selfAttrs} data-league="${r.league}" data-gems="${r.gems}">
      <div class="cell cell--rank">${r.rank.toLocaleString()}</div>
      <div class="cell cell--user">
        <img class="avatar" src="${r.avatar}" alt="" loading="lazy" />
        <span>${r.name}</span>
      </div>
      <div class="cell cell--league">
        <span class="tier tier--${r.league}"></span>
        <span>${tierLabel}</span>
      </div>
      <div class="cell cell--gems">
        <span class="gem"></span>
        <span class="num">${r.gems.toLocaleString()}</span>
      </div>
      <div class="cell cell--change">${changeHTML(r.change)}${jumpBtn}</div>
    </div>`;
}

/* ---------- Render ---------- */

const tableBody = document.getElementById("table-body");
const searchInput = document.querySelector(".search-row__input input");
const backToTopBtn = document.getElementById("back-to-top");

// Render rows BEFORE querying for elements that live inside them
tableBody.innerHTML = buildData().map(rowHTML).join("");

const myRow = document.getElementById("my-rank-anchor");
const jumpBtn = document.getElementById("jump-btn");

/* The user's row is `position: sticky`. In some browsers `offsetTop`
   returns the *stuck* visual position rather than the natural one, so we
   derive the natural top from the rank index instead. */
const ROW_HEIGHT = 56;
const MY_ROW_NATURAL_TOP = (MY_RANK - 1) * ROW_HEIGHT;

/* ---------- JUMP TO MY RANK ---------- */

jumpBtn.addEventListener("click", () => {
  // Scroll the user's row to the visual center of the body
  const offset =
    MY_ROW_NATURAL_TOP -
    tableBody.clientHeight / 2 +
    ROW_HEIGHT / 2;
  tableBody.scrollTo({ top: offset, behavior: "smooth" });
});

/* ---------- Back-to-top ---------- */

backToTopBtn.addEventListener("click", () => {
  tableBody.scrollTo({ top: 0, behavior: "smooth" });
});

/* ---------- Sticky-state detection ----------
   Three sub-states based on whether the row's natural slot overlaps the
   viewport:
     · "in-view" → scrolling normally
     · "below"   → natural slot is below viewport → stuck at bottom
     · "above"   → natural slot is above viewport → stuck at top

   Side effects:
     · .is-sticky on the row      → reveals JUMP TO MY RANK button
     · .is-visible on back-to-top → fade in/out
     · .above-pinned on back-to-top → lifts the button above the bottom-stuck
       pinned row with a 16px gap so they don't overlap */

function updateStickyState() {
  const rowTop = MY_ROW_NATURAL_TOP;
  const rowBottom = rowTop + ROW_HEIGHT;
  const viewTop = tableBody.scrollTop;
  const viewBottom = viewTop + tableBody.clientHeight;

  let state;
  if (rowBottom <= viewTop) state = "above";
  else if (rowTop >= viewBottom) state = "below";
  else state = "in-view";

  myRow.classList.toggle("is-sticky", state !== "in-view");

  // Back-to-top appears once the user has scrolled past row 1
  backToTopBtn.classList.toggle("is-visible", viewTop > ROW_HEIGHT);

  // When pinned is stuck at bottom, push back-to-top above it
  backToTopBtn.classList.toggle("above-pinned", state === "below");
}

tableBody.addEventListener("scroll", updateStickyState);
window.addEventListener("resize", updateStickyState);
updateStickyState();

/* ---------- Custom overlay scrollbar ----------
   Native scrollbar hidden in CSS; this draws an absolute-positioned thumb
   that fades in while scrolling and out shortly after. */

const scrollbar = document.getElementById("table-scrollbar");
const scrollbarThumb = document.getElementById("table-scrollbar-thumb");
const SCROLLBAR_HIDE_DELAY_MS = 800;
let scrollbarHideTimer = null;

function updateScrollbarThumb() {
  const { scrollTop, scrollHeight, clientHeight } = tableBody;
  if (scrollHeight <= clientHeight) {
    scrollbar.classList.remove("is-active");
    scrollbarThumb.style.height = "0";
    return;
  }
  const trackHeight = scrollbar.clientHeight;
  const thumbHeight = Math.max(20, (clientHeight / scrollHeight) * trackHeight);
  const maxScroll = scrollHeight - clientHeight;
  const maxThumbY = trackHeight - thumbHeight;
  const thumbY = (scrollTop / maxScroll) * maxThumbY;
  scrollbarThumb.style.height = thumbHeight + "px";
  scrollbarThumb.style.top = thumbY + "px";
}

function showScrollbar() {
  if (tableBody.scrollHeight <= tableBody.clientHeight) return;
  scrollbar.classList.add("is-active");
  clearTimeout(scrollbarHideTimer);
  scrollbarHideTimer = setTimeout(() => {
    scrollbar.classList.remove("is-active");
  }, SCROLLBAR_HIDE_DELAY_MS);
}

tableBody.addEventListener("scroll", () => {
  updateScrollbarThumb();
  showScrollbar();
});

window.addEventListener("resize", updateScrollbarThumb);
updateScrollbarThumb(); // initial measurement

/* ---------- Search ---------- */

/* ---------- Filter state ----------
   Two independent filters compound (AND): the search query and the
   league dropdown. A single applyFilters() pass walks every row and
   updates display + name highlight in one go. */

let activeQuery = "";
let activeLeague = ""; // "" = all leagues, otherwise "bronze"|"silver"|...
const RANK_MIN_BOUND = 1;
const RANK_MAX_BOUND = TOTAL; // 500
const GEMS_MIN_BOUND = 0;
const GEMS_MAX_BOUND = 400000;
// State objects (mutated in place by setupRangeFilter, read in applyFilters)
const rankRange = { min: RANK_MIN_BOUND, max: RANK_MAX_BOUND };
const gemsRange = { min: GEMS_MIN_BOUND, max: GEMS_MAX_BOUND };

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightedHTML(text, query) {
  if (!query) return text;
  const re = new RegExp(`(${escapeRegex(query)})`, "gi");
  return text.replace(re, "<mark>$1</mark>");
}

function applyFilters() {
  const qLower = activeQuery.toLowerCase();
  const rows = tableBody.querySelectorAll(".row");

  rows.forEach((row) => {
    const nameSpan = row.querySelector(".cell--user span");
    const rankCell = row.querySelector(".cell--rank");
    if (!nameSpan) return;

    const name = nameSpan.textContent; // strips <mark> tags
    const rank = rankCell ? rankCell.textContent : "";
    const rankNum = parseInt(rank.replace(/,/g, ""), 10) || 0;
    const gems = parseInt(row.dataset.gems, 10) || 0;
    const league = row.dataset.league || "";

    const nameMatches = name.toLowerCase().includes(qLower);
    const rankMatches = rank.toLowerCase().includes(qLower);
    const queryMatches = !activeQuery || nameMatches || rankMatches;
    const leagueMatches = !activeLeague || league === activeLeague;
    const rankInRange = rankNum >= rankRange.min && rankNum <= rankRange.max;
    const gemsInRange = gems >= gemsRange.min && gems <= gemsRange.max;

    const visible = queryMatches && leagueMatches && rankInRange && gemsInRange;
    row.style.display = visible ? "" : "none";

    if (visible && activeQuery && nameMatches) {
      nameSpan.innerHTML = highlightedHTML(name, activeQuery);
    } else {
      nameSpan.textContent = name;
    }
  });
}

/* ---------- Search input ---------- */

if (searchInput) {
  searchInput.addEventListener("input", () => {
    activeQuery = searchInput.value.trim();
    applyFilters();
  });
}

/* ---------- Reusable dropdown ----------
   Wires up open/close + item selection for any .filter-dropdown.
     · onSelect(value)  is called whenever the user picks an item
     · toggleable=true  re-clicking the active item un-selects it (default
       label restored). Set false for radio-style dropdowns where one
       option must always be selected (e.g. "All time"). */
function setupDropdown(dropdown, { onSelect, toggleable = true } = {}) {
  if (!dropdown) return;
  const toggle = dropdown.querySelector("[data-dropdown-toggle]");
  const menu = dropdown.querySelector(".filter-menu");
  const label = dropdown.querySelector(".filter-btn__label");
  const items = dropdown.querySelectorAll(".filter-menu__item");
  const defaultLabel = label.textContent;

  // If an item is pre-marked .is-selected in HTML, sync the trigger label
  const preselected = dropdown.querySelector(".filter-menu__item.is-selected");
  let currentValue = preselected ? preselected.dataset.value : "";

  function open() {
    menu.hidden = false;
    dropdown.dataset.open = "true";
    toggle.setAttribute("aria-expanded", "true");
  }
  function close() {
    menu.hidden = true;
    dropdown.dataset.open = "false";
    toggle.setAttribute("aria-expanded", "false");
  }
  function setSelection(value) {
    currentValue = value;
    items.forEach((it) => {
      it.classList.toggle("is-selected", it.dataset.value === value);
    });
    if (value) {
      const matched = dropdown.querySelector(`.filter-menu__item[data-value="${value}"] .filter-menu__label`);
      label.textContent = matched ? matched.textContent : defaultLabel;
    } else {
      label.textContent = defaultLabel;
    }
    if (onSelect) onSelect(value);
  }

  toggle.addEventListener("click", () => {
    // No stopPropagation — we WANT the click to bubble to document so that
    // any other open dropdown sees this click as "outside" and closes.
    menu.hidden ? open() : close();
  });

  items.forEach((item) => {
    item.addEventListener("click", () => {
      const value = item.dataset.value;
      const next = toggleable && value === currentValue ? "" : value;
      setSelection(next);
      close();
    });
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) close();
  });

  return { setSelection, open, close };
}

/* ---------- Wire up the two dropdowns ---------- */

setupDropdown(document.querySelector('.filter-dropdown[data-filter="league"]'), {
  onSelect: (value) => {
    activeLeague = value;
    applyFilters();
  },
});

// Time filter is visual-only for now (no real timestamp data on rows).
// Selecting an option just updates the trigger label + checkmark.
setupDropdown(document.querySelector('.filter-dropdown[data-filter="time"]'), {
  toggleable: false, // "All time" is a real selectable item, not a clear state
  onSelect: (_value) => {
    /* Hook up real time-window filtering here once rows have timestamps */
  },
});

/* ---------- Rank range filter ----------
   Dual-thumb slider + Min/Max number inputs that stay in sync. Empty
   inputs (or values at the bounds 1 / TOTAL) mean "no constraint" on
   that side. Trigger label collapses to "Rank range" when both bounds
   are at the defaults, otherwise shows "min–max". */
function setupRangeFilter({ selector, minBound, maxBound, state, formatNumber }) {
  const dropdown = document.querySelector(selector);
  if (!dropdown) return;

  // Reuse open/close + click-outside (no .filter-menu__item to wire up)
  setupDropdown(dropdown);

  const triggerLabel = dropdown.querySelector(".filter-btn__label");
  const sliderMin = dropdown.querySelector(".range-slider__input--min");
  const sliderMax = dropdown.querySelector(".range-slider__input--max");
  const inputMin = dropdown.querySelector('.range-input__number[data-bound="min"]');
  const inputMax = dropdown.querySelector('.range-input__number[data-bound="max"]');
  const fill = dropdown.querySelector(".range-slider__fill");
  const DEFAULT_LABEL = triggerLabel.textContent;
  const span = maxBound - minBound;

  function syncUI() {
    sliderMin.value = state.min;
    sliderMax.value = state.max;
    // Show empty inputs at default bounds so the "0" placeholder reads as "untouched"
    inputMin.value = state.min === minBound ? "" : state.min;
    inputMax.value = state.max === maxBound ? "" : state.max;

    fill.style.left = ((state.min - minBound) / span) * 100 + "%";
    fill.style.width = ((state.max - state.min) / span) * 100 + "%";

    if (state.min === minBound && state.max === maxBound) {
      triggerLabel.textContent = DEFAULT_LABEL;
    } else {
      triggerLabel.textContent = `${formatNumber(state.min)}–${formatNumber(state.max)}`;
    }

    applyFilters();
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  // Slider drags — clamp so min thumb can't pass max thumb and vice versa
  sliderMin.addEventListener("input", () => {
    state.min = Math.min(parseInt(sliderMin.value, 10), state.max);
    syncUI();
  });
  sliderMax.addEventListener("input", () => {
    state.max = Math.max(parseInt(sliderMax.value, 10), state.min);
    syncUI();
  });

  // Number-field changes — fire on blur or Enter (`change` event)
  inputMin.addEventListener("change", () => {
    const v = parseInt(inputMin.value, 10);
    state.min = isNaN(v) ? minBound : clamp(v, minBound, state.max);
    syncUI();
  });
  inputMax.addEventListener("change", () => {
    const v = parseInt(inputMax.value, 10);
    state.max = isNaN(v) ? maxBound : clamp(v, state.min, maxBound);
    syncUI();
  });

  syncUI(); // initial render of fill bar + label
}

// Rank range — plain integer formatting
setupRangeFilter({
  selector: '.filter-dropdown[data-filter="rank"]',
  minBound: RANK_MIN_BOUND,
  maxBound: RANK_MAX_BOUND,
  state: rankRange,
  formatNumber: (n) => n.toLocaleString(),
});

// Gems range — abbreviate with "K" so the trigger label stays compact
function formatGems(n) {
  if (n >= 1000) {
    const k = n / 1000;
    return (Number.isInteger(k) ? k : k.toFixed(1)) + "K";
  }
  return n.toString();
}
setupRangeFilter({
  selector: '.filter-dropdown[data-filter="gems"]',
  minBound: GEMS_MIN_BOUND,
  maxBound: GEMS_MAX_BOUND,
  state: gemsRange,
  formatNumber: formatGems,
});
