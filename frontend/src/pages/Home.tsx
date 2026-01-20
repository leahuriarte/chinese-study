import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function Home() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.getStats(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-6">
          <div className="seal-stamp animate-stamp-press">
            <span className="font-chinese">学</span>
          </div>
          <div className="text-ink-light text-sm tracking-widest uppercase">Loading...</div>
        </div>
      </div>
    );
  }

  const totalDue = stats?.dueCounts.reduce((sum, item) => sum + item.count, 0) || 0;

  return (
    <div className="max-w-5xl mx-auto px-4">
      {/* Hero Section */}
      <div className="text-center mb-16 pt-8">
        <div className="inline-block mb-6">
          <span className="field-label">Welcome</span>
        </div>
        <h1 className="display-title text-5xl md:text-7xl mb-6 text-ink">
          Chinese Study Buddy
        </h1>
        <p className="editorial-subtitle text-ink-light text-xl tracking-wide">
          你覺得中文難不難？
        </p>

        {/* Decorative stamp */}
        <div className="mt-8 flex justify-center">
          <div className="seal-stamp animate-stamp-press">
            <span className="font-chinese">汉</span>
          </div>
        </div>
      </div>

      {/* Stats Section - Ledger Style */}
      <div className="document-card p-6 mb-10">
        <div className="flex items-center gap-3 mb-6">
          <span className="field-label">Statistics</span>
          <div className="flex-1 border-t border-dashed border-border" />
          <span className="text-xs text-ink-light tracking-wider uppercase">Overview</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label="Total Cards"
            value={stats?.totalCards || 0}
            annotation="In collection"
          />
          <StatCard
            label="Total Reviews"
            value={stats?.totalReviews || 0}
            annotation="Completed"
          />
          <StatCard
            label="Cards Due"
            value={totalDue}
            annotation="Awaiting review (ignore this for now, not implemented yet)"
            highlight={totalDue > 0}
          />
        </div>
      </div>

      {/* Due Cards by Mode */}
      {stats?.dueCounts && stats.dueCounts.some(item => item.count > 0) && (
        <div className="document-card p-6 mb-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="field-label">Due by Mode (Ignore for Now)</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {stats.dueCounts.map((item) => (
              <div
                key={item.mode}
                className={`flex items-center justify-between p-4 border transition-all ${
                  item.count > 0
                    ? 'border-stamp-red bg-stamp-red-light/30'
                    : 'border-border bg-paper'
                }`}
              >
                <span className="text-xs tracking-wider uppercase text-ink-light">
                  {formatModeName(item.mode)}
                </span>
                <span className={`font-display-alt text-2xl font-semibold ${
                  item.count > 0 ? 'text-stamp-red' : 'text-border'
                }`}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <Link
          to="/study"
          className="group document-card p-8 hover:shadow-document-hover transition-all"
        >
          <div className="flex items-start justify-between mb-6">
            <span className="field-label">Action</span>
            <div className="text-stamp-red font-chinese text-4xl font-bold opacity-20 group-hover:opacity-40 transition-opacity">
              学
            </div>
          </div>

          <h2 className="display-title text-2xl text-ink mb-2">
            Start Studying
          </h2>
          <p className="text-ink-light text-sm mb-6">Review your cards and practice</p>

          {totalDue > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-stamp-red rounded-full animate-pulse" />
              <span className="text-xs tracking-wider uppercase text-stamp-red font-medium">
                {totalDue} cards due
              </span>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-dashed border-border flex items-center justify-between">
            <span className="text-xs tracking-widest uppercase text-ink-light">Begin Session</span>
            <span className="text-ink group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>

        <Link
          to="/cards"
          className="group document-card p-8 hover:shadow-document-hover transition-all"
        >
          <div className="flex items-start justify-between mb-6">
            <span className="field-label">Action</span>
            <div className="text-stamp-red font-chinese text-4xl font-bold opacity-20 group-hover:opacity-40 transition-opacity">
              卡
            </div>
          </div>

          <h2 className="display-title text-2xl text-ink mb-2">
            Manage Cards
          </h2>
          <p className="text-ink-light text-sm mb-6">Add, edit, and organize vocabulary</p>

          <div className="flex items-center gap-2">
            <span className="text-xs tracking-wider uppercase text-ink-light">
              {stats?.totalCards || 0} total cards
            </span>
          </div>

          <div className="mt-6 pt-4 border-t border-dashed border-border flex items-center justify-between">
            <span className="text-xs tracking-widest uppercase text-ink-light">View Collection</span>
            <span className="text-ink group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>
      </div>

      {/* Footer decoration */}
      <div className="flex items-center justify-center gap-4 py-8 text-border">
        <div className="w-8 h-px bg-border" />
        <span className="text-xs tracking-[0.3em] uppercase">Est. 2026</span>
        <div className="w-8 h-px bg-border" />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  annotation,
  highlight = false
}: {
  label: string;
  value: number;
  annotation: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-6 border ${highlight ? 'border-stamp-red bg-stamp-red-light/20' : 'border-border'}`}>
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs tracking-wider uppercase text-ink-light">{label}</span>
        {highlight && <span className="w-2 h-2 bg-stamp-red rounded-full animate-pulse" />}
      </div>
      <div className={`font-display-alt text-5xl font-semibold mb-2 ${highlight ? 'text-stamp-red' : 'text-ink'}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-xs text-ink-light tracking-wider">{annotation}</div>
    </div>
  );
}

function formatModeName(mode: string): string {
  return mode
    .split('_')
    .map((part, i) => i === 1 ? '→' : part.charAt(0).toUpperCase() + part.slice(1))
    .filter(part => part !== '→' || true)
    .join(' ')
    .replace(' to ', ' → ');
}
