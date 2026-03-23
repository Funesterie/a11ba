export interface MemorySignal { time: number; id?: string; cls?: string; rtt?: number; signal?: number; origin?: string; err?: any }

export class Memory {
  private size: number;
  private ring: MemorySignal[] = [];
  constructor(size = 50) { this.size = Math.max(1, size); }
  push(sig: MemorySignal) { this.ring.push(sig); if (this.ring.length > this.size) this.ring.shift(); }
  last(n = 10) { return this.ring.slice(Math.max(0, this.ring.length - n)); }
  clear() { this.ring = []; }
  find(predicate: (s: MemorySignal) => boolean) { return this.ring.find(predicate); }
}
