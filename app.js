/**
 * TETRIS EL REY - RETRO-FUTURISTA VIP
 * Motor del juego optimizado para pantalla móvil completa:
 * - Múltiples estelas de luz individuales ascendentes desde cada sección superior
 * - Identificador de jugador en panel derecho: "Jugador El Rey #0001"
 * - Botón de pausa dedicado (centro e indicador superior)
 * - Botón "ROTAR" ergonómico
 * - Sin HOLD
 * - Cuadrícula de fibra de carbono y proporciones 100% respetadas
 */

/* ============================================================================
   CONSTANTES Y CONFIGURACIÓN DEL CASINO
   ============================================================================ */
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30; // 300x600 canvas nativo (aspect-ratio 1:2)

const TOPE_MAXIMO_FICHAS = 50000;
const FICHAS_POR_LINEA = 50;
const BONIFICACION_TETRIS_FICHAS = 100;
const PUNTOS_POR_LINEA = [0, 100, 300, 500, 800];
const LINEAS_POR_NIVEL = 10;
const VELOCIDAD_INICIAL_MS = 800;
const FACTOR_ACELERACION = 0.88;
const VELOCIDAD_MINIMA_MS = 80;
const BASURA_INTERVALO_LINEAS = 15;

// Paleta Neón Fiel a la Imagen de Referencia
const TETROMINO_COLORS = {
  I: { core: "#a5f3fc", main: "#06b6d4", dark: "#0e7490", glow: "rgba(6, 182, 212, 0.9)" },
  J: { core: "#bfdbfe", main: "#3b82f6", dark: "#1d4ed8", glow: "rgba(59, 130, 246, 0.9)" },
  L: { core: "#fed7aa", main: "#f97316", dark: "#c2410c", glow: "rgba(249, 115, 22, 0.9)" },
  O: { core: "#fef08a", main: "#eab308", dark: "#a16207", glow: "rgba(234, 179, 8, 0.9)" },
  S: { core: "#a7f3d0", main: "#22c55e", dark: "#15803d", glow: "rgba(34, 197, 94, 0.9)" },
  T: { core: "#f5d0fe", main: "#c026d3", dark: "#86198f", glow: "rgba(192, 38, 211, 0.9)" },
  Z: { core: "#fecaca", main: "#ef4444", dark: "#b91c1c", glow: "rgba(239, 68, 68, 0.9)" },
  GARBAGE: { core: "#9ca3af", main: "#374151", dark: "#111827", glow: "rgba(239, 68, 68, 0.6)" }
};

// Matrices de Tetrominós
const SHAPES = {
  I: [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
  J: [[1,0,0], [1,1,1], [0,0,0]],
  L: [[0,0,1], [1,1,1], [0,0,0]],
  O: [[1,1], [1,1]],
  S: [[0,1,1], [1,1,0], [0,0,0]],
  T: [[0,1,0], [1,1,1], [0,0,0]],
  Z: [[1,1,0], [0,1,1], [0,0,0]]
};

/* ============================================================================
   ESTADO DEL JUEGO
   ============================================================================ */
const state = {
  nickname: "",
  userCode: "",
  puntos: 0,
  fichas: 0,
  lineas: 0,
  nivel: 1,
  topeAlcanzado: false,

  grid: createEmptyGrid(),
  currentPiece: null,
  nextPiece: null,
  dropCounter: 0,
  dropInterval: VELOCIDAD_INICIAL_MS,
  lastTime: 0,
  isPlaying: false,
  isPaused: false,
  isGameOver: false,
  linesSinceLastGarbage: 0,
  soundEnabled: true,
  animationFrameId: null
};

/* ============================================================================
   SÍNTESIS DE AUDIO RETRO-FUTURISTA
   ============================================================================ */
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (AudioClass) {
      audioCtx = new AudioClass();
    }
  }
}

function triggerHaptic(duration = 10) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(duration);
    } catch (e) {
      // Ignorar restricciones en iframe
    }
  }
}

