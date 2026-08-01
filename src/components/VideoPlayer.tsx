import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Subtitles, Gauge, Keyboard, Type } from 'lucide-react';
import type { MovieMetadata } from '../config/library';
import { useAuth } from '../context/AuthContext';
import { telemetry } from '../services/telemetry';
import { globalTracker } from '../lib/telemetry/OmniTracker';

interface VideoPlayerProps {
  metadata: MovieMetadata;
  initialSeason?: number;
  initialEpisode?: number;
}

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  fr: 'Français',
  nl: 'Nederlands',
  'pt-BR': 'Português (BR)',
  ja: 'Japanese',
};

const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export default function VideoPlayer({ metadata, initialSeason, initialEpisode }: VideoPlayerProps) {
  const { user, updatePreferences, watchHistory } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const subMenuRef = useRef<HTMLDivElement>(null);
  const episodesMenuRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isSessionRevoked, setIsSessionRevoked] = useState(false);

  const [currentSeason, setCurrentSeason] = useState(initialSeason || (metadata.seasons?.[0]?.seasonNumber ?? 1));
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState((initialEpisode ? initialEpisode - 1 : 0));
  
  const currentEpisodeData = metadata.type === 'tv' 
    ? metadata.seasons?.find(s => s.seasonNumber === currentSeason)?.episodes[currentEpisodeIndex]
    : undefined;

  const [activeVideoUrl, setActiveVideoUrl] = useState(currentEpisodeData ? currentEpisodeData.videoUrl : metadata.videoUrl);
  const [isUsingH264Fallback, setIsUsingH264Fallback] = useState(false);
  const [showH264Tooltip, setShowH264Tooltip] = useState(false);

  useEffect(() => {
    if (currentEpisodeData) {
      setActiveVideoUrl(currentEpisodeData.videoUrl);
      setIsUsingH264Fallback(false);
      setProgress(0);
      setVideoError(null);
      if (videoRef.current) {
        videoRef.current.load();
      }
    }
  }, [currentEpisodeData]);

  const userPrefTheme = user?.preferences?.theme || 'dark';
  let activeTheme = userPrefTheme;
  if (userPrefTheme === 'system') {
    activeTheme = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [vttUrls, setVttUrls] = useState<Map<string, string>>(new Map());
  const [showLangMenu, setShowLangMenu] = useState(false);

  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const [showEpisodesMenu, setShowEpisodesMenu] = useState(false);

  const [subSize, setSubSize] = useState('3.2vh');
  const [showSubMenu, setShowSubMenu] = useState(false);

  const [showShortcuts, setShowShortcuts] = useState(false);

  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [hoverX, setHoverX] = useState(0);
  const [hoverTime, setHoverTime] = useState(0);

  const timeoutRef = useRef<number | null>(null);
  const hasSeekedRef = useRef(false);
  
  const isMutedRef = useRef(false);
  const volumeRef = useRef(100);
  const selectedLangRef = useRef<string | null>(null);

  const handleCanPlay = () => {
    setIsBuffering(false);
  };

  useEffect(() => {
    const checkShortcuts = async () => {
      if (user && user.preferences) {
        let uiSettings: any = {};
        try {
          uiSettings = typeof user.preferences.ui_settings_json === 'string'
            ? JSON.parse(user.preferences.ui_settings_json)
            : (user.preferences.ui_settings_json || {});
        } catch (e) {}
        
        if (!uiSettings.has_seen_shortcuts) {
          setShowShortcuts(true);
          setTimeout(() => setShowShortcuts(false), 8000);
          if (updatePreferences) {
            updatePreferences({
              ui_settings_json: JSON.stringify({ ...uiSettings, has_seen_shortcuts: true })
            }).catch(console.error);
          }
        }
      }
    };
    checkShortcuts();
  }, [user]);

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  useEffect(() => {
    if (isUsingH264Fallback && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(err => {
        console.warn('[BIO-006] Auto-play after H.264 fallback prevented by browser:', err);
      });
    }
  }, [activeVideoUrl, isUsingH264Fallback]);
  useEffect(() => { selectedLangRef.current = selectedLang; }, [selectedLang]);

  useEffect(() => {
    if (metadata.type === 'tv' && currentEpisodeData) {
      localStorage.setItem(`bio-last-episode-${metadata.id}`, JSON.stringify({
        season: currentSeason,
        episode: currentEpisodeIndex + 1
      }));
    }
  }, [metadata.id, metadata.type, currentSeason, currentEpisodeIndex, currentEpisodeData]);

  useEffect(() => {
    const isPC = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const timeoutDuration = isPC ? 3030 : 2500;

    const handleMouseMove = () => {
      setShowControls(true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
          setShowLangMenu(false);
          setShowSpeedMenu(false);
          setShowSubMenu(false);
          setShowEpisodesMenu(false);
        }
      }, timeoutDuration);
    };

    handleMouseMove();
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
          else { videoRef.current.pause(); setIsPlaying(false); }
        }
      } else if (e.code === 'KeyF') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
      } else if (e.code === 'KeyM') {
        if (videoRef.current) {
          if (isMutedRef.current) {
            const newVol = volumeRef.current === 0 ? 50 : volumeRef.current;
            videoRef.current.volume = newVol / 100;
            videoRef.current.muted = false;
            setVolume(newVol);
            setIsMuted(false);
          } else {
            videoRef.current.muted = true;
            setVolume(0);
            setIsMuted(true);
          }
        }
      } else if (e.code === 'KeyC') {
        if (metadata.subtitles && metadata.subtitles.length > 0) {
          const langs = metadata.subtitles.map(s => s.lang);
          const currentLang = selectedLangRef.current;
          const currentIndex = currentLang ? langs.indexOf(currentLang) : -1;
          const nextIndex = currentIndex + 1;
          
          if (nextIndex < langs.length) {
            setSelectedLang(langs[nextIndex]);
          } else {
            setSelectedLang(null);
          }
        }
      } else if (e.code === 'ArrowRight') {
        if (videoRef.current) videoRef.current.currentTime += 10;
      } else if (e.code === 'ArrowLeft') {
        if (videoRef.current) videoRef.current.currentTime -= 10;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [metadata.subtitles]); 

  useEffect(() => {
    const urls = new Map<string, string>();
    const promises: Promise<void>[] = [];

    const subs = currentEpisodeData?.subtitles || metadata.subtitles;

    if (subs && subs.length > 0) {
      subs.forEach(sub => {
        const fetchUrl = `${sub.url}?t=${Date.now()}`;
        const p = fetch(fetchUrl)
          .then(r => r.ok ? r.text() : null)
          .then(srtText => {
            if (!srtText) return;
            const isJapanese = sub.lang === 'ja';
            const vttText = "WEBVTT\n\n" + srtText
              .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
              .replace(/(-->\s+\d{2}:\d{2}:\d{2}\.\d{3})/g, isJapanese ? "$1 line:82%" : "$1 line:85%");
            const blob = new Blob([vttText], { type: "text/vtt" });
            const url = URL.createObjectURL(blob);
            urls.set(sub.lang, url);
          })
          .catch(console.error);
        promises.push(p);
      });
    }

    Promise.all(promises).then(() => {
      setVttUrls(new Map(urls));
    });

    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [metadata.subtitles, currentEpisodeData]);

  useEffect(() => {
    if (!videoRef.current) return;
    for (let i = 0; i < videoRef.current.textTracks.length; i++) {
      const track = videoRef.current.textTracks[i];
      track.mode = track.language === selectedLang ? 'showing' : 'hidden';
    }
  }, [selectedLang, vttUrls]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (langMenuRef.current && !langMenuRef.current.contains(target)) setShowLangMenu(false);
      if (speedMenuRef.current && !speedMenuRef.current.contains(target)) setShowSpeedMenu(false);
      if (subMenuRef.current && !subMenuRef.current.contains(target)) setShowSubMenu(false);
      if (episodesMenuRef.current && !episodesMenuRef.current.contains(target)) setShowEpisodesMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        const newVol = volume === 0 ? 50 : volume;
        videoRef.current.volume = newVol / 100;
        videoRef.current.muted = false;
        setVolume(newVol);
        setIsMuted(false);
      } else {
        videoRef.current.muted = true;
        setVolume(0);
        setIsMuted(true);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val / 100;
      if (val === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
      } else {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const toggleLangMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowLangMenu(prev => !prev);
    setShowSpeedMenu(false);
    setShowSubMenu(false);
  };

  const selectLanguage = (lang: string | null) => {
    setSelectedLang(lang);
    setShowLangMenu(false);
  };

  const toggleSpeedMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSpeedMenu(prev => !prev);
    setShowLangMenu(false);
    setShowSubMenu(false);
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setShowSpeedMenu(false);
  };

  const toggleSubMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSubMenu(prev => !prev);
    setShowLangMenu(false);
    setShowSpeedMenu(false);
  };

  const handleSubSizeChange = (size: string) => {
    setSubSize(size);
    setShowSubMenu(false);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setProgress((current / total) * 100);

      if (!isNaN(total) && total > 0) {
        if (!hasSeekedRef.current) {
          hasSeekedRef.current = true;
          
          const historyItem = watchHistory?.find(h => h.movie_id === metadata.id);
          if (historyItem && historyItem.progress_seconds > 0) {
            const savedPct = (historyItem.progress_seconds / total) * 100;
            if (savedPct > 0 && savedPct <= 94.57) {
              videoRef.current.currentTime = historyItem.progress_seconds;
              return;
            }
          } else {
            const savedStr = localStorage.getItem(`bio-progress-${metadata.id}`);
            if (savedStr) {
              const savedPct = parseFloat(savedStr);
              if (savedPct > 0 && savedPct <= 94.57) {
                videoRef.current.currentTime = (savedPct / 100) * total;
                return;
              }
            }
          }
        }

        const pct = (current / total) * 100;
        const storageKey = `bio-progress-${metadata.id}${currentEpisodeData ? `-${currentSeason}-${currentEpisodeIndex}` : ''}`;
        const savedStr = localStorage.getItem(storageKey);
        const savedPct = savedStr ? parseFloat(savedStr) : 0;
        
        if (savedPct > 94.57) {
          if (pct > 5.13) {
            localStorage.setItem(storageKey, pct.toString());
          }
        } else {
          localStorage.setItem(storageKey, pct.toString());
        }

        // Handle Auto-Play Next Episode
        if (metadata.type === 'tv' && pct >= 99) {
          const uiSettings = user?.preferences?.ui_settings_json ? JSON.parse(user.preferences.ui_settings_json) : {};
          if (uiSettings.autoplay_next !== false) {
             const currentSeasonData = metadata.seasons?.find(s => s.seasonNumber === currentSeason);
             if (currentSeasonData && currentEpisodeIndex < currentSeasonData.episodes.length - 1) {
                setCurrentEpisodeIndex(prev => prev + 1);
                telemetry.track('episode_auto_advanced', { movieId: metadata.id, season: currentSeason, nextEpisode: currentEpisodeIndex + 1 });
             } else if (currentSeasonData) {
                // Next season
                const nextSeason = metadata.seasons?.find(s => s.seasonNumber === currentSeason + 1);
                if (nextSeason && nextSeason.episodes.length > 0) {
                   setCurrentSeason(currentSeason + 1);
                   setCurrentEpisodeIndex(0);
                   telemetry.track('season_auto_advanced', { movieId: metadata.id, nextSeason: currentSeason + 1 });
                }
             }
          }
        }
      }

      if (metadata.hasIntro && metadata.introStart && metadata.introEnd) {
        if (current >= metadata.introStart && current <= metadata.introEnd) {
          setShowSkipIntro(true);
        } else {
          setShowSkipIntro(false);
        }
      }
    }
  };

  const handleSkipIntro = () => {
    if (videoRef.current && metadata.introEnd) {
      videoRef.current.currentTime = metadata.introEnd;
      setShowSkipIntro(false);
    }
  };

  useEffect(() => {
    if (!user) return; 
    
    const sendProgress = () => {
      if (!videoRef.current) return;
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      if (isNaN(total) || total <= 0) return;
      
      const payload = {
        movieId: metadata.id,
        progressSeconds: current,
        durationSeconds: total,
        season: currentEpisodeData ? currentSeason : undefined,
        episode: currentEpisodeData ? currentEpisodeIndex + 1 : undefined
      };
      
      fetch('/api/user/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => {
         if (res.status === 401 || res.status === 403) {
            setIsSessionRevoked(true);
            setIsPlaying(false);
            if (videoRef.current) {
               videoRef.current.pause();
            }
         }
      })
      .catch(() => {});
      
      telemetry.track('video_progress_heartbeat', payload);
    };

    const interval = setInterval(() => {
      if (isPlaying) sendProgress();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [isPlaying, metadata.id, user]);

  useEffect(() => {
    if (!videoRef.current) return;
    
    const sendBeacon = (progress: number, duration: number) => {
      if (!user || isNaN(duration) || duration <= 0) return;
      const payload = JSON.stringify({
        movieId: metadata.id,
        progressSeconds: progress,
        durationSeconds: duration
      });
      
      fetch('/api/user/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(() => {});
    };
    
    globalTracker.attachVideoTracker(metadata.id, videoRef.current, sendBeacon);
    
    const handlePageHide = () => {
       if (videoRef.current) {
          sendBeacon(videoRef.current.currentTime, videoRef.current.duration);
       }
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [metadata.id, user]);

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const time = percentage * videoRef.current.duration;
    
    setHoverX(x);
    setHoverTime(time);
    setIsHoveringProgress(true);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!progressBarRef.current || !videoRef.current) return;
    
    const duration = videoRef.current.duration;
    if (isNaN(duration) || duration === 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    
    videoRef.current.currentTime = percentage * duration;
    setProgress(percentage * 100);
  };

  return (
    <div 
      className={`video-container ${!showControls ? 'hide-cursor' : ''}`} 
      data-sub-lang={selectedLang}
      style={{ '--sub-size': subSize } as React.CSSProperties}
    >
      <video
        ref={videoRef}
        src={activeVideoUrl}
        className="video-element"
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        autoPlay
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={handleCanPlay}
        onTimeUpdate={handleTimeUpdate}
        onError={(e) => {
          const mediaError = e.currentTarget.error;
          const isCodecOrFormatError =
            !mediaError ||
            mediaError.code === MediaError.MEDIA_ERR_DECODE ||
            mediaError.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ||
            (mediaError.message && (
              mediaError.message.includes('NOT_SUPPORTED') ||
              mediaError.message.includes('0x80060003') ||
              mediaError.message.includes('codecs') ||
              mediaError.message.includes('HEVC')
            ));

          if (isCodecOrFormatError && metadata.h264Url && !isUsingH264Fallback) {
            console.info(
              `[BIO-006] HEVC unsupported by browser. Automatically falling back to H.264 stream:\n${metadata.h264Url}`
            );
            setActiveVideoUrl(metadata.h264Url);
            setIsUsingH264Fallback(true);
            setVideoError(null);
          } else if (isUsingH264Fallback) {
            const bioMsg = 'BIO-008: Failed to play H.264 fallback stream. Please check video file format.';
            console.error(`[BIO-008] H.264 Fallback Playback Error:`, mediaError?.message || mediaError);
            setVideoError(bioMsg);
          } else if (isCodecOrFormatError) {
            const bioMsg = 'BIO-006: Unsupported video codec (HEVC/H.265). This browser cannot play this video format.';
            console.error(
              `[BIO-006] Intercepted Video Error: Unsupported Codec (HEVC/H.265)\n` +
              `URL: ${activeVideoUrl}\n` +
              `MediaError Code: ${mediaError?.code ?? 'N/A'}\n` +
              `Details: ${mediaError?.message || 'NS_ERROR_DOM_MEDIA_NOT_SUPPORTED_ERR (0x80060003)'}\n` +
              `Fix: Transcode video stream to H.264 (AVC) using FFmpeg (-c:v libx264 / -c:v h264_qsv).`
            );
            setVideoError(bioMsg);
          } else {
            const bioMsg = `BIO-007: Failed to load video stream (Error code ${mediaError?.code || 'unknown'}).`;
            console.error(`[BIO-007] Video Playback Error:`, mediaError?.message || mediaError);
            setVideoError(bioMsg);
          }
          setIsBuffering(false);
        }}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      >
        {Array.from(vttUrls.entries()).map(([lang, url]) => (
          <track
            key={lang}
            kind="subtitles"
            src={url}
            srcLang={lang}
            label={LANG_LABELS[lang] || lang}
          />
        ))}
      </video>
      
      {isBuffering && !videoError && (
        <div className="custom-spinner">
          <div className="spinner-ring"></div>
        </div>
      )}

      {showShortcuts && (
        <div className="shortcuts-toast">
          <Keyboard size={18} />
          <span>Keyboard Shortcuts: <b>Space</b> Play/Pause &nbsp;•&nbsp; <b>F</b> Fullscreen &nbsp;•&nbsp; <b>M</b> Mute &nbsp;•&nbsp; <b>C</b> Subtitles &nbsp;•&nbsp; <b>Arrows</b> Seek</span>
        </div>
      )}

      {videoError && !isSessionRevoked && (
        <div className="video-error-overlay">
          <div className="video-error-content">
            <span className="video-error-icon">⚠</span>
            <p className="video-error-message">{videoError}</p>
            <button className="play-button" onClick={() => navigate(-1)}>← Go Back</button>
          </div>
        </div>
      )}

      {isSessionRevoked && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.85)', padding: '1.5rem 2rem', borderRadius: '12px',
          border: '1px solid rgba(255,42,95,0.4)', zIndex: 1000,
          color: '#fff', fontSize: '1.2rem', fontWeight: 600, textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}>
          You have been logged out.
          <div style={{ marginTop: '1rem' }}>
            <button 
              onClick={() => { window.location.href = '/'; }}
              style={{
                background: '#ff2a5f', border: 'none', color: '#fff', padding: '0.5rem 1.5rem',
                borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem'
              }}
            >
              Go to Home
            </button>
          </div>
        </div>
      )}

      <div className={`video-controls ${showControls ? 'show' : 'hide'}`}>
        <div className="controls-top">
          <button className="back-button" onClick={() => navigate(-1)}>
            <ArrowLeft size={32} color="white" />
          </button>
        </div>

        <div 
          className="controls-middle" 
          style={{ flexGrow: 1, width: '100%', cursor: 'pointer' }} 
          onClick={togglePlay}
        />

        {showSkipIntro && (
          <button className="skip-intro-btn" onClick={handleSkipIntro}>
            Skip Intro
          </button>
        )}

        <div className="controls-bottom">
          <div 
            className="progress-bar-container"
            ref={progressBarRef}
            onMouseMove={handleProgressMouseMove}
            onMouseLeave={() => setIsHoveringProgress(false)}
            onClick={handleProgressClick}
          >
            {isHoveringProgress && (
              <div 
                className="thumbnail-preview"
                style={{ left: `${hoverX}px` }}
              >
                <span className="thumbnail-time">{formatTime(hoverTime)}</span>
              </div>
            )}
            <div className="progress-bar">
              <div className="progress-filled" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
          
          <div className="controls-actions">
            <div className="controls-left">
              <button onClick={togglePlay}>
                {isPlaying ? <Pause size={28} color="white" /> : <Play size={28} color="white" />}
              </button>
              
              <div className="player-volume-container">
                <div className="volume-slider-wrapper">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={volume} 
                    onChange={handleVolumeChange}
                    className="volume-slider"
                    orient="vertical"
                  />
                </div>
                <button onClick={toggleMute}>
                  {isMuted ? <VolumeX size={28} color="white" /> : <Volume2 size={28} color="white" />}
                </button>
              </div>

              <span className="video-title">
                  {metadata.title} {currentEpisodeData && `- Season ${currentSeason} Episode ${currentEpisodeIndex + 1}: ${currentEpisodeData.title.replace(/\.en$/i, '')}`}
                {(() => {
                  const currentSec = (progress / 100) * (videoRef.current?.duration || 0);
                  const ch = currentEpisodeData?.chapters?.find(c => currentSec >= c.start && currentSec < c.end) || metadata.chapters?.find(c => currentSec >= c.start && currentSec < c.end);
                  return ch ? <span className="chapter-title" style={{ opacity: 0.75, fontWeight: 400, marginLeft: 8 }}> — {ch.title}</span> : null;
                })()}
              </span>
            </div>
            
            <div className="controls-right">
              {metadata.type === 'tv' && metadata.seasons && (
                <div className="cc-menu-container" style={{ position: 'relative' }} ref={episodesMenuRef}>
                  {showEpisodesMenu && (
                    <div className="cc-dropdown" style={{ minWidth: '200px', maxHeight: '300px', overflowY: 'auto' }}>
                      <div className="menu-header">Episodes - S{currentSeason}</div>
                      {metadata.seasons.find(s => s.seasonNumber === currentSeason)?.episodes.map((ep, idx) => (
                        <button 
                          key={ep.id}
                          className={idx === currentEpisodeIndex ? 'lang-active' : ''}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setCurrentEpisodeIndex(idx);
                            setShowEpisodesMenu(false);
                          }}
                        >
                          {idx + 1}. {ep.title}
                        </button>
                      ))}
                    </div>
                  )}
                  <button 
                    className="cc-button" 
                    onClick={(e) => { e.stopPropagation(); setShowEpisodesMenu(prev => !prev); }}
                    title="Episodes Menu"
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>EP</div>
                  </button>
                  <button 
                      onClick={() => {
                        // Find next available episode in current season
                        const currentSeasonData = metadata.seasons?.find(s => s.seasonNumber === currentSeason);
                        if (currentSeasonData) {
                          const nextAvailIdx = currentSeasonData.episodes.findIndex((ep, idx) => idx > currentEpisodeIndex && (ep.isAvailable ?? true));
                          if (nextAvailIdx !== -1) {
                            setCurrentEpisodeIndex(nextAvailIdx);
                            return;
                          }
                          // No more available episodes in this season, try next season
                          const nextSeason = metadata.seasons?.find(s => s.seasonNumber === currentSeason + 1);
                          if (nextSeason) {
                            const firstAvailIdx = nextSeason.episodes.findIndex(ep => ep.isAvailable ?? true);
                            if (firstAvailIdx !== -1) {
                              setCurrentSeason(currentSeason + 1);
                              setCurrentEpisodeIndex(firstAvailIdx);
                              return;
                            }
                          }
                        }
                        // Fallback: just increment if nothing else
                        if (currentSeasonData && currentEpisodeIndex < currentSeasonData.episodes.length - 1) {
                          setCurrentEpisodeIndex(prev => prev + 1);
                        } else if (currentSeasonData) {
                          const nextSeason = metadata.seasons?.find(s => s.seasonNumber === currentSeason + 1);
                          if (nextSeason && nextSeason.episodes.length > 0) {
                            setCurrentSeason(currentSeason + 1);
                            setCurrentEpisodeIndex(0);
                          }
                        }
                      }}
                      title="Next Episode"
                      className="cc-button"
                    >
                      <Play size={20} color="white" />
                    </button>
                </div>
              )}
              {isUsingH264Fallback && (
                <div 
                  className="h264-badge-container"
                  onMouseEnter={() => setShowH264Tooltip(true)}
                  onMouseLeave={() => setShowH264Tooltip(false)}
                >
                  {showH264Tooltip && (
                    <div className={`h264-chat-bubble ${activeTheme}`}>
                      This video has been transcoded from HEVC. Your browser does not support HEVC.
                      <div className="h264-chat-bubble-arrow" />
                    </div>
                  )}
                  <span className="h264-badge">H.264</span>
                </div>
              )}

              {vttUrls.size > 0 && (
                <div className="cc-menu-container" ref={subMenuRef}>
                  {showSubMenu && (
                    <div className="cc-dropdown">
                      <div className="menu-header">Subtitle Size</div>
                      <button className={subSize === '2.4vh' ? 'lang-active' : ''} onClick={(e) => { e.stopPropagation(); handleSubSizeChange('2.4vh'); }}>Small</button>
                      <button className={subSize === '3.2vh' ? 'lang-active' : ''} onClick={(e) => { e.stopPropagation(); handleSubSizeChange('3.2vh'); }}>Medium</button>
                      <button className={subSize === '4.2vh' ? 'lang-active' : ''} onClick={(e) => { e.stopPropagation(); handleSubSizeChange('4.2vh'); }}>Large</button>
                    </div>
                  )}
                  <button onClick={toggleSubMenu} className={`cc-button ${showSubMenu ? 'active' : ''}`}>
                    <Type size={26} color="white" />
                  </button>
                </div>
              )}

              {vttUrls.size > 0 && (
                <div className="cc-menu-container" ref={langMenuRef}>
                  {showLangMenu && (
                    <div className="cc-dropdown">
                      <button 
                        className={selectedLang === null ? 'lang-active' : ''}
                        onClick={(e) => { e.stopPropagation(); selectLanguage(null); }}
                      >
                        Off
                      </button>
                      {metadata.subtitles?.map(sub => (
                        <button
                          key={sub.lang}
                          className={selectedLang === sub.lang ? 'lang-active' : ''}
                          onClick={(e) => { e.stopPropagation(); selectLanguage(sub.lang); }}
                        >
                          {LANG_LABELS[sub.lang] || sub.lang}
                        </button>
                      ))}
                    </div>
                  )}
                  <button 
                    onClick={toggleLangMenu} 
                    className={`cc-button ${selectedLang !== null ? 'active' : ''}`}
                  >
                    <Subtitles size={28} color={selectedLang !== null ? 'white' : 'rgba(255,255,255,0.6)'} />
                  </button>
                </div>
              )}
              
              <div className="cc-menu-container" ref={speedMenuRef}>
                {showSpeedMenu && (
                  <div className="cc-dropdown">
                    <button className={playbackRate === 0.5 ? 'lang-active' : ''} onClick={(e) => { e.stopPropagation(); handleSpeedChange(0.5); }}>0.5x</button>
                    <button className={playbackRate === 0.75 ? 'lang-active' : ''} onClick={(e) => { e.stopPropagation(); handleSpeedChange(0.75); }}>0.75x</button>
                    <button className={playbackRate === 1 ? 'lang-active' : ''} onClick={(e) => { e.stopPropagation(); handleSpeedChange(1); }}>1x (Normal)</button>
                    <button className={playbackRate === 1.25 ? 'lang-active' : ''} onClick={(e) => { e.stopPropagation(); handleSpeedChange(1.25); }}>1.25x</button>
                    <button className={playbackRate === 1.5 ? 'lang-active' : ''} onClick={(e) => { e.stopPropagation(); handleSpeedChange(1.5); }}>1.5x</button>
                    <button className={playbackRate === 2 ? 'lang-active' : ''} onClick={(e) => { e.stopPropagation(); handleSpeedChange(2); }}>2x</button>
                  </div>
                )}
                <button onClick={toggleSpeedMenu} className={`cc-button ${showSpeedMenu ? 'active' : ''}`}>
                  <Gauge size={26} color="white" />
                </button>
              </div>

              <button onClick={toggleFullscreen}>
                <Maximize size={28} color="white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
