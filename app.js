/**
 * ============================================================================
 * CASINO EL REY - TETRIS PROMOCIONAL (MOTOR DE JUEGO & CONEXIÓN FIREBASE)
 * ============================================================================
 */

// Firebase es provisto por los scripts CDN en index.html
const fb = typeof window !== "undefined" && window.firebase ? window.firebase : null;

/* ============================================================================
   CONFIGURACIÓN DE FIREBASE (PROYECTO: tetris-c361e)
   ============================================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyBJVkTZfjrZCOHkA2MQIp8tCs4ugR7g6dc",
  authDomain: "tetris-c361e.firebaseapp.com",
  projectId: "tetris-c361e",
  storageBucket: "tetris-c361e.firebasestorage.app",
  messagingSenderId: "110227664683",
  appId: "1:110227664683:web:e7b3ab648afe057a8adf6e",
  measurementId: "G-E3F9WJDNEZ"
};

// Inicialización de Firebase Firestore (sintaxis clásica db.collection)
let db = null;
let firebaseReady = false;

try {
  if (fb && !fb.apps.length) {
    fb.initializeApp(firebaseConfig);
  }
  if (fb) {
    db = fb.firestore();
    firebaseReady = true;
    console.log("🟢 Firebase Firestore conectado con Casino El Rey.");
  }
} catch (error) {
  console.error("🔴 Error inicializando Firebase Firestore:", error);
}

/* ============================================================================
   CONSTANTES Y CONFIGURACIÓN DEL TETRIS (DIFICULTAD Y VELOCIDAD)
   ============================================================================ */
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

// Recompensas de Casino
const PUNTOS_POR_LINEA = 100;
const FICHAS_POR_LINEA = 10;
const TOPE_MAXIMO_FICHAS = 10000;

// Velocidad del juego
const VELOCIDAD_INICIAL_MS = 320;
const ACELERACION_INTERVALO_LINEAS = 5;
const ACELERACION_DELTA_MS = 30;
const VELOCIDAD_MINIMA_MS = 80;
const BASURA_INTERVALO_LINEAS = 15;

// Paleta de Colores Neón Casino
const TETROMINO_COLORS = {
  I: { main: "#06b6d4", light: "#67e8f9", dark: "#0891b2" },
  J: { main: "#3b82f6", light: "#93c5fd", dark: "#1d4ed8" },
  L: { main: "#f97316", light: "#fdba74", dark: "#c2410c" },
  O: { main: "#eab308", light: "#fef08a", dark: "#a16207" },
  S: { main: "#10b981", light: "#6ee7b7", dark: "#047857" },
  T: { main: "#a855f7", light: "#d8b4fe", dark: "#7e22ce" },
  Z: { main: "#ef4444", light: "#fca5a5", dark: "#b91c1c" },
  GARBAGE: { main: "#4b5563", light: "#9ca3af", dark: "#1f2937" }
};

// Matrices de las piezas
const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ]
};

/* ============================================================================
   ESTADO GLOBAL
   ============================================================================ */
const state = {
  userCode: null,
  nickname: "Jugador",
  fichas: 0,
  lineas: 0,
  puntos: 0,
  topeAlcanzado: false,

  grid: createEmptyGrid(),
  currentPiece: null,
  nextPiece: null,
  holdPiece: null,
  canHold: true,
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
   AUDIO SINTETIZADO (WEB AUDIO API)
   ============================================================================ */
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
}

function playSound(type) {
  if (!state.soundEnabled) return;
  initAudio();
  if (!audioCtx || audioCtx.state === "suspended") {
    audioCtx?.resume();
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
      osc.frequency.setValueAtTime(240, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
      break;

    case "rotate":
      osc.type = "triangle";
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(560, now + 0.07);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.start(now);
      osc.stop(now + 0.07);
      break;

    case "drop":
      osc.type = "square";
      osc.frequency.setValueAtTime(160, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
      break;

    case "line":
      [440, 554, 659, 880].forEach((freq, idx) => {
        const subOsc = audioCtx.createOscillator();
        const subGain = audioCtx.createGain();
        subOsc.type = "triangle";
        subOsc.frequency.setValueAtTime(freq, now + idx * 0.04);
        subGain.gain.setValueAtTime(0.12, now + idx * 0.04);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.14);
        subOsc.connect(subGain);
        subGain.connect(audioCtx.destination);
        subOsc.start(now + idx * 0.04);
        subOsc.stop(now + idx * 0.04 + 0.14);
      });
      break;

    case "hazard":
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.setValueAtTime(130, now + 0.14);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;

    case "gameover":
      [320, 280, 240, 190].forEach((freq, idx) => {
        const subOsc = audioCtx.createOscillator();
        const subGain = audioCtx.createGain();
        subOsc.type = "sawtooth";
        subOsc.frequency.setValueAtTime(freq, now + idx * 0.11);
        subGain.gain.setValueAtTime(0.14, now + idx * 0.11);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.16);
        subOsc.connect(subGain);
        subGain.connect(audioCtx.destination);
        subOsc.start(now + idx * 0.11);
        subOsc.stop(now + idx * 0.11 + 0.16);
      });
      break;
  }
}