function playSound(type) {
  if (!state.soundEnabled) return;
  initAudio();
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  switch (type) {
    case "move":
      osc.type = "sine";
      osc.frequency.setValueAtTime(280, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.start(now);
      osc.stop(now + 0.035);
      break;

    case "rotate":
      osc.type = "triangle";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.06);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
      break;

    case "drop":
      osc.type = "square";
      osc.frequency.setValueAtTime(140, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
      break;

    case "line":
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.16);
      break;

    case "gameover":
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.45);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
      break;
  }
}

/* ============================================================================
   ELEMENTOS DEL DOM
   ============================================================================ */
const canvas = document.getElementById("tetris-canvas");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next-canvas");
const nextCtx = nextCanvas.getContext("2d");

// Estadísticas HUD
const metricScoreDisplay = document.getElementById("metric-score-display");
const metricLevelDisplay = document.getElementById("metric-level-display");
const metricLinesDisplay = document.getElementById("metric-lines-display");
const hudChipsCount = document.getElementById("hud-chips-count");
const playerNicknameDisplay = document.getElementById("player-nickname-display");
const playerCodeBadge = document.getElementById("player-code-badge");

// Modales y Alertas
const loginModal = document.getElementById("login-modal");
const loginForm = document.getElementById("login-form");
const playerNicknameInput = document.getElementById("player-nickname-input");
const playerCodeInput = document.getElementById("player-code-input");
const generateCodeBtn = document.getElementById("generate-code-btn");
const startGameBtn = document.getElementById("start-game-btn");
const startBtnSpinner = document.getElementById("start-btn-spinner");
const modalErrorMsg = document.getElementById("modal-error-msg");

const payoutModal = document.getElementById("payout-modal");
const payoutFichasAmount = document.getElementById("payout-fichas-amount");
const couponUserNickname = document.getElementById("coupon-user-nickname");
const couponUserCode = document.getElementById("coupon-user-code");
const couponLinesCleared = document.getElementById("coupon-lines-cleared");
const maxCapBanner = document.getElementById("max-cap-banner");
const whatsappPayoutBtn = document.getElementById("whatsapp-payout-btn");
const playAgainBtn = document.getElementById("play-again-btn");

const pauseOverlay = document.getElementById("pause-overlay");
const resumeBtn = document.getElementById("resume-btn");
const btnPauseHeader = document.getElementById("btn-pause-header");
const btnPauseMain = document.getElementById("btn-pause-main");
const audioToggleBtn = document.getElementById("audio-toggle-btn");
const floatingChipsContainer = document.getElementById("floating-chips-container");
const garbageToast = document.getElementById("garbage-toast");

// Controles Táctiles (Cruceta Verde + Botón ROTAR Dorado + Botón Redondo "A")
const btnDpadLeft = document.getElementById("btn-dpad-left");
const btnDpadRight = document.getElementById("btn-dpad-right");
const btnDpadDown = document.getElementById("btn-dpad-down");
const btnDpadUp = document.getElementById("btn-dpad-up");
const btnRotate = document.getElementById("btn-rotate");
const btnActionA = document.getElementById("btn-action-a");

/* ============================================================================
   1. GENERADOR DE PIEZAS (7-BAG RANDOMIZER)
   ============================================================================ */
let bag = [];

function getNextTetromino() {
  if (bag.length === 0) {
    const keys = ["I", "J", "L", "O", "S", "T", "Z"];
    bag = keys.sort(() => Math.random() - 0.5);
  }
  const type = bag.pop();
  return {
    type,
    matrix: SHAPES[type].map(row => [...row]),
    x: 0,
    y: 0
  };
}

function createEmptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function spawnNextPiece() {
  state.currentPiece = state.nextPiece || getNextTetromino();
  state.nextPiece = getNextTetromino();

  state.currentPiece.y = 0;
  state.currentPiece.x = Math.floor((COLS - state.currentPiece.matrix[0].length) / 2);

  if (checkCollision(state.currentPiece.x, state.currentPiece.y, state.currentPiece.matrix)) {
    triggerGameOver(false);
  }

  drawNextPiece();
}

