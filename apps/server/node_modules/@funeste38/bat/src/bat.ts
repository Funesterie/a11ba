export type RequestClass = 'short' | 'normal' | 'slow' | 'timeout';

export interface BatOptions { baselineMs?: number; alpha?: number }

export class Bat {
  baselineMs: number;
  alpha: number;
  private counter = 0;
  private inFlight = new Map<string, { startedAt: number; attempts: number }>();

  constructor(opts: BatOptions = {}) {
    this.baselineMs = opts.baselineMs ?? 500;
    this.alpha = opts.alpha ?? 0.2;
  }

  start(key: string) {
    const id = `${key}:${++this.counter}`;
    this.inFlight.set(id, { startedAt: Date.now(), attempts: 1 });
    return id;
  }

  stop(id: string) {
    const rec = this.inFlight.get(id);
    if (!rec) return null;
    const rtt = Date.now() - rec.startedAt;
    this.baselineMs = (1 - this.alpha) * this.baselineMs + this.alpha * rtt;
    this.inFlight.delete(id);
    return { rtt, cls: this.classify(rtt), attempts: rec.attempts } as { rtt: number; cls: RequestClass; attempts: number };
  }

  classify(rtt: number): RequestClass {
    if (rtt < this.baselineMs * 0.5) return 'short';
    if (rtt < this.baselineMs * 1.5) return 'normal';
    if (rtt < this.baselineMs * 3) return 'slow';
    return 'timeout';
  }

  markRetry(id: string) {
    const rec = this.inFlight.get(id);
    if (!rec) return null;
    rec.attempts += 1;
    rec.startedAt = Date.now();
    return rec;
  }

  listInFlight() { return [...this.inFlight.entries()]; }
}
