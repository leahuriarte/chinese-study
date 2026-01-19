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

  // Multi-character support for stroke order mode
  const characters = Array.from(card.hanzi);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [charMistakes, setCharMistakes] = useState<number[]>([]);

  // Reset character index when card changes
  useEffect(() => {
    setCurrentCharIndex(0);
    setCharMistakes([]);
  }, [card.hanzi]);

  // Stroke order mode setup - now handles single character at a time
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
      strokeColor: '#dc2626',
      outlineColor: '#e5e7eb',
      radicalColor: '#dc2626',
    });

    setWriter(newWriter);

    return () => {
      if (newWriter) {
        newWriter.cancelQuiz();
      }
    };
  }, [card.hanzi, showHint, writingMode, currentCharIndex, characters]);

  // Freehand mode canvas setup
  useEffect(() => {
    if (writingMode !== 'freehand' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up high DPI canvas
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 300 * dpr;
    canvas.height = 300 * dpr;
    ctx.scale(dpr, dpr);

    // Clear and set up
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 300, 300);
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(150, 0);
    ctx.lineTo(150, 300);
    ctx.moveTo(0, 150);
    ctx.lineTo(300, 150);
    ctx.stroke();

    // Reset for drawing
    ctx.strokeStyle = '#dc2626';
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

        // Check if there are more characters to write
        if (currentCharIndex < characters.length - 1) {
          // Move to next character after a brief delay
          setTimeout(() => {
            setCurrentCharIndex(prev => prev + 1);
            setIsChecking(false);
          }, 500);
        } else {
          // All characters done - check if any had mistakes
          const totalMistakes = newCharMistakes.reduce((sum, m) => sum + m, 0);
          const wasCorrect = totalMistakes === 0;
          setTimeout(() => {
            onComplete(wasCorrect);
          }, 1000);
        }
      },
      onMistake: () => {
        // Optionally show feedback on mistakes
      },
    });
  };

  const handleReset = () => {
    if (writingMode === 'stroke_order') {
      if (writer) {
        writer.cancelQuiz();
        setIsChecking(false);
        // Reset to first character
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
            strokeColor: '#dc2626',
            outlineColor: '#e5e7eb',
            radicalColor: '#dc2626',
          });
          setWriter(newWriter);
        }
      }
    } else {
      // Reset freehand canvas
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 300, 300);

      // Redraw grid
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(150, 0);
      ctx.lineTo(150, 300);
      ctx.moveTo(0, 150);
      ctx.lineTo(300, 150);
      ctx.stroke();

      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 8;

      setHasDrawn(false);
      setShowComparison(false);
    }
  };

  const handleShowAnswer = () => {
    if (writingMode === 'stroke_order') {
      if (writer) {
        writer.showCharacter();
        // If multi-character, wait then move to next or finish
        setTimeout(() => {
          if (currentCharIndex < characters.length - 1) {
            setCharMistakes(prev => [...prev, 1]); // Count as a mistake since they showed answer
            setCurrentCharIndex(prev => prev + 1);
            setIsChecking(false);
          } else {
            onComplete(false); // Showing answer counts as incorrect
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
        <div className="text-4xl mb-6 text-center">{prompt}</div>
        <p className="text-center text-gray-600 mb-6">Draw the character freely</p>

        <div className="flex gap-6 items-start">
          <div className="flex flex-col items-center">
            <canvas
              ref={canvasRef}
              width={300}
              height={300}
              className="border-2 border-gray-300 rounded-lg cursor-crosshair touch-none"
              style={{ width: 300, height: 300 }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onTouchStart={handleCanvasTouchStart}
              onTouchMove={handleCanvasTouchMove}
              onTouchEnd={handleCanvasMouseUp}
            />
            <span className="text-sm text-gray-500 mt-2">Your drawing</span>
          </div>

          {showComparison && (
            <div className="flex flex-col items-center">
              <div
                className="border-2 border-gray-300 rounded-lg flex items-center justify-center bg-white overflow-hidden"
                style={{ width: 300, height: 300 }}
              >
                <span
                  className="leading-none"
                  style={{
                    fontSize: card.hanzi.length === 1 ? '200px' :
                              card.hanzi.length === 2 ? '120px' :
                              card.hanzi.length === 3 ? '90px' : '70px'
                  }}
                >
                  {card.hanzi}
                </span>
              </div>
              <span className="text-sm text-gray-500 mt-2">Correct character</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 w-full max-w-md mt-6">
          {!showComparison ? (
            <>
              <button
                onClick={handleShowAnswer}
                disabled={!hasDrawn}
                className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Compare with Answer
              </button>
              <button
                onClick={handleReset}
                className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Clear & Restart
              </button>
            </>
          ) : (
            <>
              <p className="text-center text-gray-700 font-medium">Did you get it right?</p>
              <div className="flex gap-3">
                <button
                  onClick={handleFreehandCorrect}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-lg font-semibold"
                >
                  Yes, Correct
                </button>
                <button
                  onClick={handleFreehandIncorrect}
                  className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-lg font-semibold"
                >
                  No, Incorrect
                </button>
              </div>
              <button
                onClick={handleReset}
                className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Try Again
              </button>
            </>
          )}
        </div>

        <p className="text-sm text-gray-500 mt-4 text-center">
          Draw the character, then compare with the answer and self-assess.
        </p>
      </div>
    );
  }

  // Stroke order mode
  return (
    <div className="flex flex-col items-center">
      <div className="text-4xl mb-6 text-center">{prompt}</div>

      {/* Character progress indicator for multi-character cards */}
      {characters.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-500">Character {currentCharIndex + 1} of {characters.length}:</span>
          <div className="flex gap-1">
            {characters.map((char, idx) => (
              <span
                key={idx}
                className={`text-2xl px-2 py-1 rounded ${
                  idx < currentCharIndex
                    ? 'bg-green-100 text-green-600'
                    : idx === currentCharIndex
                    ? 'bg-red-100 text-red-600 font-bold'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {idx < currentCharIndex ? char : idx === currentCharIndex ? char : '?'}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-gray-600 mb-6">
        {characters.length > 1
          ? `Draw "${characters[currentCharIndex]}" (character ${currentCharIndex + 1}/${characters.length})`
          : 'Draw the character below'}
      </p>

      <div
        ref={writerRef}
        className="border-2 border-gray-300 rounded-lg mb-6"
        style={{ width: 300, height: 300 }}
      />

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {!isChecking ? (
          <>
            <button
              onClick={handleQuiz}
              className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-lg font-semibold"
            >
              Start Writing Quiz
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setShowHint(!showHint)}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                {showHint ? 'Hide Outline' : 'Show Outline'}
              </button>
              <button
                onClick={handleShowAnswer}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Show Answer
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={handleReset}
            className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Reset
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500 mt-4 text-center">
        Draw the strokes in the correct order. The system will check your strokes automatically.
      </p>
    </div>
  );
}
