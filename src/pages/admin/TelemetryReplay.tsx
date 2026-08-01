import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Map, Video, Activity, MousePointer2 } from 'lucide-react';

export default function TelemetryReplay() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [traces, setTraces] = useState<any[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<any | null>(null);
  
  const [mode, setMode] = useState<'video' | 'heatmap'>('heatmap');
  const [isPlaying, setIsPlaying] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playFrameRef = useRef<number>(0);
  const currentT = useRef<number>(0);

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => setUsers(d.users || []));
  }, []);

  const loadTraces = async (userId: string) => {
    setSelectedUserId(userId);
    setSelectedTrace(null);
    const res = await fetch(`/api/admin/telemetry/replay?userId=${userId}`);
    const data = await res.json();
    setTraces(data.traces || []);
  };

  useEffect(() => {
    if (!selectedTrace || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Explicitly cleanup any previous playback on mode or trace change
    if (playFrameRef.current) {
      cancelAnimationFrame(playFrameRef.current);
      playFrameRef.current = 0;
    }
    setIsPlaying(false);
    currentT.current = 0;
    
    const splines = selectedTrace.data.splines || [];
    if (splines.length === 0) return;

    if (mode === 'heatmap') {
      ctx.fillStyle = 'rgba(255, 42, 95, 0.1)';
      for (const pt of splines) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 25, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return () => {
      if (playFrameRef.current) {
        cancelAnimationFrame(playFrameRef.current);
        playFrameRef.current = 0;
      }
    };
  }, [selectedTrace, mode]);

  const drawVideoFrame = () => {
    if (!isPlaying || mode !== 'video' || !selectedTrace || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const splines = selectedTrace.data.splines || [];
    const pt = splines[currentT.current];
    
    if (pt) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowColor = 'rgba(255, 42, 95, 0.8)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    currentT.current++;
    if (currentT.current < splines.length) {
      playFrameRef.current = requestAnimationFrame(drawVideoFrame);
    } else {
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (isPlaying && mode === 'video') {
      drawVideoFrame();
    }
  }, [isPlaying]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <MousePointer2 size={36} color="#ff2a5f" />
        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, letterSpacing: '-1px' }}>Telemetry Replay</h2>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0 }}>
        <div style={{ 
          width: '350px', background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)',
          borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', overflowY: 'auto',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>Select User</h3>
          </div>
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {users.map(u => (
              <div 
                key={u.id}
                onClick={() => loadTraces(u.id)}
                style={{ 
                  padding: '1rem', background: selectedUserId === u.id ? 'rgba(255,42,95,0.1)' : 'rgba(0,0,0,0.2)', 
                  border: selectedUserId === u.id ? '1px solid rgba(255,42,95,0.3)' : '1px solid transparent',
                  cursor: 'pointer', borderRadius: '12px', transition: 'all 0.2s', fontWeight: selectedUserId === u.id ? 600 : 400
                }}
              >
                {u.display_name || u.email}
              </div>
            ))}

            <AnimatePresence>
              {selectedUserId && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2rem', marginBottom: '1rem', color: '#ff2a5f', padding: '0 0.5rem' }}>
                    <Activity size={18} />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Available Traces</h3>
                  </div>
                  {traces.length === 0 ? <div style={{ color: '#666', fontStyle: 'italic', padding: '0 0.5rem' }}>No telemetry data found.</div> : null}
                  {traces.map((t, idx) => (
                    <div 
                      key={t.key}
                      onClick={() => setSelectedTrace(t)}
                      style={{ 
                        padding: '1rem', background: selectedTrace?.key === t.key ? 'linear-gradient(135deg, #ff2a5f 0%, #ff4444 100%)' : 'rgba(0,0,0,0.3)', 
                        color: '#fff', cursor: 'pointer', borderRadius: '12px', marginBottom: '0.5rem', fontSize: '0.9rem',
                        boxShadow: selectedTrace?.key === t.key ? '0 5px 15px rgba(255,42,95,0.3)' : 'none',
                        border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s'
                      }}
                    >
                      Session Trace #{idx + 1}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div style={{ 
          flex: 1, background: 'rgba(0,0,0,0.6)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', 
          position: 'relative', overflow: 'hidden', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8)'
        }}>
          <div style={{ 
            position: 'absolute', top: 20, left: 20, display: 'flex', gap: '0.5rem', zIndex: 10,
            background: 'rgba(20,20,20,0.8)', padding: '0.5rem', borderRadius: '12px', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <button 
              onClick={() => setMode('heatmap')}
              style={{ 
                background: mode === 'heatmap' ? 'rgba(255,42,95,0.2)' : 'transparent', 
                color: mode === 'heatmap' ? '#ff2a5f' : '#888', 
                border: mode === 'heatmap' ? '1px solid rgba(255,42,95,0.3)' : '1px solid transparent',
                padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontWeight: 600, transition: 'all 0.2s'
              }}
            >
              <Map size={18} /> Heatmap
            </button>
            <button 
              onClick={() => setMode('video')}
              style={{ 
                background: mode === 'video' ? 'rgba(255,42,95,0.2)' : 'transparent', 
                color: mode === 'video' ? '#ff2a5f' : '#888', 
                border: mode === 'video' ? '1px solid rgba(255,42,95,0.3)' : '1px solid transparent',
                padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontWeight: 600, transition: 'all 0.2s'
              }}
            >
              <Video size={18} /> Replay
            </button>
            
            {mode === 'video' && (
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                style={{ 
                  background: isPlaying ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #ff2a5f 0%, #ff4444 100%)', 
                  border: 'none', color: '#fff', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer', 
                  display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem', fontWeight: 600,
                  boxShadow: isPlaying ? 'none' : '0 5px 15px rgba(255,42,95,0.3)'
                }}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            )}
          </div>
          
          {!selectedTrace && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '1.25rem', pointerEvents: 'none' }}>
              Select a trace to visualize
            </div>
          )}
          
          <canvas 
            ref={canvasRef} 
            width={1920} 
            height={1080} 
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      </div>
    </motion.div>
  );
}
