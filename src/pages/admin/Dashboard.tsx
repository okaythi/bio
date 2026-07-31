import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Plus, X, Globe, Lock } from 'lucide-react';

export default function Dashboard() {
  const [settings, setSettings] = useState({ vpnCheckEnabled: true, allowlistIps: [] as string[], defaultHero: '', promotedWeights: {} as Record<string, number> });
  const [newIp, setNewIp] = useState('');
  const [saving, setSaving] = useState(false);
  const [movies, setMovies] = useState<{id: string, title: string}[]>([]);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => setSettings({ vpnCheckEnabled: true, allowlistIps: [], defaultHero: '', promotedWeights: {}, ...d }))
      .catch(console.error);
    fetch('/api/movies')
      .then(r => r.json())
      .then(d => setMovies(d))
      .catch(console.error);
  }, []);

  const saveSettings = async (updated: typeof settings) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const data = await res.json();
      if (res.ok) setSettings(data);
    } finally {
      setSaving(false);
    }
  };

  const addIp = () => {
    if (!newIp) return;
    const updated = { ...settings, allowlistIps: [...settings.allowlistIps, newIp] };
    saveSettings(updated);
    setNewIp('');
  };

  const removeIp = (ip: string) => {
    const updated = { ...settings, allowlistIps: settings.allowlistIps.filter(i => i !== ip) };
    saveSettings(updated);
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '2.5rem',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
    marginBottom: '2rem'
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
        <ShieldCheck size={36} color="#ff2a5f" />
        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, letterSpacing: '-1px' }}>Global Settings</h2>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: '#ff2a5f' }}>
            <Globe size={24} />
            <h3 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 600 }}>Network Security</h3>
          </div>
          <p style={{ color: '#888', marginBottom: '2rem', lineHeight: 1.6 }}>
            Toggle strict network validation. If enabled, Cloudflare trust scores and AS Organization types are evaluated on every admin request.
          </p>
          
          <label style={{ 
            display: 'flex', alignItems: 'center', cursor: 'pointer', background: 'rgba(0,0,0,0.3)',
            padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)',
            transition: 'all 0.2s'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '0.25rem' }}>Strict VPN & Proxy Block</div>
              <div style={{ fontSize: '0.85rem', color: '#888' }}>Reject connections from known VPN providers or datacenters.</div>
            </div>
            <input 
              type="checkbox" 
              checked={settings.vpnCheckEnabled} 
              onChange={e => saveSettings({ ...settings, vpnCheckEnabled: e.target.checked })}
              disabled={saving}
              style={{ width: '24px', height: '24px', accentColor: '#ff2a5f', cursor: 'pointer' }}
            />
          </label>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: '#ff2a5f' }}>
            <Lock size={24} />
            <h3 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 600 }}>IP Allowlist</h3>
          </div>
          <p style={{ color: '#888', marginBottom: '2rem', lineHeight: 1.6 }}>
            Restrict OmniControl access to specific static IP addresses. If populated, only these IPs bypass the firewall.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <input 
              type="text" 
              placeholder="e.g. 192.168.1.1" 
              value={newIp} 
              onChange={e => setNewIp(e.target.value)}
              style={{ 
                flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', 
                background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '1rem', outline: 'none' 
              }}
            />
            <button 
              onClick={addIp}
              disabled={saving || !newIp}
              style={{ 
                padding: '0 1.5rem', background: 'linear-gradient(135deg, #ff2a5f 0%, #ff4444 100%)', 
                color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontWeight: 600, opacity: (!newIp || saving) ? 0.5 : 1
              }}
            >
              <Plus size={20} /> Add
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {settings.allowlistIps.map(ip => (
              <motion.div 
                key={ip} 
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', 
                  background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' 
                }}
              >
                <span style={{ fontSize: '1rem', letterSpacing: '1px', fontFamily: 'monospace' }}>{ip}</span>
                <button 
                  onClick={() => removeIp(ip)} 
                  disabled={saving}
                  style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '0.5rem' }}
                >
                  <X size={20} />
                </button>
              </motion.div>
            ))}
            {settings.allowlistIps.length === 0 && (
              <div style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>
                No strict IPs configured. System is open to all non-VPN traffic.
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginTop: '2rem' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: '#ff2a5f' }}>
            <Globe size={24} />
            <h3 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 600 }}>Hero Settings</h3>
          </div>
          <p style={{ color: '#888', marginBottom: '2rem', lineHeight: 1.6 }}>
            Select the default hero movie. You can also assign multiplier weights to specific movies to boost them in the recommendation algorithm for users who are already watching the default hero.
          </p>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', color: '#fff', marginBottom: '0.5rem', fontWeight: 600 }}>Default Hero</label>
            <select
              value={settings.defaultHero || ''}
              onChange={e => saveSettings({ ...settings, defaultHero: e.target.value })}
              disabled={saving}
              style={{
                width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '1rem', outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="">-- Select a Movie --</option>
              {movies.map(m => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', color: '#fff', marginBottom: '1rem', fontWeight: 600 }}>Promoted Movies (Multipliers)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {movies.map(m => {
                const weight = settings.promotedWeights?.[m.id] || 1;
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: '#ccc' }}>{m.title}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ color: '#888', fontSize: '0.9rem' }}>Weight: {weight}x</span>
                      <input 
                        type="range" 
                        min="0" max="5" step="0.5" 
                        value={weight} 
                        onChange={e => {
                          const newWeights = { ...settings.promotedWeights, [m.id]: parseFloat(e.target.value) };
                          saveSettings({ ...settings, promotedWeights: newWeights });
                        }}
                        disabled={saving}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
