/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Smartphone, 
  Maximize2, 
  FileCode, 
  Copy, 
  Check, 
  Download, 
  Volume2, 
  VolumeX, 
  Pause, 
  Play, 
  Crown,
  ExternalLink,
  X
} from 'lucide-react';

/* ============================================================================
   CONFIGURACIÓN TETRIS RETRO-FUTURISTA
   ============================================================================ */
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const PUNTOS_POR_LINEA = 100;
const FICHAS_POR_LINEA = 10;
const TOPE_MAXIMO_FICHAS = 10000;

const VELOCIDAD_INICIAL_MS = 340;
const ACELERACION_INTERVALO_LINEAS = 5;
const ACELERACION_DELTA_MS = 30;
const VELOCIDAD_MINIMA_MS = 80;
const BASURA_INTERVALO_LINEAS = 15;

const TETROMINO_COLORS: Record<string, { core: string; main: string; dark: string; glow: string }> = {
  I: { core: "#a5f3fc", main: "#06b6d4", dark: "#0e7490", glow: "rgba(6, 182, 212, 0.9)" },
  J: { core: "#bfdbfe", main: "#3b82f6", dark: "#1d4ed8", glow: "rgba(59, 130, 246, 0.9)" },
  L: { core: "#fed7aa", main: "#f97316", dark: "#c2410c", glow: "rgba(249, 115, 22, 0.9)" },
  O: { core: "#fef08a", main: "#eab308", dark: "#a16207", glow: "rgba(234, 179, 8, 0.9)" },
  S: { core: "#a7f3d0", main: "#22c55e", dark: "#15803d", glow: "rgba(34, 197, 94, 0.9)" },
  T: { core: "#f5d0fe", main: "#c026d3", dark: "#86198f", glow: "rgba(192, 38, 211, 0.9)" },
  Z: { core: "#fecaca", main: "#ef4444", dark: "#b91c1c", glow: "rgba(239, 68, 68, 0.9)" },
  GARBAGE: { core: "#9ca3af", main: "#374151", dark: "#111827", glow: "rgba(239, 68, 68, 0.6)" }
};