/* ============================================================================
   2. DETECCIÓN DE COLISIÓN Y ROTACIÓN
   ============================================================================ */
function checkCollision(offsetX, offsetY, matrix) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) {
        const newX = offsetX + c;
        const newY = offsetY + r;

        if (newX < 0 || newX >= COLS || newY >= ROWS) {
          return true;
        }

        if (newY >= 0 && state.grid[newY][newX] !== 0) {
          return true;
        }
      }
    }
  }
  return false;
}

function rotateMatrix(matrix) {
  const N = matrix.length;
  const result = Array.from({ length: N }, () => Array(N).fill(0));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      result[c][N - 1 - r] = matrix[r][c];
    }
  }
  return result;
}

function tryRotatePiece() {
  if (!state.currentPiece || state.isPaused || state.isGameOver) return;

  const originalMatrix = state.currentPiece.matrix;
  const rotated = rotateMatrix(originalMatrix);

  const kicks = [0, -1, 1, -2, 2];
  for (let kick of kicks) {
    if (!checkCollision(state.currentPiece.x + kick, state.currentPiece.y, rotated)) {
      state.currentPiece.matrix = rotated;
      state.currentPiece.x += kick;
      playSound("rotate");
      triggerHaptic(12);
      return;
    }
  }
}

/* ============================================================================
   3. MOVIMIENTO Y CAÍDA
   ============================================================================ */
function moveHorizontal(dir) {
  if (!state.currentPiece || state.isPaused || state.isGameOver) return;
  if (!checkCollision(state.currentPiece.x + dir, state.currentPiece.y, state.currentPiece.matrix)) {
    state.currentPiece.x += dir;
    playSound("move");
    triggerHaptic(8);
  }
}

function softDrop() {
  if (!state.currentPiece || state.isPaused || state.isGameOver) return;
  if (!checkCollision(state.currentPiece.x, state.currentPiece.y + 1, state.currentPiece.matrix)) {
    state.currentPiece.y += 1;
    state.dropCounter = 0;
  } else {
    lockPiece();
  }
}

function hardDrop() {
  if (!state.currentPiece || state.isPaused || state.isGameOver) return;
  let cellsDropped = 0;
  while (!checkCollision(state.currentPiece.x, state.currentPiece.y + 1, state.currentPiece.matrix)) {
    state.currentPiece.y += 1;
    cellsDropped++;
  }
  playSound("drop");
  triggerHaptic(25);
  lockPiece();
}

function getGhostY() {
  if (!state.currentPiece) return 0;
  let ghostY = state.currentPiece.y;
  while (!checkCollision(state.currentPiece.x, ghostY + 1, state.currentPiece.matrix)) {
    ghostY++;
  }
  return ghostY;
}

function lockPiece() {
  const { x, y, matrix, type } = state.currentPiece;

  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c] !== 0) {
        if (y + r < 0) {
          triggerGameOver(false);
          return;
        }
        state.grid[y + r][x + c] = type;
      }
    }
  }

  clearFullLines();
  spawnNextPiece();
}

/* ============================================================================
   4. LIMPIEZA DE LÍNEAS Y GANANCIA DE FICHAS
   ============================================================================ */
