/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * TETRIS EL REY - RETRO-FUTURISTA VIP
 * Motor de Tetris con Canvas, Controles Táctiles, Sonido Web Audio
 * y Firebase Firestore para contador secuencial atómico de usuarios (1, 2, 3...).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { sounds } from './audio';
import {
  testConnection,
  recordGameSession,
  getExistingUserByCode,
} from './firebase';
import { PlayerProfile, TetrominoPiece, TetrominoType } from './types';
import { Controls } from './components/Controls';
import { LoginModal, PayoutModal, LeaderboardModal, AdminModal } from './components/Modals';
import { NeonParticleSystem } from './particles';

// Constantes de la Matriz y del Casino
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30; // 300x600 nativo (aspect-ratio 1:2)

const TOPE_MAXIMO_FICHAS = 10000;
const FICHAS_POR_LINEA = 50;
const BONIFICACION_TETRIS_FICHAS = 150;
const PUNTOS_POR_LINEA = [0, 100, 300, 600, 1000];

// Dificultad Máxima Aumentada
const LINEAS_POR_NIVEL = 6;        // Progresión de nivel súper rápida (cada 6 líneas)
const VELOCIDAD_INICIAL_MS = 520;  // Caída inicial mucho más veloz y desafiante (520ms)
const FACTOR_ACELERACION = 0.76;   // Aceleración pronunciada por nivel (0.76x)
const VELOCIDAD_MINIMA_MS = 40;    // Límite arcade de velocidad extrema (40ms)
const BASURA_INTERVALO_LINEAS = 7; // Obstáculos basura más frecuentes (cada 7 líneas)

// Paleta de Colores Neón Fiel
const TETROMINO_COLORS: Record<string, { core: string; main: string; dark: string; glow: string }> = {
  I: { core: '#a5f3fc', main: '#06b6d4', dark: '#0e7490', glow: 'rgba(6, 182, 212, 0.9)' },
  J: { core: '#bfdbfe', main: '#3b82f6', dark: '#1d4ed8', glow: 'rgba(59, 130, 246, 0.9)' },
  L: { core: '#fed7aa', main: '#f97316', dark: '#c2410c', glow: 'rgba(249, 115, 22, 0.9)' },
  O: { core: '#fef08a', main: '#eab308', dark: '#a16207', glow: 'rgba(234, 179, 8, 0.9)' },
  S: { core: '#a7f3d0', main: '#22c55e', dark: '#15803d', glow: 'rgba(34, 197, 94, 0.9)' },
  T: { core: '#f5d0fe', main: '#c026d3', dark: '#86198f', glow: 'rgba(192, 38, 211, 0.9)' },
  Z: { core: '#fecaca', main: '#ef4444', dark: '#b91c1c', glow: 'rgba(239, 68, 68, 0.9)' },
  GARBAGE: { core: '#9ca3af', main: '#374151', dark: '#111827', glow: 'rgba(239, 68, 68, 0.7)' },
};

