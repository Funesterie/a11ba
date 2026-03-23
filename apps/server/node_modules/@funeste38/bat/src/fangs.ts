export type RequestType = 'chat' | 'heavy' | 'critical' | 'echo' | 'file' | 'system';
export type ChannelKind = 'local' | 'proxy' | 'remote' | 'mock';

export interface ChannelStats { rttAvg: number; errors: number; inFlight: number }
export interface Channel { id: string; kind: ChannelKind; endpoint: string; proxy?: string; weight: number; stats: ChannelStats }
export interface FangsOptions { maxConcurrency?: number; channels: Channel[] }

export class Fangs {
  private channels: Channel[];
  private maxConcurrency: number;
  private semaphore = 0;
  private rr = 0;

  constructor(opts: FangsOptions) { this.channels = opts.channels.slice(); this.maxConcurrency = opts.maxConcurrency ?? 4; }

  chooseChannel(type: RequestType): Channel {
    const live = this.channels.filter(c => c.stats.errors < 5);
    if (!live.length) throw new Error('No available channel');
    if (type === 'echo') return live.reduce((best, c) => c.stats.rttAvg < best.stats.rttAvg ? c : best);
    if (type === 'heavy') return live.reduce((best, c) => c.stats.inFlight < best.stats.inFlight ? c : best);
    const total = live.reduce((s, c) => s + (c.weight || 1), 0);
    let pick = this.rr % total;
    for (const c of live) { const w = c.weight || 1; if (pick < w) { this.rr = (this.rr + 1) % total; return c; } pick -= w; }
    return live[0];
  }

  trackStart(channelId: string) { const ch = this.channels.find(c => c.id === channelId); if (ch) ch.stats.inFlight++; }
  trackEnd(channelId: string, rtt: number, ok: boolean) { const ch = this.channels.find(c => c.id === channelId); if (!ch) return; ch.stats.inFlight = Math.max(0, ch.stats.inFlight - 1); ch.stats.rttAvg = ch.stats.rttAvg === 0 ? rtt : (0.8 * ch.stats.rttAvg + 0.2 * rtt); if (!ok) ch.stats.errors++; }

  async run<T>(type: RequestType, fn: (channel: Channel) => Promise<T>): Promise<{ channel: Channel; result: T }> {
    while (this.semaphore >= this.maxConcurrency) await new Promise(r => setTimeout(r, 10));
    this.semaphore++;
    const channel = this.chooseChannel(type);
    this.trackStart(channel.id);
    try { const res = await fn(channel); this.trackEnd(channel.id, 0, true); return { channel, result: res }; }
    catch (e) { this.trackEnd(channel.id, 0, false); throw e; }
    finally { this.semaphore = Math.max(0, this.semaphore - 1); }
  }
}
