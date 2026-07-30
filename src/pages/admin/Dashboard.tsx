import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [settings, setSettings] = useState({ vpnCheckEnabled: true, allowlistIps: [] as string[] });
  const [newIp, setNewIp] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => setSettings(d))
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

  return (
    <div>
      <h2 style={{ fontSize: '2rem', marginBottom: '2rem' }}>OmniControl Settings</h2>
      
      <div style={{ background: '#1a1a1a', padding: '2rem', borderRadius: '8px', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', color: '#ff4444' }}>Network Security</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={settings.vpnCheckEnabled} 
              onChange={e => saveSettings({ ...settings, vpnCheckEnabled: e.target.checked })}
              style={{ width: '20px', height: '20px', marginRight: '10px' }}
              disabled={saving}
            />
            <span>Enable strict VPN & Proxy block (Recommended)</span>
          </label>
        </div>

        <h3 style={{ marginBottom: '1rem', color: '#ff4444' }}>IP Allowlist</h3>
        <p style={{ marginBottom: '1rem', color: '#aaa' }}>If populated, ONLY these IPs can access the OmniControl Center.</p>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <input 
            type="text" 
            placeholder="Enter IP Address..." 
            value={newIp} 
            onChange={e => setNewIp(e.target.value)}
            style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #333', background: '#000', color: '#fff', flex: 1 }}
          />
          <button 
            onClick={addIp}
            disabled={saving}
            style={{ padding: '0.75rem 2rem', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Add IP
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {settings.allowlistIps.map(ip => (
            <div key={ip} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#000', borderRadius: '4px' }}>
              <span>{ip}</span>
              <button 
                onClick={() => removeIp(ip)} 
                disabled={saving}
                style={{ background: '#ff4444', border: 'none', color: '#fff', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}
              >
                Remove
              </button>
            </div>
          ))}
          {settings.allowlistIps.length === 0 && <div style={{ color: '#666' }}>No IPs allowlisted. Open to any IP (subject to VPN checks).</div>}
        </div>
      </div>
    </div>
  );
}
