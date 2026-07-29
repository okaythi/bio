import { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { getImageUrl } from '../services/tmdb';
import type { TMDBMovie } from '../services/tmdb';
import type { MovieMetadata } from '../config/library';

interface MovieCardProps {
  movie: TMDBMovie;
  metadata: MovieMetadata;
  onClick: (movie: TMDBMovie, metadata: MovieMetadata) => void;
}

export default function MovieCard({ movie, metadata, onClick }: MovieCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    // Read saved progress from localStorage (101% reliable storage technique)
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
    >
      <img 
        src={getImageUrl(movie.poster_path, 'w500')} 
        alt={movie.title}
        loading="lazy"
        decoding="async"
        className="movie-poster"
      />
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
