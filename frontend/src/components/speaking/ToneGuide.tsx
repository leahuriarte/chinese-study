import { toneNames } from '../../lib/pitchDetection';

const CONTOURS: Record<number, number[]> = {
  1: [0.12, 0.12],
  2: [0.82, 0.18],
  3: [0.55, 0.88, 0.28],
  4: [0.12, 0.9],
  5: [0.52, 0.58],
};

export default function ToneGuide({ tones }: { tones: number[] }) {
  if (tones.length === 0) {
    return <p className="text-xs text-ink-light">No marked tone pattern is available for this card.</p>;
  }

  const width = 620;
  const height = 112;
  const segmentWidth = width / tones.length;
  const paths = tones.map((tone, toneIndex) => {
    const contour = CONTOURS[tone] ?? CONTOURS[5];
    const xStart = toneIndex * segmentWidth + 16;
    const availableWidth = segmentWidth - 32;
    return contour.map((value, pointIndex) => {
      const x = xStart + (pointIndex / Math.max(1, contour.length - 1)) * availableWidth;
      const y = 14 + value * 58;
      return `${pointIndex === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  });

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-h-28" role="img" aria-label={`Reference contour for tones ${tones.join(', ')}`}>
        {tones.map((tone, index) => (
          <g key={`${tone}-${index}`}>
            {index > 0 && <line x1={index * segmentWidth} x2={index * segmentWidth} y1="9" y2="82" stroke="var(--color-border)" strokeDasharray="3 5" />}
            <path d={paths[index]} fill="none" stroke="var(--color-stamp-red)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <text x={index * segmentWidth + segmentWidth / 2} y="103" textAnchor="middle" fill="var(--color-ink-light)" fontSize="11">
              {tone === 5 ? 'neutral' : `tone ${tone}`}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[0.65rem] uppercase tracking-wider text-ink-light">
        {Array.from(new Set(tones)).map(tone => <span key={tone}>{tone === 5 ? 'Neutral' : `Tone ${tone}`} · {toneNames[tone]}</span>)}
      </div>
    </div>
  );
}
