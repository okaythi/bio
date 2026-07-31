import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, X, ThumbsUp, Volume2, VolumeX, Lock, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import YouTube from 'react-youtube';
import { useQuery } from '@tanstack/react-query';
import type { YouTubePlayer } from 'react-youtube';
import { getTVDetails, getTVSeasonDetails, getImageUrl } from '../services/tmdb';
import type { TMDBMovie } from '../services/tmdb';
import type { MovieMetadata } from '../config/library';
import { useAuth } from '../context/AuthContext';

interface TrailerModalProps {
  movie: TMDBMovie;
  metadata: MovieMetadata;
  trailerKey?: string;
  onClose: () => void;
  onOpenAuth: () => void;
}

export default function TrailerModal({ movie, metadata, trailerKey, onClose, onOpenAuth }: TrailerModalProps) {
  const navigate = useNavigate();
  const { user, likedMovies, toggleLike } = useAuth();
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(metadata.seasons && metadata.seasons.length > 0 ? metadata.seasons[0].seasonNumber : 1);
  const playerRef = useRef<YouTubePlayer | null>(null);

  const { data: tvDetails } = useQuery({
    queryKey: ['tvDetails', movie.id],
    queryFn: () => getTVDetails(movie.id),
    enabled: (metadata.type === 'tv' || !metadata.type) && !!movie.id && (!metadata.seasons || metadata.seasons.length === 0)
  });

  const { data: seasonDetails } = useQuery({
    queryKey: ['tvSeasonDetails', movie.id, selectedSeason],
    queryFn: () => getTVSeasonDetails(movie.id, selectedSeason),
    enabled: (metadata.type === 'tv' || !metadata.type) && !!movie.id && (!metadata.seasons || metadata.seasons.length === 0)
  });

  let effectiveSeasons = metadata.seasons;

  if ((!effectiveSeasons || effectiveSeasons.length === 0) && tvDetails) {
    const seasonsList = (tvDetails.seasons || []).filter((s: any) => s.season_number > 0);
    const episodesList = (seasonDetails?.episodes || []).map((ep: any) => ({
      id: `ep-${ep.id}`,
      title: `E${ep.episode_number}: ${ep.name}`,
      description: ep.overview,
      thumbnailUrl: getImageUrl(ep.still_path, 'w500'),
      videoUrl: ''
    }));

    effectiveSeasons = seasonsList.map((s: any) => ({
      seasonNumber: s.season_number,
      episodes: s.season_number === selectedSeason ? episodesList : []
    }));
  }

  const isLiked = likedMovies.includes(metadata.id);

  const onReady = (event: { target: YouTubePlayer }) => {
    playerRef.current = event.target;
    event.target.mute();
    setVolume(0);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    if (playerRef.current) {
      playerRef.current.setVolume(val);
      if (val === 0) {
        playerRef.current.mute();
        setIsMuted(true);
      } else {
        playerRef.current.unMute();
        setIsMuted(false);
      }
    }
  };

  const toggleMute = () => {
    if (playerRef.current) {
      if (isMuted) {
        playerRef.current.unMute();
        const newVol = volume === 0 ? 50 : volume;
        playerRef.current.setVolume(newVol);
        setVolume(newVol);
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setVolume(0);
        setIsMuted(true);
      }
    }
  };

  const handleLikeClick = async () => {
    if (!user) {
      onClose();
      onOpenAuth();
      return;
    }
    try {
      setIsLiking(true);
      await toggleLike(metadata.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert(message);
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div 
        className="modal-content"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          <X size={24} color="white" />
        </button>
        
        <div className="modal-banner">
          {trailerKey ? (
            <div className="modal-trailer-wrapper">
              <YouTube
                videoId={trailerKey}
                className="modal-trailer"
                opts={{
                  width: '100%',
                  height: '100%',
                  playerVars: {
                    autoplay: 1,
                    controls: 0,
                    disablekb: 1,
                    loop: 1,
                    playlist: trailerKey,
                    modestbranding: 1,
                    showinfo: 0,
                    rel: 0,
                    iv_load_policy: 3
                  }
                }}
                onReady={onReady}
              />
            </div>
          ) : (
            <img 
              src={`https://image.tmdb.org/t/p/original${movie.backdrop_path}`} 
              alt={movie.title}
              className="modal-backdrop"
            />
          )}
          <div className="modal-banner-fade"></div>
          
          <div className="modal-volume-container">
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
            <button className="modal-mute-button" onClick={toggleMute}>
              {isMuted ? <VolumeX size={20} color="white" /> : <Volume2 size={20} color="white" />}
            </button>
          </div>

          <div className="modal-actions">
            {metadata.isComingSoon ? (
              <button 
                className="play-button" 
                disabled 
                style={{ 
                  background: 'rgba(255, 42, 95, 0.2)', 
                  color: '#ff2a5f', 
                  border: '1px solid rgba(255, 42, 95, 0.5)',
                  cursor: 'not-allowed'
                }}
              >
                <Clock size={22} />
                <span>Coming Soon</span>
              </button>
            ) : user ? (
              <button className="play-button" onClick={() => navigate(`/watch/${metadata.id}`)}>
                <Play size={24} fill="black" color="black" />
                <span>Play</span>
              </button>
            ) : (
              <button
                className="sign-in-cta-button"
                onClick={() => { onClose(); onOpenAuth(); }}
              >
                <Lock size={18} />
                <span>Sign in to watch</span>
              </button>
            )}

            {/* Interactive Like/ThumbsUp Button connected to D1 */}
            <button 
              className="icon-button" 
              onClick={handleLikeClick}
              disabled={isLiking}
              title={isLiked ? "Unlike" : "Like this title"}
              style={{
                borderColor: isLiked ? '#E50914' : 'rgba(255, 255, 255, 0.7)',
                backgroundColor: isLiked ? '#E50914' : 'rgba(42, 42, 42, 0.6)'
              }}
            >
              <ThumbsUp size={22} color="white" fill={isLiked ? "white" : "none"} />
            </button>
          </div>
        </div>
        
        <div className="modal-details">
          <div className="modal-info-left">
            <div className="modal-meta">
              <span className="match">{Math.round(movie.vote_average * 10)}% Match</span>
              <span>{movie.release_date.split('-')[0]}</span>
              {movie.runtime && <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>}
              <span className="hd">HD</span>
              {(metadata.audioChannels || ((metadata.title?.toLowerCase().includes('spirited') || metadata.id?.toLowerCase().includes('spirited') || movie.title?.toLowerCase().includes('spirited')) ? "7.1" : ((metadata.title?.toLowerCase().includes('leviticus') || metadata.id?.toLowerCase().includes('leviticus') || movie.title?.toLowerCase().includes('leviticus')) ? "5.1" : null))) && (
                <span className="hd">
                  {metadata.audioChannels || ((metadata.title?.toLowerCase().includes('spirited') || metadata.id?.toLowerCase().includes('spirited') || movie.title?.toLowerCase().includes('spirited')) ? "7.1" : "5.1")}
                </span>
              )}
              {(metadata.spatialAudio ?? (metadata.title?.toLowerCase().includes('spirited') || metadata.id?.toLowerCase().includes('spirited') || movie.title?.toLowerCase().includes('spirited'))) && (
                <span className="hd spatial-audio-tag" title="Dolby Atmos Enabled">
                  Dolby Atmos
                </span>
              )}
            </div>
            <p className="modal-overview">{movie.overview}</p>
          </div>
          <div className="modal-info-right">
            {movie.genres && (
              <div className="modal-genres">
                <span>Genres:</span> {movie.genres.map(g => g.name).join(', ')}
              </div>
            )}
          </div>
        </div>

        {effectiveSeasons && effectiveSeasons.length > 0 && (
          <div className="modal-episodes-section" style={{ padding: '0 3rem 2rem', marginTop: '1rem' }}>
            <div className="modal-episodes-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Episodes</h3>
              {effectiveSeasons.length > 1 && (
                <select 
                  style={{ padding: '0.5rem 1rem', background: '#242424', color: 'white', border: '1px solid #333', borderRadius: '4px', fontSize: '1.1rem' }}
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(Number(e.target.value))}
                >
                  {effectiveSeasons.map(s => (
                    <option key={s.seasonNumber} value={s.seasonNumber}>Season {s.seasonNumber}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="modal-episodes-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {effectiveSeasons.find(s => s.seasonNumber === selectedSeason)?.episodes.map((ep, idx) => (
                <div 
                  key={ep.id} 
                  className="episode-item"
                  style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    padding: '1rem', 
                    background: 'rgba(255,255,255,0.05)', 
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onClick={() => {
                    if (metadata.isComingSoon || !ep.videoUrl) {
                      alert("This episode is coming soon!");
                    } else {
                      navigate(`/watch/${metadata.id}?season=${selectedSeason}&episode=${idx + 1}`);
                    }
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                  <div className="episode-number" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#888', minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {idx + 1}
                  </div>
                  <div className="episode-thumbnail" style={{ width: '130px', height: '73px', background: '#333', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
                    {ep.thumbnailUrl ? <img src={ep.thumbnailUrl} alt={ep.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>No Image</div>}
                  </div>
                  <div className="episode-info" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{ep.title}</span>
                    </div>
                    {ep.description && <p style={{ fontSize: '0.9rem', color: '#aaa', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ep.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
