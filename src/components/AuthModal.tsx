import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, User as UserIcon, FlaskConical, LogOut, Shield, Lock, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TurnstileWidget from './TurnstileWidget';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  flags: string[];
}

import { SYSTEM_BUCKETS, ALLOWED_EXPERIMENT_BUCKETS, KNOWN_FLAGS } from '../config/constants';

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { 
    user, login, register, logout, updateProfile, updatePreferences, 
    experiments, updateExperiments, isStaff, canEditFlags, flags: userFlags, updateUserFlags 
  } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'auth' | 'profile' | 'preferences' | 'experiments' | 'staff'>('auth');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(user?.profile?.display_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.profile?.avatar_url || '');
  const [theme, setTheme] = useState(user?.preferences?.theme || 'dark');
  const [autoPlay, setAutoPlay] = useState(user?.preferences?.auto_play_next ?? true);
  
  const [expInput, setExpInput] = useState('');
  const [expList, setExpList] = useState<string[]>(experiments);

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [targetFlags, setTargetFlags] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasAutoPlayExp = Boolean(
    experiments.includes('2026-07_auto_play_next_video') || experiments.includes('auto_play_next_video')
  );

  const username = (user?.profile?.display_name && user.profile.display_name.trim() !== '') 
    ? user.profile.display_name 
    : (user?.email ? user.email.split('@')[0] : 'User');

  useEffect(() => {
    setExpList(experiments);
  }, [experiments]);

  useEffect(() => {
    if (user && isStaff && activeTab === 'staff') {
      fetchAdminUsers();
    }
  }, [activeTab, isStaff, user]);

  const fetchAdminUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(data.users || []);
        if (data.users && data.users.length > 0 && !selectedUser) {
          const self = data.users.find((u: AdminUser) => u.id === user?.id) || data.users[0];
          setSelectedUser(self);
          setTargetFlags(self.flags || []);
        }
      }
    } catch (e) {
    } finally {
      setLoadingUsers(false);
    }
  };

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = new FormData(e.currentTarget).get('cf-turnstile-response') as string | undefined;
    
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isRegisterMode) {
        await register(email, password, displayName, token);
        setSuccess('Account created successfully! Please sign in.');
        setIsRegisterMode(false);
      } else {
        await login(email, password, token);
        setSuccess('Logged in successfully!');
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = new FormData(e.currentTarget).get('cf-turnstile-response') as string | undefined;

    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await updateProfile({ display_name: displayName, avatar_url: avatarUrl, cfTurnstileResponse: token });
      setSuccess('Profile updated successfully!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = new FormData(e.currentTarget).get('cf-turnstile-response') as string | undefined;

    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await updatePreferences({ theme, auto_play_next: autoPlay, cfTurnstileResponse: token });
      setSuccess('Preferences saved!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAddExperiment = () => {
    const trimmed = expInput.trim();
    if (!trimmed) return;
    if (!ALLOWED_EXPERIMENT_BUCKETS.includes(trimmed)) {
      setError(`Unrecognized experiment bucket "${trimmed}". Allowed: ${ALLOWED_EXPERIMENT_BUCKETS.join(', ')}`);
      return;
    }
    if (!expList.includes(trimmed)) {
      setExpList([...expList, trimmed]);
      setExpInput('');
      setError(null);
    }
  };

  const handleRemoveExperiment = (exp: string) => {
    if (!isStaff && SYSTEM_BUCKETS.includes(exp)) {
      setError(`System bucket "${exp}" cannot be removed.`);
      return;
    }
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

  const handleSelectUser = (u: AdminUser) => {
    setSelectedUser(u);
    setTargetFlags(u.flags || []);
    setError(null);
    setSuccess(null);
  };

  const handleToggleFlag = (flagName: string) => {
    if (!selectedUser) return;
    const isSelf = selectedUser.id === user?.id;
    if (isSelf && (flagName === 'is_staff' || flagName === 'edit_flags')) {
      setError(`Security Protection: You cannot remove your own '${flagName}' permission.`);
      return;
    }
    setError(null);
    setTargetFlags(prev => prev.includes(flagName) ? prev.filter(f => f !== flagName) : [...prev, flagName]);
  };

  const handleSaveFlags = async () => {
    if (!selectedUser) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await updateUserFlags(selectedUser.id, targetFlags);
      setSuccess(`Flags updated!`);
      fetchAdminUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = adminUsers.filter(u => 
    u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
    (u.display_name && u.display_name.toLowerCase().includes(userSearch.toLowerCase()))
  );

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
          maxWidth: '580px',
          width: '92%',
          backgroundColor: 'var(--modal-bg)',
          borderRadius: '12px',
          padding: '28px',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--foreground)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserIcon size={24} color="#E50914" />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
              {user ? username : (isRegisterMode ? 'Create Account' : 'Sign In')}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="var(--text-muted)" />
          </button>
        </div>

        {user && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => { setActiveTab('auth'); setError(null); }}
              style={{
                background: activeTab === 'auth' ? '#E50914' : 'transparent',
                color: activeTab === 'auth' ? '#fff' : 'var(--foreground)', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem'
              }}
            >
              Account
            </button>
            <button 
              onClick={() => { setActiveTab('profile'); setError(null); }}
              style={{
                background: activeTab === 'profile' ? '#E50914' : 'transparent',
                color: activeTab === 'profile' ? '#fff' : 'var(--foreground)', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem'
              }}
            >
              Profile
            </button>
            <button 
              onClick={() => { setActiveTab('preferences'); setError(null); }}
              style={{
                background: activeTab === 'preferences' ? '#E50914' : 'transparent',
                color: activeTab === 'preferences' ? '#fff' : 'var(--foreground)', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem'
              }}
            >
              Preferences
            </button>
            <button 
              onClick={() => { setActiveTab('experiments'); setError(null); }}
              style={{
                background: activeTab === 'experiments' ? '#E50914' : 'transparent',
                color: activeTab === 'experiments' ? '#fff' : 'var(--foreground)', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <FlaskConical size={14} /> Experiments
            </button>
            {isStaff && (
              <button 
                onClick={() => { setActiveTab('staff'); setError(null); }}
                style={{
                  background: activeTab === 'staff' ? '#E50914' : 'rgba(229,9,20,0.15)',
                  border: '1px solid #E50914', color: '#ff6b6b', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600
                }}
              >
                <Shield size={14} color="#ff6b6b" /> Staff DevTools
              </button>
            )}
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

        {(!user || activeTab === 'auth') && (
          <div>
            {user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1, padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Username</div>
                    <div style={{ fontWeight: 600, color: '#E50914', fontSize: '1.05rem' }}>{username}</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Email Address</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1, padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Role</div>
                    <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{user.role}</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Subscription</div>
                    <div style={{ fontWeight: 600, textTransform: 'uppercase', color: '#2ecc71' }}>
                      {user.subscription?.plan_tier || 'FREE'}
                    </div>
                  </div>
                </div>

                {userFlags.length > 0 && (
                  <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Account Flags</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {userFlags.map(f => (
                        <span key={f} style={{ backgroundColor: 'rgba(229,9,20,0.2)', border: '1px solid #E50914', color: '#ff6b6b', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  onClick={logout}
                  style={{
                    marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    backgroundColor: 'rgba(255,255,255,0.1)', color: 'var(--foreground)', border: 'none', padding: '12px', borderRadius: '6px',
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
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Display Name</label>
                    <input 
                      type="text" 
                      placeholder="Alex"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--text-muted)', backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
                    />
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Email</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--text-muted)', backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Password</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--text-muted)', backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
                  />
                  {isRegisterMode && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Must contain 6+ chars, 1 uppercase letter, 1 number, & 1 special char.
                    </span>
                  )}
                </div>

                <TurnstileWidget />

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
                  <span style={{ color: 'var(--text-muted)' }}>
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

        {user && activeTab === 'profile' && (
          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Display Name</label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--text-muted)', backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Avatar Image URL</label>
              <input 
                type="text" 
                placeholder="https://..."
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--text-muted)', backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
              />
            </div>
            <TurnstileWidget />
            <button 
              type="submit" 
              disabled={loading}
              style={{ backgroundColor: '#E50914', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              Save Profile Changes
            </button>
          </form>
        )}

        {user && activeTab === 'preferences' && (
          <form onSubmit={handlePreferencesSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Theme</label>
              <select 
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--text-muted)', backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
              >
                <option value="dark">Dark Theme (Default)</option>
                <option value="light">Light Theme</option>
                <option value="system">System Preference</option>
              </select>
            </div>

            {hasAutoPlayExp && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Auto-play Next Video</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Automatically play next episode when video ends</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={autoPlay} 
                  onChange={(e) => setAutoPlay(e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: '#E50914' }}
                />
              </div>
            )}

            <TurnstileWidget />

            <button 
              type="submit" 
              disabled={loading}
              style={{ backgroundColor: '#E50914', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              Save Preferences
            </button>
          </form>
        )}

        {user && activeTab === 'experiments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Experiment Buckets control custom UI behaviors, dynamic layout variants, and algorithm feature flags assigned to your account.
            </div>

            <div style={{ backgroundColor: '#000', padding: '10px', borderRadius: '6px', border: '1px solid #333' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>EXPERIMENTS: []</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {expList.map((exp) => {
                  const isSystemBucket = SYSTEM_BUCKETS.includes(exp);
                  const canRemove = isStaff || !isSystemBucket;
                  return (
                    <span 
                      key={exp} 
                      style={{
                        backgroundColor: isSystemBucket ? 'rgba(229, 9, 20, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                        border: isSystemBucket ? '1px solid #E50914' : '1px solid rgba(255,255,255,0.2)',
                        color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      {exp} {isSystemBucket && <span style={{ fontSize: '0.65rem', color: '#ff6b6b' }}>(System)</span>}
                      {canRemove && (
                        <X size={12} color="#aaa" style={{ cursor: 'pointer' }} onClick={() => handleRemoveExperiment(exp)} />
                      )}
                    </span>
                  );
                })}
                {expList.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No active experiment buckets.</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="e.g. 2026-07_auto_play_next_video"
                value={expInput}
                onChange={(e) => setExpInput(e.target.value)}
                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--text-muted)', backgroundColor: 'var(--card-bg)', color: 'var(--foreground)', fontSize: '0.85rem' }}
              />
              <button 
                onClick={handleAddExperiment}
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Add Bucket
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#777' }}>
              Allowed buckets: {ALLOWED_EXPERIMENT_BUCKETS.join(', ')}
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

        {user && isStaff && activeTab === 'staff' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '10px', backgroundColor: 'rgba(229,9,20,0.15)', border: '1px solid rgba(229,9,20,0.4)', borderRadius: '6px', color: '#ff6b6b', fontSize: '0.8rem' }}>
              <strong>Bio Staff DevTools & Permission Flag Management</strong><br />
              Staff members can toggle experiment treatments and grant permissions (`is_staff`, `edit_flags`).
            </div>

            {canEditFlags ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>User Permission Flags Editor</div>
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Search size={16} color="#888" />
                  <input 
                    type="text" 
                    placeholder="Search accounts..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--text-muted)', backgroundColor: 'var(--card-bg)', color: 'var(--foreground)', fontSize: '0.85rem' }}
                  />
                </div>

                {loadingUsers ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading accounts...</div>
                ) : (
                  <div style={{ display: 'flex', gap: '12px', minHeight: '180px' }}>
                    <div style={{ width: '45%', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '10px', overflowY: 'auto', maxHeight: '200px' }}>
                      {filteredUsers.map(u => {
                        const isSelected = selectedUser?.id === u.id;
                        const isCurrent = u.id === user.id;
                        return (
                          <div 
                            key={u.id}
                            onClick={() => handleSelectUser(u)}
                            style={{
                              padding: '8px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px',
                              backgroundColor: isSelected ? '#E50914' : 'rgba(255,255,255,0.05)',
                              fontSize: '0.8rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.display_name || u.email.split('@')[0]} {isCurrent && '(You)'}
                            </span>
                            {u.flags.includes('is_staff') && <Shield size={12} color="#fff" />}
                          </div>
                        );
                      })}
                    </div>

                    {selectedUser && (
                      <div style={{ flex: 1, paddingLeft: '6px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)' }}>
                          Flags for {selectedUser.display_name || selectedUser.email.split('@')[0]}
                        </div>

                        {KNOWN_FLAGS.map(flag => {
                          const isSelf = selectedUser.id === user.id;
                          const isProtectedSelfFlag = isSelf && (flag === 'is_staff' || flag === 'edit_flags');
                          const isChecked = targetFlags.includes(flag);

                          return (
                            <label 
                              key={flag} 
                              style={{ 
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                fontSize: '0.8rem', cursor: isProtectedSelfFlag ? 'not-allowed' : 'pointer',
                                padding: '6px 8px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px',
                                opacity: isProtectedSelfFlag ? 0.65 : 1
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {flag} {isProtectedSelfFlag && <Lock size={12} color="#ff6b6b" />}
                              </span>
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                disabled={isProtectedSelfFlag}
                                onChange={() => handleToggleFlag(flag)}
                                style={{ accentColor: '#E50914' }}
                              />
                            </label>
                          );
                        })}

                        <button 
                          onClick={handleSaveFlags}
                          disabled={loading}
                          style={{ backgroundColor: '#E50914', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', marginTop: 'auto', fontSize: '0.8rem' }}
                        >
                          Save User Flags
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                You have Staff viewing privileges. Flag modification requires the <code>edit_flags</code> permission flag.
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
