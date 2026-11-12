import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  runTransaction,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { PlayerProfile, GameRecord } from './types';

// Inicializar Firebase App y Firestore con la base de datos específica
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: true,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Valida la conexión con Firestore en el arranque
 */
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client offline, verificando conexión...');
    }
    return true;
  }
}

/**
 * Consulta el próximo número de secuencia disponible en Firestore sin incrementarlo
 */
export async function getNextAvailableSequenceNumber(): Promise<number> {
  const counterRef = doc(db, 'counters', 'userCounter');
  try {
    const snap = await getDoc(counterRef);
    if (snap.exists()) {
      const data = snap.data();
      const current = typeof data?.currentNumber === 'number' ? data.currentNumber : 0;
      return current + 1;
    }
    return 1;
  } catch (err) {
    console.warn('No se pudo consultar contador, usando 1 por defecto:', err);
    return 1;
  }
}

/**
 * Genera un nuevo código secuencial único incremental (1, 2, 3...)
 * usando una transacción atómica en Firebase Firestore y crea el perfil del usuario.
 */
export async function registerSequentialUser(nickname: string): Promise<PlayerProfile> {
  const counterRef = doc(db, 'counters', 'userCounter');

  try {
    const result = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let currentNumber = 0;
      if (counterSnap.exists()) {
        const data = counterSnap.data();
        currentNumber = typeof data?.currentNumber === 'number' ? data.currentNumber : 0;
      }

      const nextNumber = currentNumber + 1;
      const formattedCode = String(nextNumber).padStart(4, '0');
      const userDocId = `user_${nextNumber}`;
      const userDocRef = doc(db, 'users', userDocId);

      // 1. Actualizar el contador atómicamente
      transaction.set(
        counterRef,
        {
          currentNumber: nextNumber,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2. Registrar el perfil del nuevo usuario
      const newUserData = {
        sequenceNumber: nextNumber,
        userCode: formattedCode,
        nickname: nickname.trim(),
        highScore: 0,
        totalFichas: 0,
        gamesPlayed: 0,
        isBlocked: false,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };

      transaction.set(userDocRef, newUserData);

      return {
        sequenceNumber: nextNumber,
        userCode: formattedCode,
        nickname: nickname.trim(),
        highScore: 0,
        totalFichas: 0,
        gamesPlayed: 0,
        isBlocked: false,
      } as PlayerProfile;
    });

    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'counters/userCounter');
  }
}

/**
 * Busca si ya existe un usuario con un código secuencial determinado
 */
export async function getExistingUserByCode(code: string): Promise<PlayerProfile | null> {
  const cleanCode = code.replace(/[^0-9]/g, '');
  if (!cleanCode) return null;

  const num = parseInt(cleanCode, 10);
  if (isNaN(num) || num <= 0) return null;

  const userDocId = `user_${num}`;
  const userRef = doc(db, 'users', userDocId);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        sequenceNumber: data.sequenceNumber || num,
        userCode: data.userCode || String(num).padStart(4, '0'),
        nickname: data.nickname || `Jugador #${num}`,
        highScore: data.highScore || 0,
        totalFichas: data.totalFichas || 0,
        gamesPlayed: data.gamesPlayed || 0,
        isBlocked: !!data.isBlocked,
      };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${userDocId}`);
  }
}

/**
 * Guarda el registro de una partida, acumula las fichas al saldo del jugador
 * y retorna el perfil actualizado con el nuevo saldo acumulado.
 * Si el usuario tiene los puntos bloqueados (isBlocked), no se suman nuevas fichas.
 */
export async function recordGameSession(data: {
  userCode: string;
  nickname: string;
  score: number;
  lines: number;
  level: number;
  fichas: number;
}): Promise<PlayerProfile | null> {
  try {
    const recordsCol = collection(db, 'game_records');
    const addRecordPromise = addDoc(recordsCol, {
      ...data,
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    }).catch((err) => {
      console.warn('Registro secundario en background:', err);
    });

    const num = parseInt(data.userCode.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      const userDocRef = doc(db, 'users', `user_${num}`);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const cur = snap.data();
        const isUserBlocked = !!cur.isBlocked;
        const addedFichas = isUserBlocked ? 0 : data.fichas;
        const updatedFichas = Math.min(10000, (cur.totalFichas || 0) + addedFichas);
        const updatedScore = Math.max(cur.highScore || 0, data.score);
        const updatedGames = (cur.gamesPlayed || 0) + 1;

        const updatePromise = setDoc(
          userDocRef,
          {
            highScore: updatedScore,
            totalFichas: updatedFichas,
            gamesPlayed: updatedGames,
            lastActive: new Date().toISOString(),
          },
          { merge: true }
        );

        await Promise.all([addRecordPromise, updatePromise]);

        return {
          sequenceNumber: cur.sequenceNumber || num,
          userCode: cur.userCode || String(num).padStart(4, '0'),
          nickname: cur.nickname || data.nickname,
          highScore: updatedScore,
          totalFichas: updatedFichas,
          gamesPlayed: updatedGames,
          isBlocked: isUserBlocked,
        };
      }
    }
    await addRecordPromise;
    return null;
  } catch (err) {
    console.error('Error guardando registro de juego en Firestore:', err);
    return null;
  }
}

/**
 * Obtiene todos los jugadores registrados para el panel de administración
 */
export async function getAllUsers(): Promise<PlayerProfile[]> {
  try {
    const usersCol = collection(db, 'users');
    const snap = await getDocs(usersCol);
    const users: PlayerProfile[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data && typeof data.sequenceNumber === 'number') {
        users.push({
          sequenceNumber: data.sequenceNumber,
          userCode: data.userCode || String(data.sequenceNumber).padStart(4, '0'),
          nickname: data.nickname || `Jugador #${data.sequenceNumber}`,
          highScore: data.highScore || 0,
          totalFichas: data.totalFichas || 0,
          gamesPlayed: data.gamesPlayed || 0,
          isBlocked: !!data.isBlocked,
          createdAt: data.createdAt,
          lastActive: data.lastActive,
        });
      }
    });
    users.sort((a, b) => b.sequenceNumber - a.sequenceNumber);
    return users;
  } catch (err) {
    console.error('Error obteniendo lista de usuarios:', err);
    return [];
  }
}

