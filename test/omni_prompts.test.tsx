/**
 * KSP Image — Omni prompt builder tests (r7.26 — Prose mode)
 *
 * UPDATED từ r7.24 structured assertions → r7.26 prose flowing assertions.
 * Coverage giữ nguyên (same test cases, same fixture data) — chỉ thay đổi
 * expected output format để match guide DeepMind:
 *   https://deepmind.google/models/gemini-omni/prompt-guide/
 */

import { describe, it, expect } from "vitest";
import {
  buildOmniShotPrompt,
  formatReferenceManifest,
} from "../src/engine/omniShotPromptBuilder";
import {
  buildOmniMultiShotPrompt,
  formatMultiShotReferenceManifest,
} from "../src/engine/omniMultiShotPromptBuilder";

// ============================================================================
// Test fixtures (unchanged from r7.24)
// ============================================================================

const FAKE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function mkChar(name: string, opts: { isProtagonist?: boolean; withConcept?: boolean; conceptFormat?: "object" | "string" } = {}) {
  return {
    id: `char-${name.toLowerCase()}`,
    name,
    role: opts.isProtagonist ? "protagonist" : "supporting",
    isProtagonist: opts.isProtagonist ?? false,
    description: `${name} character`,
    uniqueIdentifiers: "",
    hasDialog: false,
    ...(opts.withConcept
      ? {
          conceptSheet:
            opts.conceptFormat === "string"
              ? FAKE_DATA_URL
              : {
                  id: `ref-${name}`,
                  filename: `${name.toLowerCase()}.png`,
                  mimeType: "image/png",
                  dataUrl: FAKE_DATA_URL,
                },
        }
      : {}),
  };
}

function mkShot(opts: {
  id?: string;
  order?: number;
  shotType?: string;
  cameraMovement?: string;
  actionEn?: string;
  durationSeconds?: number;
  audioDirection?: string;
} = {}) {
  return {
    id: opts.id ?? "shot-1",
    sceneId: "scene-1",
    order: opts.order ?? 1,
    titleVi: "Test shot",
    titleEn: "Test shot",
    shotType: opts.shotType ?? "medium",
    cameraMovement: opts.cameraMovement ?? "static",
    durationSeconds: opts.durationSeconds ?? 5,
    actionEn: opts.actionEn,
    audioDirection: opts.audioDirection,
  } as any;
}

function mkScene(opts: { settings?: string; lightingHintEn?: string; actionLinesEn?: string } = {}) {
  return {
    id: "scene-1",
    order: 1,
    titleVi: "Scene 1",
    titleEn: "Scene 1",
    settings: opts.settings ?? "Forest at dawn",
    lightingHintEn: opts.lightingHintEn,
    actionLinesEn: opts.actionLinesEn ?? "Maya walks through forest",
  } as any;
}

function mkSetting(opts: { animationStyle?: string; aspectRatio?: string } = {}) {
  return {
    animationStyle: opts.animationStyle ?? "live_action",
    aspectRatio: opts.aspectRatio ?? "16:9",
  } as any;
}

// ============================================================================
// omniShotPromptBuilder — Prose mode
// ============================================================================

