import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { sounds } from './audio';
import { testConnection, recordGameSession } from './firebase';
import { PlayerProfile, TetrominoPiece, TetrominoType } from './types';
import { Controls } from './components/Controls';
import { LoginModal, PayoutModal, LeaderboardModal } from './components/Modals';
import { NeonParticleSystem } from './particles';

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

const TOPE_MAXIMO_FICHAS = 50000;
const FICHAS_POR_LINEA = 50;
const BONIFICACION_TETRIS_FICHAS = 150;
const PUNTOS_POR_LINEA = [0, 100, 300, 600, 1000];

// Dificultad Máxima Aumentada
const LINEAS_POR_NIVEL = 6;        // Sube de nivel cada 6 líneas
const VELOCIDAD_INICIAL_MS = 520;  // Caída inicial rápida (520ms)
const FACTOR_ACELERACION = 0.76;   // Aceleración rápida por nivel (0.76x)
const VELOCIDAD_MINIMA_MS = 40;    // Límite extremo arcade (40ms)
const BASURA_INTERVALO_LINEAS = 7; // Obstáculos cada 7 líneas

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
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(true);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(true);
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const [score, setScore] = useState<number>(0);
  const [lines, setLines] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [fichas, setFichas] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isMaxCap, setIsMaxCap] = useState<boolean>(false);
  const [floatingChips, setFloatingChips] = useState<{ id: number; amount: number }[]>([]);
  const [showGarbageToast, setShowGarbageToast] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const dropCounterRef = useRef<number>(0);
  const dropIntervalRef = useRef<number>(VELOCIDAD_INICIAL_MS);

  const gridRef = useRef<(string | number)[][]>(createEmptyGrid());
  const currentPieceRef = useRef<TetrominoPiece | null>(null);
  const nextPieceRef = useRef<TetrominoPiece | null>(null);
  const bagRef = useRef<TetrominoType[]>([]);
  const linesSinceLastGarbageRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const particleSystemRef = useRef<NeonParticleSystem>(new NeonParticleSystem());

  function createEmptyGrid(): (string | number)[][] {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  useEffect(() => {
    testConnection().then((connected) => setFirebaseConnected(connected));
    const cached = localStorage.getItem('tetris_el_rey_player');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.userCode && parsed.nickname) {
          setPlayer(parsed);
          setShowLoginModal(false);
          startNewGame(parsed);
        }
      } catch {
        localStorage.removeItem('tetris_el_rey_player');
      }
    }
  }, []);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

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

  const checkCollision = useCallback(
    (offsetX: number, offsetY: number, matrix: number[][]): boolean => {
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c]) {
            const newX = offsetX + c;
            const newY = offsetY + r;
            if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
            if (newY >= 0 && gridRef.current[newY][newX] !== 0) return true;
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

  const triggerGameOver = useCallback(
    (reachedMaxCap = false) => {
      isPlayingRef.current = false;
      setIsGameOver(true);
      setIsMaxCap(reachedMaxCap);

      if (reachedMaxCap) {
        sounds.play('tetris');
        try { confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } }); } catch {}
      } else {
        sounds.play('gameover');
      }

      setShowPayoutModal(true);

      if (player) {
        recordGameSession({
          userCode: player.userCode,
          nickname: player.nickname,
          score,
          lines,
          level,
          fichas,
        });
      }
    },
    [player, score, lines, level, fichas]
  );

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
        const addedScore = (PUNTOS_POR_LINEA[cleared] || 1000) * level;
        setScore((prev) => prev + addedScore);

        let addedFichas = cleared * FICHAS_POR_LINEA;
        if (cleared === 4) {
          addedFichas += BONIFICACION_TETRIS_FICHAS;
          sounds.play('tetris');
          try { confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } }); } catch {}
        } else {
          sounds.play('line');
        }

        setFichas((prevFichas) => {
          const nextTotal = prevFichas + addedFichas;
          if (nextTotal >= TOPE_MAXIMO_FICHAS) {
            triggerGameOver(true);
            return TOPE_MAXIMO_FICHAS;
          }
          return nextTotal;
        });

        const toastId = Date.now() + Math.random();
        setFloatingChips((prev) => [...prev, { id: toastId, amount: addedFichas }]);
        setTimeout(() => {
          setFloatingChips((prev) => prev.filter((t) => t.id !== toastId));
        }, 1200);

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

        linesSinceLastGarbageRef.current += cleared;
        if (linesSinceLastGarbageRef.current >= BASURA_INTERVALO_LINEAS) {
          insertGarbageObstacles(3);
          linesSinceLastGarbageRef.current = 0;
        }

        return newLines;
      });
    }
  }, [level, triggerGameOver, insertGarbageObstacles]);

  const lockPiece = useCallback(() => {
    if (!currentPieceRef.current) return;
    const { x, y, matrix, type } = currentPieceRef.current;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
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

  const hardDrop = useCallback(() => {
    if (!currentPieceRef.current || isPausedRef.current || !isPlayingRef.current) return;
    const piece = currentPieceRef.current;
    while (!checkCollision(piece.x, piece.y + 1, piece.matrix)) {
      piece.y += 1;
    }
    sounds.play('drop');
    lockPiece();
  }, [checkCollision, lockPiece]);

  const togglePause = useCallback(() => {
    if (isGameOver || !isPlayingRef.current) return;
    setIsPaused((prev) => !prev);
    sounds.play('click');
  }, [isGameOver]);

  const drawBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, type: string, isGhost = false) => {
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

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);

      ctx.fillStyle = colors.core || 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(x + 5, y + 5, 4, 4);
    }
    ctx.restore();
  };

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

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = gridRef.current[r][c];
        if (cell !== 0) drawBlock(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, String(cell));
      }
    }

    const piece = currentPieceRef.current;
    if (piece && isPlayingRef.current) {
      let ghostY = piece.y;
      while (!checkCollision(piece.x, ghostY + 1, piece.matrix)) ghostY++;

      if (ghostY > piece.y) {
        for (let r = 0; r < piece.matrix.length; r++) {
          for (let c = 0; c < piece.matrix[r].length; c++) {
            if (piece.matrix[r][c]) drawBlock(ctx, (piece.x + c) * BLOCK_SIZE, (ghostY + r) * BLOCK_SIZE, BLOCK_SIZE, piece.type, true);
          }
        }
      }

      for (let r = 0; r < piece.matrix.length; r++) {
        for (let c = 0; c < piece.matrix[r].length; c++) {
          if (piece.matrix[r][c]) drawBlock(ctx, (piece.x + c) * BLOCK_SIZE, (piece.y + r) * BLOCK_SIZE, BLOCK_SIZE, piece.type);
        }
      }
    }

    particleSystemRef.current.draw(ctx, canvas.width);

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
              if (matrix[r][c]) drawBlock(nCtx, sX + c * miniSize, sY + r * miniSize, miniSize, next.type);
            }
          }
        }
      }
    }
  }, [checkCollision]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlayingRef.current || isGameOver) return;
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': e.preventDefault(); moveHorizontal(-1); break;
        case 'ArrowRight': case 'KeyD': e.preventDefault(); moveHorizontal(1); break;
        case 'ArrowDown': case 'KeyS': e.preventDefault(); softDrop(); break;
        case 'ArrowUp': case 'KeyW': case 'KeyX': e.preventDefault(); tryRotatePiece(); break;
        case 'Space': e.preventDefault(); hardDrop(); break;
        case 'KeyP': case 'Escape': e.preventDefault(); togglePause(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGameOver, moveHorizontal, softDrop, tryRotatePiece, hardDrop, togglePause]);

  const toggleSound = () => {
    sounds.enabled = !sounds.enabled;
    setSoundEnabled(sounds.enabled);
  };

  return (
    <div className="casino-cosmic-bg w-full h-full h-dvh flex flex-col justify-between items-center overflow-hidden p-1 sm:p-2 relative bg-black">
      <header className="w-full max-w-xl flex items-center justify-between px-2 sm:px-4 py-1.5 z-20 flex-shrink-0">
        <div className="flex flex-col items-start justify-center">
          <h1 className="neon-tetris-title text-2xl sm:text-3xl">TETRIS</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[9px] sm:text-[10px] font-black tracking-widest text-[#38bdf8]">
              EL REY · VIP RETRO
            </span>
            <div className="flex items-center gap-1 bg-[#061324] border border-[#38bdf8]/40 px-1.5 py-0.5 rounded-full">
              <span className={`w-1.5 h-1.5 rounded-full ${firebaseConnected ? 'bg-[#22c55e]' : 'bg-amber-400'}`} />
              <span className="font-mono text-[8px] font-black text-slate-300 hidden xs:inline">EN LÍNEA</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button type="button" onClick={toggleSound} className="text-base sm:text-lg p-1 rounded bg-slate-900/60 border border-slate-700/60">
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          <button type="button" onClick={() => setShowLeaderboardModal(true)} className="text-base sm:text-lg p-1 rounded bg-slate-900/60 border border-slate-700/60 text-[#fde047]">
            🏆
          </button>
          <div className="flex flex-col items-center">
            <span className="font-mono text-[9px] font-black tracking-widest text-[#38bdf8] mb-0.5">NEXT</span>
            <div className="w-[64px] h-[40px] bg-[#060b13] border-1.5 border-[#38bdf8] rounded-md flex items-center justify-center">
              <canvas ref={nextCanvasRef} width={60} height={36} className="w-[58px] h-[34px]" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-xl flex items-center justify-center gap-2 sm:gap-4 px-2 min-h-0 overflow-hidden my-auto">
        <div className="relative h-full max-h-[calc(100dvh-200px)] aspect-[1/2] flex items-center justify-center bg-[#04070e] rounded-xl p-1 border-2 border-[#23344d] shadow-[0_0_24px_rgba(0,0,0,0.95)]">
          <canvas ref={canvasRef} width={300} height={600} className="w-full h-full object-contain bg-[#070d17] rounded-lg touch-none" />

          {floatingChips.map((fc) => (
            <div key={fc.id} className="chips-gain-toast">+{fc.amount}🪙</div>
          ))}

          {showGarbageToast && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600/95 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 z-30">
              <span>⚠️</span>
              <div className="flex flex-col text-[10px] font-mono leading-tight">
                <strong>¡OBSTÁCULO PELIGRO!</strong>
                <span>+3 Bloques Indestructibles</span>
              </div>
            </div>
          )}

          {isPaused && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm rounded-lg flex items-center justify-center z-40">
              <div className="text-center p-4">
                <span className="text-3xl">⏸️</span>
                <h2 className="font-mono text-2xl font-black text-[#38bdf8] my-1">PAUSA</h2>
                <button type="button" onClick={togglePause} className="px-5 py-2 rounded-xl font-mono font-black text-xs bg-gradient-to-r from-[#fde047] via-[#eab308] to-[#ca8a04] text-slate-950 mt-2">
                  CONTINUAR
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="w-[82px] sm:w-[94px] flex flex-col justify-center items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="w-full flex flex-col items-center justify-center p-1.5 bg-[#0e1524]/90 border border-[#38bdf8]/40 rounded-lg text-center">
            <span className="font-mono text-[9px] font-black text-[#fde047] truncate max-w-[76px] uppercase">
              {player ? player.nickname : 'Invitado'}
            </span>
            <span className="font-mono text-[10px] font-black text-[#38bdf8] mt-0.5">
              #{player ? player.userCode : '0001'}
            </span>
          </div>

          <div className="flex flex-col items-center text-center">
            <span className="font-mono text-[9px] sm:text-[10px] font-black text-[#38bdf8]">SCORE</span>
            <span className="font-mono text-sm sm:text-base font-black text-white">{score.toLocaleString()}</span>
          </div>

          <div className="flex flex-col items-center text-center">
            <span className="font-mono text-[9px] sm:text-[10px] font-black text-[#38bdf8]">LEVEL</span>
            <span className="font-mono text-sm sm:text-base font-black text-[#38bdf8]">{String(level).padStart(2, '0')}</span>
          </div>

          <div className="flex flex-col items-center text-center">
            <span className="font-mono text-[9px] sm:text-[10px] font-black text-[#38bdf8]">LINES</span>
            <span className="font-mono text-sm sm:text-base font-black text-[#f59e0b]">{String(lines).padStart(2, '0')}</span>
          </div>

          <div className="flex flex-col items-center text-center">
            <span className="font-mono text-[9px] sm:text-[10px] font-black text-[#fde047]">FICHAS</span>
            <span className="font-mono text-xs sm:text-sm font-black text-[#fef08a]">{fichas.toLocaleString()}🪙</span>
          </div>
        </aside>
      </main>

      <Controls
        onMoveLeft={() => moveHorizontal(-1)}
        onMoveRight={() => moveHorizontal(1)}
        onSoftDrop={softDrop}
        onHardDrop={hardDrop}
        onRotate={tryRotatePiece}
        onTogglePause={togglePause}
        isPaused={isPaused}
      />

      <LoginModal isOpen={showLoginModal} onSuccess={(p) => { setShowLoginModal(false); startNewGame(p); }} />
      <PayoutModal isOpen={showPayoutModal} player={player} score={score} lines={lines} fichas={fichas} isMaxCap={isMaxCap} onPlayAgain={() => { setShowPayoutModal(false); startNewGame(); }} />
      <LeaderboardModal isOpen={showLeaderboardModal} onClose={() => setShowLeaderboardModal(false)} />
    </div>
  );
}
