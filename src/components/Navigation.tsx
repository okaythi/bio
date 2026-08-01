import { useState, useEffect } from 'react';
import { Search, User as UserIcon, X, Crown, Sparkles } from 'lucide-react';
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

const VipBadge = ({ color, label }: { color: string; label: string }) => {
  // Extract just the tier name without the expiration part for the badge
  const shortLabel = label.split(' ')[0];
  
  return (
    <div 
      title="VIP Member" 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        backgroundColor: `${color}25`, // 15% opacity hex roughly
        border: `1px solid ${color}99`, // 60% opacity
        borderRadius: '12px',
        padding: '3px 10px',
        fontSize: '0.75rem',
        color: color,
        fontWeight: 700,
        boxShadow: `0 0 12px ${color}55`, // 35% opacity
        userSelect: 'none'
      }}
    >
      <Crown size={13} color={color} />
      <span>{shortLabel}</span>
    </div>
  );
};

export default function Navigation({ searchQuery, onSearchChange }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, experiments, isStaff, isVip, planTierLabel, planTierColor } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isBetaUser = Boolean(
    user && (
      experiments.includes('2026-07_public_beta_v1') || 
      experiments.includes('2026-07_beta_user') || 
      experiments.includes('public_beta_v1') || 
      experiments.includes('beta_user')
    )
  );

  return (
    <>
      <nav className={`nav-container ${isScrolled ? 'scrolled' : ''}`}>
        <div className="nav-left">
          <svg className="nav-logo" width="58" height="28" viewBox="0 0 58 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 4h8.5c3.8 0 6.2 1.8 6.2 5 0 2.2-1.2 3.6-3 4.2 2.2.5 3.8 2.3 3.8 4.8 0 3.6-2.8 5.6-6.8 5.6H2V4zm8 7.8c2.2 0 3.4-1 3.4-2.8 0-1.7-1.2-2.7-3.4-2.7H5.6v5.5H10zm.6 8.2c2.4 0 3.8-1.1 3.8-3 0-1.9-1.4-3-3.8-3H5.6v6h5z" fill="#E50914"/>
            <path d="M22 4h3.6v19.6H22V4z" fill="#E50914"/>
            <path d="M30 13.8c0-5.8 4.2-10.2 10-10.2s10 4.4 10 10.2-4.2 10.2-10 10.2-10-4.4-10-10.2zm16.2 0c0-3.8-2.6-6.8-6.2-6.8s-6.2 3-6.2 6.8c0 3.8 2.6 6.8 6.2 6.8s6.2-3 6.2-6.8z" fill="#E50914"/>
          </svg>
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

          {isVip && <VipBadge color={planTierColor} label={planTierLabel} />}

          {user && !isVip && (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
                border: 'none', borderRadius: '14px', padding: '4px 12px',
                color: '#000', fontSize: '0.78rem', fontWeight: 800,
                boxShadow: '0 0 10px rgba(255,215,0,0.4)', cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Sparkles size={13} color="#000" /> Upgrade VIP
            </button>
          )}

          {user && isStaff && <StaffRedBadge />}

          <button 
            onClick={() => setIsAuthModalOpen(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
              position: 'relative'
            }}
          >
            {user?.profile?.avatar_url ? (
              <img 
                src={user.profile.avatar_url} 
                alt="Profile Avatar" 
                style={{
                  width: 32, height: 32, borderRadius: '6px', objectFit: 'cover',
                  border: isVip ? `2px solid ${planTierColor}` : '1px solid rgba(255,255,255,0.2)',
                  boxShadow: isVip ? `0 0 12px ${planTierColor}88` : 'none'
                }} 
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '6px',
                backgroundColor: isVip ? '#1a1805' : (user ? '#E50914' : 'var(--card-bg)'),
                border: isVip ? `2px solid ${planTierColor}` : 'none',
                boxShadow: isVip ? `0 0 12px ${planTierColor}88` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isVip ? planTierColor : (user ? '#fff' : 'var(--foreground)'),
                fontWeight: 700, fontSize: '0.85rem'
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

