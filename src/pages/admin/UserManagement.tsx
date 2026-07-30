import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, BrainCircuit, Trash2, Shield, User as UserIcon, MonitorSmartphone } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userDetails, setUserDetails] = useState<any | null>(null);
  const [aiSummary, setAiSummary] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .catch(console.error);
  }, []);

  const loadUser = async (u: any) => {
    setSelectedUser(u);
    setLoading(true);
    setAiSummary('');
    try {
      const res = await fetch(`/api/admin/users/${u.id}`);
      const data = await res.json();
      setUserDetails(data);

      fetch('/api/admin/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id })
      })
      .then(r => r.json())
      .then(d => setAiSummary(d.summary || 'Failed to generate summary.'))
      .catch(() => setAiSummary('Error fetching AI summary.'));
      
    } finally {
      setLoading(false);
    }
  };

  const updateField = async (section: string, field: string, value: any) => {
    if (!userDetails) return;
    const current = { ...userDetails };
    if (!current[section]) current[section] = {};
    current[section][field] = value;
    setUserDetails(current);

    await fetch(`/api/admin/users/${selectedUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [section]: { [field]: value } })
    });
  };

  const revokeSession = async (sessionId: string) => {
    if (!selectedUser) return;
    await fetch(`/api/admin/users/${selectedUser.id}?sessionId=${sessionId}`, {
      method: 'DELETE'
    });
    const res = await fetch(`/api/admin/users/${selectedUser.id}`);
    const data = await res.json();
    setUserDetails(data);
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%' }}>
      <div style={{ 
        width: '380px', background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)',
        borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', overflowY: 'auto',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
      }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} color="#ff2a5f" /> User Directory
          </h2>
        </div>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {users.map(u => (
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #ff2a5f 0%, #ff4444 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '2.5rem', fontWeight: 800, boxShadow: '0 10px 20px rgba(255,42,95,0.3)' }}>
                    {userDetails.profile?.display_name ? userDetails.profile.display_name[0].toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-1px' }}>{userDetails.profile?.display_name || 'Anonymous User'}</h2>
                    <div style={{ color: '#aaa', marginTop: '0.25rem', fontSize: '1.1rem' }}>{userDetails.user?.email}</div>
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <label style={{ fontSize: '0.85rem', color: '#888', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Plan Tier</label>
                  <select 
                    value={userDetails.subscription?.plan_tier || 'free'}
                    onChange={e => updateField('subscription', 'plan_tier', e.target.value)}
                    style={{ background: 'transparent', color: '#ff2a5f', border: 'none', fontSize: '1.25rem', fontWeight: 800, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
              </div>

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
                        style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', color: '#ff4444', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', transition: 'all 0.2s' }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,68,68,0.2)'}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,68,68,0.1)'}
                      >
                        <Trash2 size={20} />
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
