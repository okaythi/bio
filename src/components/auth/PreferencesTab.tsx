import React from 'react';
import TurnstileWidget from '../TurnstileWidget';

interface PreferencesTabProps {
  theme: string;
  setTheme: (theme: string) => void;
  hasAutoPlayExp: boolean;
  autoPlay: boolean;
  setAutoPlay: (val: boolean) => void;
  loading: boolean;
  handlePreferencesSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export default function PreferencesTab({
  theme, setTheme, hasAutoPlayExp, autoPlay, setAutoPlay, loading, handlePreferencesSubmit
}: PreferencesTabProps) {
  return (
    <form onSubmit={handlePreferencesSubmit} className="auth-form">
      <div className="auth-input-group">
        <label>Theme</label>
        <select 
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="auth-input"
        >
          <option value="dark">Dark Theme (Default)</option>
          <option value="light">Light Theme</option>
          <option value="system">System Preference</option>
        </select>
      </div>

      {hasAutoPlayExp && (
        <div className="auth-checkbox-group">
          <div>
            <div className="auth-checkbox-group-title">Auto-play Next Video</div>
            <div className="auth-checkbox-group-hint">Automatically play next episode when video ends</div>
          </div>
          <input 
            type="checkbox" 
            checked={autoPlay} 
            onChange={(e) => setAutoPlay(e.target.checked)}
            className="auth-checkbox-input"
          />
        </div>
      )}

      <TurnstileWidget />

      <button type="submit" disabled={loading} className="auth-btn-primary">
        Save Preferences
      </button>
    </form>
  );
}
