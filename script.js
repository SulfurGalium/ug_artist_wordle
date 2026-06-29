const RAPPERS = [];

function formatFollowers(value) {
  if (value === undefined || value === null || value === "N/A") return "N/A";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    return value.toString();
  }
  return String(value);
}

// "Experimental, Rage, Hyperpop" -> ["Experimental", "Rage", "Hyperpop"]
// Always normalized to exactly 3 slots (padded with "Unknown" if short).
function parseGenres(value) {
  const parts = (value || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  while (parts.length < 3) parts.push("Unknown");
  return parts.slice(0, 3);
}

// "London, UK" -> { city: "London", country: "UK", direction: null }
// "Atlanta, US, South" -> { city: "Atlanta", country: "US", direction: "South" }
function parseRegion(value) {
  const parts = (value || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return {
    city: parts[0] || "Unknown",
    country: parts[1] || parts[0] || "Unknown",
    direction: parts[2] || null
  };
}

function normalizeRapper(item) {
  return {
    name: item.name || "",
    biggestCollab: item.biggest_collab || item.biggestCollab || "Unknown",
    genres: parseGenres(item.genre),
    region: parseRegion(item.region),
    label: item.label || item.label_type || "Unknown",
    followers: formatFollowers(item.followers),
    followersCount: typeof item.followers === "number" ? item.followers : 0,
    hint: item.hint || null
  };
}

async function loadRappers() {
  try {
    const resp = await fetch("artists.json");
    if (!resp.ok) throw new Error(`Failed to load artists.json: ${resp.status}`);
    const data = await resp.json();
    RAPPERS.length = 0;
    data.forEach(item => RAPPERS.push(normalizeRapper(item)));
  } catch (err) {
    showAlert(`Could not load artists.json: ${err.message}`, 4000);
  }
}

// ============================================================
// GAME LOGIC
// ============================================================
const MAX_GUESSES = 6;
const HINTERS = [
  rap => `This artist is from ${rap.region.country}${rap.region.direction ? ` (${rap.region.direction})` : ""}.`,
  rap => `Label type: ${rap.label}.`,
  rap => `Biggest collab: ${rap.biggestCollab}.`,
  rap => `One of their genres: ${rap.genres[Math.floor(Math.random() * rap.genres.length)]}.`,
  rap => `Followers clue: ${rap.followers}.`
];
let answer = null;
let guesses = [];
let gameOver = true;
let hintUsed = false;

function getUtcDaySeed() {
  return new Date().toISOString().slice(0, 10);
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = hashSeed(seed);
  return function nextRandom() {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function showAlert(msg, duration = 1800) {
  const container = document.getElementById("alert-container");
  const el = document.createElement("div");
  el.className = "alert";
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("hide");
    el.addEventListener("transitionend", () => el.remove());
  }, duration);
}

function showHint() {
  if (gameOver || hintUsed || !answer) return;
  const hintText = document.getElementById("hint-text");
  const hint = answer.hint
    ? answer.hint
    : HINTERS[Math.floor(Math.random() * HINTERS.length)](answer);
  hintText.textContent = `Hint: ${hint}`;
  document.getElementById("hint-btn").disabled = true;
  hintUsed = true;
}

function pickAnswer() {
  if (!RAPPERS.length) return null;
  return RAPPERS[Math.floor(Math.random() * RAPPERS.length)];
}

function pickDailyAnswer() {
  if (!RAPPERS.length) return null;
  const random = seededRandom(getUtcDaySeed());
  return RAPPERS[Math.floor(random() * RAPPERS.length)];
}

function resetGame(mode = "daily") {
  answer = mode === "random" ? pickAnswer() : pickDailyAnswer();
  if (!answer) {
    gameOver = true;
    document.getElementById("guess-body").innerHTML = "";
    document.getElementById("guess-input").disabled = true;
    document.getElementById("guess-btn").disabled = true;
    document.getElementById("hint-btn").disabled = true;
    document.getElementById("hint-text").textContent = "Artist data could not be loaded.";
    document.getElementById("guesses-left").textContent = "";
    document.getElementById("reset-btn").style.display = "none";
    return;
  }
  guesses = [];
  gameOver = false;
  hintUsed = false;
  document.getElementById("guess-body").innerHTML = "";
  document.getElementById("guess-input").value = "";
  document.getElementById("guess-input").disabled = false;
  document.getElementById("guess-btn").disabled = false;
  document.getElementById("hint-btn").disabled = false;
  document.getElementById("hint-text").textContent = "Need a clue? Tap hint and get a rapper fact.";
  document.getElementById("reset-btn").style.display = "none";
  updateLeft();
}

async function initGame() {
  await loadRappers();
  resetGame();
}

function updateLeft() {
  const rem = MAX_GUESSES - guesses.length;
  document.getElementById("guesses-left").textContent = gameOver
    ? ""
    : `${rem} guess${rem !== 1 ? "es" : ""} remaining`;
}

function submitGuess() {
  if (gameOver || !answer) return;
  const val = document.getElementById("guess-input").value.trim();
  const rapper = RAPPERS.find(r => r.name.toLowerCase() === val.toLowerCase());
  if (!rapper) { showAlert("Not in the list — check spelling."); return; }
  if (guesses.find(g => g.name === rapper.name)) { showAlert("Already guessed that one."); return; }

  guesses.push(rapper);
  renderRow(rapper);
  document.getElementById("guess-input").value = "";
  document.getElementById("suggestions").style.display = "none";
  updateLeft();

  if (rapper.name === answer.name) {
    showAlert(`${answer.name} — correct in ${guesses.length}/${MAX_GUESSES}!`, 3000);
    showConfetti();
    endGame();
  } else if (guesses.length >= MAX_GUESSES) {
    showAlert(`The answer was ${answer.name}.`, 4000);
    endGame();
  }
}

function showConfetti() {
  const container = document.getElementById("confetti");
  if (!container) return;
  container.innerHTML = "";
  const colors = ["#538d4e", "#b59f3b", "#3a3a3c", "#d7dadc"];

  for (let i = 0; i < 35; i += 1) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = `${6 + Math.random() * 8}px`;
    piece.style.height = `${6 + Math.random() * 8}px`;
    piece.style.opacity = `${0.7 + Math.random() * 0.3}`;
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    container.appendChild(piece);
  }

  setTimeout(() => {
    container.innerHTML = "";
  }, 2800);
}

function endGame() {
  gameOver = true;
  document.getElementById("guess-btn").disabled = true;
  document.getElementById("guess-input").disabled = true;
  document.getElementById("hint-btn").disabled = true;
  document.getElementById("guesses-left").textContent = "";
  document.getElementById("reset-btn").style.display = "inline-block";
}

// Genre matching is order-independent: a guessed genre is "correct" (green)
// if it appears anywhere in the answer's 3 genres, regardless of which slot
// it's in. No partial/yellow tier for genre — position doesn't matter.
function matchGenres(guessGenres, answerGenres) {
  return guessGenres.map(g => (answerGenres.includes(g) ? "correct" : "wrong"));
}

// Region match is a single cell: full match (country + direction) is
// "correct", same country but different US direction is "partial",
// different country entirely is "wrong".
function matchRegion(guessRegion, answerRegion) {
  if (guessRegion.country !== answerRegion.country) return "wrong";
  if ((guessRegion.direction || null) === (answerRegion.direction || null)) return "correct";
  return "partial";
}

function regionDisplay(region) {
  return region.direction ? `${region.country} · ${region.direction}` : region.country;
}

function renderRow(rapper) {
  const tbody = document.getElementById("guess-body");
  const tr = document.createElement("tr");
  tr.className = "guess-row";

  const nameTd = document.createElement("td");
  nameTd.dataset.label = "Rapper";
  nameTd.textContent = rapper.name;
  tr.appendChild(nameTd);

  // Genre: 3 sub-cells in one column
  const genreTd = document.createElement("td");
  genreTd.dataset.label = "Genre";
  const genreWrap = document.createElement("div");
  genreWrap.className = "genre-wrap";
  const genreResults = matchGenres(rapper.genres, answer.genres);
  rapper.genres.forEach((g, i) => {
    const span = document.createElement("span");
    const status = genreResults[i];
    span.className = "cell genre-cell " + (status === "correct" ? "correct" : "wrong");
    span.textContent = g;
    genreWrap.appendChild(span);
  });
  genreTd.appendChild(genreWrap);
  tr.appendChild(genreTd);

  // Region: single cell, two-tier match
  const regionTd = document.createElement("td");
  regionTd.dataset.label = "Region";
  const regionSpan = document.createElement("span");
  const regionStatus = matchRegion(rapper.region, answer.region);
  regionSpan.className = "cell " + (regionStatus === "correct" ? "correct" : regionStatus === "partial" ? "partial" : "wrong");
  regionSpan.textContent = regionDisplay(rapper.region);
  regionTd.appendChild(regionSpan);
  tr.appendChild(regionTd);

  // Biggest collab: exact match only
  const collabTd = document.createElement("td");
  collabTd.dataset.label = "Biggest Collab";
  const collabSpan = document.createElement("span");
  const collabMatch = rapper.biggestCollab.toLowerCase() === answer.biggestCollab.toLowerCase();
  collabSpan.className = "cell " + (collabMatch ? "correct" : "wrong");
  collabSpan.textContent = rapper.biggestCollab;
  collabTd.appendChild(collabSpan);
  tr.appendChild(collabTd);

  // Label: exact match only
  const labelTd = document.createElement("td");
  labelTd.dataset.label = "Label Type";
  const labelSpan = document.createElement("span");
  const labelMatch = rapper.label === answer.label;
  labelSpan.className = "cell " + (labelMatch ? "correct" : "wrong");
  labelSpan.textContent = rapper.label;
  labelTd.appendChild(labelSpan);
  tr.appendChild(labelTd);

  // Followers: exact match, with directional arrow hint when wrong.
  // If either side has no follower count yet (data not filled in), show a
  // neutral "N/A" cell instead of a false "correct" match.
  const followersTd = document.createElement("td");
  followersTd.dataset.label = "Followers";
  const followersSpan = document.createElement("span");
  const hasData = Boolean(rapper.followersCount) && Boolean(answer.followersCount);
  const followersMatch = hasData && rapper.followers === answer.followers;
  let followersText = rapper.followers;
  if (hasData && !followersMatch) {
    const arrow = rapper.followersCount < answer.followersCount ? " ↑" : " ↓";
    followersText = rapper.followers + arrow;
  }
  followersSpan.className = "cell " + (!hasData ? "wrong" : followersMatch ? "correct" : "wrong");
  followersSpan.textContent = followersText;
  followersTd.appendChild(followersSpan);
  tr.appendChild(followersTd);

  tbody.insertBefore(tr, tbody.firstChild);
}

const input = document.getElementById("guess-input");
const sugBox = document.getElementById("suggestions");

input.addEventListener("input", () => {
  const q = input.value.trim().toLowerCase();
  if (!q) { sugBox.style.display = "none"; return; }
  const guessed = guesses || [];
  const matches = RAPPERS.filter(r =>
    r.name.toLowerCase().includes(q) && !guessed.find(g => g.name === r.name)
  );
  if (!matches.length) { sugBox.style.display = "none"; return; }
  sugBox.innerHTML = "";
  matches.slice(0, 6).forEach(r => {
    const d = document.createElement("div");
    d.textContent = r.name;
    d.onmousedown = () => { input.value = r.name; sugBox.style.display = "none"; };
    sugBox.appendChild(d);
  });
  sugBox.style.display = "block";
});

input.addEventListener("keydown", e => {
  if (e.key === "Enter") { sugBox.style.display = "none"; submitGuess(); }
  if (e.key === "Escape") sugBox.style.display = "none";
});

document.addEventListener("click", e => {
  if (!e.target.closest(".input-wrap")) sugBox.style.display = "none";
});

initGame();
