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
    return <div className="text-center">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Your Stats</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Cards</h3>
          <p className="text-4xl font-bold text-red-600">{stats?.totalCards || 0}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Reviews</h3>
          <p className="text-4xl font-bold text-red-600">{stats?.totalReviews || 0}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Cards Due Today</h3>
          <p className="text-4xl font-bold text-red-600">
            {stats?.dueCounts.reduce((sum, item) => sum + item.count, 0) || 0}
          </p>
        </div>
      </div>

      {stats?.dueCounts && stats.dueCounts.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-bold mb-4">Due Cards by Mode</h2>
          <div className="space-y-3">
            {stats.dueCounts.map((item) => (
              <div key={item.mode} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="text-gray-700 font-medium">
                  {item.mode
                    .replace(/_/g, ' → ')
                    .split(' ')
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')}
                </span>
                <span className="text-xl font-semibold text-red-600">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {heatmap && Object.keys(heatmap).length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4">Activity (Last 30 Days)</h2>
          <div className="space-y-2">
            {Object.entries(heatmap)
              .sort(([a], [b]) => b.localeCompare(a))
              .slice(0, 10)
              .map(([date, data]) => (
                <div key={date} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="text-gray-700">{new Date(date).toLocaleDateString()}</span>
                  <div className="flex gap-4">
                    <span className="text-gray-600">
                      {data.total} reviews
                    </span>
                    <span className="text-green-600 font-semibold">
                      {data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0}% correct
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {stats?.recentSessions && stats.recentSessions.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md mt-8">
          <h2 className="text-2xl font-bold mb-4">Recent Study Sessions</h2>
          <div className="space-y-2">
            {stats.recentSessions.map((session) => (
              <div key={session.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <span className="text-gray-700 font-medium">
                    {session.mode.replace(/_/g, ' → ')}
                  </span>
                  <span className="text-gray-500 text-sm ml-2">
                    {new Date(session.startedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="text-gray-600">{session.cardsReviewed} cards</span>
                  <span className="text-green-600 font-semibold">
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
    </div>
  );
}
