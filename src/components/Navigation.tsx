import { useState, useEffect } from 'react';
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
      width: '32px',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(229, 9, 20, 0.15)',
      border: '1px solid rgba(229, 9, 20, 0.5)',
      borderRadius: '6px',
      boxShadow: '0 0 10px rgba(229, 9, 20, 0.3)',
      flexShrink: 0,
      cursor: 'default'
    }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#E50914" style={{ display: 'block', margin: '0 auto' }}>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2.5L3.5 6.5V12C3.5 17.25 7.15 22.1 12 23.5C16.85 22.1 20.5 17.25 20.5 12V6.5L12 2.5ZM12 6.8L13.8 10.5L17.9 11.1L14.9 14L15.6 18.1L12 16.2L8.4 18.1L9.1 14L6.1 11.1L10.2 10.5L12 6.8Z" />
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

          {user && isStaff && <StaffRedBadge />}

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