function clearFullLines() {
  let linesCleared = 0;

  for (let r = ROWS - 1; r >= 0; r--) {
    let isFull = true;
    for (let c = 0; c < COLS; c++) {
      if (state.grid[r][c] === 0) {
        isFull = false;
        break;
      }
    }

    if (isFull) {
      linesCleared++;
      state.grid.splice(r, 1);
      state.grid.unshift(Array(COLS).fill(0));
      r++;
    }
  }

  if (linesCleared > 0) {
    state.lineas += linesCleared;
    state.puntos += PUNTOS_POR_LINEA[linesCleared] * state.nivel;

    let fichasGanadas = linesCleared * FICHAS_POR_LINEA;
    if (linesCleared === 4) {
      fichasGanadas += BONIFICACION_TETRIS_FICHAS;
    }

    if (state.fichas + fichasGanadas >= TOPE_MAXIMO_FICHAS) {
      state.fichas = TOPE_MAXIMO_FICHAS;
      state.topeAlcanzado = true;
      updateHUD();
      showChipsGainToast(fichasGanadas);
      triggerGameOver(true);
      return;
    } else {
      state.fichas += fichasGanadas;
    }

    showChipsGainToast(fichasGanadas);
    playSound("line");
    triggerHaptic(30);

    const nuevoNivel = Math.floor(state.lineas / LINEAS_POR_NIVEL) + 1;
    if (nuevoNivel > state.nivel) {
      state.nivel = nuevoNivel;
      state.dropInterval = Math.max(100, Math.floor(VELOCIDAD_INICIAL_MS * Math.pow(FACTOR_ACELERACION, state.nivel - 1)));
    }

    state.linesSinceLastGarbage += linesCleared;
    if (state.linesSinceLastGarbage >= 5) {
      insertGarbageObstacles(2);
      state.linesSinceLastGarbage = 0;
    }

    updateHUD();
  }
}

function insertGarbageObstacles(count = 2) {
  let placed = 0;
  for (let i = 0; i < 20 && placed < count; i++) {
    const row = ROWS - 1 - Math.floor(Math.random() * 5);
    const col = Math.floor(Math.random() * COLS);
    if (state.grid[row][col] === 0) {
      state.grid[row][col] = "GARBAGE";
      placed++;
    }
  }

  garbageToast.classList.remove("hidden");
  setTimeout(() => {
    garbageToast.classList.add("hidden");
  }, 2200);
}

function showChipsGainToast(amount) {
  const toast = document.createElement("div");
  toast.className = "chips-gain-toast";
  toast.textContent = `+${amount}🪙`;
  floatingChipsContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 1200);
}

/* ============================================================================
   RENDERIZADO DE BLOQUES NEÓN CON BISEL Y MÚLTIPLES ESTELAS
   ============================================================================ */
function drawBlock(context, x, y, size, type, isGhost = false, isIndestructible = false) {
  const colors = TETROMINO_COLORS[type] || TETROMINO_COLORS.I;

  context.save();

  if (isGhost) {
    context.strokeStyle = colors.glow;
    context.lineWidth = 1.5;
    context.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
    context.fillStyle = "rgba(56, 189, 248, 0.08)";
    context.fillRect(x + 1.5, y + 1.5, size - 3, size - 3);
  } else {
    const grad = context.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, colors.main);
    grad.addColorStop(1, colors.dark || "#070b13");

    context.fillStyle = grad;
    context.fillRect(x + 1, y + 1, size - 2, size - 2);

    context.strokeStyle = "rgba(255, 255, 255, 0.65)";
    context.lineWidth = 1.5;
    context.strokeRect(x + 2, y + 2, size - 4, size - 4);

    context.fillStyle = colors.core || "rgba(255, 255, 255, 0.5)";
    context.fillRect(x + 5, y + 5, 4, 4);

    context.strokeStyle = "rgba(0, 0, 0, 0.85)";
    context.lineWidth = 1;
    context.strokeRect(x, y, size, size);
  }

  context.restore();
}

/**
 * Dibuja múltiples estelas de luz individuales que ascienden directamente hacia arriba
 * desde cada sección superior de la figura (fiel a la ilustración de referencia)
 */
