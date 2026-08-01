import { useState, useEffect } from 'react';
import { Crown, Key, ListOrdered, Sparkles, RefreshCw, UserCheck, ThumbsUp } from 'lucide-react';


export default function VipManagement() {
  const [activeTab, setActiveTab] = useState<'members' | 'codes' | 'requests'>('members');
  const [users, setUsers] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pass code generator form
  const [prefix, setPrefix] = useState('VIP');
  const [durationDays, setDurationDays] = useState('30');
  const [maxUses, setMaxUses] = useState('1');
  const [genSuccess, setGenSuccess] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const getAuthHeaders = () => {
    const adminToken = localStorage.getItem('omni_admin_token') || '';
    return {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken
    };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [userRes, codeRes, reqRes] = await Promise.all([
        fetch('/api/admin/users', { headers, credentials: 'include' }),
        fetch('/api/admin/vip/codes', { headers, credentials: 'include' }),
        fetch('/api/user/vip/requests', { headers, credentials: 'include' })
      ]);

      if (userRes.ok) {
        const d = await userRes.json();
        setUsers(d.users || []);
      }
      if (codeRes.ok) {
        const d = await codeRes.json();
        setCodes(d.codes || []);
      }
      if (reqRes.ok) {
        const d = await reqRes.json();
        setRequests(d.requests || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenLoading(true);
    setGenSuccess(null);
    try {
      const res = await fetch('/api/admin/vip/codes', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ prefix, durationDays, maxUses })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate code');
      setGenSuccess(`Generated code: ${data.code} (${data.durationDays} days)`);
      fetchData();
    } catch (err: any) {
      setGenSuccess(`Error: ${err.message}`);
    } finally {
      setGenLoading(false);
    }
  };

  const setTier = async (userId: string, tier: string, days: number = 30) => {
    const expDate = days > 0 ? new Date(Date.now() + days * 86400 * 1000).toISOString() : null;

    // Optimistic UI update
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const currentFlags = u.flags || [];
        const newFlags = tier === 'free' ? currentFlags.filter((f: string) => f !== 'vip') : Array.from(new Set([...currentFlags, 'vip']));
        return {
          ...u,
          plan_tier: tier,
          status: tier === 'free' ? 'canceled' : 'active',
          expires_at: expDate,
          flags: newFlags
        };
      }
      return u;
    }));

    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          subscription: {
            plan_tier: tier,
            status: tier === 'free' ? 'canceled' : 'active',
            expires_at: expDate
          }
        })
      });
    } catch (e) {
      console.error(e);
    } finally {
      fetchData();
    }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 140, 0, 0.05) 100%)',
        border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: '20px', padding: '2rem 2.5rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 15px 35px rgba(255, 215, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '16px',
            background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000',
            boxShadow: '0 0 25px rgba(255, 215, 0, 0.5)'
          }}>
            <Crown size={32} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>VIP Control Center</h1>
            <p style={{ margin: '0.25rem 0 0 0', color: '#ffd700', fontSize: '1rem', opacity: 0.9 }}>
              Manage VIP membership tiers, generate pass keys, and curate priority title requests.
            </p>
          </div>
        </div>

        <button 
          onClick={fetchData} 
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh Data
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
        <button
          onClick={() => setActiveTab('members')}
          style={{
            padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none', cursor: 'pointer',
            background: activeTab === 'members' ? 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)' : 'rgba(255,255,255,0.05)',
            color: activeTab === 'members' ? '#000' : '#888', fontWeight: 800, fontSize: '0.95rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          <UserCheck size={18} /> VIP Member Directory
        </button>

        <button
          onClick={() => setActiveTab('codes')}
          style={{
            padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none', cursor: 'pointer',
            background: activeTab === 'codes' ? 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)' : 'rgba(255,255,255,0.05)',
            color: activeTab === 'codes' ? '#000' : '#888', fontWeight: 800, fontSize: '0.95rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          <Key size={18} /> VIP Pass Key Generator
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          style={{
            padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none', cursor: 'pointer',
            background: activeTab === 'requests' ? 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)' : 'rgba(255,255,255,0.05)',
            color: activeTab === 'requests' ? '#000' : '#888', fontWeight: 800, fontSize: '0.95rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          <ListOrdered size={18} /> Priority Request Board ({requests.length})
        </button>
      </div>

      {/* Tab Contents */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'members' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
            {users.map(u => {
              const isUserVip = (u.flags && u.flags.includes('vip')) || u.id === 'f9ec8d5b-5e49-4826-86b2-5147bcd58590';
              return (
                <div 
                  key={u.id}
                  style={{
                    background: isUserVip ? 'rgba(255, 215, 0, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                    border: isUserVip ? '1px solid rgba(255, 215, 0, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>{u.display_name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#888' }}>{u.email}</div>
                    </div>
                    {isUserVip ? (
                      <span style={{
                        background: 'rgba(255, 215, 0, 0.15)', color: '#ffd700', border: '1px solid rgba(255, 215, 0, 0.4)',
                        padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px'
                      }}>
                        <Crown size={12} /> VIP ACTIVE
                      </span>
                    ) : (
                      <span style={{ background: 'rgba(255,255,255,0.05)', color: '#888', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem' }}>
                        FREE TIER
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 'auto' }}>
                    <button
                      onClick={() => setTier(u.id, 'vip_silver', 30)}
                      style={{
                        flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none',
                        background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
                        color: '#000', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
                      }}
                    >
                      +30 Days VIP
                    </button>
                    <button
                      onClick={() => setTier(u.id, 'vip_gold', 365)}
                      style={{
                        flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255,215,0,0.5)',
                        background: 'rgba(255,215,0,0.1)', color: '#ffd700', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
                      }}
                    >
                      +1 Year Gold
                    </button>
                    <button
                      onClick={() => setTier(u.id, 'free', 0)}
                      style={{
                        padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,68,68,0.3)',
                        background: 'rgba(255,68,68,0.1)', color: '#ff4444', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'codes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <form onSubmit={handleGenerateCode} style={{
              background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ffd700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={20} /> Generate Custom VIP Pass Keys
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '0.5rem' }}>Code Prefix</label>
                  <input
                    type="text" value={prefix} onChange={e => setPrefix(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '0.5rem' }}>Duration (Days)</label>
                  <input
                    type="number" value={durationDays} onChange={e => setDurationDays(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '0.5rem' }}>Max Redemptions</label>
                  <input
                    type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                  />
                </div>
              </div>
              <button
                type="submit" disabled={genLoading}
                style={{
                  padding: '0.85rem', background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
                  border: 'none', borderRadius: '10px', color: '#000', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem'
                }}
              >
                {genLoading ? 'Generating...' : 'Generate VIP Pass Key'}
              </button>
              {genSuccess && <div style={{ padding: '0.75rem', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', color: '#4ade80', borderRadius: '8px', fontWeight: 600 }}>{genSuccess}</div>}
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Active Pass Keys</h3>
              {codes.map(c => (
                <div key={c.code} style={{
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)',
                  padding: '1rem 1.5rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, color: '#ffd700' }}>{c.code}</div>
                  <div style={{ display: 'flex', gap: '1.5rem', color: '#aaa', fontSize: '0.9rem' }}>
                    <span>{c.duration_days} Days VIP</span>
                    <span>Uses: {c.current_uses} / {c.max_uses}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {requests.map(r => (
              <div key={r.id} style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                padding: '1.5rem', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>{r.title} ({r.year || 'N/A'})</div>
                  <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem' }}>
                    Requested by: {r.requester_name || r.requester_email || 'VIP Member'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ffd700', fontWeight: 800, fontSize: '1.1rem' }}>
                    <ThumbsUp size={18} /> {r.votes} Priority Votes
                  </div>
                  <span style={{
                    padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                    background: r.status === 'pending' ? 'rgba(255,215,0,0.15)' : 'rgba(74,222,128,0.15)',
                    color: r.status === 'pending' ? '#ffd700' : '#4ade80',
                    border: r.status === 'pending' ? '1px solid rgba(255,215,0,0.3)' : '1px solid rgba(74,222,128,0.3)'
                  }}>
                    {r.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
            {requests.length === 0 && <div style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '3rem' }}>No title requests submitted yet.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
