import "./test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { decryptSecret, encryptSecret, isEncrypted } from "@/lib/ai/crypto";
import {
  filterNvidiaChatModels,
  isLikelyChatModel,
} from "@/lib/ai/providers";
import {
  haversineMeters,
  scoreCandidate,
  textSimilarity,
} from "@/lib/duplicate/service";
import { hammingDistanceHex, imageHashSimilarity } from "@/lib/duplicate/image-hash";

test("encryptSecret menghasilkan format enc:v1 dan bisa didekripsi", () => {
  const plaintext = "nvapi-contoh-key-rahasia";
  const ciphertext = encryptSecret(plaintext);

  assert.equal(isEncrypted(ciphertext), true);
  assert.match(ciphertext, /^enc:v1:/);
  assert.notEqual(ciphertext, plaintext);
  assert.equal(decryptSecret(ciphertext), plaintext);
});

test("decryptSecret menolak ciphertext yang rusak tanpa melempar error", () => {
  assert.equal(decryptSecret("enc:v1:rusak:rusak:rusak"), null);
  assert.equal(decryptSecret("bukan-ciphertext"), "bukan-ciphertext");
  assert.equal(decryptSecret(null), null);
});

test("filter model NVIDIA membuang model parse/embedding/vision", () => {
  assert.equal(isLikelyChatModel("nvidia/nemotron-parse-2.0"), false);
  assert.equal(isLikelyChatModel("nvidia/nvclip"), false);
  assert.equal(isLikelyChatModel("nvidia/llama-3.1-nemoguard-8b-topic-control"), false);
  assert.equal(isLikelyChatModel("snowflake/arctic-embed-l"), false);
  assert.equal(isLikelyChatModel("mistralai/mistral-large-4-1t-a52b"), true);
  assert.equal(isLikelyChatModel("openai/gpt-oss-20b"), true);

  const filtered = filterNvidiaChatModels([
    "mistralai/mistral-large-4-1t-a52b",
    "nvidia/nemotron-parse-2.0",
    "nvidia/nvclip",
    "openai/gpt-oss-20b",
  ]);
  assert.deepEqual(filtered, [
    "mistralai/mistral-large-4-1t-a52b",
    "openai/gpt-oss-20b",
  ]);
});

test("textSimilarity mendeteksi teks mirip dan tidak mirip", () => {
  const a = "Jalan berlubang besar di depan pasar";
  const b = "Jalan berlubang besar depan pasar";
  const c = "Lampu penerangan taman mati";

  assert.ok(textSimilarity(a, b) > 0.7);
  assert.ok(textSimilarity(a, c) < 0.2);
  assert.equal(textSimilarity("", a), 0);
});

test("haversineMeters menghitung jarak koordinat", () => {
  // Dua titik berdekatan di Cirebon (± 111 m untuk 0.001 derajat lintang).
  const distance = haversineMeters(-6.732, 108.552, -6.733, 108.552);
  assert.ok(distance > 100 && distance < 120);
});

test("scoreCandidate memberi skor tinggi untuk laporan yang mirip", () => {
  const base = {
    title: "Jalan berlubang di depan pasar",
    description: "Lubang cukup besar dan berbahaya bagi pengendara",
    facilityTypeId: "jalan",
    latitude: -6.732,
    longitude: 108.552,
    imageHash: "0123456789abcdef",
  };

  const similar = scoreCandidate(base, {
    title: "Jalan berlubang depan pasar",
    description: "Lubang besar berbahaya bagi pengendara",
    facilityTypeId: "jalan",
    latitude: -6.7322,
    longitude: 108.5522,
    imageHash: "0123456789abcdef",
  });

  const different = scoreCandidate(base, {
    title: "Lampu taman mati",
    description: "Penerangan taman tidak menyala sejak seminggu",
    facilityTypeId: "taman",
    latitude: -7.5,
    longitude: 110.0,
    imageHash: "fedcba9876543210",
  });

  assert.ok(similar.score > 0.75);
  assert.ok(different.score < 0.5);
});

test("hammingDistanceHex dan imageHashSimilarity", () => {
  assert.equal(hammingDistanceHex("0000000000000000", "0000000000000000"), 0);
  assert.equal(hammingDistanceHex("ffffffffffffffff", "0000000000000000"), 64);
  assert.equal(imageHashSimilarity("abcdef0123456789", "abcdef0123456789"), 1);
  assert.equal(imageHashSimilarity(null, "abcdef0123456789"), 0);
});
