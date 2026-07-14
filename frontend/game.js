"use strict";

const BOARD_SIZE = 4;
const TARGET = 2048;
const VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
const STORAGE_KEY = "frog-2048-state-v1";
const BEST_KEY = "frog-2048-best-v1";
const SCALE_KEY = "frog-2048-scale-v1";
const UNDO_KEY = "frog-2048-undo-v1";

const FROG_NAMES = {
  2: "Малышка",
  4: "Серьёзная",
  8: "Храбрая",
  16: "Ниндзя",
  32: "Лесная",
  64: "Волшебница",
  128: "Рыцарь",
  256: "Королева",
  512: "Кибержаба",
  1024: "Тёмная жаба",
  2048: "Легендарная жаба"
};

const elements = {
  board: document.querySelector("#game-board"),
  gameCard: document.querySelector("#game-card"),
  scale: document.querySelector("#game-scale"),
  scaleValue: document.querySelector("#game-scale-value"),
  tiles: document.querySelector("#tiles-layer"),
  score: document.querySelector("#score"),
  scoreCard: document.querySelector("#score-card"),
  scoreGain: document.querySelector("#score-gain"),
  best: document.querySelector("#best-score"),
  newGame: document.querySelector("#new-game"),
  undo: document.querySelector("#undo"),
  message: document.querySelector("#game-message"),
  messageTitle: document.querySelector("#message-title"),
  messageText: document.querySelector("#message-text"),
  messageFrog: document.querySelector("#message-frog"),
  messageNewGame: document.querySelector("#message-new-game"),
  keepPlaying: document.querySelector("#keep-playing"),
  evolution: document.querySelector("#evolution-track"),
  progress: document.querySelector("#progress-label"),
  tileTemplate: document.querySelector("#tile-template")
};

let state = createInitialState();
let previousState = null;
let touchStart = null;
let scoreAnimationTimer = null;

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

function createInitialState() {
  return {
    board: emptyBoard(),
    score: 0,
    best: Number(localStorage.getItem(BEST_KEY)) || 0,
    reachedTarget: false,
    keepPlaying: false,
    gameOver: false,
    highest: 2
  };
}

function cloneState(source) {
  return {
    ...source,
    board: source.board.map((row) => [...row])
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.setItem(BEST_KEY, String(state.best));

  if (previousState) {
    localStorage.setItem(UNDO_KEY, JSON.stringify(previousState));
  } else {
    localStorage.removeItem(UNDO_KEY);
  }
}

function isValidStoredState(candidate) {
  if (!candidate || !Array.isArray(candidate.board) || candidate.board.length !== BOARD_SIZE) return false;
  return candidate.board.every((row) => (
    Array.isArray(row)
    && row.length === BOARD_SIZE
    && row.every((cell) => Number.isFinite(Number(cell)) && Number(cell) >= 0)
  ));
}

function normalizeStoredState(saved) {
  return {
    ...createInitialState(),
    ...saved,
    best: Math.max(Number(saved.best) || 0, Number(localStorage.getItem(BEST_KEY)) || 0),
    board: saved.board.map((row) => row.map((cell) => Number(cell) || 0))
  };
}

function loadUndoState() {
  try {
    const savedUndo = JSON.parse(localStorage.getItem(UNDO_KEY));
    if (!isValidStoredState(savedUndo)) return null;
    return normalizeStoredState(savedUndo);
  } catch {
    return null;
  }
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!isValidStoredState(saved)) return false;

    state = normalizeStoredState(saved);
    state.highest = getHighestTile();
    state.gameOver = !hasAvailableMove();
    previousState = loadUndoState();
    return true;
  } catch {
    return false;
  }
}

function startNewGame() {
  state = createInitialState();
  previousState = null;
  addRandomTile();
  addRandomTile();
  saveState();
  render();
  elements.board.focus({ preventScroll: true });
}

function getEmptyCells() {
  const cells = [];
  state.board.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (value === 0) cells.push({ row: rowIndex, column: columnIndex });
    });
  });
  return cells;
}

function addRandomTile() {
  const emptyCells = getEmptyCells();
  if (!emptyCells.length) return;
  const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  state.board[cell.row][cell.column] = Math.random() < 0.9 ? 2 : 4;
}

