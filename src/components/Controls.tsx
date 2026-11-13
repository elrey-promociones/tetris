import React, { useRef, useEffect, useCallback } from 'react';

interface ControlsProps {
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onSoftDrop: () => void;
  onHardDrop: () => void;
  onRotate: () => void;
  onTogglePause?: () => void;
  isPaused?: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  onMoveLeft,
  onMoveRight,
  onSoftDrop,
  onHardDrop,
  onRotate,
}) => {
  // Configuración de repetición ultra-fluida (DAS: Delayed Auto Shift, ARR: Auto Repeat Rate)
  const useFluidRepeat = (action: () => void, dasDelay = 125, arrInterval = 38) => {
    const dasTimerRef = useRef<NodeJS.Timeout | null>(null);
    const arrTimerRef = useRef<NodeJS.Timeout | null>(null);

    const clearTimers = useCallback(() => {
      if (dasTimerRef.current) clearTimeout(dasTimerRef.current);
      if (arrTimerRef.current) clearInterval(arrTimerRef.current);
    }, []);

    const handlePointerDown = (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      clearTimers();
      action();

      dasTimerRef.current = setTimeout(() => {
        arrTimerRef.current = setInterval(() => {
          action();
        }, arrInterval);
      }, dasDelay);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      clearTimers();
    };

    useEffect(() => {
      return () => clearTimers();
    }, [clearTimers]);

    return {
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onPointerLeave: handlePointerUp,
    };
  };

  const leftHandlers = useFluidRepeat(onMoveLeft, 120, 36);
  const rightHandlers = useFluidRepeat(onMoveRight, 120, 36);
  const downHandlers = useFluidRepeat(onSoftDrop, 90, 32);

  const handleHardDrop = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onHardDrop();
  };

  const handleRotate = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRotate();
  };

  return (
    <footer className="w-full flex items-center justify-between px-2 sm:px-4 py-2 select-none z-20 touch-none max-w-xl mx-auto">
      {/* 1. CONTROLES DIRECCIONALES AGRANDADOS (SIN UP, SOLO ◀, ▼, ▶) */}
      <div className="dpad-t-cluster">
        {/* Botón Izquierda ◀ */}
        <button
          type="button"
          className="dpad-key-btn"
          aria-label="Mover izquierda"
          {...leftHandlers}
        >
          <span>◀</span>
        </button>

        {/* Botón Abajo ▼ (Soft Drop) */}
        <button
          type="button"
          className="dpad-key-btn btn-down"
          aria-label="Bajar pieza"
          {...downHandlers}
        >
          <span>▼</span>
        </button>

        {/* Botón Derecha ▶ */}
        <button
          type="button"
          className="dpad-key-btn"
          aria-label="Mover derecha"
          {...rightHandlers}
        >
          <span>▶</span>
        </button>
      </div>

      {/* 2. CLUSTER DE ACCIÓN DERECHO AGRANDADO: A + ROTAR */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Botón Redondo "A" (Hard Drop Instantáneo) */}
        <button
          type="button"
          className="btn-round-action-a"
          aria-label="Caída dura A"
          onPointerDown={handleHardDrop}
        >
          A
        </button>

        {/* Botón ROTAR Dorado Ergonómico Agrandado */}
        <button
          type="button"
          className="btn-rotate-pad"
          aria-label="Rotar pieza"
          onPointerDown={handleRotate}
        >
          <span className="rotate-label-debossed">ROTAR</span>
        </button>
      </div>
    </footer>
  );
};