function drawPieceFallTrail(piece) {
  if (!piece) return;
  const colors = TETROMINO_COLORS[piece.type] || TETROMINO_COLORS.T;
  const { matrix, x, y } = piece;

  ctx.save();

  // Múltiples estelas de luz individuales que ascienden directamente hacia arriba desde cada sección superior
  const numCols = matrix[0].length;
  for (let c = 0; c < numCols; c++) {
    let topR = -1;
    for (let r = 0; r < matrix.length; r++) {
      if (matrix[r][c]) {
        topR = r;
        break;
      }
    }

    if (topR !== -1) {
      const blockTopY = (y + topR) * BLOCK_SIZE;
      const blockLeftX = (x + c) * BLOCK_SIZE;

      if (blockTopY > 0) {
        // Cada estela individual asciende verticalmente ~3.3 bloques de altura
        const trailHeight = Math.min(blockTopY, BLOCK_SIZE * 3.3);
        const trailTopY = blockTopY - trailHeight;

        // 1. Franja de luz individual difusa para esta sección superior
        const streamGrad = ctx.createLinearGradient(0, blockTopY, 0, trailTopY);
        streamGrad.addColorStop(0, colors.glow.replace(/[\d\.]+\)$/, "0.75)"));
        streamGrad.addColorStop(0.3, colors.glow.replace(/[\d\.]+\)$/, "0.35)"));
        streamGrad.addColorStop(0.75, colors.glow.replace(/[\d\.]+\)$/, "0.08)"));
        streamGrad.addColorStop(1, "transparent");

        ctx.fillStyle = streamGrad;
        // Margen de 3px a los lados para que cada estela individual se distinga nítidamente
        ctx.fillRect(blockLeftX + 3, trailTopY, BLOCK_SIZE - 6, trailHeight);

        // 2. Línea láser brillante en el centro exacto de cada estela individual
        const laserGrad = ctx.createLinearGradient(0, blockTopY, 0, trailTopY);
        laserGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        laserGrad.addColorStop(0.25, colors.core || "rgba(255, 255, 255, 0.7)");
        laserGrad.addColorStop(0.8, colors.glow.replace(/[\d\.]+\)$/, "0.3)"));
        laserGrad.addColorStop(1, "transparent");

        ctx.fillStyle = laserGrad;
        ctx.fillRect(blockLeftX + (BLOCK_SIZE / 2) - 1.5, trailTopY, 3, trailHeight);

        // 3. Resplandor en la base de la estela justo al emerger del bloque
        const baseGrad = ctx.createRadialGradient(
          blockLeftX + BLOCK_SIZE / 2, blockTopY, 1,
          blockLeftX + BLOCK_SIZE / 2, blockTopY, BLOCK_SIZE * 0.75
        );
        baseGrad.addColorStop(0, "rgba(255, 255, 255, 0.8)");
        baseGrad.addColorStop(0.4, colors.glow.replace(/[\d\.]+\)$/, "0.5)"));
        baseGrad.addColorStop(1, "transparent");

        ctx.fillStyle = baseGrad;
        ctx.fillRect(blockLeftX, blockTopY - 8, BLOCK_SIZE, 12);
      }
    }
  }

  ctx.restore();
}

function drawBoardBackground() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += BLOCK_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += BLOCK_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoardBackground();

  // Tablero fijado
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = state.grid[r][c];
      if (cell) {
        drawBlock(
          ctx,
          c * BLOCK_SIZE,
          r * BLOCK_SIZE,
          BLOCK_SIZE,
          cell.type || cell,
          false,
          cell.isIndestructible
        );
      }
    }
  }

  // Estela que sale directamente de las piezas al caer
  if (state.currentPiece && !state.isGameOver) {
    drawPieceFallTrail(state.currentPiece);

    const { matrix, x, y, type } = state.currentPiece;
    const ghostY = getGhostY();

    // Fantasma
    if (ghostY > y) {
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c]) {
            drawBlock(
              ctx,
              (x + c) * BLOCK_SIZE,
              (ghostY + r) * BLOCK_SIZE,
              BLOCK_SIZE,
              type,
              true
            );
          }
        }
      }
    }

    // Pieza activa
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          drawBlock(
            ctx,
            (x + c) * BLOCK_SIZE,
            (y + r) * BLOCK_SIZE,
            BLOCK_SIZE,
            type,
            false
          );
        }
      }
    }
  }
}

function drawNextPiece() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (state.nextPiece) {
    const matrix = state.nextPiece.matrix;
    const miniBlockSize = 11;
    const pieceWidth = matrix[0].length * miniBlockSize;
    const pieceHeight = matrix.length * miniBlockSize;
    const startX = Math.floor((nextCanvas.width - pieceWidth) / 2);
    const startY = Math.floor((nextCanvas.height - pieceHeight) / 2);

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          drawBlock(nextCtx, startX + c * miniBlockSize, startY + r * miniBlockSize, miniBlockSize, state.nextPiece.type);
        }
      }
    }
  }
}

