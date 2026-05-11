// Buyer access code generator. Format: NAMEPREFIX-XXXX
// - NAMEPREFIX: up to 4 letters from the first name, uppercased, no accents
// - XXXX: 4 chars from an ambiguous-char-free alphabet

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1

export function nameToPrefix(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  const normalized = first
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return normalized.slice(0, 4) || "PLAY";
}

export function randomCodeSuffix(len = 4): string {
  let out = "";
  const buf = new Uint32Array(len);
  // crypto.getRandomValues works in Edge, Node 20+, and browsers
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

export function generateAccessCode(fullName: string): string {
  return `${nameToPrefix(fullName)}-${randomCodeSuffix(4)}`;
}

/**
 * Parse a buyer's card-code input. Accepts: comma/space/newline separated codes
 * and ranges like "100-105". Returns sorted unique codes within [1, max].
 */
export function parseCardCodes(input: string, max = 1000): { codes: number[]; errors: string[] } {
  const errors: string[] = [];
  const set = new Set<number>();
  const tokens = input
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const tok of tokens) {
    const range = tok.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b > max || a > b) {
        errors.push(`Range inválido: "${tok}"`);
        continue;
      }
      for (let n = a; n <= b; n++) set.add(n);
      continue;
    }
    const n = Number(tok);
    if (!Number.isInteger(n) || n < 1 || n > max) {
      errors.push(`Código inválido: "${tok}"`);
      continue;
    }
    set.add(n);
  }
  return { codes: Array.from(set).sort((a, b) => a - b), errors };
}

export function formatCardCode(n: number): string {
  return String(n).padStart(4, "0");
}
