import { Lesson } from './types';

export const DEFAULT_LESSON: Lesson = {
  title: 'Bài học tổng hợp',
  questions: [
    {
      id: 1,
      text: 'Thủ đô của Việt Nam là gì?',
      leftOption: 'Hà Nội',
      rightOption: 'TP. Ho Chi Minh',
      correctOption: 'left'
    },
    {
      id: 2,
      text: '2 + 2 bằng mấy?',
      leftOption: '3',
      rightOption: '4',
      correctOption: 'right'
    },
    {
      id: 3,
      text: "Con vật nào kêu 'gâu gâu'?",
      leftOption: 'Mèo',
      rightOption: 'Chó',
      correctOption: 'right'
    }
  ]
};
