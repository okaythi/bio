import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, BrainCircuit, Trash2 } from 'lucide-react';

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
    <div style={{ display: 'flex', gap: '2rem', height: '80vh' }}>
      <div style={{ width: '350px', background: '#111', borderRadius: '8px', overflowY: 'auto' }}>
        {users.map(u => (
          <div 
            key={u.id}
            onClick={() => loadUser(u)}
            style={{ 
              padding: '1rem', 
              borderBottom: '1px solid #222', 
              cursor: 'pointer',
              background: selectedUser?.id === u.id ? '#222' : 'transparent',
              transition: 'background 0.2s'
            }}
          >
            <div style={{ fontWeight: 'bold' }}>{u.display_name || 'Anonymous'}</div>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>{u.email}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, background: '#111', borderRadius: '8px', padding: '2rem', overflowY: 'auto', position: 'relative' }}>
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}
            >
              <Loader2 className="animate-spin" size={48} color="#ff4444" />
            </motion.div>
          ) : userDetails ? (
            <motion.div 
              key="details"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '2rem' }}>{userDetails.profile?.display_name || 'Unknown'}</h2>
                  <div style={{ color: '#888', marginTop: '0.5rem' }}>{userDetails.user?.email}</div>
                </div>
                <div style={{ background: '#222', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #333' }}>
                  <label style={{ fontSize: '0.85rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>Tier</label>
                  <select 
                    value={userDetails.subscription?.plan_tier || 'free'}
                    onChange={e => updateField('subscription', 'plan_tier', e.target.value)}
                    style={{ background: 'transparent', color: '#fff', border: 'none', fontSize: '1.1rem', outline: 'none' }}
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
              </div>

              <div style={{ background: 'rgba(255, 68, 68, 0.1)', border: '1px solid rgba(255, 68, 68, 0.3)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ff4444', marginBottom: '1rem', fontWeight: 'bold' }}>
                  <BrainCircuit /> AI Psychometric Summary
                </div>
                <p style={{ lineHeight: 1.6, color: '#ddd' }}>
                  {aiSummary || 'Generating...'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Active Sessions</h3>
                  {userDetails.sessions?.map((s: any) => (
                    <div key={s.id} style={{ background: '#000', padding: '1rem', borderRadius: '4px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#888' }}>IP: {s.ip_address}</div>
                        <div style={{ fontSize: '0.85rem', color: '#888' }}>Expires: {new Date(s.expires_at).toLocaleDateString()}</div>
                      </div>
                      <button onClick={() => revokeSession(s.id)} style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer' }}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  {(!userDetails.sessions || userDetails.sessions.length === 0) && <div style={{ color: '#666' }}>No active sessions.</div>}
                </div>

                <div>
                  <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Devices</h3>
                  {userDetails.devices?.map((d: any) => (
                    <div key={d.fingerprint_hash} style={{ background: '#000', padding: '1rem', borderRadius: '4px', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#888', textOverflow: 'ellipsis', overflow: 'hidden' }}>FP: {d.fingerprint_hash}</div>
                    </div>
                  ))}
                  {(!userDetails.devices || userDetails.devices.length === 0) && <div style={{ color: '#666' }}>No devices on record.</div>}
                </div>
              </div>

            </motion.div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#666' }}>
              Select a user to view details
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
