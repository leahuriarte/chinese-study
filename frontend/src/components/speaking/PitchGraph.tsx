import type { PitchSample } from '../../lib/pitchDetection';

interface PitchGraphProps {
  samples: PitchSample[];
  isRecording: boolean;
}

const WIDTH = 760;
const HEIGHT = 250;
const PADDING_X = 54;
const PADDING_Y = 28;

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * fraction)));
  return sorted[index];
}

export default function PitchGraph({ samples, isRecording }: PitchGraphProps) {
  const voiced = samples.filter((sample): sample is PitchSample & { frequency: number } => sample.frequency !== null);
  const frequencies = voiced.map(sample => sample.frequency);
  const duration = Math.max(samples.at(-1)?.time ?? 1, 1);

  const lowRaw = frequencies.length > 0 ? percentile(frequencies, 0.05) : 80;
  const highRaw = frequencies.length > 0 ? percentile(frequencies, 0.95) : 300;
  const padding = Math.max(18, (highRaw - lowRaw) * 0.2);
  const low = Math.max(60, Math.floor((lowRaw - padding) / 10) * 10);
  const high = Math.min(520, Math.ceil((highRaw + padding) / 10) * 10);
  const range = Math.max(40, high - low);

  const xFor = (time: number) => PADDING_X + (time / duration) * (WIDTH - PADDING_X * 2);
  const yFor = (frequency: number) => PADDING_Y + (1 - (frequency - low) / range) * (HEIGHT - PADDING_Y * 2);

  const paths: string[] = [];
  let currentPath = '';
  samples.forEach((sample) => {
    if (sample.frequency === null || sample.frequency < low || sample.frequency > high) {
      if (currentPath) paths.push(currentPath);
      currentPath = '';
      return;
    }
    const point = `${xFor(sample.time).toFixed(1)} ${yFor(sample.frequency).toFixed(1)}`;
    currentPath += currentPath ? ` L ${point}` : `M ${point}`;
  });
  if (currentPath) paths.push(currentPath);

  const gridValues = [high, Math.round((high + low) / 2), low];

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="block w-full min-h-[210px] overflow-visible"
        role="img"
        aria-label={frequencies.length > 0 ? 'Pitch trace from your recording' : 'Empty pitch graph'}
      >
        <defs>
          <linearGradient id="pitch-line" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--color-stamp-red)" />
            <stop offset="100%" stopColor="var(--color-ink)" />
          </linearGradient>
        </defs>
        <rect x={PADDING_X} y={PADDING_Y} width={WIDTH - PADDING_X * 2} height={HEIGHT - PADDING_Y * 2} fill="color-mix(in srgb, var(--color-paper) 86%, var(--color-grid))" stroke="var(--color-border)" />
        {gridValues.map((value) => {
          const y = yFor(value);
          return (
            <g key={value}>
              <line x1={PADDING_X} x2={WIDTH - PADDING_X} y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="5 7" />
              <text x={PADDING_X - 8} y={y + 4} textAnchor="end" fill="var(--color-ink-light)" fontSize="11">{value} Hz</text>
            </g>
          );
        })}
        {paths.map((path, index) => (
          <path key={`${index}-${path.slice(0, 20)}`} d={path} fill="none" stroke="url(#pitch-line)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {frequencies.length === 0 && (
          <text x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" fill="var(--color-ink-light)" fontSize="14">
            {isRecording ? 'Listening for a steady voice…' : 'Your pitch trace will appear here'}
          </text>
        )}
        <text x={PADDING_X} y={HEIGHT - 7} fill="var(--color-ink-light)" fontSize="10">0s</text>
        <text x={WIDTH - PADDING_X} y={HEIGHT - 7} textAnchor="end" fill="var(--color-ink-light)" fontSize="10">{duration.toFixed(1)}s</text>
      </svg>
    </div>
  );
}