/* ============================================================================
   CANVAS Y ELEMENTOS DOM
   ============================================================================ */
const canvas = document.getElementById("tetris-canvas");
const ctx = canvas.getContext("2d");

const nextCanvas = document.getElementById("next-canvas");
const nextCtx = nextCanvas.getContext("2d");

const holdCanvas = document.getElementById("hold-canvas");
const holdCtx = holdCanvas.getContext("2d");

const nicknameModal = document.getElementById("nickname-modal");
const nicknameForm = document.getElementById("nickname-form");
const nicknameInput = document.getElementById("nickname-input");
const startGameBtn = document.getElementById("start-game-btn");
const startBtnText = document.getElementById("start-btn-text");
const startBtnSpinner = document.getElementById("start-btn-spinner");
const modalErrorMsg = document.getElementById("modal-error-msg");

const playerNicknameDisplay = document.getElementById("player-nickname-display");
const playerCodeBadge = document.getElementById("player-code-badge");
const firebaseStatusPill = document.getElementById("firebase-status-pill");
const firebaseStatusText = document.getElementById("firebase-status-text");

const hudChipsCount = document.getElementById("hud-chips-count");
const hudLinesCount = document.getElementById("hud-lines-count");
const chipsProgressBar = document.getElementById("chips-progress-bar");
const chipsProgressText = document.getElementById("chips-progress-text");
const floatingChipsContainer = document.getElementById("floating-chips-container");
const garbageToast = document.getElementById("garbage-toast");
const pauseOverlay = document.getElementById("pause-overlay");
const resumeBtn = document.getElementById("resume-btn");
const audioToggleBtn = document.getElementById("audio-toggle-btn");
const btnPauseHeader = document.getElementById("btn-pause-header");

const payoutModal = document.getElementById("payout-modal");
const payoutFichasAmount = document.getElementById("payout-fichas-amount");
const couponUserCode = document.getElementById("coupon-user-code");
const couponUserNickname = document.getElementById("coupon-user-nickname");
const couponLinesCleared = document.getElementById("coupon-lines-cleared");
const maxCapBanner = document.getElementById("max-cap-banner");
const whatsappPayoutBtn = document.getElementById("whatsapp-payout-btn");
const restartGameBtn = document.getElementById("restart-game-btn");

const btnLeft = document.getElementById("btn-left");
const btnRight = document.getElementById("btn-right");
const btnRotate = document.getElementById("btn-rotate");
const btnSoftDrop = document.getElementById("btn-soft-drop");
const btnHardDrop = document.getElementById("btn-hard-drop");
const btnHold = document.getElementById("btn-hold");

/* ============================================================================
   1. FIREBASE: CÓDIGOS CORRELATIVOS (0001, 0002...)
   ============================================================================ */

async function initUserSession() {
  const savedUserId = localStorage.getItem("tetris_casino_user_id");
  const savedNickname = localStorage.getItem("tetris_casino_nickname") || "Jugador";

  if (savedUserId) {
    state.userCode = savedUserId;
    state.nickname = savedNickname;
    updateUserBadgeUI();

    if (db) {
      try {
        const userDoc = await db.collection("usuarios_tetris").doc(savedUserId).get();
        if (userDoc.exists) {
          const data = userDoc.data();
          state.nickname = data.apodo || savedNickname;
          state.fichas = Number(data.fichas_acumuladas) || 0;
          state.lineas = Number(data.lineas_completadas) || 0;
          state.topeAlcanzado = !!data.tope_alcanzado;
          updateHUD();
          updateUserBadgeUI();

          if (state.fichas >= TOPE_MAXIMO_FICHAS) {
            triggerGameOver(true);
            return;
          }
        }
      } catch (err) {
        console.warn("⚠️ Error cargando perfil de Firestore:", err);
        setFirebaseStatusUI("warning", "Firestore Local");
      }
    }

    startNewGame();
  } else {
    nicknameModal.classList.remove("hidden");
    nicknameInput.focus();
  }
}

