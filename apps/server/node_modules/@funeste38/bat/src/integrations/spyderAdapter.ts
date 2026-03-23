import { EchoRadar, BatWings } from '../index';
import { Fangs, Channel } from '../fangs';

export interface SpyderBridge {
  askA11Raw: (channel: Channel, text: string) => Promise<any>;
  type?: string; // request type for wings profiles
}

export function createSpyderAdapter(bridge: SpyderBridge, fangs?: Fangs) {
  const radar = new EchoRadar();
  const wings = new BatWings();

  async function callA11(text: string) {
    const directChannel: Channel = { id: 'direct', kind: 'local', endpoint: '', weight: 1, stats: { rttAvg: 0, errors: 0, inFlight: 0 } };
    // simple passthrough to the provided bridge
    return bridge.askA11Raw(directChannel, text);
  }

  async function askA11Multi(type: string, text: string) {
    if (!fangs) throw new Error('Fangs instance required for multi-channel calls');
    const { channel, result } = await fangs.run(type as any, async (ch) => {
      // askA11Raw expects (channel, text)
      return bridge.askA11Raw(ch, text);
    });
    return { channel, result };
  }

  return { callA11, askA11Multi, radar, wings };
}
