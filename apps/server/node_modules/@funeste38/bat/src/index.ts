import { BatWings } from './batWings';

export type RequestClass = 'short' | 'normal' | 'slow' | 'timeout';
export type OriginGuess = 'local' | 'remote' | 'cached' | 'error';

export interface EchoRadarOptions {
  baselineMs?: number;
  alpha?: number;
  maxAttempts?: number;
  noiseFilter?: NoiseFilter;
}

export interface NoiseFilter {
  ignore(result: any, error?: any): boolean;
}

interface InFlight {
  id: string;
  key: string;
  startedAt: number;
  attempts: number;
}

const defaultNoiseFilter: NoiseFilter = {
  ignore(result: any, error?: any) {
    if (error) {
      const status = (error && ((error as any).status || (error as any).statusCode)) as number | undefined;
      if (status && [429, 502, 503].includes(status)) return true;
      return false;
    }
    if (result == null) return true;
    if (typeof result === 'string') {
      const s = result.trim();
      if (s === '' || s === 'null' || s === 'undefined') return true;
      if (s.length < 5) return true;
    }
    if (typeof result === 'object') {
      try {
        const str = JSON.stringify(result);
        if (str === '{}' || str === '[]' || str.length < 5) return true;
      } catch {
        return false;
      }
    }
    return false;
  }
};

function computeSignalStrength(result: any, error: any, rtt: number): number {
  if (error) return 0;
  let score = 50;
  let len = 0;
  if (typeof result === 'string') len = result.length;
  else if (result && typeof result === 'object') {
    try { len = JSON.stringify(result).length; } catch { len = 0; }
  } else if (typeof result === 'number' || typeof result === 'boolean') len = 1;

  // reward longer meaningful payloads
  score += Math.min(40, Math.round((len / 1000) * 40));
  if (len < 20) score -= 20;

  // penalize high latency
  if (rtt > 1500) score -= 30;
  else if (rtt > 500) score -= 10;

  score = Math.max(0, Math.min(100, score));
  return score;
}

function guessOrigin(rtt: number, len: number, error: any): OriginGuess {
  if (error) return 'error';
  if (len < 50 && rtt < 100) return 'cached';
  if (rtt < 200) return 'local';
  if (rtt < 1000) return 'remote';
  return 'remote';
}

function timeoutPromise<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: any;
  return Promise.race([
    p,
    new Promise<T>((_, rej) => {
      timer = setTimeout(() => rej(new Error('timeout')), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

export class EchoRadar {
  baselineMs: number;
  alpha: number;
  maxAttempts: number;
  noiseFilter: NoiseFilter;
  private inFlight = new Map<string, InFlight>();
  private counter = 0;

  constructor(opts: EchoRadarOptions = {}) {
    this.baselineMs = opts.baselineMs ?? 500;
    this.alpha = opts.alpha ?? 0.2;
    this.maxAttempts = opts.maxAttempts ?? 2;
    this.noiseFilter = opts.noiseFilter ?? defaultNoiseFilter;
  }

  start(key: string): string {
    const id = `${key}:${++this.counter}`;
    this.inFlight.set(id, {
      id,
      key,
      startedAt: Date.now(),
      attempts: 1
    });
    return id;
  }

  stop(id: string): { rtt: number; cls: RequestClass; attempts: number } | null {
    const rec = this.inFlight.get(id);
    if (!rec) return null;
    const rtt = Date.now() - rec.startedAt;

    this.baselineMs =
      (1 - this.alpha) * this.baselineMs + this.alpha * rtt;

    this.inFlight.delete(id);
    return { rtt, cls: this.classify(rtt), attempts: rec.attempts };
  }

  classify(rtt: number): RequestClass {
    if (rtt < this.baselineMs * 0.5) return 'short';
    if (rtt < this.baselineMs * 1.5) return 'normal';
    if (rtt < this.baselineMs * 3) return 'slow';
    return 'timeout';
  }

  getTimeoutThreshold(): number {
    return this.baselineMs * 3;
  }

  listInFlight() {
    return [...this.inFlight.values()];
  }

  markRetry(id: string): InFlight | null {
    const rec = this.inFlight.get(id);
    if (!rec) return null;
    rec.attempts += 1;
    rec.startedAt = Date.now();
    if (rec.attempts > this.maxAttempts) {
      this.inFlight.delete(id);
    }
    return rec;
  }
}

// Helper pour wrapper une fonction async
export function wrapEcho<TArgs extends any[], TResult>(
  key: string,
  radar: EchoRadar,
  fn: (...args: TArgs) => Promise<TResult>,
  wings?: BatWings,
  requestType?: string
) {
  return async (...args: TArgs): Promise<{
    result: TResult | null;
    rtt: number;
    cls: RequestClass;
    attempts: number;
    error?: unknown;
    isNoise: boolean;
    signalStrength: number;
    originGuess: OriginGuess;
    dropped?: boolean;
  }> => {
    if (wings && requestType) wings.selectProfile(requestType);

    const id = radar.start(key);
    let result: TResult | null = null;
    let error: any = undefined;
    let attempts = 0;
    let dropped = false;

    while (true) {
      attempts++;
      try {
        const timeoutMs = wings ? wings.computeTimeout(radar.baselineMs) : radar.getTimeoutThreshold();
        result = await timeoutPromise(fn(...args), timeoutMs) as TResult;
        const echo = radar.stop(id)!;
        const isNoise = radar.noiseFilter.ignore(result, undefined);
        const len = typeof result === 'string' ? result.length : (result ? JSON.stringify(result).length : 0);
        const signalStrength = computeSignalStrength(result, undefined, echo.rtt);
        const originGuess = guessOrigin(echo.rtt, len, undefined);

        if (wings) {
          wings.applyProfile(echo.cls);
          if (wings.shouldAbort()) {
            wings.drop(id);
            dropped = true;
            return { result, ...echo, isNoise, signalStrength, originGuess, dropped };
          }
        }

        return { result, ...echo, isNoise, signalStrength, originGuess, attempts };
      } catch (err) {
        error = err;
        // if wings suggest retry based on profile
        attempts = Math.max(1, attempts);
        const shouldRetry = wings ? wings.shouldRetry(attempts) : attempts < radar.maxAttempts;
        const echo = radar.stop(id) || { rtt: 0, cls: 'timeout' as RequestClass, attempts };
        const isNoise = radar.noiseFilter.ignore(null, error);
        const signalStrength = computeSignalStrength(null, error, echo.rtt);
        const originGuess = guessOrigin(echo.rtt, 0, error);

        if (wings) {
          wings.applyProfile(echo.cls);
          if (wings.shouldAbort()) {
            wings.drop(id);
            // fire recovery asynchronously
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            wings.emergencyRecovery();
            return { result: null, error, ...echo, isNoise, signalStrength, originGuess, dropped: true };
          }
        }

        if (!shouldRetry) {
          return { result: null, error, ...echo, isNoise, signalStrength, originGuess };
        }

        // prepare for next attempt
        if (wings) wings.state.retries = attempts;
        radar.markRetry(id);
        // small backoff
        await new Promise((r) => setTimeout(r, 50 * attempts));
        continue;
      }
    }
  };
}

export { BatWings };
export { Bat } from './bat';
export { Ears } from './ears';
export { Wings } from './wings';
export { Fangs } from './fangs';
export { Inversion } from './inversion';
export { Heart } from './heart';
export { Memory } from './memory';
export { Hormones } from './hormones';
export { Immune } from './immune';
export { Sleep } from './sleep';
export { Instinct } from './instinct';
export * from './types';
export * from './profiles';
