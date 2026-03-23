import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Trophy, Play, RotateCcw, Camera, AlertCircle } from 'lucide-react';
import HeadTracker from './components/HeadTracker';
import { QUESTIONS } from './constants';
import { GameState, GameStats, Question } from './types';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    totalQuestions: QUESTIONS.length,
    currentQuestionIndex: 0
  });
  const [currentTilt, setCurrentTilt] = useState<'left' | 'right' | 'center'>('center');
  const [tiltProgress, setTiltProgress] = useState(0); // 0 to 100
  const [lastResult, setLastResult] = useState<{ correct: boolean; option: 'left' | 'right' } | null>(null);
  
  const tiltTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentQuestion = QUESTIONS[stats.currentQuestionIndex];

  const handleTilt = useCallback((tilt: 'left' | 'right' | 'center') => {
    setCurrentTilt(tilt);
  }, []);

  useEffect(() => {
    if (gameState !== 'PLAYING') {
      setTiltProgress(0);
      if (tiltTimerRef.current) clearTimeout(tiltTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    if (currentTilt === 'center') {
      setTiltProgress(0);
      if (tiltTimerRef.current) clearTimeout(tiltTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    } else {
      // Start progress
      const startTime = Date.now();
      const duration = 1000; // 1 second hold

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        setTiltProgress(progress);
        
        if (progress >= 100) {
          clearInterval(progressIntervalRef.current!);
          handleSelection(currentTilt as 'left' | 'right');
        }
      }, 50);
    }

    return () => {
      if (tiltTimerRef.current) clearTimeout(tiltTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [currentTilt, gameState]);

  const handleSelection = (option: 'left' | 'right') => {
    const isCorrect = option === currentQuestion.correctOption;
    
    setLastResult({ correct: isCorrect, option });
    setGameState('RESULT');

    if (isCorrect) {
      setStats(prev => ({ ...prev, score: prev.score + 1 }));
    }

    // Wait 2 seconds then next question or end
    setTimeout(() => {
      if (stats.currentQuestionIndex + 1 < QUESTIONS.length) {
        setStats(prev => ({ ...prev, currentQuestionIndex: prev.currentQuestionIndex + 1 }));
        setGameState('PLAYING');
        setLastResult(null);
        setTiltProgress(0);
      } else {
        setGameState('END');
      }
    }, 2000);
  };

  const startGame = () => {
    setStats({
      score: 0,
      totalQuestions: QUESTIONS.length,
      currentQuestionIndex: 0
    });
    setGameState('PLAYING');
    setLastResult(null);
    setTiltProgress(0);
  };

  const resetGame = () => {
    setGameState('START');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col items-center justify-center p-4">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-4xl flex flex-col gap-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic"
          >
            Head Tilt <span className="text-emerald-500">Quiz</span>
          </motion.h1>
          <p className="text-white/50 text-sm font-mono tracking-widest uppercase">Nghiêng đầu để chọn đáp án</p>
        </div>

        <AnimatePresence mode="wait">
          {gameState === 'START' && (
            <motion.div 
              key="start"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-12 text-center space-y-8"
            >
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center border-2 border-emerald-500/50">
                  <Camera className="w-10 h-10 text-emerald-500" />
                </div>
              </div>
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Sẵn sàng chưa?</h2>
                <p className="text-white/60 max-w-md mx-auto">
                  Trò chơi sẽ sử dụng camera để theo dõi chuyển động đầu của bạn. Nghiêng sang trái hoặc phải để chọn đáp án tương ứng.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-lg mx-auto">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-white/70">Đảm bảo khuôn mặt của bạn nằm trong khung hình và đủ ánh sáng.</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-white/70">Giữ tư thế nghiêng trong 1 giây để xác nhận lựa chọn.</p>
                </div>
              </div>
              <button 
                onClick={startGame}
                className="group relative px-12 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto"
              >
                <Play className="w-5 h-5 fill-current" />
                Bắt đầu ngay
              </button>
            </motion.div>
          )}

          {(gameState === 'PLAYING' || gameState === 'RESULT') && (
            <motion.div 
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Question Card */}
              <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-white/10">
                  <motion.div 
                    className="h-full bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${((stats.currentQuestionIndex + 1) / stats.totalQuestions) * 100}%` }}
                  />
                </div>
                <div className="mb-4 text-emerald-500 font-mono text-sm font-bold">
                  CÂU HỎI {stats.currentQuestionIndex + 1} / {stats.totalQuestions}
                </div>
                <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                  {currentQuestion.text}
                </h2>
              </div>

              {/* Game View */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Left Option */}
                <div className="order-2 md:order-1">
                  <motion.div 
                    animate={{ 
                      scale: currentTilt === 'left' ? 1.05 : 1,
                      backgroundColor: currentTilt === 'left' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      borderColor: currentTilt === 'left' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.1)'
                    }}
                    className={`p-6 rounded-2xl border-2 text-center transition-colors relative overflow-hidden h-32 flex flex-col items-center justify-center gap-2`}
                  >
                    {lastResult && lastResult.option === 'left' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                        {lastResult.correct ? <CheckCircle2 className="w-12 h-12 text-emerald-500" /> : <XCircle className="w-12 h-12 text-red-500" />}
                      </div>
                    )}
                    <span className="text-white/40 text-[10px] uppercase font-mono tracking-widest">Nghiêng Trái</span>
                    <span className="text-xl font-black uppercase tracking-tight">{currentQuestion.leftOption}</span>
                    
                    {currentTilt === 'left' && gameState === 'PLAYING' && (
                      <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all" style={{ width: `${tiltProgress}%` }} />
                    )}
                  </motion.div>
                </div>

                {/* Camera Feed */}
                <div className="order-1 md:order-2">
                  <HeadTracker onTilt={handleTilt} isActive={gameState === 'PLAYING'} />
                </div>

                {/* Right Option */}
                <div className="order-3">
                  <motion.div 
                    animate={{ 
                      scale: currentTilt === 'right' ? 1.05 : 1,
                      backgroundColor: currentTilt === 'right' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      borderColor: currentTilt === 'right' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.1)'
                    }}
                    className={`p-6 rounded-2xl border-2 text-center transition-colors relative overflow-hidden h-32 flex flex-col items-center justify-center gap-2`}
                  >
                    {lastResult && lastResult.option === 'right' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                        {lastResult.correct ? <CheckCircle2 className="w-12 h-12 text-emerald-500" /> : <XCircle className="w-12 h-12 text-red-500" />}
                      </div>
                    )}
                    <span className="text-white/40 text-[10px] uppercase font-mono tracking-widest">Nghiêng Phải</span>
                    <span className="text-xl font-black uppercase tracking-tight">{currentQuestion.rightOption}</span>

                    {currentTilt === 'right' && gameState === 'PLAYING' && (
                      <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all" style={{ width: `${tiltProgress}%` }} />
                    )}
                  </motion.div>
                </div>
              </div>

              {/* Score Display */}
              <div className="flex justify-center">
                <div className="bg-white/5 px-6 py-2 rounded-full border border-white/10 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <span className="font-mono font-bold">{stats.score}</span>
                  </div>
                  <div className="w-px h-4 bg-white/10" />
                  <div className="text-xs text-white/50 uppercase tracking-widest font-mono">
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
              className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-12 text-center space-y-8"
            >
              <div className="space-y-2">
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
                <h2 className="text-4xl font-black uppercase italic">Kết quả cuối cùng</h2>
              </div>
              
              <div className="flex justify-center gap-12">
                <div className="text-center">
                  <div className="text-5xl font-black text-emerald-500">{stats.score}</div>
                  <div className="text-xs text-white/40 uppercase tracking-widest font-mono mt-2">Điểm số</div>
                </div>
                <div className="text-center">
                  <div className="text-5xl font-black text-white">{stats.totalQuestions}</div>
                  <div className="text-xs text-white/40 uppercase tracking-widest font-mono mt-2">Tổng câu</div>
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={startGame}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3"
                >
                  <RotateCcw className="w-5 h-5" />
                  Chơi lại
                </button>
                <button 
                  onClick={resetGame}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest rounded-xl border border-white/10 transition-all"
                >
                  Về màn hình chính
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
