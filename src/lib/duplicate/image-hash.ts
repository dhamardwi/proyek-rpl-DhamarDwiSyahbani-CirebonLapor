/**
 * Perceptual hash gambar (dHash 64-bit) untuk deteksi gambar serupa.
 *
 * Menggunakan `sharp` yang sudah tersedia sebagai dependensi Next.js.
 * Hash disimpan pada `report_images.image_hash`.
 */

import sharp from "sharp";

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;

function popcount(value: number): number {
  let count = 0;
  let n = value;
  while (n) {
    n &= n - 1;
    count += 1;
  }
  return count;
}

/**
 * Hitung dHash 64-bit dari buffer gambar. Mengembalikan 16 karakter hex,
 * atau `null` bila gambar tidak dapat diproses.
 */
export async function computeImageHash(input: Buffer): Promise<string | null> {
  try {
    const { data } = await sharp(input)
      .greyscale()
      .resize(HASH_WIDTH, HASH_HEIGHT, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let hex = "";
    for (let y = 0; y < HASH_HEIGHT; y += 1) {
      let nibble = 0;
      let bitCount = 0;
      for (let x = 0; x < HASH_WIDTH - 1; x += 1) {
        const left = data[y * HASH_WIDTH + x];
        const right = data[y * HASH_WIDTH + x + 1];
        nibble = (nibble << 1) | (left < right ? 1 : 0);
        bitCount += 1;
        if (bitCount === 4) {
          hex += nibble.toString(16);
          nibble = 0;
          bitCount = 0;
        }
      }
    }
    return hex.padEnd(16, "0").slice(0, 16);
  } catch (error) {
    console.warn(
      "[IMAGE_HASH] Gagal menghitung hash gambar:",
      error instanceof Error ? error.message : "unknown"
    );
    return null;
  }
}

/** Jarak Hamming antara dua hash hex (0 = identik). */
export function hammingDistanceHex(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;

  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    const nibbleA = Number.parseInt(a[i], 16);
    const nibbleB = Number.parseInt(b[i], 16);
    if (Number.isNaN(nibbleA) || Number.isNaN(nibbleB)) {
      return Number.POSITIVE_INFINITY;
    }
    distance += popcount(nibbleA ^ nibbleB);
  }
  return distance;
}

/** Kemiripan gambar 0..1 berdasarkan jarak Hamming. */
export function imageHashSimilarity(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const distance = hammingDistanceHex(a, b);
  if (!Number.isFinite(distance)) return 0;
  const bits = Math.max(1, (a?.length ?? 0) * 4);
  return Math.max(0, 1 - distance / bits);
}