function mergeLine(line) {
  const compact = line.filter(Boolean);
  const merged = [];
  let gained = 0;

  for (let index = 0; index < compact.length; index += 1) {
    if (compact[index] === compact[index + 1]) {
      const value = compact[index] * 2;
      merged.push(value);
      gained += value;
      index += 1;
    } else {
      merged.push(compact[index]);
    }
  }

  while (merged.length < BOARD_SIZE) merged.push(0);
  return { line: merged, gained };
}

function arraysEqual(first, second) {
  return first.every((value, index) => value === second[index]);
}

function move(direction) {
  if (state.gameOver || (state.reachedTarget && !state.keepPlaying)) return;

  const beforeMove = cloneState(state);
  let changed = false;
  let gained = 0;
  const nextBoard = emptyBoard();

  for (let outer = 0; outer < BOARD_SIZE; outer += 1) {
    let source;

    if (direction === "left" || direction === "right") {
      source = [...state.board[outer]];
    } else {
      source = state.board.map((row) => row[outer]);
    }

    const shouldReverse = direction === "right" || direction === "down";
    const working = shouldReverse ? [...source].reverse() : source;
    const result = mergeLine(working);
    const finalLine = shouldReverse ? result.line.reverse() : result.line;

    gained += result.gained;
    if (!arraysEqual(source, finalLine)) changed = true;

    for (let inner = 0; inner < BOARD_SIZE; inner += 1) {
      if (direction === "left" || direction === "right") {
        nextBoard[outer][inner] = finalLine[inner];
      } else {
        nextBoard[inner][outer] = finalLine[inner];
      }
    }
  }

  if (!changed) return;

  previousState = beforeMove;
  state.board = nextBoard;
  state.score += gained;
  state.best = Math.max(state.best, state.score);
  addRandomTile();
  state.highest = getHighestTile();

  if (state.highest >= TARGET && !state.reachedTarget) {
    state.reachedTarget = true;
    state.keepPlaying = false;
  }

  state.gameOver = !hasAvailableMove();
  saveState();
  render();
  showScoreGain(gained);
}

function getHighestTile() {
  return Math.max(2, ...state.board.flat());
}

function hasAvailableMove() {
  if (state.board.flat().includes(0)) return true;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const current = state.board[row][column];
      if (column + 1 < BOARD_SIZE && current === state.board[row][column + 1]) return true;
      if (row + 1 < BOARD_SIZE && current === state.board[row + 1][column]) return true;
    }
  }
  return false;
}

function frogAsset(value) {
  const capped = VALUES.findLast((candidate) => candidate <= value) || 2;
  return `assets/frogs/frog-${capped}.webp`;
}

function frogName(value) {
  const capped = VALUES.findLast((candidate) => candidate <= value) || 2;
  return FROG_NAMES[capped];
}

function renderTiles() {
  elements.tiles.replaceChildren();

  state.board.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (!value) return;

      const fragment = elements.tileTemplate.content.cloneNode(true);
      const tile = fragment.querySelector(".tile");
      const image = fragment.querySelector("img");
      tile.style.setProperty("--row", rowIndex);
      tile.style.setProperty("--column", columnIndex);
      tile.dataset.value = String(value);
      tile.setAttribute("role", "img");
      tile.setAttribute("aria-label", `${frogName(value)}, уровень ${value}`);
      if (value >= TARGET) tile.classList.add("tile--legendary");

      image.src = frogAsset(value);
      image.alt = "";
      elements.tiles.append(fragment);
    });
  });
}

function renderEvolution() {
  elements.evolution.replaceChildren();
  const unlockedIndex = Math.max(0, VALUES.findIndex((value) => value >= state.highest));
  const unlockedCount = VALUES.filter((value) => value <= state.highest).length;

  VALUES.forEach((value, index) => {
    const item = document.createElement("div");
    item.className = "evolution-item";
    if (value > state.highest) item.classList.add("evolution-item--locked");
    if (index === unlockedIndex) item.classList.add("evolution-item--current");

    const image = document.createElement("img");
    image.src = frogAsset(value);
    image.alt = value <= state.highest ? FROG_NAMES[value] : "Закрытая лягушка";
    image.loading = "lazy";

    const label = document.createElement("span");
    label.textContent = value <= state.highest ? FROG_NAMES[value] : "???";

    item.append(image, label);
    elements.evolution.append(item);
  });

  elements.progress.textContent = `Открыто ${unlockedCount} из ${VALUES.length}`;
}

