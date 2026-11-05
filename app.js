/**
 * ============================================================================
 * TETRIS EL REY - RETRO-FUTURISTA VIP
 * Motor de Juego, Estética Fiel a la Imagen de Referencia (Sin HOLD)
 * Cruceta Verde Neón, Botón ROTATE Dorado, Columna Lateral de Métricas
 * ============================================================================
 */

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

let db = null;
let firebaseReady = false;

try {
  if (fb && !fb.apps.length) {
    fb.initializeApp(firebaseConfig);
  }
  if (fb) {
    db = fb.firestore();
    firebaseReady = true;
    console.log("🟢 Firebase Firestore conectado con Tetris El Rey.");
  }
} catch (error) {
  console.warn("⚠️ Firebase Firestore operando en modo local:", error);
}

/* ============================================================================
   CONFIGURACIÓN TETRIS RETRO-FUTURISTA
   ============================================================================ */
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

const PUNTOS_POR_LINEA = 100;
const FICHAS_POR_LINEA = 10;
const TOPE_MAXIMO_FICHAS = 10000;

// Velocidad y Dificultad
const VELOCIDAD_INICIAL_MS = 340;
const ACELERACION_INTERVALO_LINEAS = 5;
const ACELERACION_DELTA_MS = 30;
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
   ESTADO DEL JUEGO (SIN OPCIÓN DE HOLD)
   ============================================================================ */
