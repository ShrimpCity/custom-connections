let PUZZLES = [];
let currentPuzzle = null;

let state = {
  tiles: [],             // { word, selected, locked }
  selected: new Set(),   // indices
  solved: [],            // { label, words[] }
  mistakesUsed: 0,
  mistakesMax: 4
};

const $ = (id) => document.getElementById(id);
function todayISO() {
  // Uses the visitor's local timezone (which is what you want for a daily puzzle experience).
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function findDailyPuzzle() {
  // Priority:
  // 1) Exact match for today's date
  // 2) Most recent puzzle in the past (by date)
  // 3) Fallback: highest id
  const today = todayISO();

  const dated = PUZZLES
    .filter(p => typeof p.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.date))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date)); // ascending

  const exact = dated.find(p => p.date === today);
  if (exact) return exact;

  // Most recent past date:
  const past = dated.filter(p => p.date < today);
  if (past.length) return past[past.length - 1];

  // Fallback: highest id:
  const byId = PUZZLES.slice().sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  return byId[0] || null;
}
function setView(view) {
  const library = $("libraryView");
  const game = $("gameView");
  if (view === "library") {
    library.classList.remove("hidden");
    game.classList.add("hidden");
    $("status").textContent = "";
  } else {
    library.classList.add("hidden");
    game.classList.remove("hidden");
  }
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function allPuzzleWords(puzzle) {
  return puzzle.groups.flatMap(g => g.words.map(w => w.toUpperCase()));
}

function normalizeWord(w) {
  return (w || "").trim().toUpperCase();
}

function renderLibrary() {
  const list = $("libraryList");
  list.innerHTML = "";

  PUZZLES
    .slice()
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
    .forEach(p => {
      const card = document.createElement("div");
      card.className = "puzzleCard";
      card.tabIndex = 0;
      const date = p.date ? `• ${p.date}` : "";
      card.innerHTML = `
        <h3>${escapeHtml(p.title || `Puzzle ${p.id}`)}</h3>
        <div class="small">ID: ${p.id} ${date}</div>
        <div class="small">Click to play</div>
      `;
      card.addEventListener("click", () => goToPuzzle(p.id));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") goToPuzzle(p.id);
      });
      list.appendChild(card);
    });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function initPuzzle(puzzle) {
  currentPuzzle = puzzle;
  state.solved = [];
  state.mistakesUsed = 0;
  state.mistakesMax = 4;
  state.selected = new Set();

  const words = allPuzzleWords(puzzle);
  const tiles = words.map(w => ({ word: w, selected: false, locked: false }));
  state.tiles = shuffleArray(tiles);

  $("puzzleTitle").textContent = puzzle.title || `Puzzle ${puzzle.id}`;
  $("puzzleMeta").textContent = puzzle.date ? `Date: ${puzzle.date} • Puzzle ID: ${puzzle.id}` : `Puzzle ID: ${puzzle.id}`;

  $("mistakesUsed").textContent = String(state.mistakesUsed);
  $("mistakesMax").textContent = String(state.mistakesMax);

  $("status").textContent = "";
  $("status").className = "status";

  renderSolved();
  renderGrid();
  updateSubmit();
  setView("game");
}

function renderSolved() {
  const wrap = $("solvedWrap");
  wrap.innerHTML = "";

  state.solved.forEach(s => {
    const row = document.createElement("div");
    row.className = "solvedRow";
    row.innerHTML = `
      <div class="label">${escapeHtml(s.label)}</div>
      <div class="words">${escapeHtml(s.words.join(" • "))}</div>
    `;
    wrap.appendChild(row);
  });
}

function renderGrid() {
  const grid = $("grid");
  grid.innerHTML = "";

  state.tiles.forEach((t, idx) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.setAttribute("role", "gridcell");
    tile.setAttribute("aria-label", t.word);

    if (t.selected) tile.classList.add("selected");
    if (t.locked) tile.classList.add("locked");

    tile.textContent = t.word;

    tile.addEventListener("click", () => {
      if (t.locked) return;
      toggleSelect(idx);
    });

    grid.appendChild(tile);
  });
}

function toggleSelect(index) {
  const t = state.tiles[index];
  if (!t || t.locked) return;

  if (t.selected) {
    t.selected = false;
    state.selected.delete(index);
  } else {
    if (state.selected.size >= 4) return; // limit selection
    t.selected = true;
    state.selected.add(index);
  }
  $("status").textContent = "";
  $("status").className = "status";
  renderGrid();
  updateSubmit();
}

function clearSelection() {
  state.selected.forEach(i => { state.tiles[i].selected = false; });
  state.selected = new Set();
  renderGrid();
  updateSubmit();
}

function updateSubmit() {
  $("submitBtn").disabled = state.selected.size !== 4;
  $("submitBtn").textContent = state.selected.size === 4 ? "Submit 4" : `Select 4 (${state.selected.size}/4)`;
}

function selectedWords() {
  return Array.from(state.selected).map(i => state.tiles[i].word);
}

function isGroupMatch(selWords, groupWords) {
  const a = selWords.map(normalizeWord).sort().join("|");
  const b = groupWords.map(normalizeWord).sort().join("|");
  return a === b;
}

