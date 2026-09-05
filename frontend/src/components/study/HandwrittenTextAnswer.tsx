import { useCallback, useEffect, useRef, useState } from 'react';
import { getStroke } from 'perfect-freehand';
import type { StrokeOptions } from 'perfect-freehand';

type AnswerLanguage = 'english' | 'pinyin';

interface HandwrittenTextAnswerProps {
  answerLanguage: AnswerLanguage;
  correctAnswer: string;
  onRecognizedSubmit: (answer: string) => void;
  onManualGrade: (wasCorrect: boolean) => void;
}

type DrawingPoint = [x: number, y: number, pressure: number, time: number];
type CanvasStroke = DrawingPoint[];

interface BrowserHandwritingPoint {
  x: number;
  y: number;
  t?: number;
}

interface BrowserHandwritingStroke {
  addPoint: (point: BrowserHandwritingPoint) => void;
}

interface BrowserHandwritingDrawing {
  addStroke: (stroke: BrowserHandwritingStroke) => void;
  getPrediction: () => Promise<Array<{ text: string }>>;
  clear?: () => void;
}

interface BrowserHandwritingRecognizer {
  startDrawing: (hints?: {
    recognitionType?: 'text' | 'email' | 'number' | 'per-character';
    inputType?: 'mouse' | 'touch' | 'stylus';
    alternatives?: number;
    graphemeSet?: string[];
  }) => BrowserHandwritingDrawing;
  finish?: () => void;
}

interface BrowserHandwritingSupport {
  textAlternatives?: boolean;
  textSegmentation?: boolean;
}

interface BrowserHandwritingNavigator extends Navigator {
  createHandwritingRecognizer?: (constraints: { languages: string[] }) => Promise<BrowserHandwritingRecognizer>;
  queryHandwritingRecognizer?: (constraints: { languages: string[] }) => Promise<BrowserHandwritingSupport | null>;
  queryHandwritingRecognizerSupport?: (constraints: { languages: string[] }) => Promise<BrowserHandwritingSupport | null>;
}

const CANVAS_WIDTH = 460;
const CANVAS_HEIGHT = 180;

function getThemeColor(property: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  return value || fallback;
}

function getCanvasContext(canvas: HTMLCanvasElement) {
  return canvas.getContext('2d', { alpha: false });
}

function getPointerPressure(e: PointerEvent) {
  return e.pressure > 0 ? e.pressure : 0.45;
}

function getCanvasPoint(e: PointerEvent, rect: DOMRect): DrawingPoint {
  const x = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
  const y = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
  return [x, y, getPointerPressure(e), Date.now()];
}

function getCoalescedPointerEvents(e: React.PointerEvent<HTMLCanvasElement>) {
  return typeof e.nativeEvent.getCoalescedEvents === 'function'
    ? e.nativeEvent.getCoalescedEvents()
    : [e.nativeEvent];
}

function paintCanvasBackground(ctx: CanvasRenderingContext2D) {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = getThemeColor('--color-paper', '#f8fbff');
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.strokeStyle = getThemeColor('--color-grid', '#e2edfc');
  ctx.lineWidth = 1;
  [52, 100, 148].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.lineTo(CANVAS_WIDTH - 18, y);
    ctx.stroke();
  });

  ctx.strokeStyle = getThemeColor('--color-border', '#afd0f8');
  ctx.strokeRect(0.5, 0.5, CANVAS_WIDTH - 1, CANVAS_HEIGHT - 1);
}

