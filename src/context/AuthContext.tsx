// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { telemetry } from '../services/telemetry';

export interface UserProfile {
  display_name?: string;
  avatar_url?: string;
  locale?: string;
  timezone?: string;
}

export interface UserSubscription {
  plan_tier: string;
  status: string;
}

export interface UserPreferences {
  theme: string;
  default_audio_lang: string;
  default_subtitle_lang: string;
  auto_play_next: boolean;
  player_volume: number;
  ui_settings_json?: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
  profile?: UserProfile;
  subscription?: UserSubscription;
  preferences?: UserPreferences;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  experiments: string[];
  likedMovies: string[];
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (newPrefs: Partial<UserPreferences>) => Promise<void>;
  updateExperiments: (experiments: string[]) => Promise<void>;
  toggleLike: (movieId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [experiments, setExperiments] = useState<string[]>(["public_beta_v1"]);
  const [likedMovies, setLikedMovies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
        if (data.user) {
          telemetry.track('session_restore', { userId: data.user.id });
          fetchUserExtras();
        }
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserExtras = async () => {
    try {
      const [expRes, watchRes] = await Promise.all([
        fetch('/api/user/experiments'),
        fetch('/api/user/watch')
      ]);

      if (expRes.ok) {
        const expData = await expRes.json();
        if (Array.isArray(expData.experiments)) setExperiments(expData.experiments);
      }

      if (watchRes.ok) {
        const watchData = await watchRes.json();
        if (Array.isArray(watchData.likedMovies)) setLikedMovies(watchData.likedMovies);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchSession();
  }, []);

  // Sync theme preference to DOM dataset
  useEffect(() => {
    const theme = user?.preferences?.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, [user?.preferences?.theme]);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setUser(data.user);
    telemetry.track('user_login', { userId: data.user.id, email: data.user.email });
    await fetchUserExtras();
  };

  const register = async (email: string, password: string, displayName?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    telemetry.track('user_register', { userId: data.userId, email });
    await login(email, password);
  };

  const logout = async () => {
    if (user) {
      telemetry.track('user_logout', { userId: user.id });
    }
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setLikedMovies([]);
    setExperiments(["public_beta_v1"]);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    const res = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update profile');
    setUser(prev => prev ? {
      ...prev,
      profile: { ...(prev.profile || {} as UserProfile), ...data }
    } : null);
    telemetry.track('profile_update', data);
  };

  const updatePreferences = async (newPrefs: Partial<UserPreferences>) => {
    const res = await fetch('/api/user/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPrefs)
    });
    if (!res.ok) throw new Error('Failed to update preferences');
    setUser(prev => prev ? {
      ...prev,
      preferences: { ...(prev.preferences || {} as UserPreferences), ...newPrefs }
    } : null);
    telemetry.track('preferences_update', newPrefs);
  };

  const updateExperiments = async (newExperiments: string[]) => {
    const res = await fetch('/api/user/experiments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experiments: newExperiments })
    });
    if (!res.ok) throw new Error('Failed to update experiments');
    setExperiments(newExperiments);
    telemetry.track('experiments_update', { EXPERIMENTS: newExperiments });
  };

  const toggleLike = async (movieId: string): Promise<boolean> => {
    if (!user) throw new Error('You must be logged in to like titles.');

    const res = await fetch('/api/user/watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId, toggleLike: true })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to toggle like');

    const isLiked = data.isLiked;
    setLikedMovies(prev => isLiked ? [...prev, movieId] : prev.filter(id => id !== movieId));
    telemetry.track('toggle_like', { movieId, isLiked });
    return isLiked;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      experiments,
      likedMovies,
      login,
      register,
      logout,
      updateProfile,
      updatePreferences,
      updateExperiments,
      toggleLike
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
