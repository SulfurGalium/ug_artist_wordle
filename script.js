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

function normalizeRapper(item) {
  return {
    name: item.name || "",
    gender: item.gender || "Unknown",
    genre: item.genre || "Unknown",
    region: item.region || "Unknown",
    groups: item.groups || "Solo",
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
const CATS = ["gender","genre","region","groups","label","followers"];
const CAT_LABELS = {
  gender: "Gender",
  genre: "Genre",
  region: "Region",
  groups: "Group",
  label: "Label type",
  followers: "Followers"
};
const MAX_GUESSES = 6;
const HINTERS = [
  rap => `This artist is from ${rap.region}.`,
  rap => `Label type: ${rap.label}.`,
  rap => rap.groups === "Solo" ? "This rapper performs solo." : `Part of ${rap.groups}.`,
  rap => `Genre clue: ${rap.genre}.`,
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

function renderRow(rapper) {
  const tbody = document.getElementById("guess-body");
  const tr = document.createElement("tr");
  tr.className = "guess-row";

  const nameTd = document.createElement("td");
  nameTd.dataset.label = "Rapper";
  nameTd.textContent = rapper.name;
  tr.appendChild(nameTd);

  CATS.forEach(cat => {
    const td = document.createElement("td");
    td.dataset.label = CAT_LABELS[cat];
    const span = document.createElement("span");
    
    let isMatch = rapper[cat] === answer[cat];
    let displayText = rapper[cat];
    
    // Special handling for followers: add arrow if counts differ
    if (cat === "followers" && !isMatch && rapper.followersCount && answer.followersCount) {
      const arrow = rapper.followersCount < answer.followersCount ? " ↑" : " ↓";
      displayText = rapper[cat] + arrow;
    }
    
    span.className = "cell " + (isMatch ? "correct" : "wrong");
    span.textContent = displayText;
    td.appendChild(span);
    tr.appendChild(td);
  });

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
