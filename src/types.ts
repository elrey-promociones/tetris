/**
 * TETRIS EL REY - RETRO-FUTURISTA VIP
 * Types and Data Definitions
 */

export type TetrominoType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z' | 'GARBAGE';

export interface TetrominoColor {
  core: string;
  main: string;
  dark: string;
  glow: string;
}

export interface TetrominoPiece {
  type: TetrominoType;
  matrix: number[][];
  x: number;
  y: number;
}

export interface PlayerProfile {
  sequenceNumber: number;
  userCode: string;
  nickname: string;
  highScore: number;
  totalFichas: number;
  gamesPlayed: number;
  isBlocked?: boolean;
  createdAt?: string;
  lastActive?: string;
}

export interface GameRecord {
  id?: string;
  userCode: string;
  nickname: string;
  score: number;
  lines: number;
  level: number;
  fichas: number;
  createdAt: string;
}

export interface GameStats {
  score: number;
  lines: number;
  level: number;
  fichas: number;
}