async function registerUserWithCorrelativeId(apodo) {
  setLoadingState(true);
  hideModalError();

  const apodoLimpio = apodo.trim().substring(0, 20) || "Jugador El Rey";

  if (!db || !firebaseReady) {
    const fallbackId = generateLocalFallbackCode();
    finalizeRegistration(fallbackId, apodoLimpio);
    setFirebaseStatusUI("warning", "Modo Local");
    return;
  }

  try {
    const configDocRef = db.collection("config").doc("contador_tetris");

    const codigoFormateado = await db.runTransaction(async (transaction) => {
      const configSnapshot = await transaction.get(configDocRef);
      let nuevoIdNumero = 1;

      if (configSnapshot.exists) {
        const data = configSnapshot.data();
        const ultimo = Number(data.ultimo_id);
        nuevoIdNumero = (isNaN(ultimo) ? 0 : ultimo) + 1;
        transaction.update(configDocRef, { ultimo_id: nuevoIdNumero });
      } else {
        transaction.set(configDocRef, { ultimo_id: 1 });
        nuevoIdNumero = 1;
      }

      const codigoStr = String(nuevoIdNumero).padStart(4, "0");

      const userDocRef = db.collection("usuarios_tetris").doc(codigoStr);
      transaction.set(userDocRef, {
        codigo: codigoStr,
        apodo: apodoLimpio,
        fichas_acumuladas: 0,
        lineas_completadas: 0,
        puntos_juego: 0,
        tope_alcanzado: false,
        creado_en: fb.firestore.FieldValue.serverTimestamp(),
        actualizado_en: fb.firestore.FieldValue.serverTimestamp()
      });

      return codigoStr;
    });

    console.log(`✅ Registrado en Casino El Rey. Código: ${codigoFormateado}`);
    finalizeRegistration(codigoFormateado, apodoLimpio);
    setFirebaseStatusUI("connected", "Firestore OK");

  } catch (error) {
    console.error("🔴 Error en transacción de Firestore:", error);
    showModalError("Aviso: Conectando en modo local (" + (error.message || "Permiso pendiente") + ")");
    setTimeout(() => {
      const fallbackId = generateLocalFallbackCode();
      finalizeRegistration(fallbackId, apodoLimpio);
      setFirebaseStatusUI("warning", "Modo Respaldo");
    }, 1000);
  } finally {
    setLoadingState(false);
  }
}

function finalizeRegistration(codigo, apodo) {
  state.userCode = codigo;
  state.nickname = apodo;
  state.fichas = 0;
  state.lineas = 0;
  state.puntos = 0;

  localStorage.setItem("tetris_casino_user_id", codigo);
  localStorage.setItem("tetris_casino_nickname", apodo);

  updateUserBadgeUI();
  updateHUD();
  nicknameModal.classList.add("hidden");
  startNewGame();
}

function generateLocalFallbackCode() {
  const currentCount = Number(localStorage.getItem("tetris_local_counter") || 0) + 1;
  localStorage.setItem("tetris_local_counter", currentCount);
  return String(currentCount).padStart(4, "0");
}

/* ============================================================================
   2. RECOMPENSAS EN TIEMPO REAL & TOPE 10,000 FICHAS
   ============================================================================ */

