import { Lesson } from './types';

export const DEFAULT_LESSON: Lesson = {
  title: 'Bai hoc tong hop',
  questions: [
    {
      id: 1,
      text: 'Thu do cua Viet Nam la gi?',
      leftOption: 'Ha Noi',
      rightOption: 'TP. Ho Chi Minh',
      correctOption: 'left'
    },
    {
      id: 2,
      text: '2 + 2 bang may?',
      leftOption: '3',
      rightOption: '4',
      correctOption: 'right'
    },
    {
      id: 3,
      text: "Con vat nao keu 'gau gau'?",
      leftOption: 'Meo',
      rightOption: 'Cho',
      correctOption: 'right'
    }
  ]
};
