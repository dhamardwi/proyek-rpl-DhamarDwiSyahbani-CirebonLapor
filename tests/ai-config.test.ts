import "./test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { decryptSecret, encryptSecret, isEncrypted } from "@/lib/ai/crypto";
import {
  filterGeminiModels,
  filterNvidiaChatModels,
  isLikelyChatModel,
} from "@/lib/ai/providers";
import {
  buildGeminiGenerationConfig,
  extractGeminiText,
  generateGeminiContent,
  geminiThinkingConfig,
} from "@/lib/ai/gemini";
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

test("filter model Gemini hanya menyisakan generateContent", () => {
  const models = filterGeminiModels([
    { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
    { name: "models/gemma-3-27b-it", supportedGenerationMethods: ["generateContent"] },
  ]);
  assert.deepEqual(models, ["gemini-2.5-flash", "gemma-3-27b-it"]);
});

test("filter model Gemini membuang model non-teks dan mengutamakan model default", () => {
  const models = filterGeminiModels([
    { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.6-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.5-flash-lite", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.5-flash-tts", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-2.5-flash-image", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.8-live", supportedGenerationMethods: ["generateContent"] },
    {
      name: "models/imagen-4.0-generate-001",
      supportedGenerationMethods: ["generateContent"],
      outputModalities: ["IMAGE"],
    },
  ]);

  assert.equal(models[0], "gemini-3.6-flash");
  assert.deepEqual(models, [
    "gemini-3.6-flash",
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
  ]);
});

test("konfigurasi Gemini mengikuti generasi model dan tidak memakai sampling lama", () => {
  assert.deepEqual(geminiThinkingConfig("gemini-3.8-flash"), {
    thinkingLevel: "LOW",
  });
  assert.deepEqual(geminiThinkingConfig("gemini-2.5-flash"), {
    thinkingBudget: 0,
  });
  assert.equal(geminiThinkingConfig("gemma-3-27b-it"), null);

  const config = buildGeminiGenerationConfig({
    model: "gemini-3.8-flash",
    maxOutputTokens: 512,
    json: true,
  });
  assert.equal(config.maxOutputTokens, 512);
  assert.equal(config.responseMimeType, "application/json");
  assert.deepEqual(config.thinkingConfig, { thinkingLevel: "LOW" });
  assert.equal("temperature" in config, false);
  assert.equal("topP" in config, false);
});

test("extractGeminiText mengabaikan part thought", () => {
  assert.equal(
    extractGeminiText({
      candidates: [
        {
          content: {
            parts: [
              { text: "berpikir...", thought: true },
              { text: "{\"ok\":true}" },
            ],
          },
        },
      ],
    }),
    "{\"ok\":true}"
  );
  assert.equal(extractGeminiText(null), "");
});

test("generateGeminiContent fallback ke model default saat model lama 404", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });

    if (url.includes("gemini-2.5-flash")) {
      return new Response(
        JSON.stringify({ error: { message: "model not found", code: 404 } }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "OK" }] }, finishReason: "STOP" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const result = await generateGeminiContent({
      apiKey: "AIza-contoh",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: "OK" }] }],
      maxOutputTokens: 256,
    });

    assert.equal(result.ok, true);
    assert.equal(result.text, "OK");
    assert.equal(result.usedModel, "gemini-3.6-flash");
    assert.equal(result.fallbackFrom, "gemini-2.5-flash");
    assert.equal(calls.length, 2);

    const firstConfig = calls[0].body.generationConfig as Record<string, unknown>;
    const secondConfig = calls[1].body.generationConfig as Record<string, unknown>;
    assert.equal("temperature" in firstConfig, false);
    assert.deepEqual(firstConfig.thinkingConfig, { thinkingBudget: 0 });
    assert.deepEqual(secondConfig.thinkingConfig, { thinkingLevel: "LOW" });
    assert.equal(calls[0].url.endsWith("models/gemini-2.5-flash:generateContent"), true);
    assert.equal(calls[1].url.endsWith("models/gemini-3.6-flash:generateContent"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("generateGeminiContent fallback saat model high-demand (503), tetapi tidak saat key invalid (400)", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);

    if (url.includes("gemini-3.8-flash")) {
      return new Response(
        JSON.stringify({ error: { message: "high demand", code: 503 } }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.includes("gemini-3.6-flash")) {
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "OK" }] }, finishReason: "STOP" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: { message: "API key not valid", code: 400 } }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const overloaded = await generateGeminiContent({
      apiKey: "AIza-contoh",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-3.8-flash",
      contents: [{ role: "user", parts: [{ text: "OK" }] }],
      maxOutputTokens: 256,
    });
    assert.equal(overloaded.ok, true);
    assert.equal(overloaded.usedModel, "gemini-3.6-flash");
    assert.equal(overloaded.fallbackFrom, "gemini-3.8-flash");

    calls.length = 0;
    const invalidKey = await generateGeminiContent({
      apiKey: "AIza-salah",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-tidak-ada",
      contents: [{ role: "user", parts: [{ text: "OK" }] }],
      maxOutputTokens: 256,
    });
    assert.equal(invalidKey.ok, false);
    assert.equal(invalidKey.status, 400);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
