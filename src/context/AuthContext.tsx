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
  expires_at?: string | null;
  is_vip?: boolean;
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
  flags?: string[];
  profile?: UserProfile;
  subscription?: UserSubscription;
  preferences?: UserPreferences;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  experiments: string[];
  likedMovies: string[];
  watchHistory: any[];
  flags: string[];
  isStaff: boolean;
  canEditFlags: boolean;
  isVip: boolean;
  vipExpiresAt: string | null;
  planTierLabel: string;
  login: (email: string, pass: string, turnstile?: string) => Promise<void>;
  register: (email: string, pass: string, displayName?: string, turnstile?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile> & { cfTurnstileResponse?: string }) => Promise<void>;
  updatePreferences: (newPrefs: Partial<UserPreferences> & { cfTurnstileResponse?: string }) => Promise<void>;
  updateExperiments: (experiments: string[]) => Promise<void>;
  updateUserFlags: (targetUserId: string, newFlags: string[]) => Promise<void>;
  toggleLike: (movieId: string) => Promise<boolean>;
  redeemVipCode: (code: string) => Promise<{ success: boolean; durationDays?: number; message?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [experiments, setExperiments] = useState<string[]>(["2026-07_public_beta_v1", "2026-07_auto_play_next_video"]);
  const [likedMovies, setLikedMovies] = useState<string[]>([]);
  const [watchHistory, setWatchHistory] = useState<any[]>([]);
  const [flags, setFlags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isThyOwner = Boolean(user && user.id === 'f9ec8d5b-5e49-4826-86b2-5147bcd58590');
  const isStaff = Boolean(user && (user.role === 'admin' || flags.includes('is_staff') || isThyOwner));
  const canEditFlags = Boolean(user && (flags.includes('edit_flags') || isThyOwner));

  const isVip = Boolean(
    user && (
      (user.subscription?.plan_tier === 'vip' && user.subscription?.status === 'active') ||
      user.subscription?.is_vip ||
      flags.includes('vip')
    )
  );

  const vipExpiresAt = user?.subscription?.expires_at || null;

  let planTierLabel = 'FREE';
  if (isVip) {
    planTierLabel = 'VIP';
    if (vipExpiresAt) {
      const expDate = new Date(vipExpiresAt);
      planTierLabel += ` (Expires ${expDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })})`;
    } else {
      planTierLabel += ` (Lifetime Pass)`;
    }
  }



  useEffect(() => {
    document.body.classList.add('new-ui');
  }, []);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          const isUserThy = data.user.id === 'f9ec8d5b-5e49-4826-86b2-5147bcd58590';
          setFlags(data.user.flags || (isUserThy ? ['is_staff', 'edit_flags'] : []));
          telemetry.track('session_restore', { userId: data.user.id });
          fetchUserExtras();
        } else {
          setUser(null);
          setFlags([]);
        }
      }
    } catch (err) {
      setUser(null);
      setFlags([]);
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
        if (Array.isArray(watchData.history)) setWatchHistory(watchData.history);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchSession();
  }, []);

  useEffect(() => {
    const theme = user?.preferences?.theme || 'dark';
    let appliedTheme = theme;
    if (theme === 'system') {
      appliedTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', appliedTheme);
  }, [user?.preferences?.theme]);

  const login = async (email: string, password: string, cfTurnstileResponse?: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, cfTurnstileResponse })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setUser(data.user);
    const isUserThy = data.user.id === 'f9ec8d5b-5e49-4826-86b2-5147bcd58590';
    const userFlags = data.user.flags || (isUserThy ? ['is_staff', 'edit_flags'] : []);
    setFlags(userFlags);
    telemetry.track('user_login', { userId: data.user.id, email: data.user.email });
    await fetchUserExtras();
  };

  const register = async (email: string, password: string, displayName?: string, cfTurnstileResponse?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName, cfTurnstileResponse })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    telemetry.track('user_register', { userId: data.userId, email });
    // Note: User must manually log in after registration since the single-use Turnstile token was consumed.
  };

  const logout = async () => {
    if (user) {
      telemetry.track('user_logout', { userId: user.id });
    }
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setFlags([]);
    setLikedMovies([]);
    setWatchHistory([]);
    setExperiments(["2026-07_public_beta_v1", "2026-07_auto_play_next_video"]);
  };

  const updateProfile = async (data: Partial<UserProfile> & { cfTurnstileResponse?: string }) => {
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

  const updatePreferences = async (newPrefs: Partial<UserPreferences> & { cfTurnstileResponse?: string }) => {
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update experiments');
    setExperiments(newExperiments);
    telemetry.track('experiments_update', { EXPERIMENTS: newExperiments });
  };

  const updateUserFlags = async (targetUserId: string, newFlags: string[]) => {
    const res = await fetch('/api/user/flags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, flags: newFlags })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update flags');
    if (targetUserId === user?.id) {
      setFlags(data.flags);
    }
    telemetry.track('flags_update', { targetUserId, flags: newFlags });
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

  const redeemVipCode = async (code: string) => {
    const res = await fetch('/api/user/vip/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to redeem VIP code');
    await fetchSession();
    telemetry.track('vip_code_redeemed', { code });
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      experiments,
      likedMovies,
      watchHistory,
      flags,
      isStaff,
      canEditFlags,
      isVip,
      vipExpiresAt,
      planTierLabel,
      login,
      register,
      logout,
      updateProfile,
      updatePreferences,
      updateExperiments,
      updateUserFlags,
      toggleLike,
      redeemVipCode
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
