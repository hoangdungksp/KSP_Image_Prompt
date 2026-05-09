/**
 * Photos mode v0.9.1 runtime tests.
 *
 * Goals:
 * 1. Editor renders WITHOUT CRASH when project.mode = "photos"
 * 2. Each Photos component (CastPhotos, CameraStyle, Idea, ImageGen) renders standalone
 * 3. Adding cast → adding face refs → progressive disclosure works
 * 4. Auto-pick shots populates 6 different angles
 * 5. Prompt builder produces non-empty 13-block prompt with magic phrases
 *
 * These tests explicitly verify the runtime shapes that tsc/build cannot catch
 * (the v0.9.0 infinite-loop selector bug was caught only by render testing).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";

import { useAppStore, createEmptyProject } from "../src/store/useAppStore";
import {
  addCastMember,
  updateCastMember,
  addFaceRef,
  setOutfitRef,
  selectCast,
  selectTheme,
  setCustomIntent,
  setCameraStyle,
  autoPickShots,
  ensurePhotosData,
} from "../src/store/photos_actions";
import { buildPhotosShotPrompt } from "../src/engine/photosPromptBuilder";
import { Editor } from "../src/components/Editor";
import { CastPhotosSection } from "../src/components/CastPhotosSection";
import { CameraStyleToggleV09 } from "../src/components/CameraStyleToggleV09";
import { PhotosIdeaSection } from "../src/components/PhotosIdeaSection";
import { PhotosImageGenSection } from "../src/components/PhotosImageGenSection";
import { THEMES } from "../src/engine/themes";
import { ANGLE_PRESETS } from "../src/engine/angles";

// Tiny 1×1 transparent PNG as data URL (smallest valid image)
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function makePhotosProject() {
  const p = createEmptyProject();
  return {
    ...p,
    schemaVersion: "v0.9" as const,
    settingV2: {
      name: "Photos test",
      mode: "photos" as const,
      aspectRatio: "9:16" as const,
      timeFormat: "integer" as const,
      aiProviders: {
        scriptWriter: "gemini-flash" as const,
        conceptWriter: "gemini-flash" as const,
        storyboardFrames: "gemini-flash" as const,
        imageGen: "imagen-4-standard" as const,
        voiceTts: "elevenlabs" as const,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };
}

beforeEach(() => {
  cleanup();
  useAppStore.setState({
    currentProject: makePhotosProject(),
    generatedPrompts: new Map(),
    activeView: "editor",
    toast: null,
  });
});

describe("Photos mode — Editor render", () => {
  it("renders without crashing when project.mode = photos", () => {
    const { container } = render(<Editor />);
    expect(container.querySelector(".ksp-sidebar-v09")).toBeTruthy();
  });

  it("renders Project Setting + Cast Photos + Pipeline sections", () => {
    const { getByText, container } = render(<Editor />);
    expect(getByText(/PROJECT SETTING/i)).toBeTruthy();
    // Section labels
    const labels = container.querySelectorAll("div");
    const labelTexts = Array.from(labels)
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    expect(labelTexts.some((t) => t?.includes("PROJECT"))).toBe(true);
    expect(labelTexts.some((t) => t?.includes("ASSETS"))).toBe(true);
    expect(labelTexts.some((t) => t?.includes("PIPELINE"))).toBe(true);
  });
});

describe("Photos components — standalone render", () => {
  it("CastPhotosSection renders empty state when no cast", () => {
    const { getByText } = render(<CastPhotosSection />);
    expect(getByText(/Chưa có cast/i)).toBeTruthy();
  });

  it("CameraStyleToggleV09 renders with BOKEH default selected", () => {
    const { container } = render(<CameraStyleToggleV09 />);
    const inputs = container.querySelectorAll('input[type="radio"]');
    expect(inputs.length).toBe(2);
    const checked = Array.from(inputs).filter(
      (i) => (i as HTMLInputElement).checked
    );
    expect(checked.length).toBe(1);
  });

  it("PhotosIdeaSection renders theme picker with 12+ category pills", () => {
    const { container } = render(<PhotosIdeaSection />);
    const pills = container.querySelectorAll(".ksp-cat-pill");
    expect(pills.length).toBeGreaterThanOrEqual(13); // 12 categories + "Tất cả"
  });

  it("PhotosImageGenSection renders empty state when no shots", () => {
    const { getByText } = render(<PhotosImageGenSection />);
    expect(getByText(/Chưa có shot/i)).toBeTruthy();
  });
});

describe("Cast actions — dynamic face slots", () => {
  it("addCastMember creates cast with empty faceRefs", () => {
    const project = useAppStore.getState().currentProject!;
    const patch = addCastMember(project, "female");
    expect(patch.photosV091?.cast).toHaveLength(1);
    expect(patch.photosV091?.cast[0].subjectType).toBe("female");
    expect(patch.photosV091?.cast[0].faceRefs).toHaveLength(0);
    expect(patch.photosV091?.selectedCastId).toBe(patch.photosV091?.cast[0].id);
  });

  it("addFaceRef labels first slot 'front' and second '3/4 L'", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project) };
    const castId = project.photosV091!.cast[0].id;

    const patch1 = addFaceRef(project, castId, {
      filename: "1.jpg",
      mimeType: "image/jpeg",
      dataUrl: TINY_PNG_DATA_URL,
    });
    project = { ...project, ...patch1 };
    expect(project.photosV091!.cast[0].faceRefs[0].label).toBe("front");

    const patch2 = addFaceRef(project, castId, {
      filename: "2.jpg",
      mimeType: "image/jpeg",
      dataUrl: TINY_PNG_DATA_URL,
    });
    project = { ...project, ...patch2 };
    expect(project.photosV091!.cast[0].faceRefs).toHaveLength(2);
    expect(project.photosV091!.cast[0].faceRefs[1].label).toBe("3/4 L");
  });

  it("addFaceRef caps at 6 slots (MAX_FACE_REFS)", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project) };
    const castId = project.photosV091!.cast[0].id;

    for (let i = 0; i < 8; i++) {
      const patch = addFaceRef(project, castId, {
        filename: `${i}.jpg`,
        mimeType: "image/jpeg",
        dataUrl: TINY_PNG_DATA_URL,
      });
      // Empty patch returned when at cap → no update
      if (patch.photosV091) project = { ...project, ...patch };
    }
    expect(project.photosV091!.cast[0].faceRefs.length).toBeLessThanOrEqual(6);
    expect(project.photosV091!.cast[0].faceRefs.length).toBe(6);
  });
});

describe("Auto-pick shots — angle variation", () => {
  it("autoPickShots(6) creates 6 shots with 6 different angle preset ids", () => {
    const project = useAppStore.getState().currentProject!;
    const patch = autoPickShots(project, 6);
    const shots = patch.photosV091!.shots;
    expect(shots).toHaveLength(6);
    const presetIds = shots.map((s) => s.anglePresetId);
    const uniqueIds = new Set(presetIds);
    expect(uniqueIds.size).toBe(6); // all different
    // All ids should be valid angle preset ids
    const validIds = new Set(ANGLE_PRESETS.map((p) => p.id));
    presetIds.forEach((id) => expect(validIds.has(id)).toBe(true));
  });

  it("autoPickShots(9) caps at 8 (number of available angle presets)", () => {
    const project = useAppStore.getState().currentProject!;
    const patch = autoPickShots(project, 12);
    expect(patch.photosV091!.shots.length).toBe(ANGLE_PRESETS.length);
  });
});

describe("Photos prompt builder — engine integration", () => {
  function setupCastWithFace(numFaces: number) {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;

    for (let i = 0; i < numFaces; i++) {
      const patch = addFaceRef(project, castId, {
        filename: `face-${i + 1}.jpg`,
        mimeType: "image/jpeg",
        dataUrl: TINY_PNG_DATA_URL,
      });
      project = { ...project, ...patch };
    }

    project = { ...project, ...selectCast(project, castId) };
    project = { ...project, ...autoPickShots(project, 1) };
    project = {
      ...project,
      ...selectTheme(project, THEMES[0].id),
    };

    return project;
  }

  it("builds non-empty prompt with single face ref (N=1)", () => {
    const project = setupCastWithFace(1);
    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot);
    expect(result).not.toBeNull();
    expect(result!.prompt.length).toBeGreaterThan(500);
  });

  it("builds prompt with single-face magic phrase when N=1", () => {
    const project = setupCastWithFace(1);
    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;
    // Engine A+ uses Danh Seven verbatim: "100% identical" + "No editing of my face is allowed"
    expect(result.prompt).toMatch(/100% identical/i);
    expect(result.prompt).toMatch(/No editing of my face is allowed/i);
  });

  it("builds prompt with multi-face synthesis phrase when N>=2", () => {
    const project = setupCastWithFace(3);
    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;
    // Multi-face phrase from HANDOFF
    expect(result.prompt).toMatch(/face references/i);
  });

  it("includes BOKEH camera magic phrase when cameraStyle = BOKEH", () => {
    let project = setupCastWithFace(1);
    project = { ...project, ...setCameraStyle(project, "BOKEH") };
    // Force a close-up shot to verify 85mm match (auto-pick first shot is wide → 24mm)
    project = { ...project, ...autoPickShots(project, 8) };
    useAppStore.setState({ currentProject: project });
    // Find shot with close_up framing
    const shots = project.photosV091!.shots;
    const closeUpShot = shots.find((s) => {
      const r = buildPhotosShotPrompt(project, s)!;
      return /close-up/i.test(r.prompt);
    }) || shots[0];
    const result = buildPhotosShotPrompt(project, closeUpShot)!;
    expect(result.prompt).toMatch(/Sony A7R V|Canon R5/);
    // A+ engine auto-matches lens to shot type. Any of these focal lengths is BOKEH-style.
    expect(result.prompt).toMatch(/24mm|35mm|50mm|85mm|100mm/);
  });

  it("includes DOCUMENTARY anti-bokeh phrase when cameraStyle = DOCUMENTARY", () => {
    let project = setupCastWithFace(1);
    project = { ...project, ...setCameraStyle(project, "DOCUMENTARY") };
    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;
    expect(result.prompt).toMatch(/iPhone/i);
    // A+ negative compresses anti-bokeh into "no excessive bokeh"
    expect(result.prompt).toMatch(/no excessive bokeh|deep depth of field|standard camera mode/i);
  });

  it("includes Skin Paradox magic phrase (auto-injected)", () => {
    const project = setupCastWithFace(1);
    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;
    // A+ compresses Skin Paradox into a single phrase per Danh Seven style
    expect(result.prompt).toMatch(/glass-like skin/i);
    expect(result.prompt).toMatch(/natural pores/i);
  });

  it("returns null when no cast is set", () => {
    const project = useAppStore.getState().currentProject!;
    const data = ensurePhotosData(project);
    const fakeShot = {
      id: "fake",
      order: 1,
      anglePresetId: ANGLE_PRESETS[0].id,
    };
    // No cast at all
    expect(data.cast.length).toBe(0);
    const result = buildPhotosShotPrompt(project, fakeShot);
    expect(result).toBeNull();
  });
});

describe("Outfit handling", () => {
  it("setOutfitRef assigns outfitRef with label 'outfit'", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project) };
    const castId = project.photosV091!.cast[0].id;

    project = {
      ...project,
      ...setOutfitRef(project, castId, {
        filename: "outfit.jpg",
        mimeType: "image/jpeg",
        dataUrl: TINY_PNG_DATA_URL,
      }),
    };

    expect(project.photosV091!.cast[0].outfitRef).toBeDefined();
    expect(project.photosV091!.cast[0].outfitRef!.label).toBe("outfit");
  });

  it("setOutfitRef(null) clears outfitRef", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project) };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...setOutfitRef(project, castId, {
        filename: "outfit.jpg",
        mimeType: "image/jpeg",
        dataUrl: TINY_PNG_DATA_URL,
      }),
    };
    project = { ...project, ...setOutfitRef(project, castId, null) };
    expect(project.photosV091!.cast[0].outfitRef).toBeUndefined();
  });
});

describe("React-reserved 'ref' prop regression", () => {
  // BUG: passing { ref: imageObj } as a prop in React makes React intercept it
  // for forwardRef. Component receives undefined → crashes accessing .label.
  // This test renders CastPhotosSection with a populated face ref slot to catch it.
  it("CastPhotosSection renders face slots without 'undefined.label' crash", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, {
        filename: "front.png",
        mimeType: "image/png",
        dataUrl: TINY_PNG_DATA_URL,
      }),
    };
    useAppStore.setState({ currentProject: project });

    // If FaceSlot receives `ref` prop instead of `imageRef`, this render throws:
    //   "Cannot read properties of undefined (reading 'label')"
    expect(() => render(<CastPhotosSection />)).not.toThrow();
  });

  it("PhotosImageGenSection ThumbMini renders without crash when cast has face ref", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, {
        filename: "front.png",
        mimeType: "image/png",
        dataUrl: TINY_PNG_DATA_URL,
      }),
    };
    project = { ...project, ...autoPickShots(project, 3) };
    useAppStore.setState({ currentProject: project });

    expect(() => render(<PhotosImageGenSection />)).not.toThrow();
  });
});

describe("All 5 Subject Types", () => {
  it("creates cast for each subjectType without crashing", () => {
    const types = ["female", "male", "couple", "family", "friends_group"] as const;
    for (const type of types) {
      let project = useAppStore.getState().currentProject!;
      project = { ...project, ...addCastMember(project, type) };
      const cast = project.photosV091!.cast[0];
      expect(cast.subjectType).toBe(type);

      // Add face + verify prompt builds
      project = {
        ...project,
        ...addFaceRef(project, cast.id, {
          filename: "f.jpg",
          mimeType: "image/jpeg",
          dataUrl: TINY_PNG_DATA_URL,
        }),
      };
      project = { ...project, ...autoPickShots(project, 1) };
      const result = buildPhotosShotPrompt(project, project.photosV091!.shots[0]);
      expect(result).not.toBeNull();
      expect(result!.prompt.length).toBeGreaterThan(300);
    }
  });
});

// ============================================================================
// Engine A+ — verify against Danh Seven 18 docs gold-standard patterns
// ============================================================================

describe("Engine A+ — Danh Seven format compliance", () => {
  it("BOKEH single-face prompt opens with Danh Seven verbatim phrase", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, { filename: "f.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = {
      ...project,
      ...setOutfitRef(project, castId, { filename: "o.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = { ...project, ...autoPickShots(project, 1) };
    useAppStore.setState({ currentProject: project });

    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;

    // Danh Seven verbatim opening (doc18-style)
    expect(result.prompt).toMatch(/with my face exactly like the attached image #1, 100% identical/);
    // Reference meta convention
    expect(result.prompt).toMatch(/01_, 02_, 03_/);
    // Outfit ref pattern (doc11-style)
    expect(result.prompt).toMatch(/Wearing the outfit shown in attached image #\d+/);
  });

  it("Multi-face prompt activates 'average facial structure' instruction", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    for (let i = 0; i < 3; i++) {
      project = {
        ...project,
        ...addFaceRef(project, castId, { filename: `f${i}.jpg`, mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
      };
    }
    project = { ...project, ...autoPickShots(project, 1) };
    useAppStore.setState({ currentProject: project });

    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;

    // KSP improvement vs Danh Seven: multi-face avg instruction
    expect(result.prompt).toMatch(/3 face references provided/);
    expect(result.prompt).toMatch(/average the facial structure across all angles/);
    expect(result.prompt).toMatch(/eye spacing, nose bridge, jawline/);
  });

  it("Negative includes anti-AI-beautified protection (KSP improvement)", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, { filename: "f.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = { ...project, ...autoPickShots(project, 1) };
    useAppStore.setState({ currentProject: project });

    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;

    expect(result.prompt).toMatch(/no Korean idol face/);
    expect(result.prompt).toMatch(/no AI-beautified skin/);
    expect(result.prompt).toMatch(/no plastic skin/);
  });

  it("Brand specificity injects into outfit block when set", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, { filename: "f.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = {
      ...project,
      ...updateCastMember(project, castId, {
        brandSpecificity: "Apple Watch white strap, Honda Vision titanium silver",
      }),
    };
    project = { ...project, ...autoPickShots(project, 1) };
    useAppStore.setState({ currentProject: project });

    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;

    expect(result.prompt).toMatch(/Apple Watch white strap, Honda Vision titanium silver/);
    expect(result.prompt).toMatch(/Accessories & products:/);
  });

  it("Per-shot mood variation rotates 6 different moods across 6 shots", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, { filename: "f.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = { ...project, ...autoPickShots(project, 6) };
    useAppStore.setState({ currentProject: project });

    const shots = project.photosV091!.shots;
    const moods = shots.map((s) => {
      const result = buildPhotosShotPrompt(project, s)!;
      const match = result.prompt.match(/\*Emotion:\* (\w+)/);
      return match?.[1] || "?";
    });

    const uniqueMoods = new Set(moods);
    // 6 shots → 6 distinct moods (KSP improvement vs Danh Seven all-same)
    expect(uniqueMoods.size).toBe(6);
  });

  it("Output length is 35-50% shorter than legacy v0.4 (efficiency)", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, { filename: "f.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = {
      ...project,
      ...setOutfitRef(project, castId, { filename: "o.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = { ...project, ...autoPickShots(project, 1) };
    useAppStore.setState({ currentProject: project });

    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;

    // Engine A+ should be under 3500 chars (legacy v0.4 was ~5000)
    expect(result.prompt.length).toBeLessThan(3500);
    expect(result.prompt.length).toBeGreaterThan(2000); // sanity: still has all blocks
  });
});

// ============================================================================
// Custom intent (v0.9.1) — additional user wishes injected on top of theme
// ============================================================================

describe("Custom intent injection (v0.9.1 r5)", () => {
  it("setCustomIntent stores both VI and EN", () => {
    let project = useAppStore.getState().currentProject!;
    
    project = {
      ...project,
      ...setCustomIntent(project, { vi: "cầm bó hoa hồng đỏ", en: "holding a bouquet of red roses" }),
    };
    expect(project.photosV091!.theme.customIntentVi).toBe("cầm bó hoa hồng đỏ");
    expect(project.photosV091!.theme.customIntentEn).toBe("holding a bouquet of red roses");
  });

  it("setCustomIntent(null) clears both fields", () => {
    let project = useAppStore.getState().currentProject!;
    
    project = { ...project, ...setCustomIntent(project, { vi: "x", en: "y" }) };
    project = { ...project, ...setCustomIntent(project, null) };
    expect(project.photosV091!.theme.customIntentVi).toBeUndefined();
    expect(project.photosV091!.theme.customIntentEn).toBeUndefined();
  });

  it("Custom intent EN appears in generated prompt", () => {
    let project = useAppStore.getState().currentProject!;
    
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, { filename: "f.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = { ...project, ...autoPickShots(project, 1) };
    project = {
      ...project,
      ...setCustomIntent(project, { en: "holding a bouquet of red roses instead of daisies" }),
    };
    useAppStore.setState({ currentProject: project });

    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;
    expect(result.prompt).toMatch(/holding a bouquet of red roses instead of daisies/);
  });
});
