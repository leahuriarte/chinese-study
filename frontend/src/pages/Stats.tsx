import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function Stats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.getStats(),
  });

  const { data: heatmap } = useQuery({
    queryKey: ['heatmap'],
    queryFn: () => api.getHeatmap(30),
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
        <h1 className="font-display text-4xl font-bold text-ink">Your Stats</h1>
      </div>

      {/* Overview Stats */}
      <div className="document-card p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="field-label">Overview</span>
          <div className="flex-1 border-t border-dashed border-border" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 border border-border">
            <div className="text-xs tracking-wider uppercase text-ink-light mb-4">Total Cards</div>
            <div className="font-display text-5xl font-bold text-ink">{stats?.totalCards || 0}</div>
            <div className="text-xs text-ink-light mt-2">In your collection</div>
          </div>

          <div className="p-6 border border-border">
            <div className="text-xs tracking-wider uppercase text-ink-light mb-4">Total Reviews</div>
            <div className="font-display text-5xl font-bold text-ink">{stats?.totalReviews || 0}</div>
            <div className="text-xs text-ink-light mt-2">Completed</div>
          </div>

          <div className="p-6 border border-stamp-red bg-stamp-red-light/20">
            <div className="text-xs tracking-wider uppercase text-ink-light mb-4">Cards Due Today</div>
            <div className="font-display text-5xl font-bold text-stamp-red">
              {stats?.dueCounts.reduce((sum, item) => sum + item.count, 0) || 0}
            </div>
            <div className="text-xs text-ink-light mt-2">Awaiting review</div>
          </div>
        </div>
      </div>

      {/* Due Cards by Mode */}
      {stats?.dueCounts && stats.dueCounts.length > 0 && (
        <div className="document-card p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="field-label">Due by Mode</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <div className="space-y-2">
            {stats.dueCounts.map((item) => (
              <div key={item.mode} className="flex justify-between items-center p-4 bg-cream border border-border">
                <span className="text-sm text-ink">
                  {item.mode
                    .replace(/_/g, ' → ')
                    .split(' ')
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')}
                </span>
                <span className={`font-display text-2xl font-bold ${
                  item.count > 0 ? 'text-stamp-red' : 'text-border'
                }`}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Heatmap */}
      {heatmap && Object.keys(heatmap).length > 0 && (
        <div className="document-card p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="field-label">Recent Activity</span>
            <div className="flex-1 border-t border-dashed border-border" />
            <span className="text-xs text-ink-light">Last 30 days</span>
          </div>

          <div className="space-y-2">
            {Object.entries(heatmap)
              .sort(([a], [b]) => b.localeCompare(a))
              .slice(0, 10)
              .map(([date, data]) => (
                <div key={date} className="flex justify-between items-center p-4 bg-cream border border-border">
                  <span className="text-sm text-ink">{new Date(date).toLocaleDateString()}</span>
                  <div className="flex gap-6">
                    <span className="text-sm text-ink-light">
                      {data.total} reviews
                    </span>
                    <span className="text-sm font-medium text-green-600">
                      {data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0}% correct
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      {stats?.recentSessions && stats.recentSessions.length > 0 && (
        <div className="document-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="field-label">Recent Sessions</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <div className="space-y-2">
            {stats.recentSessions.map((session) => (
              <div key={session.id} className="flex justify-between items-center p-4 bg-cream border border-border">
                <div>
                  <span className="text-sm text-ink font-medium">
                    {session.mode.replace(/_/g, ' → ')}
                  </span>
                  <span className="text-xs text-ink-light ml-3">
                    {new Date(session.startedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-6">
                  <span className="text-sm text-ink-light">{session.cardsReviewed} cards</span>
                  <span className="text-sm font-medium text-green-600">
                    {session.cardsReviewed > 0
                      ? Math.round((session.correctCount / session.cardsReviewed) * 100)
                      : 0}% correct
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer decoration */}
      <div className="flex items-center justify-center gap-4 py-8 text-border">
        <div className="w-8 h-px bg-border" />
        <span className="text-xs tracking-[0.3em] uppercase">Statistics</span>
        <div className="w-8 h-px bg-border" />
      </div>
    </div>
  );
}
