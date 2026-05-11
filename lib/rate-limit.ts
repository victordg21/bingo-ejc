// Module-level in-memory rate limiter. Persists across requests within a warm
// Lambda instance. Per-IP, sliding window. Good enough for a single party.

type Bucket = number[];
const buckets = new Map<string, Bucket>();

export function rateLimit(
  ip: string,
  opts: { windowMs: number; max: number },
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  const arr = buckets.get(ip) ?? [];
  // drop old hits
  let i = 0;
  while (i < arr.length && arr[i] < cutoff) i++;
  const recent = arr.slice(i);
  if (recent.length >= opts.max) {
    return { ok: false, retryAfterMs: recent[0] + opts.windowMs - now };
  }
  recent.push(now);
  buckets.set(ip, recent);
  return { ok: true, retryAfterMs: 0 };
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
