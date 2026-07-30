import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: any;
  }
}

interface TurnstileWidgetProps {
  sitekey?: string;
  action?: string;
}

export default function TurnstileWidget({ 
  sitekey = "0x4AAAAAAEB2_RaEon2bhHxu", 
  action = "turnstile-spin-v2" 
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widgetId: string | undefined;

    const renderWidget = () => {
      if (containerRef.current && window.turnstile && !containerRef.current.hasChildNodes()) {
        try {
          widgetId = window.turnstile.render(containerRef.current, {
            sitekey,
            action,
            theme: 'dark'
          });
        } catch (e) {
          console.error("Turnstile render error", e);
        }
      }
    };

    // If script already loaded
    if (window.turnstile) {
      renderWidget();
    } else {
      // Wait for it to load just in case
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 100);
      return () => clearInterval(interval);
    }

    return () => {
      if (widgetId !== undefined && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [sitekey, action]);

  return <div ref={containerRef} style={{ marginTop: '4px' }}></div>;
}