function renderMessage() {
  const shouldShowWin = state.reachedTarget && !state.keepPlaying;
  const shouldShowLose = state.gameOver;

  if (!shouldShowWin && !shouldShowLose) {
    elements.message.hidden = true;
    return;
  }

  elements.message.hidden = false;
  if (shouldShowLose) {
    elements.messageTitle.textContent = "Болото заполнено";
    elements.messageText.textContent = `Счёт: ${state.score}. Попробуй вырастить жабу ещё раз.`;
    elements.messageFrog.src = frogAsset(state.highest);
    elements.messageFrog.alt = frogName(state.highest);
    elements.keepPlaying.hidden = true;
  } else {
    elements.messageTitle.textContent = "Легендарная жаба!";
    elements.messageText.textContent = "Ты прошла все 11 ступеней лягушачьей эволюции.";
    elements.messageFrog.src = frogAsset(TARGET);
    elements.messageFrog.alt = FROG_NAMES[TARGET];
    elements.keepPlaying.hidden = false;
  }
}

function formatScore(value) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function showScoreGain(gained) {
  if (!gained) return;

  window.clearTimeout(scoreAnimationTimer);
  elements.scoreGain.textContent = `+${formatScore(gained)}`;
  elements.scoreGain.classList.remove("score-gain--visible");
  elements.scoreCard.classList.remove("score-card--pulse");
  void elements.scoreGain.offsetWidth;
  elements.scoreGain.classList.add("score-gain--visible");
  elements.scoreCard.classList.add("score-card--pulse");

  scoreAnimationTimer = window.setTimeout(() => {
    elements.scoreGain.classList.remove("score-gain--visible");
    elements.scoreCard.classList.remove("score-card--pulse");
  }, 800);
}

function render() {
  elements.score.textContent = formatScore(state.score);
  elements.best.textContent = formatScore(state.best);
  elements.undo.disabled = previousState === null;
  renderTiles();
  renderEvolution();
  renderMessage();
}

function undoMove() {
  if (!previousState) return;
  const currentBest = state.best;
  state = previousState;
  state.best = Math.max(currentBest, state.best);
  previousState = null;
  saveState();
  render();
}

function continuePlaying() {
  state.keepPlaying = true;
  saveState();
  render();
  elements.board.focus({ preventScroll: true });
}

function directionFromKey(key) {
  const map = {
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
    ArrowUp: "up", w: "up", W: "up",
    ArrowDown: "down", s: "down", S: "down"
  };
  return map[key];
}

function handleKeydown(event) {
  const target = event.target;
  const isFormControl = target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement;
  if (isFormControl) return;

  if ((event.key === "z" || event.key === "Z" || event.key === "u" || event.key === "U") && previousState) {
    event.preventDefault();
    undoMove();
    return;
  }

  const direction = directionFromKey(event.key);
  if (!direction) return;
  event.preventDefault();
  move(direction);
}

function handleTouchStart(event) {
  const touch = event.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}

function handleTouchEnd(event) {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStart.x;
  const deltaY = touch.clientY - touchStart.y;
  touchStart = null;

  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 28) return;
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    move(deltaX > 0 ? "right" : "left");
  } else {
    move(deltaY > 0 ? "down" : "up");
  }
}

function applyGameScale(value) {
  const min = Number(elements.scale.min);
  const max = Number(elements.scale.max);
  const scale = Math.min(max, Math.max(min, Number(value) || max));

  elements.scale.value = String(scale);
  elements.scaleValue.value = `${scale}%`;
  elements.scale.setAttribute("aria-valuetext", `${scale} процентов`);
  elements.gameCard.style.setProperty("--game-scale", `${scale}%`);
  localStorage.setItem(SCALE_KEY, String(scale));
}

function loadGameScale() {
  applyGameScale(localStorage.getItem(SCALE_KEY) || elements.scale.value);
}

elements.scale.addEventListener("input", (event) => applyGameScale(event.target.value));

elements.newGame.addEventListener("click", startNewGame);
elements.messageNewGame.addEventListener("click", startNewGame);
elements.undo.addEventListener("click", undoMove);
elements.keepPlaying.addEventListener("click", continuePlaying);
window.addEventListener("keydown", handleKeydown, { passive: false });
elements.board.addEventListener("touchstart", handleTouchStart, { passive: true });
elements.board.addEventListener("touchend", handleTouchEnd, { passive: true });

loadGameScale();
renderEvolution();
if (!loadState() || state.board.flat().every((value) => value === 0)) {
  startNewGame();
} else {
  render();
}
