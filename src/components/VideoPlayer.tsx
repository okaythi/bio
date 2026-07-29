import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Subtitles } from 'lucide-react';
import type { MovieMetadata } from '../config/library';

interface VideoPlayerProps {
  metadata: MovieMetadata;
}

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [ccEnabled, setCcEnabled] = useState(false);
  const [vttUrl, setVttUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Thumbnail states
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [hoverX, setHoverX] = useState(0);
  const [hoverTime, setHoverTime] = useState(0);

  const timeoutRef = useRef<number | null>(null);
  const hasSeekedRef = useRef(false);
  // Refs mirror mutable state for stable event handlers (avoids stale closures — BUG-007)
  const isMutedRef = useRef(false);
  const volumeRef = useRef(100);
  const ccEnabledRef = useRef(false);

  const handleCanPlay = () => {
    setIsBuffering(false);
    if (!hasSeekedRef.current && videoRef.current) {
      hasSeekedRef.current = true;
      const savedStr = localStorage.getItem(`bio-progress-${metadata.id}`);
      if (savedStr) {
        const savedPct = parseFloat(savedStr);
        if (savedPct > 0 && savedPct <= 94.57) {
          videoRef.current.currentTime = (savedPct / 100) * videoRef.current.duration;
        }
      }
    }
  };

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { ccEnabledRef.current = ccEnabled; }, [ccEnabled]);

  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 2500);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
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
        if (videoRef.current && videoRef.current.textTracks[0]) {
          const track = videoRef.current.textTracks[0];
          const newState = !ccEnabledRef.current;
          track.mode = newState ? 'showing' : 'hidden';
          setCcEnabled(newState);
        }
      } else if (e.code === 'ArrowRight') {
        if (videoRef.current) videoRef.current.currentTime += 10;
      } else if (e.code === 'ArrowLeft') {
        if (videoRef.current) videoRef.current.currentTime -= 10;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // stable: stale-prone state is read via refs

  useEffect(() => {
    let url = "";
    if (metadata.subtitleUrl) {
      fetch(metadata.subtitleUrl)
        .then(r => r.ok ? r.text() : null)
        .then(srtText => {
          if (!srtText) return; // subtitle file missing or non-OK response (BUG-001)
          const vttText = "WEBVTT\n\n" + srtText
            .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
            .replace(/(-->\s+\d{2}:\d{2}:\d{2}\.\d{3})/g, "$1 line:85%"); // \s+ handles varying SRT spacing (BUG-005)
          const blob = new Blob([vttText], { type: "text/vtt" });
          url = URL.createObjectURL(blob);
          setVttUrl(url);
        })
        .catch(console.error);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [metadata.subtitleUrl]);

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

  const toggleCC = () => {
    if (videoRef.current && videoRef.current.textTracks[0]) {
      const track = videoRef.current.textTracks[0];
      const newState = !ccEnabled;
      track.mode = newState ? 'showing' : 'hidden';
      setCcEnabled(newState);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setProgress((current / total) * 100);

      if (!isNaN(total) && total > 0) {
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
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    videoRef.current.currentTime = percentage * videoRef.current.duration;
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
    <div className={`video-container ${!showControls ? 'hide-cursor' : ''}`}>
      <video
        ref={videoRef}
        src={metadata.videoUrl}
        className="video-element"
        autoPlay
        crossOrigin="anonymous"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={handleCanPlay}
        onTimeUpdate={handleTimeUpdate}
        onError={() => {
          setVideoError('This video failed to load. Please go back and try again.');
          setIsBuffering(false);
        }}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      >
        {vttUrl && (
          <track
            kind="subtitles"
            src={vttUrl}
            srcLang="en"
            label="English"
            default={ccEnabled}
          />
        )}
      </video>

      {/* Hidden video purely for rendering scrubbing thumbnails */}
      <video
        ref={hiddenVideoRef}
        src={metadata.videoUrl}
        style={{ display: 'none' }}
        muted
        crossOrigin="anonymous"
        onSeeked={handleHiddenVideoSeeked}
      />
      
      {isBuffering && !videoError && (
        <div className="custom-spinner">
          <div className="spinner-ring"></div>
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
                    {...({ orient: "vertical" } as any)}
                  />
                </div>
                <button onClick={toggleMute}>
                  {isMuted ? <VolumeX size={28} color="white" /> : <Volume2 size={28} color="white" />}
                </button>
              </div>

              <span className="video-title">{metadata.title}</span>
            </div>
            
            <div className="controls-right">
              {vttUrl && (
                <button 
                  onClick={toggleCC} 
                  className={`cc-button ${ccEnabled ? 'active' : ''}`}
                >
                  <Subtitles size={28} color={ccEnabled ? 'white' : 'rgba(255,255,255,0.6)'} />
                </button>
              )}
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
