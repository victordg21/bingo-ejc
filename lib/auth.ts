// Admin auth: HMAC-signed cookie token. Works in both Edge (middleware)
// and Node (API routes) because we use Web Crypto.

export const ADMIN_COOKIE = "bingo_admin";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signAdminToken(secret: string): Promise<string> {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = String(expiresAt);
  const sig = await hmacSha256(secret, payload);
  return `${base64UrlEncode(new TextEncoder().encode(payload))}.${base64UrlEncode(sig)}`;
}

export async function verifyAdminToken(token: string, secret: string): Promise<boolean> {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return false;
    const payload = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const expiresAt = Number(payload);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
    const expected = await hmacSha256(secret, payload);
    const given = base64UrlDecode(sigB64);
    return timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}
