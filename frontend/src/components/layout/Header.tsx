import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import SettingsPicker from './SettingsPicker';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) {
    return null;
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-paper border-b-2 border-ink sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-6">
        <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:min-h-16">
          {/* Logo / Brand */}
          <Link to="/" className="flex min-w-0 items-center gap-3 self-start group">
            <div className="seal-stamp w-10 h-10 text-base border-2">
              汉
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="font-display text-base sm:text-lg tracking-wide text-ink leading-tight break-words" style={{ fontStyle: 'italic' }}>
                Chinese Study Buddy
              </span>
              <span className="hidden sm:block text-[0.6rem] tracking-[0.2em] text-ink-light uppercase">
                Built 2026
              </span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-2 lg:justify-end">
            <NavLink to="/" active={isActive('/')}>
              Home
            </NavLink>
            <span className="hidden sm:inline text-border mx-1">·</span>
            <NavLink to="/study" active={isActive('/study')}>
              Study
            </NavLink>
            <span className="hidden sm:inline text-border mx-1">·</span>
            <NavLink to="/matching" active={isActive('/matching')}>
              Matching
            </NavLink>
            <span className="hidden sm:inline text-border mx-1">·</span>
            <NavLink to="/cards" active={isActive('/cards')}>
              Cards
            </NavLink>
            <span className="hidden sm:inline text-border mx-1">·</span>
            <NavLink to="/folders" active={isActive('/folders')}>
              Folders
            </NavLink>
            <span className="hidden sm:inline text-border mx-1">·</span>
            <NavLink to="/stats" active={isActive('/stats')}>
              Stats
            </NavLink>
            <div className="hidden sm:block w-px h-6 bg-border mx-2 lg:mx-4" />
            <SettingsPicker />
            <div className="hidden sm:block w-px h-6 bg-border mx-2 lg:mx-4" />
            <button
              onClick={handleLogout}
              className="px-2 py-1 text-xs tracking-wider uppercase text-ink-light hover:text-stamp-red transition-colors"
            >
              Logout
            </button>
          </nav>
        </div>
      </div>

      {/* Decorative bottom stripe */}
      <div className="h-px bg-gradient-to-r from-transparent via-stamp-red to-transparent opacity-30" />
    </header>
  );
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`px-2 sm:px-3 py-1 text-xs font-mono tracking-wider uppercase transition-all ${
        active
          ? 'text-stamp-red border-b-2 border-stamp-red'
          : 'text-ink-light hover:text-ink border-b-2 border-transparent'
      }`}
    >
      {children}
    </Link>
  );
}
