import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

interface NavigationProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const StaffRedBadge = () => (
  <div 
    title="Bio Staff Member" 
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(229, 9, 20, 0.2)', border: '1px solid rgba(229, 9, 20, 0.7)',
      borderRadius: '50%', padding: '6px', cursor: 'default',
      boxShadow: '0 0 12px rgba(229, 9, 20, 0.4)'
    }}
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#E50914" stroke="#E50914" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polygon points="12 8 13.09 10.26 15.6 10.63 13.78 12.4 14.21 14.9 12 13.74 9.79 14.9 10.22 12.4 8.4 10.63 10.91 10.26 12 8" fill="#ffffff" stroke="none" />
    </svg>
  </div>
);

export default function Navigation({ searchQuery, onSearchChange }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, experiments, isStaff } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isBetaUser = Boolean(
    user && (experiments.includes('public_beta_v1') || experiments.includes('beta_user'))
  );

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

          {/* 1. BETA badge goes to the LEFT of the Staff red SVG */}
          {isBetaUser && (
            <div 
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(229,9,20,0.15)',
                border: '1px solid rgba(229,9,20,0.4)', borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem',
                color: '#ff6b6b', fontWeight: 600, pointerEvents: 'none', userSelect: 'none'
              }}
            >
              <span>BETA</span>
            </div>
          )}

          {/* 2. Staff Red SVG icon placed directly to the LEFT of the User Avatar PFP */}
          {user && isStaff && <StaffRedBadge />}

          {/* 3. User Profile / Account Button */}
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