async function syncProgressToFirebase(lineasNuevas) {
  if (lineasNuevas <= 0) return;

  const fichasGanadas = lineasNuevas * FICHAS_POR_LINEA;
  state.lineas += lineasNuevas;
  state.fichas += fichasGanadas;
  state.puntos += lineasNuevas * PUNTOS_POR_LINEA;

  showFloatingChipsGain(`+${fichasGanadas}🪙`);
  playSound("line");

  if (state.fichas >= TOPE_MAXIMO_FICHAS) {
    state.fichas = TOPE_MAXIMO_FICHAS;
    state.topeAlcanzado = true;
    updateHUD();

    if (db && state.userCode) {
      try {
        await db.collection("usuarios_tetris").doc(state.userCode).update({
          fichas_acumuladas: state.fichas,
          lineas_completadas: state.lineas,
          tope_alcanzado: true,
          actualizado_en: fb.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) {
        console.warn("Error actualizando tope en Firestore:", err);
      }
    }

    triggerGameOver(true);
    return;
  }

  updateHUD();

  if (db && state.userCode) {
    try {
      await db.collection("usuarios_tetris").doc(state.userCode).update({
        fichas_acumuladas: state.fichas,
        lineas_completadas: state.lineas,
        puntos_juego: state.puntos,
        actualizado_en: fb.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.warn("⚠️ Error en sync en tiempo real:", err);
    }
  }

  checkIntermediateDifficultyEvents(lineasNuevas);
}

/* ============================================================================
   3. VELOCIDAD & OBSTÁCULOS BASURA
   ============================================================================ */

function checkIntermediateDifficultyEvents(lineasRecientes) {
  const nivelVelocidad = Math.floor(state.lineas / ACELERACION_INTERVALO_LINEAS);
  const nuevoIntervalo = Math.max(
    VELOCIDAD_MINIMA_MS,
    VELOCIDAD_INICIAL_MS - nivelVelocidad * ACELERACION_DELTA_MS
  );
  state.dropInterval = nuevoIntervalo;

  state.linesSinceLastGarbage += lineasRecientes;
  if (state.linesSinceLastGarbage >= BASURA_INTERVALO_LINEAS) {
    state.linesSinceLastGarbage = state.linesSinceLastGarbage % BASURA_INTERVALO_LINEAS;
    spawnIndestructibleGarbageBlocks();
  }
}

function spawnIndestructibleGarbageBlocks() {
  const bottomRowIndex = ROWS - 1;

  let emptyIndices = [];
  for (let c = 0; c < COLS; c++) {
    if (!state.grid[bottomRowIndex][c]) {
      emptyIndices.push(c);
    }
  }

  if (emptyIndices.length < 2) {
    for (let r = 0; r < ROWS - 1; r++) {
      state.grid[r] = [...state.grid[r + 1]];
    }
    state.grid[bottomRowIndex] = new Array(COLS).fill(0);
    emptyIndices = Array.from({ length: COLS }, (_, i) => i);
  }

  emptyIndices.sort(() => Math.random() - 0.5);
  const targetCols = emptyIndices.slice(0, 2);

  targetCols.forEach(col => {
    state.grid[bottomRowIndex][col] = {
      type: "GARBAGE",
      isIndestructible: true
    };
  });

  playSound("hazard");
  triggerGarbageAlertToast();
}

function triggerGarbageAlertToast() {
  if (!garbageToast) return;
  garbageToast.classList.remove("hidden");
  void garbageToast.offsetWidth;
  setTimeout(() => {
    garbageToast.classList.add("hidden");
  }, 2800);
}

/* ============================================================================
   4. MOTOR DE JUEGO TETRIS
   ============================================================================ */

function createEmptyGrid() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

let pieceBag = [];
function getNextTetromino() {
  if (pieceBag.length === 0) {
    const types = ["I", "J", "L", "O", "S", "T", "Z"];
    pieceBag = types.sort(() => Math.random() - 0.5);
  }
  const type = pieceBag.pop();
  return {
    type,
    matrix: SHAPES[type],
    x: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
    y: 0
  };
}

function canMove(piece, matrix, offsetX, offsetY) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) {
        const newX = piece.x + c + offsetX;
        const newY = piece.y + r + offsetY;

        if (newX < 0 || newX >= COLS || newY >= ROWS) {
          return false;
        }

        if (newY >= 0 && state.grid[newY][newX]) {
          return false;
        }
      }
    }
  }
  return true;
}

function rotateMatrix(matrix) {
  const N = matrix.length;
  const result = [];
  for (let r = 0; r < N; r++) {
    result[r] = [];
    for (let c = 0; c < N; c++) {
      result[r][c] = matrix[N - 1 - c][r];
    }
  }
  return result;
}

function tryRotatePiece() {
  if (!state.currentPiece || state.isGameOver || state.isPaused) return;

  const rotated = rotateMatrix(state.currentPiece.matrix);
  const kicks = [0, 1, -1, 2, -2];

  for (const kick of kicks) {
    if (canMove(state.currentPiece, rotated, kick, 0)) {
      state.currentPiece.matrix = rotated;
      state.currentPiece.x += kick;
      playSound("rotate");
      draw();
      return;
    }
  }
}

