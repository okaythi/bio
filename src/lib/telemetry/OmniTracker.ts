export class OmniTracker {
  private sessionId: string;
  private userId: string | null = null;
  private queue: any[] = [];
  private splines: { x: number; y: number; v: number; t: number }[] = [];
  private lastMouse = { x: 0, y: 0, t: 0 };
  private isHovering = false;
  private hoverStartTime = 0;
  private clickBuffer: number[] = [];

  constructor() {
    this.sessionId = crypto.randomUUID();
    this.initHardwareFingerprint();
    this.attachGlobalListeners();
    this.startSplineLoop();
    this.startBatchLoop();
  }

  public setUserId(id: string) {
    this.userId = id;
  }

  private async initHardwareFingerprint() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const debugInfo = gl ? gl.getExtension('WEBGL_debug_renderer_info') : null;
    const vendor = debugInfo ? gl?.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown';
    const renderer = debugInfo ? gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';

    let audioHash = 'unknown';
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const analyser = audioCtx.createAnalyser();
      oscillator.connect(analyser);
      audioHash = analyser.frequencyBinCount.toString();
    } catch (e) {}

    const fingerprint = {
      memory: (navigator as any).deviceMemory || 'unknown',
      cores: navigator.hardwareConcurrency || 'unknown',
      vendor,
      renderer,
      audioHash,
      screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
    };

    this.queueEvent('fingerprint', fingerprint);
  }

  private attachGlobalListeners() {
    window.addEventListener('mousemove', (e) => {
      const now = performance.now();
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      const dt = now - this.lastMouse.t;
      const velocity = Math.sqrt(dx * dx + dy * dy) / (dt || 1);

      this.lastMouse = { x: e.clientX, y: e.clientY, t: now };
      this.splines.push({ x: e.clientX, y: e.clientY, v: velocity, t: now });
    });

    window.addEventListener('click', (e) => {
      const now = performance.now();
      this.clickBuffer.push(now);
      this.clickBuffer = this.clickBuffer.filter(t => now - t < 1000);
      if (this.clickBuffer.length > 3) {
        this.queueEvent('rage_click', { x: e.clientX, y: e.clientY, target: (e.target as HTMLElement).tagName });
        this.clickBuffer = [];
      }
    });

    window.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.tagName === 'A') {
        this.isHovering = true;
        this.hoverStartTime = performance.now();
      }
    });

    window.addEventListener('mouseout', (e) => {
      if (this.isHovering) {
        const duration = performance.now() - this.hoverStartTime;
        if (duration > 1200) {
          this.queueEvent('indecision_hover', { duration, target: (e.target as HTMLElement).tagName });
        }
        this.isHovering = false;
      }
    });

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush(true);
      }
    });
  }

  public attachVideoTracker(videoId: string, element: HTMLMediaElement, onAbandon?: (progress: number, duration: number) => void) {
    let lastPause = 0;
    
    element.addEventListener('pause', () => {
      lastPause = performance.now();
    });

    element.addEventListener('play', () => {
      if (lastPause > 0) {
        const pauseDuration = performance.now() - lastPause;
        if (pauseDuration < 5000) {
          this.queueEvent('video_micro_pause', { videoId, duration: pauseDuration });
        } else {
          this.queueEvent('video_macro_pause', { videoId, duration: pauseDuration });
        }
      }
    });

    window.addEventListener('beforeunload', () => {
      if (!element.ended) {
        this.queueEvent('video_abandoned', { videoId, progress: element.currentTime });
        if (onAbandon) {
          onAbandon(element.currentTime, element.duration);
        }
      }
    });
  }

  public trackIntersection(elementId: string, ratio: number, dwellTime: number) {
    this.queueEvent('intersection', { elementId, ratio, dwellTime });
  }

  private queueEvent(type: string, data: any) {
    this.queue.push({ type, data, timestamp: Date.now() });
  }

  private startSplineLoop() {
    requestAnimationFrame(() => this.startSplineLoop());
  }

  private startBatchLoop() {
    setInterval(() => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => this.flush());
      } else {
        this.flush();
      }
    }, 5000);
  }

  private flush(sync = false) {
    if (this.queue.length === 0 && this.splines.length === 0) return;

    const payload = {
      sessionId: this.sessionId,
      userId: this.userId,
      semanticEvents: this.queue,
      rawTraces: { splines: this.splines }
    };

    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });

    if (sync || typeof navigator.sendBeacon === 'undefined') {
      fetch('/api/telemetry', {
        method: 'POST',
        body: blob,
        keepalive: true
      }).catch(() => {});
    } else {
      navigator.sendBeacon('/api/telemetry', blob);
    }

    this.queue = [];
    this.splines = [];
  }
}

export const globalTracker = new OmniTracker();
