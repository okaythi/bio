// functions/api/auth/_crypto.ts

/**
 * Password Hashing & Verification using Web Crypto API (PBKDF2-SHA256)
 * Salt: A unique per-user random cryptographic string added to the password
 * before hashing to prevent rainbow table attacks and hash collisions.
 */

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const enc = new TextEncoder();
  const salt = saltHex 
    ? hexToBuf(saltHex) 
    : crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return {
    hash: bufToHex(derivedBits),
    salt: bufToHex(salt),
  };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const { hash: computedHash } = await hashPassword(password, salt);
  return computedHash === hash;
}

function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
