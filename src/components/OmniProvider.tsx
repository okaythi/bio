import React, { createContext, useContext, useEffect, useRef } from 'react';
import { globalTracker } from '../lib/telemetry/OmniTracker';

const OmniContext = createContext(globalTracker);

export const OmniProvider: React.FC<{ children: React.ReactNode, userId?: string }> = ({ children, userId }) => {
  
  useEffect(() => {
    if (userId) {
      globalTracker.setUserId(userId);
    }
  }, [userId]);

  return (
    <OmniContext.Provider value={globalTracker}>
      {children}
    </OmniContext.Provider>
  );
};

export const useOmni = () => useContext(OmniContext);

export const ViewabilityTracker: React.FC<{ id: string, children: React.ReactNode }> = ({ id, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!ref.current) return;
    
    let enterTime = 0;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          enterTime = performance.now();
        } else {
          if (enterTime > 0) {
            const dwellTime = performance.now() - enterTime;
            globalTracker.trackIntersection(id, entry.intersectionRatio, dwellTime);
            enterTime = 0;
          }
        }
      });
    }, { threshold: [0, 0.5, 1.0] });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [id]);

  return <div ref={ref}>{children}</div>;
};
