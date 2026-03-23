export interface Question {
  id: number;
  text: string;
  leftOption: string;
  rightOption: string;
  correctOption: 'left' | 'right';
}

export type GameState = 'START' | 'PLAYING' | 'RESULT' | 'END';

export interface GameStats {
  score: number;
  totalQuestions: number;
  currentQuestionIndex: number;
}
