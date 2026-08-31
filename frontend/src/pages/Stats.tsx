import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function Stats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.getStats(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-6">
          <div className="seal-stamp animate-stamp-press">
            <span className="font-chinese">统</span>
          </div>
          <div className="text-ink-light text-sm tracking-widest uppercase">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="mb-10 pt-8">
        <div className="inline-block mb-4">
          <span className="field-label">Analytics</span>
        </div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">Your Stats</h1>
      </div>

      {/* Overview Stats */}
      <div className="document-card p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="field-label">Overview</span>
          <div className="flex-1 border-t border-dashed border-border" />
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="p-6 border border-border">
            <div className="text-xs tracking-wider uppercase text-ink-light mb-4">Total Cards</div>
            <div className="font-display-alt text-5xl font-semibold text-ink">{stats?.totalCards || 0}</div>
            <div className="text-xs text-ink-light mt-2">In your collection</div>
          </div>
        </div>
      </div>

      {/* Footer decoration */}
      <div className="flex items-center justify-center gap-4 py-8 text-border">
        <div className="w-8 h-px bg-border" />
        <span className="text-xs tracking-[0.3em] uppercase">Statistics</span>
        <div className="w-8 h-px bg-border" />
      </div>
    </div>
  );
}
