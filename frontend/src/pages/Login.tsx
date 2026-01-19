import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
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
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="seal-stamp mx-auto mb-6 animate-stamp-press">
            <span className="font-chinese">汉</span>
          </div>
          <h1 className="font-display text-4xl font-bold text-ink mb-2">
            Chinese Study
          </h1>
          <p className="text-ink-light text-sm tracking-widest uppercase">
            学习中文
          </p>
        </div>

        {/* Login Form */}
        <div className="document-card p-8">
          <div className="flex items-center gap-3 mb-8">
            <span className="field-label">Login</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-xs tracking-wider uppercase text-ink-light mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
        <div className="flex items-center justify-center gap-4 py-8 text-border">
          <div className="w-8 h-px bg-border" />
          <span className="text-xs tracking-[0.3em] uppercase">Est. 2024</span>
          <div className="w-8 h-px bg-border" />
        </div>
      </div>
    </div>
  );
}
