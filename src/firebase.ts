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

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch {
    return true;
  }
}

export async function getNextAvailableSequenceNumber(): Promise<number> {
  const counterRef = doc(db, 'counters', 'userCounter');
  try {
    const snap = await getDoc(counterRef);
    if (snap.exists()) {
      const data = snap.data();
      return (typeof data?.currentNumber === 'number' ? data.currentNumber : 0) + 1;
    }
    return 1;
  } catch {
    return 1;
  }
}

export async function registerSequentialUser(nickname: string): Promise<PlayerProfile> {
  const counterRef = doc(db, 'counters', 'userCounter');

  return await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    let currentNumber = 0;
    if (counterSnap.exists()) {
      const data = counterSnap.data();
      currentNumber = typeof data?.currentNumber === 'number' ? data.currentNumber : 0;
    }

    const nextNumber = currentNumber + 1;
    const formattedCode = String(nextNumber).padStart(4, '0');
    const userDocRef = doc(db, 'users', `user_${nextNumber}`);

    transaction.set(
      counterRef,
      { currentNumber: nextNumber, updatedAt: serverTimestamp() },
      { merge: true }
    );

    const newUserData = {
      sequenceNumber: nextNumber,
      userCode: formattedCode,
      nickname: nickname.trim(),
      highScore: 0,
      totalFichas: 0,
      gamesPlayed: 0,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };

    transaction.set(userDocRef, newUserData);

    return newUserData as PlayerProfile;
  });
}

export async function getExistingUserByCode(code: string): Promise<PlayerProfile | null> {
  const cleanCode = code.replace(/[^0-9]/g, '');
  if (!cleanCode) return null;

  const num = parseInt(cleanCode, 10);
  if (isNaN(num) || num <= 0) return null;

  const userRef = doc(db, 'users', `user_${num}`);
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
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function recordGameSession(data: {
  userCode: string;
  nickname: string;
  score: number;
  lines: number;
  level: number;
  fichas: number;
}): Promise<void> {
  try {
    const recordsCol = collection(db, 'game_records');
    await addDoc(recordsCol, {
      ...data,
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    });

    const num = parseInt(data.userCode.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      const userDocRef = doc(db, 'users', `user_${num}`);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const cur = snap.data();
        await setDoc(
          userDocRef,
          {
            highScore: Math.max(cur.highScore || 0, data.score),
            totalFichas: (cur.totalFichas || 0) + data.fichas,
            gamesPlayed: (cur.gamesPlayed || 0) + 1,
            lastActive: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }
  } catch (err) {
    console.error('Error guardando en Firestore:', err);
  }
}

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
  } catch {
    return [];
  }
}
