import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getKey(keyBase64: string): Buffer {
  const buf = Buffer.from(keyBase64, "base64");
  if (buf.length !== 32) {
    throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY must be 32 bytes base64");
  }
  return buf;
}

export function encryptSecret(plaintext: string, keyBase64: string): string {
  const key = getKey(keyBase64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptSecret(payloadBase64: string, keyBase64: string): string {
  const key = getKey(keyBase64);
  const payload = Buffer.from(payloadBase64, "base64");
  const iv = payload.subarray(0, IV_BYTES);
  const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = payload.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
