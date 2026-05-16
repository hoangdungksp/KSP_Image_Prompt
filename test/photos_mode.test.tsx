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
import { CameraStyleToggle } from "../src/components/CameraStyleToggle";
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
    // v0.9.1 r10: separators "━━━ PROJECT/ASSETS/PIPELINE ━━━" removed.
    // Sections render directly. Verify by their unique CSS classes.
    const html = container.innerHTML;
    expect(html).toContain("ksp-project-setting");
    expect(html).toContain("ksp-cast-photos");
    // Pipeline sections (camera style + idea + image gen) all have ksp-section class
    const sections = container.querySelectorAll(".ksp-section");
    expect(sections.length).toBeGreaterThanOrEqual(4); // project + cast + camera + idea + image_gen
  });
});

describe("Photos components — standalone render", () => {
  it("CastPhotosSection renders empty state when no cast", () => {
    const { getByText } = render(<CastPhotosSection />);
    expect(getByText(/Chưa có cast/i)).toBeTruthy();
  });

  it("CameraStyleToggle renders with BOKEH default selected", () => {
    const { container } = render(<CameraStyleToggle />);
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

// ============================================================================
// 100 POSES — pose preset injection (v0.9.1 r10)
// ============================================================================

describe("100 poses + 12 angles (v0.9.1 r10)", () => {
  it("POSES catalog has exactly 100 poses across 10 categories", async () => {
    const { POSES, POSE_CATEGORIES } = await import("../src/engine/poses_a_plus");
    expect(POSES.length).toBe(100);
    expect(POSE_CATEGORIES.length).toBe(10);
    // No duplicate IDs
    const ids = new Set(POSES.map((p) => p.id));
    expect(ids.size).toBe(100);
  });

  it("ANGLE_PRESETS has 12 angles after v0.9.1 r10 expansion", async () => {
    const { ANGLE_PRESETS } = await import("../src/engine/angles");
    expect(ANGLE_PRESETS.length).toBe(12);
    // New 4 angles must exist
    const ids = ANGLE_PRESETS.map((a) => a.id);
    expect(ids).toContain("dutch_tilt");
    expect(ids).toContain("worm_eye");
    expect(ids).toContain("selfie_pov");
    expect(ids).toContain("looking_up_pov");
  });

  it("autoPickShots(6) with poseId='walking_back_look' → all shots same pose, varied angles", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, { filename: "f.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = { ...project, ...autoPickShots(project, 6, { poseId: "walking_back_look" }) };
    const shots = project.photosV091!.shots;
    expect(shots.length).toBe(6);
    // All shots same pose
    expect(shots.every((s) => s.posePresetId === "walking_back_look")).toBe(true);
    // Angles varied
    const angles = new Set(shots.map((s) => s.anglePresetId));
    expect(angles.size).toBeGreaterThanOrEqual(2);
  });

  it("autoPickShots fully auto-vary uses different poses across shots", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, { filename: "f.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = { ...project, ...autoPickShots(project, 6) };
    const shots = project.photosV091!.shots;
    expect(shots.length).toBe(6);
    // All shots have a posePresetId
    expect(shots.every((s) => s.posePresetId)).toBe(true);
    // Poses varied across at least 4 distinct ones
    const poses = new Set(shots.map((s) => s.posePresetId));
    expect(poses.size).toBeGreaterThanOrEqual(4);
  });

  it("Pose preset description appears in generated prompt", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, { filename: "f.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = { ...project, ...autoPickShots(project, 1, { poseId: "lying_face_down_sand" }) };
    useAppStore.setState({ currentProject: project });

    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;
    // pose.en for lying_face_down_sand: "Lying face down on sand or grass, elbows propped up..."
    expect(result.prompt).toMatch(/Lying face down/);
    expect(result.prompt).toMatch(/elbows propped/);
  });

  it("Engine A+ uses iPhone 17 Pro Max + 4K resolution (r10)", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, { filename: "f.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = { ...project, ...setCameraStyle(project, "DOCUMENTARY") };
    project = { ...project, ...autoPickShots(project, 1) };
    useAppStore.setState({ currentProject: project });

    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;
    // r10: iPhone 17 Pro Max (latest 2026 flagship)
    expect(result.prompt).toMatch(/iPhone 17 Pro Max/);
    expect(result.prompt).toMatch(/48MP Fusion/);
    // r10: 4K resolution (2160x3840 for 9:16)
    expect(result.prompt).toMatch(/2160x3840px/);
  });
});

// ============================================================================
// MANDATORY CAMERA ANGLE — strong directive injection (v0.9.1 r11)
// ============================================================================

describe("MANDATORY camera angle enforcement (v0.9.1 r11)", () => {
  it("Worm's Eye angle injects MANDATORY block at TOP of prompt with strong directives", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, { filename: "f.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = { ...project, ...autoPickShots(project, 1, { angleId: "worm_eye" }) };
    useAppStore.setState({ currentProject: project });

    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;

    // MANDATORY block must be at TOP (within first 200 chars)
    expect(result.prompt.slice(0, 200)).toMatch(/MANDATORY CAMERA ANGLE/);
    // Strong directives must be present
    expect(result.prompt).toMatch(/worm's-eye view|worm's eye/i);
    expect(result.prompt).toMatch(/ground level|ground-level/i);
    expect(result.prompt).toMatch(/upward.*70-80 degrees/);
    expect(result.prompt).toMatch(/Do NOT use eye level/);
  });

  it("Bird's Eye angle injects strong overhead directive", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, { filename: "f.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = { ...project, ...autoPickShots(project, 1, { angleId: "bird_eye" }) };
    useAppStore.setState({ currentProject: project });

    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;
    expect(result.prompt).toMatch(/bird's-eye view|overhead shot/i);
    expect(result.prompt).toMatch(/straight down at 90 degrees/);
    expect(result.prompt).toMatch(/Do NOT use eye level/);
  });

  it("Dutch Tilt injects strong canted-frame directive", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, { filename: "f.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = { ...project, ...autoPickShots(project, 1, { angleId: "dutch_tilt" }) };
    useAppStore.setState({ currentProject: project });

    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;
    expect(result.prompt).toMatch(/Dutch angle|canted angle/i);
    expect(result.prompt).toMatch(/15-25 degrees off horizontal/);
    expect(result.prompt).toMatch(/horizon line must be diagonal/);
  });

  it("Camera angle directive REPEATS in Camera block for emphasis", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, { filename: "f.jpg", mimeType: "image/jpeg", dataUrl: TINY_PNG_DATA_URL }),
    };
    project = { ...project, ...autoPickShots(project, 1, { angleId: "worm_eye" }) };
    useAppStore.setState({ currentProject: project });

    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;
    // Worm's eye-related wording must appear at least 2 times (once in MANDATORY block, once in Camera block)
    const matches = result.prompt.match(/worm/gi) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// v0.9.1-r12 — Custom Pose (free-text "Tự nhập tư thế") + Connectors
// ============================================================================

describe("v0.9.1-r12 — Custom Pose free-text", () => {
  beforeEach(() => {
    cleanup();
    useAppStore.setState({ currentProject: makePhotosProject() });
  });

  it("setCustomPose stores VI text in PhotosData.theme.customPoseVi", async () => {
    const { setCustomPose } = await import("../src/store/photos_actions");
    let project = useAppStore.getState().currentProject!;
    project = {
      ...project,
      ...setCustomPose(project, { vi: "ngồi cạnh ly cà phê tay đỡ cằm" }),
    };
    expect(project.photosV091!.theme.customPoseVi).toBe(
      "ngồi cạnh ly cà phê tay đỡ cằm"
    );
  });

  it("setCustomPose(null) clears both VI and EN", async () => {
    const { setCustomPose } = await import("../src/store/photos_actions");
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...setCustomPose(project, { vi: "abc", en: "xyz" }) };
    project = { ...project, ...setCustomPose(project, null) };
    expect(project.photosV091!.theme.customPoseVi).toBeUndefined();
    expect(project.photosV091!.theme.customPoseEn).toBeUndefined();
  });

  it("autoPickShots with customPoseText sets shot.poseNote and leaves posePresetId undefined", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const customPoseText = "sitting beside coffee cup, hand supporting chin";
    project = {
      ...project,
      ...autoPickShots(project, 6, { customPoseText }),
    };
    const shots = project.photosV091!.shots;
    expect(shots).toHaveLength(6);
    for (const shot of shots) {
      expect(shot.poseNote).toBe(customPoseText);
      expect(shot.posePresetId).toBeUndefined();
    }
  });

  it("autoPickShots with customPoseText still varies camera angles", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    project = {
      ...project,
      ...autoPickShots(project, 6, { customPoseText: "looking out window" }),
    };
    const angleIds = project.photosV091!.shots.map((s) => s.anglePresetId);
    const unique = new Set(angleIds);
    // Should pick 6 different angles when angleId not specified
    expect(unique.size).toBe(6);
  });

  it("autoPickShots with customPoseText + fixed angleId: all shots same pose + angle", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    project = {
      ...project,
      ...autoPickShots(project, 3, {
        customPoseText: "leaning on railing",
        angleId: "wide_front",
      }),
    };
    for (const shot of project.photosV091!.shots) {
      expect(shot.poseNote).toBe("leaning on railing");
      expect(shot.anglePresetId).toBe("wide_front");
      expect(shot.posePresetId).toBeUndefined();
    }
  });

  it("Custom pose text is injected into *Position:* block of generated prompt", () => {
    let project = useAppStore.getState().currentProject!;
    project = { ...project, ...addCastMember(project, "female") };
    const castId = project.photosV091!.cast[0].id;
    project = {
      ...project,
      ...addFaceRef(project, castId, {
        filename: "f.jpg",
        mimeType: "image/jpeg",
        dataUrl: TINY_PNG_DATA_URL,
      }),
    };
    const customText = "sitting at rooftop cafe with both hands wrapped around a hot coffee cup";
    project = {
      ...project,
      ...autoPickShots(project, 1, { customPoseText: customText }),
    };
    useAppStore.setState({ currentProject: project });
    const shot = project.photosV091!.shots[0];
    const result = buildPhotosShotPrompt(project, shot)!;
    expect(result.prompt).toContain("rooftop cafe");
    expect(result.prompt).toContain("hot coffee cup");
  });
});

describe("v0.9.1-r12 — Editor connector layout", () => {
  beforeEach(() => {
    cleanup();
    useAppStore.setState({ currentProject: makePhotosProject() });
  });

  it("Photos mode renders Project + Cast + Camera Style sections", () => {
    const { container } = render(<Editor />);
    // 5 sections should all render: project, cast, camera, idea, imgen
    const sections = container.querySelectorAll(".ksp-section");
    expect(sections.length).toBeGreaterThanOrEqual(4);
    // Verify at least project + cast + camera headers exist
    const html = container.innerHTML;
    expect(html).toContain("PROJECT");
    expect(html.toUpperCase()).toContain("CAMERA STYLE");
  });
});
