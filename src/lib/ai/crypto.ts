/**
 * Enkripsi API key provider AI.
 *
 * Format ciphertext yang dipakai (kompatibel dengan data lama di tabel
 * `app_settings`): `enc:v1:<iv_base64>:<tag_base64>:<data_base64>`.
 *
 * Kunci diturunkan dari `AI_CONFIG_SECRET` (jika ada) atau `NEXTAUTH_SECRET`
 * dengan SHA-256. Untuk membaca ciphertext lama, beberapa kandidat secret
 * dicoba; hanya ciphertext yang tag GCM-nya valid yang dianggap berhasil.
 *
 * Modul ini hanya boleh diimpor di server. API key tidak pernah dikirim
 * ke client dalam bentuk plaintext maupun ciphertext.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc";
const VERSION = "v1";

function candidateSecrets(): string[] {
  const secrets: string[] = [];
  const primary = process.env.AI_CONFIG_SECRET?.trim();
  const nextAuth = process.env.NEXTAUTH_SECRET?.trim();

  if (primary) secrets.push(primary);
  if (nextAuth) secrets.push(nextAuth);
  // Fallback khusus pengembangan agar aplikasi tetap bisa enkripsi/dekripsi.
  secrets.push("cirebonlapor-development-secret");

  return Array.from(new Set(secrets));
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export function isEncrypted(value: string | null | undefined): boolean {
  return Boolean(
    value && (value.startsWith(`${PREFIX}:${VERSION}:`) || value.startsWith("v1."))
  );
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) {
    throw new Error("Nilai yang dienkripsi tidak boleh kosong.");
  }

  const key = deriveKey(candidateSecrets()[0]);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

function parseCiphertext(
  ciphertext: string
): { iv: Buffer; tag: Buffer; data: Buffer } | null {
  // Format baru: enc:v1:iv:tag:data
  if (ciphertext.startsWith(`${PREFIX}:${VERSION}:`)) {
    const parts = ciphertext.split(":");
    if (parts.length !== 5) return null;
    return {
      iv: Buffer.from(parts[2], "base64"),
      tag: Buffer.from(parts[3], "base64"),
      data: Buffer.from(parts[4], "base64"),
    };
  }

  // Format transisi lama: v1.iv.tag.data (base64url)
  if (ciphertext.startsWith("v1.")) {
    const parts = ciphertext.split(".");
    if (parts.length !== 4) return null;
    return {
      iv: Buffer.from(parts[1], "base64url"),
      tag: Buffer.from(parts[2], "base64url"),
      data: Buffer.from(parts[3], "base64url"),
    };
  }

  return null;
}

export function decryptSecret(
  ciphertext: string | null | undefined
): string | null {
  if (!ciphertext) return null;

  // Nilai lama yang masih plaintext dianggap apa adanya.
  if (!isEncrypted(ciphertext)) return ciphertext;

  const parsed = parseCiphertext(ciphertext);
  if (!parsed) return null;

  for (const secret of candidateSecrets()) {
    try {
      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        deriveKey(secret),
        parsed.iv
      );
      decipher.setAuthTag(parsed.tag);
      const plaintext = Buffer.concat([
        decipher.update(parsed.data),
        decipher.final(),
      ]).toString("utf8");
      if (plaintext) return plaintext;
    } catch {
      // Coba kandidat secret berikutnya.
    }
  }

  return null;
}

/** Menyamarkan nilai sensitif untuk log/error agar tidak bocor. */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${"•".repeat(6)}${value.slice(-4)}`;
}
