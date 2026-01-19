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
  const queryClient = useQueryClient();

  // For SRS mode
  const [currentIndex, setCurrentIndex] = useState(0);

  // For Mastery and Quick modes - local card queue
  const [cardQueue, setCardQueue] = useState<CardWithProgress[]>([]);
  const [masteredCards, setMasteredCards] = useState<Set<string>>(new Set());
  const [completedCards, setCompletedCards] = useState<Set<string>>(new Set());

  const filters = {
    textbookPart: selectedPart || undefined,
    lessonNumber: selectedLesson || undefined,
  };

  // SRS mode queries
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

  // All cards query for Mastery and Quick modes
  const { data: allCardsData, isLoading: isLoadingAll } = useQuery({
    queryKey: ['allCards', selectedPart, selectedLesson],
    queryFn: () => api.getCards(filters),
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

  // SRS mode cards
  const srsCards: Card[] = sessionType === 'srs' ? [
    ...(dueCardsData?.map((d) => d.card) || []),
    ...(newCards || []),
  ] : [];

  const isLoading = sessionType === 'srs'
    ? (isLoadingDue || isLoadingNew)
    : isLoadingAll;

  // Get current card based on session type
  const getCurrentCard = useCallback((): Card | null => {
    if (sessionType === 'srs') {
      return srsCards[currentIndex] || null;
    } else {
      return cardQueue[0] || null;
    }
  }, [sessionType, srsCards, currentIndex, cardQueue]);

  const currentCard = getCurrentCard();

  // Initialize card queue for Mastery/Quick modes
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

  const processAnswer = (correct: boolean) => {
    if (!currentCard) return;

    const responseTime = Date.now() - startTime;
    setAnsweredCard(currentCard);
    setWasCorrect(correct);
    setShowResult(true);

    // Only submit to SRS for SRS mode
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
    const correct = answer.toLowerCase().trim() === correctAnswer.trim();
    processAnswer(correct);
  };

  const handleWritingComplete = (correct: boolean) => {
    processAnswer(correct);
  };

  const handleNext = () => {
    if (!currentCard) return;

    setAnswer('');
    setShowResult(false);
    setAnsweredCard(null);

    if (sessionType === 'srs') {
      setCurrentIndex((prev) => prev + 1);
    } else if (sessionType === 'quick') {
      // Quick mode: just mark as completed and move on
      setCompletedCards(prev => new Set(prev).add(currentCard.id));
      setCardQueue(prev => prev.slice(1));
    } else if (sessionType === 'mastery') {
      // Mastery mode: smart reordering based on correct count
      const currentCardWithProgress = cardQueue[0];

      if (wasCorrect) {
        const newCorrectCount = currentCardWithProgress.correctCount + 1;

        if (newCorrectCount >= 3) {
          // Card mastered! Remove from queue
          setMasteredCards(prev => new Set(prev).add(currentCard.id));
          setCardQueue(prev => prev.slice(1));
        } else {
          // Reinsert card further back based on correct count
          // 1st correct: 3-5 cards back
          // 2nd correct: 6-10 cards back
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
        // Wrong answer: reset correct count and put near front (position 1-2)
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
    setCardQueue([]);
    setMasteredCards(new Set());
    setCompletedCards(new Set());
  };

  // Calculate progress
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

  // Check if session is complete
  const isSessionComplete = () => {
    if (sessionType === 'srs') {
      return currentIndex >= srsCards.length && srsCards.length > 0;
    } else {
      return cardQueue.length === 0 && (masteredCards.size > 0 || completedCards.size > 0);
    }
  };

  if (showModeSelector) {
    return (
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">
            Study Mode
          </h1>
          <p className="text-gray-600">Choose how you want to practice today</p>
        </div>

        {/* Session Type Selection */}
        <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/50 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Session Type
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setSessionType('srs')}
              className={`relative p-4 rounded-xl transition-all text-left ${
                sessionType === 'srs'
                  ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {sessionType === 'srs' && (
                <div className="absolute top-3 right-3">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className="text-2xl mb-2">🧠</div>
              <div className="font-semibold">Spaced Repetition</div>
              <div className={`text-sm ${sessionType === 'srs' ? 'text-red-100' : 'text-gray-500'}`}>
                Review due cards with SRS algorithm
              </div>
            </button>

            <button
              onClick={() => setSessionType('mastery')}
              className={`relative p-4 rounded-xl transition-all text-left ${
                sessionType === 'mastery'
                  ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {sessionType === 'mastery' && (
                <div className="absolute top-3 right-3">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className="text-2xl mb-2">🎯</div>
              <div className="font-semibold">Mastery Mode</div>
              <div className={`text-sm ${sessionType === 'mastery' ? 'text-red-100' : 'text-gray-500'}`}>
                Get each card right 3x with smart spacing
              </div>
            </button>

            <button
              onClick={() => setSessionType('quick')}
              className={`relative p-4 rounded-xl transition-all text-left ${
                sessionType === 'quick'
                  ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {sessionType === 'quick' && (
                <div className="absolute top-3 right-3">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className="text-2xl mb-2">⚡</div>
              <div className="font-semibold">Quick Review</div>
              <div className={`text-sm ${sessionType === 'quick' ? 'text-red-100' : 'text-gray-500'}`}>
                Go through all cards once
              </div>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/50 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter by Textbook
          </h2>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-600 min-w-[50px]">Part:</span>
              <button
                onClick={() => { setSelectedPart(null); setSelectedLesson(null); }}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  selectedPart === null
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All Parts
              </button>
              <button
                onClick={() => { setSelectedPart(1); setSelectedLesson(null); }}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  selectedPart === 1
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Part 1
              </button>
            </div>

            {selectedPart === 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-600 min-w-[50px]">Lesson:</span>
                <button
                  onClick={() => setSelectedLesson(null)}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    selectedLesson === null
                      ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lesson) => (
                  <button
                    key={lesson}
                    onClick={() => setSelectedLesson(lesson)}
                    className={`w-10 h-10 rounded-xl font-medium transition-all ${
                      selectedLesson === lesson
                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {lesson}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Writing Mode Selection */}
        <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/50 mb-8">
          <h2 className="text-lg font-semibold mb-2 text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Writing Mode
          </h2>
          <p className="text-sm text-gray-500 mb-4">For character writing practice modes</p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setWritingMode('stroke_order')}
              className={`relative p-4 rounded-xl transition-all text-left ${
                writingMode === 'stroke_order'
                  ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {writingMode === 'stroke_order' && (
                <div className="absolute top-3 right-3">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className="text-2xl mb-2">笔</div>
              <div className="font-semibold">Stroke Order</div>
              <div className={`text-sm ${writingMode === 'stroke_order' ? 'text-red-100' : 'text-gray-500'}`}>
                Guided practice with stroke validation
              </div>
            </button>
            <button
              onClick={() => setWritingMode('freehand')}
              className={`relative p-4 rounded-xl transition-all text-left ${
                writingMode === 'freehand'
                  ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {writingMode === 'freehand' && (
                <div className="absolute top-3 right-3">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className="text-2xl mb-2">画</div>
              <div className="font-semibold">Freehand</div>
              <div className={`text-sm ${writingMode === 'freehand' ? 'text-red-100' : 'text-gray-500'}`}>
                Draw freely and self-assess
              </div>
            </button>
          </div>
        </div>

        {/* Quiz Mode Cards */}
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Select Quiz Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizModes.map((quizMode) => (
            <button
              key={quizMode.value}
              onClick={() => startStudying(quizMode.value)}
              className="group bg-white/70 backdrop-blur-sm p-5 rounded-2xl shadow-lg border border-white/50 hover:shadow-xl hover:-translate-y-1 transition-all text-left"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
                  {quizMode.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 group-hover:text-red-600 transition-colors">
                    {quizMode.label}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{quizMode.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-red-200 rounded-full"></div>
          <div className="text-gray-500">Loading cards...</div>
        </div>
      </div>
    );
  }

  if (isSessionComplete() || (!currentCard && !isLoading)) {
    const sessionLabel = sessionType === 'srs' ? 'Spaced Repetition' : sessionType === 'mastery' ? 'Mastery' : 'Quick Review';
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="bg-white/70 backdrop-blur-sm p-12 rounded-3xl shadow-lg border border-white/50">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-3 text-gray-800">
            {sessionType === 'mastery' ? 'All Cards Mastered!' : 'All Done!'}
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            {sessionType === 'srs' && "You've completed all your due reviews."}
            {sessionType === 'mastery' && `You got all ${masteredCards.size} cards correct 3 times each!`}
            {sessionType === 'quick' && `You reviewed all ${completedCards.size} cards.`}
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Session: {sessionLabel}
          </p>
          <button
            onClick={changeMode}
            className="px-8 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl hover:shadow-lg transition-all font-semibold"
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

  // Get mastery info for current card
  const currentCardProgress = sessionType === 'mastery' && cardQueue[0]
    ? cardQueue[0]
    : null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{currentModeLabel}</h1>
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={changeMode}
              className="text-sm text-gray-500 hover:text-red-600 transition flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            <span className="text-sm px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">
              {sessionLabel}
            </span>
            {(selectedPart || selectedLesson) && (
              <span className="text-sm text-gray-400">
                Part {selectedPart}{selectedLesson ? `, L${selectedLesson}` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-500">
            {sessionType === 'mastery' ? 'Mastered' : 'Progress'}
          </div>
          <div className="text-lg font-bold text-gray-800">
            {progress.current} / {progress.total}
          </div>
          {sessionType === 'mastery' && currentCardProgress && (
            <div className="flex gap-1 justify-end mt-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < currentCardProgress.correctCount
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-300"
          style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
        />
      </div>

      {/* Main Card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 p-8">
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
              <div className={`mb-10 text-center ${mode.includes('hanzi') && mode.split('_')[0] !== 'english' ? 'text-8xl' : 'text-4xl font-medium text-gray-800'}`}>
                {prompt}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="w-full px-5 py-4 text-xl border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
                  placeholder={placeholder}
                  autoFocus
                  required
                />

                <button
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-2xl hover:shadow-lg transition-all text-lg font-semibold"
                >
                  Check Answer
                </button>
              </form>
            </>
          )
        ) : answeredCard ? (
          <>
            <div className={`text-center mb-8 ${wasCorrect ? 'text-green-500' : 'text-red-500'}`}>
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
                wasCorrect ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {wasCorrect ? (
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="text-2xl font-bold">
                {wasCorrect ? 'Correct!' : 'Incorrect'}
              </div>
              {sessionType === 'mastery' && wasCorrect && currentCardProgress && (
                <div className="text-sm text-gray-500 mt-2">
                  {currentCardProgress.correctCount + 1 >= 3
                    ? '🎉 Card mastered!'
                    : `${currentCardProgress.correctCount + 1}/3 correct`}
                </div>
              )}
            </div>

            <div className="space-y-4 mb-8">
              <div className="text-center py-6 bg-gray-50 rounded-2xl">
                <div className="text-6xl mb-3">{answeredCard.hanzi}</div>
                <div className="text-2xl text-gray-600 mb-1">{answeredCard.pinyinDisplay}</div>
                <div className="text-lg text-gray-500">{answeredCard.english}</div>
              </div>

              {!wasCorrect && answer && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-red-600">Your answer:</span>
                    <span className="font-medium text-red-700">{answer}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-green-600">Correct answer:</span>
                    <span className="font-medium text-green-700">{getCorrectAnswer(answeredCard, mode)}</span>
                  </div>
                </div>
              )}

              {answeredCard.exampleSentence && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-sm text-blue-600 mb-2 font-medium">Example Sentence:</p>
                  <p className="text-lg">{answeredCard.exampleSentence}</p>
                  {answeredCard.examplePinyin && (
                    <p className="text-gray-600 mt-1">{answeredCard.examplePinyin}</p>
                  )}
                  {answeredCard.exampleEnglish && (
                    <p className="text-gray-500 mt-1">{answeredCard.exampleEnglish}</p>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleNext}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-2xl hover:shadow-lg transition-all text-lg font-semibold"
            >
              Next Card
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
