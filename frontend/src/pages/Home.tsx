import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function Home() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.getStats(),
  });

  if (isLoading) {
    return <div className="text-center">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Welcome to Chinese Study</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Cards</h3>
          <p className="text-3xl font-bold text-red-600">{stats?.totalCards || 0}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Reviews</h3>
          <p className="text-3xl font-bold text-red-600">{stats?.totalReviews || 0}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Cards Due</h3>
          <p className="text-3xl font-bold text-red-600">
            {stats?.dueCounts.reduce((sum, item) => sum + item.count, 0) || 0}
          </p>
        </div>
      </div>

      {stats?.dueCounts && stats.dueCounts.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-bold mb-4">Due Cards by Mode</h2>
          <div className="space-y-2">
            {stats.dueCounts.map((item) => (
              <div key={item.mode} className="flex justify-between items-center">
                <span className="text-gray-700">
                  {item.mode.replace(/_/g, ' → ')}
                </span>
                <span className="font-semibold text-red-600">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/study"
          className="bg-red-600 text-white p-8 rounded-lg shadow-md hover:bg-red-700 transition text-center"
        >
          <h2 className="text-2xl font-bold mb-2">Start Studying</h2>
          <p className="text-red-100">Review your cards with spaced repetition</p>
        </Link>

        <Link
          to="/cards"
          className="bg-blue-600 text-white p-8 rounded-lg shadow-md hover:bg-blue-700 transition text-center"
        >
          <h2 className="text-2xl font-bold mb-2">Manage Cards</h2>
          <p className="text-blue-100">Add, edit, and organize your vocabulary</p>
        </Link>
      </div>
    </div>
  );
}
