export interface WingProfile {
  rateGain: number;
  rateLoss: number;
  maxRetries: number;
  timeoutFactor: number;
  aggressiveness?: number; // 0..1
}

export const defaultProfiles: Record<string, WingProfile> = {
  echo:     { rateGain: 0.3,  rateLoss: -0.3, maxRetries: 0, timeoutFactor: 0.5, aggressiveness: 1 },
  chat:     { rateGain: 0.1,  rateLoss: -0.1, maxRetries: 2, timeoutFactor: 1.0, aggressiveness: 0.5 },
  heavy:    { rateGain: 0.2,  rateLoss: -0.05,maxRetries: 3, timeoutFactor: 2.0, aggressiveness: 0.8 },
  critical: { rateGain: 0.05, rateLoss: -0.4, maxRetries: 0, timeoutFactor: 0.8, aggressiveness: 0.1 },
  file:     { rateGain: 0.05, rateLoss: -0.05,maxRetries: 1, timeoutFactor: 3.0, aggressiveness: 0.3 },
  system:   { rateGain: 0,    rateLoss: -0.3, maxRetries: 0, timeoutFactor: 0.6, aggressiveness: 0.2 }
};
