import { useState, useEffect } from 'react';
import { Search, Bell, User } from 'lucide-react';

export default function Navigation() {
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
          <a href="#" className="active">Home</a>
          <a href="#">Movies</a>
          <a href="#">My List</a>
        </div>
      </div>
      <div className="nav-right">
        <Search className="nav-icon" />
        <Bell className="nav-icon" />
        <User className="nav-icon" />
      </div>
    </nav>
  );
}