const state = {
  userCode: null,
  nickname: "Jugador El Rey",
  fichas: 0,
  lineas: 0,
  puntos: 0,
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
      osc.frequency.setValueAtTime(180, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.start(now);
      osc.stop(now + 0.07);
      break;

    case "line":
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const subOsc = audioCtx.createOscillator();
        const subGain = audioCtx.createGain();
        subOsc.type = "triangle";
        subOsc.frequency.setValueAtTime(freq, now + idx * 0.04);
        subGain.gain.setValueAtTime(0.12, now + idx * 0.04);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.16);
        subOsc.connect(subGain);
        subGain.connect(audioCtx.destination);
        subOsc.start(now + idx * 0.04);
        subOsc.stop(now + idx * 0.04 + 0.16);
      });
      break;

    case "hazard":
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.setValueAtTime(140, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
      break;

    case "gameover":
      [340, 290, 240, 180].forEach((freq, idx) => {
        const subOsc = audioCtx.createOscillator();
        const subGain = audioCtx.createGain();
        subOsc.type = "sawtooth";
        subOsc.frequency.setValueAtTime(freq, now + idx * 0.1);
        subGain.gain.setValueAtTime(0.12, now + idx * 0.1);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.15);
        subOsc.connect(subGain);
        subGain.connect(audioCtx.destination);
        subOsc.start(now + idx * 0.1);
        subOsc.stop(now + idx * 0.1 + 0.15);
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

// Métricas de la Columna Derecha (Fiel a la Imagen)
const metricScoreDisplay = document.getElementById("metric-score-display");
const metricLevelDisplay = document.getElementById("metric-level-display");
const metricLinesDisplay = document.getElementById("metric-lines-display");
const hudChipsCount = document.getElementById("hud-chips-count");
const floatingChipsContainer = document.getElementById("floating-chips-container");
const pauseOverlay = document.getElementById("pause-overlay");
const resumeBtn = document.getElementById("resume-btn");
const audioToggleBtn = document.getElementById("audio-toggle-btn");
const btnPauseHeader = document.getElementById("btn-pause-header");
const btnPauseMain = document.getElementById("btn-pause-main");

const payoutModal = document.getElementById("payout-modal");
const payoutFichasAmount = document.getElementById("payout-fichas-amount");
const couponUserCode = document.getElementById("coupon-user-code");
const couponUserNickname = document.getElementById("coupon-user-nickname");
const couponLinesCleared = document.getElementById("coupon-lines-cleared");
const maxCapBanner = document.getElementById("max-cap-banner");
const whatsappPayoutBtn = document.getElementById("whatsapp-payout-btn");
const restartGameBtn = document.getElementById("restart-game-btn");

// Controles Táctiles (Cruceta Verde + Botón ROTATE Dorado + Botón Redondo "A")
const btnDpadLeft = document.getElementById("btn-dpad-left");
const btnDpadRight = document.getElementById("btn-dpad-right");
const btnDpadUp = document.getElementById("btn-dpad-up");
const btnDpadDown = document.getElementById("btn-dpad-down");
const btnRotate = document.getElementById("btn-rotate");
const btnActionA = document.getElementById("btn-action-a");

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
          state.puntos = Number(data.puntos_juego) || state.fichas * 10;
          state.nivel = Math.floor(state.lineas / ACELERACION_INTERVALO_LINEAS) + 1;
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
        setFirebaseStatusUI("warning", "Modo Local");
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

    console.log(`✅ Registrado en Tetris El Rey. Código: ${codigoFormateado}`);
    finalizeRegistration(codigoFormateado, apodoLimpio);
    setFirebaseStatusUI("connected", "Firestore OK");

  } catch (error) {
    console.error("🔴 Error en transacción de Firestore:", error);
    showModalError("Conectando en modo local...");
    setTimeout(() => {
      const fallbackId = generateLocalFallbackCode();
      finalizeRegistration(fallbackId, apodoLimpio);
      setFirebaseStatusUI("warning", "Modo Local");
    }, 800);
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
  state.nivel = 1;

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
  state.nivel = Math.floor(state.lineas / ACELERACION_INTERVALO_LINEAS) + 1;

  showFloatingChipsGain(`+${fichasGanadas}🪙`);
  playSound("line");
  triggerHaptic(40);

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
  triggerHaptic(60);
}

/* ============================================================================
   3. MOTOR DE JUEGO TETRIS (SIN HOLD)
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
      triggerHaptic(12);
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
    triggerHaptic(8);
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
  triggerHaptic(25);
  lockCurrentPiece();
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

  drawNextPiece();
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
   4. RENDERIZADO VISUAL: NEÓN BRILLANTE, LUZ INTERIOR Y HAZ DE LUZ ASCENDENTE
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
    targetCtx.fillStyle = "#1e2430";
    targetCtx.fillRect(x, y, size, size);
    targetCtx.fillStyle = "#0f141f";
    targetCtx.fillRect(x + 2, y + 2, size - 4, size - 4);
    targetCtx.strokeStyle = "rgba(239, 68, 68, 0.85)";
    targetCtx.lineWidth = 2;
    targetCtx.strokeRect(x + 3, y + 3, size - 6, size - 6);
    targetCtx.restore();
    return;
  }

  // Resplandor exterior suave de neón
  targetCtx.shadowColor = colors.glow;
  targetCtx.shadowBlur = 9;

  // Gradiente radial con suave luz interior (como en la imagen del usuario)
  const radGrad = targetCtx.createRadialGradient(
    x + size * 0.35, y + size * 0.35, size * 0.1,
    x + size * 0.5, y + size * 0.5, size * 0.75
  );
  radGrad.addColorStop(0, colors.core);
  radGrad.addColorStop(0.55, colors.main);
  radGrad.addColorStop(1, colors.dark);

  targetCtx.fillStyle = radGrad;
  targetCtx.fillRect(x, y, size, size);

  targetCtx.shadowBlur = 0;

  // Bisel exterior nítido estilo 90s Brick Game
  targetCtx.fillStyle = colors.core;
  targetCtx.fillRect(x, y, size, 2);
  targetCtx.fillRect(x, y, 2, size);

  targetCtx.fillStyle = colors.dark;
  targetCtx.fillRect(x, y + size - 2, size, 2);
  targetCtx.fillRect(x + size - 2, y, 2, size);

  // Recuadro interior clásico de los 90
  const inset = 4;
  targetCtx.fillStyle = "rgba(0, 0, 0, 0.3)";
  targetCtx.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);

  const innerGrad = targetCtx.createLinearGradient(x + inset, y + inset, x + size - inset, y + size - inset);
  innerGrad.addColorStop(0, colors.main);
  innerGrad.addColorStop(1, colors.dark);
  targetCtx.fillStyle = innerGrad;
  targetCtx.fillRect(x + inset + 1, y + inset + 1, size - (inset + 1) * 2, size - (inset + 1) * 2);

  // Brillo de luz de píxel en la esquina superior izquierda
  targetCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
  targetCtx.fillRect(x + inset + 1, y + inset + 1, 2, 2);

  targetCtx.restore();
}

/**
 * Cuadrícula fina de fondo azul-gris oscura con textura sutil
 */
function drawBoardBackground() {
  ctx.fillStyle = "#070c16";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.strokeStyle = "rgba(56, 189, 248, 0.05)";
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
  ctx.restore();
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
          cell.type,
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
  // Formato SCORE fiel al mockup: número con comas (e.g. 24,850)
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

function setFirebaseStatusUI(status, label) {
  if (firebaseStatusPill) firebaseStatusPill.className = `status-pill ${status}`;
  if (firebaseStatusText) firebaseStatusText.textContent = label;
}

function showFloatingChipsGain(text) {
  if (!floatingChipsContainer) return;
  const chipSpan = document.createElement("div");
  chipSpan.className = "chips-gain-toast";
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

// 2. Botón ROTATE Amarillo Dorado
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

  touchTracking.currentX = t.clientX;
  touchTracking.currentY = t.clientY;

  touchTracking.accumulatedX += deltaX;
  touchTracking.accumulatedY += deltaY;

  if (Math.abs(touchTracking.accumulatedX) >= PIXEL_DRAG_THRESHOLD_X) {
    const steps = Math.floor(Math.abs(touchTracking.accumulatedX) / PIXEL_DRAG_THRESHOLD_X);
    const dir = touchTracking.accumulatedX > 0 ? 1 : -1;

    for (let i = 0; i < steps; i++) {
      moveHorizontal(dir);
    }

    touchTracking.accumulatedX = touchTracking.accumulatedX % PIXEL_DRAG_THRESHOLD_X;
    touchTracking.hasMoved = true;
  }

  if (touchTracking.accumulatedY >= PIXEL_DRAG_THRESHOLD_Y) {
    softDrop();
    touchTracking.accumulatedY = 0;
    touchTracking.hasMoved = true;
  }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  if (!touchTracking.active) return;
  touchTracking.active = false;

  const duration = performance.now() - touchTracking.startTime;
  const totalDeltaX = touchTracking.currentX - touchTracking.startX;
  const totalDeltaY = touchTracking.currentY - touchTracking.startY;
  const totalDist = Math.hypot(totalDeltaX, totalDeltaY);

  if (!touchTracking.hasMoved && totalDist < 12 && duration < 240) {
    tryRotatePiece();
    return;
  }

  if (totalDeltaY > 55 && duration < 220 && Math.abs(totalDeltaX) < 40) {
    hardDrop();
  }
}, { passive: false });

/* ============================================================================
   9. TECLADO FÍSICO
   ============================================================================ */
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

    case "KeyP":
    case "Escape":
      e.preventDefault();
      togglePause();
      break;
  }
});

/* ============================================================================
   10. EVENTOS AUXILIARES
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

if (btnPauseMain) {
  btnPauseMain.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    initAudio();
    togglePause();
  });
}

audioToggleBtn.addEventListener("click", () => {
  state.soundEnabled = !state.soundEnabled;
  audioToggleBtn.textContent = state.soundEnabled ? "🔊" : "🔇";
});

window.addEventListener("DOMContentLoaded", () => {
  draw();
  drawNextPiece();
  initUserSession();
});
