/**
 * Pemeriksaan laporan duplikat.
 *
 * Strategi berlapis (fail-open):
 * 1. Skor lokal: kemiripan teks, kategori fasilitas, jarak koordinat,
 *    dan kemiripan hash gambar (dHash).
 * 2. Gemini (opsional) untuk mengonfirmasi kandidat teratas.
 *
 * Gemini TIDAK PERNAH menghalangi pengiriman laporan: semua kegagalan
 * dikembalikan ke hasil lokal.
 */

import db from "@/lib/db";
import { imageHashSimilarity } from "./image-hash";

export interface DuplicateCheckInput {
  reportId: string;
  title: string;
  description?: string | null;
  facilityTypeId: string;
  latitude?: number | null;
  longitude?: number | null;
  imageHash?: string | null;
}

export interface DuplicateCandidate {
  reportId: string;
  title: string;
  score: number;
  textSimilarity: number;
  titleScore: number;
  descriptionScore: number;
  categoryScore: number;
  locationScore: number;
  imageSimilarity: number;
  distanceMeters: number | null;
  sameFacility: boolean;
  status: string;
  createdAt: Date;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  method: "GEMINI" | "LOKAL";
  score: number;
  reportId: string | null;
  reason: string;
  candidates: DuplicateCandidate[];
}

/** Ambang skor lokal untuk menandai kemungkinan duplikat. */
export const DUPLICATE_THRESHOLD = 0.62;
/** Kemiripan gambar yang dianggap identik. */
export const IMAGE_IDENTICAL_THRESHOLD = 0.94;
/** Jarak maksimum (meter) yang masih relevan untuk skor lokasi. */
const DISTANCE_SCALE_METERS = 500;
/** Rentang waktu kandidat yang diperiksa. */
const CANDIDATE_WINDOW_DAYS = 90;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string | null | undefined): Set<string> {
  const tokens = normalizeText(value).split(" ").filter((token) => token.length > 2);
  return new Set(tokens);
}

/** Kemiripan teks 0..1 (gabungan Jaccard + containment). */
export function textSimilarity(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }

  const union = setA.size + setB.size - intersection;
  const jaccard = union > 0 ? intersection / union : 0;
  const containment = intersection / Math.min(setA.size, setB.size);
  return Math.max(0, Math.min(1, jaccard * 0.6 + containment * 0.4));
}

/** Jarak haversine dalam meter. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface CandidateScore {
  score: number;
  textSimilarity: number;
  titleScore: number;
  descriptionScore: number;
  categoryScore: number;
  locationScore: number;
  imageSimilarity: number;
  distanceMeters: number | null;
  sameFacility: boolean;
}

/**
 * Skor gabungan lokal. Bobot dinormalisasi ulang saat data tidak tersedia
 * (mis. koordinat atau gambar kosong).
 */
export function scoreCandidate(
  input: Pick<DuplicateCheckInput, "title" | "description" | "facilityTypeId" | "latitude" | "longitude" | "imageHash">,
  candidate: {
    title: string;
    description?: string | null;
    facilityTypeId: string;
    latitude?: number | null;
    longitude?: number | null;
    imageHash?: string | null;
  }
): CandidateScore {
  const titleScore = textSimilarity(input.title, candidate.title);
  const bodyScore = textSimilarity(input.description, candidate.description);
  const textScore = Math.max(titleScore, bodyScore * 0.9, (titleScore + bodyScore) / 2);

  const sameFacility = input.facilityTypeId === candidate.facilityTypeId;

  let distanceMeters: number | null = null;
  let distanceScore = 0;
  if (
    typeof input.latitude === "number" &&
    typeof input.longitude === "number" &&
    typeof candidate.latitude === "number" &&
    typeof candidate.longitude === "number"
  ) {
    distanceMeters = haversineMeters(
      input.latitude,
      input.longitude,
      candidate.latitude,
      candidate.longitude
    );
    distanceScore = Math.max(0, 1 - distanceMeters / DISTANCE_SCALE_METERS);
  }

  const imageSimilarity = imageHashSimilarity(input.imageHash, candidate.imageHash);

  // Bobot dasar; hanya komponen yang tersedia yang dihitung.
  const parts: Array<{ weight: number; value: number }> = [
    { weight: 0.35, value: textScore },
    { weight: 0.1, value: sameFacility ? 1 : 0 },
  ];
  if (distanceMeters !== null) parts.push({ weight: 0.2, value: distanceScore });
  if (input.imageHash && candidate.imageHash) {
    parts.push({ weight: 0.35, value: imageSimilarity });
  }

  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0) || 1;
  const score = parts.reduce((sum, part) => sum + part.weight * part.value, 0) / totalWeight;

  return {
    score,
    textSimilarity: textScore,
    titleScore,
    descriptionScore: bodyScore,
    categoryScore: sameFacility ? 1 : 0,
    locationScore: distanceScore,
    imageSimilarity,
    distanceMeters,
    sameFacility,
  };
}

function formatDistance(distance: number | null): string {
  if (distance === null) return "lokasi tidak dibandingkan";
  if (distance < 1000) return `${Math.round(distance)} m dari laporan lain`;
  return `${(distance / 1000).toFixed(1)} km dari laporan lain`;
}



