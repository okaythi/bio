import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, User as UserIcon, FlaskConical, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { user, login, register, logout, updateProfile, updatePreferences, experiments, updateExperiments } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'auth' | 'profile' | 'preferences' | 'experiments'>('auth');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(user?.profile?.display_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.profile?.avatar_url || '');
  const [theme, setTheme] = useState(user?.preferences?.theme || 'dark');
  const [autoPlay, setAutoPlay] = useState(user?.preferences?.auto_play_next ?? true);
  
  const [expInput, setExpInput] = useState('');
  const [expList, setExpList] = useState<string[]>(experiments);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isRegisterMode) {
        await register(email, password, displayName);
        setSuccess('Account created successfully!');
      } else {
        await login(email, password);
        setSuccess('Logged in successfully!');
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await updateProfile({ display_name: displayName, avatar_url: avatarUrl });
      setSuccess('Profile updated successfully!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await updatePreferences({ theme, auto_play_next: autoPlay });
      setSuccess('Preferences saved!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAddExperiment = () => {
    if (expInput.trim() && !expList.includes(expInput.trim())) {
      const next = [...expList, expInput.trim()];
      setExpList(next);
      setExpInput('');
    }
  };

  const handleRemoveExperiment = (exp: string) => {
    setExpList(expList.filter(e => e !== exp));
  };

  const handleSaveExperiments = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await updateExperiments(expList);
      setSuccess('Experiment buckets updated!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div 
        className="modal-content"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '90%',
          backgroundColor: '#141414',
          borderRadius: '12px',
          padding: '28px',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserIcon size={24} color="#E50914" />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
              {user ? (user.profile?.display_name || user.email) : (isRegisterMode ? 'Create Account' : 'Sign In')}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="#888" />
          </button>
        </div>

        {/* Tab Navigation if Logged In */}
        {user && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
            <button 
              onClick={() => setActiveTab('auth')}
              style={{
                background: activeTab === 'auth' ? '#E50914' : 'transparent',
                color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem'
              }}
            >
              Account
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              style={{
                background: activeTab === 'profile' ? '#E50914' : 'transparent',
                color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem'
              }}
            >
              Profile
            </button>
            <button 
              onClick={() => setActiveTab('preferences')}
              style={{
                background: activeTab === 'preferences' ? '#E50914' : 'transparent',
                color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem'
              }}
            >
              Preferences
            </button>
            <button 
              onClick={() => setActiveTab('experiments')}
              style={{
                background: activeTab === 'experiments' ? '#E50914' : 'transparent',
                color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <FlaskConical size={14} /> Experiments
            </button>
          </div>
        )}

        {error && (
          <div style={{ backgroundColor: 'rgba(229, 9, 20, 0.2)', border: '1px solid #E50914', color: '#ff6b6b', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ backgroundColor: 'rgba(46, 204, 113, 0.2)', border: '1px solid #2ecc71', color: '#2ecc71', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
            {success}
          </div>
        )}

        {/* Tab 1: Auth / Account Status */}
        {(!user || activeTab === 'auth') && (
          <div>
            {user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '14px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '4px' }}>Email Address</div>
                  <div style={{ fontWeight: 600 }}>{user.email}</div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1, padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>Role</div>
                    <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{user.role}</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>Subscription</div>
                    <div style={{ fontWeight: 600, textTransform: 'uppercase', color: '#2ecc71' }}>
                      {user.subscription?.plan_tier || 'FREE'}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={logout}
                  style={{
                    marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '12px', borderRadius: '6px',
                    cursor: 'pointer', fontWeight: 600
                  }}
                >
                  <LogOut size={18} /> Sign Out
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {isRegisterMode && (
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#ccc', display: 'block', marginBottom: '4px' }}>Display Name</label>
                    <input 
                      type="text" 
                      placeholder="Alex"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#222', color: '#fff' }}
                    />
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#ccc', display: 'block', marginBottom: '4px' }}>Email</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#222', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#ccc', display: 'block', marginBottom: '4px' }}>Password</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#222', color: '#fff' }}
                  />
                  {isRegisterMode && (
                    <span style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px', display: 'block' }}>
                      Must contain 6+ chars, 1 uppercase letter, 1 number, & 1 special char.
                    </span>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  style={{
                    backgroundColor: '#E50914', color: '#fff', border: 'none', padding: '12px', borderRadius: '6px',
                    fontWeight: 700, cursor: 'pointer', marginTop: '6px'
                  }}
                >
                  {loading ? 'Processing...' : (isRegisterMode ? 'Register' : 'Sign In')}
                </button>
                <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.85rem' }}>
                  <span style={{ color: '#888' }}>
                    {isRegisterMode ? 'Already have an account?' : "Don't have an account?"}
                  </span>{' '}
                  <button 
                    type="button" 
                    onClick={() => { setIsRegisterMode(!isRegisterMode); setError(null); }}
                    style={{ background: 'none', border: 'none', color: '#E50914', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {isRegisterMode ? 'Sign In' : 'Register Now'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: Profile Edit */}
        {user && activeTab === 'profile' && (
          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#ccc', display: 'block', marginBottom: '4px' }}>Display Name</label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#222', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#ccc', display: 'block', marginBottom: '4px' }}>Avatar Image URL</label>
              <input 
                type="text" 
                placeholder="https://..."
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#222', color: '#fff' }}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              style={{ backgroundColor: '#E50914', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              Save Profile Changes
            </button>
          </form>
        )}

        {/* Tab 3: Preferences */}
        {user && activeTab === 'preferences' && (
          <form onSubmit={handlePreferencesSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#ccc', display: 'block', marginBottom: '6px' }}>Theme</label>
              <select 
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#222', color: '#fff' }}
              >
                <option value="dark">Dark Theme (Default)</option>
                <option value="light">Light Theme</option>
                <option value="system">System Preference</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Auto-play Next Video</div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>Automatically play next episode when video ends</div>
              </div>
              <input 
                type="checkbox" 
                checked={autoPlay} 
                onChange={(e) => setAutoPlay(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: '#E50914' }}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              style={{ backgroundColor: '#E50914', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              Save Preferences
            </button>
          </form>
        )}

        {/* Tab 4: Experiments Buckets */}
        {user && activeTab === 'experiments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '0.8rem', color: '#aaa', lineHeight: '1.4' }}>
              Experiment Buckets control custom UI behaviors, dynamic layout variants, and algorithm feature flags assigned to your account.
            </div>

            <div style={{ backgroundColor: '#000', padding: '10px', borderRadius: '6px', border: '1px solid #333' }}>
              <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '6px' }}>EXPERIMENTS: []</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {expList.map((exp) => (
                  <span 
                    key={exp} 
                    style={{
                      backgroundColor: 'rgba(229, 9, 20, 0.2)', border: '1px solid #E50914', color: '#fff',
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    {exp}
                    <X size={12} color="#aaa" style={{ cursor: 'pointer' }} onClick={() => handleRemoveExperiment(exp)} />
                  </span>
                ))}
                {expList.length === 0 && <span style={{ fontSize: '0.8rem', color: '#666' }}>No active experiment buckets.</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="e.g. smart_recommendations_v2"
                value={expInput}
                onChange={(e) => setExpInput(e.target.value)}
                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #333', backgroundColor: '#222', color: '#fff', fontSize: '0.85rem' }}
              />
              <button 
                onClick={handleAddExperiment}
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Add Bucket
              </button>
            </div>

            <button 
              onClick={handleSaveExperiments}
              disabled={loading}
              style={{ backgroundColor: '#E50914', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', marginTop: '6px' }}
            >
              Save Experiment Buckets
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
