import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Map, Video } from 'lucide-react';

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
    
    const splines = selectedTrace.data.splines || [];
    if (splines.length === 0) return;

    if (mode === 'heatmap') {
      setIsPlaying(false);
      ctx.fillStyle = 'rgba(255, 68, 68, 0.05)';
      for (const pt of splines) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 20, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      currentT.current = 0;
      drawVideoFrame();
    }

    return () => {
      if (playFrameRef.current) cancelAnimationFrame(playFrameRef.current);
    };
  }, [selectedTrace, mode]);

  const drawVideoFrame = () => {
    if (!isPlaying || mode !== 'video' || !selectedTrace || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const splines = selectedTrace.data.splines || [];
    const pt = splines[currentT.current];
    
    if (pt) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fill();
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
    <div>
      <h2 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Telemetry Replay</h2>

      <div style={{ display: 'flex', gap: '2rem' }}>
        <div style={{ width: '300px', background: '#111', padding: '1rem', borderRadius: '8px', overflowY: 'auto', maxHeight: '70vh' }}>
          <h3 style={{ marginBottom: '1rem', color: '#ff4444' }}>Select User</h3>
          {users.map(u => (
            <div 
              key={u.id}
              onClick={() => loadTraces(u.id)}
              style={{ padding: '0.5rem', background: selectedUserId === u.id ? '#333' : 'transparent', cursor: 'pointer', borderRadius: '4px' }}
            >
              {u.display_name || u.email}
            </div>
          ))}

          {selectedUserId && (
            <>
              <h3 style={{ marginTop: '2rem', marginBottom: '1rem', color: '#ff4444' }}>Traces</h3>
              {traces.length === 0 ? <div style={{ color: '#666' }}>No traces</div> : null}
              {traces.map((t, idx) => (
                <div 
                  key={t.key}
                  onClick={() => setSelectedTrace(t)}
                  style={{ padding: '0.5rem', background: selectedTrace?.key === t.key ? '#ff4444' : '#222', color: '#fff', cursor: 'pointer', borderRadius: '4px', marginBottom: '0.5rem', fontSize: '0.85rem' }}
                >
                  Trace {idx + 1}
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ flex: 1, background: '#000', borderRadius: '8px', border: '1px solid #333', position: 'relative', overflow: 'hidden', height: '70vh' }}>
          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: '0.5rem', zIndex: 10 }}>
            <button 
              onClick={() => setMode('heatmap')}
              style={{ background: mode === 'heatmap' ? '#ff4444' : '#333', border: 'none', color: '#fff', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Map size={16} /> Heatmap
            </button>
            <button 
              onClick={() => setMode('video')}
              style={{ background: mode === 'video' ? '#ff4444' : '#333', border: 'none', color: '#fff', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Video size={16} /> Video Replay
            </button>
            
            {mode === 'video' && (
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                style={{ background: '#333', border: 'none', color: '#fff', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem' }}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            )}
          </div>
          <canvas 
            ref={canvasRef} 
            width={1920} 
            height={1080} 
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      </div>
    </div>
  );
}