describe("r7.26 — omniShotPromptBuilder (prose mode)", () => {
  it("produces single-sentence prose with character anchor", () => {
    const maya = mkChar("Maya", { isProtagonist: true, withConcept: true });
    const result = buildOmniShotPrompt({
      shot: mkShot({ shotType: "close_up", cameraMovement: "push_in", actionEn: "Maya looks up" }),
      scene: mkScene({ settings: "rainy alley" }),
      cast: [maya],
      setting: mkSetting(),
    });
    // Identity anchor preserved
    expect(result.promptText).toContain("Maya as shown in <image_0>");
    expect(result.promptText).toContain("preserve face, hair, and wardrobe exactly");
    // Action present
    expect(result.promptText).toContain("Maya looks up");
    // Setting integrated as "in {location}" — no "Setting:" label
    expect(result.promptText).toContain("in rainy alley");
    expect(result.promptText).not.toContain("Setting:");
    // Camera in opening clause — no "Camera:" label
    expect(result.promptText).toContain("close-up pushing into");
    expect(result.promptText).not.toContain("Camera:");
    // Style as ambiance — no "Style:" label
    expect(result.promptText).toContain("ambiance");
    expect(result.promptText).not.toContain("Style:");
    // No Negative block
    expect(result.promptText).not.toContain("Negative:");
    // Single sentence ending with period
    expect(result.promptText.trim().endsWith(".")).toBe(true);
  });

  it("renders Omni-native vocabulary correctly in prose (oner, dolly_zoom, smartphone_zoom)", () => {
    const r1 = buildOmniShotPrompt({
      shot: mkShot({ cameraMovement: "oner", actionEn: "walk through hallway" }),
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
    });
    // "one continuous" in opening prefix
    expect(r1.promptText).toContain("one continuous");

    const r2 = buildOmniShotPrompt({
      shot: mkShot({ cameraMovement: "dolly_zoom", actionEn: "realize the truth" }),
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
    });
    expect(r2.promptText).toContain("dolly zoom");

    const r3 = buildOmniShotPrompt({
      shot: mkShot({ cameraMovement: "smartphone_zoom" }),
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
    });
    expect(r3.promptText).toContain("natural smartphone-zoom");
  });

  it("includes audio direction inline in ambiance clause when set", () => {
    const withAudio = buildOmniShotPrompt({
      shot: mkShot({ audioDirection: "soft footsteps + wind" }),
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
    });
    // Audio integrated into ambiance, no "Audio:" label
    expect(withAudio.promptText).toContain("underscored by soft footsteps + wind");
    expect(withAudio.promptText).not.toContain("Audio:");

    const noAudio = buildOmniShotPrompt({
      shot: mkShot(),
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
    });
    expect(noAudio.promptText).not.toContain("underscored by");
    expect(noAudio.promptText).not.toContain("Audio:");
  });

  it("r7.22-fix1 regression: extracts FilmImageRef.dataUrl correctly (not the whole object)", () => {
    const objectFormat = buildOmniShotPrompt({
      shot: mkShot(),
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true, conceptFormat: "object" })],
      setting: mkSetting(),
    });
    expect(typeof objectFormat.references[0].dataUrl).toBe("string");
    expect(objectFormat.references[0].dataUrl).toMatch(/^data:image\/png;base64,/);

    const stringFormat = buildOmniShotPrompt({
      shot: mkShot(),
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true, conceptFormat: "string" })],
      setting: mkSetting(),
    });
    expect(typeof stringFormat.references[0].dataUrl).toBe("string");
    expect(stringFormat.references[0].dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("omits identity anchor when no character has concept sheet", () => {
    const result = buildOmniShotPrompt({
      shot: mkShot({ actionEn: "wind blows leaves" }),
      cast: [mkChar("Bare", { isProtagonist: true, withConcept: false })],
      setting: mkSetting(),
    });
    expect(result.references.length).toBe(0);
    expect(result.promptText).not.toContain("<image_0>");
    expect(result.promptText).not.toContain("preserve face");
    // Still constructs valid prose with character name
    expect(result.promptText).toContain("Bare");
  });

  it("falls back to neutral 'the scene' when no characters in shot at all", () => {
    const result = buildOmniShotPrompt({
      shot: mkShot({ actionEn: "wind blows leaves" }),
      scene: mkScene({ actionLinesEn: "wind blows leaves" }),
      cast: [],
      setting: mkSetting(),
    });
    expect(result.references.length).toBe(0);
    // Falls back to "the scene" subject
    expect(result.promptText).toContain("the scene");
  });

  it("integrates lighting into location clause when set", () => {
    const result = buildOmniShotPrompt({
      shot: mkShot({ actionEn: "Maya walks" }),
      scene: mkScene({ settings: "forest clearing", lightingHintEn: "dappled golden hour" }),
      cast: [mkChar("Maya", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
    });
    expect(result.promptText).toContain("in forest clearing");
    expect(result.promptText).toContain("lit by dappled golden hour");
  });

  it("formatReferenceManifest returns helpful upload instruction text", () => {
    const refs = [
      { slot: 0, filename: "image_0_hero.png", description: "Hero concept" },
      { slot: 1, filename: "image_1_villain.png", description: "Villain concept" },
    ];
    const formatted = formatReferenceManifest(refs);
    expect(formatted).toContain("<image_0>");
    expect(formatted).toContain("<image_1>");
    expect(formatted).toContain("Hero concept");
    expect(formatted).toContain("Villain concept");
  });

  it("empty references manifest message", () => {
    expect(formatReferenceManifest([])).toContain("No reference");
  });
});

// ============================================================================
// omniMultiShotPromptBuilder — Prose mode with storyboard-driven pattern
// ============================================================================

describe("r7.26 — omniMultiShotPromptBuilder (prose mode)", () => {
  it("r7.26 + r7.34 — uses storyboard-driven 'Show this story' pattern + per-cell cut list timestamps", () => {
    // r7.39: keep total ≤10s so this test verifies single-chunk structure
    // (chunking behavior tested separately in r7.39 suite below).
    const shots = [
      mkShot({ id: "s1", order: 1, durationSeconds: 3, actionEn: "Maya wakes up" }),
      mkShot({ id: "s2", order: 2, durationSeconds: 2, actionEn: "Maya looks out window" }),
      mkShot({ id: "s3", order: 3, durationSeconds: 4, actionEn: "Maya leaves room" }),
    ];
    const result = buildOmniMultiShotPrompt({
      scene: mkScene({ actionLinesEn: "Maya wakes up, looks out, leaves" }),
      shots,
      cast: [mkChar("Maya", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    expect(result.totalDurationSeconds).toBe(9);
    expect(result.chunkCount).toBe(1); // single-chunk path
    // Storyboard-driven pattern (per DeepMind official guide Tab 3)
    expect(result.promptText).toContain("Show this story in <image_1>");
    expect(result.promptText).toContain("follow the visual progression exactly in order");
    expect(result.promptText).toContain("starting top-left");
    // Total duration in closing
    expect(result.promptText).toContain("9 seconds");
    // r7.34: per-cell cut list with explicit timestamps (Tip #4 community github 293★)
    expect(result.promptText).toContain("Cell-by-cell cut list:");
    expect(result.promptText).toMatch(/1\)\s+0-3s:/);
    expect(result.promptText).toMatch(/2\)\s+3-5s:/);
    expect(result.promptText).toMatch(/3\)\s+5-9s:/);
    // No "Generate N connected shots" instruction (r7.26 removal preserved)
    expect(result.promptText).not.toContain("Generate ");
  });

  it("anchors character identity with <image_N> placeholders + preserve statement", () => {
    const result = buildOmniMultiShotPrompt({
      scene: mkScene(),
      shots: [mkShot({ actionEn: "Maya runs" })],
      cast: [mkChar("Maya", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    expect(result.promptText).toContain("Maya as shown in <image_0>");
    expect(result.promptText).toContain("preserve face, hair, and wardrobe EXACTLY across all shots");
  });

  it("uses plural 'faces/wardrobes' when 2+ characters in scene", () => {
    const result = buildOmniMultiShotPrompt({
      scene: mkScene({ actionLinesEn: "Maya and Bob argue" }),
      shots: [mkShot({ actionEn: "Maya yells at Bob" })],
      cast: [
        mkChar("Maya", { isProtagonist: true, withConcept: true }),
        mkChar("Bob", { withConcept: true }),
      ],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    expect(result.promptText).toContain("Maya and Bob as shown in");
    expect(result.promptText).toContain("preserve faces, hair, and wardrobes EXACTLY");
  });

  it("includes storyboard reference at correct slot when hasStoryboardImage is true", () => {
    const result = buildOmniMultiShotPrompt({
      scene: mkScene(),
      shots: [mkShot({ actionEn: "Maya walks" })],
      cast: [mkChar("Maya", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    // Storyboard slot is slot 1 (after Maya at slot 0)
    expect(result.promptText).toContain("<image_1>");
    expect(result.promptText).toContain("starting top-left");
    const storyboardRef = result.references.find((r) => r.filename.includes("storyboard"));
    expect(storyboardRef).toBeDefined();
    expect(storyboardRef!.slot).toBe(1);
  });

  it("falls back to per-shot timeline when storyboard image is NOT available", () => {
    const result = buildOmniMultiShotPrompt({
      scene: mkScene(),
      shots: [
        mkShot({ id: "s1", durationSeconds: 4, actionEn: "wakes" }),
        mkShot({ id: "s2", durationSeconds: 3, actionEn: "moves" }),
      ],
      cast: [mkChar("Maya", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
      hasStoryboardImage: false,
    });
    // No storyboard reference
    expect(result.promptText).not.toContain("Show this story");
    expect(result.references.find((r) => r.filename.includes("storyboard"))).toBeUndefined();
    // Fallback: includes per-shot timeline with cumulative seconds
    expect(result.promptText).toContain("shot 1 (0-4s");
    expect(result.promptText).toContain("shot 2 (4-7s");
    expect(result.promptText).toContain("wakes");
    expect(result.promptText).toContain("moves");
  });

  it("embeds audio cues per shot in unified 'Audio cues' line when set", () => {
    const result = buildOmniMultiShotPrompt({
      scene: mkScene(),
      shots: [
        mkShot({ id: "s1", actionEn: "wakes", audioDirection: "bird chirps" }),
        mkShot({ id: "s2", actionEn: "moves", audioDirection: "soft footsteps" }),
        mkShot({ id: "s3", actionEn: "stops" }),
      ],
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    expect(result.promptText).toContain("Audio cues");
    expect(result.promptText).toContain("shot 1: bird chirps");
    expect(result.promptText).toContain("shot 2: soft footsteps");
    // Shot 3 (no audio) does NOT appear in audio cues
    expect(result.promptText).not.toMatch(/shot 3:\s*\w/);
  });

  it("r7.22-fix1 regression: extracts FilmImageRef.dataUrl in multi-shot too", () => {
    const result = buildOmniMultiShotPrompt({
      scene: mkScene({ actionLinesEn: "A and B together" }),
      shots: [mkShot({ actionEn: "A and B together" })],
      cast: [
        mkChar("A", { isProtagonist: true, withConcept: true, conceptFormat: "object" }),
        mkChar("B", { withConcept: true, conceptFormat: "object" }),
      ],
      setting: mkSetting(),
    });
    result.references.forEach((ref) => {
      expect(typeof ref.dataUrl).toBe("string");
      expect(ref.dataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });

  it("applies style ambiance in closing sentence", () => {
    const result = buildOmniMultiShotPrompt({
      scene: mkScene(),
      shots: [mkShot({ durationSeconds: 5 })],
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true })],
      setting: mkSetting({ animationStyle: "ghibli", aspectRatio: "9:16" }),
      hasStoryboardImage: true,
    });
    // Style adj applied as closing suffix (legacy "ghibli" → "Studio Ghibli anime")
    // Matches DeepMind official pattern: "Entire story in N seconds. <Style>."
    expect(result.promptText).toContain("Studio Ghibli anime.");
    expect(result.promptText).toContain("5 seconds");
    // No "Negative:" block — guide DeepMind doesn't use negative
    expect(result.promptText).not.toContain("Negative:");
    // No "Global style:" label
    expect(result.promptText).not.toContain("Global style:");
  });

  it("formatMultiShotReferenceManifest empty message", () => {
    expect(formatMultiShotReferenceManifest([])).toContain("No reference");
  });

  it("identifies characters by name appearing in scene/shot action text", () => {
    const result = buildOmniMultiShotPrompt({
      scene: mkScene({ actionLinesEn: "Maya looks at the sky" }),
      shots: [mkShot({ actionEn: "Maya smiles" })],
      cast: [
        mkChar("Maya", { isProtagonist: true, withConcept: true }),
        mkChar("Bob", { withConcept: true }),
      ],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    expect(result.promptText).toContain("Maya");
    expect(result.references.find((r) => r.filename.includes("maya"))).toBeDefined();
    expect(result.references.find((r) => r.filename.includes("bob"))).toBeUndefined();
  });
});

// ============================================================================
// r7.39 — Omni chunk planner (≤10s cap from Gemini Omni Flash)
// ============================================================================

describe("r7.39 — omniChunkPlanner", () => {
  it("planOmniChunks: scene ≤10s returns single chunk", async () => {
    const { planOmniChunks } = await import("../src/engine/omniChunkPlanner");
    const shots = [mkShot({ durationSeconds: 4 }), mkShot({ durationSeconds: 6 })];
    const chunks = planOmniChunks(shots);
    expect(chunks.length).toBe(1);
    expect(chunks[0].durationSeconds).toBe(10);
    expect(chunks[0].shots.length).toBe(2);
    expect(chunks[0].globalStartShotNumber).toBe(1);
  });

  it("planOmniChunks: scene >10s splits greedy along shot boundaries (no shot cut mid-way)", async () => {
    const { planOmniChunks } = await import("../src/engine/omniChunkPlanner");
    // Durations [4, 6, 8, 10, 8, 6, 4, 10] = 56s total → expect 6 chunks
    const shots = [4, 6, 8, 10, 8, 6, 4, 10].map((d, i) =>
      mkShot({ id: `s${i + 1}`, order: i + 1, durationSeconds: d })
    );
    const chunks = planOmniChunks(shots);
    expect(chunks.length).toBe(6);
    // No chunk exceeds 10s (except solo edge case which equals 10)
    chunks.forEach((c) => expect(c.durationSeconds).toBeLessThanOrEqual(10));
    // Total preserved
    const totalRecovered = chunks.reduce((acc, c) => acc + c.durationSeconds, 0);
    expect(totalRecovered).toBe(56);
    // Greedy packing: [4+6]=10, [8], [10], [8], [6+4]=10, [10]
    expect(chunks[0].shots.length).toBe(2);
    expect(chunks[0].durationSeconds).toBe(10);
    expect(chunks[4].shots.length).toBe(2);
    expect(chunks[4].durationSeconds).toBe(10);
  });

  it("planOmniChunks: every chunk knows its index, total, and global shot offset", async () => {
    const { planOmniChunks } = await import("../src/engine/omniChunkPlanner");
    const shots = [4, 6, 8].map((d, i) =>
      mkShot({ id: `s${i + 1}`, order: i + 1, durationSeconds: d })
    );
    const chunks = planOmniChunks(shots);
    expect(chunks.length).toBe(2); // [4+6]=10, [8]
    expect(chunks[0].index).toBe(1);
    expect(chunks[0].total).toBe(2);
    expect(chunks[0].globalStartShotNumber).toBe(1);
    expect(chunks[1].index).toBe(2);
    expect(chunks[1].total).toBe(2);
    expect(chunks[1].globalStartShotNumber).toBe(3); // shot 3 starts chunk 2
  });

  it("planOmniChunks: empty shot list returns empty array", async () => {
    const { planOmniChunks } = await import("../src/engine/omniChunkPlanner");
    expect(planOmniChunks([])).toEqual([]);
  });

  it("planOmniChunks: shot already ≥10s gets its own chunk (no truncation)", async () => {
    const { planOmniChunks } = await import("../src/engine/omniChunkPlanner");
    const shots = [
      mkShot({ id: "s1", durationSeconds: 4 }),
      mkShot({ id: "s2", durationSeconds: 12 }), // > cap
      mkShot({ id: "s3", durationSeconds: 6 }),
    ];
    const chunks = planOmniChunks(shots);
    expect(chunks.length).toBe(3);
    expect(chunks[0].shots.length).toBe(1);
    expect(chunks[0].durationSeconds).toBe(4);
    expect(chunks[1].shots.length).toBe(1);
    expect(chunks[1].durationSeconds).toBe(12); // preserved, planner does NOT clamp
    expect(chunks[2].shots.length).toBe(1);
    expect(chunks[2].durationSeconds).toBe(6);
  });

  it("buildChunkSeparator: format `=== CHUNK X of N (Ys) ===`", async () => {
    const { buildChunkSeparator } = await import("../src/engine/omniChunkPlanner");
    const sep = buildChunkSeparator({
      index: 2,
      total: 6,
      shots: [],
      globalStartShotNumber: 3,
      durationSeconds: 8,
    });
    expect(sep).toBe("=== CHUNK 2 of 6 (8s) ===");
  });

  it("OMNI_MAX_CHUNK_SECONDS = 10 (Gemini Omni Flash hard cap)", async () => {
    const { OMNI_MAX_CHUNK_SECONDS } = await import("../src/engine/omniChunkPlanner");
    expect(OMNI_MAX_CHUNK_SECONDS).toBe(10);
  });
});

// ============================================================================
// r7.39 — KSP Hybrid builder integration with chunking
// ============================================================================

describe("r7.39 — buildOmniMultiShotPrompt chunking integration", () => {
  it("scene ≤10s: chunkCount=1, no separator in output (backward compat)", () => {
    const result = buildOmniMultiShotPrompt({
      scene: mkScene({ settings: "Forest" }),
      shots: [mkShot({ durationSeconds: 4, actionEn: "walks" })],
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    expect(result.chunkCount).toBe(1);
    expect(result.promptText).not.toContain("=== CHUNK");
    expect(result.promptText).toContain("Entire story in 4 seconds.");
  });

  it("scene >10s: chunkCount>1, separators between chunks, per-chunk closing duration", () => {
    // Durations [4, 6, 8] = 18s → 2 chunks: [4+6]=10s, [8]=8s
    const result = buildOmniMultiShotPrompt({
      scene: mkScene({ settings: "Forest" }),
      shots: [
        mkShot({ id: "s1", order: 1, durationSeconds: 4, actionEn: "walks in" }),
        mkShot({ id: "s2", order: 2, durationSeconds: 6, actionEn: "looks up" }),
        mkShot({ id: "s3", order: 3, durationSeconds: 8, actionEn: "sits down" }),
      ],
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    expect(result.chunkCount).toBe(2);
    expect(result.totalDurationSeconds).toBe(18);
    // Both separators present
    expect(result.promptText).toContain("=== CHUNK 1 of 2 (10s) ===");
    expect(result.promptText).toContain("=== CHUNK 2 of 2 (8s) ===");
    // Per-chunk closing line shows CHUNK duration, NOT scene total
    expect(result.promptText).toContain("Entire story in 10 seconds.");
    expect(result.promptText).toContain("Entire story in 8 seconds.");
    expect(result.promptText).not.toContain("Entire story in 18 seconds.");
  });

  it("chunked output: identity anchor REPEATS per chunk (Omni resets context)", () => {
    const result = buildOmniMultiShotPrompt({
      scene: mkScene({}),
      shots: [
        mkShot({ id: "s1", order: 1, durationSeconds: 8, actionEn: "act 1" }),
        mkShot({ id: "s2", order: 2, durationSeconds: 8, actionEn: "act 2" }),
      ],
      cast: [mkChar("Maya", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    expect(result.chunkCount).toBe(2);
    // Identity anchor "Maya as shown in <image_0>" must appear ONCE PER CHUNK (= 2 times)
    const anchorMatches = result.promptText.match(/Maya as shown in <image_0>/g) ?? [];
    expect(anchorMatches.length).toBe(2);
  });

  it("chunked output: shot numbering stays GLOBAL across chunks (no reset)", () => {
    // Durations [4, 6, 8] → [shots 1+2 in chunk 1] [shot 3 in chunk 2]
    const result = buildOmniMultiShotPrompt({
      scene: mkScene({}),
      shots: [
        mkShot({ id: "s1", order: 1, durationSeconds: 4, actionEn: "act 1" }),
        mkShot({ id: "s2", order: 2, durationSeconds: 6, actionEn: "act 2" }),
        mkShot({ id: "s3", order: 3, durationSeconds: 8, actionEn: "act 3" }),
      ],
      cast: [mkChar("Maya", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    // Chunk 2 contains shot 3 — its cell number must be "3)" not "1)"
    expect(result.promptText).toContain("3)"); // global numbering preserved
    expect(result.promptText).toMatch(/3\) 0-8s/); // timestamp resets to 0 per chunk
  });

  it("chunked output: per-chunk timestamps reset to 0 (each chunk = separate Omni clip)", () => {
    const result = buildOmniMultiShotPrompt({
      scene: mkScene({}),
      shots: [
        mkShot({ id: "s1", order: 1, durationSeconds: 8, actionEn: "act 1" }),
        mkShot({ id: "s2", order: 2, durationSeconds: 8, actionEn: "act 2" }),
      ],
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    expect(result.chunkCount).toBe(2);
    // Shot 1 timestamp: 0-8s. Shot 2 timestamp: 0-8s (NOT 8-16s — chunk-local).
    const matches = result.promptText.match(/0-8s/g) ?? [];
    expect(matches.length).toBe(2);
    // No cumulative timestamp like 8-16s
    expect(result.promptText).not.toMatch(/\b8-16s\b/);
  });

  it("audio cues only mention shots within their own chunk", () => {
    const result = buildOmniMultiShotPrompt({
      scene: mkScene({}),
      shots: [
        mkShot({ id: "s1", order: 1, durationSeconds: 4, actionEn: "act 1", audioDirection: "door creaks" }),
        mkShot({ id: "s2", order: 2, durationSeconds: 6, actionEn: "act 2" }),
        mkShot({ id: "s3", order: 3, durationSeconds: 8, actionEn: "act 3", audioDirection: "thunder" }),
      ],
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    // Chunk 1 audio block should mention shot 1 (in chunk 1) but NOT shot 3 (in chunk 2)
    const chunk1End = result.promptText.indexOf("=== CHUNK 2");
    const chunk1Block = result.promptText.slice(0, chunk1End);
    const chunk2Block = result.promptText.slice(chunk1End);
    expect(chunk1Block).toContain("shot 1: door creaks");
    expect(chunk1Block).not.toContain("thunder");
    expect(chunk2Block).toContain("shot 3: thunder");
    expect(chunk2Block).not.toContain("door creaks");
  });
});

// ============================================================================
// r7.39 — DeepMind Strict builder integration with chunking
// ============================================================================

describe("r7.39 — buildOmniDeepMindPurePrompt chunking integration", () => {
  it("scene ≤10s: chunkCount=1, no separator (backward compat)", async () => {
    const { buildOmniDeepMindPurePrompt } = await import("../src/engine/omniDeepMindPurePromptBuilder");
    const result = buildOmniDeepMindPurePrompt({
      scene: mkScene({}),
      shots: [mkShot({ durationSeconds: 6 })],
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    expect(result.chunkCount).toBe(1);
    expect(result.promptText).not.toContain("=== CHUNK");
    expect(result.promptText).toContain("Entire story in 6 seconds.");
  });

  it("scene >10s: chunkCount>1, separators with per-chunk durations, 18-word pattern per chunk", async () => {
    const { buildOmniDeepMindPurePrompt } = await import("../src/engine/omniDeepMindPurePromptBuilder");
    // Durations [4, 6, 8] = 18s → 2 chunks
    const result = buildOmniDeepMindPurePrompt({
      scene: mkScene({}),
      shots: [
        mkShot({ id: "s1", durationSeconds: 4 }),
        mkShot({ id: "s2", durationSeconds: 6 }),
        mkShot({ id: "s3", durationSeconds: 8 }),
      ],
      cast: [mkChar("Hero", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    expect(result.chunkCount).toBe(2);
    expect(result.promptText).toContain("=== CHUNK 1 of 2 (10s) ===");
    expect(result.promptText).toContain("=== CHUNK 2 of 2 (8s) ===");
    // Per-chunk closing duration (not scene total of 18s)
    expect(result.promptText).toContain("Entire story in 10 seconds.");
    expect(result.promptText).toContain("Entire story in 8 seconds.");
    expect(result.promptText).not.toContain("Entire story in 18 seconds.");
    // DeepMind 18-word pattern repeated per chunk (count "Show me in this story")
    const patternMatches = result.promptText.match(/Show me in this story/g) ?? [];
    expect(patternMatches.length).toBe(2);
  });
});
