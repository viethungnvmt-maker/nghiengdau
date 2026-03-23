import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  BookOpen,
  Camera,
  CheckCircle2,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
  XCircle
} from 'lucide-react';
import HeadTracker from './components/HeadTracker';
import { DEFAULT_LESSON } from './constants';
import { GameState, GameStats, Lesson, Question, QuestionOption, TiltDirection } from './types';

const LESSON_STORAGE_KEY = 'head-tilt-quiz-lesson';
const TILT_HOLD_DURATION_MS = 1000;
const RESULT_DELAY_MS = 2000;
const LEGACY_TEXT_MAP: Record<string, string> = {
  'Bai hoc tong hop': 'Bài học tổng hợp',
  'Thu do cua Viet Nam la gi?': 'Thủ đô của Việt Nam là gì?',
  'Ha Noi': 'Hà Nội',
  '2 + 2 bang may?': '2 + 2 bằng mấy?',
  "Con vat nao keu 'gau gau'?": "Con vật nào kêu 'gâu gâu'?",
  Meo: 'Mèo',
  Cho: 'Chó'
};

const migrateLegacyText = (value: string) => LEGACY_TEXT_MAP[value] ?? value;

const cloneLesson = (lesson: Lesson): Lesson => ({
  title: lesson.title,
  questions: lesson.questions.map((question) => ({ ...question }))
});

const isQuestionComplete = (question: Question) =>
  question.text.trim().length > 0 &&
  question.leftOption.trim().length > 0 &&
  question.rightOption.trim().length > 0;

const isLessonReady = (lesson: Lesson) =>
  lesson.title.trim().length > 0 &&
  lesson.questions.length > 0 &&
  lesson.questions.every(isQuestionComplete);

const getNextQuestionId = (questions: Question[]) =>
  questions.reduce((maxId, question) => Math.max(maxId, question.id), 0) + 1;

const normalizeStoredQuestion = (value: unknown, index: number): Question => {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

  return {
    id: typeof record.id === 'number' && Number.isFinite(record.id) ? record.id : index + 1,
    text: typeof record.text === 'string' ? migrateLegacyText(record.text) : '',
    leftOption: typeof record.leftOption === 'string' ? migrateLegacyText(record.leftOption) : '',
    rightOption: typeof record.rightOption === 'string' ? migrateLegacyText(record.rightOption) : '',
    correctOption: record.correctOption === 'right' ? 'right' : 'left'
  };
};

const loadLessonDraft = (): Lesson => {
  if (typeof window === 'undefined') {
    return cloneLesson(DEFAULT_LESSON);
  }

  try {
    const rawLesson = window.localStorage.getItem(LESSON_STORAGE_KEY);
    if (!rawLesson) {
      return cloneLesson(DEFAULT_LESSON);
    }

    const parsedLesson = JSON.parse(rawLesson) as Record<string, unknown>;
    const draftQuestions = Array.isArray(parsedLesson.questions)
      ? parsedLesson.questions.map(normalizeStoredQuestion)
      : [];

    return {
      title:
        typeof parsedLesson.title === 'string'
          ? migrateLegacyText(parsedLesson.title)
          : DEFAULT_LESSON.title,
      questions: draftQuestions.length > 0 ? draftQuestions : cloneLesson(DEFAULT_LESSON).questions
    };
  } catch (error) {
    console.error('Error loading lesson draft:', error);
    return cloneLesson(DEFAULT_LESSON);
  }
};

