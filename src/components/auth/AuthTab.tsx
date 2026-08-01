import React, { useState } from 'react';
import TurnstileWidget from '../TurnstileWidget';
import { useAuth } from '../../context/AuthContext';
import { Crown, Sparkles } from 'lucide-react';

interface AuthTabProps {
  user: any;
  username: string;
  userFlags: string[];
  isRegisterMode: boolean;
  setIsRegisterMode: (mode: boolean) => void;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  displayName: string;
  setDisplayName: (name: string) => void;
  loading: boolean;
  handleAuthSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  setError: (err: string | null) => void;
  logout: () => void;
  LogOutIcon: React.ElementType;
}

export default function AuthTab({
  user, username, userFlags: _userFlags, isRegisterMode, setIsRegisterMode,
  email, setEmail, password, setPassword, displayName, setDisplayName,
  loading, handleAuthSubmit, setError, logout, LogOutIcon
}: AuthTabProps) {
  const { isVip, planTierLabel, planTierColor, redeemVipCode } = useAuth();
  const [vipCode, setVipCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vipCode.trim()) return;
    setRedeemLoading(true);
    setRedeemMsg(null);
    setError(null);
    try {
      const res = await redeemVipCode(vipCode.trim());
      setRedeemMsg(res.message || 'VIP Pass Activated!');
      setVipCode('');
    } catch (err: any) {
      setError(err.message || 'Failed to redeem VIP code');
    } finally {
      setRedeemLoading(false);
    }
  };

  if (user) {
    return (
      <div className="auth-form">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1rem' }}>
          <div style={{
            width: 70, height: 70, borderRadius: '50%', backgroundColor: 'var(--bg-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', fontWeight: 800, color: 'var(--foreground)',
            border: isVip ? `2px solid ${planTierColor}` : '1px solid rgba(255,255,255,0.2)',
            boxShadow: isVip ? `0 0 15px ${planTierColor}66` : 'none',
            overflow: 'hidden', flexShrink: 0
          }}>
            {user.profile?.avatar_url ? (
              <img src={user.profile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              user.profile?.display_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()
            )}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              {user.profile?.display_name || username || 'Anonymous User'}
            </h2>
            <p style={{ margin: '0.25rem 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>{user.email}</p>
          </div>
        </div>

        <div className="auth-flex-row">
          <div className="auth-profile-card">
            <div className="auth-profile-label">Account Role</div>
            <div className="auth-profile-value role" style={{ textTransform: 'capitalize' }}>{user.role}</div>
          </div>
          <div className="auth-profile-card" style={{
            background: isVip ? `linear-gradient(135deg, ${planTierColor}20 0%, rgba(0,0,0,0) 100%)` : undefined,
            borderColor: isVip ? planTierColor : undefined
          }}>
            <div className="auth-profile-label" style={{ color: isVip ? planTierColor : undefined, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isVip && <Crown size={14} color={planTierColor} />} Subscription Tier
            </div>
            <div className="auth-profile-value plan" style={{ color: isVip ? planTierColor : undefined, fontWeight: 700 }}>
              {planTierLabel}
            </div>
          </div>
        </div>

        <form onSubmit={handleRedeem} style={{
          marginTop: '1rem', padding: '1rem', borderRadius: '12px',
          background: 'rgba(255, 215, 0, 0.05)', border: '1px solid rgba(255, 215, 0, 0.2)',
          display: 'flex', flexDirection: 'column', gap: '0.5rem'
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffd700', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} /> Redeem VIP Pass Key
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              placeholder="e.g. VIP-TEST2026" 
              value={vipCode} 
              onChange={e => setVipCode(e.target.value)}
              style={{
                flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px',
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: '0.9rem', outline: 'none'
              }}
            />
            <button 
              type="submit" 
              disabled={redeemLoading || !vipCode.trim()}
              style={{
                padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
                color: '#000', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                opacity: redeemLoading || !vipCode.trim() ? 0.6 : 1
              }}
            >
              {redeemLoading ? 'Activating...' : 'Activate'}
            </button>
          </div>
          {redeemMsg && <div style={{ fontSize: '0.8rem', color: '#4ade80', marginTop: '4px' }}>{redeemMsg}</div>}
        </form>



        <button onClick={logout} className="auth-signout-btn">
          <LogOutIcon size={18} /> Sign Out
        </button>
      </div>
    );
  }


  return (
    <form onSubmit={handleAuthSubmit} className="auth-form">
      {isRegisterMode && (
        <div className="auth-input-group">
          <label>Display Name</label>
          <input 
            type="text" 
            placeholder="Alex"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="auth-input"
          />
        </div>
      )}
      <div className="auth-input-group">
        <label>Email</label>
        <input 
          type="email" 
          required 
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="auth-input"
        />
      </div>
      <div className="auth-input-group">
        <label>Password</label>
        <input 
          type="password" 
          required 
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="auth-input"
        />
        {isRegisterMode && (
          <span className="auth-input-hint">
            Must contain 6+ chars, 1 uppercase letter, 1 number, & 1 special char.
          </span>
        )}
      </div>

      <TurnstileWidget />

      <button type="submit" disabled={loading} className="auth-btn-primary">
        {loading ? 'Processing...' : (isRegisterMode ? 'Register' : 'Sign In')}
      </button>
      
      <div className="auth-link-text">
        <span>
          {isRegisterMode ? 'Already have an account?' : "Don't have an account?"}
        </span>{' '}
        <button 
          type="button" 
          onClick={() => { setIsRegisterMode(!isRegisterMode); setError(null); }}
          className="auth-link-btn"
        >
          {isRegisterMode ? 'Sign In' : 'Register Now'}
        </button>
      </div>
    </form>
  );
}