// Matrices de Figuras Tetris
const SHAPES: Record<string, number[][]> = {
  I: [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
  J: [[1,0,0], [1,1,1], [0,0,0]],
  L: [[0,0,1], [1,1,1], [0,0,0]],
  O: [[1,1], [1,1]],
  S: [[0,1,1], [1,1,0], [0,0,0]],
  T: [[0,1,0], [1,1,1], [0,0,0]],
  Z: [[1,1,0], [0,1,1], [0,0,0]],
};

export default function App() {
  // Estado de Jugador y Firebase
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(true);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(true);
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Estadísticas del Juego
  const [score, setScore] = useState<number>(0);
  const [lines, setLines] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [fichas, setFichas] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isMaxCap, setIsMaxCap] = useState<boolean>(false);
  const [floatingChips, setFloatingChips] = useState<{ id: number; amount: number }[]>([]);
  const [showGarbageToast, setShowGarbageToast] = useState<boolean>(false);

  // Referencias Canvas y Bucle
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const dropCounterRef = useRef<number>(0);
  const dropIntervalRef = useRef<number>(VELOCIDAD_INICIAL_MS);

  // Estado mutable del juego
  const gridRef = useRef<(string | number)[][]>(createEmptyGrid());
  const currentPieceRef = useRef<TetrominoPiece | null>(null);
  const nextPieceRef = useRef<TetrominoPiece | null>(null);
  const bagRef = useRef<TetrominoType[]>([]);
  const linesSinceLastGarbageRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const sessionFichasRef = useRef<number>(0);
  const particleSystemRef = useRef<NeonParticleSystem>(new NeonParticleSystem());

  function createEmptyGrid(): (string | number)[][] {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  // Comprobar conexión Firebase al montar y fijar dispositivo
  useEffect(() => {
    testConnection().then((connected) => {
      setFirebaseConnected(connected);
    });

    const deviceUserRaw =
      localStorage.getItem('tetris_device_locked_user') ||
      localStorage.getItem('tetris_el_rey_player');

    if (deviceUserRaw) {
      try {
        const parsed: PlayerProfile = JSON.parse(deviceUserRaw);
        if (parsed.userCode && parsed.nickname) {
          setPlayer(parsed);
          setShowLoginModal(false);

          getExistingUserByCode(parsed.userCode).then((fresh) => {
            if (fresh) {
              setPlayer(fresh);
              localStorage.setItem('tetris_device_locked_user', JSON.stringify(fresh));
            }
          });

          startNewGame(parsed);
        }
      } catch {
        setShowLoginModal(true);
      }
    } else {
      setShowLoginModal(true);
    }
  }, []);

  const refreshCurrentPlayer = useCallback(async () => {
    if (player?.userCode) {
      const fresh = await getExistingUserByCode(player.userCode);
      if (fresh) {
        setPlayer(fresh);
        localStorage.setItem('tetris_device_locked_user', JSON.stringify(fresh));
      }
    }
  }, [player?.userCode]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Generador 7-Bag
  const getNextTetromino = useCallback((): TetrominoPiece => {
    if (bagRef.current.length === 0) {
      const keys: TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
      bagRef.current = keys.sort(() => Math.random() - 0.5);
    }
    const type = bagRef.current.pop() || 'I';
    return {
      type,
      matrix: SHAPES[type].map((row) => [...row]),
      x: 0,
      y: 0,
    };
  }, []);

  // Colisión
  const checkCollision = useCallback(
    (offsetX: number, offsetY: number, matrix: number[][]): boolean => {
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c]) {
            const newX = offsetX + c;
            const newY = offsetY + r;

            if (newX < 0 || newX >= COLS || newY >= ROWS) {
              return true;
            }

            if (newY >= 0 && gridRef.current[newY][newX] !== 0) {
              return true;
            }
          }
        }
      }
      return false;
    },
    []
  );

  const rotateMatrix = (matrix: number[][]): number[][] => {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        result[c][N - 1 - r] = matrix[r][c];
      }
    }
    return result;
  };

  const tryRotatePiece = useCallback(() => {
    if (!currentPieceRef.current || isPausedRef.current || !isPlayingRef.current) return;

    const piece = currentPieceRef.current;
    const rotated = rotateMatrix(piece.matrix);
    const kicks = [0, -1, 1, -2, 2];

    for (const kick of kicks) {
      if (!checkCollision(piece.x + kick, piece.y, rotated)) {
        piece.matrix = rotated;
        piece.x += kick;
        sounds.play('rotate');
        return;
      }
    }
  }, [checkCollision]);

  const moveHorizontal = useCallback(
    (dir: number) => {
      if (!currentPieceRef.current || isPausedRef.current || !isPlayingRef.current) return;
      const piece = currentPieceRef.current;
      if (!checkCollision(piece.x + dir, piece.y, piece.matrix)) {
        piece.x += dir;
        sounds.play('move');
      }
    },
    [checkCollision]
  );

  const [accumulatedFichasForModal, setAccumulatedFichasForModal] = useState<number>(0);

  // Fin de Juego con actualización inmediata (0 milisegundos de latencia)
  const triggerGameOver = useCallback(
    (reachedMaxCap = false, finalSessionFichas?: number) => {
      isPlayingRef.current = false;
      setIsGameOver(true);
      setIsMaxCap(reachedMaxCap);

      const effectiveGameFichas = typeof finalSessionFichas === 'number'
        ? finalSessionFichas
        : sessionFichasRef.current;

      setFichas(effectiveGameFichas);
      sessionFichasRef.current = effectiveGameFichas;

      if (reachedMaxCap) {
        sounds.play('tetris');
        try {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        } catch {}
      } else {
        sounds.play('gameover');
      }

      // Cálculo instantáneo optimista del acumulado para cobrar sin esperar a internet
      const prevTotal = player?.totalFichas || 0;
      const isBlocked = !!player?.isBlocked;
      const earnedFichas = isBlocked ? 0 : effectiveGameFichas;

      // Si alcanzó el tope máximo de 10,000 fichas, el total acumulado garantizado es exactamente 10,000
      const newAccumulated = reachedMaxCap
        ? TOPE_MAXIMO_FICHAS
        : Math.min(TOPE_MAXIMO_FICHAS, prevTotal + earnedFichas);

      setAccumulatedFichasForModal(newAccumulated);

      if (player) {
        const optimisticProfile: PlayerProfile = {
          ...player,
          totalFichas: newAccumulated,
          highScore: Math.max(player.highScore || 0, score),
          gamesPlayed: (player.gamesPlayed || 0) + 1,
          isBlocked,
        };
        // Actualización inmediata en memoria y almacenamiento local
        setPlayer(optimisticProfile);
        localStorage.setItem('tetris_device_locked_user', JSON.stringify(optimisticProfile));
        localStorage.setItem('tetris_el_rey_player', JSON.stringify(optimisticProfile));

        // Las fichas que se mandan a Firestore para que el saldo llegue exactamente a 10,000
        const fichasToRecord = isBlocked
          ? 0
          : reachedMaxCap
            ? Math.max(0, TOPE_MAXIMO_FICHAS - prevTotal)
            : earnedFichas;

        // Guardado asíncrono en segundo plano en Firebase Firestore
        recordGameSession({
          userCode: player.userCode,
          nickname: player.nickname,
          score,
          lines,
          level,
          fichas: fichasToRecord,
        }).then((updated) => {
          if (updated) {
            const guaranteedProfile = reachedMaxCap
              ? { ...updated, totalFichas: TOPE_MAXIMO_FICHAS }
              : updated;
            setPlayer(guaranteedProfile);
            localStorage.setItem('tetris_device_locked_user', JSON.stringify(guaranteedProfile));
            localStorage.setItem('tetris_el_rey_player', JSON.stringify(guaranteedProfile));
          }
        });
      }

      setShowPayoutModal(true);
    },
    [player, score, lines, level]
  );

  // Obstáculos basura indestructibles
  const insertGarbageObstacles = useCallback((count = 3) => {
    let placed = 0;
    for (let i = 0; i < 30 && placed < count; i++) {
      const row = ROWS - 1 - Math.floor(Math.random() * 6);
      const col = Math.floor(Math.random() * COLS);
      if (gridRef.current[row][col] === 0) {
        gridRef.current[row][col] = 'GARBAGE';
        placed++;
      }
    }
    setShowGarbageToast(true);
    setTimeout(() => setShowGarbageToast(false), 2400);
  }, []);

  // Aparición de nueva pieza
  const spawnNextPiece = useCallback(() => {
    currentPieceRef.current = nextPieceRef.current || getNextTetromino();
    nextPieceRef.current = getNextTetromino();

    const piece = currentPieceRef.current;
    piece.y = 0;
    piece.x = Math.floor((COLS - piece.matrix[0].length) / 2);

    if (checkCollision(piece.x, piece.y, piece.matrix)) {
      triggerGameOver(false);
    }
  }, [checkCollision, getNextTetromino, triggerGameOver]);

  // Limpieza de líneas con efectos visuales de neón
  const clearFullLines = useCallback(() => {
    const clearedRows: number[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      let isFull = true;
      for (let c = 0; c < COLS; c++) {
        if (gridRef.current[r][c] === 0) {
          isFull = false;
          break;
        }
      }

      if (isFull) {
        clearedRows.push(r);
        gridRef.current.splice(r, 1);
        gridRef.current.unshift(Array(COLS).fill(0));
        r++;
      }
    }

    if (clearedRows.length > 0) {
      const cleared = clearedRows.length;

      particleSystemRef.current.triggerLineClear(
        clearedRows,
        cleared === 4,
        canvasRef.current?.width || 300,
        BLOCK_SIZE
      );

      setLines((prevLines) => {
        const newLines = prevLines + cleared;

        // Puntos
        const addedScore = (PUNTOS_POR_LINEA[cleared] || 1000) * level;
        setScore((prev) => prev + addedScore);

        // Sonidos de línea y tetris
        if (cleared === 4) {
          sounds.play('tetris');
          try {
            confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
          } catch {}
        } else {
          sounds.play('line');
        }

        // Fichas (solo si el usuario NO tiene los puntos bloqueados tras cobrar)
        if (!player?.isBlocked) {
          let addedFichas = cleared * FICHAS_POR_LINEA;
          if (cleared === 4) {
            addedFichas += BONIFICACION_TETRIS_FICHAS;
          }

          const currentAccount = player?.totalFichas || 0;
          const prevSessionFichas = sessionFichasRef.current;
          const nextSessionFichas = prevSessionFichas + addedFichas;

          // Toast de fichas
          const toastId = Date.now() + Math.random();
          setFloatingChips((prev) => [...prev, { id: toastId, amount: addedFichas }]);
          setTimeout(() => {
            setFloatingChips((prev) => prev.filter((t) => t.id !== toastId));
          }, 1200);

          if (currentAccount + nextSessionFichas >= TOPE_MAXIMO_FICHAS || nextSessionFichas >= TOPE_MAXIMO_FICHAS) {
            // Alcanzó el tope de 10,000 fichas
            const neededForCap = Math.max(0, TOPE_MAXIMO_FICHAS - currentAccount);
            const cappedGameFichas = neededForCap > 0 ? neededForCap : nextSessionFichas;
            sessionFichasRef.current = cappedGameFichas;
            setFichas(cappedGameFichas);
            triggerGameOver(true, cappedGameFichas);
          } else {
            sessionFichasRef.current = nextSessionFichas;
            setFichas(nextSessionFichas);
          }
        }

        // Nivel y aceleración aumentada
        const nextLevel = Math.floor(newLines / LINEAS_POR_NIVEL) + 1;
        if (nextLevel > level) {
          setLevel(nextLevel);
          sounds.play('level');
          const newSpeed = Math.max(
            VELOCIDAD_MINIMA_MS,
            Math.floor(VELOCIDAD_INICIAL_MS * Math.pow(FACTOR_ACELERACION, nextLevel - 1))
          );
          dropIntervalRef.current = newSpeed;
        }

        // Basura periódica
        linesSinceLastGarbageRef.current += cleared;
        if (linesSinceLastGarbageRef.current >= BASURA_INTERVALO_LINEAS) {
          insertGarbageObstacles(3);
          linesSinceLastGarbageRef.current = 0;
        }

        return newLines;
      });
    }
  }, [level, triggerGameOver, insertGarbageObstacles, player]);

  // Fijar pieza
  const lockPiece = useCallback(() => {
    if (!currentPieceRef.current) return;
    const { x, y, matrix, type } = currentPieceRef.current;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          if (y + r < 0) {
            triggerGameOver(false);
            return;
          }
          gridRef.current[y + r][x + c] = type;
        }
      }
    }

    clearFullLines();
    spawnNextPiece();
  }, [clearFullLines, spawnNextPiece, triggerGameOver]);

  // Soft Drop
  const softDrop = useCallback(() => {
    if (!currentPieceRef.current || isPausedRef.current || !isPlayingRef.current) return;
    const piece = currentPieceRef.current;
    if (!checkCollision(piece.x, piece.y + 1, piece.matrix)) {
      piece.y += 1;
      dropCounterRef.current = 0;
    } else {
      lockPiece();
    }
  }, [checkCollision, lockPiece]);

  // Hard Drop
  const hardDrop = useCallback(() => {
    if (!currentPieceRef.current || isPausedRef.current || !isPlayingRef.current) return;
    const piece = currentPieceRef.current;
    while (!checkCollision(piece.x, piece.y + 1, piece.matrix)) {
      piece.y += 1;
    }
    sounds.play('drop');
    lockPiece();
  }, [checkCollision, lockPiece]);

  // Pausa
  const togglePause = useCallback(() => {
    if (isGameOver || !isPlayingRef.current) return;
    setIsPaused((prev) => !prev);
    sounds.play('click');
  }, [isGameOver]);

  // Dibujo de bloques neón
  const drawBlock = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    type: string,
    isGhost = false
  ) => {
    const colors = TETROMINO_COLORS[type] || TETROMINO_COLORS.I;
    ctx.save();

    if (isGhost) {
      ctx.strokeStyle = colors.glow;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.fillRect(x + 1.5, y + 1.5, size - 3, size - 3);
    } else {
      const grad = ctx.createLinearGradient(x, y, x + size, y + size);
      grad.addColorStop(0, colors.main);
      grad.addColorStop(1, colors.dark || '#070b13');

      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

      // Bisel de luz
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);

      // Núcleo brillante
      ctx.fillStyle = colors.core || 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(x + 5, y + 5, 4, 4);

      // Borde exterior
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, size, size);
    }

    ctx.restore();
  };

  // Múltiples estelas láser ascendentes
  const drawPieceFallTrail = (ctx: CanvasRenderingContext2D, piece: TetrominoPiece) => {
    const colors = TETROMINO_COLORS[piece.type] || TETROMINO_COLORS.T;
    const { matrix, x, y } = piece;

    ctx.save();
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
          const trailHeight = Math.min(blockTopY, BLOCK_SIZE * 3.3);
          const trailTopY = blockTopY - trailHeight;

          const streamGrad = ctx.createLinearGradient(0, blockTopY, 0, trailTopY);
          streamGrad.addColorStop(0, colors.glow.replace(/[\d.]+\)$/, '0.75)'));
          streamGrad.addColorStop(0.3, colors.glow.replace(/[\d.]+\)$/, '0.35)'));
          streamGrad.addColorStop(0.75, colors.glow.replace(/[\d.]+\)$/, '0.08)'));
          streamGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = streamGrad;
          ctx.fillRect(blockLeftX + 3, trailTopY, BLOCK_SIZE - 6, trailHeight);

          const laserGrad = ctx.createLinearGradient(0, blockTopY, 0, trailTopY);
          laserGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
          laserGrad.addColorStop(0.25, colors.core || 'rgba(255, 255, 255, 0.7)');
          laserGrad.addColorStop(0.8, colors.glow.replace(/[\d.]+\)$/, '0.3)'));
          laserGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = laserGrad;
          ctx.fillRect(blockLeftX + BLOCK_SIZE / 2 - 1.5, trailTopY, 3, trailHeight);

          const baseGrad = ctx.createRadialGradient(
            blockLeftX + BLOCK_SIZE / 2,
            blockTopY,
            1,
            blockLeftX + BLOCK_SIZE / 2,
            blockTopY,
            BLOCK_SIZE * 0.75
          );
          baseGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
          baseGrad.addColorStop(0.4, colors.glow.replace(/[\d.]+\)$/, '0.5)'));
          baseGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = baseGrad;
          ctx.fillRect(blockLeftX, blockTopY - 8, BLOCK_SIZE, 12);
        }
      }
    }

    ctx.restore();
  };

  // Dibujar tablero y piezas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
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

    // Tablero acumulado
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = gridRef.current[r][c];
        if (cell !== 0) {
          drawBlock(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, String(cell));
        }
      }
    }

    // Pieza activa y fantasma
    const piece = currentPieceRef.current;
    if (piece && isPlayingRef.current) {
      drawPieceFallTrail(ctx, piece);

      let ghostY = piece.y;
      while (!checkCollision(piece.x, ghostY + 1, piece.matrix)) {
        ghostY++;
      }

      if (ghostY > piece.y) {
        for (let r = 0; r < piece.matrix.length; r++) {
          for (let c = 0; c < piece.matrix[r].length; c++) {
            if (piece.matrix[r][c]) {
              drawBlock(
                ctx,
                (piece.x + c) * BLOCK_SIZE,
                (ghostY + r) * BLOCK_SIZE,
                BLOCK_SIZE,
                piece.type,
                true
              );
            }
          }
        }
      }

      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c]) {
            drawBlock(
              ctx,
              (piece.x + c) * BLOCK_SIZE,
              (piece.y + r) * BLOCK_SIZE,
              BLOCK_SIZE,
              piece.type
            );
          }
        }
      }
    }

    // Efectos de partículas de neón
    particleSystemRef.current.draw(ctx, canvas.width);

    // Previsualización pieza siguiente
    const nextCanvas = nextCanvasRef.current;
    if (nextCanvas) {
      const nCtx = nextCanvas.getContext('2d');
      if (nCtx) {
        nCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        const next = nextPieceRef.current;
        if (next) {
          const miniSize = 12;
          const matrix = next.matrix;
          const pW = matrix[0].length * miniSize;
          const pH = matrix.length * miniSize;
          const sX = Math.floor((nextCanvas.width - pW) / 2);
          const sY = Math.floor((nextCanvas.height - pH) / 2);

          for (let r = 0; r < matrix.length; r++) {
            for (let c = 0; c < matrix[r].length; c++) {
              if (matrix[r][c]) {
                drawBlock(nCtx, sX + c * miniSize, sY + r * miniSize, miniSize, next.type);
              }
            }
          }
        }
      }
    }
  }, [checkCollision]);

  // Bucle de animación
  const gameLoop = useCallback(
    (time = 0) => {
      if (!isPlayingRef.current) return;

      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      if (!isPausedRef.current) {
        dropCounterRef.current += delta;
        if (dropCounterRef.current > dropIntervalRef.current) {
          softDrop();
          dropCounterRef.current = 0;
        }
      }

      particleSystemRef.current.update();
      render();
      requestRef.current = requestAnimationFrame(gameLoop);
    },
    [softDrop, render]
  );

  // Iniciar partida nueva
  const startNewGame = useCallback(
    (chosenPlayer?: PlayerProfile) => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);

      const activePlayer = chosenPlayer || player;
      if (activePlayer) {
        setPlayer(activePlayer);
        localStorage.setItem('tetris_el_rey_player', JSON.stringify(activePlayer));
      }

      gridRef.current = createEmptyGrid();
      dropIntervalRef.current = VELOCIDAD_INICIAL_MS;
      dropCounterRef.current = 0;
      lastTimeRef.current = performance.now();
      isPlayingRef.current = true;
      isPausedRef.current = false;
      linesSinceLastGarbageRef.current = 0;

      setScore(0);
      setLines(0);
      setLevel(1);
      setFichas(0);
      sessionFichasRef.current = 0;
      setAccumulatedFichasForModal(0);
      setIsPaused(false);
      setIsGameOver(false);
      setIsMaxCap(false);
      setShowPayoutModal(false);

      particleSystemRef.current.clear();
      bagRef.current = [];
      nextPieceRef.current = getNextTetromino();
      spawnNextPiece();

      requestRef.current = requestAnimationFrame(gameLoop);
    },
    [player, getNextTetromino, spawnNextPiece, gameLoop]
  );

  // Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlayingRef.current || isGameOver) return;

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
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          softDrop();
          break;
        case 'ArrowUp':
        case 'KeyW':
        case 'KeyX':
          e.preventDefault();
          tryRotatePiece();
          break;
        case 'Space':
          e.preventDefault();
          hardDrop();
          break;
        case 'KeyP':
        case 'Escape':
          e.preventDefault();
          togglePause();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGameOver, moveHorizontal, softDrop, tryRotatePiece, hardDrop, togglePause]);

  // Gestos táctiles directos en el canvas (Drag & Tap)
  const touchTrackRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    accumulatedX: 0,
    accumulatedY: 0,
    startTime: 0,
    hasMoved: false,
  });

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && isPlayingRef.current && !isPaused) {
      const t = e.touches[0];
      touchTrackRef.current = {
        active: true,
        startX: t.clientX,
        startY: t.clientY,
        lastX: t.clientX,
        lastY: t.clientY,
        accumulatedX: 0,
        accumulatedY: 0,
        startTime: performance.now(),
        hasMoved: false,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const track = touchTrackRef.current;
    if (!track.active || e.touches.length !== 1) return;

    const t = e.touches[0];
    const dx = t.clientX - track.lastX;
    const dy = t.clientY - track.lastY;
    track.lastX = t.clientX;
    track.lastY = t.clientY;
    track.accumulatedX += dx;
    track.accumulatedY += dy;

    const thresholdX = 18;
    const thresholdY = 22;

    if (Math.abs(track.accumulatedX) >= thresholdX) {
      const steps = Math.trunc(track.accumulatedX / thresholdX);
      for (let i = 0; i < Math.abs(steps); i++) {
        moveHorizontal(steps > 0 ? 1 : -1);
      }
      track.accumulatedX -= steps * thresholdX;
      track.hasMoved = true;
    }

    if (track.accumulatedY >= thresholdY) {
      const steps = Math.trunc(track.accumulatedY / thresholdY);
      for (let i = 0; i < steps; i++) {
        softDrop();
      }
      track.accumulatedY -= steps * thresholdY;
      track.hasMoved = true;
    }
  };

  const handleTouchEnd = () => {
    const track = touchTrackRef.current;
    if (!track.active) return;

    const elapsed = performance.now() - track.startTime;
    const totalDist = Math.hypot(track.lastX - track.startX, track.lastY - track.startY);

    if (!track.hasMoved && elapsed < 260 && totalDist < 14) {
      tryRotatePiece();
    }
    track.active = false;
  };

  const toggleSound = () => {
    sounds.enabled = !sounds.enabled;
    setSoundEnabled(sounds.enabled);
  };

  return (
    <div className="casino-cosmic-bg w-full h-full h-dvh flex flex-col justify-between items-center overflow-hidden p-1 sm:p-2 relative bg-black">
      {/* 1. ENCABEZADO SUPERIOR */}
      <header className="w-full max-w-xl flex items-center justify-between px-2 sm:px-4 py-1.5 z-20 flex-shrink-0">
        <div className="flex flex-col items-start justify-center">
          <h1 className="neon-tetris-title text-2xl sm:text-3xl">TETRIS</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[9px] sm:text-[10px] font-black tracking-widest text-[#38bdf8] drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]">
              EL REY · VIP RETRO
            </span>
            <div
              className="flex items-center gap-1 bg-[#061324] border border-[#38bdf8]/40 px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.25)]"
              title="Sistema en línea"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${firebaseConnected ? 'bg-[#22c55e] shadow-[0_0_6px_#22c55e]' : 'bg-amber-400'}`} />
              <span className="font-mono text-[8px] font-black text-slate-300 hidden xs:inline">
                EN LÍNEA
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={toggleSound}
            className="text-base sm:text-lg hover:scale-110 active:scale-95 transition-transform p-1 rounded bg-slate-900/60 border border-slate-700/60"
            title={soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
            aria-label="Alternar sonido"
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>

          <button
            type="button"
            onClick={() => setShowLeaderboardModal(true)}
            className="text-base sm:text-lg hover:scale-110 active:scale-95 transition-transform p-1 rounded bg-slate-900/60 border border-slate-700/60 text-[#fde047]"
            title="Ver Salón de la Fama"
            aria-label="Salón de la Fama"
          >
            🏆
          </button>

          <button
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="text-xs sm:text-sm font-mono font-black hover:scale-105 active:scale-95 transition-transform px-2 py-1 rounded bg-[#eab308]/20 border border-[#eab308]/60 text-[#fde047] flex items-center gap-1 shadow-[0_0_8px_rgba(234,179,8,0.3)] cursor-pointer"
            title="Panel de Administración (PIN rey777)"
            aria-label="Administración"
          >
            <span>👑</span>
            <span className="hidden sm:inline text-[10px]">ADMIN</span>
          </button>

          <div className="flex flex-col items-center">
            <span className="font-mono text-[9px] font-black tracking-widest text-[#38bdf8] drop-shadow-[0_0_6px_rgba(56,189,248,0.9)] mb-0.5">
              NEXT
            </span>
            <div className="w-[60px] sm:w-[64px] h-[38px] sm:h-[40px] bg-[#060b13] border-1.5 border-[#38bdf8] rounded-md flex items-center justify-center shadow-[0_0_10px_rgba(56,189,248,0.4),inset_0_0_8px_rgba(56,189,248,0.15)]">
              <canvas ref={nextCanvasRef} width={60} height={36} className="w-[56px] h-[32px]" />
            </div>
          </div>
        </div>
      </header>

      {/* 2. ÁREA CENTRAL: TABLERO + HUD LATERAL */}
      <main className="flex-1 w-full max-w-xl flex items-center justify-center gap-2 sm:gap-4 px-2 min-h-0 overflow-visible my-auto">
        <div className="relative h-full max-h-[calc(100dvh-200px)] aspect-[1/2] flex items-center justify-center bg-[#04070e]/35 backdrop-blur-[1px] rounded-xl p-1 border-2 border-[#38bdf8]/40 shadow-[0_0_24px_rgba(0,0,0,0.7),0_0_14px_rgba(56,189,248,0.25)] box-border">
          <canvas
            ref={canvasRef}
            width={300}
            height={600}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="w-full h-full object-contain bg-transparent rounded-lg touch-none cursor-pointer"
          />
          

          {floatingChips.map((fc) => (
            <div key={fc.id} className="chips-gain-toast">
              +{fc.amount}🪙
            </div>
          ))}

          {showGarbageToast && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600/95 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-[0_0_14px_rgba(239,68,68,0.8)] z-30 animate-bounce">
              <span className="text-base">⚠️</span>
              <div className="flex flex-col text-[10px] font-mono leading-tight">
                <strong className="tracking-wide">¡OBSTÁCULO PELIGRO!</strong>
                <span>+3 Bloques Indestructibles</span>
              </div>
            </div>
          )}

          {isPaused && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm rounded-lg flex items-center justify-center z-40">
              <div className="text-center p-4">
                <span className="text-3xl">⏸️</span>
                <h2 className="font-mono text-2xl font-black tracking-widest text-[#38bdf8] drop-shadow-[0_0_12px_rgba(56,189,248,0.9)] my-1">
                  PAUSA
                </h2>
                <p className="font-mono text-[10px] text-slate-400 mb-3">TETRIS EL REY</p>
                <button
                  type="button"
                  onClick={togglePause}
                  className="px-5 py-2 rounded-xl font-mono font-black text-xs tracking-widest bg-gradient-to-r from-[#fde047] via-[#eab308] to-[#ca8a04] text-slate-950 shadow-[0_0_15px_rgba(234,179,8,0.6)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  CONTINUAR
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Columna Lateral Derecha de Estadísticas */}
        <aside className="w-[82px] sm:w-[94px] flex flex-col justify-start items-center gap-1.5 sm:gap-2 flex-shrink-0 z-20">
          <div className="w-full flex flex-col items-center justify-center p-1 bg-[#0e1524]/90 border border-[#38bdf8]/40 rounded-lg shadow-[0_0_10px_rgba(56,189,248,0.25)] text-center flex-shrink-0">
            <span className="font-mono text-[9px] font-black text-[#fde047] tracking-wider truncate max-w-[76px] drop-shadow-[0_0_6px_rgba(253,224,71,0.7)] uppercase">
              {player ? player.nickname : 'Invitado'}
            </span>
            <span className="font-mono text-[10px] font-black text-[#38bdf8] tracking-widest drop-shadow-[0_0_6px_rgba(56,189,248,0.85)] mt-0.5">
              #{player ? player.userCode : '0001'}
            </span>
            {player?.isBlocked && (
              <span className="mt-0.5 bg-red-500/25 border border-red-500/80 text-red-300 text-[7px] font-black px-1 py-0.5 rounded tracking-tighter" title="Acumulación de puntos bloqueada">
                🔒 BLOQUEADO
              </span>
            )}
          </div>

          {/* Bloque TOTAL ACUMULADO */}
          <div className={`w-full flex flex-col items-center text-center bg-[#070f1d]/80 border ${player?.isBlocked ? 'border-red-500/50' : 'border-amber-400/40'} rounded-lg py-1 px-0.5 shadow-[0_0_8px_rgba(234,179,8,0.2)] flex-shrink-0`}>
            <span className={`font-mono text-[8px] sm:text-[9px] font-black tracking-wider ${player?.isBlocked ? 'text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]' : 'text-[#fde047] drop-shadow-[0_0_6px_rgba(253,224,71,0.85)]'}`}>
              {player?.isBlocked ? 'PUNTOS BLOQ.' : 'TOTAL SALDO'}
            </span>
            <span className="font-mono text-xs sm:text-sm font-black text-[#fef08a] tracking-wide drop-shadow-[0_0_10px_rgba(254,240,138,0.8)]">
              {(isMaxCap
                ? TOPE_MAXIMO_FICHAS
                : Math.min(TOPE_MAXIMO_FICHAS, (player?.totalFichas || 0) + (isGameOver || player?.isBlocked ? 0 : fichas))).toLocaleString()}🪙
            </span>
          </div>

          <button
            type="button"
            onClick={togglePause}
            className="w-full py-1.5 px-1 rounded-lg bg-gradient-to-r from-[#0369a1] via-[#0284c7] to-[#0ea5e9] text-white border-1.5 border-[#38bdf8] active:scale-95 transition-all shadow-[0_0_12px_rgba(56,189,248,0.6)] flex items-center justify-center gap-1 cursor-pointer flex-shrink-0 z-30"
            title={isPaused ? 'Reanudar partida' : 'Pausar partida'}
            aria-label={isPaused ? 'Reanudar' : 'Pausar'}
          >
            <span className="text-xs leading-none">{isPaused ? '▶️' : '⏸️'}</span>
            <span className="font-mono text-[10px] font-black tracking-wider text-white drop-shadow-[0_0_4px_rgba(0,0,0,0.8)]">
              {isPaused ? 'PLAY' : 'PAUSA'}
            </span>
          </button>

          <div className="flex flex-col items-center text-center flex-shrink-0">
            <span className="font-mono text-[8px] sm:text-[9px] font-black tracking-wider text-[#38bdf8] drop-shadow-[0_0_6px_rgba(56,189,248,0.85)]">
              SCORE
            </span>
            <span className="font-mono text-xs sm:text-sm font-black text-white tracking-wide drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
              {score.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col items-center text-center flex-shrink-0">
            <span className="font-mono text-[8px] sm:text-[9px] font-black tracking-wider text-[#38bdf8] drop-shadow-[0_0_6px_rgba(56,189,248,0.85)]">
              LEVEL
            </span>
            <span className="font-mono text-xs sm:text-sm font-black text-[#38bdf8] tracking-widest drop-shadow-[0_0_10px_rgba(56,189,248,0.9)]">
              {String(level).padStart(2, '0')}
            </span>
          </div>

          <div className="flex flex-col items-center text-center flex-shrink-0">
            <span className="font-mono text-[8px] sm:text-[9px] font-black tracking-wider text-[#38bdf8] drop-shadow-[0_0_6px_rgba(56,189,248,0.85)]">
              LINES
            </span>
            <span className="font-mono text-xs sm:text-sm font-black text-[#f59e0b] tracking-widest drop-shadow-[0_0_10px_rgba(245,158,11,0.9)]">
              {String(lines).padStart(2, '0')}
            </span>
          </div>

          <div className="flex flex-col items-center text-center flex-shrink-0">
            <span className="font-mono text-[8px] sm:text-[9px] font-black tracking-wider text-[#4ade80] drop-shadow-[0_0_6px_rgba(74,222,128,0.85)]">
              PARTIDA
            </span>
            <span className="font-mono text-xs sm:text-sm font-black text-[#86efac] tracking-wide">
              +{fichas.toLocaleString()}🪙
            </span>
          </div>
        </aside>
      </main>

      {/* 3. CONTROLES INFERIORES */}
      <Controls
        onMoveLeft={() => moveHorizontal(-1)}
        onMoveRight={() => moveHorizontal(1)}
        onSoftDrop={softDrop}
        onHardDrop={hardDrop}
        onRotate={tryRotatePiece}
      />

      <LoginModal
        isOpen={showLoginModal}
        onSuccess={(profile) => {
          setShowLoginModal(false);
          startNewGame(profile);
        }}
      />

      <PayoutModal
        isOpen={showPayoutModal}
        player={player}
        score={score}
        lines={lines}
        gameFichas={fichas}
        totalAccumulatedFichas={isMaxCap ? TOPE_MAXIMO_FICHAS : (accumulatedFichasForModal || Math.min(TOPE_MAXIMO_FICHAS, (player?.totalFichas || 0) + fichas))}
        isMaxCap={isMaxCap}
        onPlayAgain={() => {
          setShowPayoutModal(false);
          startNewGame();
        }}
      />

      <LeaderboardModal
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
      />

      <AdminModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onUserDataChanged={refreshCurrentPlayer}
      />
    </div>
  );
}
