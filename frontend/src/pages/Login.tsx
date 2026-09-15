import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-3 sm:px-4 py-8">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="seal-stamp mx-auto mb-6 animate-stamp-press">
            <span className="font-chinese">汉</span>
          </div>
          <h1 className="display-title text-4xl md:text-5xl text-ink mb-2 break-words">
            Chinese Study Buddy
          </h1>
          <p className="text-ink-light text-sm tracking-widest uppercase">
            学习中文
          </p>
        </div>

        {/* Login Form */}
        <div className="document-card p-4 sm:p-8">
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <span className="field-label">Login</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-xs tracking-wider uppercase text-ink-light mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs tracking-wider uppercase text-ink-light mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
                required
              />
            </div>

            {error && (
              <div className="p-4 bg-stamp-red-light border border-stamp-red text-stamp-red text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="vintage-btn vintage-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-dashed border-border text-center">
            <p className="text-sm text-ink-light">
              Don't have an account?{' '}
              <Link to="/register" className="text-stamp-red hover:underline">
                Register here
              </Link>
            </p>
          </div>
        </div>

        {/* Footer decoration */}
        <div className="flex flex-wrap items-center justify-center gap-4 py-8 text-border text-center">
          <div className="w-8 h-px bg-border" />
          <span className="text-xs tracking-[0.3em] uppercase">Est. 2026</span>
          <div className="w-8 h-px bg-border" />
        </div>
      </div>
    </div>
  );
}
