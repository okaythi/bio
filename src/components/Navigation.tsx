import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, User as UserIcon, X, FlaskConical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

interface NavigationProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export default function Navigation({ searchQuery, onSearchChange }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, experiments } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <nav className={`nav-container ${isScrolled ? 'scrolled' : ''}`}>
        <div className="nav-left">
          <span className="nav-logo">bio</span>
          <div className="nav-links">
            <Link to="/" className="active">Home</Link>
          </div>
        </div>
        <div className="nav-right">
          {onSearchChange !== undefined ? (
            <div className="nav-search-box">
              <Search size={18} color="rgba(255,255,255,0.7)" />
              <input 
                type="text" 
                placeholder="Search titles..." 
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="nav-search-input"
              />
              {searchQuery && (
                <button 
                  className="nav-search-clear" 
                  onClick={() => onSearchChange('')} 
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <Search className="nav-icon" />
          )}

          {/* Active Experiment Badge Indicator if active */}
          {experiments.length > 0 && (
            <div 
              title={`Active Experiments: ${experiments.join(', ')}`}
              onClick={() => setIsAuthModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(229,9,20,0.15)',
                border: '1px solid rgba(229,9,20,0.4)', borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem',
                color: '#ff6b6b', cursor: 'pointer'
              }}
            >
              <FlaskConical size={13} />
              <span>EXP ({experiments.length})</span>
            </div>
          )}

          {/* User Profile / Account Button */}
          <button 
            onClick={() => setIsAuthModalOpen(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center'
            }}
          >
            {user?.profile?.avatar_url ? (
              <img 
                src={user.profile.avatar_url} 
                alt="Profile Avatar" 
                style={{ width: 32, height: 32, borderRadius: '4px', objectFit: 'cover' }} 
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '4px', backgroundColor: user ? '#E50914' : '#333',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: '0.85rem'
              }}>
                {user ? (user.profile?.display_name?.[0] || user.email[0]).toUpperCase() : <UserIcon size={18} />}
              </div>
            )}
          </button>
        </div>
      </nav>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}
