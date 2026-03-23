import { defaultProfiles } from './profiles';
import { RequestClass } from './bat';

export class Wings {
  state = { rate: 1, retries: 0, safeMode: false } as { rate: number; retries: number; safeMode: boolean };
  consecutiveTimeouts = 0;
  readonly maxTimeouts = 3;
  private lastAdjustAt = Date.now();
  private profile: any = defaultProfiles.chat;

  selectProfile(type: string) { this.profile = (defaultProfiles as any)[type] ?? defaultProfiles.chat; return this.profile; }

  applyProfile(echoClass: RequestClass) {
    const profile = this.profile;
    const now = Date.now();
    if (now - this.lastAdjustAt < 50) return;
    this.lastAdjustAt = now;

    if (echoClass === 'short') this.state.rate = Math.min(3, this.state.rate + profile.rateGain);
    if (echoClass === 'normal') this.state.rate = this.state.rate;
    if (echoClass === 'slow') this.state.rate = Math.max(0.2, this.state.rate + profile.rateLoss);
    if (echoClass === 'timeout') { this.state.rate = Math.max(0.1, this.state.rate + profile.rateLoss * 3); this.consecutiveTimeouts++; }

    this.state.rate = Math.max(0.2, Math.min(3, this.state.rate));
  }

  computeTimeout(baseline: number) { return Math.max(50, Math.round(baseline * (this.profile.timeoutFactor ?? 1))); }
  shouldRetry(attempts: number) { return attempts < (this.profile.maxRetries ?? 0); }
  shouldAbort() { return this.consecutiveTimeouts >= this.maxTimeouts || this.state.safeMode; }
  resetTimeouts() { this.consecutiveTimeouts = 0; }
  reset() { this.state.rate = 1; this.resetTimeouts(); this.state.retries = 0; this.state.safeMode = false; }
}
