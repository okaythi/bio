import { Search, Shield, Lock } from 'lucide-react';
import { KNOWN_FLAGS } from '../../config/constants';

interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  flags: string[];
}

interface StaffTabProps {
  canEditFlags: boolean;
  userSearch: string;
  setUserSearch: (val: string) => void;
  loadingUsers: boolean;
  filteredUsers: AdminUser[];
  selectedUser: AdminUser | null;
  handleSelectUser: (u: AdminUser) => void;
  currentUser: any;
  targetFlags: string[];
  handleToggleFlag: (flagName: string) => void;
  loading: boolean;
  handleSaveFlags: () => void;
}

export default function StaffTab({
  canEditFlags, userSearch, setUserSearch, loadingUsers, filteredUsers, selectedUser,
  handleSelectUser, currentUser, targetFlags, handleToggleFlag, loading, handleSaveFlags
}: StaffTabProps) {
  return (
    <div className="auth-form">
      <div className="auth-staff-banner">
        <strong>Bio Staff DevTools & Permission Flag Management</strong><br />
        Staff members can toggle experiment treatments and grant permissions (`is_staff`, `edit_flags`).
      </div>

      {canEditFlags ? (
        <div className="auth-form">
          <div className="auth-staff-details-title" style={{ color: '#fff' }}>User Permission Flags Editor</div>
          
          <div className="auth-search-input-group">
            <Search size={16} color="#888" />
            <input 
              type="text" 
              placeholder="Search accounts..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="auth-search-input"
            />
          </div>

          {loadingUsers ? (
            <div className="auth-exp-info">Loading accounts...</div>
          ) : (
            <div className="auth-staff-main">
              <div className="auth-staff-sidebar">
                {filteredUsers.map(u => {
                  const isSelected = selectedUser?.id === u.id;
                  const isCurrent = u.id === currentUser?.id;
                  return (
                    <div 
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className={`auth-user-row ${isSelected ? 'active' : ''}`}
                    >
                      <span>
                        {u.display_name || u.email.split('@')[0]} {isCurrent && '(You)'}
                      </span>
                      {u.flags.includes('is_staff') && <Shield size={12} color="#fff" />}
                    </div>
                  );
                })}
              </div>

              {selectedUser && (
                <div className="auth-staff-details">
                  <div className="auth-staff-details-title">
                    Flags for {selectedUser.display_name || selectedUser.email.split('@')[0]}
                  </div>

                  {KNOWN_FLAGS.map(flag => {
                    const isSelf = selectedUser.id === currentUser?.id;
                    const isProtectedSelfFlag = isSelf && (flag === 'is_staff' || flag === 'edit_flags');
                    const isChecked = targetFlags.includes(flag);

                    return (
                      <label 
                        key={flag} 
                        className={`auth-flag-label ${isProtectedSelfFlag ? 'protected' : ''}`}
                      >
                        <span className="auth-flag-label-inner">
                          {flag} {isProtectedSelfFlag && <Lock size={12} color="#ff6b6b" />}
                        </span>
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          disabled={isProtectedSelfFlag}
                          onChange={() => handleToggleFlag(flag)}
                          className="auth-flag-checkbox"
                        />
                      </label>
                    );
                  })}

                  <button 
                    onClick={handleSaveFlags}
                    disabled={loading}
                    className="auth-btn-primary"
                    style={{ marginTop: 'auto', fontSize: '0.8rem' }}
                  >
                    Save User Flags
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="auth-exp-info">
          You have Staff viewing privileges. Flag modification requires the <code>edit_flags</code> permission flag.
        </div>
      )}
    </div>
  );
}
