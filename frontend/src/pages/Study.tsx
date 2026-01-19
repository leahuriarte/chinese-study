import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Card, QuizMode } from '../types';
import WritingQuiz from '../components/study/WritingQuiz';

const quizModes: { value: QuizMode; label: string; description: string; icon: string }[] = [
  { value: 'hanzi_to_pinyin', label: 'Hanzi → Pinyin', description: 'See character, type pinyin', icon: '拼' },
  { value: 'hanzi_to_english', label: 'Hanzi → English', description: 'See character, type meaning', icon: 'Aa' },
  { value: 'pinyin_to_hanzi', label: 'Pinyin → Hanzi', description: 'See pinyin, write character', icon: '写' },
  { value: 'pinyin_to_english', label: 'Pinyin → English', description: 'See pinyin, type meaning', icon: '译' },
  { value: 'english_to_hanzi', label: 'English → Hanzi', description: 'See meaning, write character', icon: '字' },
  { value: 'english_to_pinyin', label: 'English → Pinyin', description: 'See meaning, type pinyin', icon: '音' },
];

export type WritingMode = 'stroke_order' | 'freehand';
export type SessionType = 'srs' | 'mastery' | 'quick';

interface CardWithProgress extends Card {
  correctCount: number;
  totalAttempts: number;
}

