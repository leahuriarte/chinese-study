import { useState, useEffect } from 'react';
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

export default function Study() {
  const [mode, setMode] = useState<QuizMode>('hanzi_to_pinyin');
  const [writingMode, setWritingMode] = useState<WritingMode>('stroke_order');
  const [showModeSelector, setShowModeSelector] = useState(true);
  const [selectedPart, setSelectedPart] = useState<number | null>(1);
  const [selectedLesson, setSelectedLesson] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [answeredCard, setAnsweredCard] = useState<Card | null>(null);
  const queryClient = useQueryClient();

  const filters = {
    textbookPart: selectedPart || undefined,
    lessonNumber: selectedLesson || undefined,
  };

  const { data: dueCardsData, isLoading } = useQuery({
    queryKey: ['dueCards', mode, selectedPart, selectedLesson],
    queryFn: () => api.getDueCards(mode, 20, filters),
  });

  const { data: newCards } = useQuery({
    queryKey: ['newCards', mode, selectedPart, selectedLesson],
    queryFn: () => api.getNewCards(mode, 5, filters),
  });

  const reviewMutation = useMutation({
    mutationFn: (data: {
      cardId: string;
      mode: QuizMode;
      quality: number;
      responseTimeMs: number;
    }) => api.submitReview(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dueCards'] });
      queryClient.invalidateQueries({ queryKey: ['newCards'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  // Combine due cards and new cards
  const allCards: Card[] = [
    ...(dueCardsData?.map((d) => d.card) || []),
    ...(newCards || []),
  ];

  const currentCard = allCards[currentIndex];

  useEffect(() => {
    setStartTime(Date.now());
  }, [currentIndex]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCard) return;

    const responseTime = Date.now() - startTime;
    const correctAnswer = getCorrectAnswer(currentCard, mode);
    const correct = answer.toLowerCase().trim() === correctAnswer.trim();

    // Save the card being answered before showing results
    setAnsweredCard(currentCard);
    setWasCorrect(correct);
    setShowResult(true);

    // Submit review
    const quality = correct ? 4 : 2; // 4 = good, 2 = failed
    reviewMutation.mutate({
      cardId: currentCard.id,
      mode,
      quality,
      responseTimeMs: responseTime,
    });
  };

  const handleNext = () => {
    setAnswer('');
    setShowResult(false);
    setAnsweredCard(null);
    setCurrentIndex((prev) => prev + 1);
  };

  const handleWritingComplete = (wasCorrect: boolean) => {
    if (!currentCard) return;

    const responseTime = Date.now() - startTime;
    // Save the card being answered before showing results
    setAnsweredCard(currentCard);
    setWasCorrect(wasCorrect);
    setShowResult(true);

    // Submit review
    const quality = wasCorrect ? 4 : 2;
    reviewMutation.mutate({
      cardId: currentCard.id,
      mode,
      quality,
      responseTimeMs: responseTime,
    });
  };

  const startStudying = (selectedMode: QuizMode) => {
    setMode(selectedMode);
    setShowModeSelector(false);
    setCurrentIndex(0);
    setAnswer('');
    setShowResult(false);
  };

  const changeMode = () => {
    setShowModeSelector(true);
    setCurrentIndex(0);
    setAnswer('');
    setShowResult(false);
    setAnsweredCard(null);
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
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Select Study Mode</h2>
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

  if (!currentCard) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="bg-white/70 backdrop-blur-sm p-12 rounded-3xl shadow-lg border border-white/50">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-3 text-gray-800">All Done!</h1>
          <p className="text-lg text-gray-600 mb-8">
            You've completed all your reviews for this mode.
          </p>
          <button
            onClick={changeMode}
            className="px-8 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl hover:shadow-lg transition-all font-semibold"
          >
            Try Another Mode
          </button>
        </div>
      </div>
    );
  }

  const currentModeLabel = quizModes.find((m) => m.value === mode)?.label || mode;
  const prompt = getPrompt(currentCard, mode);
  const placeholder = getPlaceholder(mode);

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
              Change Mode
            </button>
            {(selectedPart || selectedLesson) && (
              <span className="text-sm text-gray-400">
                Part {selectedPart}{selectedLesson ? `, L${selectedLesson}` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-500">Progress</div>
          <div className="text-lg font-bold text-gray-800">
            {currentIndex + 1} / {allCards.length}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-300"
          style={{ width: `${((currentIndex) / allCards.length) * 100}%` }}
        />
      </div>

      {/* Main Card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/50 p-8">
        {!showResult ? (
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
