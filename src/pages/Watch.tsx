import { useParams, Navigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchLibrary } from '../config/library';
import VideoPlayer from '../components/VideoPlayer';
import { useAuth } from '../context/AuthContext';

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  
  const initialSeason = searchParams.get('season') ? parseInt(searchParams.get('season')!) : undefined;
  const initialEpisode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!) : undefined;

  const { data: library, isLoading } = useQuery({
    queryKey: ['libraryMovies'],
    queryFn: fetchLibrary
  });

  if (isLoading || loading) return <div className="video-container" style={{background: 'black'}}></div>;

  if (!user && !loading) {
    return <Navigate to="/" replace />;
  }

  const metadata = library?.find(m => m.id === id);

  if (!metadata) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="watch-container">
      <VideoPlayer 
        metadata={metadata} 
        initialSeason={initialSeason} 
        initialEpisode={initialEpisode} 
      />
    </div>
  );
}
