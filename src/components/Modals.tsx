import React, { useState, useEffect } from 'react';
import { PlayerProfile, GameRecord } from '../types';
import {
  registerSequentialUser,
  getNextAvailableSequenceNumber,
  getTopLeaderboard,
  getAllUsers,
  adminUpdateUserFichas,
  adminResetUserFichas,
  adminUpdateUserNickname,
  adminToggleUserBlock,
  adminBlockAllUsers,
} from '../firebase';
import { sounds } from '../audio';

const DEFAULT_LOGO = './logo.jpg';
const FALLBACK_LOGO = '/assets/aistudio/logo_369adc69.jpg';

interface LoginModalProps {
  isOpen: boolean;
  onSuccess: (player: PlayerProfile) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onSuccess }) => {
  const [nickname, setNickname] = useState('');
  const [nextSeqNum, setNextSeqNum] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getNextAvailableSequenceNumber()
        .then((num) => setNextSeqNum(num))
        .catch(() => setNextSeqNum(1));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nickname.trim() || nickname.trim().length < 2) {
      setError('Por favor escribe un apodo o nickname de al menos 2 caracteres.');
      return;
    }

    setLoading(true);
    try {
      sounds.play('click');
      const player = await registerSequentialUser(nickname);
      localStorage.setItem('tetris_device_locked_user', JSON.stringify(player));
      localStorage.setItem('tetris_el_rey_player', JSON.stringify(player));
      onSuccess(player);
    } catch (err) {
      console.error('Error registrando usuario:', err);
      setError('Error al registrar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const formattedNextCode = nextSeqNum !== null ? String(nextSeqNum).padStart(4, '0') : '0001';

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-sm sm:max-w-[420px] bg-gradient-to-b from-[#11192e]/95 via-[#0c1220]/95 to-[#060a12]/98 border-2 border-[#eab308] rounded-2xl pt-18 sm:pt-20 pb-5 px-5 sm:px-6 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(234,179,8,0.35)] text-center overflow-visible my-auto">
        
        <div className="absolute -top-12 sm:-top-14 left-1/2 -translate-x-1/2 w-24 h-24 sm:w-28 sm:h-28 rounded-full border-3 border-[#fde047] shadow-[0_0_25px_rgba(234,179,8,0.7),inset_0_0_15px_rgba(234,179,8,0.4)] overflow-hidden bg-[#070b14] z-20 flex items-center justify-center">
          <img
            src={DEFAULT_LOGO}
            onError={(e) => {
              if (!e.currentTarget.src.includes(FALLBACK_LOGO)) {
                e.currentTarget.src = FALLBACK_LOGO;
              }
            }}
            alt="Tetris El Rey Logo"
            className="w-full h-full object-cover object-center"
          />
        </div>

    <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden z-0">
  <img
    src={DEFAULT_LOGO}
    onError={(e) => {
      if (!e.currentTarget.src.includes(FALLBACK_LOGO)) {
        e.currentTarget.src = FALLBACK_LOGO;
      }
    }}
    alt=""
    className="w-full h-full object-cover object-top opacity-70 scale-105 contrast-110 saturate-125"
  />
  <div className="absolute inset-0 bg-gradient-to-b from-[#070b14]/15 via-[#070b14]/65 to-[#04070e]/95" />
</div>

        <div className="relative z-10">
          <div className="mb-4 mt-1 text-center">
            <h2 className="font-mono text-xl sm:text-2xl font-black tracking-widest text-[#f59e0b] drop-shadow-[0_0_12px_rgba(245,158,11,0.8)] uppercase">
              TETRIS EL REY
            </h2>
            <p className="font-mono text-[9px] sm:text-[10px] tracking-widest text-slate-400 uppercase mt-0.5">
              REGISTRO ÚNICO DE DISPOSITIVO
            </p>
          </div>

          <div className="bg-[#38bdf8]/10 border border-[#38bdf8]/40 rounded-lg p-2.5 mb-4 text-left">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-[#38bdf8]">
              <span>🔒</span>
              <span>DISPOSITIVO VINCULADO AL REY</span>
            </div>
            <p className="font-sans text-[11px] text-slate-300 mt-0.5 leading-tight">
              Ingresa tu apodo para comenzar. Este teléfono quedará registrado permanentemente con tu Código ID y acumularás fichas partida a partida.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="text-left space-y-3.5">
            <div>
              <label className="block font-mono text-[10px] font-bold text-[#38bdf8] tracking-wider mb-1.5">
                APODO / NICKNAME
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ej. Juan El Rey"
                maxLength={18}
                required
                autoFocus
                className="w-full bg-[#080d17] border border-[#38bdf8]/60 focus:border-[#38bdf8] focus:shadow-[0_0_14px_rgba(56,189,248,0.5)] rounded-lg px-3 py-2.5 text-white font-sans text-sm outline-none transition-all placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] font-bold text-[#38bdf8] tracking-wider mb-1.5">
                TU CÓDIGO ID ASIGNADO
              </label>
              <div className="w-full bg-[#080d17] border border-slate-700 rounded-lg px-3 py-2.5 flex items-center justify-between">
                <span className="font-mono text-sm sm:text-base font-black text-[#38bdf8] tracking-widest drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]">
                  #{formattedNextCode}
                </span>
                <span className="font-mono text-[9px] font-bold text-[#fde047] uppercase bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                  ID ÚNICO
                </span>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/60 text-red-200 text-xs p-2 rounded-lg font-sans text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3.5 px-4 rounded-xl font-mono font-black text-xs sm:text-sm tracking-widest bg-gradient-to-r from-[#fde047] via-[#eab308] to-[#f59e0b] text-[#0f172a] shadow-[0_0_22px_rgba(234,179,8,0.6)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  <span>VINCULANDO DISPOSITIVO...</span>
                </>
              ) : (
                <span>VINCULAR Y JUGAR</span>
              )}
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
  gameFichas: number;
  totalAccumulatedFichas: number;
  isMaxCap: boolean;
  onPlayAgain: () => void;
}

export const PayoutModal: React.FC<PayoutModalProps> = ({
  isOpen,
  player,
  score,
  lines,
  gameFichas,
  totalAccumulatedFichas,
  isMaxCap,
  onPlayAgain,
}) => {
  if (!isOpen) return null;

  const userCode = player?.userCode || '0001';
  const nickname = player?.nickname || 'Jugador El Rey';

  const mensajeWhatsApp = `¡Hola! Quiero cobrar mis fichas de Tetris El Rey.\n👑 Jugador: ${nickname}\n🆔 Código ID: #${userCode}\n⭐ Puntuación Partida: ${score.toLocaleString()}\n🎯 Líneas: ${lines}\n🪙 Ganadas en partida: +${gameFichas.toLocaleString()}\n💰 SALDO TOTAL ACUMULADO A COBRAR: ${totalAccumulatedFichas.toLocaleString()} FICHAS`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensajeWhatsApp)}`;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-sm sm:max-w-[420px] bg-gradient-to-b from-[#11192e]/95 via-[#0c1220]/95 to-[#060a12]/98 border-2 border-[#eab308] rounded-2xl pt-18 sm:pt-20 pb-5 px-5 sm:px-6 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(234,179,8,0.4)] text-center overflow-visible my-auto">

        <div className="absolute -top-12 sm:-top-14 left-1/2 -translate-x-1/2 w-24 h-24 sm:w-28 sm:h-28 rounded-full border-3 border-[#fde047] shadow-[0_0_25px_rgba(234,179,8,0.7),inset_0_0_15px_rgba(234,179,8,0.4)] overflow-hidden bg-[#070b14] z-20 flex items-center justify-center">
          <img
            src={DEFAULT_LOGO}
            onError={(e) => {
              if (!e.currentTarget.src.includes(FALLBACK_LOGO)) {
                e.currentTarget.src = FALLBACK_LOGO;
              }
            }}
            alt="Tetris El Rey Logo"
            className="w-full h-full object-cover object-center"
          />
        </div>
<div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden z-0">
  <img
    src={DEFAULT_LOGO}
    onError={(e) => {
      if (!e.currentTarget.src.includes(FALLBACK_LOGO)) {
        e.currentTarget.src = FALLBACK_LOGO;
      }
    }}
    alt=""
    className="w-full h-full object-cover object-top opacity-70 scale-105 contrast-110 saturate-125"
  />
  <div className="absolute inset-0 bg-gradient-to-b from-[#070b14]/15 via-[#070b14]/65 to-[#04070e]/95" />
</div>


        <div className="relative z-10">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 mt-1">
            <span className="text-2xl sm:text-3xl filter drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">🏆</span>
            <div className="text-center">
              <h2 className="font-mono text-lg sm:text-2xl font-black tracking-widest text-[#fde047] drop-shadow-[0_0_12px_rgba(253,224,71,0.85)] uppercase">
                CUPÓN DE GANANCIAS
              </h2>
              <p className="font-mono text-[9px] sm:text-[10px] tracking-widest text-slate-400 uppercase mt-0.5">
                CASINO EL REY · CANJE OFICIAL
              </p>
            </div>
            <span className="text-2xl sm:text-3xl filter drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">🏆</span>
          </div>

          {isMaxCap && (
            <div className="bg-yellow-500/20 border border-yellow-400 text-yellow-200 font-mono text-[11px] font-black p-2 rounded-lg mb-3 animate-pulse">
              ⚡ ¡TOPE MÁXIMO DE 10,000 FICHAS ALCANZADO! ⚡
            </div>
          )}

          <div className="bg-[#080d17]/90 border border-slate-700/80 rounded-xl p-3.5 mb-3 font-mono space-y-2 text-left shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold tracking-wider">JUGADOR:</span>
              <span className="text-white font-black truncate max-w-[170px] tracking-wide">{nickname}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold tracking-wider">CÓDIGO ID:</span>
              <span className="text-[#38bdf8] font-black text-sm tracking-widest drop-shadow-[0_0_8px_rgba(56,189,248,0.85)]">
                #{userCode}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold tracking-wider">LÍNEAS LIMPIADAS:</span>
              <span className="text-white font-black tracking-wider">{lines}</span>
            </div>

            <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800">
              <span className="text-[#4ade80] font-bold tracking-wider">GANADAS ESTA PARTIDA:</span>
              <span className="text-[#4ade80] font-black tracking-wide">+{gameFichas.toLocaleString()}🪙</span>
            </div>

            <div className="border-t border-slate-800 my-1" />

            <div className="flex justify-between items-center pt-0.5">
              <div className="flex flex-col">
                <span className="text-[#fde047] font-black text-xs sm:text-sm tracking-wider">TOTAL ACUMULADO:</span>
                <span className="text-[9px] text-slate-400">DISPONIBLE EN CUENTA</span>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-[#fef08a] tracking-wider drop-shadow-[0_0_14px_rgba(254,240,138,0.95)]">
                {totalAccumulatedFichas.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Aviso si la cuenta tiene los puntos bloqueados o estado de acumulación */}
          {player?.isBlocked ? (
            <div className="bg-red-950/50 border border-red-500/70 rounded-lg p-2.5 mb-3 text-left shadow-[0_0_12px_rgba(239,68,68,0.3)]">
              <div className="flex items-center gap-1.5 text-red-300 font-black text-xs">
                <span>🔒</span>
                <span>PUNTOS BLOQUEADOS POR COBRO DE PREMIO</span>
              </div>
              <p className="font-sans text-[10px] text-red-200/90 mt-1 leading-tight">
                Tu premio anterior ya fue cobrado o la administración pausó la acumulación. Puedes seguir jugando en modo arcade, pero no se sumarán nuevas fichas hasta que el administrador reactive tu cuenta.
              </p>
            </div>
          ) : (
            <div className="bg-[#0b1320] border border-amber-400/30 rounded-lg p-2 mb-3 text-left">
              <p className="font-sans text-[10px] text-slate-300 leading-tight">
                🪙 <strong className="text-[#fde047]">Fichas 100% acumulables:</strong> Se suman partida a partida. Solo el administrador puede descontarlas o regresarlas a 0 una vez pagado tu premio.
              </p>
            </div>
          )}

          <div className="space-y-2.5">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => sounds.play('click')}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-mono font-black text-xs sm:text-sm tracking-widest bg-[#22c55e] hover:bg-[#16a34a] text-slate-950 shadow-[0_0_20px_rgba(34,197,94,0.6)] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>📱 COBRAR POR WHATSAPP</span>
            </a>

            <button
              type="button"
              onClick={() => {
                sounds.play('click');
                onPlayAgain();
              }}
              className="w-full py-2.5 px-4 rounded-xl font-mono font-bold text-xs tracking-wider border-1.5 border-[#eab308] text-[#fde047] hover:bg-[#eab308]/15 active:scale-[0.98] transition-all cursor-pointer"
            >
              {player?.isBlocked ? '🔄 SEGUIR JUGANDO (MODO ARCADE)' : '🔄 SEGUIR JUGANDO Y ACUMULANDO'}
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
      getTopLeaderboard(15)
        .then((data) => setRecords(data))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 z-50 animate-fadeIn">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#11192e] to-[#070b14] border-2 border-[#38bdf8] rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(56,189,248,0.35)] text-center max-h-[85vh] flex flex-col">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#38bdf8] via-[#eab308] to-[#38bdf8] rounded-t-2xl" />

        <div className="mb-3">
          <div className="text-3xl mb-1">👑</div>
          <h2 className="font-mono text-xl font-black tracking-widest text-[#38bdf8] drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]">
            SALÓN DE LA FAMA
          </h2>
          <p className="font-mono text-[9px] tracking-widest text-slate-400 uppercase">
            MEJORES PUNTUACIONES
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 my-2 pr-1 font-mono text-xs">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
              <div className="w-5 h-5 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin" />
              <span>Cargando registros...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="py-8 text-slate-400">¡Sé el primero en establecer un récord!</div>
          ) : (
            records.map((r, i) => (
              <div
                key={r.id || i}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <span className={`font-black w-6 text-left ${i === 0 ? 'text-[#fde047]' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                    #{i + 1}
                  </span>
                  <div className="text-left">
                    <span className="font-bold text-white block truncate max-w-[110px]">{r.nickname}</span>
                    <span className="text-[10px] text-[#38bdf8]">#{r.userCode}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-bold text-white block">{r.score.toLocaleString()} pts</span>
                  <span className="text-[10px] text-[#fef08a]">{r.fichas}🪙 · {r.lines}L</span>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2 py-2 rounded-lg font-mono font-bold text-xs tracking-wider bg-slate-800 text-[#38bdf8] border border-slate-700 hover:bg-slate-700 active:scale-95 transition-all"
        >
          CERRAR
        </button>
      </div>
    </div>
  );
};

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserDataChanged?: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose, onUserDataChanged }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [users, setUsers] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modales secundarios de acción sobre jugador
  const [selectedUser, setSelectedUser] = useState<PlayerProfile | null>(null);
  const [actionType, setActionType] = useState<'reset' | 'modify' | 'edit_name' | null>(null);
  const [customFichas, setCustomFichas] = useState<string>('');
  const [customNickname, setCustomNickname] = useState<string>('');
  const [blockAfterReset, setBlockAfterReset] = useState(true);
  const DEFAULT_MASTER_PIN = 'rey777';
  const currentPin = localStorage.getItem('tetris_custom_admin_pin') || DEFAULT_MASTER_PIN;

  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadAllUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) {
      console.error('Error cargando usuarios admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadAllUsers();
    }
    if (!isOpen) {
      setActionType(null);
      setSelectedUser(null);
    }
  }, [isOpen, isAuthenticated]);

  if (!isOpen) return null;

  // 1. Pantalla de PIN de Seguridad
  if (!isAuthenticated) {
    const handleLoginPin = (e: React.FormEvent) => {
      e.preventDefault();
      const entered = pinInput.trim();
      if (entered === currentPin || entered === DEFAULT_MASTER_PIN) {
        sounds.play('tetris');
        setIsAuthenticated(true);
        setPinError(null);
        setPinInput('');
        loadAllUsers();
      } else {
        sounds.play('gameover');
        setPinError('PIN incorrecto. Acceso exclusivo para administradores de El Rey.');
      }
    };

    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="relative w-full max-w-sm bg-gradient-to-b from-[#11192e] to-[#070b14] border-2 border-[#eab308] rounded-2xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(234,179,8,0.4)] text-center">
          <div className="text-4xl mb-2">🔐</div>
          <h2 className="font-mono text-xl font-black tracking-widest text-[#fde047] uppercase drop-shadow-[0_0_10px_rgba(253,224,71,0.8)]">
            ADMINISTRACIÓN VIP
          </h2>
          <p className="font-mono text-[10px] text-slate-400 uppercase mb-4">
            CASINO EL REY · CONTROL DE FICHAS
          </p>

          <form onSubmit={handleLoginPin} className="space-y-3.5 text-left">
            <div>
              <label className="block font-mono text-[10px] font-bold text-[#38bdf8] mb-1">
                INGRESA EL PIN DE ADMINISTRADOR:
              </label>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="PIN maestro..."
                autoFocus
                className="w-full bg-[#080d17] border border-[#eab308]/60 focus:border-[#fde047] rounded-lg px-3 py-2.5 text-white font-mono text-center tracking-widest text-lg outline-none"
              />
            </div>

            {pinError && (
              <div className="bg-red-500/20 border border-red-500/60 text-red-200 text-xs p-2 rounded text-center">
                {pinError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl font-mono text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl font-mono text-xs font-black bg-gradient-to-r from-[#fde047] to-[#eab308] text-slate-950 shadow-[0_0_14px_rgba(234,179,8,0.5)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                ENTRAR
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 2. Panel Principal de Administración
  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    return u.nickname.toLowerCase().includes(q) || u.userCode.includes(q);
  });

  const totalFichasEnSistema = users.reduce((acc, u) => acc + (u.totalFichas || 0), 0);

  // Ejecución de acciones
  const handleExecuteReset = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      sounds.play('drop');
      await adminResetUserFichas(selectedUser.sequenceNumber, blockAfterReset);
      showToast(`¡Premio cobrado! Fichas de #${selectedUser.userCode} a 0${blockAfterReset ? ' (Puntos bloqueados)' : ''}.`);
      setActionType(null);
      setSelectedUser(null);
      await loadAllUsers();
      if (onUserDataChanged) onUserDataChanged();
    } catch (err) {
      console.error(err);
      showToast('Error al resetear fichas.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async (u: PlayerProfile) => {
    const nextStatus = !u.isBlocked;
    setLoading(true);
    try {
      sounds.play('click');
      await adminToggleUserBlock(u.sequenceNumber, nextStatus);
      setUsers((prev) =>
        prev.map((item) =>
          item.sequenceNumber === u.sequenceNumber ? { ...item, isBlocked: nextStatus } : item
        )
      );
      showToast(nextStatus ? `🔒 Puntos bloqueados para ${u.nickname} (#${u.userCode})` : `🔓 Puntos desbloqueados para ${u.nickname} (#${u.userCode})`);
      if (onUserDataChanged) onUserDataChanged();
    } catch (err) {
      console.error(err);
      showToast('Error al cambiar bloqueo de usuario.');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockAll = async (blocked: boolean) => {
    setLoading(true);
    try {
      sounds.play('drop');
      const count = await adminBlockAllUsers(blocked);
      setUsers((prev) => prev.map((item) => ({ ...item, isBlocked: blocked })));
      showToast(blocked ? `🔒 Puntos bloqueados a ${count} jugadores` : `🔓 Puntos desbloqueados a ${count} jugadores`);
      if (onUserDataChanged) onUserDataChanged();
    } catch (err) {
      console.error(err);
      showToast('Error al modificar usuarios en masa.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteModifyFichas = async () => {
    if (!selectedUser) return;
    const val = parseInt(customFichas, 10);
    if (isNaN(val) || val < 0) {
      showToast('Ingresa un número válido mayor o igual a 0.');
      return;
    }
    setLoading(true);
    try {
      sounds.play('click');
      await adminUpdateUserFichas(selectedUser.sequenceNumber, val);
      showToast(`Fichas de #${selectedUser.userCode} actualizadas a ${val.toLocaleString()} 🪙`);
      setActionType(null);
      setSelectedUser(null);
      await loadAllUsers();
      if (onUserDataChanged) onUserDataChanged();
    } catch (err) {
      console.error(err);
      showToast('Error al modificar fichas.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteEditName = async () => {
    if (!selectedUser) return;
    if (!customNickname.trim()) {
      showToast('Escribe un apodo válido.');
      return;
    }
    setLoading(true);
    try {
      sounds.play('click');
      await adminUpdateUserNickname(selectedUser.sequenceNumber, customNickname.trim());
      showToast(`Apodo de #${selectedUser.userCode} cambiado a "${customNickname.trim()}".`);
      setActionType(null);
      setSelectedUser(null);
      await loadAllUsers();
      if (onUserDataChanged) onUserDataChanged();
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar apodo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#0f172a] via-[#090f1d] to-[#04070e] border-2 border-[#eab308] rounded-2xl p-4 sm:p-5 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(234,179,8,0.35)] flex flex-col max-h-[90vh]">
        
        {toastMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#22c55e] text-slate-950 font-mono font-black text-xs px-4 py-2 rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.8)] z-50 animate-bounce">
            {toastMessage}
          </div>
        )}

        {/* Encabezado */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👑</span>
            <div>
              <h2 className="font-mono text-base sm:text-lg font-black text-[#fde047] tracking-wider uppercase leading-none">
                PANEL ADMINISTRATIVO EL REY
              </h2>
              <span className="font-mono text-[9px] text-[#38bdf8] font-bold">
                GESTIÓN DE JUGADORES, COBROS Y BLOQUEO DE PUNTOS
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAllUsers}
              disabled={loading}
              className="p-1.5 px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white cursor-pointer"
              title="Refrescar lista"
            >
              🔄 {loading ? '...' : 'Actualizar'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 text-lg leading-none cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-2 gap-2 my-2.5">
          <div className="bg-[#091122] border border-slate-800 rounded-xl p-2 text-center">
            <span className="font-mono text-[10px] text-slate-400 uppercase block font-bold">
              JUGADORES REGISTRADOS
            </span>
            <span className="font-mono text-lg sm:text-2xl font-black text-[#38bdf8]">
              {users.length}
            </span>
          </div>
          <div className="bg-[#091122] border border-slate-800 rounded-xl p-2 text-center">
            <span className="font-mono text-[10px] text-slate-400 uppercase block font-bold">
              FICHAS EN CIRCULACIÓN
            </span>
            <span className="font-mono text-lg sm:text-2xl font-black text-[#fde047]">
              {totalFichasEnSistema.toLocaleString()} 🪙
            </span>
          </div>
        </div>

        {/* Control Global de Bloqueo de Puntos para Todos los Usuarios */}
        <div className="bg-[#060c18] border border-slate-800 rounded-xl p-2.5 mb-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2 text-left w-full sm:w-auto">
            <span className="text-xl">🛡️</span>
            <div>
              <span className="font-mono text-xs font-black text-white block">CONTROL GLOBAL DE BLOQUEO</span>
              <span className="font-mono text-[9px] text-slate-400">Bloquea o desbloquea acumular fichas a todos</span>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleBlockAll(true)}
              disabled={loading}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-red-600/25 border border-red-500/80 hover:bg-red-600/40 text-red-200 font-mono font-black text-[10px] tracking-wider transition-all cursor-pointer shadow-[0_0_8px_rgba(239,68,68,0.3)] flex items-center justify-center gap-1"
              title="Bloquear puntos a todos los jugadores"
            >
              <span>🔒 BLOQUEAR TODOS</span>
            </button>
            <button
              type="button"
              onClick={() => handleBlockAll(false)}
              disabled={loading}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-emerald-600/25 border border-emerald-500/80 hover:bg-emerald-600/40 text-emerald-200 font-mono font-black text-[10px] tracking-wider transition-all cursor-pointer shadow-[0_0_8px_rgba(34,197,94,0.3)] flex items-center justify-center gap-1"
              title="Desbloquear puntos a todos los jugadores"
            >
              <span>🔓 DESBLOQUEAR TODOS</span>
            </button>
          </div>
        </div>

        {/* Buscador */}
        <div className="mb-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Buscar por apodo o por código (Ej. #0001)..."
            className="w-full bg-[#070b14] border border-slate-700 focus:border-[#38bdf8] rounded-lg px-3 py-2 text-white font-sans text-xs outline-none"
          />
        </div>

        {/* Lista de Jugadores */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs my-1">
          {loading && users.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-[#eab308] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>Cargando jugadores desde Firebase...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              No se encontraron jugadores que coincidan con la búsqueda.
            </div>
          ) : (
            filteredUsers.map((u) => (
              <div
                key={u.sequenceNumber}
                className={`bg-[#09101f] border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md transition-all ${
                  u.isBlocked ? 'border-red-500/40 bg-red-950/10' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Datos del Jugador */}
                <div className="flex items-start gap-2.5">
                  <div className={`w-10 h-10 rounded-full bg-[#050912] border-2 flex items-center justify-center font-black text-xs flex-shrink-0 ${
                    u.isBlocked ? 'border-red-500 text-red-400' : 'border-[#38bdf8] text-[#38bdf8]'
                  }`}>
                    #{u.userCode}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-white text-sm tracking-wide">{u.nickname}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUser(u);
                          setCustomNickname(u.nickname);
                          setActionType('edit_name');
                        }}
                        className="text-[10px] text-slate-400 hover:text-[#38bdf8] cursor-pointer"
                        title="Editar nombre"
                      >
                        ✏️
                      </button>
                      {/* Badge de Bloqueo de Puntos */}
                      {u.isBlocked && (
                        <span className="bg-red-500/20 border border-red-500/60 text-red-300 text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider">
                          🔒 PUNTOS BLOQUEADOS
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                      <span>Récord: <strong className="text-white">{u.highScore?.toLocaleString() || 0} pts</strong></span>
                      <span>Partidas: <strong className="text-white">{u.gamesPlayed || 0}</strong></span>
                      {u.lastActive && (
                        <span>Activo: {new Date(u.lastActive).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Saldo y Acciones de Administrador */}
                <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                  <div className="text-left sm:text-right">
                    <span className="text-[9px] text-slate-400 block font-bold">FICHAS:</span>
                    <span className="text-base sm:text-lg font-black text-[#fef08a] drop-shadow-[0_0_8px_rgba(254,240,138,0.8)]">
                      {(u.totalFichas || 0).toLocaleString()} 🪙
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Botón Bloquear / Desbloquear Puntos */}
                    <button
                      type="button"
                      onClick={() => handleToggleBlock(u)}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-black tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                        u.isBlocked
                          ? 'bg-emerald-600/25 border border-emerald-400 text-emerald-300 hover:bg-emerald-600/40 shadow-[0_0_8px_rgba(34,197,94,0.3)]'
                          : 'bg-amber-500/20 border border-amber-400/70 text-amber-300 hover:bg-amber-500/40'
                      }`}
                      title={u.isBlocked ? 'Desbloquear acumulación de fichas' : 'Bloquear acumulación de fichas tras cobrar'}
                    >
                      <span>{u.isBlocked ? '🔓 DESBLOQUEAR' : '🔒 BLOQUEAR'}</span>
                    </button>

                    {/* Botón Cobrado / Reset a 0 */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(u);
                        setBlockAfterReset(true);
                        setActionType('reset');
                      }}
                      className="px-2 py-1.5 rounded-lg bg-red-600/20 border border-red-500/70 hover:bg-red-600/40 text-red-200 text-[10px] font-black tracking-wider transition-all cursor-pointer"
                      title="Liquidar premio y poner a 0"
                    >
                      COBRAR (0🪙)
                    </button>

                    {/* Botón Modificar Fichas */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(u);
                        setCustomFichas(String(u.totalFichas || 0));
                        setActionType('modify');
                      }}
                      className="px-2 py-1.5 rounded-lg bg-[#eab308]/20 border border-[#eab308]/70 hover:bg-[#eab308]/40 text-[#fde047] text-[10px] font-black tracking-wider transition-all cursor-pointer"
                      title="Ajustar cantidad de fichas"
                    >
                      EDITAR 🪙
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* SUBMODAL: Confirmación de Cobro (Reset a 0) */}
        {actionType === 'reset' && selectedUser && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
            <div className="bg-[#0f172a] border-2 border-red-500 rounded-xl p-5 max-w-sm w-full text-center space-y-3 font-mono">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-base font-black text-red-400 uppercase">
                ¿CONFIRMAR COBRO DE PREMIO?
              </h3>
              <p className="text-xs text-slate-300">
                Se liquidará el premio y se reseteará a <strong>0 fichas</strong> la cuenta de:
              </p>
              <div className="bg-[#080d17] p-2.5 rounded border border-slate-700 text-left text-xs space-y-1">
                <div>Jugador: <strong className="text-white">{selectedUser.nickname}</strong></div>
                <div>Código ID: <strong className="text-[#38bdf8]">#{selectedUser.userCode}</strong></div>
                <div>Fichas actuales a liquidar: <strong className="text-[#fde047]">{selectedUser.totalFichas.toLocaleString()} 🪙</strong></div>
              </div>

              {/* Opción de bloqueo al cobrar premio */}
              <label className="flex items-center gap-2 bg-[#080d17] p-2.5 rounded-lg border border-amber-400/50 cursor-pointer text-left">
                <input
                  type="checkbox"
                  checked={blockAfterReset}
                  onChange={(e) => setBlockAfterReset(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer flex-shrink-0"
                />
                <span className="text-[11px] text-amber-200 font-bold leading-tight">
                  🔒 Bloquear puntos al usuario tras cobrar premio (no sumará más fichas)
                </span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold"
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  onClick={handleExecuteReset}
                  disabled={loading}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-black shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                >
                  {loading ? 'RESET...' : 'SÍ, LIQUIDAR A 0'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUBMODAL: Modificar Fichas (+ / - / Fijar) */}
        {actionType === 'modify' && selectedUser && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
            <div className="bg-[#0f172a] border-2 border-[#eab308] rounded-xl p-5 max-w-sm w-full text-center space-y-3 font-mono">
              <span className="text-3xl">🪙</span>
              <h3 className="text-base font-black text-[#fde047] uppercase">
                MODIFICAR FICHAS
              </h3>
              <p className="text-xs text-slate-300">
                Ajustar saldo para <strong>{selectedUser.nickname}</strong> (#{selectedUser.userCode}):
              </p>

              <div>
                <label className="block text-[10px] text-slate-400 text-left mb-1 font-bold">
                  NUEVO TOTAL DE FICHAS:
                </label>
                <input
                  type="number"
                  value={customFichas}
                  onChange={(e) => setCustomFichas(e.target.value)}
                  className="w-full bg-[#080d17] border border-[#eab308] rounded-lg px-3 py-2 text-white font-mono text-center text-lg font-black outline-none"
                />
              </div>

              {/* Botones de ajuste rápido */}
              <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setCustomFichas((prev) => String(Math.max(0, (parseInt(prev, 10) || 0) + 100)))}
                  className="py-1 bg-slate-800 hover:bg-slate-700 text-[#4ade80] rounded font-bold"
                >
                  +100
                </button>
                <button
                  type="button"
                  onClick={() => setCustomFichas((prev) => String(Math.max(0, (parseInt(prev, 10) || 0) + 500)))}
                  className="py-1 bg-slate-800 hover:bg-slate-700 text-[#4ade80] rounded font-bold"
                >
                  +500
                </button>
                <button
                  type="button"
                  onClick={() => setCustomFichas((prev) => String(Math.max(0, (parseInt(prev, 10) || 0) - 100)))}
                  className="py-1 bg-slate-800 hover:bg-slate-700 text-red-300 rounded font-bold"
                >
                  -100
                </button>
                <button
                  type="button"
                  onClick={() => setCustomFichas('0')}
                  className="py-1 bg-slate-800 hover:bg-slate-700 text-red-400 rounded font-bold"
                >
                  = 0
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold"
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  onClick={handleExecuteModifyFichas}
                  disabled={loading}
                  className="flex-1 py-2 bg-[#eab308] hover:bg-[#fde047] text-slate-950 rounded-lg text-xs font-black shadow-[0_0_12px_rgba(234,179,8,0.5)]"
                >
                  {loading ? 'GUARDANDO...' : 'GUARDAR SALDO'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUBMODAL: Editar Apodo */}
        {actionType === 'edit_name' && selectedUser && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
            <div className="bg-[#0f172a] border-2 border-[#38bdf8] rounded-xl p-5 max-w-sm w-full text-center space-y-3 font-mono">
              <span className="text-3xl">✏️</span>
              <h3 className="text-base font-black text-[#38bdf8] uppercase">
                EDITAR APODO DE JUGADOR
              </h3>
              <p className="text-xs text-slate-300">
                Código: <strong>#{selectedUser.userCode}</strong>
              </p>

              <div>
                <input
                  type="text"
                  value={customNickname}
                  onChange={(e) => setCustomNickname(e.target.value)}
                  maxLength={24}
                  className="w-full bg-[#080d17] border border-[#38bdf8] rounded-lg px-3 py-2 text-white font-sans text-sm outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold"
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  onClick={handleExecuteEditName}
                  disabled={loading}
                  className="flex-1 py-2 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 rounded-lg text-xs font-black"
                >
                  {loading ? 'GUARDANDO...' : 'ACTUALIZAR'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUBMODAL: Cambiar PIN de Administrador */}
        {showChangePinModal && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
            <div className="bg-[#0f172a] border-2 border-[#eab308] rounded-xl p-5 max-w-sm w-full text-center space-y-3 font-mono">
              <span className="text-3xl">🔑</span>
              <h3 className="text-base font-black text-[#fde047] uppercase">
                CAMBIAR PIN DE ADMINISTRADOR
              </h3>
              <p className="text-xs text-slate-300">
                Define una nueva clave secreta para acceder al panel.
              </p>

              <div className="space-y-2 text-left">
                <div>
                  <label className="text-[10px] text-slate-400 block font-bold">NUEVO PIN:</label>
                  <input
                    type="password"
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    placeholder="Mínimo 4 caracteres..."
                    className="w-full bg-[#080d17] border border-slate-700 focus:border-[#fde047] rounded-lg px-3 py-2 text-white font-mono text-center tracking-widest outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block font-bold">CONFIRMAR NUEVO PIN:</label>
                  <input
                    type="password"
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value)}
                    placeholder="Repite el PIN..."
                    className="w-full bg-[#080d17] border border-slate-700 focus:border-[#fde047] rounded-lg px-3 py-2 text-white font-mono text-center tracking-widest outline-none"
                  />
                </div>
              </div>

              {pinChangeError && (
                <div className="text-xs text-red-300 bg-red-500/20 p-2 rounded border border-red-500/50">
                  {pinChangeError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePinModal(false);
                    setPinChangeError(null);
                    setNewPinInput('');
                    setConfirmPinInput('');
                  }}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold"
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (newPinInput.trim().length < 4) {
                      setPinChangeError('El PIN debe tener al menos 4 caracteres.');
                      return;
                    }
                    if (newPinInput.trim() !== confirmPinInput.trim()) {
                      setPinChangeError('Los PINs no coinciden.');
                      return;
                    }
                    localStorage.setItem('tetris_custom_admin_pin', newPinInput.trim());
                    sounds.play('tetris');
                    showToast('¡PIN de Administrador cambiado con éxito!');
                    setShowChangePinModal(false);
                    setNewPinInput('');
                    setConfirmPinInput('');
                    setPinChangeError(null);
                  }}
                  className="flex-1 py-2 bg-[#eab308] hover:bg-[#fde047] text-slate-950 rounded-lg text-xs font-black shadow-[0_0_12px_rgba(234,179,8,0.5)]"
                >
                  GUARDAR PIN
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pie del Panel */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <button
            type="button"
            onClick={() => setShowChangePinModal(true)}
            className="text-[#eab308] hover:text-[#fde047] hover:underline cursor-pointer flex items-center gap-1 font-bold"
          >
            <span>🔑</span>
            <span>Cambiar PIN</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-[#38bdf8] hover:underline cursor-pointer font-bold"
          >
            VOLVER AL JUEGO
          </button>
        </div>
      </div>
    </div>
  );
};
