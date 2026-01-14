import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) {
    return null;
  }

  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold text-red-600">
            汉语 Chinese Study
          </Link>

          <nav className="flex items-center gap-6">
            <Link to="/" className="text-gray-700 hover:text-red-600 transition">
              Home
            </Link>
            <Link to="/study" className="text-gray-700 hover:text-red-600 transition">
              Study
            </Link>
            <Link to="/cards" className="text-gray-700 hover:text-red-600 transition">
              Cards
            </Link>
            <Link to="/stats" className="text-gray-700 hover:text-red-600 transition">
              Stats
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition"
            >
              Logout
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
