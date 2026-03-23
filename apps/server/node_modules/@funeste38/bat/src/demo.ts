import { EchoRadar, wrapEcho, BatWings, Instinct } from './index';
import { Fangs, Channel } from './fangs';

const types = ['chat', 'heavy', 'critical', 'echo', 'file', 'system'];

async function fakeCall(text: string) {
  // random delay between 10ms and 2000ms
  const delay = 10 + Math.random() * 1990;
  await new Promise((res) => setTimeout(res, delay));
  if (Math.random() < 0.1) throw { status: 502, message: 'random fail' };
  // random short payloads sometimes
  if (Math.random() < 0.15) return '';
  const gen = Array.from({ length: Math.floor(Math.random() * 200) + 5 }, () => 'x').join('');
  return { echoed: text, delay, gen };
}

function formatError(err: unknown): string | undefined {
  if (!err) return undefined;
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    try {
      const anyErr = err as any;
      return anyErr && (anyErr.message ? String(anyErr.message) : JSON.stringify(anyErr));
    } catch {
      return String(err);
    }
  }
  return String(err);
}

async function demoFangs() {
  // demonstrate Instinct first
  const instinct = new Instinct({
    defaults: { A11_PATH: 'D:/A11', API_TOKEN: 'DEV_TOKEN' },
    config: { API_HOST: 'api.funesterie.me' }
  });

  const sampleCmd = 'start-server --path={A11_PATH} --host={API_HOST} --token={API_TOKEN}';
  console.log('Slots detected:', instinct.detectSlots(sampleCmd));
  const filled = instinct.fill(sampleCmd);
  console.log('Filled command:', filled.cmd);
  if (filled.missing.length) console.log('Missing slots:', filled.missing);

  const channels: Channel[] = [
    { id: 'local', kind: 'local', endpoint: 'http://127.0.0.1:3000', weight: 2, stats: { rttAvg: 300, errors: 0, inFlight: 0 } },
    { id: 'tunnel', kind: 'proxy', endpoint: 'https://api.funesterie.me', weight: 1, stats: { rttAvg: 800, errors: 0, inFlight: 0 } }
  ];
  const fangs = new Fangs({ maxConcurrency: 4, channels });

  // mock bridge that uses channel info
  const bridge = {
    askA11Raw: async (channel: any, text: string) => {
      // simulate network time influenced by channel rttAvg
      await new Promise((r) => setTimeout(r, Math.max(10, channel.stats.rttAvg / 10)));
      if (Math.random() < 0.05) throw { status: 502 };
      return { from: channel.id, text };
    }
  };

  for (let i = 0; i < 20; i++) {
    const type = types[i % types.length] as any;
    try {
      const { channel, result } = await fangs.run(type, async (ch) => bridge.askA11Raw(ch, `hello ${i}`));
      console.log(i, 'used', channel.id, 'result', result);
    } catch (e) {
      console.warn(i, 'failed', formatError(e));
    }
  }
}

async function main() {
  await demoFangs();
}

main().catch((e) => console.error(e));
