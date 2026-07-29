import { useState, useEffect } from 'react';
import { CheckCircle, Heart } from 'lucide-react';
import { getImageUrl } from '../services/tmdb';
import type { TMDBMovie } from '../services/tmdb';
import type { MovieMetadata } from '../config/library';
import { useAuth } from '../context/AuthContext';

interface MovieCardProps {
  movie: TMDBMovie;
  metadata: MovieMetadata;
  onClick: (movie: TMDBMovie, metadata: MovieMetadata) => void;
}

export default function MovieCard({ movie, metadata, onClick }: MovieCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const { likedMovies } = useAuth();

  const isLiked = likedMovies.includes(metadata.id);

  useEffect(() => {
    const saved = localStorage.getItem(`bio-progress-${metadata.id}`);
    if (saved) {
      setProgress(parseFloat(saved));
    }
  }, [metadata.id]);

  return (
    <div 
      className={`movie-card ${isHovered ? 'hovered' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(movie, metadata)}
      style={{ position: 'relative' }}
    >
      <img 
        src={getImageUrl(movie.poster_path, 'w500')} 
        alt={movie.title}
        loading="lazy"
        decoding="async"
        className="movie-poster"
      />

      {isLiked && (
        <div style={{
          position: 'absolute', top: '8px', right: '8px', zIndex: 5,
          backgroundColor: 'rgba(229, 9, 20, 0.85)', borderRadius: '50%',
          padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.6)'
        }}>
          <Heart size={14} color="white" fill="white" />
        </div>
      )}

      {progress !== null && progress > 94.57 && (
        <div className="movie-card-checkmark">
          <CheckCircle size={32} color="white" fill="#E50914" />
        </div>
      )}
      {progress !== null && progress > 0 && (
        <div className="movie-card-progress-container">
          <div className="movie-card-progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
      )}
    </div>
  );
}