const createBlankQuestion = (id: number): Question => ({
  id,
  text: '',
  leftOption: '',
  rightOption: '',
  correctOption: 'left'
});

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [lessonDraft, setLessonDraft] = useState<Lesson>(() => loadLessonDraft());
  const [activeLesson, setActiveLesson] = useState<Lesson>(() => cloneLesson(DEFAULT_LESSON));
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    totalQuestions: DEFAULT_LESSON.questions.length,
    currentQuestionIndex: 0
  });
  const [currentTilt, setCurrentTilt] = useState<TiltDirection>('center');
  const [tiltProgress, setTiltProgress] = useState(0);
  const [lastResult, setLastResult] = useState<{
    correct: boolean;
    option: QuestionOption;
  } | null>(null);

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionLockedRef = useRef(false);

  const currentQuestion = activeLesson.questions[stats.currentQuestionIndex];

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(LESSON_STORAGE_KEY, JSON.stringify(lessonDraft));
  }, [lessonDraft]);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      if (resultTimerRef.current) {
        clearTimeout(resultTimerRef.current);
      }
    };
  }, []);

  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const clearResultTimer = useCallback(() => {
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
  }, []);

  const resetRoundState = useCallback(() => {
    clearProgressInterval();
    clearResultTimer();
    selectionLockedRef.current = false;
    setCurrentTilt('center');
    setTiltProgress(0);
    setLastResult(null);
  }, [clearProgressInterval, clearResultTimer]);

  const handleSelection = useCallback(
    (option: QuestionOption) => {
      if (gameState !== 'PLAYING' || selectionLockedRef.current || !currentQuestion) {
        return;
      }

      selectionLockedRef.current = true;
      clearProgressInterval();
      setCurrentTilt('center');

      const isCorrect = option === currentQuestion.correctOption;
      setLastResult({ correct: isCorrect, option });
      setGameState('RESULT');

      if (isCorrect) {
        setStats((previousStats) => ({
          ...previousStats,
          score: previousStats.score + 1
        }));
      }

      clearResultTimer();
      resultTimerRef.current = setTimeout(() => {
        const nextQuestionIndex = stats.currentQuestionIndex + 1;

        if (nextQuestionIndex < activeLesson.questions.length) {
          setStats((previousStats) => ({
            ...previousStats,
            currentQuestionIndex: previousStats.currentQuestionIndex + 1
          }));
          setGameState('PLAYING');
          setLastResult(null);
          setTiltProgress(0);
          selectionLockedRef.current = false;
        } else {
          setGameState('END');
        }
      }, RESULT_DELAY_MS);
    },
    [
      activeLesson.questions.length,
      clearProgressInterval,
      clearResultTimer,
      currentQuestion,
      gameState,
      stats.currentQuestionIndex
    ]
  );

  const handleTilt = useCallback((tilt: TiltDirection) => {
    if (selectionLockedRef.current) {
      return;
    }

    setCurrentTilt(tilt);
  }, []);

  useEffect(() => {
    if (gameState !== 'PLAYING') {
      clearProgressInterval();
      setTiltProgress(0);
      return;
    }

    if (currentTilt === 'center') {
      clearProgressInterval();
      setTiltProgress(0);
      return;
    }

    const selectedTilt: QuestionOption = currentTilt;
    const startTime = Date.now();
    clearProgressInterval();

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / TILT_HOLD_DURATION_MS) * 100, 100);
      setTiltProgress(progress);

      if (progress >= 100) {
        clearProgressInterval();
        handleSelection(selectedTilt);
      }
    }, 50);

    return () => {
      clearProgressInterval();
    };
  }, [clearProgressInterval, currentTilt, gameState, handleSelection]);

  const updateQuestion = (id: number, updates: Partial<Omit<Question, 'id'>>) => {
    setLessonDraft((previousLesson) => ({
      ...previousLesson,
      questions: previousLesson.questions.map((question) =>
        question.id === id ? { ...question, ...updates } : question
      )
    }));
  };

  const addQuestion = () => {
    setLessonDraft((previousLesson) => ({
      ...previousLesson,
      questions: [
        ...previousLesson.questions,
        createBlankQuestion(getNextQuestionId(previousLesson.questions))
      ]
    }));
  };

  const removeQuestion = (id: number) => {
    setLessonDraft((previousLesson) => {
      if (previousLesson.questions.length === 1) {
        return previousLesson;
      }

      return {
        ...previousLesson,
        questions: previousLesson.questions.filter((question) => question.id !== id)
      };
    });
  };

  const startGame = () => {
    const nextLesson = cloneLesson(lessonDraft);

    if (!isLessonReady(nextLesson)) {
      return;
    }

    resetRoundState();
    setActiveLesson(nextLesson);
    setStats({
      score: 0,
      totalQuestions: nextLesson.questions.length,
      currentQuestionIndex: 0
    });
    setGameState('PLAYING');
  };

  const resetGame = () => {
    resetRoundState();
    setStats({
      score: 0,
      totalQuestions: lessonDraft.questions.length,
      currentQuestionIndex: 0
    });
    setGameState('START');
  };

  const restoreDefaultLesson = () => {
    setLessonDraft(cloneLesson(DEFAULT_LESSON));
  };

  const validationMessage =
    lessonDraft.title.trim().length === 0
      ? 'Hãy đặt tên cho bài học trước khi bắt đầu.'
      : lessonDraft.questions.some((question) => question.text.trim().length === 0)
        ? 'Mỗi câu hỏi cần có nội dung.'
        : lessonDraft.questions.some(
              (question) =>
                question.leftOption.trim().length === 0 ||
                question.rightOption.trim().length === 0
            )
          ? 'Mỗi câu hỏi cần đủ hai đáp án.'
          : '';

  const canStartGame = isLessonReady(lessonDraft);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 md:px-6 md:py-10">
        <div className="space-y-3 text-center">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black uppercase italic tracking-tighter md:text-6xl"
          >
            Head Tilt <span className="text-emerald-500">Quiz</span>
          </motion.h1>
          <div className="flex flex-col items-center gap-2">
            <p className="font-mono text-sm uppercase tracking-[0.35em] text-white/60">
              Nghiêng đầu để chọn đáp án
            </p>
            {(gameState === 'PLAYING' || gameState === 'RESULT' || gameState === 'END') && (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.25em] text-emerald-200">
                <BookOpen className="h-4 w-4" />
                {activeLesson.title}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {gameState === 'START' && (
            <motion.div
              key="start"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="space-y-8 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:p-8"
            >
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/20">
                      <BookOpen className="h-7 w-7 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tight md:text-3xl">
                        Tạo bài học
                      </h2>
                      <p className="text-sm text-white/55">
                        Đặt tên bài học, thêm câu hỏi và 2 đáp án trái/phải ngay trên màn hình này.
                      </p>
                    </div>
                  </div>

                  <label className="block space-y-2">
                    <span className="font-mono text-xs uppercase tracking-[0.3em] text-white/50">
                      Tên bài học
                    </span>
                    <input
                      value={lessonDraft.title}
                      onChange={(event) =>
                        setLessonDraft((previousLesson) => ({
                          ...previousLesson,
                          title: event.target.value
                        }))
                      }
                      placeholder="Ví dụ: Toán lớp 1"
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-400/60 focus:bg-black/50"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4">
                    <Camera className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
                    <p className="text-sm text-white/70">
                      Camera đã hiển thị kiểu gương. Nghiêng trái/phải sẽ khớp với hướng người chơi.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    <p className="text-sm text-white/70">
                      Giữ tư thế nghiêng trong 1 giây để xác nhận đáp án. Cấu hình bài học được lưu tự động trong trình duyệt.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-bold">Danh sach cau hoi</h3>
                    <p className="text-sm text-white/50">
                      Mỗi câu hỏi có 2 đáp án và chọn rõ đáp án đúng.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-emerald-400"
                    >
                      <Plus className="h-4 w-4" />
                      Thêm câu hỏi
                    </button>
                    <button
                      type="button"
                      onClick={restoreDefaultLesson}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-white/10"
                    >
                      Khôi phục mẫu
                    </button>
                  </div>
                </div>

                <div className="max-h-[48rem] space-y-4 overflow-y-auto pr-1">
                  {lessonDraft.questions.map((question, index) => (
                    <div
                      key={question.id}
                      className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 font-black">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-bold">Câu hỏi {index + 1}</p>
                            <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/35">
                              Chọn đáp án đúng bằng nghiêng đầu
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeQuestion(question.id)}
                          disabled={lessonDraft.questions.length === 1}
                          className="inline-flex items-center gap-2 rounded-full border border-red-400/20 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                          Xóa câu hỏi
                        </button>
                      </div>

                      <label className="block space-y-2">
                        <span className="font-mono text-xs uppercase tracking-[0.3em] text-white/50">
                          Nội dung câu hỏi
                        </span>
                        <textarea
                          value={question.text}
                          onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                          rows={3}
                          placeholder="Nhập câu hỏi..."
                          className="w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-400/60 focus:bg-black/50"
                        />
                      </label>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="block space-y-2">
                          <span className="font-mono text-xs uppercase tracking-[0.3em] text-white/50">
                            Đáp án trái
                          </span>
                          <input
                            value={question.leftOption}
                            onChange={(event) =>
                              updateQuestion(question.id, { leftOption: event.target.value })
                            }
                            placeholder="Lựa chọn khi nghiêng trái"
                            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-400/60 focus:bg-black/50"
                          />
                        </label>

                        <label className="block space-y-2">
                          <span className="font-mono text-xs uppercase tracking-[0.3em] text-white/50">
                            Đáp án phải
                          </span>
                          <input
                            value={question.rightOption}
                            onChange={(event) =>
                              updateQuestion(question.id, { rightOption: event.target.value })
                            }
                            placeholder="Lựa chọn khi nghiêng phải"
                            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-emerald-400/60 focus:bg-black/50"
                          />
                        </label>
                      </div>

                      <div className="space-y-2">
                        <span className="font-mono text-xs uppercase tracking-[0.3em] text-white/50">
                          Đáp án đúng
                        </span>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => updateQuestion(question.id, { correctOption: 'left' })}
                            className={`rounded-2xl border px-4 py-3 text-left transition ${
                              question.correctOption === 'left'
                                ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                                : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10'
                            }`}
                          >
                            <span className="block font-mono text-xs uppercase tracking-[0.3em] opacity-70">
                              Nghiêng trái
                            </span>
                            <span className="mt-1 block font-semibold">
                              {question.leftOption.trim() || 'Chưa nhập đáp án trái'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => updateQuestion(question.id, { correctOption: 'right' })}
                            className={`rounded-2xl border px-4 py-3 text-left transition ${
                              question.correctOption === 'right'
                                ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                                : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10'
                            }`}
                          >
                            <span className="block font-mono text-xs uppercase tracking-[0.3em] opacity-70">
                              Nghiêng phải
                            </span>
                            <span className="mt-1 block font-semibold">
                              {question.rightOption.trim() || 'Chưa nhập đáp án phải'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-white/10 pt-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-white/55">
                    {lessonDraft.questions.length} câu hỏi sẵn sàng cho bài học này.
                  </div>
                  {validationMessage && (
                    <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
                      {validationMessage}
                    </div>
                  )}
                </div>

                <button
                  onClick={startGame}
                  disabled={!canStartGame}
                  className="flex items-center justify-center gap-3 rounded-full bg-emerald-500 px-12 py-4 font-black uppercase tracking-widest text-black transition-all hover:scale-[1.02] hover:bg-emerald-400 active:scale-95 disabled:bg-white/10 disabled:text-white/35 disabled:hover:bg-white/10"
                >
                  <Play className="h-5 w-5 fill-current" />
                  Bắt đầu bài học
                </button>
              </div>
            </motion.div>
          )}

          {(gameState === 'PLAYING' || gameState === 'RESULT') && currentQuestion && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
                <div className="absolute left-0 top-0 h-1 w-full bg-white/10">
                  <motion.div
                    className="h-full bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${((stats.currentQuestionIndex + 1) / stats.totalQuestions) * 100}%`
                    }}
                  />
                </div>
                <div className="mb-3 font-mono text-sm font-bold uppercase tracking-[0.3em] text-emerald-500">
                  Câu hỏi {stats.currentQuestionIndex + 1} / {stats.totalQuestions}
                </div>
                <div className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-white/45">
                  {activeLesson.title}
                </div>
                <h2 className="text-2xl font-bold leading-tight md:text-3xl">{currentQuestion.text}</h2>
              </div>

              <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-3">
                <div className="order-2 md:order-1">
                  <motion.div
                    animate={{
                      scale: currentTilt === 'left' ? 1.05 : 1,
                      backgroundColor:
                        currentTilt === 'left'
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(255, 255, 255, 0.05)',
                      borderColor:
                        currentTilt === 'left'
                          ? 'rgba(16, 185, 129, 0.5)'
                          : 'rgba(255, 255, 255, 0.1)'
                    }}
                    className="relative flex min-h-40 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 p-6 text-center transition-colors"
                  >
                    {lastResult && lastResult.option === 'left' && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        {lastResult.correct ? (
                          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                        ) : (
                          <XCircle className="h-12 w-12 text-red-500" />
                        )}
                      </div>
                    )}
                    <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                      Nghiêng trái
                    </span>
                    <span className="break-words text-lg font-black uppercase tracking-tight md:text-xl">
                      {currentQuestion.leftOption}
                    </span>

                    {currentTilt === 'left' && gameState === 'PLAYING' && (
                      <div
                        className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all"
                        style={{ width: `${tiltProgress}%` }}
                      />
                    )}
                  </motion.div>
                </div>

                <div className="order-1 md:order-2">
                  <HeadTracker onTilt={handleTilt} isActive={gameState === 'PLAYING'} />
                </div>

                <div className="order-3">
                  <motion.div
                    animate={{
                      scale: currentTilt === 'right' ? 1.05 : 1,
                      backgroundColor:
                        currentTilt === 'right'
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(255, 255, 255, 0.05)',
                      borderColor:
                        currentTilt === 'right'
                          ? 'rgba(16, 185, 129, 0.5)'
                          : 'rgba(255, 255, 255, 0.1)'
                    }}
                    className="relative flex min-h-40 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 p-6 text-center transition-colors"
                  >
                    {lastResult && lastResult.option === 'right' && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        {lastResult.correct ? (
                          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                        ) : (
                          <XCircle className="h-12 w-12 text-red-500" />
                        )}
                      </div>
                    )}
                    <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                      Nghiêng phải
                    </span>
                    <span className="break-words text-lg font-black uppercase tracking-tight md:text-xl">
                      {currentQuestion.rightOption}
                    </span>

                    {currentTilt === 'right' && gameState === 'PLAYING' && (
                      <div
                        className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all"
                        style={{ width: `${tiltProgress}%` }}
                      />
                    )}
                  </motion.div>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="flex items-center gap-4 rounded-full border border-white/10 bg-white/5 px-6 py-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <span className="font-mono font-bold">{stats.score}</span>
                  </div>
                  <div className="h-4 w-px bg-white/10" />
                  <div className="font-mono text-xs uppercase tracking-widest text-white/50">
                    Đúng {Math.round((stats.score / stats.totalQuestions) * 100)}%
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'END' && (
            <motion.div
              key="end"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8 rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl md:p-12"
            >
              <div className="space-y-3">
                <Trophy className="mx-auto h-16 w-16 text-yellow-500" />
                <h2 className="text-4xl font-black uppercase italic">Kết quả cuối cùng</h2>
                <p className="text-white/50">{activeLesson.title}</p>
              </div>

              <div className="flex flex-col justify-center gap-8 sm:flex-row sm:gap-12">
                <div className="text-center">
                  <div className="text-5xl font-black text-emerald-500">{stats.score}</div>
                  <div className="mt-2 font-mono text-xs uppercase tracking-widest text-white/40">
                    Điểm số
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-5xl font-black text-white">{stats.totalQuestions}</div>
                  <div className="mt-2 font-mono text-xs uppercase tracking-widest text-white/40">
                    Tổng câu
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={startGame}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-emerald-500 py-4 font-black uppercase tracking-widest text-black transition-all hover:bg-emerald-400"
                >
                  <RotateCcw className="h-5 w-5" />
                  Chơi lại bài học này
                </button>
                <button
                  onClick={resetGame}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-4 font-black uppercase tracking-widest text-white transition-all hover:bg-white/10"
                >
                  Quay về chỉnh sửa bài học
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
