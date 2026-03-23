export class Immune {
  private blacklist = new Map<string, number>();
  private penaltyMs = 30000;
  isBlacklisted(channelId: string) { const until = this.blacklist.get(channelId); if (!until) return false; if (Date.now() > until) { this.blacklist.delete(channelId); return false; } return true; }
  blacklistChannel(channelId: string, durationMs?: number) { const until = Date.now() + (durationMs ?? this.penaltyMs); this.blacklist.set(channelId, until); }
  unblacklist(channelId: string) { this.blacklist.delete(channelId); }
  prune() { for (const [k, until] of this.blacklist.entries()) if (Date.now() > until) this.blacklist.delete(k); }
  list() { return Array.from(this.blacklist.entries()).map(([id, until]) => ({ id, until })); }
}