const SHAPES: Record<string, number[][]> = {
  I: [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
  J: [[1,0,0], [1,1,1], [0,0,0]],
  L: [[0,0,1], [1,1,1], [0,0,0]],
  O: [[1,1], [1,1]],
  S: [[0,1,1], [1,1,0], [0,0,0]],
  T: [[0,1,0], [1,1,1], [0,0,0]],
  Z: [[1,1,0], [0,1,1], [0,0,0]]
};

interface GridCell {
  type: string;
  isIndestructible: boolean;
}

interface Piece {
  type: string;
  matrix: number[][];
  x: number;
  y: number;
}

export default function App() {
  // Configuración de visualización
  const [viewMode, setViewMode] = useState<'hands' | 'phone' | 'fullscreen'>('hands');
  const [showCodeModal, setShowCodeModal] = useState<boolean>(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'html' | 'css' | 'js'>('html');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Estados del jugador y partida
  const [nickname, setNickname] = useState<string>('Jugador El Rey');
  const [userCode, setUserCode] = useState<string>('0001');
  const [puntos, setPuntos] = useState<number>(0);
  const [nivel, setNivel] = useState<number>(1);
  const [fichas, setFichas] = useState<number>(0);
  const [lineas, setLineas] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isMaxCapReached, setIsMaxCapReached] = useState<boolean>(false);
  const [showNicknameModal, setShowNicknameModal] = useState<boolean>(false);
  const [showGarbageToast, setShowGarbageToast] = useState<boolean>(false);
  const [floatingBonus, setFloatingBonus] = useState<string | null>(null);

  // Referencias Canvas y Audio
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Estado mutable del motor de juego (SIN OPCIÓN DE HOLD)
  const gameStateRef = useRef({
    grid: Array.from({ length: ROWS }, () => new Array(COLS).fill(null) as (GridCell | null)[]),
    currentPiece: null as Piece | null,
    nextPiece: null as Piece | null,
    dropCounter: 0,
    dropInterval: VELOCIDAD_INICIAL_MS,
    lastTime: 0,
    isPlaying: false,
    isPaused: false,
    isGameOver: false,
    linesSinceLastGarbage: 0,
    puntos: 0,
    nivel: 1,
    fichas: 0,
    lineas: 0
  });

  const pieceBagRef = useRef<string[]>([]);

  // Inicializar Web Audio API
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioClass) {
        audioCtxRef.current = new AudioClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playSound = (type: 'move' | 'rotate' | 'drop' | 'line' | 'hazard' | 'gameover') => {
    if (!soundEnabled) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'move':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        osc.start(now);
        osc.stop(now + 0.035);
        break;
      case 'rotate':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.06);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
        break;
      case 'drop':
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.07);
        break;
      case 'line':
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
          const sOsc = ctx.createOscillator();
          const sGain = ctx.createGain();
          sOsc.type = 'triangle';
          sOsc.frequency.setValueAtTime(freq, now + idx * 0.04);
          sGain.gain.setValueAtTime(0.12, now + idx * 0.04);
          sGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.16);
          sOsc.connect(sGain);
          sGain.connect(ctx.destination);
          sOsc.start(now + idx * 0.04);
          sOsc.stop(now + idx * 0.04 + 0.16);
        });
        break;
      case 'hazard':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.setValueAtTime(140, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      case 'gameover':
        [340, 290, 240, 180].forEach((freq, idx) => {
          const sOsc = ctx.createOscillator();
          const sGain = ctx.createGain();
          sOsc.type = 'sawtooth';
          sOsc.frequency.setValueAtTime(freq, now + idx * 0.1);
          sGain.gain.setValueAtTime(0.12, now + idx * 0.1);
          sGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.15);
          sOsc.connect(sGain);
          sGain.connect(ctx.destination);
          sOsc.start(now + idx * 0.1);
          sOsc.stop(now + idx * 0.1 + 0.15);
        });
        break;
    }
  };

  const triggerHaptic = (ms = 10) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignorar
      }
    }
  };

  // Generador de piezas
  const getNextTetromino = (): Piece => {
    if (pieceBagRef.current.length === 0) {
      const types = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
      pieceBagRef.current = types.sort(() => Math.random() - 0.5);
    }
    const type = pieceBagRef.current.pop()!;
    return {
      type,
      matrix: SHAPES[type],
      x: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
      y: 0
    };
  };

  const canMove = (piece: Piece, matrix: number[][], offsetX: number, offsetY: number) => {
    const grid = gameStateRef.current.grid;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const newX = piece.x + c + offsetX;
          const newY = piece.y + r + offsetY;
          if (newX < 0 || newX >= COLS || newY >= ROWS) return false;
          if (newY >= 0 && grid[newY][newX]) return false;
        }
      }
    }
    return true;
  };

  const rotateMatrix = (matrix: number[][]) => {
    const N = matrix.length;
    const result: number[][] = [];
    for (let r = 0; r < N; r++) {
      result[r] = [];
      for (let c = 0; c < N; c++) {
        result[r][c] = matrix[N - 1 - c][r];
      }
    }
    return result;
  };

  // Renderizado gráfico Neón con Luz Interior
  const drawBlock = (
    targetCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    type: string,
    isGhost = false,
    isIndestructible = false
  ) => {
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
      targetCtx.shadowColor = "#ef4444";
      targetCtx.shadowBlur = 6;
      targetCtx.beginPath();
      targetCtx.moveTo(x + 4, y + 4);
      targetCtx.lineTo(x + size - 4, y + size - 4);
      targetCtx.moveTo(x + size - 4, y + 4);
      targetCtx.lineTo(x + 4, y + size - 4);
      targetCtx.stroke();
      targetCtx.restore();
      return;
    }

    // Bloque Neón Brillante con Suave Luz Interior
    targetCtx.shadowColor = colors.glow;
    targetCtx.shadowBlur = 8;

    const radGrad = targetCtx.createRadialGradient(
      x + size * 0.35, y + size * 0.35, size * 0.1,
      x + size * 0.5, y + size * 0.5, size * 0.7
    );
    radGrad.addColorStop(0, colors.core);
    radGrad.addColorStop(0.5, colors.main);
    radGrad.addColorStop(1, colors.dark);

    targetCtx.fillStyle = radGrad;
    targetCtx.fillRect(x, y, size, size);

    targetCtx.shadowBlur = 0;

    // Bisel exterior nítido estilo 90s
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

    targetCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
    targetCtx.fillRect(x + inset + 1, y + inset + 1, 2, 2);

    targetCtx.restore();
  };

  const drawCarbonFiberGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = "#070c16";
    ctx.fillRect(0, 0, width, height);

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
  };

  const drawPieceFallTrail = (ctx: CanvasRenderingContext2D, piece: Piece) => {
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
          streamGrad.addColorStop(0, colors.glow.replace(/[\d\.]+\)$/, '0.75)'));
          streamGrad.addColorStop(0.3, colors.glow.replace(/[\d\.]+\)$/, '0.35)'));
          streamGrad.addColorStop(0.75, colors.glow.replace(/[\d\.]+\)$/, '0.08)'));
          streamGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = streamGrad;
          // Margen de 3px a los lados para que cada estela individual se distinga nítidamente
          ctx.fillRect(blockLeftX + 3, trailTopY, BLOCK_SIZE - 6, trailHeight);

          // 2. Línea láser brillante en el centro exacto de cada estela individual
          const laserGrad = ctx.createLinearGradient(0, blockTopY, 0, trailTopY);
          laserGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
          laserGrad.addColorStop(0.25, colors.core || 'rgba(255, 255, 255, 0.7)');
          laserGrad.addColorStop(0.8, colors.glow.replace(/[\d\.]+\)$/, '0.3)'));
          laserGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = laserGrad;
          ctx.fillRect(blockLeftX + (BLOCK_SIZE / 2) - 1.5, trailTopY, 3, trailHeight);

          // 3. Resplandor en la base de la estela justo al emerger del bloque
          const baseGrad = ctx.createRadialGradient(
            blockLeftX + BLOCK_SIZE / 2, blockTopY, 1,
            blockLeftX + BLOCK_SIZE / 2, blockTopY, BLOCK_SIZE * 0.75
          );
          baseGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
          baseGrad.addColorStop(0.4, colors.glow.replace(/[\d\.]+\)$/, '0.5)'));
          baseGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = baseGrad;
          ctx.fillRect(blockLeftX, blockTopY - 8, BLOCK_SIZE, 12);
        }
      }
    }

    ctx.restore();
  };

  const getGhostY = (): number => {
    const { currentPiece } = gameStateRef.current;
    if (!currentPiece) return 0;
    let ghostY = currentPiece.y;
    while (canMove(currentPiece, currentPiece.matrix, 0, ghostY - currentPiece.y + 1)) {
      ghostY++;
    }
    return ghostY;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawCarbonFiberGrid(ctx, canvas.width, canvas.height);

    const { grid, currentPiece, isGameOver } = gameStateRef.current;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r][c];
        if (cell) {
          drawBlock(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, cell.type, false, cell.isIndestructible);
        }
      }
    }

    if (currentPiece && !isGameOver) {
      // Estela que sale directamente de las piezas al caer
      drawPieceFallTrail(ctx, currentPiece);

      const { matrix, x, y, type } = currentPiece;
      const ghostY = getGhostY();

      if (ghostY > y) {
        for (let r = 0; r < matrix.length; r++) {
          for (let c = 0; c < matrix[r].length; c++) {
            if (matrix[r][c]) {
              drawBlock(ctx, (x + c) * BLOCK_SIZE, (ghostY + r) * BLOCK_SIZE, BLOCK_SIZE, type, true);
            }
          }
        }
      }

      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c]) {
            drawBlock(ctx, (x + c) * BLOCK_SIZE, (y + r) * BLOCK_SIZE, BLOCK_SIZE, type, false);
          }
        }
      }
    }
  }, []);

  const drawNextPiece = useCallback(() => {
    const canvas = nextCanvasRef.current;
    if (!canvas || !gameStateRef.current.nextPiece) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { matrix, type } = gameStateRef.current.nextPiece;
    const miniSize = 10;
    const pW = matrix[0].length * miniSize;
    const pH = matrix.length * miniSize;
    const startX = Math.floor((canvas.width - pW) / 2);
    const startY = Math.floor((canvas.height - pH) / 2);

    for (let r = 0; r < matrix.length; r++) {
      for (let col = 0; col < matrix[r].length; col++) {
        if (matrix[r][col]) {
          drawBlock(ctx, startX + col * miniSize, startY + r * miniSize, miniSize, type);
        }
      }
    }
  }, []);

  // Acciones de juego
  const tryRotatePiece = () => {
    const state = gameStateRef.current;
    if (!state.currentPiece || state.isGameOver || state.isPaused) return;

    const rotated = rotateMatrix(state.currentPiece.matrix);
    const kicks = [0, 1, -1, 2, -2];

    for (const kick of kicks) {
      if (canMove(state.currentPiece, rotated, kick, 0)) {
        state.currentPiece.matrix = rotated;
        state.currentPiece.x += kick;
        playSound('rotate');
        triggerHaptic(12);
        draw();
        return;
      }
    }
  };

  const moveHorizontal = (dir: number) => {
    const state = gameStateRef.current;
    if (!state.currentPiece || state.isGameOver || state.isPaused) return;
    if (canMove(state.currentPiece, state.currentPiece.matrix, dir, 0)) {
      state.currentPiece.x += dir;
      playSound('move');
      triggerHaptic(8);
      draw();
    }
  };

  const softDrop = () => {
    const state = gameStateRef.current;
    if (!state.currentPiece || state.isGameOver || state.isPaused) return;
    if (canMove(state.currentPiece, state.currentPiece.matrix, 0, 1)) {
      state.currentPiece.y += 1;
      state.dropCounter = 0;
      draw();
    } else {
      lockCurrentPiece();
    }
  };

  const hardDrop = () => {
    const state = gameStateRef.current;
    if (!state.currentPiece || state.isGameOver || state.isPaused) return;
    while (canMove(state.currentPiece, state.currentPiece.matrix, 0, 1)) {
      state.currentPiece.y += 1;
    }
    playSound('drop');
    triggerHaptic(25);
    lockCurrentPiece();
    draw();
  };

  const lockCurrentPiece = () => {
    const state = gameStateRef.current;
    if (!state.currentPiece) return;
    const { matrix, x, y, type } = state.currentPiece;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const boardY = y + r;
          const boardX = x + c;

          if (boardY < 0) {
            handleGameOver(false);
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
  };

  const clearLines = () => {
    const state = gameStateRef.current;
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
              state.grid[r][c] = null;
            }
          }
        } else {
          state.grid.splice(r, 1);
          state.grid.unshift(new Array(COLS).fill(null));
          r++;
        }
      }
    }

    if (clearedCount > 0) {
      const fichasGanadas = clearedCount * FICHAS_POR_LINEA;
      const puntosGanados = clearedCount * PUNTOS_POR_LINEA * (clearedCount === 4 ? 2 : 1);

      state.lineas += clearedCount;
      state.fichas += fichasGanadas;
      state.puntos += puntosGanados;
      state.nivel = Math.floor(state.lineas / ACELERACION_INTERVALO_LINEAS) + 1;

      setLineas(state.lineas);
      setFichas(state.fichas);
      setPuntos(state.puntos);
      setNivel(state.nivel);

      setFloatingBonus(`+${fichasGanadas}🪙`);
      setTimeout(() => setFloatingBonus(null), 1200);

      playSound('line');
      triggerHaptic(40);

      if (state.fichas >= TOPE_MAXIMO_FICHAS) {
        state.fichas = TOPE_MAXIMO_FICHAS;
        setFichas(TOPE_MAXIMO_FICHAS);
        handleGameOver(true);
        return;
      }

      state.dropInterval = Math.max(
        VELOCIDAD_MINIMA_MS,
        VELOCIDAD_INICIAL_MS - (state.nivel - 1) * ACELERACION_DELTA_MS
      );

      state.linesSinceLastGarbage += clearedCount;
      if (state.linesSinceLastGarbage >= BASURA_INTERVALO_LINEAS) {
        state.linesSinceLastGarbage = state.linesSinceLastGarbage % BASURA_INTERVALO_LINEAS;
        spawnIndestructibleGarbageBlocks();
      }
    }
  };

  const spawnIndestructibleGarbageBlocks = () => {
    const state = gameStateRef.current;
    const bottomRow = ROWS - 1;
    let emptyIndices: number[] = [];
    for (let c = 0; c < COLS; c++) {
      if (!state.grid[bottomRow][c]) emptyIndices.push(c);
    }
    if (emptyIndices.length < 2) {
      for (let r = 0; r < ROWS - 1; r++) {
        state.grid[r] = [...state.grid[r + 1]];
      }
      state.grid[bottomRow] = new Array(COLS).fill(null);
      emptyIndices = Array.from({ length: COLS }, (_, i) => i);
    }
    emptyIndices.sort(() => Math.random() - 0.5);
    const targetCols = emptyIndices.slice(0, 2);
    targetCols.forEach(col => {
      state.grid[bottomRow][col] = {
        type: 'GARBAGE',
        isIndestructible: true
      };
    });

    playSound('hazard');
    triggerHaptic(60);
    setShowGarbageToast(true);
    setTimeout(() => setShowGarbageToast(false), 2600);
  };

  const spawnNextPiece = () => {
    const state = gameStateRef.current;
    state.currentPiece = state.nextPiece || getNextTetromino();
    state.nextPiece = getNextTetromino();

    if (!canMove(state.currentPiece, state.currentPiece.matrix, 0, 0)) {
      handleGameOver(false);
    }
    drawNextPiece();
  };

  const handleGameOver = (isMaxCap: boolean) => {
    const state = gameStateRef.current;
    state.isGameOver = true;
    state.isPlaying = false;
    setIsGameOver(true);
    setIsMaxCapReached(isMaxCap);
    playSound(isMaxCap ? 'line' : 'gameover');
    triggerHaptic(50);
  };

  const startNewGame = () => {
    const state = gameStateRef.current;
    state.grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    state.dropInterval = VELOCIDAD_INICIAL_MS;
    state.dropCounter = 0;
    state.lastTime = performance.now();
    state.isPlaying = true;
    state.isPaused = false;
    state.isGameOver = false;
    state.linesSinceLastGarbage = 0;
    state.puntos = 0;
    state.nivel = 1;

    setPuntos(0);
    setNivel(1);
    setIsGameOver(false);
    setIsPaused(false);
    setIsMaxCapReached(false);

    state.nextPiece = getNextTetromino();
    spawnNextPiece();
    draw();
  };

  // Game Loop
  useEffect(() => {
    let animId: number;

    const loop = (time: number) => {
      const state = gameStateRef.current;
      if (state.isPlaying && !state.isPaused && !state.isGameOver) {
        const delta = time - state.lastTime;
        state.lastTime = time;
        state.dropCounter += delta;
        if (state.dropCounter > state.dropInterval) {
          softDrop();
          state.dropCounter = 0;
        }
        draw();
      }
      animId = requestAnimationFrame(loop);
    };

    startNewGame();
    animId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animId);
  }, []);

  // Keyboard controls (SIN TECLA HOLD)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showNicknameModal || showCodeModal) return;

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          moveHorizontal(-1);
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          moveHorizontal(1);
          break;
        case 'ArrowUp':
        case 'KeyW':
        case 'KeyX':
          e.preventDefault();
          tryRotatePiece();
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          softDrop();
          break;
        case 'Space':
          e.preventDefault();
          hardDrop();
          break;
        case 'KeyP':
        case 'Escape':
          e.preventDefault();
          setIsPaused(prev => {
            const next = !prev;
            gameStateRef.current.isPaused = next;
            return next;
          });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNicknameModal, showCodeModal]);

  // Touch Drag Engine directo en canvas
  const touchTrackingRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0,
    accumulatedX: 0,
    accumulatedY: 0,
    hasMoved: false
  });

  const onCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && gameStateRef.current.isPlaying && !gameStateRef.current.isPaused) {
      const t = e.touches[0];
      const tracking = touchTrackingRef.current;
      tracking.active = true;
      tracking.startX = t.clientX;
      tracking.startY = t.clientY;
      tracking.currentX = t.clientX;
      tracking.currentY = t.clientY;
      tracking.startTime = performance.now();
      tracking.accumulatedX = 0;
      tracking.accumulatedY = 0;
      tracking.hasMoved = false;
      initAudio();
    }
  };

  const onCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const tracking = touchTrackingRef.current;
    if (!tracking.active || e.touches.length !== 1) return;

    const t = e.touches[0];
    const deltaX = t.clientX - tracking.currentX;
    const deltaY = t.clientY - tracking.currentY;

    tracking.currentX = t.clientX;
    tracking.currentY = t.clientY;

    tracking.accumulatedX += deltaX;
    tracking.accumulatedY += deltaY;

    const THRESHOLD_X = 20;
    const THRESHOLD_Y = 22;

    if (Math.abs(tracking.accumulatedX) >= THRESHOLD_X) {
      const steps = Math.floor(Math.abs(tracking.accumulatedX) / THRESHOLD_X);
      const dir = tracking.accumulatedX > 0 ? 1 : -1;
      for (let i = 0; i < steps; i++) {
        moveHorizontal(dir);
      }
      tracking.accumulatedX = tracking.accumulatedX % THRESHOLD_X;
      tracking.hasMoved = true;
    }

    if (tracking.accumulatedY >= THRESHOLD_Y) {
      softDrop();
      tracking.accumulatedY = 0;
      tracking.hasMoved = true;
    }
  };

  const onCanvasTouchEnd = () => {
    const tracking = touchTrackingRef.current;
    if (!tracking.active) return;
    tracking.active = false;

    const duration = performance.now() - tracking.startTime;
    const totalDeltaX = tracking.currentX - tracking.startX;
    const totalDeltaY = tracking.currentY - tracking.startY;
    const dist = Math.hypot(totalDeltaX, totalDeltaY);

    if (!tracking.hasMoved && dist < 12 && duration < 240) {
      tryRotatePiece();
      return;
    }

    if (totalDeltaY > 58 && duration < 220 && Math.abs(totalDeltaX) < 40) {
      hardDrop();
    }
  };

  // D-PAD con DAS / ARR ultra-rápido y fluido
  const bindDpadAction = (action: () => void, das = 135, arr = 40) => {
    let dasTimer: NodeJS.Timeout | null = null;
    let arrTimer: NodeJS.Timeout | null = null;

    const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      initAudio();
      action();

      dasTimer = setTimeout(() => {
        arrTimer = setInterval(() => {
          action();
        }, arr);
      }, das);
    };

    const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (dasTimer) clearTimeout(dasTimer);
      if (arrTimer) clearInterval(arrTimer);
    };

    return {
      onPointerDown,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onPointerLeave: onPointerUp
    };
  };

  // WhatsApp payout link
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `¡Hola! Quiero cobrar mis fichas de Tetris El Rey. Mi Código de Usuario es: #${userCode} y gané un total de ${fichas} fichas.`
  )}`;

  // Lectura de los 3 archivos para exportar a GitHub
  const [fileContents, setFileContents] = useState<{ html: string; css: string; js: string }>({
    html: '',
    css: '',
    js: ''
  });

  useEffect(() => {
    fetch('/public/index.html')
      .then(r => r.text())
      .then(html => setFileContents(prev => ({ ...prev, html })))
      .catch(() => {});

    fetch('/public/style.css')
      .then(r => r.text())
      .then(css => setFileContents(prev => ({ ...prev, css })))
      .catch(() => {});

    fetch('/public/app.js')
      .then(r => r.text())
      .then(js => setFileContents(prev => ({ ...prev, js })))
      .catch(() => {});
  }, [showCodeModal]);

  const handleCopyCode = (tab: 'html' | 'css' | 'js') => {
    const text = fileContents[tab];
    navigator.clipboard.writeText(text);
    setCopiedKey(tab);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadCode = (tab: 'html' | 'css' | 'js') => {
    const filename = tab === 'html' ? 'index.html' : tab === 'css' ? 'style.css' : 'app.js';
    const blob = new Blob([fileContents[tab]], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative w-screen h-screen h-[100dvh] overflow-hidden bg-[#03050a] flex flex-col items-center justify-center select-none font-sans text-slate-100">
      
      {/* Barra superior AI Studio / Controles de vista y exportación */}
      <nav className="absolute top-2 left-2 right-2 z-50 flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/10 text-xs">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="font-bold tracking-wider text-amber-300 font-serif">TETRIS EL REY</span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">· Retro-Futurista VIP (Sin HOLD)</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de vista */}
          <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10">
            <button
              onClick={() => setViewMode('hands')}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'hands' ? 'bg-amber-500 text-black font-bold' : 'text-slate-300 hover:text-white'
              }`}
              title="Primer plano de smartphone sostenido en las manos"
            >
              <Smartphone className="w-3 h-3" />
              <span className="hidden md:inline">En Manos</span>
            </button>
            <button
              onClick={() => setViewMode('phone')}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'phone' ? 'bg-amber-500 text-black font-bold' : 'text-slate-300 hover:text-white'
              }`}
              title="Solo Smartphone"
            >
              <span>Teléfono</span>
            </button>
            <button
              onClick={() => setViewMode('fullscreen')}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'fullscreen' ? 'bg-amber-500 text-black font-bold' : 'text-slate-300 hover:text-white'
              }`}
              title="Pantalla Completa"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>

          {/* Botón Ver / Copiar Archivos GitHub */}
          <button
            onClick={() => setShowCodeModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-colors shadow-lg shadow-emerald-900/40"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>3 Archivos GitHub</span>
          </button>
        </div>
      </nav>

      {/* ENTORNO CINEMATOGRÁFICO CON SOPORTE PARA fondo.jpeg */}
      <div 
        className="absolute inset-0 bg-cover bg-center pointer-events-none transition-all duration-700"
        style={{
          backgroundColor: '#04060a',
          backgroundImage: `
            radial-gradient(circle at 50% 20%, rgba(56, 189, 248, 0.08) 0%, transparent 45%),
            radial-gradient(circle at 50% 85%, rgba(234, 179, 8, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(10, 16, 30, 0.9) 0%, rgba(2, 3, 6, 0.98) 100%),
            url('fondo.jpeg')
          `
        }}
      />
      
      {/* Viñeta cinematográfica */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.85)_100%)] pointer-events-none" />

      {/* CONTENEDOR PRINCIPAL: SMARTPHONE SOSTENIDO EN LAS MANOS */}
      <div className={`relative z-10 flex items-center justify-center w-full h-full p-2 pt-12 transition-all duration-300 ${
        viewMode === 'fullscreen' ? 'p-0 pt-0' : ''
      }`}>
        
        {/* Mockup de Manos Ergonómicas Ilustradas (Modo 'hands') */}
        {viewMode === 'hands' && (
          <div className="absolute inset-0 pointer-events-none hidden sm:flex items-center justify-center">
            {/* Mano Izquierda */}
            <div className="absolute -left-12 lg:left-1/2 lg:-translate-x-[260px] top-1/2 -translate-y-1/2 w-48 h-96 opacity-75 filter drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)]">
              <svg viewBox="0 0 200 400" className="w-full h-full fill-[#1c2333]/90 stroke-emerald-500/20 stroke-[1.5]">
                <defs>
                  <linearGradient id="handGripLeft" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#1a2233" />
                    <stop offset="60%" stopColor="#0f1624" />
                    <stop offset="100%" stopColor="#060910" />
                  </linearGradient>
                </defs>
                <path d="M 195 110 C 170 100 130 115 110 135 C 90 155 80 185 85 220 C 75 240 70 270 78 300 C 85 330 110 360 145 380 L 195 385 Z" fill="url(#handGripLeft)" />
                <rect x="180" y="140" width="22" height="42" rx="10" fill="#243048" stroke="rgba(34,197,94,0.3)" />
                <rect x="182" y="195" width="20" height="42" rx="10" fill="#243048" stroke="rgba(34,197,94,0.3)" />
                <rect x="182" y="250" width="20" height="42" rx="10" fill="#243048" stroke="rgba(34,197,94,0.3)" />
                <rect x="180" y="305" width="22" height="40" rx="10" fill="#243048" stroke="rgba(34,197,94,0.3)" />
              </svg>
            </div>

            {/* Mano Derecha */}
            <div className="absolute -right-12 lg:right-1/2 lg:translate-x-[260px] top-1/2 -translate-y-1/2 w-48 h-96 opacity-75 filter drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)]">
              <svg viewBox="0 0 200 400" className="w-full h-full fill-[#1c2333]/90 stroke-amber-500/20 stroke-[1.5]">
                <defs>
                  <linearGradient id="handGripRight" x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1a2233" />
                    <stop offset="60%" stopColor="#0f1624" />
                    <stop offset="100%" stopColor="#060910" />
                  </linearGradient>
                </defs>
                <path d="M 5 110 C 30 100 70 115 90 135 C 110 155 120 185 115 220 C 125 240 130 270 122 300 C 115 330 90 360 55 380 L 5 385 Z" fill="url(#handGripRight)" />
                <rect x="-2" y="140" width="22" height="42" rx="10" fill="#243048" stroke="rgba(234,179,8,0.3)" />
                <rect x="-2" y="195" width="20" height="42" rx="10" fill="#243048" stroke="rgba(234,179,8,0.3)" />
                <rect x="-2" y="250" width="20" height="42" rx="10" fill="#243048" stroke="rgba(234,179,8,0.3)" />
                <rect x="-2" y="305" width="22" height="40" rx="10" fill="#243048" stroke="rgba(234,179,8,0.3)" />
              </svg>
            </div>
          </div>
        )}

        {/* Chasis del Smartphone Fiel a la Foto de Referencia */}
        <div className={`relative flex flex-col w-full max-w-[425px] h-full max-h-[890px] transition-all duration-300 ${
          viewMode === 'fullscreen' 
            ? 'max-w-none max-h-none rounded-none p-0 border-none shadow-none bg-transparent' 
            : 'rounded-[44px] p-2.5 bg-gradient-to-b from-[#222d3d] via-[#101726] to-[#080c14] border border-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95),0_0_40px_rgba(56,189,248,0.15),0_0_50px_rgba(234,179,8,0.12)]'
        }`}>
          
          {/* Dynamic Island (Cámara Frontal) */}
          {viewMode !== 'fullscreen' && (
            <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-24 h-4 bg-black rounded-full z-40 flex items-center justify-end pr-3 border border-white/10 shadow-md">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900 border border-white/30" />
            </div>
          )}

          {/* PANTALLA OLED DEL SMARTPHONE */}
          <div 
            className={`relative flex flex-col justify-between w-full h-full overflow-hidden bg-[#0b121e] ${
              viewMode === 'fullscreen' ? 'p-2' : 'rounded-[34px] pt-5 pb-3 px-3'
            }`}
            style={{
              backgroundImage: `
                radial-gradient(circle at 50% 20%, rgba(56, 189, 248, 0.05) 0%, transparent 60%),
                radial-gradient(circle at 50% 80%, rgba(234, 179, 8, 0.05) 0%, transparent 60%),
                repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.015) 0px, rgba(255, 255, 255, 0.015) 1px, transparent 1px, transparent 4px),
                linear-gradient(180deg, #090e18 0%, #0e1626 50%, #070b13 100%)
              `
            }}
          >

            {/* BARRA DE ESTADO TIPO CELULAR (9:41 AM, ID, AUDIO, PAUSA, BATERÍA 74%) */}
            <div className="flex items-center justify-between w-full px-1.5 pt-0.5 pb-1 text-[10px] font-bold text-slate-300 z-10 shrink-0">
              <span className="font-extrabold tracking-wide">9:41 AM</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-300 truncate max-w-[70px]">{nickname}</span>
                <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[9px]">
                  #{userCode}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" title="Firestore OK" />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSoundEnabled(prev => !prev)}
                  className="p-0.5 rounded text-slate-300 hover:text-white transition-colors"
                  title="Silenciar / Activar Sonido"
                >
                  {soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3 text-red-400" />}
                </button>
                <button
                  onClick={() => setIsPaused(prev => {
                    const next = !prev;
                    gameStateRef.current.isPaused = next;
                    return next;
                  })}
                  className="p-0.5 rounded text-slate-300 hover:text-white transition-colors"
                  title="Pausar Partida"
                >
                  {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3" />}
                </button>
                <span className="text-[9px]">🔋 74%</span>
              </div>
            </div>

            {/* FILA SUPERIOR: TÍTULO NEÓN "TETRIS" (IZQ) + PREVISUALIZADOR "NEXT" (DER) - FIEL A LA FOTO */}
            <header className="flex items-end justify-between w-full px-1 shrink-0 z-20 mb-0.5">
              <div className="flex flex-col items-start justify-center">
                <h1 
                  className="font-mono font-black text-2xl tracking-[2.5px] uppercase text-[#0b121e] leading-none"
                  style={{
                    WebkitTextStroke: '1.8px #ff7849',
                    textShadow: '0 0 5px #ff7849, 0 0 12px #ff5722, 0 0 22px rgba(255, 87, 34, 0.85)'
                  }}
                >
                  TETRIS
                </h1>
                <div className="text-[8px] font-mono font-extrabold tracking-[1.5px] text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.8)] mt-0.5">
                  EL REY · VIP RETRO
                </div>
              </div>

              {/* Tarjeta NEXT (Esquina superior derecha como en la foto) */}
              <div className="flex flex-col items-center shrink-0">
                <span className="font-mono font-black text-[10px] tracking-wider text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.9)] mb-0.5">
                  NEXT
                </span>
                <div className="w-[62px] h-[38px] bg-[#060b13] border-2 border-sky-400 rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(56,189,248,0.4)]">
                  <canvas ref={nextCanvasRef} width={60} height={36} className="w-[60px] h-[36px]" />
                </div>
              </div>
            </header>

            {/* ÁREA CENTRAL DEL JUEGO: MATRIZ A LA IZQUIERDA + SCORE/LEVEL/LINES A LA DERECHA */}
            <main className="relative flex flex-row items-center justify-center gap-2 flex-1 min-h-0 h-0 w-full my-1 overflow-hidden">
              
              {/* Marco del Canvas (Tablero) - Escala estrictamente con height: 100% y aspect-ratio: 1/2 */}
              <div className="relative flex items-center justify-center h-full max-h-full w-auto aspect-[1/2] max-w-[calc(100%-80px)] rounded-xl p-0.5 bg-[#04070e] border-2 border-[#23344d] shadow-[0_0_18px_rgba(0,0,0,0.9),0_0_12px_rgba(56,189,248,0.2)] overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={600}
                  onTouchStart={onCanvasTouchStart}
                  onTouchMove={onCanvasTouchMove}
                  onTouchEnd={onCanvasTouchEnd}
                  className="h-full max-h-full w-auto aspect-[1/2] object-contain rounded-lg bg-[#070d17] touch-none cursor-pointer"
                />

                {/* Toast flotante de fichas ganadas */}
                {floatingBonus && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-lg bg-amber-400 text-black font-mono font-black text-xs shadow-[0_0_14px_rgba(234,179,8,0.8)] z-30 animate-bounce">
                    {floatingBonus}
                  </div>
                )}

                {/* Toast Obstáculo Basura Peligro */}
                {showGarbageToast && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-lg bg-red-600/95 border border-red-300 text-white flex items-center gap-1 text-[8px] font-bold shadow-[0_0_12px_rgba(239,68,68,0.8)] z-30 animate-pulse whitespace-nowrap">
                    <span>⚠️</span>
                    <span>+2 Basura</span>
                  </div>
                )}

                {/* Overlay de Pausa */}
                {isPaused && (
                  <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-lg flex flex-col items-center justify-center gap-1.5 z-30">
                    <span className="text-2xl">⏸️</span>
                    <h2 className="font-mono font-black text-base text-amber-300 tracking-wider">PAUSA</h2>
                    <p className="font-mono text-[10px] text-sky-400">TETRIS EL REY</p>
                    <button
                      onClick={() => {
                        setIsPaused(false);
                        gameStateRef.current.isPaused = false;
                      }}
                      className="px-3 py-1 mt-1 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-extrabold text-[11px] shadow-lg shadow-amber-500/40"
                    >
                      CONTINUAR
                    </button>
                  </div>
                )}
              </div>

              {/* Panel Derecho de Estadísticas: JUGADOR, SCORE, LEVEL, LINES, FICHAS */}
              <aside className="flex flex-col gap-1.5 w-[74px] shrink-0 justify-center items-center text-center">
                {/* Texto 'Jugador El Rey #0001' justo arriba de SCORE */}
                <div className="flex flex-col items-center justify-center w-full px-1 py-0.5 rounded bg-sky-950/40 border border-sky-500/30 shadow-[0_0_8px_rgba(56,189,248,0.2)]">
                  <span className="font-mono text-[7px] font-black tracking-wider text-amber-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.6)] leading-none uppercase">
                    {nickname || 'Jugador El Rey'}
                  </span>
                  <span className="font-mono text-[8px] font-black tracking-widest text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.7)] leading-tight mt-0.5">
                    #{userCode || '0001'}
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="font-mono font-black text-[9px] tracking-wider text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]">
                    SCORE
                  </span>
                  <span className="font-mono font-black text-[13px] text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] leading-tight">
                    {puntos.toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="font-mono font-black text-[9px] tracking-wider text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]">
                    LEVEL
                  </span>
                  <span className="font-mono font-black text-[14px] text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.9)] leading-tight">
                    {String(nivel).padStart(2, '0')}
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="font-mono font-black text-[9px] tracking-wider text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]">
                    LINES
                  </span>
                  <span className="font-mono font-black text-[14px] text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.9)] leading-tight">
                    {String(lineas).padStart(2, '0')}
                  </span>
                </div>

                <div className="flex flex-col items-center pt-1 border-t border-white/10 w-full">
                  <span className="font-mono font-black text-[8px] tracking-wider text-yellow-300">
                    FICHAS
                  </span>
                  <span className="font-mono font-black text-[12px] text-yellow-200 drop-shadow-[0_0_8px_rgba(234,179,8,0.9)] leading-tight">
                    {fichas.toLocaleString()}🪙
                  </span>
                </div>
              </aside>

            </main>

            {/* CONTROLES TÁCTILES INFERIORES: TOTALMENTE SEPARADOS DEL TABLERO */}
            <footer className="w-full shrink-0 z-20 mt-auto pt-0.5">
              <div className="flex items-end justify-between w-full gap-2 px-1">
                
                {/* 1. CRUCETA VERDE NEÓN BRILLANTE (D-PAD) */}
                <div className="flex flex-col items-center relative">
                  <span className="font-mono font-black text-[9px] text-emerald-400 drop-shadow-[0_0_6px_#22c55e] tracking-wider mb-0.5">
                    UP
                  </span>
                  <div className="relative w-[104px] h-[104px] flex items-center justify-center">
                    {/* Barra Horizontal Neón */}
                    <div className="absolute w-[102px] h-[36px] bg-[#0f172a] border-2 border-[#22c55e] rounded-xl shadow-[0_0_14px_rgba(34,197,94,0.7),inset_0_0_8px_rgba(34,197,94,0.2)]" />
                    
                    {/* Barra Vertical Neón */}
                    <div className="absolute w-[36px] h-[102px] bg-[#0f172a] border-2 border-[#22c55e] rounded-xl shadow-[0_0_14px_rgba(34,197,94,0.7),inset_0_0_8px_rgba(34,197,94,0.2)]" />

                    {/* Botón Arriba / Caída Dura */}
                    <button
                      {...bindDpadAction(() => hardDrop(), 350, 350)}
                      className="absolute top-0 left-[34px] w-[36px] h-[36px] flex items-center justify-center text-emerald-400 text-base drop-shadow-[0_0_8px_#22c55e] active:scale-90 active:text-white transition-transform touch-none z-10"
                      aria-label="Arriba"
                    >
                      ▲
                    </button>

                    {/* Botón Abajo / Soft Drop */}
                    <button
                      {...bindDpadAction(() => softDrop(), 110, 38)}
                      className="absolute bottom-0 left-[34px] w-[36px] h-[36px] flex items-center justify-center text-emerald-400 text-base drop-shadow-[0_0_8px_#22c55e] active:scale-90 active:text-white transition-transform touch-none z-10"
                      aria-label="Abajo"
                    >
                      ▼
                    </button>

                    {/* Botón Izquierda */}
                    <button
                      {...bindDpadAction(() => moveHorizontal(-1))}
                      className="absolute left-0 top-[34px] w-[36px] h-[36px] flex items-center justify-center text-emerald-400 text-base drop-shadow-[0_0_8px_#22c55e] active:scale-90 active:text-white transition-transform touch-none z-10"
                      aria-label="Izquierda"
                    >
                      ◀
                    </button>

                    {/* Botón Derecha */}
                    <button
                      {...bindDpadAction(() => moveHorizontal(1))}
                      className="absolute right-0 top-[34px] w-[36px] h-[36px] flex items-center justify-center text-emerald-400 text-base drop-shadow-[0_0_8px_#22c55e] active:scale-90 active:text-white transition-transform touch-none z-10"
                      aria-label="Derecha"
                    >
                      ▶
                    </button>

                    {/* Centro de la cruceta */}
                    <div className="absolute w-[16px] h-[16px] rounded-full bg-[#080c14] border border-emerald-500/40 z-5" />
                  </div>
                </div>

                {/* BOTÓN DE PAUSA DEDICADO (CENTRO) */}
                <div className="flex flex-col items-center justify-center self-center mx-1 mb-2 shrink-0">
                  <button
                    onClick={() => {
                      initAudio();
                      setIsPaused(prev => {
                        const next = !prev;
                        gameStateRef.current.isPaused = next;
                        return next;
                      });
                    }}
                    className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl bg-gradient-to-b from-slate-800 to-slate-950 border border-sky-400/80 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.35),0_3px_6px_rgba(0,0,0,0.6)] active:scale-90 active:border-yellow-400 active:text-yellow-300 transition-all cursor-pointer touch-none"
                    aria-label="Pausa"
                  >
                    <span className="text-sm leading-none">⏸</span>
                    <span className="font-mono font-black text-[9px] tracking-wider text-sky-300">PAUSA</span>
                  </button>
                </div>

                {/* 2. BOTÓN "ROTAR" AMARILLO DORADO + BOTÓN REDONDO "A" */}
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex justify-between w-full px-1.5 font-mono font-black text-[9px] text-yellow-300 tracking-wider">
                    <span>LEFT</span>
                    <span>RIGHT</span>
                  </div>

                  <div className="flex items-end gap-2">
                    {/* Botón ROTAR Ergonómico con Curva */}
                    <button
                      onPointerDown={(e) => {
                        e.preventDefault();
                        initAudio();
                        tryRotatePiece();
                      }}
                      className="relative w-[96px] h-[56px] bg-gradient-to-br from-yellow-300 via-amber-500 to-amber-600 border-2 border-yellow-200 rounded-[12px_12px_28px_12px] flex items-center justify-center shadow-[0_0_18px_rgba(234,179,8,0.5),0_4px_10px_rgba(0,0,0,0.6),inset_0_2px_4px_rgba(255,255,255,0.75)] active:scale-95 transition-transform touch-none"
                      aria-label="Rotar Pieza"
                    >
                      <span className="font-mono font-black text-xs tracking-wider text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]">
                        ROTAR
                      </span>
                    </button>

                    {/* Botón Circular Tactil "A" (Hard Drop) */}
                    <button
                      onPointerDown={(e) => {
                        e.preventDefault();
                        initAudio();
                        hardDrop();
                      }}
                      className="w-[38px] h-[38px] rounded-full bg-gradient-to-br from-slate-600 via-slate-800 to-slate-950 border-2 border-slate-400 flex items-center justify-center font-mono font-black text-white text-sm shadow-[0_3px_8px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.4)] active:scale-90 active:border-amber-400 transition-transform touch-none"
                      aria-label="Acción A Hard Drop"
                    >
                      A
                    </button>
                  </div>

                  <span className="font-mono font-black text-[8px] text-yellow-300 tracking-wider mr-1 mt-0.5">
                    DROP
                  </span>
                </div>

              </div>
            </footer>

            {/* Barra de Navegación Inferior (Home Indicator) */}
            <div className="w-28 h-1 bg-white/40 rounded-full mx-auto mt-1 shrink-0" />

          </div>
        </div>
      </div>

      {/* MODAL: CUPÓN DE COBRO Y WHATSAPP */}
      {isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#131a2b] to-[#0a0e1a] border-2 border-amber-500 p-5 text-center shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_35px_rgba(245,158,11,0.35)]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-300 via-amber-500 to-orange-500" />

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-amber-400/40 text-amber-300 text-xs font-serif font-black mb-2">
              <Crown className="w-3.5 h-3.5" />
              <span>TETRIS EL REY</span>
            </div>

            {isMaxCapReached && (
              <div className="px-3 py-1 mb-2 rounded bg-red-600 text-white font-bold text-xs tracking-wider shadow-lg animate-pulse">
                🏆 ¡TOPE MÁXIMO DE 10,000 FICHAS ALCANZADO! 🏆
              </div>
            )}

            <h2 className="font-serif font-black text-2xl text-transparent bg-gradient-to-r from-yellow-200 via-amber-400 to-amber-200 bg-clip-text">
              ¡FELICITACIONES!
            </h2>
            <p className="text-xs text-slate-400 mb-3">Has ganado fichas en tu partida promocional</p>

            {/* Fichas Ganadas */}
            <div className="p-3 mb-3 rounded-xl bg-amber-950/30 border border-dashed border-amber-500/70 flex flex-col items-center justify-center">
              <span className="text-[10px] font-mono font-bold text-amber-300 tracking-wider">TOTAL FICHAS GANADAS</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl">🪙</span>
                <span className="font-mono font-black text-3xl text-white drop-shadow-[0_0_12px_rgba(245,158,11,0.9)]">
                  {fichas.toLocaleString()}
                </span>
                <span className="font-serif font-black text-amber-300">FICHAS</span>
              </div>
            </div>

            {/* Credenciales */}
            <div className="p-2.5 mb-4 rounded-lg bg-black/50 border border-white/10 flex flex-col gap-1.5 text-xs text-left">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">CÓDIGO DE USUARIO:</span>
                <span className="font-mono font-black text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  #{userCode}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">APODO:</span>
                <span className="font-bold text-white">{nickname}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">LÍNEAS ELIMINADAS:</span>
                <span className="font-mono font-bold text-sky-400">{lineas}</span>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/50 transition-all active:scale-98"
              >
                <span>💬</span>
                <span>Cobrar Fichas en WhatsApp</span>
                <ExternalLink className="w-4 h-4 ml-1" />
              </a>

              <button
                onClick={startNewGame}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/10 transition-colors"
              >
                🔄 Jugar Otra Partida
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CON LOS 3 ARCHIVOS EDITADOS PARA GITHUB (index.html, style.css, app.js) */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md">
          <div className="relative flex flex-col w-full max-w-4xl h-[90vh] rounded-2xl bg-[#090d16] border border-amber-500/40 shadow-2xl overflow-hidden">
            
            {/* Header del modal */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#0d1424] border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  3 Archivos Editados para GitHub Pages
                </h3>
              </div>

              <button
                onClick={() => setShowCodeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas y Acciones */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-[#0b101c] border-b border-white/10 shrink-0">
              <div className="flex items-center gap-1.5">
                {(['html', 'css', 'js'] as const).map(tab => {
                  const filename = tab === 'html' ? 'index.html' : tab === 'css' ? 'style.css' : 'app.js';
                  const active = activeCodeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveCodeTab(tab)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                        active 
                          ? 'bg-amber-500 text-black shadow-md' 
                          : 'bg-slate-800/80 text-slate-300 hover:text-white'
                      }`}
                    >
                      {filename}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyCode(activeCodeTab)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-md"
                >
                  {copiedKey === activeCodeTab ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === activeCodeTab ? '¡Copiado!' : 'Copiar Código'}</span>
                </button>

                <button
                  onClick={() => handleDownloadCode(activeCodeTab)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-white/10 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </button>
              </div>
            </div>

            {/* Visor de Código */}
            <div className="flex-1 overflow-auto p-4 bg-[#05070d] text-emerald-400 font-mono text-xs leading-relaxed select-text">
              <pre className="whitespace-pre">
                {fileContents[activeCodeTab] || 'Cargando archivo...'}
              </pre>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
