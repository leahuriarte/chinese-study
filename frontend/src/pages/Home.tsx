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
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-red-200 rounded-full"></div>
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  const totalDue = stats?.dueCounts.reduce((sum, item) => sum + item.count, 0) || 0;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 bg-clip-text text-transparent">
          Welcome Back
        </h1>
        <p className="text-xl text-gray-600">Ready to continue your Chinese learning journey?</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard
          title="Total Cards"
          value={stats?.totalCards || 0}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
          gradient="from-blue-500 to-cyan-400"
        />

        <StatCard
          title="Total Reviews"
          value={stats?.totalReviews || 0}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          gradient="from-green-500 to-emerald-400"
        />

        <StatCard
          title="Cards Due"
          value={totalDue}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          gradient="from-red-500 to-orange-400"
          highlight={totalDue > 0}
        />
      </div>

      {/* Due Cards by Mode */}
      {stats?.dueCounts && stats.dueCounts.some(item => item.count > 0) && (
        <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-white/50 mb-10">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Due Cards by Mode</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {stats.dueCounts.map((item) => (
              <div
                key={item.mode}
                className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                  item.count > 0
                    ? 'bg-red-50 border border-red-100'
                    : 'bg-gray-50 border border-gray-100'
                }`}
              >
                <span className="text-sm text-gray-600">
                  {formatModeName(item.mode)}
                </span>
                <span className={`font-bold text-lg ${item.count > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/study"
          className="group relative overflow-hidden bg-gradient-to-br from-red-500 to-orange-500 text-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h2 className="text-2xl font-bold">Start Studying</h2>
            </div>
            <p className="text-red-100">Review your cards with spaced repetition</p>
            {totalDue > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-sm">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                {totalDue} cards due
              </div>
            )}
          </div>
        </Link>

        <Link
          to="/cards"
          className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-500 text-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h2 className="text-2xl font-bold">Manage Cards</h2>
            </div>
            <p className="text-blue-100">Add, edit, and organize your vocabulary</p>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-sm">
              {stats?.totalCards || 0} total cards
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  gradient,
  highlight = false
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  highlight?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border transition-all hover:-translate-y-1 ${
      highlight ? 'border-red-200 ring-2 ring-red-100' : 'border-white/50'
    }`}>
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${gradient} opacity-10 rounded-full -mr-8 -mt-8`}></div>
      <div className="relative">
        <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${gradient} text-white mb-4`}>
          {icon}
        </div>
        <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
        <p className={`text-4xl font-bold ${highlight ? 'text-red-600' : 'text-gray-800'}`}>
          {value.toLocaleString()}
        </p>
      </div>
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
