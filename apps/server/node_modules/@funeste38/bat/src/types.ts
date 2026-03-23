export type RequestType = 'chat' | 'heavy' | 'critical' | 'echo' | 'file' | 'system';
export type ChannelKind = 'local' | 'proxy' | 'remote' | 'mock';
export interface ChannelStats { rttAvg: number; errors: number; inFlight: number }
export interface Channel { id: string; kind: ChannelKind; endpoint: string; proxy?: string; weight: number; stats: ChannelStats }
