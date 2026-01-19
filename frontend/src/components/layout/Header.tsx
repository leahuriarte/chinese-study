import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

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
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="seal-stamp w-10 h-10 text-base border-2">
              汉
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold tracking-wide text-ink uppercase">
                Chinese Study
              </span>
              <span className="text-[0.6rem] tracking-[0.2em] text-ink-light uppercase">
                Since 2024
              </span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            <NavLink to="/" active={isActive('/')}>
              Home
            </NavLink>
            <span className="text-border mx-1">·</span>
            <NavLink to="/study" active={isActive('/study')}>
              Study
            </NavLink>
            <span className="text-border mx-1">·</span>
            <NavLink to="/cards" active={isActive('/cards')}>
              Cards
            </NavLink>
            <span className="text-border mx-1">·</span>
            <NavLink to="/stats" active={isActive('/stats')}>
              Stats
            </NavLink>
            <div className="w-px h-6 bg-border mx-4" />
            <button
              onClick={handleLogout}
              className="text-xs tracking-wider uppercase text-ink-light hover:text-stamp-red transition-colors"
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
      className={`px-3 py-1 text-xs font-mono tracking-wider uppercase transition-all ${
        active
          ? 'text-stamp-red border-b-2 border-stamp-red'
          : 'text-ink-light hover:text-ink border-b-2 border-transparent'
      }`}
    >
      {children}
    </Link>
  );
}
