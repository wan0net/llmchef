// src/lib/llmchef/crypto-utils.ts
// Web Crypto helpers for encrypting sensitive data at rest.

const DEFAULT_PASSPHRASE =
  (import.meta.env.VITE_SYNC_REPO_PASSPHRASE as string | undefined) ??
  "llmchef-default-sync-repo-passphrase-change-me";

async function getKeyMaterial(passphrase: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(passphrase);
  return crypto.subtle.importKey("raw", keyData, "PBKDF2", false, [
    "deriveBits",
    "deriveKey",
  ]);
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const keyMaterial = await getKeyMaterial(passphrase);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface EncryptedString {
  iv: number[];
  salt: number[];
  ciphertext: number[];
}

export async function encryptString(
  plaintext: string,
  passphrase: string = DEFAULT_PASSPHRASE
): Promise<EncryptedString> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(plaintext)
    )
  );
  return {
    iv: Array.from(iv),
    salt: Array.from(salt),
    ciphertext: Array.from(ciphertext),
  };
}

export async function decryptString(
  encrypted: EncryptedString,
  passphrase: string = DEFAULT_PASSPHRASE
): Promise<string> {
  const decoder = new TextDecoder();
  const salt = new Uint8Array(encrypted.salt);
  const iv = new Uint8Array(encrypted.iv);
  const ciphertext = new Uint8Array(encrypted.ciphertext);
  const key = await deriveKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return decoder.decode(decrypted);
}
