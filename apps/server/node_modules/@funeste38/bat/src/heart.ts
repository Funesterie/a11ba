export type HeartCallback = () => void;

export class Heart {
  intervalMs: number;
  private timer: any = null;
  private callbacks: HeartCallback[] = [];
  running = false;

  constructor(intervalMs = 1000) { this.intervalMs = intervalMs; }
  start() { if (this.running) return; this.running = true; this.timer = setInterval(() => this.tick(), this.intervalMs); }
  stop() { if (!this.running) return; clearInterval(this.timer); this.timer = null; this.running = false; }
  onTick(cb: HeartCallback) { this.callbacks.push(cb); }
  private tick() { for (const cb of this.callbacks) { try { cb(); } catch {} } }
  reset() { this.stop(); this.start(); }
}
