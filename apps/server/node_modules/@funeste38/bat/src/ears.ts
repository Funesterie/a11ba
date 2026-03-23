export type OriginGuess = 'local' | 'remote' | 'cached' | 'error';

export interface EarsResult { signalStrength: number; origin: OriginGuess; isNoise: boolean }

export class Ears {
  ignoreShortBytes = 5;

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
      if (s.length < this.ignoreShortBytes) return true;
    }
    if (typeof result === 'object') {
      try {
        const str = JSON.stringify(result);
        if (str === '{}' || str === '[]' || str.length < this.ignoreShortBytes) return true;
      } catch { return false; }
    }
    return false;
  }

  evaluate(result: any, rtt: number, error?: any): EarsResult {
    const isNoise = this.ignore(result, error);
    if (error) return { signalStrength: 0, origin: 'error', isNoise: true };

    let len = 0;
    if (typeof result === 'string') len = result.length;
    else if (result && typeof result === 'object') {
      try { len = JSON.stringify(result).length; } catch { len = 0; }
    }

    let score = Math.max(0, Math.min(100, 50 + Math.min(40, Math.round((len / 1000) * 40)) - (rtt > 1500 ? 30 : (rtt > 500 ? 10 : 0))));
    if (len < 20) score = Math.max(0, score - 20);

    const origin = error ? 'error' : (len < 50 && rtt < 100 ? 'cached' : (rtt < 200 ? 'local' : (rtt < 1000 ? 'remote' : 'remote')));
    return { signalStrength: score, origin, isNoise };
  }
}
