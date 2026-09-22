import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { getCharacterSetFromSettings, getDisplayHanzi } from '../lib/hanziVariants';
import { detectPitch, extractTones, type PitchSample } from '../lib/pitchDetection';
import PitchGraph from '../components/speaking/PitchGraph';
import ToneGuide from '../components/speaking/ToneGuide';

const MAX_RECORDING_MS = 10_000;
const SAMPLE_INTERVAL_MS = 45;

function shuffledIndexes(length: number): number[] {
  const indexes = Array.from({ length }, (_, index) => index);
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return indexes;
}

export default function Speaking() {
  const { user } = useAuth();
  const characterSet = getCharacterSetFromSettings(user?.settings);
  const { data, isLoading, error } = useQuery({
    queryKey: ['speakingCards'],
    queryFn: () => api.getCards({ limit: 500 }),
  });

  const cards = useMemo(() => data?.cards ?? [], [data?.cards]);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const order = useMemo(() => {
    const nextOrder = shuffledIndexes(cards.length);
    return shuffleSeed % 2 === 0 ? nextOrder : nextOrder.reverse();
  }, [cards.length, shuffleSeed]);
  const [position, setPosition] = useState(0);
  const [samples, setSamples] = useState<PitchSample[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const startedAtRef = useRef(0);
  const lastSampleAtRef = useRef(0);
  const stopRecordingRef = useRef<() => void>(() => undefined);

  const currentCard = cards[order[position] ?? 0];
  const tones = useMemo(() => extractTones(currentCard?.pinyinDisplay || currentCard?.pinyin || ''), [currentCard]);

  const releaseMicrophone = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') void audioContextRef.current.close();
    audioContextRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (!streamRef.current) return;
    setIsRecording(false);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    releaseMicrophone();
  }, [releaseMicrophone]);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  useEffect(() => () => {
    releaseMicrophone();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl, releaseMicrophone]);

  const startRecording = async () => {
    if (isRecording) return;
    setMicError(null);
    setSamples([]);
    discardRecordingRef.current = false;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Microphone recording is not supported in this browser. Try a current version of Chrome, Edge, or Safari.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const audioContext = new AudioContext();
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      startedAtRef.current = performance.now();
      lastSampleAtRef.current = 0;
      chunksRef.current = [];

      if (typeof MediaRecorder !== 'undefined') {
        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = event => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          if (chunksRef.current.length === 0 || discardRecordingRef.current) {
            discardRecordingRef.current = false;
            return;
          }
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          setAudioUrl(URL.createObjectURL(blob));
        };
        recorder.start();
      }

      setIsRecording(true);
      const buffer = new Float32Array(analyser.fftSize);

      const analyze = (now: number) => {
        const elapsed = now - startedAtRef.current;
        if (elapsed >= MAX_RECORDING_MS) {
          stopRecordingRef.current();
          return;
        }

        if (now - lastSampleAtRef.current >= SAMPLE_INTERVAL_MS) {
          analyser.getFloatTimeDomainData(buffer);
          const frequency = detectPitch(buffer, audioContext.sampleRate);
          setSamples(previous => [...previous, { time: elapsed / 1000, frequency }]);
          lastSampleAtRef.current = now;
        }
        frameRef.current = requestAnimationFrame(analyze);
      };
      frameRef.current = requestAnimationFrame(analyze);
    } catch (caughtError) {
      releaseMicrophone();
      const permissionDenied = caughtError instanceof DOMException && (caughtError.name === 'NotAllowedError' || caughtError.name === 'PermissionDeniedError');
      setMicError(permissionDenied
        ? 'Microphone access was blocked. Allow microphone access in your browser, then try again.'
        : 'I could not start the microphone. Check that another app is not using it, then try again.');
    }
  };

  const nextCard = () => {
    if (isRecording) discardRecordingRef.current = true;
    stopRecording();
    setSamples([]);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setMicError(null);
    if (position + 1 < order.length) {
      setPosition(previous => previous + 1);
    } else {
      setShuffleSeed(previous => previous + 1);
      setPosition(0);
    }
  };

  const speakExample = () => {
    if (!currentCard || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentCard.hanzi);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.72;
    window.speechSynthesis.speak(utterance);
  };

  const voicedSamples = samples.filter(sample => sample.frequency !== null);
  const pitchValues = voicedSamples.map(sample => sample.frequency as number);
  const minPitch = pitchValues.length > 0 ? Math.round(Math.min(...pitchValues)) : null;
  const maxPitch = pitchValues.length > 0 ? Math.round(Math.max(...pitchValues)) : null;
  const voicedPercent = samples.length > 0 ? Math.round((voicedSamples.length / samples.length) * 100) : 0;

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm uppercase tracking-widest text-ink-light">Loading speaking cards…</div>;
  }

  if (error || !currentCard) {
    return (
      <div className="document-card mx-auto mt-10 max-w-xl p-8 text-center">
        <h1 className="display-title mb-3 text-3xl">Speaking mode needs a card</h1>
        <p className="text-sm text-ink-light">{error ? 'The vocabulary cards could not be loaded.' : 'Add a vocabulary card first, then come back to practice its pronunciation.'}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-1 sm:px-4">
      <header className="pb-7 pt-5 text-center sm:pb-9 sm:pt-8">
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          <span className="field-label">Experimental</span>
          <span className="text-[0.65rem] uppercase tracking-[0.18em] text-ink-light">Speaking Lab</span>
        </div>
        <h1 className="display-title mb-3 text-4xl text-ink sm:text-5xl">Follow the tone</h1>
        <p className="mx-auto max-w-xl text-sm leading-6 text-ink-light">Read the pinyin aloud. We&rsquo;ll plot the pitch your microphone hears&mdash;no score, just a contour you can inspect.</p>
      </header>

      <section className="document-card mb-6 p-5 text-center sm:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-[0.65rem] uppercase tracking-wider text-ink-light">
          <span>Prompt {position + 1} / {order.length}</span>
          <span>{currentCard.english}</span>
        </div>
        <div className="font-chinese mb-2 text-4xl text-ink sm:text-5xl">{getDisplayHanzi(currentCard, characterSet)}</div>
        <div className="font-display-alt text-4xl font-semibold tracking-wide text-stamp-red sm:text-6xl">{currentCard.pinyinDisplay || currentCard.pinyin}</div>

        <div className="mx-auto mt-6 max-w-2xl border-t border-dashed border-border pt-4">
          <div className="mb-2 text-[0.65rem] uppercase tracking-[0.18em] text-ink-light">Reference shape</div>
          <ToneGuide tones={tones} />
        </div>
      </section>

      <section className="document-card mb-6 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="field-label">Your pitch</span>
          <div className="flex-1 border-t border-dashed border-border" />
          <span className={`text-[0.65rem] uppercase tracking-wider ${isRecording ? 'text-stamp-red' : 'text-ink-light'}`}>
            {isRecording ? '● recording' : samples.length > 0 ? 'recording complete' : 'ready'}
          </span>
        </div>

        <PitchGraph samples={samples} isRecording={isRecording} />

        {micError && <div role="alert" className="mb-4 border border-stamp-red bg-stamp-red-light/30 p-3 text-sm text-ink">{micError}</div>}

        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <button type="button" onClick={speakExample} className="vintage-btn" aria-label="Hear a synthesized pronunciation">
            ▷ Hear example
          </button>
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`vintage-btn ${isRecording ? '' : 'vintage-btn-primary'}`}
          >
            {isRecording ? '■ Stop recording' : '● Record myself'}
          </button>
          <button type="button" onClick={nextCard} className="vintage-btn">
            Next pinyin →
          </button>
        </div>
        <p className="mt-3 text-center text-[0.65rem] leading-5 text-ink-light">Speak naturally for up to 10 seconds. Pitch detection works best in a quiet room with headphones.</p>
      </section>

      {samples.length > 0 && !isRecording && (
        <section className="document-card mb-10 p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="field-label">Take a look</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric label="Pitch range" value={minPitch !== null && maxPitch !== null ? `${minPitch}–${maxPitch} Hz` : '—'} />
            <Metric label="Voiced signal" value={`${voicedPercent}%`} />
            <Metric label="Tone pattern" value={tones.length > 0 ? tones.join(' · ') : 'unmarked'} />
          </div>
          {audioUrl && (
            <div className="mt-5 border-t border-dashed border-border pt-5">
              <div className="mb-2 text-[0.65rem] uppercase tracking-wider text-ink-light">Listen back</div>
              <audio controls src={audioUrl} className="h-10 w-full" aria-label="Playback of your pronunciation" />
            </div>
          )}
          <p className="mt-5 text-xs leading-5 text-ink-light">Compare the direction of your line with the reference shape. The graph shows detected vocal pitch only; consonants and quiet sounds naturally leave gaps.</p>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-4 text-center">
      <div className="mb-2 text-[0.65rem] uppercase tracking-wider text-ink-light">{label}</div>
      <div className="font-display-alt text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}
