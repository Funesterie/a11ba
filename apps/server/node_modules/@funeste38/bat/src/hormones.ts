export class Hormones {
  stress = 0; private decayMs = 5000; private lastUpdate = Date.now();
  inc(amount = 5) { this.updateDecay(); this.stress = Math.min(100, this.stress + amount); return this.stress; }
  dec(amount = 5) { this.updateDecay(); this.stress = Math.max(0, this.stress - amount); return this.stress; }
  private updateDecay() { const now = Date.now(); const delta = now - this.lastUpdate; if (delta > this.decayMs) { const steps = Math.floor(delta / this.decayMs); this.stress = Math.max(0, this.stress - steps * 2); this.lastUpdate = now; } }
  setStress(v:number){ this.stress = Math.max(0, Math.min(100, v)); }
}