/**
 * Bloquea o desbloquea la acumulación de puntos a un usuario específico
 */
export async function adminToggleUserBlock(sequenceNumber: number, isBlocked: boolean): Promise<void> {
  const userDocRef = doc(db, 'users', `user_${sequenceNumber}`);
  try {
    await setDoc(
      userDocRef,
      {
        isBlocked,
        lastModifiedByAdmin: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/user_${sequenceNumber}`);
  }
}

/**
 * Bloquea o desbloquea la acumulación de puntos a TODOS los usuarios a la vez
 */
export async function adminBlockAllUsers(isBlocked: boolean): Promise<number> {
  try {
    const usersCol = collection(db, 'users');
    const snap = await getDocs(usersCol);
    const promises: Promise<void>[] = [];
    snap.forEach((d) => {
      const ref = doc(db, 'users', d.id);
      promises.push(
        setDoc(
          ref,
          {
            isBlocked,
            lastModifiedByAdmin: new Date().toISOString(),
          },
          { merge: true }
        )
      );
    });
    await Promise.all(promises);
    return promises.length;
  } catch (err) {
    console.error('Error bloqueando/desbloqueando a todos:', err);
    throw err;
  }
}

/**
 * Actualiza la cantidad de fichas de un usuario desde el panel administrativo
 */
export async function adminUpdateUserFichas(sequenceNumber: number, newFichas: number): Promise<void> {
  const userDocRef = doc(db, 'users', `user_${sequenceNumber}`);
  const sanitized = Math.max(0, Math.floor(newFichas));
  try {
    await setDoc(
      userDocRef,
      {
        totalFichas: sanitized,
        lastModifiedByAdmin: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/user_${sequenceNumber}`);
  }
}

/**
 * Resetea a 0 las fichas de un usuario una vez que cobra su premio.
 * Opcionalmente puede bloquearlo de inmediato si blockAfterReset es true.
 */
export async function adminResetUserFichas(sequenceNumber: number, blockAfterReset = false): Promise<void> {
  const userDocRef = doc(db, 'users', `user_${sequenceNumber}`);
  try {
    await setDoc(
      userDocRef,
      {
        totalFichas: 0,
        isBlocked: blockAfterReset,
        lastModifiedByAdmin: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/user_${sequenceNumber}`);
  }
}

/**
 * Actualiza el apodo de un usuario desde el panel administrativo
 */
export async function adminUpdateUserNickname(sequenceNumber: number, newNickname: string): Promise<void> {
  const userDocRef = doc(db, 'users', `user_${sequenceNumber}`);
  const clean = newNickname.trim().slice(0, 30);
  try {
    await setDoc(
      userDocRef,
      {
        nickname: clean,
        lastModifiedByAdmin: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/user_${sequenceNumber}`);
  }
}

/**
 * Obtiene el top de mejores puntuaciones registradas
 */
export async function getTopLeaderboard(maxItems = 10): Promise<GameRecord[]> {
  try {
    const recordsCol = collection(db, 'game_records');
    const q = query(recordsCol, orderBy('score', 'desc'), limit(maxItems));
    const snap = await getDocs(q);
    const records: GameRecord[] = [];
    snap.forEach((d) => {
      const data = d.data();
      records.push({
        id: d.id,
        userCode: data.userCode,
        nickname: data.nickname,
        score: data.score,
        lines: data.lines,
        level: data.level,
        fichas: data.fichas,
        createdAt: data.createdAt,
      });
    });
    return records;
  } catch (err) {
    console.warn('No se pudo cargar tabla de líderes:', err);
    return [];
  }
}
