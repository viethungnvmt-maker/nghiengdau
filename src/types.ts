export type QuestionOption = 'left' | 'right';

export type TiltDirection = QuestionOption | 'center';

export interface Question {
  id: number;
  text: string;
  leftOption: string;
  rightOption: string;
  correctOption: QuestionOption;
}

export interface Lesson {
  title: string;
  questions: Question[];
}

export type GameState = 'START' | 'PLAYING' | 'RESULT' | 'END';

export interface GameStats {
  score: number;
  totalQuestions: number;
  currentQuestionIndex: number;
}