/* ============================================================================
   5. BUCLE DE JUEGO PRINCIPAL
   ============================================================================ */
function gameLoop(time = 0) {
  if (!state.isPlaying) return;

  const deltaTime = time - state.lastTime;
  state.lastTime = time;

  if (!state.isPaused && !state.isGameOver) {
    state.dropCounter += deltaTime;
    if (state.dropCounter > state.dropInterval) {
      softDrop();
      state.dropCounter = 0;
    }
  }

  draw();
  state.animationFrameId = requestAnimationFrame(gameLoop);
}

function startNewGame() {
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
  }

  state.grid = createEmptyGrid();
  state.dropInterval = VELOCIDAD_INICIAL_MS;
  state.dropCounter = 0;
  state.lastTime = performance.now();
  state.isPlaying = true;
  state.isPaused = false;
  state.isGameOver = false;
  state.linesSinceLastGarbage = 0;

  payoutModal.classList.add("hidden");
  pauseOverlay.classList.add("hidden");

  state.nextPiece = getNextTetromino();
  spawnNextPiece();

  state.animationFrameId = requestAnimationFrame(gameLoop);
}

function togglePause() {
  if (state.isGameOver || !state.isPlaying) return;
  state.isPaused = !state.isPaused;
  if (state.isPaused) {
    pauseOverlay.classList.remove("hidden");
  } else {
    pauseOverlay.classList.add("hidden");
    state.lastTime = performance.now();
  }
}

/* ============================================================================
   6. CUPÓN DE COBRO Y WHATSAPP UNIVERSAL
   ============================================================================ */
function triggerGameOver(isMaxCapReached = false) {
  state.isGameOver = true;
  state.isPlaying = false;

  playSound(isMaxCapReached ? "line" : "gameover");
  triggerHaptic(50);

  payoutFichasAmount.textContent = state.fichas.toLocaleString();
  couponUserCode.textContent = `#${state.userCode || "0000"}`;
  couponUserNickname.textContent = state.nickname || "Jugador El Rey";
  couponLinesCleared.textContent = state.lineas.toString();

  if (isMaxCapReached) {
    maxCapBanner.classList.remove("hidden");
  } else {
    maxCapBanner.classList.add("hidden");
  }

  const mensajeCobro = `¡Hola! Quiero cobrar mis fichas de Tetris El Rey. Mi Código de Usuario es: ${state.userCode || "0000"} y gané un total de ${state.fichas} fichas.`;
  const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensajeCobro)}`;

  whatsappPayoutBtn.href = urlWhatsApp;
  payoutModal.classList.remove("hidden");
}

/* ============================================================================
   7. ACTUALIZACIÓN DE HUD Y ESTADÍSTICAS LATERALES
   ============================================================================ */
function updateHUD() {
  if (metricScoreDisplay) {
    metricScoreDisplay.textContent = state.puntos.toLocaleString();
  }
  if (metricLevelDisplay) {
    metricLevelDisplay.textContent = String(state.nivel).padStart(2, "0");
  }
  if (metricLinesDisplay) {
    metricLinesDisplay.textContent = String(state.lineas).padStart(2, "0");
  }
  if (hudChipsCount) {
    hudChipsCount.textContent = `${state.fichas.toLocaleString()}🪙`;
  }
}

function updateUserBadgeUI() {
  if (playerNicknameDisplay) playerNicknameDisplay.textContent = state.nickname || "Invitado";
  if (playerCodeBadge) playerCodeBadge.textContent = `#${state.userCode || "----"}`;
  const sideName = document.getElementById("side-player-fullname");
  const sideCode = document.getElementById("side-player-code");
  if (sideName) sideName.textContent = state.nickname || "Jugador El Rey";
  if (sideCode) sideCode.textContent = `#${state.userCode || "0001"}`;
}

