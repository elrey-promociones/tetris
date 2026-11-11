import React, { useState, useEffect } from 'react';
import { PlayerProfile, GameRecord } from '../types';
import {
  registerSequentialUser,
  getExistingUserByCode,
  getNextAvailableSequenceNumber,
  getTopLeaderboard,
} from '../firebase';
import { sounds } from '../audio';

const DEFAULT_LOGO = '/logo.jpg';
const FALLBACK_LOGO = '/assets/aistudio/logo_369adc69.jpg';

interface LoginModalProps {
  isOpen: boolean;
  onSuccess: (player: PlayerProfile) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onSuccess }) => {
  const [nickname, setNickname] = useState('');
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [existingCode, setExistingCode] = useState('');
  const [nextSeqNum, setNextSeqNum] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getNextAvailableSequenceNumber().then((num) => setNextSeqNum(num));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'new') {
      if (!nickname.trim() || nickname.trim().length < 2) {
        setError('Por favor escribe un apodo o nickname de al menos 2 caracteres.');
        return;
      }

      setLoading(true);
      try {
        sounds.play('click');
        const player = await registerSequentialUser(nickname);
        onSuccess(player);
      } catch {
        setError('Error al registrar. Revisa tu conexión e intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    } else {
      if (!existingCode.trim()) {
        setError('Ingresa tu código numérico.');
        return;
      }

      setLoading(true);
      try {
        sounds.play('click');
        const existing = await getExistingUserByCode(existingCode);
        if (existing) onSuccess(existing);
        else setError(`No se encontró ningún jugador con el código #${existingCode}.`);
      } catch {
        setError('Error al consultar el código.');
      } finally {
        setLoading(false);
      }
    }
  };

  const formattedNextCode = nextSeqNum !== null ? String(nextSeqNum).padStart(4, '0') : '0001';

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="relative w-full max-w-sm sm:max-w-[420px] bg-gradient-to-b from-[#11192e]/95 via-[#0c1220]/95 to-[#060a12]/98 border-2 border-[#eab308] rounded-2xl pt-18 sm:pt-20 pb-5 px-5 sm:px-6 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(234,179,8,0.35)] text-center overflow-visible my-auto">
        {/* Insignia Circular Flotante */}
        <div className="absolute -top-12 sm:-top-14 left-1/2 -translate-x-1/2 w-24 h-24 sm:w-28 sm:h-28 rounded-full border-3 border-[#fde047] shadow-[0_0_25px_rgba(234,179,8,0.7)] overflow-hidden bg-[#070b14] z-20 flex items-center justify-center">
          <img
            src={DEFAULT_LOGO}
            onError={(e) => {
              if (!e.currentTarget.src.includes(FALLBACK_LOGO)) e.currentTarget.src = FALLBACK_LOGO;
            }}
            alt="Tetris El Rey Logo"
            className="w-full h-full object-cover object-center"
          />
        </div>

        <div className="relative z-10">
          <div className="mb-4 mt-1 text-center">
            <h2 className="font-mono text-xl sm:text-2xl font-black tracking-widest text-[#f59e0b] drop-shadow-[0_0_12px_rgba(245,158,11,0.8)] uppercase">
              TETRIS EL REY
            </h2>
            <p className="font-mono text-[9px] sm:text-[10px] tracking-widest text-slate-400 uppercase mt-0.5">
              JUEGO VIP RETRO-FUTURISTA
            </p>
          </div>

          <div className="flex border border-slate-700/80 rounded-lg p-1 mb-4 bg-slate-900/70">
            <button
              type="button"
              onClick={() => { setMode('new'); setError(null); }}
              className={`flex-1 py-1.5 font-mono text-[11px] font-bold rounded ${mode === 'new' ? 'bg-[#eab308] text-slate-950' : 'text-slate-400'}`}
            >
              NUEVO INGRESO
            </button>
            <button
              type="button"
              onClick={() => { setMode('existing'); setError(null); }}
              className={`flex-1 py-1.5 font-mono text-[11px] font-bold rounded ${mode === 'existing' ? 'bg-[#38bdf8] text-slate-950' : 'text-slate-400'}`}
            >
              YA TENGO CÓDIGO
            </button>
          </div>

          <form onSubmit={handleSubmit} className="text-left space-y-3.5">
            {mode === 'new' ? (
              <>
                <div>
                  <label className="block font-mono text-[10px] font-bold text-[#38bdf8] tracking-wider mb-1.5">
                    APODO / NICKNAME
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Ej. 23s"
                    maxLength={18}
                    required
                    autoFocus
                    className="w-full bg-[#080d17] border border-[#38bdf8]/60 focus:border-[#38bdf8] rounded-lg px-3 py-2.5 text-white font-sans text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] font-bold text-[#38bdf8] tracking-wider mb-1.5">
                    CÓDIGO DE USUARIO ÚNICO
                  </label>
                  <div className="w-full bg-[#080d17] border border-slate-700 rounded-lg px-3 py-2.5 flex items-center justify-between">
                    <span className="font-mono text-sm sm:text-base font-black text-[#38bdf8]">#{formattedNextCode}</span>
                    <span className="font-mono text-[9px] font-bold text-[#fde047] uppercase bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">ID ÚNICO</span>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block font-mono text-[10px] font-bold text-[#38bdf8] tracking-wider mb-1.5">
                  INGRESA TU CÓDIGO DE USUARIO
                </label>
                <input
                  type="text"
                  value={existingCode}
                  onChange={(e) => setExistingCode(e.target.value)}
                  placeholder="Ej. 9177 o 0001"
                  maxLength={10}
                  required
                  autoFocus
                  className="w-full bg-[#080d17] border border-[#38bdf8]/60 rounded-lg px-3 py-2.5 text-[#fde047] font-mono font-bold text-center text-base outline-none"
                />
              </div>
            )}

            {error && <div className="bg-red-500/20 border border-red-500/60 text-red-200 text-xs p-2 rounded-lg text-center">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3.5 px-4 rounded-xl font-mono font-black text-xs sm:text-sm tracking-widest bg-gradient-to-r from-[#fde047] via-[#eab308] to-[#f59e0b] text-[#0f172a] shadow-[0_0_22px_rgba(234,179,8,0.6)] cursor-pointer"
            >
              {loading ? 'CONECTANDO...' : (mode === 'new' ? 'ENTRAR A LA ARENA' : 'CARGAR MI PERFIL')}
            </button>
          </form>

          <div className="mt-4 pt-1 font-mono text-[9px] tracking-widest text-slate-500 uppercase text-center">
            MATTRIS INC.
          </div>
        </div>
      </div>
    </div>
  );
};

interface PayoutModalProps {
  isOpen: boolean;
  player: PlayerProfile | null;
  score: number;
  lines: number;
  fichas: number;
  isMaxCap: boolean;
  onPlayAgain: () => void;
}

export const PayoutModal: React.FC<PayoutModalProps> = ({
  isOpen,
  player,
  score,
  lines,
  fichas,
  isMaxCap,
  onPlayAgain,
}) => {
  if (!isOpen) return null;

  const userCode = player?.userCode || '0001';
  const nickname = player?.nickname || 'Jugador El Rey';

  const mensajeWhatsApp = `¡Hola! Quiero cobrar mis fichas de Tetris El Rey.\n👑 Jugador: ${nickname}\n🆔 Código de Usuario: #${userCode}\n⭐ Puntuación: ${score.toLocaleString()}\n🎯 Líneas: ${lines}\n🪙 Fichas ganadas: ${fichas.toLocaleString()}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensajeWhatsApp)}`;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="relative w-full max-w-sm sm:max-w-[420px] bg-gradient-to-b from-[#11192e]/95 via-[#0c1220]/95 to-[#060a12]/98 border-2 border-[#eab308] rounded-2xl pt-18 sm:pt-20 pb-5 px-5 sm:px-6 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(234,179,8,0.4)] text-center overflow-visible my-auto">
        {/* Insignia Circular Flotante */}
        <div className="absolute -top-12 sm:-top-14 left-1/2 -translate-x-1/2 w-24 h-24 sm:w-28 sm:h-28 rounded-full border-3 border-[#fde047] shadow-[0_0_25px_rgba(234,179,8,0.7)] overflow-hidden bg-[#070b14] z-20 flex items-center justify-center">
          <img
            src={DEFAULT_LOGO}
            onError={(e) => {
              if (!e.currentTarget.src.includes(FALLBACK_LOGO)) e.currentTarget.src = FALLBACK_LOGO;
            }}
            alt="Tetris El Rey Logo"
            className="w-full h-full object-cover object-center"
          />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 mt-1">
            <span className="text-2xl sm:text-3xl">🏆</span>
            <div className="text-center">
              <h2 className="font-mono text-lg sm:text-2xl font-black tracking-widest text-[#fde047] uppercase">
                CUPÓN DE GANANCIAS
              </h2>
              <p className="font-mono text-[9px] sm:text-[10px] tracking-widest text-slate-400 uppercase mt-0.5">
                CASINO EL REY · CANJE OFICIAL
              </p>
            </div>
            <span className="text-2xl sm:text-3xl">🏆</span>
          </div>

          {isMaxCap && (
            <div className="bg-yellow-500/20 border border-yellow-400 text-yellow-200 font-mono text-[11px] font-black p-2 rounded-lg mb-3">
              ⚡ ¡TOPE MÁXIMO DE 50,000 FICHAS ALCANZADO! ⚡
            </div>
          )}

          <div className="bg-[#080d17]/90 border border-slate-700/80 rounded-xl p-3.5 mb-4 font-mono space-y-2.5 text-left">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">JUGADOR:</span>
              <span className="text-white font-black truncate max-w-[170px]">{nickname}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">CÓDIGO ID:</span>
              <span className="text-[#38bdf8] font-black text-sm">#{userCode}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold">LÍNEAS LIMPIADAS:</span>
              <span className="text-white font-black">{lines}</span>
            </div>
            <div className="border-t border-slate-800 my-1" />
            <div className="flex justify-between items-center pt-0.5">
              <span className="text-[#fde047] font-black text-xs sm:text-sm">FICHAS A COBRAR:</span>
              <span className="text-2xl sm:text-3xl font-black text-[#fef08a]">{fichas.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => sounds.play('click')}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-mono font-black text-xs sm:text-sm tracking-widest bg-[#22c55e] hover:bg-[#16a34a] text-slate-950 shadow-[0_0_20px_rgba(34,197,94,0.6)] cursor-pointer"
            >
              📱 COBRAR POR WHATSAPP
            </a>
            <button
              type="button"
              onClick={() => { sounds.play('click'); onPlayAgain(); }}
              className="w-full py-2.5 px-4 rounded-xl font-mono font-bold text-xs tracking-wider border-1.5 border-[#eab308] text-[#fde047] hover:bg-[#eab308]/15 cursor-pointer"
            >
              🔄 JUGAR OTRA VEZ
            </button>
          </div>

          <div className="mt-4 pt-1 font-mono text-[9px] tracking-widest text-slate-500 uppercase text-center">
            MATTRIS INC.
          </div>
        </div>
      </div>
    </div>
  );
};

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ isOpen, onClose }) => {
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getTopLeaderboard(15).then((data) => setRecords(data)).finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 z-50">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#11192e] to-[#070b14] border-2 border-[#38bdf8] rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-center max-h-[85vh] flex flex-col">
        <div className="mb-3">
          <div className="text-3xl mb-1">👑</div>
          <h2 className="font-mono text-xl font-black tracking-widest text-[#38bdf8]">SALÓN DE LA FAMA</h2>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 my-2 pr-1 font-mono text-xs">
          {loading ? (
            <div className="py-8 text-slate-400">Cargando...</div>
          ) : records.map((r, i) => (
            <div key={r.id || i} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="font-bold text-white truncate max-w-[120px]">{r.nickname} (#{r.userCode})</span>
              <span className="text-[#fef08a] font-bold">{r.score.toLocaleString()} pts · {r.fichas}🪙</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={onClose} className="w-full mt-2 py-2 rounded-lg font-mono font-bold text-xs bg-slate-800 text-[#38bdf8]">
          CERRAR
        </button>
      </div>
    </div>
  );
};