function moveHorizontal(dir) {
  if (!state.currentPiece || state.isGameOver || state.isPaused) return;
  if (canMove(state.currentPiece, state.currentPiece.matrix, dir, 0)) {
    state.currentPiece.x += dir;
    playSound("move");
    draw();
  }
}

function softDrop() {
  if (!state.currentPiece || state.isGameOver || state.isPaused) return;
  if (canMove(state.currentPiece, state.currentPiece.matrix, 0, 1)) {
    state.currentPiece.y += 1;
    state.dropCounter = 0;
    draw();
  } else {
    lockCurrentPiece();
  }
}

function hardDrop() {
  if (!state.currentPiece || state.isGameOver || state.isPaused) return;
  while (canMove(state.currentPiece, state.currentPiece.matrix, 0, 1)) {
    state.currentPiece.y += 1;
  }
  playSound("drop");
  lockCurrentPiece();
  draw();
}

function holdCurrentPiece() {
  if (!state.currentPiece || !state.canHold || state.isGameOver || state.isPaused) return;

  const currentType = state.currentPiece.type;
  if (state.holdPiece === null) {
    state.holdPiece = currentType;
    spawnNextPiece();
  } else {
    const temp = state.holdPiece;
    state.holdPiece = currentType;
    state.currentPiece = {
      type: temp,
      matrix: SHAPES[temp],
      x: Math.floor(COLS / 2) - Math.ceil(SHAPES[temp][0].length / 2),
      y: 0
    };
  }
  state.canHold = false;
  playSound("rotate");
  drawMiniCanvases();
  draw();
}

function lockCurrentPiece() {
  const { matrix, x, y, type } = state.currentPiece;

  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) {
        const boardY = y + r;
        const boardX = x + c;

        if (boardY < 0) {
          triggerGameOver(false);
          return;
        }

        state.grid[boardY][boardX] = {
          type,
          isIndestructible: false
        };
      }
    }
  }

  clearLines();
  state.canHold = true;
  spawnNextPiece();
}

function clearLines() {
  let clearedCount = 0;

  for (let r = ROWS - 1; r >= 0; r--) {
    let isRowFull = true;
    let hasIndestructible = false;

    for (let c = 0; c < COLS; c++) {
      const cell = state.grid[r][c];
      if (!cell) {
        isRowFull = false;
        break;
      }
      if (cell.isIndestructible) {
        hasIndestructible = true;
      }
    }

    if (isRowFull) {
      clearedCount++;

      if (hasIndestructible) {
        for (let c = 0; c < COLS; c++) {
          if (!state.grid[r][c]?.isIndestructible) {
            state.grid[r][c] = 0;
          }
        }
      } else {
        state.grid.splice(r, 1);
        state.grid.unshift(new Array(COLS).fill(0));
        r++;
      }
    }
  }

  if (clearedCount > 0) {
    syncProgressToFirebase(clearedCount);
  }
}

function spawnNextPiece() {
  state.currentPiece = state.nextPiece || getNextTetromino();
  state.nextPiece = getNextTetromino();

  if (!canMove(state.currentPiece, state.currentPiece.matrix, 0, 0)) {
    triggerGameOver(false);
  }

  drawMiniCanvases();
}

function getGhostY() {
  if (!state.currentPiece) return 0;
  let ghostY = state.currentPiece.y;
  while (canMove(state.currentPiece, state.currentPiece.matrix, 0, ghostY - state.currentPiece.y + 1)) {
    ghostY++;
  }
  return ghostY;
}

/* ============================================================================
   5. RENDERIZADO VISUAL
   ============================================================================ */

