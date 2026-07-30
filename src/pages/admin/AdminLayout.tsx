import { Outlet } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

export default function AdminLayout() {
  const { isAdminAuth, adminError, loading, checkAuth } = useAdmin();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>
        <RefreshCw size={48} className="animate-spin" />
      </div>
    );
  }

  if (!isAdminAuth) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#ff4444', textAlign: 'center', padding: '2rem' }}>
        <ShieldAlert size={80} style={{ marginBottom: '1rem' }} />
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>OmniControl Center</h1>
        <div style={{ background: 'rgba(255, 68, 68, 0.1)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255, 68, 68, 0.3)', maxWidth: '600px', width: '100%' }}>
          <p style={{ fontSize: '1.2rem', margin: 0, wordBreak: 'break-word' }}>{adminError || 'Unknown security violation.'}</p>
        </div>
        <button 
          onClick={() => checkAuth()}
          style={{ marginTop: '2rem', padding: '0.75rem 2rem', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
        >
          RETRY VERIFICATION
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      <nav style={{ padding: '1rem 2rem', background: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '2px', color: '#ff4444' }}>OMNICONTROL</div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <a href="/d/a" style={{ color: '#fff', textDecoration: 'none' }}>Settings</a>
          <a href="/d/a/users" style={{ color: '#fff', textDecoration: 'none' }}>Users</a>
          <a href="/d/a/telemetry" style={{ color: '#fff', textDecoration: 'none' }}>Telemetry</a>
          <a href="/" style={{ color: '#aaa', textDecoration: 'none' }}>Exit</a>
        </div>
      </nav>
      <main style={{ padding: '2rem' }}>
        <Outlet />
      </main>
    </div>
  );
}
