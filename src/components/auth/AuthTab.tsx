import React from 'react';
import TurnstileWidget from '../TurnstileWidget';

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
  user, username, userFlags, isRegisterMode, setIsRegisterMode,
  email, setEmail, password, setPassword, displayName, setDisplayName,
  loading, handleAuthSubmit, setError, logout, LogOutIcon
}: AuthTabProps) {
  if (user) {
    return (
      <div className="auth-form">
        <div className="auth-flex-row">
          <div className="auth-profile-card">
            <div className="auth-profile-label">Username</div>
            <div className="auth-profile-value username">{username}</div>
          </div>
          <div className="auth-profile-card">
            <div className="auth-profile-label">Email Address</div>
            <div className="auth-profile-value email">{user.email}</div>
          </div>
        </div>

        <div className="auth-flex-row">
          <div className="auth-profile-card">
            <div className="auth-profile-label">Role</div>
            <div className="auth-profile-value role">{user.role}</div>
          </div>
          <div className="auth-profile-card">
            <div className="auth-profile-label">Subscription</div>
            <div className="auth-profile-value plan">
              {user.subscription?.plan_tier || 'FREE'}
            </div>
          </div>
        </div>

        {userFlags.length > 0 && (
          <div className="auth-profile-card">
            <div className="auth-profile-label">Account Flags</div>
            <div className="auth-flex-wrap">
              {userFlags.map(f => (
                <span key={f} className="auth-flag-badge">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

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
