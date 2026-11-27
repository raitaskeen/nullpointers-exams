/**
 * PBKDF2-SHA256 via Web Crypto. Runs natively on Workers (bcrypt/argon2 in JS would blow the CPU budget)
 * and in Bun, so the seed script hashes with exactly the same code.
 * 100,000 iterations is the maximum the Workers runtime allows for PBKDF2.
 */
const ITERATIONS = 100_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const PREFIX = "pbkdf2_sha256";

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `${PREFIX}$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

/** Constant-time comparison so response timing doesn't leak how many bytes matched. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [prefix, iter, salt, hash] = stored.split("$");
  if (prefix !== PREFIX || !iter || !salt || !hash) return false;
  const candidate = await derive(password, unb64(salt), Number(iter));
  return timingSafeEqual(candidate, unb64(hash));
}

/** Used when the email doesn't exist, so "unknown user" takes as long as "wrong password". */
export const DUMMY_HASH = `${PREFIX}$${ITERATIONS}$${b64(new Uint8Array(SALT_BYTES))}$${b64(new Uint8Array(KEY_BYTES))}`;
