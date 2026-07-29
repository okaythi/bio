import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, User } from 'lucide-react';

interface NavigationProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export default function Navigation({ searchQuery, onSearchChange }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`nav-container ${isScrolled ? 'scrolled' : ''}`}>
      <div className="nav-left">
        <span className="nav-logo">bio</span>
        <div className="nav-links">
          <Link to="/" className="active">Home</Link>
        </div>
      </div>
      <div className="nav-right">
        {onSearchChange !== undefined ? (
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid white', padding: '4px 8px', borderRadius: '4px' }}>
            <Search size={16} color="white" style={{ marginRight: '8px' }} />
            <input 
              type="text" 
              placeholder="Titles..." 
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '150px' }}
            />
          </div>
        ) : (
          <Search className="nav-icon" />
        )}
        <User className="nav-icon" />
      </div>
    </nav>
  );
}
