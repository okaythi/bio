import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, User, X } from 'lucide-react';

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
          <div className="nav-search-box">
            <Search size={18} color="rgba(255,255,255,0.7)" />
            <input 
              type="text" 
              placeholder="Search titles..." 
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="nav-search-input"
            />
            {searchQuery && (
              <button 
                className="nav-search-clear" 
                onClick={() => onSearchChange('')} 
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <Search className="nav-icon" />
        )}
        <User className="nav-icon" />
      </div>
    </nav>
  );
}
