export interface InstinctOptions {
  defaults?: Record<string, string>;
  config?: Record<string, string>;
  envPriority?: ('env'|'config'|'defaults')[];
}

export class Instinct {
  defaults: Record<string,string>;
  config: Record<string,string>;
  envPriority: ('env'|'config'|'defaults')[];

  constructor(opts: InstinctOptions = {}){
    this.defaults = opts.defaults ?? {};
    this.config = opts.config ?? {};
    this.envPriority = opts.envPriority ?? ['env','config','defaults'];
  }

  detectSlots(cmd: string): string[] {
    const re = /\{([A-Z0-9_\-]+)\}/g;
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(cmd)) !== null) {
      out.push(m[1]);
    }
    return Array.from(new Set(out));
  }

  resolveSlot(name: string): string | undefined {
    for (const src of this.envPriority) {
      if (src === 'env' && (process.env as any)[name]) return (process.env as any)[name];
      if (src === 'config' && this.config[name]) return this.config[name];
      if (src === 'defaults' && this.defaults[name]) return this.defaults[name];
    }
    return undefined;
  }

  fill(cmd: string): { cmd: string; missing: string[] } {
    const slots = this.detectSlots(cmd);
    const missing: string[] = [];
    let filled = cmd;
    for (const s of slots) {
      const val = this.resolveSlot(s);
      if (val === undefined) { missing.push(s); continue; }
      const re = new RegExp(`\\{${s}\\}`,'g');
      filled = filled.replace(re, val);
    }
    return { cmd: filled, missing };
  }
}
