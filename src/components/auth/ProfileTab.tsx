import React from 'react';
import TurnstileWidget from '../TurnstileWidget';

interface ProfileTabProps {
  displayName: string;
  setDisplayName: (name: string) => void;
  avatarUrl: string;
  setAvatarUrl: (url: string) => void;
  loading: boolean;
  handleProfileSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export default function ProfileTab({
  displayName, setDisplayName, avatarUrl, setAvatarUrl, loading, handleProfileSubmit
}: ProfileTabProps) {
  return (
    <form onSubmit={handleProfileSubmit} className="auth-form">
      <div className="auth-input-group">
        <label>Display Name</label>
        <input 
          type="text" 
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="auth-input"
        />
      </div>
      <div className="auth-input-group">
        <label>Avatar Image URL</label>
        <input 
          type="text" 
          placeholder="https://..."
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          className="auth-input"
        />
      </div>
      <TurnstileWidget />
      <button type="submit" disabled={loading} className="auth-btn-primary">
        Save Profile Changes
      </button>
    </form>
  );
}