export default function Study() {
  const [mode, setMode] = useState<QuizMode>('hanzi_to_pinyin');
  const [writingMode, setWritingMode] = useState<WritingMode>('stroke_order');
  const [sessionType, setSessionType] = useState<SessionType>('srs');
  const [showModeSelector, setShowModeSelector] = useState(true);
  const [selectedPart, setSelectedPart] = useState<number | null>(1);
  const [selectedLesson, setSelectedLesson] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [answeredCard, setAnsweredCard] = useState<Card | null>(null);
  const [wasOverridden, setWasOverridden] = useState(false);
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardQueue, setCardQueue] = useState<CardWithProgress[]>([]);
  const [masteredCards, setMasteredCards] = useState<Set<string>>(new Set());
  const [completedCards, setCompletedCards] = useState<Set<string>>(new Set());

  const filters = {
    textbookPart: selectedPart || undefined,
    lessonNumber: selectedLesson || undefined,
  };

  const { data: dueCardsData, isLoading: isLoadingDue } = useQuery({
    queryKey: ['dueCards', mode, selectedPart, selectedLesson],
    queryFn: () => api.getDueCards(mode, 20, filters),
    enabled: sessionType === 'srs',
  });

  const { data: newCards, isLoading: isLoadingNew } = useQuery({
    queryKey: ['newCards', mode, selectedPart, selectedLesson],
    queryFn: () => api.getNewCards(mode, 5, filters),
    enabled: sessionType === 'srs',
  });

  const { data: allCardsData, isLoading: isLoadingAll } = useQuery({
    queryKey: ['allCards', selectedPart, selectedLesson],
    queryFn: () => api.getCards({ ...filters, limit: 500 }),
    enabled: sessionType !== 'srs',
  });

  const reviewMutation = useMutation({
    mutationFn: (data: {
      cardId: string;
      mode: QuizMode;
      quality: number;
      responseTimeMs: number;
    }) => api.submitReview(data),
    onSuccess: () => {
      if (sessionType === 'srs') {
        queryClient.invalidateQueries({ queryKey: ['dueCards'] });
        queryClient.invalidateQueries({ queryKey: ['newCards'] });
      }
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const srsCards: Card[] = sessionType === 'srs' ? [
    ...(dueCardsData?.map((d) => d.card) || []),
    ...(newCards || []),
  ] : [];

  const isLoading = sessionType === 'srs'
    ? (isLoadingDue || isLoadingNew)
    : isLoadingAll;

  const getCurrentCard = useCallback((): Card | null => {
    if (sessionType === 'srs') {
      return srsCards[currentIndex] || null;
    } else {
      return cardQueue[0] || null;
    }
  }, [sessionType, srsCards, currentIndex, cardQueue]);

  const currentCard = getCurrentCard();

  useEffect(() => {
    if (sessionType !== 'srs' && allCardsData?.cards && cardQueue.length === 0 && !showModeSelector) {
      const shuffled = [...allCardsData.cards]
        .sort(() => Math.random() - 0.5)
        .map(card => ({ ...card, correctCount: 0, totalAttempts: 0 }));
      setCardQueue(shuffled);
    }
  }, [sessionType, allCardsData, cardQueue.length, showModeSelector]);

  useEffect(() => {
    setStartTime(Date.now());
  }, [currentCard?.id]);

  const getCorrectAnswer = (card: Card, quizMode: QuizMode): string => {
    switch (quizMode) {
      case 'hanzi_to_pinyin':
      case 'english_to_pinyin':
        return card.pinyin.toLowerCase();
      case 'hanzi_to_english':
      case 'pinyin_to_english':
        return card.english.toLowerCase();
      case 'pinyin_to_hanzi':
      case 'english_to_hanzi':
        return card.hanzi;
      default:
        return '';
    }
  };

  const getPrompt = (card: Card, quizMode: QuizMode): string => {
    switch (quizMode) {
      case 'hanzi_to_pinyin':
      case 'hanzi_to_english':
        return card.hanzi;
      case 'pinyin_to_hanzi':
      case 'pinyin_to_english':
        return card.pinyinDisplay;
      case 'english_to_hanzi':
      case 'english_to_pinyin':
        return card.english;
      default:
        return '';
    }
  };

  const getPlaceholder = (quizMode: QuizMode): string => {
    switch (quizMode) {
      case 'hanzi_to_pinyin':
      case 'english_to_pinyin':
        return 'Type pinyin (e.g., ni3 hao3)';
      case 'hanzi_to_english':
      case 'pinyin_to_english':
        return 'Type the meaning in English';
      case 'pinyin_to_hanzi':
      case 'english_to_hanzi':
        return 'Type the character';
      default:
        return '';
    }
  };

  const checkAnswerSmart = (userAnswer: string, correctAnswer: string, quizMode: QuizMode): boolean => {
    const normalizedUser = userAnswer.toLowerCase().trim();
    const normalizedCorrect = correctAnswer.toLowerCase().trim();

    if (normalizedUser === normalizedCorrect) {
      return true;
    }

    if (quizMode === 'hanzi_to_english' || quizMode === 'pinyin_to_english') {
      const parts = normalizedCorrect.split(/[;,\/]/).map(p => p.trim()).filter(p => p.length > 0);

      for (const part of parts) {
        if (normalizedUser === part) {
          return true;
        }
        if (part === normalizedUser) {
          return true;
        }
      }

      for (const part of parts) {
        const partWords = part.split(/\s+/).filter(w => w.length > 2);
        const userWords = normalizedUser.split(/\s+/);
        if (partWords.length > 0 && partWords.every(pw => userWords.some(uw => uw === pw || uw.includes(pw)))) {
          return true;
        }
      }
    }

    return false;
  };

  const processAnswer = (correct: boolean) => {
    if (!currentCard) return;

    const responseTime = Date.now() - startTime;
    setAnsweredCard(currentCard);
    setWasCorrect(correct);
    setShowResult(true);

    if (sessionType === 'srs') {
      const quality = correct ? 4 : 2;
      reviewMutation.mutate({
        cardId: currentCard.id,
        mode,
        quality,
        responseTimeMs: responseTime,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCard) return;

    const correctAnswer = getCorrectAnswer(currentCard, mode);
    const correct = checkAnswerSmart(answer, correctAnswer, mode);
    processAnswer(correct);
  };

  const handleWritingComplete = (correct: boolean) => {
    processAnswer(correct);
  };

  const handleOverrideCorrect = () => {
    if (!answeredCard) return;

    setWasCorrect(true);
    setWasOverridden(true);

    if (sessionType === 'srs') {
      const responseTime = Date.now() - startTime;
      reviewMutation.mutate({
        cardId: answeredCard.id,
        mode,
        quality: 4,
        responseTimeMs: responseTime,
      });
    }
  };

  const handleNext = () => {
    if (!currentCard) return;

    setAnswer('');
    setShowResult(false);
    setAnsweredCard(null);
    setWasOverridden(false);

    if (sessionType === 'srs') {
      setCurrentIndex((prev) => prev + 1);
    } else if (sessionType === 'quick') {
      setCompletedCards(prev => new Set(prev).add(currentCard.id));
      setCardQueue(prev => prev.slice(1));
    } else if (sessionType === 'mastery') {
      const currentCardWithProgress = cardQueue[0];

      if (wasCorrect) {
        const newCorrectCount = currentCardWithProgress.correctCount + 1;

        if (newCorrectCount >= 3) {
          setMasteredCards(prev => new Set(prev).add(currentCard.id));
          setCardQueue(prev => prev.slice(1));
        } else {
          const minPosition = newCorrectCount === 1 ? 3 : 6;
          const maxPosition = newCorrectCount === 1 ? 5 : 10;
          const position = Math.min(
            minPosition + Math.floor(Math.random() * (maxPosition - minPosition + 1)),
            cardQueue.length - 1
          );

          setCardQueue(prev => {
            const updated = { ...prev[0], correctCount: newCorrectCount, totalAttempts: prev[0].totalAttempts + 1 };
            const rest = prev.slice(1);
            const newQueue = [...rest];
            newQueue.splice(Math.max(0, position - 1), 0, updated);
            return newQueue;
          });
        }
      } else {
        const position = 1 + Math.floor(Math.random() * 2);
        setCardQueue(prev => {
          const updated = { ...prev[0], correctCount: 0, totalAttempts: prev[0].totalAttempts + 1 };
          const rest = prev.slice(1);
          const newQueue = [...rest];
          newQueue.splice(Math.min(position, newQueue.length), 0, updated);
          return newQueue;
        });
      }
    }
  };

  const startStudying = (selectedMode: QuizMode) => {
    setMode(selectedMode);
    setShowModeSelector(false);
    setCurrentIndex(0);
    setAnswer('');
    setShowResult(false);
    setWasOverridden(false);
    setCardQueue([]);
    setMasteredCards(new Set());
    setCompletedCards(new Set());
  };

  const changeMode = () => {
    setShowModeSelector(true);
    setCurrentIndex(0);
    setAnswer('');
    setShowResult(false);
    setAnsweredCard(null);
    setWasOverridden(false);
    setCardQueue([]);
    setMasteredCards(new Set());
    setCompletedCards(new Set());
  };

  const getProgress = () => {
    if (sessionType === 'srs') {
      return { current: currentIndex, total: srsCards.length };
    } else if (sessionType === 'quick') {
      const total = (allCardsData?.cards?.length || 0);
      return { current: completedCards.size, total };
    } else {
      const total = (allCardsData?.cards?.length || 0);
      return { current: masteredCards.size, total };
    }
  };

  const progress = getProgress();

  const isSessionComplete = () => {
    if (sessionType === 'srs') {
      return currentIndex >= srsCards.length && srsCards.length > 0;
    } else {
      return cardQueue.length === 0 && (masteredCards.size > 0 || completedCards.size > 0);
    }
  };

  // Mode Selector Screen
  if (showModeSelector) {
    return (
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <div className="inline-block mb-4">
            <span className="field-label">Study</span>
          </div>
          <h1 className="font-display text-4xl font-bold text-ink mb-2">
            Study Mode
          </h1>
          <p className="text-ink-light text-sm">Choose how you want to practice today</p>
        </div>

        {/* Session Type Selection */}
        <div className="document-card p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="field-label">Session Type</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SessionTypeButton
              active={sessionType === 'srs'}
              onClick={() => setSessionType('srs')}
              icon="脑"
              title="Spaced Repetition"
              description="Review due cards with SRS algorithm"
            />
            <SessionTypeButton
              active={sessionType === 'mastery'}
              onClick={() => setSessionType('mastery')}
              icon="精"
              title="Mastery Mode"
              description="Get each card right 3x with smart spacing"
            />
            <SessionTypeButton
              active={sessionType === 'quick'}
              onClick={() => setSessionType('quick')}
              icon="快"
              title="Quick Review"
              description="Go through all cards once"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="document-card p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="field-label">Filter by Textbook</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs tracking-wider uppercase text-ink-light min-w-[50px]">Part:</span>
              <FilterButton active={selectedPart === null} onClick={() => { setSelectedPart(null); setSelectedLesson(null); }}>
                All Parts
              </FilterButton>
              <FilterButton active={selectedPart === 1} onClick={() => { setSelectedPart(1); setSelectedLesson(null); }}>
                Part 1
              </FilterButton>
            </div>

            {selectedPart === 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs tracking-wider uppercase text-ink-light min-w-[50px]">Lesson:</span>
                <FilterButton active={selectedLesson === null} onClick={() => setSelectedLesson(null)}>
                  All
                </FilterButton>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lesson) => (
                  <FilterButton
                    key={lesson}
                    active={selectedLesson === lesson}
                    onClick={() => setSelectedLesson(lesson)}
                  >
                    {lesson}
                  </FilterButton>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Writing Mode Selection */}
        <div className="document-card p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="field-label">Writing Mode</span>
            <div className="flex-1 border-t border-dashed border-border" />
            <span className="text-xs text-ink-light">For character writing practice</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <WritingModeButton
              active={writingMode === 'stroke_order'}
              onClick={() => setWritingMode('stroke_order')}
              icon="笔"
              title="Stroke Order"
              description="Guided practice with stroke validation"
            />
            <WritingModeButton
              active={writingMode === 'freehand'}
              onClick={() => setWritingMode('freehand')}
              icon="画"
              title="Freehand"
              description="Draw freely and self-assess"
            />
          </div>
        </div>

        {/* Quiz Mode Cards */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="field-label">Select Quiz Type</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizModes.map((quizMode) => (
              <button
                key={quizMode.value}
                onClick={() => startStudying(quizMode.value)}
                className="group document-card p-5 text-left hover:shadow-document-hover transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 border-2 border-stamp-red flex items-center justify-center text-stamp-red font-chinese text-xl font-bold shrink-0">
                    {quizMode.icon}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-ink group-hover:text-stamp-red transition-colors">
                      {quizMode.label}
                    </h3>
                    <p className="text-xs text-ink-light mt-1">{quizMode.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-6">
          <div className="seal-stamp animate-stamp-press">
            <span className="font-chinese">学</span>
          </div>
          <div className="text-ink-light text-sm tracking-widest uppercase">Loading cards...</div>
        </div>
      </div>
    );
  }

  // Session Complete State
  if (isSessionComplete() || (!currentCard && !isLoading)) {
    const sessionLabel = sessionType === 'srs' ? 'Spaced Repetition' : sessionType === 'mastery' ? 'Mastery' : 'Quick Review';
    return (
      <div className="max-w-2xl mx-auto px-4 pt-12">
        <div className="document-card p-12 text-center">
          <div className="seal-stamp mx-auto mb-8 animate-stamp-press bg-green-50 border-green-600 text-green-600">
            <span className="font-chinese">成</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-ink mb-4">
            {sessionType === 'mastery' ? 'All Cards Mastered!' : 'All Done!'}
          </h1>
          <p className="text-ink-light mb-2">
            {sessionType === 'srs' && "You've completed all your due reviews."}
            {sessionType === 'mastery' && `You got all ${masteredCards.size} cards correct 3 times each!`}
            {sessionType === 'quick' && `You reviewed all ${completedCards.size} cards.`}
          </p>
          <p className="text-xs text-ink-light tracking-wider uppercase mb-8">
            Session: {sessionLabel}
          </p>
          <button
            onClick={changeMode}
            className="vintage-btn vintage-btn-primary"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  const currentModeLabel = quizModes.find((m) => m.value === mode)?.label || mode;
  const prompt = currentCard ? getPrompt(currentCard, mode) : '';
  const placeholder = getPlaceholder(mode);
  const sessionLabel = sessionType === 'srs' ? 'SRS' : sessionType === 'mastery' ? 'Mastery' : 'Quick';

  const currentCardProgress = sessionType === 'mastery' && cardQueue[0]
    ? cardQueue[0]
    : null;

  // Main Study Interface
  return (
    <div className="max-w-2xl mx-auto px-4 pt-8">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{currentModeLabel}</h1>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={changeMode}
              className="text-xs tracking-wider uppercase text-ink-light hover:text-stamp-red transition flex items-center gap-1"
            >
              ← Back
            </button>
            <span className="text-xs px-2 py-1 border border-stamp-red text-stamp-red tracking-wider uppercase">
              {sessionLabel}
            </span>
            {(selectedPart || selectedLesson) && (
              <span className="text-xs text-ink-light">
                Part {selectedPart}{selectedLesson ? `, L${selectedLesson}` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs tracking-wider uppercase text-ink-light">
            {sessionType === 'mastery' ? 'Mastered' : 'Progress'}
          </div>
          <div className="font-display text-2xl font-bold text-ink">
            {progress.current} / {progress.total}
          </div>
          {sessionType === 'mastery' && currentCardProgress && (
            <div className="flex gap-1 justify-end mt-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`w-2 h-2 ${
                    i < currentCardProgress.correctCount
                      ? 'bg-green-600'
                      : 'bg-border'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-border mb-8 overflow-hidden">
        <div
          className="h-full bg-stamp-red transition-all duration-300"
          style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
        />
      </div>

      {/* Main Card */}
      <div className="document-card p-8">
        {!showResult && currentCard ? (
          mode === 'pinyin_to_hanzi' || mode === 'english_to_hanzi' ? (
            <WritingQuiz
              card={currentCard}
              prompt={prompt}
              writingMode={writingMode}
              onComplete={handleWritingComplete}
            />
          ) : (
            <>
              {/* Prompt Display */}
              <div className="text-center mb-10">
                <span className="field-label mb-4 inline-block">
                  {mode.includes('hanzi') && mode.split('_')[0] !== 'english' ? 'Character' : 'Prompt'}
                </span>
                <div className={`mt-4 ${
                  mode.includes('hanzi') && mode.split('_')[0] !== 'english'
                    ? 'text-8xl font-kaiti text-stamp-red'
                    : 'text-3xl font-display text-ink'
                }`}>
                  {prompt}
                </div>
              </div>

              {/* Answer Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs tracking-wider uppercase text-ink-light mb-2">
                    Your Answer
                  </label>
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="w-full text-xl"
                    placeholder={placeholder}
                    autoFocus
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="vintage-btn vintage-btn-primary w-full"
                >
                  Check Answer
                </button>
              </form>
            </>
          )
        ) : answeredCard ? (
          <>
            {/* Result Display */}
            <div className="text-center mb-8">
              <div className={`seal-stamp mx-auto mb-4 ${
                wasCorrect
                  ? 'border-green-600 text-green-600 bg-green-50'
                  : 'border-stamp-red text-stamp-red bg-stamp-red-light'
              }`}>
                <span className="font-chinese">{wasCorrect ? '对' : '错'}</span>
              </div>
              <div className={`font-display text-2xl font-bold ${wasCorrect ? 'text-green-600' : 'text-stamp-red'}`}>
                {wasCorrect ? 'Correct!' : 'Incorrect'}
              </div>
              {sessionType === 'mastery' && wasCorrect && currentCardProgress && (
                <div className="text-sm text-ink-light mt-2">
                  {currentCardProgress.correctCount + 1 >= 3
                    ? 'Card mastered!'
                    : `${currentCardProgress.correctCount + 1}/3 correct`}
                </div>
              )}
            </div>

            {/* Card Details */}
            <div className="space-y-4 mb-8">
              <div className="text-center py-6 bg-cream border border-border">
                <div className="text-6xl font-kaiti text-stamp-red mb-3">{answeredCard.hanzi}</div>
                <div className="text-xl text-ink-light mb-1">{answeredCard.pinyinDisplay}</div>
                <div className="text-ink">{answeredCard.english}</div>
              </div>

              {!wasCorrect && answer && (
                <div className="p-4 bg-stamp-red-light border border-stamp-red">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stamp-red-dark">Your answer:</span>
                    <span className="font-medium text-stamp-red">{answer}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-green-700">Correct answer:</span>
                    <span className="font-medium text-green-700">{getCorrectAnswer(answeredCard, mode)}</span>
                  </div>
                </div>
              )}

              {!wasCorrect && !wasOverridden && (
                <button
                  onClick={handleOverrideCorrect}
                  className="w-full py-3 bg-cream text-ink-light border border-border hover:border-ink text-xs tracking-wider uppercase transition"
                >
                  Actually, I was correct
                </button>
              )}

              {wasOverridden && (
                <div className="text-center text-sm text-green-600 py-2">
                  Updated to correct
                </div>
              )}

              {answeredCard.exampleSentence && (
                <div className="p-4 bg-cream border border-border">
                  <p className="text-xs tracking-wider uppercase text-ink-light mb-2">Example Sentence:</p>
                  <p className="text-lg font-chinese">{answeredCard.exampleSentence}</p>
                  {answeredCard.examplePinyin && (
                    <p className="text-ink-light mt-1">{answeredCard.examplePinyin}</p>
                  )}
                  {answeredCard.exampleEnglish && (
                    <p className="text-ink-light text-sm mt-1">{answeredCard.exampleEnglish}</p>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleNext}
              className="vintage-btn w-full border-ink text-ink hover:bg-ink hover:text-paper"
            >
              Next Card →
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

// Helper Components
function SessionTypeButton({
  active,
  onClick,
  icon,
  title,
  description
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative p-4 text-left transition-all border ${
        active
          ? 'bg-stamp-red border-stamp-red text-paper'
          : 'bg-paper border-border text-ink hover:border-ink'
      }`}
    >
      {active && (
        <div className="absolute top-2 right-2 w-4 h-4 border border-paper flex items-center justify-center text-xs">
          ✓
        </div>
      )}
      <div className={`text-2xl font-chinese mb-2 ${active ? 'text-paper' : 'text-stamp-red'}`}>{icon}</div>
      <div className="font-display font-semibold">{title}</div>
      <div className={`text-xs mt-1 ${active ? 'text-stamp-red-light' : 'text-ink-light'}`}>
        {description}
      </div>
    </button>
  );
}

function WritingModeButton({
  active,
  onClick,
  icon,
  title,
  description
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative p-4 text-left transition-all border ${
        active
          ? 'bg-stamp-red border-stamp-red text-paper'
          : 'bg-paper border-border text-ink hover:border-ink'
      }`}
    >
      {active && (
        <div className="absolute top-2 right-2 w-4 h-4 border border-paper flex items-center justify-center text-xs">
          ✓
        </div>
      )}
      <div className={`text-2xl font-chinese mb-2 ${active ? 'text-paper' : 'text-stamp-red'}`}>{icon}</div>
      <div className="font-display font-semibold">{title}</div>
      <div className={`text-xs mt-1 ${active ? 'text-stamp-red-light' : 'text-ink-light'}`}>
        {description}
      </div>
    </button>
  );
}

function FilterButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs tracking-wider uppercase transition-all border-2 font-medium ${
        active
          ? 'bg-stamp-red text-white border-stamp-red'
          : 'bg-paper text-ink-light border-border hover:border-stamp-red hover:text-stamp-red'
      }`}
    >
      {children}
    </button>
  );
}