function submitSelection() {
  if (!currentPuzzle) return;
  if (state.selected.size !== 4) return;

  const sel = selectedWords();
  const alreadySolvedLabels = new Set(state.solved.map(s => s.label));

  // Check for correct group
  const match = currentPuzzle.groups.find(g => {
    if (alreadySolvedLabels.has(g.label)) return false;
    return isGroupMatch(sel, g.words);
  });

  if (match) {
    // lock those tiles and record solved
    const indices = Array.from(state.selected);
    indices.forEach(i => {
      state.tiles[i].locked = true;
      state.tiles[i].selected = false;
    });

    state.solved.push({ label: match.label, words: match.words.map(normalizeWord) });

    state.selected = new Set();

    $("status").textContent = "Correct group!";
    $("status").className = "status good";

    renderSolved();
    renderGrid();
    updateSubmit();

    if (state.solved.length === 4) {
      $("status").textContent = "Solved! Nice work.";
      $("status").className = "status good";
    }
  } else {
    state.mistakesUsed += 1;
    $("mistakesUsed").textContent = String(state.mistakesUsed);

    $("status").textContent = "Not quite. Try again.";
    $("status").className = "status bad";

    if (state.mistakesUsed >= state.mistakesMax) {
      $("status").textContent = "Out of mistakes. Use Reveal to see the answers.";
      $("status").className = "status bad";
      clearSelection();
    }
  }
}

function shuffleUnsolved() {
  // Shuffle only the unlocked tiles, keep locked tiles in place
  const unlockedIndices = [];
  const unlockedTiles = [];
  state.tiles.forEach((t, i) => {
    if (!t.locked) {
      unlockedIndices.push(i);
      unlockedTiles.push(t);
    }
  });

  shuffleArray(unlockedTiles);
  unlockedIndices.forEach((idx, k) => {
    state.tiles[idx] = unlockedTiles[k];
  });

  // Rebuild selection references (selection is by index, so safest is to clear)
  state.selected = new Set();
  state.tiles.forEach(t => (t.selected = false));

  renderGrid();
  updateSubmit();
}

function revealAll() {
  if (!currentPuzzle) return;

  // Solve remaining groups
  const solvedLabels = new Set(state.solved.map(s => s.label));
  currentPuzzle.groups.forEach(g => {
    if (!solvedLabels.has(g.label)) {
      state.solved.push({ label: g.label, words: g.words.map(normalizeWord) });
    }
  });

  // Lock everything
  state.tiles.forEach(t => {
    t.locked = true;
    t.selected = false;
  });
  state.selected = new Set();

  $("status").textContent = "Revealed all answers.";
  $("status").className = "status";

  renderSolved();
  renderGrid();
  updateSubmit();
}

function copyShareLink() {
  if (!currentPuzzle) return;
  const url = `${location.origin}${location.pathname}#puzzle=${currentPuzzle.id}`;
  navigator.clipboard.writeText(url).then(() => {
    $("status").textContent = "Share link copied to clipboard.";
    $("status").className = "status good";
  }).catch(() => {
    $("status").textContent = "Could not copy automatically. You can copy the URL from your address bar.";
    $("status").className = "status";
  });
}

function goToPuzzle(id) {
  location.hash = `#puzzle=${id}`;
}

function parseHash() {
  const h = location.hash || "";
  const m = h.match(/puzzle=(\d+)/i);
  return m ? Number(m[1]) : null;
}

function route() {
  const id = parseHash();

  // If a specific puzzle is requested in the URL, load it.
  if (id) {
    const puzzle = PUZZLES.find(p => Number(p.id) === Number(id));
    if (puzzle) {
      initPuzzle(puzzle);
      return;
    }
    // If the hash is invalid, fall through to daily behavior.
  }

  // DAILY MODE:
  // If no #puzzle= is provided, automatically load today's puzzle (or closest fallback).
  const daily = findDailyPuzzle();
  if (daily) {
    initPuzzle(daily);
    return;
  }

  // If there are no puzzles at all, show library (edge case).
  setView("library");
}

async function loadPuzzles() {
  const res = await fetch("puzzles.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load puzzles.json");
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("puzzles.json must be an array");
  PUZZLES = data;
}

function wireEvents() {
  $("homeBtn").addEventListener("click", () => {
    location.hash = "";
  });
  $("resetBtn").addEventListener("click", () => {
    clearSelection();
    $("status").textContent = "Selection cleared.";
    $("status").className = "status";
  });

  $("submitBtn").addEventListener("click", submitSelection);
  $("shuffleBtn").addEventListener("click", () => {
    shuffleUnsolved();
    $("status").textContent = "Shuffled.";
    $("status").className = "status";
  });
  $("revealBtn").addEventListener("click", revealAll);
  $("copyLinkBtn").addEventListener("click", copyShareLink);

  window.addEventListener("hashchange", route);
}

(async function main(){
  try{
    wireEvents();
    await loadPuzzles();
    renderLibrary();
    route();
  }catch(err){
    console.error(err);
    setView("library");
    $("libraryList").innerHTML = `<div class="status bad">Error loading puzzles. Make sure <code>puzzles.json</code> is in the same folder.</div>`;
  }
})();
