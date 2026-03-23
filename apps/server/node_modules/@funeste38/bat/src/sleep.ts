export class Sleep {
  sleeping = false;
  async sleep(ms = 2000) { if (this.sleeping) return; this.sleeping = true; await new Promise((r) => setTimeout(r, ms)); this.sleeping = false; }
  async sleepAndReset(ms = 2000, resetFn?: () => void) { await this.sleep(ms); if (resetFn) resetFn(); }
}
