import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { fetchLibrary } from '../config/library';
import { searchMovie, getMovieVideos } from '../services/tmdb';
import Navigation from '../components/Navigation';
import MovieCard from '../components/MovieCard';
import TrailerModal from '../components/TrailerModal';
import LoadingSkeleton from '../components/LoadingSkeleton';
import AuthModal from '../components/AuthModal';
import type { TMDBMovie } from '../services/tmdb';
import type { MovieMetadata } from '../config/library';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);
  const [selectedMeta, setSelectedMeta] = useState<MovieMetadata | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const { data: library, isLoading: isLibraryLoading } = useQuery({
    queryKey: ['libraryMovies'],
    queryFn: fetchLibrary
  });

  const { data: movies, isLoading: isMoviesLoading } = useQuery({
    queryKey: ['tmdbMovies', library?.map(m => `${m.id}-${m.title}`).join(',')],
    queryFn: async () => {
      if (!library) return [];
      const fetches = library.map(async (meta) => {
        const tmdbData = await searchMovie(meta.title, meta.year || '');
        if (tmdbData) {
          // BUG-004: spread instead of mutating the cached meta object directly
          const newMeta: MovieMetadata = { ...meta, tmdbId: tmdbData.id };
          return { meta: newMeta, tmdbData };
        }
        return null;
      });
      const results = await Promise.all(fetches);
      return results.filter((res): res is {meta: MovieMetadata, tmdbData: TMDBMovie} => res !== null);
    },
    enabled: !!library && library.length > 0
  });

  const { data: videos } = useQuery({
    queryKey: ['movieVideos', selectedMovie?.id],
    queryFn: () => selectedMovie ? getMovieVideos(selectedMovie.id) : Promise.resolve([]),
    enabled: !!selectedMovie
  });

  const trailerKey = videos?.find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key;

  const handleCardClick = (movie: TMDBMovie, meta: MovieMetadata) => {
    setSelectedMovie(movie);
    setSelectedMeta(meta);
  };

  const closeModal = () => {
    setSelectedMovie(null);
    setSelectedMeta(null);
  };

  const isLoading = isLibraryLoading || isMoviesLoading;

  if (isLoading) return <LoadingSkeleton />;

  const progressMovies = movies?.map(m => {
    const saved = localStorage.getItem(`bio-progress-${m.meta.id}`);
    return { ...m, progress: saved ? parseFloat(saved) : 0 };
  }) || [];

  const filteredMovies = progressMovies.filter(m => 
    m.tmdbData.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const continueWatching = progressMovies.filter(m => m.progress > 2.77 && m.progress < 95);
  const availableNow = progressMovies.filter(m => !(m.progress > 2.77 && m.progress < 95));

  return (
    <div className="home-container">
      <Navigation searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      
      {searchQuery ? (
        <div className="search-results-container">
          <h2 className="search-results-header">
            Search results for <span>"{searchQuery}"</span>
          </h2>
          {filteredMovies.length > 0 ? (
            <div className="search-grid">
              {filteredMovies.map(({meta, tmdbData}) => (
                <MovieCard 
                  key={meta.id} 
                  movie={tmdbData} 
                  metadata={meta} 
                  onClick={handleCardClick} 
                />
              ))}
            </div>
          ) : (
            <div className="no-results">
              <Search size={56} color="#444" style={{ marginBottom: '16px' }} />
              <p>No titles found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {movies && movies.length > 0 && (
            <div className="hero-billboard">
              <img 
                src={`https://image.tmdb.org/t/p/original${movies[0].tmdbData.backdrop_path}`} 
                alt={movies[0].tmdbData.title}
                className="hero-backdrop"
              />
              <div className="hero-vignette"></div>
              <div className="hero-content">
                <h1 className="hero-title">{movies[0].tmdbData.title}</h1>
                <p className="hero-overview">{movies[0].tmdbData.overview}</p>
              </div>
            </div>
          )}

          <div className="movie-rows">
            {continueWatching.length > 0 && (
              <>
                <h2 className="row-header">Continue Watching</h2>
                <div className="carousel-container">
                  <div className="carousel">
                    {continueWatching.map(({meta, tmdbData}) => (
                      <MovieCard 
                        key={meta.id} 
                        movie={tmdbData} 
                        metadata={meta} 
                        onClick={handleCardClick} 
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
            {availableNow.length > 0 && (
              <>
                <h2 className="row-header">Available Now</h2>
                <div className="carousel-container">
                  <div className="carousel">
                    {availableNow.map(({meta, tmdbData}) => (
                      <MovieCard 
                        key={meta.id} 
                        movie={tmdbData} 
                        metadata={meta} 
                        onClick={handleCardClick} 
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* BUG-008: AnimatePresence must own the conditional so the exit animation fires */}
      <AnimatePresence>
        {selectedMovie && selectedMeta && (
          <TrailerModal
            movie={selectedMovie}
            metadata={selectedMeta}
            trailerKey={trailerKey}
            onClose={closeModal}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}
      </AnimatePresence>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
