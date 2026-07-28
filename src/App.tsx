import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [cookieConsent, setCookieConsent] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('gdpr_cookie_consent');
    if (consent === 'true') {
      setCookieConsent(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('gdpr_cookie_consent', 'true');
    setCookieConsent(true);
  };

  return (
    <div className="app-container">
      <main className="coming-soon-content">
        <h1 className="title">Bio</h1>
        <p className="subtitle">Coming Soon</p>
      </main>
      
      {!cookieConsent && (
        <div className="cookie-banner">
          <p className="cookie-text">
            We use cookies to improve your experience and analyze site usage. By continuing, you agree to our privacy policy.
          </p>
          <button onClick={acceptCookies} className="cookie-button">
            Accept
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
