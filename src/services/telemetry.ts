// src/services/telemetry.ts

interface TelemetryEvent {
  type: string;
  data?: Record<string, any>;
  device?: Record<string, any>;
  timestamp?: number;
}

class TelemetryService {
  private queue: TelemetryEvent[] = [];
  private timer: number | null = null;
  private deviceInfo: Record<string, any>;

  constructor() {
    this.deviceInfo = {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      screen: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '',
      language: typeof navigator !== 'undefined' ? navigator.language : '',
      timeZone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : ''
    };
  }

  public track(type: string, data?: Record<string, any>) {
    this.queue.push({
      type,
      data,
      device: this.deviceInfo,
      timestamp: Date.now()
    });

    if (this.queue.length >= 10) {
      this.flush();
    } else if (!this.timer) {
      this.timer = window.setTimeout(() => this.flush(), 5000) as unknown as number;
    }
  }

  public async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) return;

    const payload = [...this.queue];
    this.queue = [];

    try {
      await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (err) {
      // Re-queue on failure
      this.queue = [...payload, ...this.queue];
    }
  }
}

export const telemetry = new TelemetryService();