/* ============================================================================
   MANEJO DEL FORMULARIO DE ACCESO / CÓDIGO
   ============================================================================ */
function generateRandomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

generateCodeBtn.addEventListener("click", () => {
  playerCodeInput.value = generateRandomCode();
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nickname = playerNicknameInput.value.trim();
  const code = playerCodeInput.value.trim();

  if (!nickname || nickname.length < 2) {
    showModalError("Introduce un apodo válido (mínimo 2 letras)");
    return;
  }
  if (!code) {
    showModalError("Introduce un código de usuario");
    return;
  }

  hideModalError();
  startBtnSpinner.classList.remove("hidden");
  startGameBtn.disabled = true;

  try {
    state.nickname = nickname;
    state.userCode = code;

    updateUserBadgeUI();

    loginModal.classList.add("hidden");
    startNewGame();
  } catch (err) {
    console.error("Error al iniciar:", err);
    showModalError("No se pudo conectar. Intenta de nuevo.");
  } finally {
    startBtnSpinner.classList.add("hidden");
    startGameBtn.disabled = false;
  }
});

function showModalError(msg) {
  modalErrorMsg.textContent = msg;
  modalErrorMsg.classList.remove("hidden");
}

function hideModalError() {
  modalErrorMsg.classList.add("hidden");
}

/* ============================================================================
   8. CONTROLES TÁCTILES ULTRA-FLUIDOS (DAS / ARR)
   ============================================================================ */
function bindFluidTouchButton(element, actionCallback, dasDelay = 135, arrInterval = 42) {
  if (!element) return;

  let dasTimer = null;
  let arrTimer = null;

  const startPress = (e) => {
    e.preventDefault();
    e.stopPropagation();
    initAudio();

    element.classList.add("active");
    actionCallback();

    clearTimeout(dasTimer);
    clearInterval(arrTimer);

    dasTimer = setTimeout(() => {
      arrTimer = setInterval(() => {
        actionCallback();
      }, arrInterval);
    }, dasDelay);
  };

  const endPress = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    element.classList.remove("active");
    clearTimeout(dasTimer);
    clearInterval(arrTimer);
  };

  element.addEventListener("pointerdown", startPress, { passive: false });
  element.addEventListener("pointerup", endPress, { passive: false });
  element.addEventListener("pointercancel", endPress, { passive: false });
  element.addEventListener("pointerleave", endPress, { passive: false });
}

// 1. Cruceta Verde Neón (D-PAD)
bindFluidTouchButton(btnDpadLeft, () => moveHorizontal(-1));
bindFluidTouchButton(btnDpadRight, () => moveHorizontal(1));
bindFluidTouchButton(btnDpadDown, () => softDrop(), 110, 38);
bindFluidTouchButton(btnDpadUp, () => hardDrop(), 380, 380);

// 2. Botón ROTAR Amarillo Dorado
if (btnRotate) {
  btnRotate.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    initAudio();
    btnRotate.classList.add("active");
    tryRotatePiece();
  }, { passive: false });

  const releaseRotate = (e) => {
    if (e) e.preventDefault();
    btnRotate.classList.remove("active");
  };
  btnRotate.addEventListener("pointerup", releaseRotate, { passive: false });
  btnRotate.addEventListener("pointercancel", releaseRotate, { passive: false });
}

// 3. Botón Redondo "A" (Caída Dura / Slam)
if (btnActionA) {
  btnActionA.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    initAudio();
    btnActionA.classList.add("active");
    hardDrop();
  }, { passive: false });

  const releaseActionA = (e) => {
    if (e) e.preventDefault();
    btnActionA.classList.remove("active");
  };
  btnActionA.addEventListener("pointerup", releaseActionA, { passive: false });
  btnActionA.addEventListener("pointercancel", releaseActionA, { passive: false });
}

/* ============================================================================
   CONTROL DIRECTO POR DESLIZAMIENTO EN EL CANVAS (DRAG FLUIDO)
   ============================================================================ */
