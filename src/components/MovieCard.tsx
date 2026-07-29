import { useState } from 'react';
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
    </div>
  );
}
