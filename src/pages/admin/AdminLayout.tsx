import { Outlet, NavLink } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import { ShieldAlert, RefreshCw, LayoutDashboard, Users, Activity, LogOut, Crown } from 'lucide-react';
import { useEffect } from 'react';
import { motion } from 'framer-motion';

export default function AdminLayout() {
  const { isAdminAuth, adminError, loading, checkAuth } = useAdmin();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505', color: '#fff' }}>
        <RefreshCw size={48} className="animate-spin" style={{ color: '#ff2a5f' }} />
      </div>
    );
  }

  if (!isAdminAuth) {
    return (
      <div style={{ 
        height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
        background: 'radial-gradient(circle at center, #1a0509 0%, #050505 100%)', color: '#ff4444', textAlign: 'center', padding: '2rem' 
      }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
          <ShieldAlert size={100} style={{ marginBottom: '1.5rem', filter: 'drop-shadow(0 0 20px rgba(255, 68, 68, 0.5))' }} />
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem', fontWeight: 900, letterSpacing: '-1px', color: '#fff' }}>OmniControl Center</h1>
          <div style={{ 
            background: 'rgba(255, 68, 68, 0.05)', backdropFilter: 'blur(10px)', padding: '2rem', 
            borderRadius: '16px', border: '1px solid rgba(255, 68, 68, 0.2)', maxWidth: '600px', width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <p style={{ fontSize: '1.2rem', margin: 0, wordBreak: 'break-word', color: '#ff8888' }}>{adminError || 'Unknown security violation.'}</p>
          </div>
          <button 
            onClick={() => checkAuth()}
            style={{ 
              marginTop: '3rem', padding: '1rem 3rem', background: 'linear-gradient(135deg, #ff2a5f 0%, #ff4444 100%)', 
              color: '#fff', border: 'none', borderRadius: '50px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold',
              boxShadow: '0 10px 20px rgba(255, 68, 68, 0.3)', transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            RETRY VERIFICATION
          </button>
        </motion.div>
      </div>
    );
  }

  const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.5rem', 
    borderRadius: '12px', color: isActive ? '#fff' : '#888', textDecoration: 'none',
    background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
    transition: 'all 0.2s ease', fontWeight: isActive ? 600 : 400
  });

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', display: 'flex', fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <nav style={{ 
        width: '280px', background: 'rgba(20, 20, 20, 0.6)', backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', padding: '2rem 1.5rem'
      }}>
        <div style={{ 
          fontSize: '1.75rem', fontWeight: 900, letterSpacing: '1px', 
          background: 'linear-gradient(135deg, #ff2a5f 0%, #ff7b7b 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '3rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <ShieldAlert size={28} color="#ff2a5f" style={{ WebkitTextFillColor: 'initial' }} />
          OMNICONTROL
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <NavLink to="/d/a" end style={navLinkStyle}>
            <LayoutDashboard size={20} /> Dashboard
          </NavLink>
          <NavLink to="/d/a/vip" style={navLinkStyle}>
            <Crown size={20} color="#ffd700" /> VIP Control
          </NavLink>
          <NavLink to="/d/a/users" style={navLinkStyle}>
            <Users size={20} /> Users
          </NavLink>
          <NavLink to="/d/a/telemetry" style={navLinkStyle}>
            <Activity size={20} /> Telemetry
          </NavLink>
        </div>


        <a href="/" style={{ 
          display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.5rem', 
          color: '#ff4444', textDecoration: 'none', transition: 'all 0.2s', marginTop: 'auto',
          borderRadius: '12px', background: 'rgba(255, 68, 68, 0.1)'
        }}>
          <LogOut size={20} /> Exit to App
        </a>
      </nav>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '2.5rem 3rem', height: '100vh', overflowY: 'auto', position: 'relative' }}>
        <div style={{ 
          position: 'absolute', top: '-10%', left: '-10%', width: '500px', height: '500px', 
          background: 'radial-gradient(circle, rgba(255,42,95,0.15) 0%, rgba(0,0,0,0) 70%)', zIndex: 0, pointerEvents: 'none' 
        }} />
        <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
