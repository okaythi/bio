import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Plus, X, Globe, Lock, Activity, Search, Film, Tv, Check, Trash2, Sparkles } from 'lucide-react';
import { searchMulti, getImageUrl, type TMDBSearchResult } from '../../services/tmdb';

export default function Dashboard() {
  const [settings, setSettings] = useState({ vpnCheckEnabled: true, allowlistIps: [] as string[], defaultHero: '', promotedWeights: {} as Record<string, number>, comingSoonList: [] as any[] });
  const [newIp, setNewIp] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [ipError, setIpError] = useState('');
  const [movies, setMovies] = useState<{id: string, title: string}[]>([]);
  const [stats, setStats] = useState({ totalAutoPlays: 0, highestChurn: 'N/A', highestChurnRate: '0%', completionRate: '0%', trend: '', trendCompletion: '' });
  const [statsError, setStatsError] = useState('');

  const [tmdbQuery, setTmdbQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => setSettings({ vpnCheckEnabled: true, allowlistIps: [], defaultHero: '', promotedWeights: {}, comingSoonList: [], ...d }))
      .catch(() => setSettingsError('BIO-701: Failed to load admin settings'));
    fetch('/api/movies')
      .then(r => r.json())
      .then(d => setMovies(d))
      .catch(console.error);
    fetch('/api/admin/telemetry/stats')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setStats(d);
      })
      .catch((e) => setStatsError(e.message || 'BIO-700: Failed to fetch admin telemetry stats'));
  }, []);

  useEffect(() => {
    if (!tmdbQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchMulti(tmdbQuery);
        if (active) {
          setSearchResults(results);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [tmdbQuery]);

  const saveSettings = async (updated: typeof settings) => {
    setSaving(true);
    setSettingsError('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data);
      } else {
        setSettingsError(data.error || 'BIO-701: Failed to save global admin settings');
      }
    } catch (err: any) {
      setSettingsError(`BIO-701: Failed to save global admin settings - ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const addIp = () => {
    if (!newIp) return;
    setIpError('');
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}$/;
    if (!ipRegex.test(newIp)) {
      setIpError('BIO-704: Invalid IP address format');
      return;
    }
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

  const addComingSoonItem = (item: TMDBSearchResult) => {
    const title = item.title || item.name || '';
    const releaseDate = item.release_date || item.first_air_date || '';
    const year = releaseDate ? releaseDate.split('-')[0] : 'TBA';
    
    const newItem = {
      id: `cs-${item.id}`,
      tmdbId: item.id,
      title,
      type: item.media_type,
      year,
      overview: item.overview,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      isComingSoon: true
    };

    const currentList = settings.comingSoonList || [];
    if (currentList.some((i: any) => (i.tmdbId && item.id && i.tmdbId === item.id) || (i.title && title && i.title.toLowerCase() === title.toLowerCase()))) {
      return;
    }

    const updatedList = [...currentList, newItem];
    saveSettings({ ...settings, comingSoonList: updatedList });
    setShowDropdown(false);
    setTmdbQuery('');
  };

  const removeComingSoonItem = (id: string) => {
    const currentList = settings.comingSoonList || [];
    const updatedList = currentList.filter((i: any) => i.id !== id);
    saveSettings({ ...settings, comingSoonList: updatedList });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
        <ShieldCheck size={36} color="#ff2a5f" />
        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, letterSpacing: '-1px' }}>Global Settings</h2>
      </div>

      {settingsError && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '12px', marginBottom: '2rem', fontWeight: 600 }}>
          {settingsError}
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: '#ff2a5f' }}>
          <Sparkles size={24} />
          <h3 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 600 }}>TMDB Content Lookup & "Coming Soon" Manager</h3>
        </div>
        <p style={{ color: '#888', marginBottom: '2rem', lineHeight: 1.6 }}>
          Search the TMDB database for upcoming movies or TV shows and save them to the "Coming Soon" category on the main page.
        </p>

        <div style={{ position: 'relative', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem' }}>
            <Search size={22} color="#888" style={{ marginRight: '0.75rem' }} />
            <input 
              type="text" 
              placeholder="Search movie or TV show on TMDB (e.g. Solo Leveling, Inception)..."
              value={tmdbQuery}
              onChange={(e) => setTmdbQuery(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '1.1rem', outline: 'none', padding: '0.5rem 0' }}
            />
            {isSearching && <div className="spinner-ring" style={{ width: 20, height: 20, borderWidth: 2 }} />}
          </div>

          <AnimatePresence>
            {showDropdown && searchResults.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.5rem',
                  background: 'rgba(20, 20, 20, 0.95)', backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '14px',
                  maxHeight: '380px', overflowY: 'auto', zIndex: 100, boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
                }}
              >
                {searchResults.map((item) => {
                  const title = item.title || item.name || '';
                  const releaseDate = item.release_date || item.first_air_date || '';
                  const year = releaseDate ? releaseDate.split('-')[0] : 'TBA';
                  const poster = getImageUrl(item.poster_path || item.backdrop_path, 'w500');
                  
                  const isInLibrary = movies.some(m => m.title.toLowerCase() === title.toLowerCase());
                  const isAlreadyComingSoon = (settings.comingSoonList || []).some((cs: any) => cs.tmdbId === item.id || cs.title.toLowerCase() === title.toLowerCase());

                  return (
                    <div 
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1.25rem',
                        borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,42,95,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: '45px', height: '65px', borderRadius: '6px', overflow: 'hidden', background: '#333', flexShrink: 0 }}>
                        {poster ? <img src={poster} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #333, #111)' }} />}
                      </div>

                      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '1.05rem', color: '#fff' }}>{title}</span>
                          <span style={{
                            fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
                            background: item.media_type === 'tv' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: item.media_type === 'tv' ? '#60a5fa' : '#f87171', border: `1px solid ${item.media_type === 'tv' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                            display: 'flex', alignItems: 'center', gap: '0.25rem'
                          }}>
                            {item.media_type === 'tv' ? <Tv size={12} /> : <Film size={12} />}
                            {item.media_type === 'tv' ? 'TV Show' : 'Movie'}
                          </span>
                        </div>

                        <span style={{ fontSize: '0.85rem', color: '#888' }}>
                          {item.media_type === 'tv' ? `TV Series • ${year}` : `Movie • ${year}`}
                        </span>
                      </div>

                      <div>
                        {isInLibrary ? (
                          <span style={{ fontSize: '0.85rem', color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid rgba(74, 222, 128, 0.3)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Check size={14} /> In Library (Playable)
                          </span>
                        ) : isAlreadyComingSoon ? (
                          <span style={{ fontSize: '0.85rem', color: '#facc15', background: 'rgba(250, 204, 21, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid rgba(250, 204, 21, 0.3)' }}>
                            In Coming Soon
                          </span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); addComingSoonItem(item); }}
                            style={{
                              padding: '0.4rem 0.9rem', background: 'linear-gradient(135deg, #ff2a5f 0%, #ff4444 100%)',
                              color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                              display: 'flex', alignItems: 'center', gap: '0.3rem'
                            }}
                          >
                            <Plus size={14} /> Add to Coming Soon
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div>
          <h4 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 600 }}>Active "Coming Soon" Titles ({settings.comingSoonList?.length || 0})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(settings.comingSoonList || []).map((cs: any) => (
              <div 
                key={cs.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem',
                  background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '40px', height: '55px', background: '#222', borderRadius: '4px', overflow: 'hidden' }}>
                    {cs.poster_path ? <img src={getImageUrl(cs.poster_path, 'w500')} alt={cs.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{cs.title}</div>
                    <div style={{ fontSize: '0.85rem', color: '#888' }}>{cs.type === 'tv' ? 'TV Show' : 'Movie'} • {cs.year}</div>
                  </div>
                </div>

                <button 
                  onClick={() => removeComingSoonItem(cs.id)}
                  style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '0.5rem' }}
                  title="Remove from Coming Soon"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}

            {(settings.comingSoonList || []).length === 0 && (
              <div style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>
                No titles in "Coming Soon". Use the search bar above to look up movies or TV shows on TMDB.
              </div>
            )}
          </div>
        </div>
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
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <input 
                type="text" 
                placeholder="e.g. 192.168.1.1" 
                value={newIp} 
                onChange={e => { setNewIp(e.target.value); setIpError(''); }}
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
            {ipError && <div style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 600 }}>{ipError}</div>}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginTop: '2rem' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: '#ff2a5f' }}>
            <Activity size={24} />
            <h3 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 600 }}>TV Show Analytics & Churn</h3>
          </div>
          <p style={{ color: '#888', marginBottom: '2rem', lineHeight: 1.6 }}>
            Track season progression and identify at which episodes users are dropping off. This data is fed directly from the deep telemetry in the video player.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Auto-Plays (Next Ep)</div>
              {statsError ? <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>{statsError}</div> : (
                <>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>{stats.totalAutoPlays.toLocaleString()}</div>
                  <div style={{ color: '#4ade80', fontSize: '0.85rem', marginTop: '0.5rem' }}>{stats.trend || '+0% this week'}</div>
                </>
              )}
            </div>
            
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Highest Churn Point</div>
              {statsError ? <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>{statsError}</div> : (
                <>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff' }}>{stats.highestChurn}</div>
                  <div style={{ color: '#ff4444', fontSize: '0.85rem', marginTop: '0.5rem' }}>{stats.highestChurnRate}</div>
                </>
              )}
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Season Completion Rate</div>
              {statsError ? <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>{statsError}</div> : (
                <>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>{stats.completionRate}</div>
                  <div style={{ color: '#4ade80', fontSize: '0.85rem', marginTop: '0.5rem' }}>{stats.trendCompletion || 'Average across all shows'}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