/**
 * Jalankan pemeriksaan duplikat tanpa menyimpan hasil ke database.
 * Tidak pernah melempar error ke pemanggil untuk kegagalan AI.
 */
export async function checkDuplicateReport(
  input: DuplicateCheckInput
): Promise<DuplicateCheckResult> {
  const empty: DuplicateCheckResult = {
    isDuplicate: false,
    method: "LOKAL",
    score: 0,
    reportId: null,
    reason: "Tidak ada laporan pembanding.",
    candidates: [],
  };

  try {
    const since = new Date(Date.now() - CANDIDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const rows = await db.report.findMany({
      where: {
        id: { not: input.reportId },
        createdAt: { gte: since },
        OR: [
          { facilityTypeId: input.facilityTypeId },
          ...(input.imageHash
            ? [{ images: { some: { imageHash: input.imageHash } } }]
            : []),
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        facilityTypeId: true,
        latitude: true,
        longitude: true,
        status: true,
        createdAt: true,
        images: { select: { imageHash: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    });

    if (rows.length === 0) return empty;

    const candidates: DuplicateCandidate[] = rows
      .map((row) => {
        const hashes = row.images
          .map((image) => image.imageHash)
          .filter((hash): hash is string => Boolean(hash));

        const imageScore = hashes.reduce(
          (best, hash) => Math.max(best, imageHashSimilarity(input.imageHash, hash)),
          0
        );

        const scored = scoreCandidate(input, {
          title: row.title,
          description: row.description,
          facilityTypeId: row.facilityTypeId,
          latitude: row.latitude,
          longitude: row.longitude,
          imageHash: hashes[0] ?? null,
        });

        return {
          reportId: row.id,
          title: row.title,
          score: Math.max(scored.score, imageScore >= IMAGE_IDENTICAL_THRESHOLD ? 0.92 : 0),
          textSimilarity: scored.textSimilarity,
          titleScore: scored.titleScore,
          descriptionScore: scored.descriptionScore,
          categoryScore: scored.categoryScore,
          locationScore: scored.locationScore,
          imageSimilarity: imageScore,
          distanceMeters: scored.distanceMeters,
          sameFacility: scored.sameFacility,
          status: row.status,
          createdAt: row.createdAt,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const best = candidates[0];
    if (!best) return empty;

    const locallyDuplicate =
      best.score >= DUPLICATE_THRESHOLD ||
      best.imageSimilarity >= IMAGE_IDENTICAL_THRESHOLD;

    return {
      isDuplicate: locallyDuplicate,
      method: "LOKAL",
      score: best.score,
      reportId: locallyDuplicate ? best.reportId : null,
      reason: locallyDuplicate
        ? `Kemungkinan duplikat dengan laporan "${best.title}" ` +
          `(skor ${Math.round(best.score * 100)}%, ${formatDistance(best.distanceMeters)}, ` +
          `kemiripan teks ${Math.round(best.textSimilarity * 100)}%, ` +
          `kemiripan gambar ${Math.round(best.imageSimilarity * 100)}%).`
        : `Tidak ditemukan duplikat yang meyakinkan (skor tertinggi ${Math.round(best.score * 100)}%).`,
      candidates,
    };
  } catch (error) {
    console.error(
      "[DUPLICATE] Pemeriksaan gagal:",
      error instanceof Error ? error.message : "unknown"
    );
    return { ...empty, reason: "Pemeriksaan duplikat gagal; laporan tetap diproses." };
  }
}

/** Simpan hasil pemeriksaan duplikat ke laporan. Kegagalan tidak fatal. */
export async function persistDuplicateResult(
  reportId: string,
  result: DuplicateCheckResult
): Promise<void> {
  try {
    const candidates = result.candidates.slice(0, 5);

    await db.reportDuplicateAnalysis.deleteMany({ where: { reportId } });

    if (candidates.length === 0) return;

    await db.reportDuplicateAnalysis.createMany({
      data: candidates.map((candidate) => {
        const isPotential =
          candidate.score >= DUPLICATE_THRESHOLD ||
          candidate.imageSimilarity >= IMAGE_IDENTICAL_THRESHOLD;

        return {
          reportId,
          candidateReportId: candidate.reportId,
          similarityScore: candidate.score,
          descriptionScore: candidate.descriptionScore,
          titleScore: candidate.titleScore,
          categoryScore: candidate.categoryScore,
          locationScore: candidate.locationScore,
          photoScore: candidate.imageSimilarity,
          distanceMeters: candidate.distanceMeters,
          isPotential,
          aiStatus: "DONE",
          adminStatus: "PENDING",
          aiAnalysis: JSON.stringify({
            method: result.method,
            reason:
              result.isDuplicate && result.reportId === candidate.reportId
                ? result.reason
                : null,
            candidateTitle: candidate.title,
            candidateStatus: candidate.status,
          }),
        };
      }),
    });
  } catch (error) {
    console.warn(
      "[DUPLICATE] Gagal menyimpan hasil:",
      error instanceof Error ? error.message : "unknown"
    );
  }
}