function drawBlock(targetCtx, x, y, size, type, isGhost = false, isIndestructible = false) {
  const colors = TETROMINO_COLORS[type] || TETROMINO_COLORS.I;

  targetCtx.save();

  if (isGhost) {
    targetCtx.strokeStyle = colors.main;
    targetCtx.lineWidth = 1.5;
    targetCtx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    targetCtx.fillStyle = "rgba(255, 255, 255, 0.04)";
    targetCtx.fillRect(x + 1, y + 1, size - 2, size - 2);
    targetCtx.restore();
    return;
  }

  if (isIndestructible) {
    const gColors = TETROMINO_COLORS.GARBAGE;
    targetCtx.fillStyle = gColors.dark;
    targetCtx.fillRect(x, y, size, size);

    targetCtx.fillStyle = gColors.light;
    targetCtx.fillRect(x, y, size, 2);
    targetCtx.fillRect(x, y, 2, size);
    targetCtx.fillStyle = "#111827";
    targetCtx.fillRect(x, y + size - 2, size, 2);
    targetCtx.fillRect(x + size - 2, y, 2, size);

    targetCtx.strokeStyle = "rgba(239, 68, 68, 0.6)";
    targetCtx.lineWidth = 1.5;
    targetCtx.beginPath();
    targetCtx.moveTo(x + 3, y + 3);
    targetCtx.lineTo(x + size - 3, y + size - 3);
    targetCtx.moveTo(x + size - 3, y + 3);
    targetCtx.lineTo(x + 3, y + size - 3);
    targetCtx.stroke();
    targetCtx.restore();
    return;
  }

  targetCtx.fillStyle = colors.main;
  targetCtx.fillRect(x, y, size, size);

  targetCtx.fillStyle = colors.light;
  targetCtx.fillRect(x, y, size, 2.5);
  targetCtx.fillRect(x, y, 2.5, size);

  targetCtx.fillStyle = colors.dark;
  targetCtx.fillRect(x, y + size - 2.5, size, 2.5);
  targetCtx.fillRect(x + size - 2.5, y, 2.5, size);

  targetCtx.fillStyle = "rgba(255, 255, 255, 0.25)";
  targetCtx.fillRect(x + 3, y + 3, 3, 3);

  targetCtx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#04070d";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK_SIZE, 0);
    ctx.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK_SIZE);
    ctx.lineTo(COLS * BLOCK_SIZE, r * BLOCK_SIZE);
    ctx.stroke();
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = state.grid[r][c];
      if (cell) {
        drawBlock(
          ctx,
          c * BLOCK_SIZE,
          r * BLOCK_SIZE,
          BLOCK_SIZE,
          cell.type,
          false,
          cell.isIndestructible
        );
      }
    }
  }

  if (state.currentPiece && !state.isGameOver) {
    const { matrix, x, y, type } = state.currentPiece;
    const ghostY = getGhostY();

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

function drawMiniCanvases() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (state.nextPiece) {
    drawCenteredPiece(nextCtx, state.nextPiece.matrix, state.nextPiece.type, nextCanvas.width, nextCanvas.height);
  }

  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (state.holdPiece) {
    const matrix = SHAPES[state.holdPiece];
    drawCenteredPiece(holdCtx, matrix, state.holdPiece, holdCanvas.width, holdCanvas.height);
  }
}

function drawCenteredPiece(targetCtx, matrix, type, width, height) {
  const miniBlockSize = 11;
  const pieceWidth = matrix[0].length * miniBlockSize;
  const pieceHeight = matrix.length * miniBlockSize;
  const startX = Math.floor((width - pieceWidth) / 2);
  const startY = Math.floor((height - pieceHeight) / 2);

  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) {
        drawBlock(targetCtx, startX + c * miniBlockSize, startY + r * miniBlockSize, miniBlockSize, type);
      }
    }
  }
}

/* ============================================================================
   6. BUCLE DE JUEGO
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
  state.holdPiece = null;
  state.canHold = true;

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
   7. CUPÓN DE COBRO Y WHATSAPP UNIVERSAL
   ============================================================================ */

function triggerGameOver(isMaxCapReached = false) {
  state.isGameOver = true;
  state.isPlaying = false;

  playSound(isMaxCapReached ? "line" : "gameover");

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
   8. HUD
   ============================================================================ */

function updateHUD() {
  hudChipsCount.textContent = state.fichas.toLocaleString();
  hudLinesCount.textContent = state.lineas.toString();

  const porcentaje = Math.min(100, (state.fichas / TOPE_MAXIMO_FICHAS) * 100);
  chipsProgressBar.style.width = `${porcentaje}%`;
  chipsProgressText.textContent = `${state.fichas.toLocaleString()} / 10,000`;
}

function updateUserBadgeUI() {
  playerNicknameDisplay.textContent = state.nickname;
  playerCodeBadge.textContent = `#${state.userCode || "----"}`;
}

function setFirebaseStatusUI(status, label) {
  firebaseStatusPill.className = `firebase-status ${status}`;
  firebaseStatusText.textContent = label;
}

function showFloatingChipsGain(text) {
  if (!floatingChipsContainer) return;
  const chipSpan = document.createElement("div");
  chipSpan.className = "floating-chip-anim";
  chipSpan.textContent = text;
  floatingChipsContainer.appendChild(chipSpan);
  setTimeout(() => {
    chipSpan.remove();
  }, 1100);
}

function setLoadingState(loading) {
  if (loading) {
    startBtnText.textContent = "GENERANDO CÓDIGO...";
    startBtnSpinner.classList.remove("hidden");
    startGameBtn.disabled = true;
  } else {
    startBtnText.textContent = "EMPEZAR A JUGAR";
    startBtnSpinner.classList.add("hidden");
    startGameBtn.disabled = false;
  }
}

function showModalError(msg) {
  modalErrorMsg.textContent = msg;
  modalErrorMsg.classList.remove("hidden");
}

function hideModalError() {
  modalErrorMsg.classList.add("hidden");
}

/* ============================================================================
   9. EVENTOS Y TOUCH
   ============================================================================ */

nicknameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const apodo = nicknameInput.value.trim();
  if (apodo.length > 0) {
    registerUserWithCorrelativeId(apodo);
  }
});

