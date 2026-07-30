import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Subtitles, Gauge, Keyboard, Type } from 'lucide-react';
import type { MovieMetadata } from '../config/library';
import { useAuth } from '../context/AuthContext';

interface VideoPlayerProps {
  metadata: MovieMetadata;
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

export default function VideoPlayer({ metadata }: VideoPlayerProps) {
  const { user, updatePreferences } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const subMenuRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // H.264 fallback states
  const [activeVideoUrl, setActiveVideoUrl] = useState(metadata.videoUrl);
  const [isUsingH264Fallback, setIsUsingH264Fallback] = useState(false);
  const [showH264Tooltip, setShowH264Tooltip] = useState(false);

  // Determine tooltip theme from AuthContext user preferences (defaults to dark)
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

  const [subSize, setSubSize] = useState('3.2vh');
  const [showSubMenu, setShowSubMenu] = useState(false);

  const [showShortcuts, setShowShortcuts] = useState(false);

  // Thumbnail states
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [hoverX, setHoverX] = useState(0);
  const [hoverTime, setHoverTime] = useState(0);

  const timeoutRef = useRef<number | null>(null);
  const hasSeekedRef = useRef(false);
  
  // Refs mirror mutable state for stable event handlers (avoids stale closures — BUG-007)
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

  // When video source falls back to H.264, re-initialize media engine and trigger auto-play
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

    if (metadata.subtitles && metadata.subtitles.length > 0) {
      metadata.subtitles.forEach(sub => {
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
  }, [metadata.subtitles]);

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
          const savedStr = localStorage.getItem(`bio-progress-${metadata.id}`);
          if (savedStr) {
            const savedPct = parseFloat(savedStr);
            if (savedPct > 0 && savedPct <= 94.57) {
              videoRef.current.currentTime = (savedPct / 100) * total;
              return;
            }
          }
        }

        const pct = (current / total) * 100;
        const savedStr = localStorage.getItem(`bio-progress-${metadata.id}`);
        const savedPct = savedStr ? parseFloat(savedStr) : 0;
        
        if (savedPct > 94.57) {
          if (pct > 5.13) {
            localStorage.setItem(`bio-progress-${metadata.id}`, pct.toString());
          }
        } else {
          localStorage.setItem(`bio-progress-${metadata.id}`, pct.toString());
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

  // Thumbnail Scrubbing Logic
  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current || !hiddenVideoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const time = percentage * videoRef.current.duration;
    
    setHoverX(x);
    setHoverTime(time);
    setIsHoveringProgress(true);

    // Seek the hidden video to render thumbnail
    if (Math.abs(hiddenVideoRef.current.currentTime - time) > 1) { // Debounce seeks slightly
      hiddenVideoRef.current.currentTime = time;
    }
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

  const handleHiddenVideoSeeked = () => {
    if (hiddenVideoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.drawImage(hiddenVideoRef.current, 0, 0, 160, 90);
      }
    }
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
        crossOrigin="anonymous"
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

      {/* Hidden video purely for rendering scrubbing thumbnails */}
      <video
        ref={hiddenVideoRef}
        src={activeVideoUrl}
        style={{ display: 'none' }}
        muted
        crossOrigin="anonymous"
        onContextMenu={(e) => e.preventDefault()}
        onSeeked={handleHiddenVideoSeeked}
      />
      
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

      {videoError && (
        <div className="video-error-overlay">
          <div className="video-error-content">
            <span className="video-error-icon">⚠</span>
            <p className="video-error-message">{videoError}</p>
            <button className="play-button" onClick={() => navigate(-1)}>← Go Back</button>
          </div>
        </div>
      )}

      <div className={`video-controls ${showControls ? 'show' : 'hide'}`}>
        <div className="controls-top">
          <button className="back-button" onClick={() => navigate(-1)}>
            <ArrowLeft size={32} color="white" />
          </button>
        </div>

        {/* Clickable middle area to pause/play */}
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
                <canvas ref={canvasRef} width="160" height="90" className="thumbnail-canvas" />
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
                {metadata.title}
                {(() => {
                  const currentSec = (progress / 100) * (videoRef.current?.duration || 0);
                  const ch = metadata.chapters?.find(c => currentSec >= c.start && currentSec < c.end);
                  return ch ? <span className="chapter-title" style={{ opacity: 0.75, fontWeight: 400, marginLeft: 8 }}> — {ch.title}</span> : null;
                })()}
              </span>
            </div>
            
            <div className="controls-right">
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

              {/* Subtitle Settings Menu */}
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

              {/* Subtitle Lang Menu */}
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
              
              {/* Playback Speed Menu */}
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
