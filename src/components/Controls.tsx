import React, { useRef, useEffect, useCallback } from 'react';

interface ControlsProps {
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onSoftDrop: () => void;
  onHardDrop: () => void;
  onRotate: () => void;
  onTogglePause: () => void;
  isPaused: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  onMoveLeft,
  onMoveRight,
  onSoftDrop,
  onHardDrop,
  onRotate,
  onTogglePause,
  isPaused,
}) => {
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

  return (
    <footer className="w-full flex items-end justify-between px-2 sm:px-4 py-2 select-none z-20 touch-none max-w-xl mx-auto">
      {/* 1. D-PAD */}
      <div className="flex flex-col items-center">
        <span className="font-mono text-[10px] font-black text-[#4ade80] tracking-wider mb-1">UP</span>
        <div className="dpad-cross-body">
          <div className="cross-bar-horizontal" />
          <div className="cross-bar-vertical" />

          <button type="button" className="dpad-key key-up" onPointerDown={onHardDrop}>▲</button>
          <button type="button" className="dpad-key key-down" {...downHandlers}>▼</button>
          <button type="button" className="dpad-key key-left" {...leftHandlers}>◀</button>
          <button type="button" className="dpad-key key-right" {...rightHandlers}>▶</button>
          <div className="dpad-center-circle" />
        </div>
      </div>

      {/* 2. PAUSA */}
      <div className="flex flex-col items-center justify-center self-center mb-1 mx-2">
        <button type="button" onClick={onTogglePause} className="btn-pause-retro">
          <span className="text-sm leading-none">{isPaused ? '▶️' : '⏸️'}</span>
          <span className="font-mono text-[9px] font-black tracking-wider text-[#38bdf8]">
            {isPaused ? 'REANUDAR' : 'PAUSA'}
          </span>
        </button>
      </div>

      {/* 3. ROTAR + DROP */}
      <div className="flex flex-col items-end gap-1">
        <div className="flex justify-between w-full px-1 font-mono text-[9px] font-black text-[#fde047]">
          <span>LEFT</span>
          <span>RIGHT</span>
        </div>

        <div className="flex items-end gap-2 sm:gap-3">
          <button type="button" className="btn-rotate-pad" onPointerDown={onRotate}>
            <span className="rotate-label-debossed">ROTAR</span>
          </button>
          <button type="button" className="btn-round-action-a" onPointerDown={onHardDrop}>A</button>
        </div>
        <span className="font-mono text-[9px] font-black text-[#fde047] pr-1">DROP</span>
      </div>
    </footer>
  );
};