function drawStroke(ctx: CanvasRenderingContext2D, points: CanvasStroke, penSize: number) {
  if (points.length === 0) return;

  ctx.fillStyle = getThemeColor('--color-stamp-red', '#1d4ed8');

  if (points.length < 2) {
    const [x, y, pressure] = points[0];
    const width = penSize * (0.9 + pressure);
    ctx.beginPath();
    ctx.arc(x, y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const options: StrokeOptions = {
    size: penSize * 2,
    thinning: 0.48,
    smoothing: 0.62,
    streamline: 0.45,
    simulatePressure: false,
    last: true,
    start: { cap: true },
    end: { cap: true },
  };
  const outline = getStroke(points.map(([x, y, pressure]) => [x, y, pressure]), options);

  if (outline.length < 2) return;

  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.moveTo(outline[0][0], outline[0][1]);
  for (let index = 1; index < outline.length; index += 1) {
    ctx.lineTo(outline[index][0], outline[index][1]);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function buildGraphemeSet(answerLanguage: AnswerLanguage) {
  const english = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ';
  const pinyinToneMarks = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüÜ';
  return Array.from(new Set(`${english}0123456789' -${answerLanguage === 'pinyin' ? pinyinToneMarks : ''}`.split('')));
}

export default function HandwrittenTextAnswer({
  answerLanguage,
  correctAnswer,
  onRecognizedSubmit,
  onManualGrade,
}: HandwrittenTextAnswerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const completedStrokesRef = useRef<CanvasStroke[]>([]);
  const activeStrokeRef = useRef<CanvasStroke | null>(null);
  const pendingPointsRef = useRef<DrawingPoint[]>([]);
  const lastPointerTypeRef = useRef<'mouse' | 'touch' | 'stylus'>('stylus');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [penSize, setPenSizeState] = useState(() => {
    const saved = localStorage.getItem('handwritten-answer-pen-size');
    return saved ? parseInt(saved, 10) : 6;
  });
  const [recognizedText, setRecognizedText] = useState('');
  const [recognitionStatus, setRecognitionStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [showManualGrade, setShowManualGrade] = useState(false);

  const setPenSize = (size: number) => {
    setPenSizeState(size);
    localStorage.setItem('handwritten-answer-pen-size', size.toString());
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas ? getCanvasContext(canvas) : null;
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== CANVAS_WIDTH * dpr || canvas.height !== CANVAS_HEIGHT * dpr) {
      canvas.width = CANVAS_WIDTH * dpr;
      canvas.height = CANVAS_HEIGHT * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintCanvasBackground(ctx);
    completedStrokesRef.current.forEach((stroke) => drawStroke(ctx, stroke, penSize));
    if (activeStrokeRef.current) {
      drawStroke(ctx, activeStrokeRef.current, penSize);
    }
  }, [penSize]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  useEffect(() => {
    const handleThemeChange = () => renderCanvas();
    window.addEventListener('app-theme-change', handleThemeChange);
    return () => window.removeEventListener('app-theme-change', handleThemeChange);
  }, [renderCanvas]);

  useEffect(() => {
    const nav = navigator as BrowserHandwritingNavigator;

    if (!nav.createHandwritingRecognizer) {
      setRecognitionStatus('unavailable');
      return;
    }

    const querySupport = nav.queryHandwritingRecognizerSupport || nav.queryHandwritingRecognizer;
    if (!querySupport) {
      setRecognitionStatus('available');
      return;
    }

    let isMounted = true;
    querySupport.call(nav, { languages: ['en'] })
      .then((support) => {
        if (isMounted) setRecognitionStatus(support ? 'available' : 'unavailable');
      })
      .catch(() => {
        if (isMounted) setRecognitionStatus('unavailable');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setRecognizedText('');
    setShowManualGrade(false);
    completedStrokesRef.current = [];
    activeStrokeRef.current = null;
    pendingPointsRef.current = [];
    setHasDrawn(false);
    renderCanvas();
  }, [answerLanguage, correctAnswer, renderCanvas]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const flushPendingPoints = useCallback(() => {
    frameRef.current = null;
    const points = pendingPointsRef.current.splice(0);
    if (activeStrokeRef.current) {
      activeStrokeRef.current.push(...points);
      renderCanvas();
    }
  }, [renderCanvas]);

  const queueDrawingPoints = useCallback((points: DrawingPoint[]) => {
    if (!isDrawingRef.current || points.length === 0) return;

    pendingPointsRef.current.push(...points);
    if (frameRef.current === null) {
      frameRef.current = window.requestAnimationFrame(flushPendingPoints);
    }
  }, [flushPendingPoints]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pointerType = ['mouse', 'touch', 'pen'].includes(e.pointerType) ? e.pointerType : 'pen';
    lastPointerTypeRef.current = pointerType === 'pen' ? 'stylus' : pointerType as 'mouse' | 'touch';
    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    setHasDrawn(true);
    setShowManualGrade(false);
    setRecognizedText('');
    pendingPointsRef.current = [];
    activeStrokeRef.current = [getCanvasPoint(e.nativeEvent, canvas.getBoundingClientRect())];
    renderCanvas();
  }, [renderCanvas]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    queueDrawingPoints(getCoalescedPointerEvents(e).map((event) => getCanvasPoint(event, rect)));
  }, [queueDrawingPoints]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (activeStrokeRef.current) {
      activeStrokeRef.current.push(...pendingPointsRef.current);
      completedStrokesRef.current.push(activeStrokeRef.current);
      activeStrokeRef.current = null;
      pendingPointsRef.current = [];
      renderCanvas();
    }

    isDrawingRef.current = false;
  }, [renderCanvas]);

  const clearDrawing = useCallback(() => {
    completedStrokesRef.current = [];
    activeStrokeRef.current = null;
    pendingPointsRef.current = [];
    setHasDrawn(false);
    setRecognizedText('');
    setShowManualGrade(false);
    renderCanvas();
  }, [renderCanvas]);

  const undoStroke = useCallback(() => {
    completedStrokesRef.current = completedStrokesRef.current.slice(0, -1);
    setHasDrawn(completedStrokesRef.current.length > 0);
    setRecognizedText('');
    setShowManualGrade(false);
    renderCanvas();
  }, [renderCanvas]);

  const recognizeDrawing = useCallback(async () => {
    if (!hasDrawn || isRecognizing) return;

    const nav = navigator as BrowserHandwritingNavigator;
    const StrokeConstructor = (window as typeof window & {
      HandwritingStroke?: new () => BrowserHandwritingStroke;
    }).HandwritingStroke;

    if (recognitionStatus !== 'available' || !nav.createHandwritingRecognizer || !StrokeConstructor) {
      setShowManualGrade(true);
      return;
    }

    setIsRecognizing(true);
    let didSubmitRecognizedAnswer = false;

    try {
      const recognizer = await nav.createHandwritingRecognizer({ languages: ['en'] });
      const drawing = recognizer.startDrawing({
        recognitionType: 'text',
        inputType: lastPointerTypeRef.current,
        alternatives: 3,
        graphemeSet: buildGraphemeSet(answerLanguage),
      });

      completedStrokesRef.current.forEach((stroke) => {
        const handwritingStroke = new StrokeConstructor();
        const startTime = stroke[0]?.[3] || Date.now();
        stroke.forEach(([x, y, , time]) => {
          handwritingStroke.addPoint({ x, y, t: Math.max(0, time - startTime) });
        });
        drawing.addStroke(handwritingStroke);
      });

      const [prediction] = await drawing.getPrediction();
      drawing.clear?.();
      recognizer.finish?.();

      const text = prediction?.text?.trim() || '';
      if (text) {
        setRecognizedText(text);
        didSubmitRecognizedAnswer = true;
        onRecognizedSubmit(text);
      } else {
        setShowManualGrade(true);
      }
    } catch {
      setRecognitionStatus('unavailable');
      setShowManualGrade(true);
    } finally {
      if (!didSubmitRecognizedAnswer) {
        setIsRecognizing(false);
      }
    }
  }, [answerLanguage, hasDrawn, isRecognizing, onRecognizedSubmit, recognitionStatus]);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <label className="block text-xs tracking-wider uppercase text-ink-light">
            Write Your Answer
          </label>
          <span className="text-[11px] tracking-wider uppercase text-ink-light">
            {recognitionStatus === 'available' ? 'Recognition available' : 'Self-check ready'}
          </span>
        </div>

        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="writing-surface touch-none cursor-crosshair w-full"
          style={{
            aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
            maxWidth: CANVAS_WIDTH,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
          draggable={false}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-light">Size:</span>
          {[4, 6, 10, 16].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setPenSize(size)}
              className={`w-8 h-8 flex items-center justify-center border-2 transition ${
                penSize === size
                  ? 'border-stamp-red'
                  : 'border-border hover:border-stamp-red'
              }`}
              title={`Pen size ${size}`}
            >
              <div
                className="rounded-full bg-stamp-red"
                style={{ width: size, height: size }}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={undoStroke}
          disabled={!hasDrawn}
          className="vintage-btn px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={clearDrawing}
          disabled={!hasDrawn}
          className="vintage-btn px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>

      {recognizedText && (
        <div className="border border-border bg-cream px-4 py-3 text-sm text-ink">
          Recognized as: <span className="font-medium text-stamp-red">{recognizedText}</span>
        </div>
      )}

      {!showManualGrade ? (
        <button
          type="button"
          onClick={() => void recognizeDrawing()}
          disabled={!hasDrawn || isRecognizing}
          className="vintage-btn vintage-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRecognizing ? 'Reading...' : recognitionStatus === 'available' ? 'Recognize & Check' : 'Compare Answer'}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="border border-border bg-cream px-4 py-3 text-sm">
            <div className="text-xs tracking-wider uppercase text-ink-light mb-1">Correct Answer</div>
            <div className="text-lg text-ink">{correctAnswer}</div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onManualGrade(true)}
              className="flex-1 py-3 bg-green-600 text-paper border-2 border-green-600 text-xs tracking-wider uppercase hover:bg-green-700 hover:border-green-700 transition"
            >
              Got It
            </button>
            <button
              type="button"
              onClick={() => onManualGrade(false)}
              className="vintage-btn vintage-btn-primary flex-1"
            >
              Missed It
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
