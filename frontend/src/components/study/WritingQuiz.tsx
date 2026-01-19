import { useEffect, useRef, useState, useCallback } from 'react';
import HanziWriter from 'hanzi-writer';
import type { Card } from '../../types';
import type { WritingMode } from '../../pages/Study';

interface WritingQuizProps {
  card: Card;
  prompt: string;
  writingMode: WritingMode;
  onComplete: (wasCorrect: boolean) => void;
}

export default function WritingQuiz({ card, prompt, writingMode, onComplete }: WritingQuizProps) {
  const writerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [writer, setWriter] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const characters = Array.from(card.hanzi);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [charMistakes, setCharMistakes] = useState<number[]>([]);

  useEffect(() => {
    setCurrentCharIndex(0);
    setCharMistakes([]);
  }, [card.hanzi]);

  useEffect(() => {
    if (writingMode !== 'stroke_order' || !writerRef.current) return;

    const currentChar = characters[currentCharIndex];
    if (!currentChar) return;

    writerRef.current.innerHTML = '';

    const newWriter = HanziWriter.create(writerRef.current, currentChar, {
      width: 300,
      height: 300,
      padding: 5,
      showOutline: showHint,
      showCharacter: false,
      highlightOnComplete: true,
      drawingWidth: 20,
      strokeColor: '#c54b3c',
      outlineColor: '#d4c8b8',
      radicalColor: '#c54b3c',
    });

    setWriter(newWriter);

    return () => {
      if (newWriter) {
        newWriter.cancelQuiz();
      }
    };
  }, [card.hanzi, showHint, writingMode, currentCharIndex, characters]);

  useEffect(() => {
    if (writingMode !== 'freehand' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 300 * dpr;
    canvas.height = 300 * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#faf6ee';
    ctx.fillRect(0, 0, 300, 300);
    ctx.strokeStyle = '#c54b3c';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = '#d4c8b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(150, 0);
    ctx.lineTo(150, 300);
    ctx.moveTo(0, 150);
    ctx.lineTo(300, 150);
    ctx.stroke();

    ctx.strokeStyle = '#c54b3c';
    ctx.lineWidth = 8;
  }, [writingMode, card.hanzi]);

  const getCanvasCoordinates = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getCanvasCoordinates]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, getCanvasCoordinates]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleCanvasTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getCanvasCoordinates]);

  const handleCanvasTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, getCanvasCoordinates]);

  const handleQuiz = () => {
    if (!writer) return;

    setIsChecking(true);

    writer.quiz({
      onComplete: (summary: any) => {
        const mistakes = summary.totalMistakes;
        const newCharMistakes = [...charMistakes, mistakes];
        setCharMistakes(newCharMistakes);

        if (currentCharIndex < characters.length - 1) {
          setTimeout(() => {
            setCurrentCharIndex(prev => prev + 1);
            setIsChecking(false);
          }, 500);
        } else {
          const totalMistakes = newCharMistakes.reduce((sum, m) => sum + m, 0);
          const wasCorrect = totalMistakes === 0;
          setTimeout(() => {
            onComplete(wasCorrect);
          }, 1000);
        }
      },
      onMistake: () => {},
    });
  };

  const handleReset = () => {
    if (writingMode === 'stroke_order') {
      if (writer) {
        writer.cancelQuiz();
        setIsChecking(false);
        setCurrentCharIndex(0);
        setCharMistakes([]);

        const currentChar = characters[0];
        if (writerRef.current && currentChar) {
          writerRef.current.innerHTML = '';
          const newWriter = HanziWriter.create(writerRef.current, currentChar, {
            width: 300,
            height: 300,
            padding: 5,
            showOutline: showHint,
            showCharacter: false,
            highlightOnComplete: true,
            drawingWidth: 20,
            strokeColor: '#c54b3c',
            outlineColor: '#d4c8b8',
            radicalColor: '#c54b3c',
          });
          setWriter(newWriter);
        }
      }
    } else {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#faf6ee';
      ctx.fillRect(0, 0, 300, 300);

      ctx.strokeStyle = '#d4c8b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(150, 0);
      ctx.lineTo(150, 300);
      ctx.moveTo(0, 150);
      ctx.lineTo(300, 150);
      ctx.stroke();

      ctx.strokeStyle = '#c54b3c';
      ctx.lineWidth = 8;

      setHasDrawn(false);
      setShowComparison(false);
    }
  };

  const handleShowAnswer = () => {
    if (writingMode === 'stroke_order') {
      if (writer) {
        writer.showCharacter();
        setTimeout(() => {
          if (currentCharIndex < characters.length - 1) {
            setCharMistakes(prev => [...prev, 1]);
            setCurrentCharIndex(prev => prev + 1);
            setIsChecking(false);
          } else {
            onComplete(false);
          }
        }, 1500);
      }
    } else {
      setShowComparison(true);
    }
  };

  const handleFreehandCorrect = () => {
    onComplete(true);
  };

  const handleFreehandIncorrect = () => {
    onComplete(false);
  };

  if (writingMode === 'freehand') {
    return (
      <div className="flex flex-col items-center">
        <div className="text-center mb-6">
          <span className="field-label mb-4 inline-block">Prompt</span>
          <div className="text-3xl font-display text-ink mt-4">{prompt}</div>
        </div>
        <p className="text-center text-ink-light text-sm mb-6">Draw the character freely</p>

        <div className="flex gap-6 items-start">
          <div className="flex flex-col items-center">
            <canvas
              ref={canvasRef}
              width={300}
              height={300}
              className="border border-border cursor-crosshair touch-none bg-paper"
              style={{ width: 300, height: 300 }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onTouchStart={handleCanvasTouchStart}
              onTouchMove={handleCanvasTouchMove}
              onTouchEnd={handleCanvasMouseUp}
            />
            <span className="text-xs text-ink-light tracking-wider uppercase mt-2">Your drawing</span>
          </div>

          {showComparison && (
            <div className="flex flex-col items-center">
              <div
                className="border border-border flex items-center justify-center bg-paper overflow-hidden"
                style={{ width: 300, height: 300 }}
              >
                <span
                  className="leading-none font-chinese text-stamp-red"
                  style={{
                    fontSize: card.hanzi.length === 1 ? '200px' :
                              card.hanzi.length === 2 ? '120px' :
                              card.hanzi.length === 3 ? '90px' : '70px'
                  }}
                >
                  {card.hanzi}
                </span>
              </div>
              <span className="text-xs text-ink-light tracking-wider uppercase mt-2">Correct character</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 w-full max-w-md mt-6">
          {!showComparison ? (
            <>
              <button
                onClick={handleShowAnswer}
                disabled={!hasDrawn}
                className="vintage-btn vintage-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Compare with Answer
              </button>
              <button
                onClick={handleReset}
                className="vintage-btn w-full"
              >
                Clear & Restart
              </button>
            </>
          ) : (
            <>
              <p className="text-center text-ink text-sm">Did you get it right?</p>
              <div className="flex gap-3">
                <button
                  onClick={handleFreehandCorrect}
                  className="flex-1 py-3 bg-green-600 text-paper border-2 border-green-600 text-xs tracking-wider uppercase hover:bg-green-700 hover:border-green-700 transition"
                >
                  Yes, Correct
                </button>
                <button
                  onClick={handleFreehandIncorrect}
                  className="vintage-btn vintage-btn-primary flex-1"
                >
                  No, Incorrect
                </button>
              </div>
              <button
                onClick={handleReset}
                className="vintage-btn w-full"
              >
                Try Again
              </button>
            </>
          )}
        </div>

        <p className="text-xs text-ink-light mt-4 text-center tracking-wider">
          Draw the character, then compare with the answer and self-assess.
        </p>
      </div>
    );
  }

  // Stroke order mode
  return (
    <div className="flex flex-col items-center">
      <div className="text-center mb-6">
        <span className="field-label mb-4 inline-block">Prompt</span>
        <div className="text-3xl font-display text-ink mt-4">{prompt}</div>
      </div>

      {/* Character progress indicator for multi-character cards */}
      {characters.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-ink-light tracking-wider uppercase">
            Character {currentCharIndex + 1} of {characters.length}:
          </span>
          <div className="flex gap-1">
            {characters.map((char, idx) => (
              <span
                key={idx}
                className={`text-xl px-2 py-1 font-chinese ${
                  idx < currentCharIndex
                    ? 'bg-green-100 text-green-600 border border-green-200'
                    : idx === currentCharIndex
                    ? 'bg-stamp-red-light text-stamp-red border border-stamp-red'
                    : 'bg-cream text-border border border-border'
                }`}
              >
                {idx < currentCharIndex ? char : idx === currentCharIndex ? char : '?'}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-ink-light text-sm mb-6">
        {characters.length > 1
          ? `Draw "${characters[currentCharIndex]}" (character ${currentCharIndex + 1}/${characters.length})`
          : 'Draw the character below'}
      </p>

      <div
        ref={writerRef}
        className="border border-border mb-6 bg-paper"
        style={{ width: 300, height: 300 }}
      />

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {!isChecking ? (
          <>
            <button
              onClick={handleQuiz}
              className="vintage-btn vintage-btn-primary w-full"
            >
              Start Writing Quiz
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setShowHint(!showHint)}
                className="vintage-btn flex-1"
              >
                {showHint ? 'Hide Outline' : 'Show Outline'}
              </button>
              <button
                onClick={handleShowAnswer}
                className="vintage-btn flex-1"
              >
                Show Answer
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={handleReset}
            className="vintage-btn w-full"
          >
            Reset
          </button>
        )}
      </div>

      <p className="text-xs text-ink-light mt-4 text-center tracking-wider">
        Draw the strokes in the correct order. The system will check your strokes automatically.
      </p>
    </div>
  );
}