let touchTracking = {
  active: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  startTime: 0,
  accumulatedX: 0,
  accumulatedY: 0,
  hasMoved: false
};

const PIXEL_DRAG_THRESHOLD_X = 20;
const PIXEL_DRAG_THRESHOLD_Y = 22;

canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1 && state.isPlaying && !state.isPaused) {
    const t = e.touches[0];
    touchTracking.active = true;
    touchTracking.startX = t.clientX;
    touchTracking.startY = t.clientY;
    touchTracking.currentX = t.clientX;
    touchTracking.currentY = t.clientY;
    touchTracking.startTime = performance.now();
    touchTracking.accumulatedX = 0;
    touchTracking.accumulatedY = 0;
    touchTracking.hasMoved = false;
    initAudio();
  }
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  if (!touchTracking.active || e.touches.length !== 1) return;
  e.preventDefault();

  const t = e.touches[0];
  const deltaX = t.clientX - touchTracking.currentX;
  const deltaY = t.clientY - touchTracking.currentY;

  touchTracking.accumulatedX += deltaX;
  touchTracking.accumulatedY += deltaY;
  touchTracking.currentX = t.clientX;
  touchTracking.currentY = t.clientY;

  if (Math.abs(touchTracking.accumulatedX) >= PIXEL_DRAG_THRESHOLD_X) {
    const steps = Math.trunc(touchTracking.accumulatedX / PIXEL_DRAG_THRESHOLD_X);
    for (let i = 0; i < Math.abs(steps); i++) {
      moveHorizontal(steps > 0 ? 1 : -1);
    }
    touchTracking.accumulatedX -= steps * PIXEL_DRAG_THRESHOLD_X;
    touchTracking.hasMoved = true;
  }

  if (touchTracking.accumulatedY >= PIXEL_DRAG_THRESHOLD_Y) {
    const steps = Math.trunc(touchTracking.accumulatedY / PIXEL_DRAG_THRESHOLD_Y);
    for (let i = 0; i < steps; i++) {
      softDrop();
    }
    touchTracking.accumulatedY -= steps * PIXEL_DRAG_THRESHOLD_Y;
    touchTracking.hasMoved = true;
  }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  if (!touchTracking.active) return;
  const touchDuration = performance.now() - touchTracking.startTime;
  const totalDist = Math.hypot(
    touchTracking.currentX - touchTracking.startX,
    touchTracking.currentY - touchTracking.startY
  );

  if (!touchTracking.hasMoved && touchDuration < 250 && totalDist < 12) {
    tryRotatePiece();
  }

  touchTracking.active = false;
}, { passive: false });

/* ============================================================================
   TECLADO DE ESCRITORIO
   ============================================================================ */
window.addEventListener("keydown", (e) => {
  if (!state.isPlaying || state.isGameOver) return;

  switch (e.code) {
    case "ArrowLeft":
    case "KeyA":
      moveHorizontal(-1);
      break;
    case "ArrowRight":
    case "KeyD":
      moveHorizontal(1);
      break;
    case "ArrowDown":
    case "KeyS":
      softDrop();
      break;
    case "ArrowUp":
    case "KeyW":
    case "KeyX":
      tryRotatePiece();
      break;
    case "Space":
      hardDrop();
      break;
    case "KeyP":
    case "Escape":
      togglePause();
      break;
  }
});

/* ============================================================================
   BOTONES AUXILIARES Y REANUDAR
   ============================================================================ */
btnPauseHeader.addEventListener("click", togglePause);

if (btnPauseMain) {
  btnPauseMain.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    initAudio();
    togglePause();
  });
}

resumeBtn.addEventListener("click", togglePause);

audioToggleBtn.addEventListener("click", () => {
  state.soundEnabled = !state.soundEnabled;
  audioToggleBtn.textContent = state.soundEnabled ? "🔊" : "🔇";
});

playAgainBtn.addEventListener("click", () => {
  payoutModal.classList.add("hidden");
  startNewGame();
});

// Inicializar código aleatorio en el modal
playerCodeInput.value = generateRandomCode();
