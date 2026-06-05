import { createHmac, randomBytes } from "node:crypto";

// =============================================================================
// TOTP (RFC 6238) — autenticação em dois fatores compatível com Google
// Authenticator / Authy / 1Password. Implementado com node:crypto (HMAC-SHA1),
// sem dependências externas.
// =============================================================================

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Gera um segredo TOTP novo (base32, 20 bytes = 160 bits). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Código de 6 dígitos para um dado contador (passo de tempo). */
function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  // counter de 64 bits big-endian (parte alta cabe em 32 bits por décadas).
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

/** Código atual (passo de 30s). */
export function totpNow(secret: string, atMs = Date.now()): string {
  return hotp(secret, Math.floor(atMs / 1000 / 30));
}

/**
 * Verifica um token, tolerando ±`window` passos de 30s (relógios dessincronizados).
 * Comparação de tamanho fixo; entrada normalizada (espaços removidos).
 */
export function verifyTotp(secret: string, token: string, window = 1, atMs = Date.now()): boolean {
  const t = (token ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(t)) return false;
  const counter = Math.floor(atMs / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (hotp(secret, counter + i) === t) return true;
  }
  return false;
}

/** URI otpauth:// para QR Code no app autenticador. */
export function otpauthUri(secret: string, account: string, issuer = "Plataforma NR-1"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}
