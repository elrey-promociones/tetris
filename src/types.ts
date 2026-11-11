export type TetrominoType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z' | 'GARBAGE';

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
