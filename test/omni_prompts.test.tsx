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
    const shots = [
      mkShot({ id: "s1", order: 1, durationSeconds: 4, actionEn: "Maya wakes up" }),
      mkShot({ id: "s2", order: 2, durationSeconds: 3, actionEn: "Maya looks out window" }),
      mkShot({ id: "s3", order: 3, durationSeconds: 5, actionEn: "Maya leaves room" }),
    ];
    const result = buildOmniMultiShotPrompt({
      scene: mkScene({ actionLinesEn: "Maya wakes up, looks out, leaves" }),
      shots,
      cast: [mkChar("Maya", { isProtagonist: true, withConcept: true })],
      setting: mkSetting(),
      hasStoryboardImage: true,
    });
    expect(result.totalDurationSeconds).toBe(12);
    // Storyboard-driven pattern (per DeepMind official guide Tab 3)
    expect(result.promptText).toContain("Show this story in <image_1>");
    expect(result.promptText).toContain("follow the visual progression exactly in order");
    expect(result.promptText).toContain("starting top-left");
    // Total duration in closing
    expect(result.promptText).toContain("12 seconds");
    // r7.34: per-cell cut list with explicit timestamps (Tip #4 community github 293★)
    expect(result.promptText).toContain("Cell-by-cell cut list:");
    expect(result.promptText).toMatch(/1\)\s+0-4s:/);
    expect(result.promptText).toMatch(/2\)\s+4-7s:/);
    expect(result.promptText).toMatch(/3\)\s+7-12s:/);
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
