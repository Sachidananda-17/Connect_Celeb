// Simple per-instance sliding window: 10 requests / 10s per identifier.
// Good enough to stop accidental spam; swap for a shared store if traffic grows.
const hits = new Map<string, number[]>();

export async function rateLimit(identifier: string, limit = 10, windowMs = 10_000) {
  const now = Date.now();
  const recent = (hits.get(identifier) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(identifier, recent);
  return { success: recent.length <= limit };
}
