import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchLibrary } from '../config/library';
import VideoPlayer from '../components/VideoPlayer';

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  
  const { data: library, isLoading } = useQuery({
    queryKey: ['libraryMovies'],
    queryFn: fetchLibrary
  });

  if (isLoading) return <div className="video-container" style={{background: 'black'}}></div>;

  const metadata = library?.find(m => m.id === id);

  if (!metadata) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="watch-container">
      <VideoPlayer metadata={metadata} />
    </div>
  );
}
