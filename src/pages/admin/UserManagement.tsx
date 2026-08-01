import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, BrainCircuit, Trash2, Shield, User as UserIcon, MonitorSmartphone, Users } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userDetails, setUserDetails] = useState<any | null>(null);
  const [aiSummary, setAiSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [tierUpdating, setTierUpdating] = useState(false);
  const [userError, setUserError] = useState('');
  
  const [editSubTier, setEditSubTier] = useState('free');
  const [editSubDays, setEditSubDays] = useState('30');

  const getAuthHeaders = () => {
    const adminToken = localStorage.getItem('omni_admin_token') || '';
    return {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken
    };
  };

  useEffect(() => {
    fetch('/api/admin/users', { headers: getAuthHeaders(), credentials: 'include' })
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .catch(console.error);
  }, []);

  const loadUser = async (u: any) => {
    setSelectedUser(u);
    setLoading(true);
    setAiSummary('');
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { headers: getAuthHeaders(), credentials: 'include' });
      const data = await res.json();
      setUserDetails(data);

      fetch('/api/admin/ai/summary', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ userId: u.id })
      })
      .then(r => r.json())
      .then(d => setAiSummary(d.summary || 'Failed to generate summary.'))
      .catch(() => setAiSummary('Error fetching AI summary.'));
      
      setEditSubTier(data.subscription?.plan_tier || 'free');
      if (data.subscription?.expires_at) {
         const diff = new Date(data.subscription.expires_at).getTime() - Date.now();
         const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
         setEditSubDays(days > 0 ? days.toString() : '30');
      } else {
         setEditSubDays('30');
      }
      
    } finally {
      setLoading(false);
    }
  };

  const applySubscription = async () => {
    if (!userDetails || !selectedUser) return;
    setUserError('');
    setTierUpdating(true);
    try {
      const payload: any = { subscription: { plan_tier: editSubTier, status: 'active', expires_at: null } };
      if (editSubTier === 'free') {
        payload.subscription.status = 'canceled';
      } else {
        const days = parseInt(editSubDays, 10) || 30;
        payload.subscription.expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      }

      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update subscription');
      }
      const freshRes = await fetch(`/api/admin/users/${selectedUser.id}`, { headers: getAuthHeaders(), credentials: 'include' });
      if (freshRes.ok) {
        setUserDetails(await freshRes.json());
      }
    } catch (err: any) {
      setUserError(`BIO-703: Failed to update subscription - ${err.message}`);
    } finally {
      setTierUpdating(false);
    }
  };




  const revokeSession = async (sessionId: string) => {
    if (!selectedUser) return;
    setRevokingSessionId(sessionId);
    setUserError('');
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}?sessionId=${sessionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to revoke session');
      }
      const freshRes = await fetch(`/api/admin/users/${selectedUser.id}`, { headers: getAuthHeaders(), credentials: 'include' });
      const data = await freshRes.json();
      setUserDetails(data);
    } catch (err: any) {
      setUserError(`BIO-703: Failed to update session - ${err.message}`);
    } finally {
      setRevokingSessionId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.display_name && u.display_name.toLowerCase().includes(userSearch.toLowerCase())) || 
    (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%' }}>
      <div style={{ 
        width: '380px', background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)',
        borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', overflowY: 'auto',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
      }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Users size={20} color="#ff2a5f" /> User Directory
          </h2>
          <input 
            type="text" 
            placeholder="Search users..." 
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }}
          />
        </div>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredUsers.map(u => (
            <motion.div 
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              key={u.id}
              onClick={() => loadUser(u)}
              style={{ 
                padding: '1rem 1.25rem', borderRadius: '12px', cursor: 'pointer',
                background: selectedUser?.id === u.id ? 'linear-gradient(135deg, rgba(255,42,95,0.1) 0%, rgba(255,68,68,0.1) 100%)' : 'rgba(0,0,0,0.2)',
                border: selectedUser?.id === u.id ? '1px solid rgba(255,42,95,0.3)' : '1px solid rgba(255,255,255,0.03)',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '1rem'
              }}
            >
              <div style={{ 
                width: 40, height: 40, borderRadius: '50%', background: selectedUser?.id === u.id ? '#ff2a5f' : '#222', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 
              }}>
                {u.display_name ? u.display_name[0].toUpperCase() : <UserIcon size={18} />}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{u.display_name || 'Anonymous User'}</div>
                <div style={{ fontSize: '0.85rem', color: '#888', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{u.email}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div style={{ 
        flex: 1, background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)',
        borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '2.5rem', 
        overflowY: 'auto', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
      }}>
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}
            >
              <Loader2 className="animate-spin" size={48} color="#ff2a5f" />
            </motion.div>
          ) : userDetails ? (
            <motion.div 
              key="details"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            >
              {(() => {
                const displayName = userDetails.profile?.display_name || selectedUser?.display_name || (selectedUser?.email ? selectedUser.email.split('@')[0] : null) || userDetails.user?.email?.split('@')[0] || 'User';
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '3rem' }}>
                    {userError && (
                      <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '12px', fontWeight: 600 }}>
                        {userError}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #ff2a5f 0%, #ff4444 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '2.5rem', fontWeight: 800, boxShadow: '0 10px 20px rgba(255,42,95,0.3)' }}>
                        {displayName[0].toUpperCase()}
                      </div>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-1px' }}>{displayName}</h2>
                        <div style={{ color: '#aaa', marginTop: '0.25rem', fontSize: '1.1rem' }}>{userDetails.user?.email}</div>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Subscription Tier</label>
                        <select 
                          value={editSubTier}
                          onChange={e => setEditSubTier(e.target.value)}
                          disabled={tierUpdating}
                          style={{ background: 'transparent', color: '#ff2a5f', border: '1px solid rgba(255,42,95,0.3)', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '1.05rem', fontWeight: 700, outline: 'none', cursor: 'pointer', opacity: tierUpdating ? 0.5 : 1 }}
                        >
                          <option value="free" style={{ background: '#111', color: '#fff' }}>Free Tier</option>
                          <option value="vip_silver" style={{ background: '#111', color: '#c0c0c0' }}>VIP Silver</option>
                          <option value="vip_gold" style={{ background: '#111', color: '#ffd700' }}>VIP Gold</option>
                          <option value="vip_platinum" style={{ background: '#111', color: '#e5e4e2' }}>VIP Platinum</option>
                        </select>
                      </div>
                      
                      {editSubTier !== 'free' && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Duration (Days)</label>
                          <input 
                            type="number"
                            min="1"
                            value={editSubDays}
                            onChange={e => setEditSubDays(e.target.value)}
                            disabled={tierUpdating}
                            style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '1.05rem', width: '80px', outline: 'none', opacity: tierUpdating ? 0.5 : 1 }}
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingBottom: '2px' }}>
                        <button
                          onClick={applySubscription}
                          disabled={tierUpdating}
                          style={{
                            background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.4)', color: '#4ade80',
                            padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '0.5rem'
                          }}
                        >
                          {tierUpdating ? <Loader2 size={16} className="animate-spin" /> : 'Apply'}
                        </button>
                      </div>
                    </div>
                  </div>
                  </div>
                );
              })()}


              <div style={{ 
                background: 'linear-gradient(135deg, rgba(255,42,95,0.05) 0%, rgba(255,68,68,0.1) 100%)', 
                border: '1px solid rgba(255,42,95,0.2)', padding: '2rem', borderRadius: '16px', marginBottom: '3rem',
                boxShadow: '0 10px 30px rgba(255,42,95,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#ff2a5f', marginBottom: '1rem' }}>
                  <BrainCircuit size={24} />
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>AI Psychometric Analysis</h3>
                </div>
                <p style={{ lineHeight: 1.8, color: '#ddd', fontSize: '1.05rem', margin: 0 }}>
                  {aiSummary || (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Loader2 className="animate-spin" size={16} /> Interfacing with Neural Core...
                    </span>
                  )}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                    <Shield color="#ff2a5f" />
                    <h3 style={{ margin: 0, fontWeight: 600 }}>Active Sessions</h3>
                  </div>
                  {userDetails.sessions?.map((s: any) => (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={s.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#fff', marginBottom: '0.25rem' }}>{s.ip_address}</div>
                        <div style={{ fontSize: '0.85rem', color: '#888' }}>Expires: {new Date(s.expires_at).toLocaleDateString()}</div>
                      </div>
                      <button 
                        onClick={() => revokeSession(s.id)} 
                        disabled={revokingSessionId === s.id}
                        style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', color: '#ff4444', cursor: revokingSessionId === s.id ? 'default' : 'pointer', padding: '0.5rem', borderRadius: '8px', transition: 'all 0.2s', opacity: revokingSessionId === s.id ? 0.5 : 1 }}
                        onMouseOver={e => { if (revokingSessionId !== s.id) e.currentTarget.style.background = 'rgba(255,68,68,0.2)' }}
                        onMouseOut={e => { if (revokingSessionId !== s.id) e.currentTarget.style.background = 'rgba(255,68,68,0.1)' }}
                      >
                        {revokingSessionId === s.id ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
                      </button>
                    </motion.div>
                  ))}
                  {(!userDetails.sessions || userDetails.sessions.length === 0) && <div style={{ color: '#666', fontStyle: 'italic' }}>No active sessions.</div>}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                    <MonitorSmartphone color="#ff2a5f" />
                    <h3 style={{ margin: 0, fontWeight: 600 }}>Registered Devices</h3>
                  </div>
                  {userDetails.devices?.map((d: any) => (
                    <div key={d.fingerprint_hash} style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '0.85rem', color: '#aaa', fontFamily: 'monospace', wordBreak: 'break-all' }}>{d.fingerprint_hash}</div>
                    </div>
                  ))}
                  {(!userDetails.devices || userDetails.devices.length === 0) && <div style={{ color: '#666', fontStyle: 'italic' }}>No devices on record.</div>}
                </div>
              </div>

            </motion.div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#444' }}>
              <Users size={64} style={{ opacity: 0.2 }} />
              <div style={{ fontSize: '1.25rem' }}>Select a user from the directory</div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