restartGameBtn.addEventListener("click", () => {
  payoutModal.classList.add("hidden");
  startNewGame();
});

resumeBtn.addEventListener("click", () => {
  togglePause();
});

btnPauseHeader.addEventListener("click", () => {
  togglePause();
});

audioToggleBtn.addEventListener("click", () => {
  state.soundEnabled = !state.soundEnabled;
  audioToggleBtn.textContent = state.soundEnabled ? "🔊" : "🔇";
});

window.addEventListener("keydown", (e) => {
  if (nicknameModal && !nicknameModal.classList.contains("hidden")) return;

  switch (e.code) {
    case "ArrowLeft":
    case "KeyA":
      e.preventDefault();
      moveHorizontal(-1);
      break;

    case "ArrowRight":
    case "KeyD":
      e.preventDefault();
      moveHorizontal(1);
      break;

    case "ArrowUp":
    case "KeyW":
    case "KeyX":
      e.preventDefault();
      tryRotatePiece();
      break;

    case "ArrowDown":
    case "KeyS":
      e.preventDefault();
      softDrop();
      break;

    case "Space":
      e.preventDefault();
      hardDrop();
      break;

    case "KeyC":
      e.preventDefault();
      holdCurrentPiece();
      break;

    case "KeyP":
    case "Escape":
      e.preventDefault();
      togglePause();
      break;
  }
});

function bindTouchButton(element, action) {
  if (!element) return;

  let timer = null;
  let interval = null;

  const startAction = (e) => {
    e.preventDefault();
    initAudio();
    element.classList.add("active");
    if (navigator.vibrate) navigator.vibrate(12);
    action();

    timer = setTimeout(() => {
      interval = setInterval(() => {
        action();
      }, 85);
    }, 200);
  };

  const stopAction = (e) => {
    e.preventDefault();
    element.classList.remove("active");
    clearTimeout(timer);
    clearInterval(interval);
  };

  element.addEventListener("pointerdown", startAction);
  element.addEventListener("pointerup", stopAction);
  element.addEventListener("pointercancel", stopAction);
  element.addEventListener("pointerleave", stopAction);
}

bindTouchButton(btnLeft, () => moveHorizontal(-1));
bindTouchButton(btnRight, () => moveHorizontal(1));
bindTouchButton(btnSoftDrop, () => softDrop());

btnRotate.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  initAudio();
  if (navigator.vibrate) navigator.vibrate(15);
  tryRotatePiece();
});

btnHardDrop.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  initAudio();
  if (navigator.vibrate) navigator.vibrate(25);
  hardDrop();
});

btnHold.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  initAudio();
  if (navigator.vibrate) navigator.vibrate(15);
  holdCurrentPiece();
});

/* Gestos en Canvas */
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = performance.now();
    initAudio();
  }
}, { passive: true });

canvas.addEventListener("touchend", (e) => {
  if (e.changedTouches.length === 1) {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    const deltaTime = performance.now() - touchStartTime;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < 12 && absY < 12 && deltaTime < 250) {
      tryRotatePiece();
    } else if (absX > absY && absX > 22) {
      moveHorizontal(deltaX > 0 ? 1 : -1);
    } else if (absY > absX && deltaY > 30) {
      if (deltaTime < 200 && deltaY > 55) {
        hardDrop();
      } else {
        softDrop();
      }
    }
  }
}, { passive: true });

window.addEventListener("DOMContentLoaded", () => {
  draw();
  drawMiniCanvases();
  initUserSession();
});
