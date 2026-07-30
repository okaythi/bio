import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User as UserIcon, FlaskConical, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import AuthTab from './auth/AuthTab';
import ProfileTab from './auth/ProfileTab';
import PreferencesTab from './auth/PreferencesTab';
import ExperimentsTab from './auth/ExperimentsTab';
import StaffTab from './auth/StaffTab';

import { ALLOWED_EXPERIMENT_BUCKETS, SYSTEM_BUCKETS } from '../config/constants';

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
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="auth-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div 
            className="auth-modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="auth-header">
              <div className="auth-header-title">
                <UserIcon size={24} color="#E50914" />
                <h2>
                  {user ? username : (isRegisterMode ? 'Create Account' : 'Sign In')}
                </h2>
              </div>
              <button onClick={onClose} className="auth-close-btn">
                <X size={20} color="var(--text-muted)" />
              </button>
            </div>

            {user && (
              <div className="auth-tabs-container">
                <button 
                  onClick={() => { setActiveTab('auth'); setError(null); }}
                  className={`auth-tab-btn ${activeTab === 'auth' ? 'active' : ''}`}
                >
                  Account
                </button>
                <button 
                  onClick={() => { setActiveTab('profile'); setError(null); }}
                  className={`auth-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                >
                  Profile
                </button>
                <button 
                  onClick={() => { setActiveTab('preferences'); setError(null); }}
                  className={`auth-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
                >
                  Preferences
                </button>
                <button 
                  onClick={() => { setActiveTab('experiments'); setError(null); }}
                  className={`auth-tab-btn ${activeTab === 'experiments' ? 'active' : ''}`}
                >
                  <FlaskConical size={14} /> Experiments
                </button>
                {isStaff && (
                  <button 
                    onClick={() => { setActiveTab('staff'); setError(null); }}
                    className={`auth-tab-btn auth-tab-btn-staff ${activeTab === 'staff' ? 'active' : ''}`}
                  >
                    <Shield size={14} /> Staff DevTools
                  </button>
                )}
              </div>
            )}

            {error && (
              <div className="auth-error">
                {error}
              </div>
            )}

            {success && (
              <div className="auth-success">
                {success}
              </div>
            )}

            {(!user || activeTab === 'auth') && (
              <AuthTab 
                user={user}
                username={username}
                userFlags={userFlags}
                isRegisterMode={isRegisterMode}
                setIsRegisterMode={setIsRegisterMode}
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                displayName={displayName}
                setDisplayName={setDisplayName}
                loading={loading}
                handleAuthSubmit={handleAuthSubmit}
                setError={setError}
                logout={logout}
                LogOutIcon={LogOut}
              />
            )}

            {user && activeTab === 'profile' && (
              <ProfileTab 
                displayName={displayName}
                setDisplayName={setDisplayName}
                avatarUrl={avatarUrl}
                setAvatarUrl={setAvatarUrl}
                loading={loading}
                handleProfileSubmit={handleProfileSubmit}
              />
            )}

            {user && activeTab === 'preferences' && (
              <PreferencesTab 
                theme={theme}
                setTheme={setTheme}
                hasAutoPlayExp={hasAutoPlayExp}
                autoPlay={autoPlay}
                setAutoPlay={setAutoPlay}
                loading={loading}
                handlePreferencesSubmit={handlePreferencesSubmit}
              />
            )}

            {user && activeTab === 'experiments' && (
              <ExperimentsTab 
                expList={expList}
                isStaff={isStaff}
                handleRemoveExperiment={handleRemoveExperiment}
                expInput={expInput}
                setExpInput={setExpInput}
                handleAddExperiment={handleAddExperiment}
                loading={loading}
                handleSaveExperiments={handleSaveExperiments}
              />
            )}

            {user && isStaff && activeTab === 'staff' && (
              <StaffTab 
                canEditFlags={canEditFlags}
                userSearch={userSearch}
                setUserSearch={setUserSearch}
                loadingUsers={loadingUsers}
                filteredUsers={filteredUsers}
                selectedUser={selectedUser}
                handleSelectUser={handleSelectUser}
                currentUser={user}
                targetFlags={targetFlags}
                handleToggleFlag={handleToggleFlag}
                loading={loading}
                handleSaveFlags={handleSaveFlags}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
