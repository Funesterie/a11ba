import { defaultProfiles, WingProfile } from './profiles';

export type RequestClass = 'short' | 'normal' | 'slow' | 'timeout';

export class BatWings {
  state = {
    rate: 1,
    retries: 0,
    safeMode: false
  } as { rate: number; retries: number; safeMode: boolean };

  consecutiveTimeouts = 0;
  readonly maxTimeouts = 3;
  private lastAdjustAt = Date.now();
  private profile: WingProfile = defaultProfiles.chat;

  selectProfile(type: string) {
    this.profile = (defaultProfiles as any)[type] ?? defaultProfiles.chat;
    return this.profile;
  }

  applyProfile(echoClass: RequestClass) {
    const profile = this.profile;
    // small cooldown to avoid thrashing
    const now = Date.now();
    if (now - this.lastAdjustAt < 50) return;
    this.lastAdjustAt = now;

    if (echoClass === 'short') this.state.rate = Math.min(3, this.state.rate + profile.rateGain);
    if (echoClass === 'normal') this.state.rate = this.state.rate; // stable
    if (echoClass === 'slow') this.state.rate = Math.max(0.2, this.state.rate + profile.rateLoss);
    if (echoClass === 'timeout') {
      this.state.rate = Math.max(0.1, this.state.rate + profile.rateLoss * 3);
      this.consecutiveTimeouts++;
    }

    // clamp
    this.state.rate = Math.max(0.2, Math.min(3, this.state.rate));
  }

  adjustRate(cls: RequestClass) {
    // legacy fallback to keep compatibility
    this.applyProfile(cls);
  }

  computeTimeout(baseline: number) {
    return Math.max(50, Math.round(baseline * (this.profile.timeoutFactor ?? 1)));
  }

  shouldRetry(attempts: number) {
    return attempts < (this.profile.maxRetries ?? 0);
  }

  shouldAbort(): boolean {
    return this.consecutiveTimeouts >= this.maxTimeouts || this.state.safeMode;
  }

  resetTimeouts() {
    this.consecutiveTimeouts = 0;
  }

  drop(id: string) {
    // placeholder for drop action: in a real system we'd cancel network requests
    // here we just log
    // eslint-disable-next-line no-console
    console.warn(`BatWings.drop: dropping ${id}`);
  }

  async emergencyRecovery() {
    // simple unsync recovery: wait, then reset rate and timeouts
    // eslint-disable-next-line no-console
    console.warn('BatWings: emergency recovery — pausing briefly');
    await new Promise((r) => setTimeout(r, 300));
    this.state.rate = 1;
    this.resetTimeouts();
    // eslint-disable-next-line no-console
    console.warn('BatWings: recovery complete');
  }
}
