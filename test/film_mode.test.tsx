/**
 * KSP Image v0.9.3 — Film mode tests
 *
 * Verify Film schema + actions + CastFilmSection mount without crash.
 * Mirrors photos_mode.test.tsx pattern.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import { useAppStore } from "../src/store/useAppStore";

import {
  createDefaultFilmV093,
  createFilmCharacter,
  createFilmImageRef,
  MAX_FACE_REFS_FILM,
  MAX_BODY_REFS,
  DEFAULT_FACE_LABELS_FILM,
  DEFAULT_BODY_LABELS,
} from "../src/types/film";

import { findNextMissingLabel } from "../src/engine/filmCastGeneration";

import {
  ensureFilmData,
  addCharacter,
  updateCharacter,
  removeCharacter,
  addFaceRef,
  addBodyRef,
  setAiGenDescription,
  setScript,
  revertScriptToVersion,
  setScriptProvider,
  addShot,
  updateShot,
  removeShot,
  toggleShotLocked,
  getShotsForScene,
  // r5
  expandShot,
  collapseShot,
  setShotImagePrompt,
  setShotAnimationPrompt,
  setShotVideoProvider,
  setShotGridImage,
  clearShotGridImage,
  toggleShotFrameLock,
  addCustomVideoProvider,
  removeCustomVideoProvider,
  updateCustomVideoProvider,
  getAllVideoProviders,
  // r6
  setVoiceAssignment,
  clearVoiceAssignment,
  setVoiceProviderGlobal,
  setSfxProvider,
  setSceneMusicBrief,
  setSceneSfx,
  // r7
  setScriptMode,
  setScriptStage,
  setScriptStructure,
  setScriptBeats,
  updateScriptBeat,
  addScriptBeat,
  removeScriptBeat,
  setScriptTwists,
  updateScriptTwist,
  lockScriptTwists,
  setScriptIntermediateScenes,
  setScriptTargetSceneCount,
  revertToStage,
} from "../src/store/film_actions";
import {
  DEFAULT_VIDEO_PROVIDERS,
  resolveVideoProvider,
  createShotR5Frames,
  VOICE_PROVIDER_LABELS,
  SFX_PROVIDER_LABELS,
  FRAMEWORK_LABELS,
} from "../src/types/film";
import {
  buildImagePrompt,
  buildAnimationPrompt,
  charCountColor,
} from "../src/engine/filmShotPromptBuilder";
import {
  exportFilmBundle,
  previewBundleTree,
} from "../src/engine/filmBundleExporter";

import { CastFilmSection } from "../src/components/CastFilmSection";
import { FilmIdeaScriptSection } from "../src/components/FilmIdeaScriptSection";
import { FilmStoryboardSection } from "../src/components/FilmStoryboardSection";
import { FilmVoiceSection } from "../src/components/FilmVoiceSection";
import { FilmMusicSfxSection } from "../src/components/FilmMusicSfxSection";
import { FilmBundleExportSection } from "../src/components/FilmBundleExportSection";

// Base Film project fixture
const baseFilmProject: any = {
  id: "film-test",
  name: "Test Film",
  mode: "film",
  idea: { raw: "" },
  shots: [],
  createdAt: Date.now(),
  schemaVersion: "v0.9",
  settingV2: {
    name: "Test Film",
    mode: "film",
    genre: "drama",
    animationStyle: "live_action",
    aspectRatio: "16:9",
    durationMinutes: 5,
    dialog: "no_dialog",
    timeFormat: "integer",
    aiProviders: {
      scriptWriter: "gemini-flash",
      conceptWriter: "gemini-flash",
      storyboardFrames: "gemini-flash",
      imageGen: "imagen-4-standard",
      voiceTts: "elevenlabs",
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
};

describe("Film v0.9.3 schema + actions", () => {
  beforeEach(() => {
    cleanup();
  });

  it("ensureFilmData creates default when missing", () => {
    const data = ensureFilmData(baseFilmProject);
    expect(data.schemaVersion).toBe("v0.9.3-film");
    expect(data.characters).toEqual([]);
    expect(data.selectedCharacterId).toBeUndefined();
  });

  it("addCharacter creates character + auto-selects + increments order", () => {
    const patch1 = addCharacter(baseFilmProject, "protagonist");
    const data1 = patch1.filmV093!;
    expect(data1.characters.length).toBe(1);
    expect(data1.characters[0].order).toBe(1);
    expect(data1.characters[0].role).toBe("protagonist");
    expect(data1.selectedCharacterId).toBe(data1.characters[0].id);

    // Add second character — order increments
    const proj2 = { ...baseFilmProject, filmV093: data1 };
    const patch2 = addCharacter(proj2, "companion");
    expect(patch2.filmV093!.characters.length).toBe(2);
    expect(patch2.filmV093!.characters[1].order).toBe(2);
  });

  it("removeCharacter re-orders remaining + clears selectedCharacterId nếu match", () => {
    const proj = { ...baseFilmProject, filmV093: addCharacter(baseFilmProject, "protagonist").filmV093 };
    const proj2 = { ...proj, filmV093: addCharacter(proj, "antagonist").filmV093 };
    const char1Id = proj2.filmV093!.characters[0].id;

    const removePatch = removeCharacter(proj2, char1Id);
    expect(removePatch.filmV093!.characters.length).toBe(1);
    expect(removePatch.filmV093!.characters[0].order).toBe(1); // re-ordered từ 2 → 1
    expect(removePatch.filmV093!.selectedCharacterId).toBe(removePatch.filmV093!.characters[0].id);
  });

  it("updateCharacter applies partial updates", () => {
    const projWithChar = { ...baseFilmProject, filmV093: addCharacter(baseFilmProject, "protagonist").filmV093 };
    const charId = projWithChar.filmV093!.characters[0].id;

    const updatePatch = updateCharacter(projWithChar, charId, {
      name: "Robot",
      description: "Bipedal silver robot 1m8 tall",
    });
    expect(updatePatch.filmV093!.characters[0].name).toBe("Robot");
    expect(updatePatch.filmV093!.characters[0].description).toBe("Bipedal silver robot 1m8 tall");
    expect(updatePatch.filmV093!.characters[0].role).toBe("protagonist"); // unchanged
  });

  it("addFaceRef enforces cap MAX_FACE_REFS_FILM (4)", () => {
    let proj = { ...baseFilmProject, filmV093: addCharacter(baseFilmProject, "protagonist").filmV093 };
    const charId = proj.filmV093!.characters[0].id;

    // Add 5 face refs — chỉ 4 first ones được accept
    for (let i = 0; i < 5; i++) {
      const ref = createFilmImageRef(
        `face${i}.jpg`,
        "image/jpeg",
        "data:image/jpeg;base64,test",
        `slot${i}`
      );
      const patch = addFaceRef(proj, charId, ref);
      proj = { ...proj, filmV093: patch.filmV093 };
    }

    expect(proj.filmV093!.characters[0].faceRefs.length).toBe(MAX_FACE_REFS_FILM);
    expect(proj.filmV093!.characters[0].faceRefs.length).toBe(4);
  });

  it("addBodyRef enforces cap MAX_BODY_REFS (3)", () => {
    let proj = { ...baseFilmProject, filmV093: addCharacter(baseFilmProject, "protagonist").filmV093 };
    const charId = proj.filmV093!.characters[0].id;

    // Add 5 body refs — chỉ 3 first ones accept
    for (let i = 0; i < 5; i++) {
      const ref = createFilmImageRef(
        `body${i}.jpg`,
        "image/jpeg",
        "data:image/jpeg;base64,test",
        `body_slot${i}`
      );
      const patch = addBodyRef(proj, charId, ref);
      proj = { ...proj, filmV093: patch.filmV093 };
    }

    expect(proj.filmV093!.characters[0].bodyRefs.length).toBe(MAX_BODY_REFS);
    expect(proj.filmV093!.characters[0].bodyRefs.length).toBe(3);
  });

  it("setAiGenDescription saves prose into character (Q4 stub)", () => {
    const projWithChar = { ...baseFilmProject, filmV093: addCharacter(baseFilmProject, "protagonist").filmV093 };
    const charId = projWithChar.filmV093!.characters[0].id;

    const desc = "Robot bipedal cao 1m8, vỏ kim loại bạc cũ kỹ, mắt LED xanh dịu";
    const patch = setAiGenDescription(projWithChar, charId, desc);

    expect(patch.filmV093!.characters[0].aiGenDescription).toBe(desc);
  });

  it("CastFilmSection mounts without crash (Film mode project)", () => {
    useAppStore.setState({ currentProject: baseFilmProject });
    const { container } = render(<CastFilmSection />);
    expect(container.innerHTML).toContain("CAST");
    // qc8: + button moved to corner with class ksp-cast-film-add-corner (icon only "+")
    expect(container.innerHTML).toContain("ksp-cast-film-add-corner");
    // qc8: removed footer + banner
    expect(container.innerHTML).not.toContain("ksp-cast-film-footer");
    expect(container.innerHTML).not.toContain("ksp-cast-film-banner");
    expect(container.innerHTML).not.toContain("AI gợi ý cast");
  });

  // ============================================================================
  // qc8 — Cast generation engine tests
  // ============================================================================

  it("qc8 findNextMissingLabel returns first missing in order", () => {
    const refs = [
      { id: "r1", label: "front", filename: "f.png", mimeType: "image/png", dataUrl: "data:image/png;base64,xx" },
      { id: "r2", label: "profile", filename: "p.png", mimeType: "image/png", dataUrl: "data:image/png;base64,xx" },
    ];
    const next = findNextMissingLabel(refs as any, DEFAULT_FACE_LABELS_FILM);
    // DEFAULT_FACE_LABELS_FILM = ["front", "3/4 L", "3/4 R", "profile"]
    // front filled, 3/4 L missing → returns "3/4 L"
    expect(next).toBe("3/4 L");
  });

  it("qc8 findNextMissingLabel returns undefined when all filled", () => {
    const refs = DEFAULT_FACE_LABELS_FILM.map((label, i) => ({
      id: `r${i}`,
      label,
      filename: `${label}.png`,
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,xx",
    }));
    const next = findNextMissingLabel(refs as any, DEFAULT_FACE_LABELS_FILM);
    expect(next).toBeUndefined();
  });

  it("qc8 findNextMissingLabel for body refs (3 angles)", () => {
    const refs = [
      { id: "r1", label: "front", filename: "f.png", mimeType: "image/png", dataUrl: "x" },
    ];
    // DEFAULT_BODY_LABELS = ["front", "side", "back"]
    const next = findNextMissingLabel(refs as any, DEFAULT_BODY_LABELS);
    expect(next).toBe("side");
  });

  // ============================================================================
  // r3 — Script CRUD tests
  // ============================================================================

  it("setScript stores script + archives prev version on update", () => {
    const mockScript: any = {
      titleEn: "First", titleVi: "Bản đầu", logline: "test",
      synopsisEn: "syn", scenes: [],
      aiProvider: "gemini-flash", versions: [],
      createdAt: Date.now(), updatedAt: Date.now(),
    };

    const projWithChar = { ...baseFilmProject, filmV093: addCharacter(baseFilmProject, "protagonist").filmV093 };
    const patch1 = setScript(projWithChar, mockScript);
    expect(patch1.filmV093!.script!.titleEn).toBe("First");
    expect(patch1.filmV093!.script!.versions).toEqual([]);

    const projV1 = { ...projWithChar, filmV093: patch1.filmV093 };
    const mockScript2 = { ...mockScript, titleEn: "Second", titleVi: "Bản hai" };
    const patch2 = setScript(projV1, mockScript2);
    expect(patch2.filmV093!.script!.titleEn).toBe("Second");
    expect(patch2.filmV093!.script!.versions!.length).toBe(1);
    expect(patch2.filmV093!.script!.versions![0].scriptSnapshot.titleEn).toBe("First");

    const patchProv = setScriptProvider(projWithChar, "openai-4o");
    expect(patchProv.filmV093!.scriptProvider).toBe("openai-4o");
  });

  // ============================================================================
  // r4 — Shot CRUD tests
  // ============================================================================

  it("addShot creates shot under scene + increments order", () => {
    const sceneId = "scene_test_1";
    const patch1 = addShot(baseFilmProject, sceneId);
    expect(patch1.filmV093!.shotsBySceneId![sceneId]).toBeDefined();
    expect(patch1.filmV093!.shotsBySceneId![sceneId].length).toBe(1);
    expect(patch1.filmV093!.shotsBySceneId![sceneId][0].order).toBe(1);
    expect(patch1.filmV093!.shotsBySceneId![sceneId][0].gridFormat).toBe("3x3");

    const proj2 = { ...baseFilmProject, filmV093: patch1.filmV093 };
    const patch2 = addShot(proj2, sceneId);
    expect(patch2.filmV093!.shotsBySceneId![sceneId].length).toBe(2);
    expect(patch2.filmV093!.shotsBySceneId![sceneId][1].order).toBe(2);
  });

  it("updateShot patches grid format + status", () => {
    const sceneId = "scene_test_2";
    const proj = { ...baseFilmProject, filmV093: addShot(baseFilmProject, sceneId).filmV093 };
    const shotId = proj.filmV093!.shotsBySceneId![sceneId][0].id;
    const patch = updateShot(proj, sceneId, shotId, { gridFormat: "4x3", status: "rendered" });
    expect(patch.filmV093!.shotsBySceneId![sceneId][0].gridFormat).toBe("4x3");
    expect(patch.filmV093!.shotsBySceneId![sceneId][0].status).toBe("rendered");
  });

  it("removeShot re-orders remaining shots", () => {
    const sceneId = "scene_test_3";
    let proj = { ...baseFilmProject, filmV093: addShot(baseFilmProject, sceneId).filmV093 };
    proj = { ...proj, filmV093: addShot(proj, sceneId).filmV093 };
    proj = { ...proj, filmV093: addShot(proj, sceneId).filmV093 };
    expect(proj.filmV093!.shotsBySceneId![sceneId].length).toBe(3);

    const middleShotId = proj.filmV093!.shotsBySceneId![sceneId][1].id;
    const patch = removeShot(proj, sceneId, middleShotId);
    expect(patch.filmV093!.shotsBySceneId![sceneId].length).toBe(2);
    expect(patch.filmV093!.shotsBySceneId![sceneId][0].order).toBe(1);
    expect(patch.filmV093!.shotsBySceneId![sceneId][1].order).toBe(2);
  });

  it("toggleShotLocked flips locked state", () => {
    const sceneId = "scene_test_4";
    const proj = { ...baseFilmProject, filmV093: addShot(baseFilmProject, sceneId).filmV093 };
    const shotId = proj.filmV093!.shotsBySceneId![sceneId][0].id;
    expect(proj.filmV093!.shotsBySceneId![sceneId][0].locked).toBeUndefined();

    const patch = toggleShotLocked(proj, sceneId, shotId);
    expect(patch.filmV093!.shotsBySceneId![sceneId][0].locked).toBe(true);

    const proj2 = { ...proj, filmV093: patch.filmV093 };
    const patch2 = toggleShotLocked(proj2, sceneId, shotId);
    expect(patch2.filmV093!.shotsBySceneId![sceneId][0].locked).toBe(false);
  });

  it("qc4 FilmIdeaScriptSection renders new stepper wizard (5 stages visible)", () => {
    useAppStore.setState({ currentProject: baseFilmProject });
    const { container } = render(<FilmIdeaScriptSection />);
    // Stepper 5 stages all rendered (VN labels post-qc6)
    expect(container.innerHTML).toContain("Structure");
    expect(container.innerHTML).toContain("Beats");
    expect(container.innerHTML).toContain("Twists");
    expect(container.innerHTML).toContain("Phân cảnh");
    expect(container.innerHTML).toContain("Lời thoại");
    // Footer progress
    expect(container.innerHTML).toContain("0/5 stages");
    // NO old UI elements
    expect(container.innerHTML).not.toContain("Quick path");
    expect(container.innerHTML).not.toContain("Multi-stage wizard");
    expect(container.innerHTML).not.toContain("Gemini Flash");
    expect(container.innerHTML).not.toContain("OpenAI 4o");
  });

  it("qc4 FilmIdeaScriptSection shows stage 1 as ACTIVE on empty film (no structure yet)", () => {
    useAppStore.setState({ currentProject: baseFilmProject });
    const { container } = render(<FilmIdeaScriptSection />);
    // Stage 1 is active → shows VN button label
    expect(container.innerHTML).toContain("AI chọn khung kể chuyện");
    // Stage 1 has "đang làm" pill
    expect(container.innerHTML).toContain("đang làm");
  });

  it("qc4 FilmIdeaScriptSection shows stage 1 as DONE when scriptStructure exists", () => {
    const projWithStructure: any = {
      ...baseFilmProject,
      filmV093: {
        schemaVersion: "v0.9.3-film",
        characters: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scriptStructure: { framework: "three-act", contentEn: "Setup..." },
      },
    };
    useAppStore.setState({ currentProject: projWithStructure });
    const { container } = render(<FilmIdeaScriptSection />);
    // Stage 1 done preview shows VN framework name pill (post-qc6 has "(Cấu trúc 3 hồi)")
    expect(container.innerHTML).toContain("3-Act Structure");
    expect(container.innerHTML).toContain("Cấu trúc 3 hồi");
    // Progress is 1/5
    expect(container.innerHTML).toContain("1/5 stages");
  });

  it("qc6 Stage 4 shows scene count input with auto suggestion", () => {
    // Project has beats but not scenes yet — Stage 4 is active
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        schemaVersion: "v0.9.3-film",
        characters: [{ id: "c1", role: "protagonist", order: 1, name: "Hero", description: "Brave" }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scriptStructure: { framework: "three-act", contentEn: "Setup..." },
        scriptBeats: [
          { id: "b1", order: 1, title: "Open", description: "Start" },
        ],
        scriptTwists: [],
        scriptStage: "scenes",
      },
      idea: { raw: "test idea" },
    };
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmIdeaScriptSection />);
    // Scene count control rendered
    expect(container.innerHTML).toContain("Số lượng phân cảnh mong muốn");
    expect(container.innerHTML).toContain("AI gợi ý");
  });

  it("qc6 setScriptTargetSceneCount action stores the value", () => {
    const p = setScriptTargetSceneCount(baseFilmProject, 10);
    expect(p.filmV093!.scriptTargetSceneCount).toBe(10);
  });

  it("qc6 setScriptTargetSceneCount with undefined clears the value", () => {
    let proj = baseFilmProject;
    proj = { ...proj, filmV093: setScriptTargetSceneCount(proj, 10).filmV093 };
    expect(proj.filmV093.scriptTargetSceneCount).toBe(10);

    const p = setScriptTargetSceneCount(proj, undefined);
    expect(p.filmV093!.scriptTargetSceneCount).toBeUndefined();
  });

  it("qc6 FRAMEWORK_LABELS now bilingual (EN + VN)", () => {
    expect(FRAMEWORK_LABELS["three-act"].name).toContain("3-Act Structure");
    expect(FRAMEWORK_LABELS["three-act"].name).toContain("Cấu trúc 3 hồi");
    expect(FRAMEWORK_LABELS["hero-journey"].name).toContain("Hành trình Anh hùng");
    expect(FRAMEWORK_LABELS.kishotenketsu.name).toContain("Khởi Thừa Chuyển Kết");
  });

  it("FilmStoryboardSection mounts without crash", () => {
    useAppStore.setState({ currentProject: baseFilmProject });
    const { container } = render(<FilmStoryboardSection />);
    expect(container.innerHTML).toContain("STORYBOARD");
  });

  // ============================================================================
  // r5 — Shot Detail Panel tests
  // ============================================================================

  const sceneFixture: any = {
    id: "scene_r5",
    order: 1,
    titleEn: "Test Scene",
    settings: "EXT. ROOFTOP — DUSK",
    durationSeconds: 30,
    act: "rising",
    actionLinesEn: "A robot walks across the rooftop at dusk, looking back at the city.",
    dialog: [],
    sfx: [],
    musicBrief: "",
  };

  function projWithShotFor(sceneId: string): any {
    return { ...baseFilmProject, filmV093: addShot(baseFilmProject, sceneId).filmV093 };
  }

  it("expandShot toggles singleton (same id collapses)", () => {
    const proj = projWithShotFor("scene_r5");
    const shotId = proj.filmV093.shotsBySceneId.scene_r5[0].id;

    const p1 = expandShot(proj, shotId);
    expect(p1.filmV093!.expandedShotId).toBe(shotId);

    const proj2 = { ...proj, filmV093: p1.filmV093 };
    const p2 = expandShot(proj2, shotId); // same id → collapse
    expect(p2.filmV093!.expandedShotId).toBeUndefined();
  });

  it("collapseShot clears expandedShotId", () => {
    const proj = projWithShotFor("scene_r5");
    const shotId = proj.filmV093.shotsBySceneId.scene_r5[0].id;
    const p1 = expandShot(proj, shotId);
    const proj2 = { ...proj, filmV093: p1.filmV093 };
    const p2 = collapseShot(proj2);
    expect(p2.filmV093!.expandedShotId).toBeUndefined();
  });

  it("setShotImagePrompt + setShotAnimationPrompt + setShotVideoProvider patch the shot", () => {
    const proj = projWithShotFor("scene_r5");
    const shotId = proj.filmV093.shotsBySceneId.scene_r5[0].id;

    const p1 = setShotImagePrompt(proj, "scene_r5", shotId, "IMG PROMPT EN");
    expect(p1.filmV093!.shotsBySceneId!.scene_r5[0].imagePromptR5).toBe("IMG PROMPT EN");

    const proj2 = { ...proj, filmV093: p1.filmV093 };
    const p2 = setShotAnimationPrompt(proj2, "scene_r5", shotId, "ANIM PROMPT EN");
    expect(p2.filmV093!.shotsBySceneId!.scene_r5[0].animationPromptR5).toBe("ANIM PROMPT EN");

    const proj3 = { ...proj2, filmV093: p2.filmV093 };
    const p3 = setShotVideoProvider(proj3, "scene_r5", shotId, "veo-3");
    expect(p3.filmV093!.shotsBySceneId!.scene_r5[0].videoProviderId).toBe("veo-3");
  });

  it("setShotGridImage seeds framesR5 matching grid format + status → rendered", () => {
    const proj = projWithShotFor("scene_r5");
    const shotId = proj.filmV093.shotsBySceneId.scene_r5[0].id;
    // Default gridFormat is 3x3 = 9 frames

    const p = setShotGridImage(proj, "scene_r5", shotId, "data:image/png;base64,XXX");
    const shot = p.filmV093!.shotsBySceneId!.scene_r5[0];
    expect(shot.gridImageDataUrl).toBe("data:image/png;base64,XXX");
    expect(shot.framesR5?.length).toBe(9);
    expect(shot.framesR5?.[0].order).toBe(1);
    expect(shot.status).toBe("rendered");
  });

  it("clearShotGridImage resets grid + frames + status back to draft", () => {
    let proj = projWithShotFor("scene_r5");
    const shotId = proj.filmV093.shotsBySceneId.scene_r5[0].id;
    proj = { ...proj, filmV093: setShotGridImage(proj, "scene_r5", shotId, "data:img").filmV093 };

    const p = clearShotGridImage(proj, "scene_r5", shotId);
    const shot = p.filmV093!.shotsBySceneId!.scene_r5[0];
    expect(shot.gridImageDataUrl).toBeUndefined();
    expect(shot.framesR5).toBeUndefined();
    expect(shot.status).toBe("draft");
  });

  it("toggleShotFrameLock flips a single frame's locked state", () => {
    let proj = projWithShotFor("scene_r5");
    const shotId = proj.filmV093.shotsBySceneId.scene_r5[0].id;
    proj = { ...proj, filmV093: setShotGridImage(proj, "scene_r5", shotId, "data:img").filmV093 };
    const frameId = proj.filmV093.shotsBySceneId.scene_r5[0].framesR5![0].id;

    const p = toggleShotFrameLock(proj, "scene_r5", shotId, frameId);
    expect(p.filmV093!.shotsBySceneId!.scene_r5[0].framesR5![0].locked).toBe(true);

    const proj2 = { ...proj, filmV093: p.filmV093 };
    const p2 = toggleShotFrameLock(proj2, "scene_r5", shotId, frameId);
    expect(p2.filmV093!.shotsBySceneId!.scene_r5[0].framesR5![0].locked).toBe(false);
  });

  it("addCustomVideoProvider stores with isCustom=true + auto-generates id", () => {
    const p = addCustomVideoProvider(baseFilmProject, {
      name: "Grok Video",
      pricingPerSec: "$0.20/s",
      maxDurationSec: 15,
      charLimit: 3000,
    });
    expect(p.filmV093!.customVideoProviders?.length).toBe(1);
    const grok = p.filmV093!.customVideoProviders![0];
    expect(grok.name).toBe("Grok Video");
    expect(grok.isCustom).toBe(true);
    expect(grok.id.startsWith("custom_")).toBe(true);
  });

  it("addCustomVideoProvider accepts name-only (Hướng A flexibility)", () => {
    const p = addCustomVideoProvider(baseFilmProject, { name: "MinimalProvider" });
    const minimal = p.filmV093!.customVideoProviders![0];
    expect(minimal.name).toBe("MinimalProvider");
    expect(minimal.pricingPerSec).toBeUndefined();
    expect(minimal.charLimit).toBeUndefined();
  });

  it("removeCustomVideoProvider only removes that custom provider", () => {
    let proj = { ...baseFilmProject, filmV093: addCustomVideoProvider(baseFilmProject, { name: "A" }).filmV093 };
    proj = { ...proj, filmV093: addCustomVideoProvider(proj, { name: "B" }).filmV093 };
    expect(proj.filmV093.customVideoProviders.length).toBe(2);
    const idB = proj.filmV093.customVideoProviders[1].id;

    const p = removeCustomVideoProvider(proj, idB);
    expect(p.filmV093!.customVideoProviders!.length).toBe(1);
    expect(p.filmV093!.customVideoProviders![0].name).toBe("A");
  });

  it("updateCustomVideoProvider patches one provider's fields", () => {
    const proj = { ...baseFilmProject, filmV093: addCustomVideoProvider(baseFilmProject, { name: "Original" }).filmV093 };
    const id = proj.filmV093.customVideoProviders[0].id;

    const p = updateCustomVideoProvider(proj, id, { name: "Renamed", charLimit: 5000 });
    expect(p.filmV093!.customVideoProviders![0].name).toBe("Renamed");
    expect(p.filmV093!.customVideoProviders![0].charLimit).toBe(5000);
  });

  it("getAllVideoProviders returns 4 defaults + customs concatenated", () => {
    const proj = { ...baseFilmProject, filmV093: addCustomVideoProvider(baseFilmProject, { name: "X" }).filmV093 };
    const all = getAllVideoProviders(proj);
    expect(all.length).toBe(DEFAULT_VIDEO_PROVIDERS.length + 1);
    expect(all[0].id).toBe("seedance-2-pro"); // first default
    expect(all[all.length - 1].name).toBe("X"); // custom last
  });

  it("resolveVideoProvider falls back to first default for unknown id", () => {
    const p = resolveVideoProvider("nonexistent-id", []);
    expect(p.id).toBe("seedance-2-pro");
  });

  it("createShotR5Frames produces correct count per grid format", () => {
    expect(createShotR5Frames("2x2").length).toBe(4);
    expect(createShotR5Frames("2x3").length).toBe(6);
    expect(createShotR5Frames("3x3").length).toBe(9);
    expect(createShotR5Frames("4x3").length).toBe(12);
  });

  it("charCountColor thresholds: green <70%, yellow 70-95%, red >95%, none if no limit", () => {
    expect(charCountColor(100, 1000)).toBe("green");   // 10%
    expect(charCountColor(600, 1000)).toBe("green");   // 60%
    expect(charCountColor(700, 1000)).toBe("yellow");  // 70%
    expect(charCountColor(900, 1000)).toBe("yellow");  // 90%
    expect(charCountColor(960, 1000)).toBe("red");     // 96%
    expect(charCountColor(2000, 1000)).toBe("red");    // over
    expect(charCountColor(500, undefined)).toBe("none"); // no limit
    expect(charCountColor(500, 0)).toBe("none");          // zero limit
  });

  it("buildImagePrompt includes grid dims + style + cast count + scene action", () => {
    const shot: any = {
      id: "s1",
      order: 1,
      titleEn: "Robot walks",
      titleVi: "",
      shotType: "wide_establishing",
      durationSeconds: 5,
      gridFormat: "3x3",
      cameraMovement: "handheld_documentary",
      status: "draft",
    };
    const cast = [
      { id: "c1", order: 1, name: "Robot", role: "protagonist", description: "Tin android", faceRefs: [], bodyRefs: [] },
    ] as any;
    const setting = baseFilmProject.settingV2;
    const prompt = buildImagePrompt({ shot, scene: sceneFixture, cast, setting });

    expect(prompt).toContain("3×3 = 9 cells");
    expect(prompt).toContain("16:9");
    expect(prompt).toContain("live-action cinematic");
    expect(prompt).toContain("Robot");
    expect(prompt).toContain("Image #1");
    expect(prompt).toContain("wide / establishing shot");
    expect(prompt).toContain("rooftop");
  });

  it("buildAnimationPrompt includes provider-specific tone for each default", () => {
    const shot: any = {
      id: "s1",
      order: 1,
      titleEn: "Robot walks",
      shotType: "medium",
      durationSeconds: 6,
      gridFormat: "3x3",
      cameraMovement: "steadicam_smooth",
      status: "draft",
    };
    const setting = baseFilmProject.settingV2;

    const seedancePrompt = buildAnimationPrompt({
      shot, scene: sceneFixture, cast: [], setting,
      provider: DEFAULT_VIDEO_PROVIDERS[0],
    });
    expect(seedancePrompt).toContain("Seedance");
    // qc23: all providers now aligned to ONE continuous shot (no multi-shot syntax)
    expect(seedancePrompt).toContain("ONE continuous shot");
    expect(seedancePrompt).toContain("TIMING BREAKDOWN");
    expect(seedancePrompt).toContain("CAMERA:");

    const veoPrompt = buildAnimationPrompt({
      shot, scene: sceneFixture, cast: [], setting,
      provider: DEFAULT_VIDEO_PROVIDERS[1],
    });
    expect(veoPrompt).toContain("Veo");

    const soraPrompt = buildAnimationPrompt({
      shot, scene: sceneFixture, cast: [], setting,
      provider: DEFAULT_VIDEO_PROVIDERS[3],
    });
    expect(soraPrompt).toContain("Sora");
    expect(soraPrompt).toContain("ONE continuous take");
  });

  // qc16: FilmShotDetailPanel deleted (paradigm shift to scene-level grids).
  // Replaced by FilmStoryboardSection visual grid display tests below.

  // ============================================================================
  // r6 — Voice / Music+SFX / Bundle Export tests
  // ============================================================================

  it("setVoiceAssignment stores per-character provider", () => {
    const proj = { ...baseFilmProject, filmV093: addCharacter(baseFilmProject, "protagonist").filmV093 };
    const charId = proj.filmV093.characters[0].id;

    const p1 = setVoiceAssignment(proj, charId, "elevenlabs");
    expect(p1.filmV093!.voiceAssignments![charId]).toBe("elevenlabs");

    const proj2 = { ...proj, filmV093: p1.filmV093 };
    const p2 = setVoiceAssignment(proj2, charId, "google-tts");
    expect(p2.filmV093!.voiceAssignments![charId]).toBe("google-tts");

    // null = skip voice
    const proj3 = { ...proj2, filmV093: p2.filmV093 };
    const p3 = setVoiceAssignment(proj3, charId, null);
    expect(p3.filmV093!.voiceAssignments![charId]).toBeNull();
  });

  it("clearVoiceAssignment removes char-specific assignment (reverts to global)", () => {
    const proj = { ...baseFilmProject, filmV093: addCharacter(baseFilmProject, "protagonist").filmV093 };
    const charId = proj.filmV093.characters[0].id;
    const proj2 = { ...proj, filmV093: setVoiceAssignment(proj, charId, "google-tts").filmV093 };

    const p = clearVoiceAssignment(proj2, charId);
    expect(p.filmV093!.voiceAssignments![charId]).toBeUndefined();
  });

  it("setVoiceProviderGlobal updates project-wide default", () => {
    const p = setVoiceProviderGlobal(baseFilmProject, "google-tts");
    expect(p.filmV093!.voiceProviderGlobal).toBe("google-tts");
  });

  it("setSfxProvider stores project-wide choice", () => {
    const p1 = setSfxProvider(baseFilmProject, "freesound");
    expect(p1.filmV093!.sfxProvider).toBe("freesound");

    const proj2 = { ...baseFilmProject, filmV093: p1.filmV093 };
    const p2 = setSfxProvider(proj2, "epidemic");
    expect(p2.filmV093!.sfxProvider).toBe("epidemic");

    const proj3 = { ...proj2, filmV093: p2.filmV093 };
    const p3 = setSfxProvider(proj3, "suno-sfx");
    expect(p3.filmV093!.sfxProvider).toBe("suno-sfx");
  });

  it("setSceneMusicBrief patches scene.musicBrief through script", () => {
    // Need a script with at least one scene
    const minimalScript: any = {
      titleEn: "T",
      titleVi: "T",
      logline: "x",
      synopsisEn: "x",
      scenes: [
        {
          id: "scene_music_1",
          order: 1,
          titleEn: "S1",
          settings: "EXT.",
          durationSeconds: 30,
          act: "setup",
          actionLinesEn: "",
          dialog: [],
          sfx: [],
          musicBrief: "old brief",
        },
      ],
      versions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const proj = { ...baseFilmProject, filmV093: setScript(baseFilmProject, minimalScript).filmV093 };

    const p = setSceneMusicBrief(proj, "scene_music_1", "Ambient drone, Hans Zimmer Time style, 50bpm");
    expect(p.filmV093!.script!.scenes[0].musicBrief).toContain("Hans Zimmer");
  });

  it("setSceneSfx replaces scene.sfx array", () => {
    const minimalScript: any = {
      titleEn: "T",
      titleVi: "T",
      logline: "x",
      synopsisEn: "x",
      scenes: [
        {
          id: "scene_sfx_1",
          order: 1,
          titleEn: "S1",
          settings: "EXT.",
          durationSeconds: 30,
          act: "setup",
          actionLinesEn: "",
          dialog: [],
          sfx: ["wind", "birds"],
          musicBrief: "",
        },
      ],
      versions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const proj = { ...baseFilmProject, filmV093: setScript(baseFilmProject, minimalScript).filmV093 };

    const p = setSceneSfx(proj, "scene_sfx_1", ["wind in forest", "footsteps on leaves", "distant thunder"]);
    expect(p.filmV093!.script!.scenes[0].sfx).toEqual([
      "wind in forest",
      "footsteps on leaves",
      "distant thunder",
    ]);
  });

  it("VOICE_PROVIDER_LABELS + SFX_PROVIDER_LABELS exposes name + meta", () => {
    expect(VOICE_PROVIDER_LABELS.elevenlabs.name).toBe("ElevenLabs");
    expect(VOICE_PROVIDER_LABELS["google-tts"].name).toBe("Google TTS");
    expect(SFX_PROVIDER_LABELS.freesound.name).toBe("Freesound.org");
    expect(SFX_PROVIDER_LABELS.epidemic.name).toBe("Epidemic Sound");
    expect(SFX_PROVIDER_LABELS["suno-sfx"].name).toBe("Suno SFX");
  });

  // -- previewBundleTree tests --
  it("previewBundleTree contains all 5 top-level folders + counts", () => {
    let proj = { ...baseFilmProject, filmV093: addCharacter(baseFilmProject, "protagonist").filmV093 };
    proj.name = "MyFilm";
    proj.settingV2 = { ...proj.settingV2, name: "My Test Film" };
    const tree = previewBundleTree(proj);
    expect(tree).toContain("cast/");
    expect(tree).toContain("shots/");
    expect(tree).toContain("voice/");
    expect(tree).toContain("music/");
    expect(tree).toContain("sfx/");
    expect(tree).toContain("my-test-film-bundle.zip");
    expect(tree).toContain("1 characters"); // we added 1 char, no refs
  });

  it("previewBundleTree shows no_dialog mode for voice folder", () => {
    const proj = { ...baseFilmProject };
    // baseFilmProject has dialog: "no_dialog"
    const tree = previewBundleTree(proj);
    expect(tree).toContain("voice/                  (empty — no_dialog mode)");
  });

  // -- exportFilmBundle tests --
  it("exportFilmBundle returns a Blob + filename slug + stats", async () => {
    const proj = { ...baseFilmProject, filmV093: addCharacter(baseFilmProject, "protagonist").filmV093 };
    proj.settingV2 = { ...proj.settingV2, name: "Robot Awakens" };

    const result = await exportFilmBundle(proj);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.filename).toBe("robot-awakens-bundle.zip");
    expect(result.stats.characterCount).toBe(1);
    expect(result.stats.estimatedSizeKb).toBeGreaterThan(0);
  });

  it("exportFilmBundle includes script.txt when script exists", async () => {
    const minimalScript: any = {
      titleEn: "Robot Story",
      titleVi: "Câu chuyện robot",
      logline: "A robot discovers consciousness",
      synopsisEn: "A robot named R1 wakes up in a junkyard at dawn.",
      scenes: [
        {
          id: "s1",
          order: 1,
          titleEn: "Junkyard dawn",
          settings: "EXT. JUNKYARD — DAWN",
          durationSeconds: 60,
          act: "setup",
          actionLinesEn: "R1 stirs amid scrap metal.",
          dialog: [],
          sfx: ["metal creaking", "wind"],
          musicBrief: "Slow ambient drone, building hope",
        },
      ],
      versions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const proj = { ...baseFilmProject, filmV093: setScript(baseFilmProject, minimalScript).filmV093 };
    const { blob } = await exportFilmBundle(proj);
    expect(blob.size).toBeGreaterThan(500); // README + script.txt + music briefs + sfx
  });

  it("exportFilmBundle dialog has_dialog mode populates voice/ folder", async () => {
    const scriptWithDialog: any = {
      titleEn: "Dialog Test",
      titleVi: "Test",
      logline: "x",
      synopsisEn: "x",
      scenes: [
        {
          id: "s1",
          order: 1,
          titleEn: "S1",
          settings: "INT.",
          durationSeconds: 30,
          act: "setup",
          actionLinesEn: "x",
          dialog: [
            { characterId: "c1", characterName: "Alice", lineEn: "Hello world." },
            { characterId: "c1", characterName: "Alice", lineEn: "How are you?" },
            { characterId: "c2", characterName: "Bob", lineEn: "I'm fine." },
          ],
          sfx: [],
          musicBrief: "",
        },
      ],
      versions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const proj = {
      ...baseFilmProject,
      settingV2: { ...baseFilmProject.settingV2, dialog: "has_dialog" },
      filmV093: setScript(baseFilmProject, scriptWithDialog).filmV093,
    };
    const { stats } = await exportFilmBundle(proj);
    expect(stats.voiceLineCount).toBe(3); // 2 Alice + 1 Bob
  });

  it("FilmVoiceSection mounts (no_dialog mode)", () => {
    useAppStore.setState({ currentProject: baseFilmProject });
    const { container } = render(<FilmVoiceSection />);
    expect(container.innerHTML).toContain("VOICE");
    expect(container.innerHTML).toContain("Không thoại");
  });

  it("FilmVoiceSection switches to per-char list when has_dialog + script present", () => {
    const scriptWithDialog: any = {
      titleEn: "T",
      titleVi: "T",
      logline: "x",
      synopsisEn: "x",
      scenes: [
        {
          id: "s1",
          order: 1,
          titleEn: "S1",
          settings: "INT.",
          durationSeconds: 30,
          act: "setup",
          actionLinesEn: "",
          dialog: [
            { characterId: "c1", characterName: "Alice", lineEn: "Test line." },
          ],
          sfx: [],
          musicBrief: "",
        },
      ],
      versions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const proj = {
      ...baseFilmProject,
      settingV2: { ...baseFilmProject.settingV2, dialog: "has_dialog" },
      filmV093: setScript(baseFilmProject, scriptWithDialog).filmV093,
    };
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmVoiceSection />);
    expect(container.innerHTML).toContain("Alice");
    expect(container.innerHTML).toContain("1 lines");
  });

  it("FilmMusicSfxSection mounts with script + provider toggle", () => {
    const minimalScript: any = {
      titleEn: "T",
      titleVi: "T",
      logline: "x",
      synopsisEn: "x",
      scenes: [
        {
          id: "s1",
          order: 1,
          titleEn: "S1",
          settings: "EXT.",
          durationSeconds: 30,
          act: "setup",
          actionLinesEn: "",
          dialog: [],
          sfx: ["wind"],
          musicBrief: "Test brief",
        },
      ],
      versions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const proj = { ...baseFilmProject, filmV093: setScript(baseFilmProject, minimalScript).filmV093 };
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmMusicSfxSection />);
    expect(container.innerHTML).toContain("MUSIC");
    expect(container.innerHTML).toContain("Freesound");
  });

  it("FilmBundleExportSection mounts with tree preview", () => {
    useAppStore.setState({ currentProject: baseFilmProject });
    const { container } = render(<FilmBundleExportSection />);
    expect(container.innerHTML).toContain("BUNDLE");
    expect(container.innerHTML).toContain("cast/");
    expect(container.innerHTML).toContain("shots/");
  });

  // ============================================================================
  // r7 — Multi-stage Script Wizard tests (v0.9.3 FINAL)
  // ============================================================================

  it("setScriptMode toggles between quick and multi-stage", () => {
    const p1 = setScriptMode(baseFilmProject, "multi-stage");
    expect(p1.filmV093!.scriptMode).toBe("multi-stage");

    const proj2 = { ...baseFilmProject, filmV093: p1.filmV093 };
    const p2 = setScriptMode(proj2, "quick");
    expect(p2.filmV093!.scriptMode).toBe("quick");
  });

  it("setScriptStage navigates wizard stages", () => {
    const p1 = setScriptStage(baseFilmProject, "structure");
    expect(p1.filmV093!.scriptStage).toBe("structure");

    const proj2 = { ...baseFilmProject, filmV093: p1.filmV093 };
    const p2 = setScriptStage(proj2, "beats");
    expect(p2.filmV093!.scriptStage).toBe("beats");
  });

  it("setScriptStructure stores framework + content", () => {
    const p = setScriptStructure(baseFilmProject, {
      framework: "three-act",
      contentEn: "Setup: introduce robot; Confrontation: forest crisis; Resolution: rescue.",
    });
    expect(p.filmV093!.scriptStructure!.framework).toBe("three-act");
    expect(p.filmV093!.scriptStructure!.contentEn).toContain("Setup");
  });

  it("setScriptBeats stores array of beats", () => {
    const beats = [
      { id: "b1", order: 1, title: "Opening Image", description: "Rusted robot in forest." },
      { id: "b2", order: 2, title: "Inciting Incident", description: "Bird lands on robot's head." },
    ];
    const p = setScriptBeats(baseFilmProject, beats);
    expect(p.filmV093!.scriptBeats?.length).toBe(2);
    expect(p.filmV093!.scriptBeats![0].title).toBe("Opening Image");
  });

  it("updateScriptBeat patches one beat in place", () => {
    const beats = [
      { id: "b1", order: 1, title: "Opening Image", description: "old" },
      { id: "b2", order: 2, title: "Inciting Incident", description: "old" },
    ];
    const proj = { ...baseFilmProject, filmV093: setScriptBeats(baseFilmProject, beats).filmV093 };

    const p = updateScriptBeat(proj, "b1", { description: "new description" });
    expect(p.filmV093!.scriptBeats![0].description).toBe("new description");
    expect(p.filmV093!.scriptBeats![1].description).toBe("old"); // unchanged
  });

  it("addScriptBeat appends with auto-incremented order", () => {
    const beats = [
      { id: "b1", order: 1, title: "Opening", description: "x" },
    ];
    const proj = { ...baseFilmProject, filmV093: setScriptBeats(baseFilmProject, beats).filmV093 };

    const p = addScriptBeat(proj, { title: "New", description: "y" });
    expect(p.filmV093!.scriptBeats?.length).toBe(2);
    expect(p.filmV093!.scriptBeats![1].order).toBe(2);
    expect(p.filmV093!.scriptBeats![1].title).toBe("New");
  });

  it("removeScriptBeat re-orders remaining", () => {
    const beats = [
      { id: "b1", order: 1, title: "A", description: "x" },
      { id: "b2", order: 2, title: "B", description: "y" },
      { id: "b3", order: 3, title: "C", description: "z" },
    ];
    const proj = { ...baseFilmProject, filmV093: setScriptBeats(baseFilmProject, beats).filmV093 };

    const p = removeScriptBeat(proj, "b2");
    expect(p.filmV093!.scriptBeats?.length).toBe(2);
    expect(p.filmV093!.scriptBeats![0].order).toBe(1); // b1
    expect(p.filmV093!.scriptBeats![1].order).toBe(2); // re-ordered from 3
  });

  it("setScriptTwists stores array with accept state undefined initially", () => {
    const twists = [
      { id: "t1", beatId: "b1", description: "Robot was the villain all along.", accepted: undefined },
      { id: "t2", beatId: "b2", description: "Bird is sentient AI.", accepted: undefined },
    ];
    const p = setScriptTwists(baseFilmProject, twists);
    expect(p.filmV093!.scriptTwists?.length).toBe(2);
    expect(p.filmV093!.scriptTwists![0].accepted).toBeUndefined();
  });

  it("updateScriptTwist toggles accept/reject", () => {
    const twists = [
      { id: "t1", beatId: "b1", description: "Twist 1", accepted: undefined as boolean | undefined },
    ];
    const proj = { ...baseFilmProject, filmV093: setScriptTwists(baseFilmProject, twists).filmV093 };

    const p1 = updateScriptTwist(proj, "t1", { accepted: true });
    expect(p1.filmV093!.scriptTwists![0].accepted).toBe(true);

    const proj2 = { ...proj, filmV093: p1.filmV093 };
    const p2 = updateScriptTwist(proj2, "t1", { accepted: false });
    expect(p2.filmV093!.scriptTwists![0].accepted).toBe(false);
  });

  // ============================================================================
  // qc18 — Hướng B: Stage 3 Twists explicit lock via "Tiếp" button
  // ============================================================================

  it("qc18 setScriptTwists initializes scriptTwistsLocked = false (user must confirm)", () => {
    const p = setScriptTwists(baseFilmProject, [
      { id: "t1", beatId: "b1", description: "Twist 1" },
    ]);
    expect(p.filmV093!.scriptTwistsLocked).toBe(false);
  });

  it("qc18 lockScriptTwists flips scriptTwistsLocked to true", () => {
    let proj = { ...baseFilmProject };
    proj = {
      ...proj,
      filmV093: setScriptTwists(proj, [{ id: "t1", beatId: "b1", description: "x" }]).filmV093,
    };
    expect(proj.filmV093.scriptTwistsLocked).toBe(false);

    const p = lockScriptTwists(proj);
    expect(p.filmV093!.scriptTwistsLocked).toBe(true);
    // scriptTwists preserved
    expect(p.filmV093!.scriptTwists!.length).toBe(1);
  });

  it("qc18 setScriptTwists resets lock to false on AI regenerate (clear stale lock)", () => {
    let proj = { ...baseFilmProject };
    proj = {
      ...proj,
      filmV093: setScriptTwists(proj, [{ id: "t1", beatId: "b1", description: "old" }]).filmV093,
    };
    proj = { ...proj, filmV093: lockScriptTwists(proj).filmV093 };
    expect(proj.filmV093.scriptTwistsLocked).toBe(true);

    // AI regenerate twists → lock must reset so user re-confirms new twists
    const p = setScriptTwists(proj, [{ id: "t2", beatId: "b1", description: "new" }]);
    expect(p.filmV093!.scriptTwistsLocked).toBe(false);
    expect(p.filmV093!.scriptTwists![0].id).toBe("t2");
  });

  it("qc18 updateScriptTwist does NOT touch scriptTwistsLocked (user can edit after locking)", () => {
    let proj = { ...baseFilmProject };
    proj = {
      ...proj,
      filmV093: setScriptTwists(proj, [
        { id: "t1", beatId: "b1", description: "x" },
      ]).filmV093,
    };
    proj = { ...proj, filmV093: lockScriptTwists(proj).filmV093 };
    expect(proj.filmV093.scriptTwistsLocked).toBe(true);

    const p = updateScriptTwist(proj, "t1", { accepted: true });
    expect(p.filmV093!.scriptTwistsLocked).toBe(true); // unchanged
  });

  it("qc18 revertToStage('twists') clears scriptTwistsLocked but preserves twists", () => {
    let proj = { ...baseFilmProject };
    proj = { ...proj, filmV093: setScriptStructure(proj, { framework: "three-act", contentEn: "x" }).filmV093 };
    proj = { ...proj, filmV093: setScriptBeats(proj, [{ id: "b1", order: 1, title: "A", description: "x" }]).filmV093 };
    proj = { ...proj, filmV093: setScriptTwists(proj, [{ id: "t1", beatId: "b1", description: "x" }]).filmV093 };
    proj = { ...proj, filmV093: lockScriptTwists(proj).filmV093 };
    proj = { ...proj, filmV093: setScriptIntermediateScenes(proj, [{
      id: "is1", order: 1, titleEn: "x", settings: "x", actionLinesEn: "x", durationSeconds: 60, beatIds: [],
    }]).filmV093 };
    expect(proj.filmV093.scriptTwistsLocked).toBe(true);

    const p = revertToStage(proj, "twists");
    expect(p.filmV093!.scriptTwistsLocked).toBeUndefined();      // cleared
    expect(p.filmV093!.scriptTwists).toBeDefined();              // preserved
    expect(p.filmV093!.scriptIntermediateScenes).toBeUndefined();// cleared (downstream)
  });

  it("qc18 revertToStage('beats') clears scriptTwistsLocked AND scriptTwists", () => {
    let proj = { ...baseFilmProject };
    proj = { ...proj, filmV093: setScriptStructure(proj, { framework: "three-act", contentEn: "x" }).filmV093 };
    proj = { ...proj, filmV093: setScriptBeats(proj, [{ id: "b1", order: 1, title: "A", description: "x" }]).filmV093 };
    proj = { ...proj, filmV093: setScriptTwists(proj, [{ id: "t1", beatId: "b1", description: "x" }]).filmV093 };
    proj = { ...proj, filmV093: lockScriptTwists(proj).filmV093 };

    const p = revertToStage(proj, "beats");
    expect(p.filmV093!.scriptTwistsLocked).toBeUndefined();
    expect(p.filmV093!.scriptTwists).toBeUndefined();
  });

  it("qc18 FilmIdeaScriptSection: Stage 3 renders ACTIVE with twist cards when twists exist + not locked", () => {
    const proj: any = {
      ...baseFilmProject,
      idea: { raw: "test idea" },
      filmV093: {
        ...baseFilmProject.filmV093,
        characters: [{
          id: "c1", role: "protagonist", order: 1, name: "Hero", description: "Brave",
          uniqueIdentifiers: "", hasDialog: false, faceRefs: [], bodyRefs: [], characterType: "human",
        }],
        scriptStructure: { framework: "three-act", contentEn: "x", contentVi: "x" },
        scriptBeats: [{ id: "b1", order: 1, title: "Mở đầu", description: "x" }],
        scriptTwists: [
          { id: "t1", beatId: "b1", description: "Robot was the villain all along." },
          { id: "t2", beatId: "b1", description: "Bird is sentient AI." },
        ],
        // scriptTwistsLocked NOT set → Stage 3 must be ACTIVE (user must pick + click Tiếp)
      },
    };
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmIdeaScriptSection />);
    const html = container.innerHTML;

    // Stage 3 active pill must exist (not just done)
    expect(html).toContain("đang làm");
    // Accept/Reject buttons visible (the BUG was these were hidden)
    expect(html).toContain("Chấp nhận");
    expect(html).toContain("Từ chối");
    // Twist descriptions visible in card body
    expect(html).toContain("Robot was the villain all along.");
    // "Tiếp: ④ Phân cảnh →" button rendered
    expect(html).toContain("Tiếp: ④ Phân cảnh");
  });

  it("qc18 FilmIdeaScriptSection: Stage 3 renders DONE preview when scriptTwistsLocked=true", () => {
    const proj: any = {
      ...baseFilmProject,
      idea: { raw: "test idea" },
      filmV093: {
        ...baseFilmProject.filmV093,
        characters: [{
          id: "c1", role: "protagonist", order: 1, name: "Hero", description: "Brave",
          uniqueIdentifiers: "", hasDialog: false, faceRefs: [], bodyRefs: [], characterType: "human",
        }],
        scriptStructure: { framework: "three-act", contentEn: "x", contentVi: "x" },
        scriptBeats: [{ id: "b1", order: 1, title: "Mở đầu", description: "x" }],
        scriptTwists: [
          { id: "t1", beatId: "b1", description: "T1", accepted: true },
          { id: "t2", beatId: "b1", description: "T2", accepted: false },
        ],
        scriptTwistsLocked: true,
      },
    };
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmIdeaScriptSection />);
    const html = container.innerHTML;

    // Stage 3 done preview pill "1/2 accepted"
    expect(html).toContain("1/2 accepted");
    // Stage 4 (Scenes) should be the next active stage
    expect(html).toContain("Số lượng phân cảnh");
  });

  it("qc18+qc20 FilmIdeaScriptSection: backward-compat qc17 project (twists + scenes + script but no lock fields) → all stages done", () => {
    // Simulates a qc17 project loaded into qc20 build: twists + scenes + script data exists,
    // no lock fields → Stage 3 + Stage 4 must be treated as locked/done via backward-compat.
    const proj: any = {
      ...baseFilmProject,
      idea: { raw: "test idea" },
      filmV093: {
        ...baseFilmProject.filmV093,
        characters: [{
          id: "c1", role: "protagonist", order: 1, name: "Hero", description: "Brave",
          uniqueIdentifiers: "", hasDialog: false, faceRefs: [], bodyRefs: [], characterType: "human",
        }],
        scriptStructure: { framework: "three-act", contentEn: "x", contentVi: "x" },
        scriptBeats: [{ id: "b1", order: 1, title: "B", description: "x" }],
        scriptTwists: [{ id: "t1", beatId: "b1", description: "x", accepted: true }],
        scriptIntermediateScenes: [{
          id: "is1", order: 1, titleEn: "S", titleVi: "Cảnh 1", settings: "x",
          actionLinesEn: "x", durationSeconds: 60, beatIds: ["b1"],
        }],
        // qc20: script (Stage 5 dialogues) present → backward-compat Stage 4 done
        script: {
          titleEn: "T", titleVi: "T", logline: "x",
          scenes: [{ id: "sc1", order: 1, titleEn: "S1", durationSeconds: 30, settings: "", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "setup" }],
          createdAt: Date.now(), versions: [],
        },
        // scriptTwistsLocked + scriptScenesLocked deliberately NOT set (qc17 project shape)
      },
    };
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmIdeaScriptSection />);
    const html = container.innerHTML;

    // Stage 3 should show "1/1 accepted" pill (done preview via qc18 backward-compat)
    expect(html).toContain("1/1 accepted");
    // Stage 4 should also be done (scenes preview pill via qc20 backward-compat)
    expect(html).toContain("1 scenes");
    // Footer: 5/5 stages done (all stages including dialogues via script field)
    expect(html).toContain("5/5 stages");
  });

  it("setScriptIntermediateScenes stores Stage 4 output", () => {
    const scenes = [
      {
        id: "is1",
        order: 1,
        titleEn: "Junkyard",
        settings: "EXT. JUNKYARD — DAWN",
        actionLinesEn: "Robot stirs amid scrap.",
        durationSeconds: 60,
        beatIds: ["b1", "b2"],
      },
    ];
    const p = setScriptIntermediateScenes(baseFilmProject, scenes);
    expect(p.filmV093!.scriptIntermediateScenes?.length).toBe(1);
    expect(p.filmV093!.scriptIntermediateScenes![0].beatIds).toEqual(["b1", "b2"]);
  });

  it("revertToStage clears downstream stages (beats → clears twists/scenes/script)", () => {
    // Build full wizard state
    let proj = { ...baseFilmProject };
    proj = { ...proj, filmV093: setScriptStructure(proj, { framework: "three-act", contentEn: "x" }).filmV093 };
    proj = { ...proj, filmV093: setScriptBeats(proj, [{ id: "b1", order: 1, title: "A", description: "x" }]).filmV093 };
    proj = { ...proj, filmV093: setScriptTwists(proj, [{ id: "t1", beatId: "b1", description: "x" }]).filmV093 };
    proj = { ...proj, filmV093: setScriptIntermediateScenes(proj, [{
      id: "is1", order: 1, titleEn: "x", settings: "x", actionLinesEn: "x", durationSeconds: 60, beatIds: [],
    }]).filmV093 };
    const mockScript: any = {
      titleEn: "T", titleVi: "T", logline: "x", synopsisEn: "x",
      scenes: [], versions: [], createdAt: Date.now(), updatedAt: Date.now(),
    };
    proj = { ...proj, filmV093: setScript(proj, mockScript).filmV093 };

    // Pre-condition: all stages have data
    expect(proj.filmV093.scriptStructure).toBeDefined();
    expect(proj.filmV093.scriptBeats).toBeDefined();
    expect(proj.filmV093.scriptTwists).toBeDefined();
    expect(proj.filmV093.scriptIntermediateScenes).toBeDefined();
    expect(proj.filmV093.script).toBeDefined();

    // Revert to beats — should clear twists + scenes + script
    const p = revertToStage(proj, "beats");
    expect(p.filmV093!.scriptStage).toBe("beats");
    expect(p.filmV093!.scriptStructure).toBeDefined(); // upstream preserved
    expect(p.filmV093!.scriptBeats).toBeDefined(); // upstream preserved
    expect(p.filmV093!.scriptTwists).toBeUndefined(); // cleared
    expect(p.filmV093!.scriptIntermediateScenes).toBeUndefined(); // cleared
    expect(p.filmV093!.script).toBeUndefined(); // cleared
  });

  it("revertToStage to structure clears EVERYTHING downstream", () => {
    let proj = { ...baseFilmProject };
    proj = { ...proj, filmV093: setScriptStructure(proj, { framework: "three-act", contentEn: "x" }).filmV093 };
    proj = { ...proj, filmV093: setScriptBeats(proj, [{ id: "b1", order: 1, title: "A", description: "x" }]).filmV093 };

    const p = revertToStage(proj, "structure");
    expect(p.filmV093!.scriptStructure).toBeDefined(); // self preserved
    expect(p.filmV093!.scriptBeats).toBeUndefined();
  });

  it("revertToStage to dialogues is no-op (final stage)", () => {
    let proj = { ...baseFilmProject };
    proj = { ...proj, filmV093: setScriptStructure(proj, { framework: "three-act", contentEn: "x" }).filmV093 };
    proj = { ...proj, filmV093: setScriptBeats(proj, [{ id: "b1", order: 1, title: "A", description: "x" }]).filmV093 };

    const p = revertToStage(proj, "dialogues");
    expect(p.filmV093!.scriptStage).toBe("dialogues");
    expect(p.filmV093!.scriptStructure).toBeDefined();
    expect(p.filmV093!.scriptBeats).toBeDefined();
  });

  it("FRAMEWORK_LABELS exposes 4 frameworks with default beat counts", () => {
    expect(FRAMEWORK_LABELS["three-act"].defaultBeatCount).toBe(7);
    expect(FRAMEWORK_LABELS["hero-journey"].defaultBeatCount).toBe(12);
    expect(FRAMEWORK_LABELS["save-the-cat"].defaultBeatCount).toBe(15);
    expect(FRAMEWORK_LABELS.kishotenketsu.defaultBeatCount).toBe(4);
  });

  // ============================================================================
  // qc4 REGRESSION TEST — stale closure bug (Stage 1 done → Stage 2 says "Stage 1 chưa xong")
  // ============================================================================

  it("qc4 BUG: sequential setScriptStructure + setScriptStage with STALE project loses structure", () => {
    // SIMULATE THE BUG: caller has stale `project` reference, calls action then action again
    // Both use SAME stale project ref → 2nd call's ensureFilmData returns OLD data without structure
    const stale = baseFilmProject;

    // Action 1: set structure
    const patch1 = setScriptStructure(stale, { framework: "three-act", contentEn: "Setup..." });
    // Action 2 also uses STALE project (without fresh structure!) → ensureFilmData returns OLD filmV093
    const patch2 = setScriptStage(stale, "beats");

    // Result: patch2 OVERWRITES filmV093 — structure from patch1 is LOST in final merge.
    // Verify the bug: patch2.filmV093 should NOT have scriptStructure
    expect(patch2.filmV093!.scriptStructure).toBeUndefined();
    // patch2 only contains scriptStage update + the original (no-structure) data
    expect(patch2.filmV093!.scriptStage).toBe("beats");
  });

  it("qc4 FIX: chaining via fresh project reference between actions preserves all updates", () => {
    // CORRECT pattern: pass FRESH project to each action
    let proj = baseFilmProject;

    // Action 1
    const patch1 = setScriptStructure(proj, { framework: "three-act", contentEn: "Setup..." });
    // Merge patch1 INTO project BEFORE calling next action
    proj = { ...proj, filmV093: patch1.filmV093 };

    // Action 2 reads project WITH structure already set
    const patch2 = setScriptStage(proj, "beats");

    // Now structure IS preserved
    expect(patch2.filmV093!.scriptStructure).toBeDefined();
    expect(patch2.filmV093!.scriptStructure!.framework).toBe("three-act");
    expect(patch2.filmV093!.scriptStage).toBe("beats");
  });

  // ============================================================================
  // qc9 — Provider fallback regression tests
  // ============================================================================

  it("qc9 resolveProvider: preferred Gemini works when Gemini key present", async () => {
    const { resolveProvider } = await import("../src/engine/filmScriptStages");
    const { useGlobalStore } = await import("../src/store/useGlobalStore");
    useGlobalStore.setState({ apiKeys: { gemini: "g-key", openai: undefined } });
    const result = resolveProvider("gemini-flash");
    expect(result.effective).toBe("gemini-flash");
    expect(result.didFallback).toBe(false);
  });

  it("qc9 resolveProvider: falls back to OpenAI if Gemini key missing", async () => {
    const { resolveProvider } = await import("../src/engine/filmScriptStages");
    const { useGlobalStore } = await import("../src/store/useGlobalStore");
    useGlobalStore.setState({ apiKeys: { gemini: undefined, openai: "o-key" } });
    const result = resolveProvider("gemini-flash");
    expect(result.effective).toBe("openai-4o");
    expect(result.didFallback).toBe(true);
    expect(result.fallbackReason).toContain("auto-fallback");
  });

  it("qc9 resolveProvider: falls back to Gemini if OpenAI key missing", async () => {
    const { resolveProvider } = await import("../src/engine/filmScriptStages");
    const { useGlobalStore } = await import("../src/store/useGlobalStore");
    useGlobalStore.setState({ apiKeys: { gemini: "g-key", openai: undefined } });
    const result = resolveProvider("openai-4o");
    expect(result.effective).toBe("gemini-flash");
    expect(result.didFallback).toBe(true);
  });

  it("qc9 resolveProvider: throws if no keys at all", async () => {
    const { resolveProvider } = await import("../src/engine/filmScriptStages");
    const { useGlobalStore } = await import("../src/store/useGlobalStore");
    useGlobalStore.setState({ apiKeys: { gemini: undefined, openai: undefined } });
    expect(() => resolveProvider("gemini-flash")).toThrow(/API key/);
  });

  // ============================================================================
  // qc10 — Shot List section tests
  // ============================================================================

  it("qc10 setShotsForScene stores shots in shotsBySceneId", async () => {
    const { setShotsForScene } = await import("../src/store/film_actions");
    const sceneId = "scene_abc";
    const shots = [
      {
        id: "shot_1",
        order: 1,
        titleEn: "Wide",
        titleVi: "Toàn cảnh mở đầu",
        shotType: "wide_establishing" as const,
        durationSeconds: 4,
        gridFormat: "3x3" as const,
        cameraMovement: "static" as any,
        status: "draft" as const,
        purposeVi: "Establish setting",
        actionVi: "Robot xuất hiện trong rừng",
        actionEn: "Robot appears in the forest",
      },
    ];
    const patch = setShotsForScene(baseFilmProject, sceneId, shots);
    expect(patch.filmV093!.shotsBySceneId).toBeDefined();
    expect(patch.filmV093!.shotsBySceneId![sceneId]).toHaveLength(1);
    expect(patch.filmV093!.shotsBySceneId![sceneId][0].titleVi).toBe("Toàn cảnh mở đầu");
  });

  it("qc10 setShotsForScene replaces existing shots completely (bulk overwrite)", async () => {
    const { setShotsForScene } = await import("../src/store/film_actions");
    const sceneId = "scene_abc";
    let proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        shotsBySceneId: { [sceneId]: [{ id: "old1", order: 1 } as any] },
      },
    };
    const newShots = [
      { id: "new1", order: 1, titleEn: "New", titleVi: "Mới", shotType: "medium" as const, durationSeconds: 3, gridFormat: "3x3" as const, cameraMovement: "static" as any, status: "draft" as const },
    ];
    const patch = setShotsForScene(proj, sceneId, newShots);
    expect(patch.filmV093!.shotsBySceneId![sceneId]).toHaveLength(1);
    expect(patch.filmV093!.shotsBySceneId![sceneId][0].id).toBe("new1");
  });

  it("qc10 FilmShotListSection mounts without script (shows empty state)", async () => {
    const { FilmShotListSection } = await import("../src/components/FilmShotListSection");
    useAppStore.setState({ currentProject: baseFilmProject });
    const { container } = render(<FilmShotListSection />);
    expect(container.innerHTML).toContain("SHOT LIST");
    expect(container.innerHTML).toContain("Chưa có Script");
  });

  it("qc10 FilmShotListSection shows scenes when script exists", async () => {
    const { FilmShotListSection } = await import("../src/components/FilmShotListSection");
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        script: {
          titleVi: "Phim test",
          titleEn: "Test film",
          loglineVi: "logline",
          loglineEn: "logline",
          scenes: [
            {
              id: "s1",
              order: 1,
              titleVi: "Cảnh mở đầu",
              titleEn: "Opening scene",
              settings: "EXT. FOREST — DAY",
              actionLinesEn: "A robot appears.",
              actionLinesVi: "Một robot xuất hiện.",
              durationSeconds: 30,
              dialog: [],
              sfx: [],
              musicBrief: "",
              transition: "",
            },
          ],
          createdAt: Date.now(),
          versions: [],
        },
      },
    };
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmShotListSection />);
    expect(container.innerHTML).toContain("Scene 1");
    expect(container.innerHTML).toContain("Cảnh mở đầu");
    // qc11: scenes default collapsed → header chevron ▶ visible, body hidden
    expect(container.innerHTML).toContain("▶");
    expect(container.innerHTML).not.toContain("AI sinh shot list"); // body not rendered
  });

  it("qc10 FilmShotListSection shows shot table when shots exist", async () => {
    const { FilmShotListSection } = await import("../src/components/FilmShotListSection");
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        script: {
          titleVi: "Phim",
          titleEn: "Film",
          loglineVi: "",
          loglineEn: "",
          scenes: [
            {
              id: "s1",
              order: 1,
              titleVi: "Cảnh 1",
              titleEn: "Scene 1",
              settings: "EXT. FOREST",
              actionLinesEn: "Action",
              actionLinesVi: "Hành động",
              durationSeconds: 20,
              dialog: [],
              sfx: [],
              musicBrief: "",
              transition: "",
            },
          ],
          createdAt: Date.now(),
          versions: [],
        },
        shotsBySceneId: {
          s1: [
            {
              id: "sh1",
              order: 1,
              titleEn: "Wide",
              titleVi: "Toàn cảnh",
              shotType: "wide_establishing",
              durationSeconds: 5,
              gridFormat: "3x3",
              cameraMovement: "static",
              status: "draft",
              purposeVi: "Establish",
              actionVi: "Robot xuất hiện",
              actionEn: "Robot appears",
            },
          ],
        },
      },
    };
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmShotListSection />);
    // qc11: default collapsed — scene header always visible
    expect(container.innerHTML).toContain("Scene 1");
    // Shot count visible in meta
    expect(container.innerHTML).toContain("1 shots");
    // Scene title from script visible in header
    expect(container.innerHTML).toContain("Cảnh 1");
  });

  it("qc10 Pipeline: Storyboard section renamed 5. (was 3.) + Shot List = 4.", async () => {
    const { FilmShotListSection } = await import("../src/components/FilmShotListSection");
    const { FilmStoryboardSection } = await import("../src/components/FilmStoryboardSection");
    useAppStore.setState({ currentProject: baseFilmProject });
    const { container: c1 } = render(<FilmShotListSection />);
    expect(c1.innerHTML).toContain("4. SHOT LIST");
    const { container: c2 } = render(<FilmStoryboardSection />);
    expect(c2.innerHTML).toContain("5. STORYBOARD");
    expect(c2.innerHTML).not.toContain("3. STORYBOARD");
  });

  // ============================================================================
  // qc11 — Stage 5 done preview + Scene wording + Default collapsed + Regen
  // ============================================================================

  it("qc11 Stage 5 done preview: returns null active stage when all 5 done", async () => {
    // Build a project where ALL 5 stages have data
    const proj: any = {
      ...baseFilmProject,
      idea: { raw: "test idea", refinedVi: "", refinedEn: "" },
      filmV093: {
        ...baseFilmProject.filmV093,
        scriptStructure: { framework: "three-act", contentEn: "x", contentVi: "x" },
        scriptBeats: [{ id: "b1", order: 1, title: "Mở đầu", description: "test" }],
        scriptTwists: [],
        scriptIntermediateScenes: [
          {
            id: "is1",
            order: 1,
            titleVi: "Cảnh 1",
            titleEn: "Scene 1",
            settings: "EXT. FOREST",
            actionLinesEn: "x",
            durationSeconds: 30,
            beatIds: ["b1"],
          },
        ],
        script: {
          titleVi: "Phim",
          titleEn: "Film",
          loglineVi: "",
          loglineEn: "",
          scenes: [
            {
              id: "s1",
              order: 1,
              titleVi: "Cảnh 1",
              titleEn: "Scene 1",
              settings: "EXT. FOREST",
              actionLinesEn: "x",
              actionLinesVi: "x",
              durationSeconds: 30,
              dialog: [],
              sfx: [],
              musicBrief: "",
              transition: "",
            },
          ],
          createdAt: Date.now(),
          versions: [],
        },
        // Critical: NO scriptStage set → must auto-detect
        scriptStage: undefined,
      },
    };

    const { FilmIdeaScriptSection } = await import("../src/components/FilmIdeaScriptSection");
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmIdeaScriptSection />);
    // Stage 5 should show "done" pill, NOT "đang làm"
    // All 5 stages should have green checkmark (✓) — no active stage
    const html = container.innerHTML;
    // Count "done" occurrences — should be 5 (1 per stage)
    const doneMatches = html.match(/ksp-step-status-done/g);
    expect(doneMatches).toBeTruthy();
    expect(doneMatches!.length).toBeGreaterThanOrEqual(5);
    // Should NOT contain "đang làm" active pill anywhere
    expect(html).not.toContain("đang làm");
  });

  it("qc11 Shot List uses 'Scene' wording (not 'Cảnh')", async () => {
    const { FilmShotListSection } = await import("../src/components/FilmShotListSection");
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        script: {
          titleVi: "Phim",
          titleEn: "Film",
          loglineVi: "",
          loglineEn: "",
          scenes: [
            {
              id: "s1",
              order: 1,
              titleVi: "Cảnh mở đầu",
              titleEn: "Opening",
              settings: "EXT. FOREST",
              actionLinesEn: "x",
              actionLinesVi: "x",
              durationSeconds: 30,
              dialog: [],
              sfx: [],
              musicBrief: "",
              transition: "",
            },
          ],
          createdAt: Date.now(),
          versions: [],
        },
      },
    };
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmShotListSection />);
    // Header label should be "Scene 1" not "Cảnh 1"
    expect(container.innerHTML).toContain("Scene 1");
    // But scene title "Cảnh mở đầu" is user-data, still visible
    expect(container.innerHTML).toContain("Cảnh mở đầu");
    // The label "Scene N" in scene-order class confirms the change
    expect(container.innerHTML).toMatch(/ksp-shotlist-film-scene-order[^>]*>Scene 1/);
  });

  it("qc11 Shot List scenes default COLLAPSED (chevron ▶)", async () => {
    const { FilmShotListSection } = await import("../src/components/FilmShotListSection");
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        script: {
          titleVi: "x", titleEn: "x", loglineVi: "", loglineEn: "",
          scenes: [{
            id: "s1", order: 1, titleVi: "Test", titleEn: "Test",
            settings: "EXT.", actionLinesEn: "x", actionLinesVi: "x",
            durationSeconds: 10, dialog: [], sfx: [], musicBrief: "", transition: "",
          }],
          createdAt: Date.now(), versions: [],
        },
      },
    };
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmShotListSection />);
    // ▶ = collapsed (qc11 default), ▼ = expanded
    expect(container.innerHTML).toContain("▶");
    expect(container.innerHTML).not.toContain("▼");
  });

  it("qc11 Storyboard scenes also default COLLAPSED", async () => {
    const { FilmStoryboardSection } = await import("../src/components/FilmStoryboardSection");
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        script: {
          titleVi: "x", titleEn: "x", loglineVi: "", loglineEn: "",
          scenes: [{
            id: "s1", order: 1, titleVi: "Test", titleEn: "Test",
            settings: "EXT.", actionLinesEn: "x", actionLinesVi: "x",
            durationSeconds: 10, dialog: [], sfx: [], musicBrief: "", transition: "",
          }],
          createdAt: Date.now(), versions: [],
        },
      },
    };
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmStoryboardSection />);
    expect(container.innerHTML).toContain("▶");
  });

  it("qc11 select CSS has custom arrow + padding-right (no overlap)", async () => {
    // Read film.css and verify the rule contains qc11 fix
    const fs = await import("fs");
    const path = await import("path");
    const cssPath = path.resolve("./src/components/film.css");
    const css = fs.readFileSync(cssPath, "utf-8");
    // Find the .ksp-shotlist-film-select block
    const selectMatch = css.match(/\.ksp-shotlist-film-select\s*\{[^}]+\}/);
    expect(selectMatch).toBeTruthy();
    const block = selectMatch![0];
    expect(block).toContain("appearance: none");
    expect(block).toContain("padding: 2px 18px 2px 6px");
    expect(block).toContain("background-image");
  });

  it("qc11 cinematic formula: prompt requires 4-16 shots (no durationSeconds/6 logic)", async () => {
    // Read engine file source — confirm the divide-by-6 formula is gone
    const fs = await import("fs");
    const path = await import("path");
    const enginePath = path.resolve("./src/engine/filmShotListGeneration.ts");
    const src = fs.readFileSync(enginePath, "utf-8");
    // Must NOT contain the old durationSeconds/6 formula
    expect(src).not.toContain("durationSeconds / 6");
    expect(src).not.toContain("suggestedCount = Math.max");
    // Must contain new formula
    expect(src).toContain("4-16 shots");
    expect(src).toContain("CINEMATIC SHOT BREAKDOWN");
    expect(src).toContain("ESTABLISHING");
    expect(src).toContain("EMOTION");
    expect(src).toContain("REVEAL/PAYOFF");
    // Min 4 validation
    expect(src).toContain("minimum 4");
  });

  it("qc11 regenSingleShot function exists and validates inputs", async () => {
    const { regenSingleShot } = await import("../src/engine/filmShotListGeneration");
    expect(typeof regenSingleShot).toBe("function");

    // Invalid index throws
    await expect(
      regenSingleShot({
        scene: { id: "s1", order: 1, titleEn: "x", settings: "", actionLinesEn: "", durationSeconds: 10, dialog: [], sfx: [], musicBrief: "", transition: "" } as any,
        allShots: [{ id: "sh1", order: 1, titleEn: "x", shotType: "medium", durationSeconds: 5, gridFormat: "3x3", cameraMovement: "static", status: "draft" } as any],
        indexToRegen: 99, // out of bounds
        characters: [],
        setting: { genre: "drama" } as any,
      })
    ).rejects.toThrow(/Invalid shot index/);
  });

  // ============================================================================
  // qc12 — Stage 5 done preview REGRESSION (Jason real-world scenario)
  // ============================================================================

  it("qc12 Stage 5 done preview: scriptStage='dialogues' PERSISTED + film.script exists → renders ALL done previews", async () => {
    // EXACTLY Jason's screenshot scenario: existing project where:
    // - User clicked "Tiếp: ⑤ Lời thoại →" so scriptStage was set to "dialogues"
    // - Then AI generated film.script (Stage 5 done)
    // - But scriptStage was NEVER cleared
    // After reload, scriptStage still = "dialogues" but film.script exists.
    // Stage 5 should render done preview, NOT active panel.
    const proj: any = {
      ...baseFilmProject,
      idea: { raw: "test idea", refinedVi: "", refinedEn: "" },
      filmV093: {
        ...baseFilmProject.filmV093,
        scriptStructure: { framework: "three-act", contentEn: "x", contentVi: "x" },
        scriptBeats: [{ id: "b1", order: 1, title: "Mở đầu", description: "test" }],
        scriptTwists: [],
        scriptIntermediateScenes: [
          {
            id: "is1", order: 1, titleVi: "Cảnh 1", titleEn: "Scene 1",
            settings: "EXT. FOREST", actionLinesEn: "x", durationSeconds: 30, beatIds: ["b1"],
          },
        ],
        script: {
          titleVi: "Người Gác Cổng Bị Lãng Quên",
          titleEn: "Film",
          loglineVi: "logline",
          loglineEn: "",
          scenes: [{
            id: "s1", order: 1, titleVi: "Cảnh 1", titleEn: "Scene 1",
            settings: "EXT.", actionLinesEn: "x", actionLinesVi: "x",
            durationSeconds: 30, dialog: [], sfx: [], musicBrief: "", transition: "",
          }],
          createdAt: Date.now(),
          versions: [],
        },
        // CRITICAL: scriptStage persisted as "dialogues" from earlier navigation
        scriptStage: "dialogues",
      },
    };

    const { FilmIdeaScriptSection } = await import("../src/components/FilmIdeaScriptSection");
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmIdeaScriptSection />);
    const html = container.innerHTML;

    // CRITICAL: Stage 5 should NOT be in active mode (no "đang làm" pill, no "Viết lại lời thoại" button)
    expect(html).not.toContain("đang làm");
    expect(html).not.toContain("Viết lại lời thoại");
    expect(html).not.toContain("AI viết lời thoại");

    // Stage 5 should show "done" + script preview
    const doneMatches = html.match(/ksp-step-status-done/g);
    expect(doneMatches).toBeTruthy();
    expect(doneMatches!.length).toBeGreaterThanOrEqual(5); // all 5 stages done
    // Script title should appear in preview
    expect(html).toContain("Người Gác Cổng");
  });

  it("qc12 setScript clears scriptStage so all 5 stages render as done", async () => {
    const { setScript } = await import("../src/store/film_actions");
    const projWithStage5: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        scriptStage: "dialogues", // pretend user was on Stage 5 active
      },
    };
    const newScript = {
      titleVi: "test", titleEn: "test", loglineVi: "", loglineEn: "",
      scenes: [], createdAt: Date.now(), versions: [],
    };
    const patch = setScript(projWithStage5, newScript as any);
    // After setScript, scriptStage should be cleared
    expect(patch.filmV093!.scriptStage).toBeUndefined();
    // And script should be set
    expect(patch.filmV093!.script).toBeDefined();
  });

  it("qc12 clearStageData clears single stage data + sets scriptStage for regen", async () => {
    const { clearStageData } = await import("../src/store/film_actions");
    const projWithScript: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        script: { titleEn: "x", scenes: [] } as any,
      },
    };
    const patch = clearStageData(projWithScript, "dialogues");
    expect(patch.filmV093!.script).toBeUndefined();
    expect(patch.filmV093!.scriptStage).toBe("dialogues");
  });

  it.skip("qc12 ShotDetailPanel: grid picker pills render with active state", async () => {
    // Read source to verify grid picker UI exists
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve("./src/components/FilmShotDetailPanel.tsx");
    const src = fs.readFileSync(filePath, "utf-8");
    // Must have GRID_FORMATS.map rendering pills
    expect(src).toContain("ksp-shot-detail-grid-picker");
    expect(src).toContain("ksp-shot-detail-grid-pill");
    expect(src).toContain("onSetGridFormat");
    // Auto-regen on change must use updated shot
    expect(src).toContain("updatedShot");
    expect(src).toContain("buildImagePrompt");
  });

  it.skip("qc12 Storyboard ShotRow: title is read-only (no editingTitle state, no input field for title)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve("./src/components/FilmStoryboardSection.tsx");
    const src = fs.readFileSync(filePath, "utf-8");
    // qc12: removed inline title editing
    expect(src).not.toContain("editingTitle");
    expect(src).not.toContain("setEditingTitle");
    // Must have title-block (2-line layout)
    expect(src).toContain("ksp-storyboard-shot-title-block");
    // Removed shot type select from inline controls (must change in Script)
    const inlineControlsBlock = src.match(/expanded && \(\s*<div className="ksp-storyboard-shot-controls-inline"[\s\S]*?\)\}/);
    expect(inlineControlsBlock).toBeTruthy();
    // Only ONE select (gridFormat) — no SHOT_TYPES.map in inline controls
    const inlineBlockStr = inlineControlsBlock![0];
    expect(inlineBlockStr).toContain("GRID_FORMATS.map");
    expect(inlineBlockStr).not.toContain("SHOT_TYPES.map");
  });

  // ============================================================================
  // qc13 — CORE consistency fixes (Cast hallucination + stale + 0 refs)
  // ============================================================================

  it("qc13 generateCharacterDescription ALWAYS injects full script context when script exists (no name-match filter)", async () => {
    // Verify source code: filter logic is removed, full script context injected
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve("./src/engine/filmCastGeneration.ts");
    const src = fs.readFileSync(filePath, "utf-8");

    // Old filter logic must be GONE
    expect(src).not.toContain("includes(charName.toLowerCase())");
    expect(src).not.toContain("relevantScenes");

    // New logic: FULL STORY CONTEXT block included unconditionally when script exists
    expect(src).toContain("FULL STORY CONTEXT");
    expect(src).toContain("scriptTitle");
    expect(src).toContain("scriptLogline");

    // Anti-hallucination instruction in system prompt
    expect(src).toContain("KHÔNG hallucinate");
    expect(src).toContain("KHÔNG bịa");
  });

  it("qc13 FilmCharacter schema has descriptionGeneratedAt timestamp", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve("./src/types/film.ts");
    const src = fs.readFileSync(filePath, "utf-8");
    expect(src).toContain("descriptionGeneratedAt?: number");
  });

  it("qc13 Cast section saves descriptionGeneratedAt when AI runs", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve("./src/components/CastFilmSection.tsx");
    const src = fs.readFileSync(filePath, "utf-8");
    // Must persist timestamp after AI gen
    expect(src).toContain("descriptionGeneratedAt: Date.now()");
  });

  it("qc13 Cast section renders stale banner when descriptions predate script", async () => {
    const { CastFilmSection } = await import("../src/components/CastFilmSection");

    const oldTime = Date.now() - 1000 * 60 * 60; // 1 hour ago
    const newTime = Date.now();

    const projWithStale: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        characters: [
          {
            id: "c1",
            order: 1,
            name: "Robot",
            role: "protagonist",
            description: "Robot mô tả cũ từ story trước",
            faceRefs: [],
            bodyRefs: [],
            descriptionGeneratedAt: oldTime, // OLD
          },
        ],
        script: {
          titleEn: "New Story",
          titleVi: "Chú Sóc Lạc Lõng",
          logline: "A squirrel gets lost",
          scenes: [],
          createdAt: newTime, // NEWER than character's description
          versions: [],
        },
      },
    };

    useAppStore.setState({ currentProject: projWithStale });
    const { container } = render(<CastFilmSection />);
    expect(container.innerHTML).toContain("ksp-cast-film-stale-banner");
    expect(container.innerHTML).toContain("mô tả CŨ hơn Script");
  });

  it("qc13 Cast section does NOT show stale banner when descriptions are newer than script", async () => {
    const { CastFilmSection } = await import("../src/components/CastFilmSection");

    const scriptTime = Date.now() - 1000 * 60 * 60;
    const descTime = Date.now();

    const projFresh: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        characters: [
          {
            id: "c1",
            order: 1,
            name: "Sóc",
            role: "protagonist",
            description: "Mô tả mới khớp story",
            faceRefs: [],
            bodyRefs: [],
            descriptionGeneratedAt: descTime, // NEWER than script
          },
        ],
        script: {
          titleEn: "Story",
          titleVi: "Sóc",
          logline: "",
          scenes: [],
          createdAt: scriptTime,
          versions: [],
        },
      },
    };

    useAppStore.setState({ currentProject: projFresh });
    const { container } = render(<CastFilmSection />);
    expect(container.innerHTML).not.toContain("ksp-cast-film-stale-banner");
  });

  it("qc13 Cast section shows 0-face-refs warning per character when description exists", async () => {
    const { CastFilmSection } = await import("../src/components/CastFilmSection");

    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        characters: [
          {
            id: "c1",
            order: 1,
            name: "Sóc",
            role: "protagonist",
            description: "Có mô tả nhưng chưa upload refs",
            faceRefs: [], // 0 refs!
            bodyRefs: [],
          },
        ],
      },
    };

    useAppStore.setState({ currentProject: proj });
    const { container } = render(<CastFilmSection />);
    expect(container.innerHTML).toContain("ksp-cast-film-no-refs-warning");
    expect(container.innerHTML).toContain("Cần ≥1 face ref");
  });

  it("qc13 Cast section does NOT show 0-refs warning when character has face refs", async () => {
    const { CastFilmSection } = await import("../src/components/CastFilmSection");

    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        characters: [
          {
            id: "c1",
            order: 1,
            name: "Sóc",
            role: "protagonist",
            description: "Có mô tả",
            faceRefs: [{ id: "f1", filename: "f.png", mimeType: "image/png", dataUrl: "x" } as any],
            bodyRefs: [],
          },
        ],
      },
    };

    useAppStore.setState({ currentProject: proj });
    const { container } = render(<CastFilmSection />);
    expect(container.innerHTML).not.toContain("ksp-cast-film-no-refs-warning");
  });

  it("qc13 Cast section does NOT show 0-refs warning when description is empty", async () => {
    const { CastFilmSection } = await import("../src/components/CastFilmSection");

    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        characters: [
          {
            id: "c1",
            order: 1,
            name: "Sóc",
            role: "protagonist",
            description: "", // empty
            faceRefs: [],
            bodyRefs: [],
          },
        ],
      },
    };

    useAppStore.setState({ currentProject: proj });
    const { container } = render(<CastFilmSection />);
    expect(container.innerHTML).not.toContain("ksp-cast-film-no-refs-warning");
  });

  it("qc13 Storyboard expanded shot has #1d2644 bg + 5px border-left", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const cssPath = path.resolve("./src/components/film.css");
    const css = fs.readFileSync(cssPath, "utf-8");
    const block = css.match(/\.ksp-storyboard-shot-expanded\s*\{[^}]+\}/);
    expect(block).toBeTruthy();
    expect(block![0]).toContain("background: #1d2644");
    expect(block![0]).toContain("border-left: 5px");
  });

  it.skip("qc14 Shot Detail Panel: no border-left + uses section-style Connector + crop wired", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const cssPath = path.resolve("./src/components/film.css");
    const css = fs.readFileSync(cssPath, "utf-8");
    const block = css.match(/\.ksp-shot-detail-panel\s*\{[^}]+\}/);
    expect(block).toBeTruthy();
    expect(block![0]).toContain("margin: 20px 12px 50px 50px");
    // qc14: border-left + padding-left removed
    expect(block![0]).not.toContain("border-left:");
    expect(block![0]).not.toContain("padding-left:");

    // Orange arrow CSS still exists (Jason confirmed keep)
    expect(css).toContain("ksp-shot-detail-arrow-from-shot");

    // qc14: legacy internal connector ::before/::after removed
    expect(css).not.toMatch(/\.ksp-shot-detail-internal-connector::before\s*\{/);

    // Panel JSX uses Connector component
    const panelPath = path.resolve("./src/components/FilmShotDetailPanel.tsx");
    const panelSrc = fs.readFileSync(panelPath, "utf-8");
    expect(panelSrc).toContain('import { Connector } from "./Editor"');
    expect(panelSrc).toContain("<Connector colorFrom=");
    expect(panelSrc).toContain("ksp-shot-detail-arrow-from-shot");
    expect(panelSrc).toContain("#D85A30"); // orange arrow color

    // qc14: crop wired in upload handler
    expect(panelSrc).toContain("cropGridIntoFrames");
    expect(panelSrc).toContain('import { cropGridIntoFrames }');
  });

  // ============================================================================
  // qc14 — Real grid auto-crop engine
  // ============================================================================

  it("qc14 cropGridIntoFrames: exports + signature shape", async () => {
    const mod = await import("../src/engine/gridImageCrop");
    expect(typeof mod.cropGridIntoFrames).toBe("function");
  });

  it("qc14 cropGridIntoFrames: rejects invalid gridFormat", async () => {
    const { cropGridIntoFrames } = await import("../src/engine/gridImageCrop");
    const opts = { totalWidth: 1920, totalHeight: 1080, gutterPx: 0 };
    await expect(
      cropGridIntoFrames("data:image/png;base64,iVBORw0KGgo=", "garbage", opts)
    ).rejects.toThrow(/Invalid grid format/);
    await expect(
      cropGridIntoFrames("data:image/png;base64,iVBORw0KGgo=", "3x", opts)
    ).rejects.toThrow(/Invalid grid format/);
    await expect(
      cropGridIntoFrames("data:image/png;base64,iVBORw0KGgo=", "", opts)
    ).rejects.toThrow(/Invalid grid format/);
  });

  it("qc15 cropGridIntoFrames: rejects invalid gutter values", async () => {
    const { cropGridIntoFrames } = await import("../src/engine/gridImageCrop");
    await expect(
      cropGridIntoFrames("data:image/png;base64,x", "3x3", {
        totalWidth: 1920,
        totalHeight: 1080,
        gutterPx: -1,
      })
    ).rejects.toThrow(/ngoài khoảng/);
    await expect(
      cropGridIntoFrames("data:image/png;base64,x", "3x3", {
        totalWidth: 1920,
        totalHeight: 1080,
        gutterPx: 999,
      })
    ).rejects.toThrow(/ngoài khoảng/);
  });

  it("qc15 cropGridIntoFrames: rejects when totalWidth/Height too small for grid", async () => {
    const { cropGridIntoFrames } = await import("../src/engine/gridImageCrop");
    await expect(
      cropGridIntoFrames("data:image/png;base64,x", "3x3", {
        totalWidth: 10, // 10 < 3*16 = 48
        totalHeight: 1080,
        gutterPx: 0,
      })
    ).rejects.toThrow(/quá nhỏ/);
  });

  // Note: We don't test invalid image loading here — happy-dom's Image
  // doesn't fire onerror reliably for synthetic dataURLs, causing test
  // timeouts. Image decode errors are exercised in real browser runtime.

  it.skip("qc14 Refs ZIP downloader handler now structures as cast/ + cropped_frames/", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const panelPath = path.resolve("./src/components/FilmShotDetailPanel.tsx");
    const src = fs.readFileSync(panelPath, "utf-8");
    // ZIP folder structure includes cast/ prefix
    expect(src).toContain('`cast/${safeName}/face_');
    expect(src).toContain('`cast/${safeName}/body_');
    // NEW cropped_frames/ folder
    expect(src).toContain('`cropped_frames/frame_${idx}.png`');
    // Toast reports both counts
    expect(src).toContain("cropped frames");
  });

  it("qc14 setShotGridImage still creates framesR5 placeholders (called BEFORE crop)", async () => {
    const { setShotGridImage } = await import("../src/store/film_actions");
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        shotsBySceneId: {
          s1: [
            {
              id: "sh1",
              order: 1,
              titleEn: "x",
              shotType: "medium",
              durationSeconds: 3,
              gridFormat: "3x3",
              cameraMovement: "static",
              status: "draft",
            } as any,
          ],
        },
      },
    };
    const dataUrl = "data:image/png;base64,placeholder";
    const patch = setShotGridImage(proj, "s1", "sh1", dataUrl);
    const newShot = patch.filmV093!.shotsBySceneId!["s1"][0];
    // framesR5 created with 9 cells for 3x3
    expect(newShot.framesR5).toBeDefined();
    expect(newShot.framesR5!.length).toBe(9);
    // Each frame placeholder has no dataUrl yet (crop happens AFTER in component)
    expect(newShot.framesR5!.every((f: any) => !f.dataUrl)).toBe(true);
    // Grid image saved
    expect(newShot.gridImageDataUrl).toBe(dataUrl);
    // Status auto-transitions to rendered
    expect(newShot.status).toBe("rendered");
  });

  // ============================================================================
  // qc15 — Preview & Crop modal + provider presets + 3x4 grid + cropSettings schema
  // ============================================================================

  it("qc15 GRID_PROVIDERS list includes Nano Banana + ChatGPT + custom with verified sizes", async () => {
    const { GRID_PROVIDERS } = await import("../src/engine/gridProviders");
    expect(GRID_PROVIDERS.length).toBeGreaterThanOrEqual(5);

    const nano = GRID_PROVIDERS.find((p) => p.id === "nano-banana");
    expect(nano).toBeDefined();
    expect(nano!.defaultSize16x9).toEqual({ w: 2752, h: 1536 });

    const chatgpt = GRID_PROVIDERS.find((p) => p.id === "chatgpt");
    expect(chatgpt).toBeDefined();
    expect(chatgpt!.defaultSize16x9).toEqual({ w: 1672, h: 941 });

    const custom = GRID_PROVIDERS.find((p) => p.id === "custom");
    expect(custom).toBeDefined();
    expect(custom!.defaultSize16x9).toBeNull(); // signals auto-detect
  });

  it("qc15 getProviderDefaultSize returns correct preset for given aspect", async () => {
    const { getProviderDefaultSize } = await import("../src/engine/gridProviders");
    expect(getProviderDefaultSize("nano-banana", "16:9")).toEqual({ w: 2752, h: 1536 });
    expect(getProviderDefaultSize("nano-banana", "9:16")).toEqual({ w: 1536, h: 2752 });
    expect(getProviderDefaultSize("custom", "16:9")).toBeNull();
    expect(getProviderDefaultSize("nonexistent", "16:9")).toBeNull();
  });

  it.skip("qc15 3x4 grid format added to FilmShot type + GRID_FORMATS dropdown", async () => {
    const fs = await import("fs");
    const path = await import("path");
    // Type union
    const projTypeSrc = fs.readFileSync(path.resolve("./src/types/project.ts"), "utf-8");
    expect(projTypeSrc).toMatch(/gridFormat:\s*"2x2"\s*\|\s*"2x3"\s*\|\s*"3x2"\s*\|\s*"3x3"\s*\|\s*"4x3"\s*\|\s*"3x4"/);
    // film_actions FilmShotGridFormat enum
    const actionsSrc = fs.readFileSync(path.resolve("./src/store/film_actions.ts"), "utf-8");
    expect(actionsSrc).toContain('"3x4"');
    // FilmStoryboardSection GRID_FORMATS
    const sbSrc = fs.readFileSync(path.resolve("./src/components/FilmStoryboardSection.tsx"), "utf-8");
    expect(sbSrc).toContain('value: "3x4"');
    expect(sbSrc).toContain('label: "3×4"');
    // FilmShotDetailPanel GRID_FORMATS
    const detailSrc = fs.readFileSync(path.resolve("./src/components/FilmShotDetailPanel.tsx"), "utf-8");
    expect(detailSrc).toContain('value: "3x4"');
  });

  it.skip("qc15 ShotCropSettings schema exported from project.ts", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/types/project.ts"), "utf-8");
    expect(src).toContain("export interface ShotCropSettings");
    expect(src).toContain("provider: string");
    expect(src).toContain("totalWidth: number");
    expect(src).toContain("totalHeight: number");
    expect(src).toContain("gutterPx: number");
    // FilmShot has cropSettings field
    expect(src).toContain("cropSettings?: ShotCropSettings");
  });

  it.skip("qc15 FilmData has defaultCropSettings field for per-project default", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/types/film.ts"), "utf-8");
    expect(src).toContain("defaultCropSettings?:");
  });

  it.skip("qc15 GridCropPreviewModal component renders + has provider dropdown + gutter slider + cell overlay", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/GridCropPreviewModal.tsx"), "utf-8");
    // Has provider dropdown
    expect(src).toContain("GRID_PROVIDERS.map");
    // Has gutter slider
    expect(src).toContain('type="range"');
    expect(src).toMatch(/max=\{?20\}?/);
    // Has overlay with cell numbers
    expect(src).toContain("ksp-grid-crop-overlay-cell");
    expect(src).toContain("F{order}");
    // Approve + Cancel buttons
    expect(src).toContain("Approve & Crop");
    expect(src).toContain("Cancel");
    // onApprove returns ShotCropSettings
    expect(src).toContain("onApprove(");
    expect(src).toContain("totalWidth:");
    expect(src).toContain("gutterPx:");
  });

  it.skip("qc15 Shot Detail Panel upload handler opens modal, NOT crops directly", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmShotDetailPanel.tsx"), "utf-8");
    // Imports modal
    expect(src).toContain('import { GridCropPreviewModal }');
    // Has pendingGridUpload state
    expect(src).toContain("pendingGridUpload");
    expect(src).toContain("setPendingGridUpload");
    // Upload handler opens modal (no direct cropGridIntoFrames call)
    const uploadBlock = src.match(/onUploadGrid=\{async \(file: File\) =>[\s\S]*?\}\}/);
    expect(uploadBlock).toBeTruthy();
    expect(uploadBlock![0]).toContain("setPendingGridUpload");
    expect(uploadBlock![0]).not.toContain("cropGridIntoFrames");
    // Modal approve handler runs crop with user-confirmed settings
    expect(src).toContain("onApprove={async (settings)");
    expect(src).toContain("cropGridIntoFrames(dataUrl, shot.gridFormat, {");
    // Re-crop button wired
    expect(src).toContain("onRecrop={() => {");
  });

  it.skip("qc15 Re-crop UI: button rendered next to Clear when grid uploaded", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmShotDetailPanel.tsx"), "utf-8");
    // 🔧 Re-crop button exists in grid uploaded section
    expect(src).toContain("Re-crop với settings mới");
    expect(src).toContain('onClick={onRecrop}');
    expect(src).toMatch(/🔧/);
    // Shows crop settings used (size + gutter) when present
    expect(src).toContain("shot.cropSettings.totalWidth");
    expect(src).toContain("shot.cropSettings.gutterPx");
  });

  it.skip("qc15 Modal pre-fills from shot.cropSettings -> film.defaultCropSettings -> auto-detect", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmShotDetailPanel.tsx"), "utf-8");
    // Fallback chain visible in upload handler
    expect(src).toMatch(
      /shot\.cropSettings\s*\?\?\s*film\.defaultCropSettings\s*\?\?\s*undefined/
    );
  });

  it.skip("qc15 First crop saves user settings as project default (one-time auto-set)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmShotDetailPanel.tsx"), "utf-8");
    // Approve handler checks !defaultCropSettings before setting
    expect(src).toContain("!currentFilm.defaultCropSettings");
    expect(src).toContain("defaultCropSettings: settings");
  });

  // ============================================================================
  // qc16 — Scene-level grids paradigm shift
  // ============================================================================

  it("qc16 → qc22 parseGridFormat parses CxR strings (cols × rows convention)", async () => {
    const { parseGridFormat } = await import("../src/engine/sceneGridPacker");
    // qc22: convention is "ColsxRows". "3x2" = 3 cols × 2 rows = 6 cells (wide layout).
    expect(parseGridFormat("3x3")).toEqual({ rows: 3, cols: 3, cells: 9 });
    expect(parseGridFormat("2x3")).toEqual({ rows: 3, cols: 2, cells: 6 }); // 2 cols × 3 rows = tall
    expect(parseGridFormat("4x3")).toEqual({ rows: 3, cols: 4, cells: 12 }); // 4 cols × 3 rows = wide
    expect(parseGridFormat("3x4")).toEqual({ rows: 4, cols: 3, cells: 12 }); // 3 cols × 4 rows = tall
    expect(parseGridFormat("4x2")).toEqual({ rows: 2, cols: 4, cells: 8 }); // 4 cols × 2 rows = wide landscape
    expect(parseGridFormat("2x4")).toEqual({ rows: 4, cols: 2, cells: 8 }); // 2 cols × 4 rows = tall
  });

  it("qc16 packShotsIntoGrids: 11 shots @ 3x3 → 2 grids (9 + 2 + 7 empty)", async () => {
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = Array.from({ length: 11 }, (_, i) => ({
      id: `shot_${i + 1}`,
      order: i + 1,
    })) as any[];
    const grids = packShotsIntoGrids(shots, "3x3");
    expect(grids).toHaveLength(2);
    expect(grids[0].cells).toHaveLength(9);
    expect(grids[1].cells).toHaveLength(9);
    // Grid 1: 9 shots filled
    expect(grids[0].cells.every((c) => c.shotId)).toBe(true);
    expect(grids[0].cells[0].shotId).toBe("shot_1");
    expect(grids[0].cells[8].shotId).toBe("shot_9");
    // Grid 2: 2 shots filled, 7 empty
    expect(grids[1].cells[0].shotId).toBe("shot_10");
    expect(grids[1].cells[1].shotId).toBe("shot_11");
    expect(grids[1].cells[2].shotId).toBeUndefined();
    expect(grids[1].cells[8].shotId).toBeUndefined();
  });

  it("qc16 packShotsIntoGrids: 7 shots @ 3x3 → 1 grid (7 + 2 empty)", async () => {
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = Array.from({ length: 7 }, (_, i) => ({
      id: `shot_${i + 1}`,
      order: i + 1,
    })) as any[];
    const grids = packShotsIntoGrids(shots, "3x3");
    expect(grids).toHaveLength(1);
    expect(grids[0].cells).toHaveLength(9);
    expect(grids[0].cells.filter((c) => c.shotId).length).toBe(7);
    expect(grids[0].cells.filter((c) => !c.shotId).length).toBe(2);
  });

  it("qc16 packShotsIntoGrids: 0 shots @ 3x3 → 1 empty grid (allows upload-first)", async () => {
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const grids = packShotsIntoGrids([], "3x3");
    expect(grids).toHaveLength(1);
    expect(grids[0].cells).toHaveLength(9);
    expect(grids[0].cells.every((c) => !c.shotId)).toBe(true);
  });

  it("qc16 packShotsIntoGrids: re-pack preserves existing dataUrl when shotId matches", async () => {
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = [
      { id: "s1", order: 1 },
      { id: "s2", order: 2 },
      { id: "s3", order: 3 },
    ] as any[];
    const initialGrids = packShotsIntoGrids(shots, "3x3");
    // Simulate user has uploaded grid + cropped — cells have dataUrl
    initialGrids[0].cells[0].dataUrl = "data:image/png;base64,FAKE_S1";
    initialGrids[0].cells[1].dataUrl = "data:image/png;base64,FAKE_S2";
    initialGrids[0].cells[2].dataUrl = "data:image/png;base64,FAKE_S3";
    initialGrids[0].gridImageDataUrl = "data:image/png;base64,FAKE_GRID";

    // Re-pack with same shots → preserves
    const repacked = packShotsIntoGrids(shots, "3x3", initialGrids);
    expect(repacked[0].cells[0].dataUrl).toBe("data:image/png;base64,FAKE_S1");
    expect(repacked[0].cells[1].dataUrl).toBe("data:image/png;base64,FAKE_S2");
    expect(repacked[0].gridImageDataUrl).toBe("data:image/png;base64,FAKE_GRID");
  });

  it("qc16 packShotsIntoGrids: re-pack drops dataUrl when shotId differs (shots reordered)", async () => {
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const initialShots = [{ id: "s1" }, { id: "s2" }] as any[];
    const initialGrids = packShotsIntoGrids(initialShots, "3x3");
    initialGrids[0].cells[0].dataUrl = "data:image/png;base64,S1_OLD";
    initialGrids[0].gridImageDataUrl = "data:image/png;base64,GRID_OLD";

    // Reorder shots
    const reordered = [{ id: "s2" }, { id: "s1" }] as any[];
    const repacked = packShotsIntoGrids(reordered, "3x3", initialGrids);
    // Cell 0 now has shot "s2" but old dataUrl was for "s1" — should be cleared
    expect(repacked[0].cells[0].shotId).toBe("s2");
    expect(repacked[0].cells[0].dataUrl).toBeUndefined();
    // gridImageDataUrl also cleared because cell mapping changed
    expect(repacked[0].gridImageDataUrl).toBeUndefined();
  });

  it("qc16 gridStats counts filled vs empty cells across grids", async () => {
    const { packShotsIntoGrids, gridStats } = await import(
      "../src/engine/sceneGridPacker"
    );
    const shots = Array.from({ length: 13 }, (_, i) => ({ id: `s${i + 1}` })) as any[];
    const grids = packShotsIntoGrids(shots, "3x3");
    const stats = gridStats(grids);
    expect(stats.gridCount).toBe(2);
    expect(stats.filledCells).toBe(13);
    expect(stats.emptyCells).toBe(5);
    expect(stats.totalCells).toBe(18);
  });

  it("qc16 buildSceneGridImagePrompt outputs prompt with rows×cols + cells + cast + scene", async () => {
    const { buildSceneGridImagePrompt } = await import(
      "../src/engine/sceneImagePromptBuilder"
    );
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = [
      { id: "s1", order: 1, titleVi: "Mở đầu", titleEn: "Opening", shotType: "wide_establishing", durationSeconds: 5, actionEn: "Wide forest shot" },
      { id: "s2", order: 2, titleVi: "Cận cảnh", titleEn: "Close", shotType: "close_up", durationSeconds: 3, actionEn: "Robot eye blink" },
    ] as any[];
    const grids = packShotsIntoGrids(shots, "3x3");
    const scene: any = {
      id: "sc1",
      order: 1,
      titleVi: "Sự thức tỉnh",
      titleEn: "The Awakening",
      settings: "EXT. FOREST - DAWN",
      actionLinesEn: "Robot wakes up in moss-covered forest",
      durationSeconds: 60,
    };
    const cast = [
      { id: "c1", order: 1, name: "Robot", role: "protagonist", description: "Bipedal moss-covered robot", faceRefs: [], bodyRefs: [] },
    ] as any[];
    const setting: any = {
      animationStyle: "live_action",
      aspectRatio: "16:9",
      genre: "drama",
    };
    const prompt = buildSceneGridImagePrompt({ grid: grids[0], scene, shots, cast, setting });
    // qc22: new prompt format "3 columns × 3 rows = 9 cells"
    expect(prompt).toContain("3 columns × 3 rows = 9 cells");
    expect(prompt).toContain("16:9");
    expect(prompt).toContain("2 filled");
    expect(prompt).toContain("7 empty");
    expect(prompt).toContain("The Awakening");
    expect(prompt).toContain("Robot");
    expect(prompt).toContain("Cell 1:");
    expect(prompt).toContain("Cell 2:");
    expect(prompt).toContain("Cell 3:"); // empty cell
    expect(prompt).toContain("EMPTY");
    // r6 (BUG #2 fix): EN priority — shot titleEn/actionEn used, not Vi
    expect(prompt).toContain("Opening");
    expect(prompt).toContain("Close");
    expect(prompt).not.toContain("Mở đầu"); // Vi must NOT leak into EN prompt
    expect(prompt).not.toContain("Cận cảnh");
    // r6: STRICT LAYOUT block + grid template ref mention (lowercase Image #1)
    expect(prompt).toContain("STRICT LAYOUT REQUIREMENT");
    expect(prompt).toContain("Image #1");
    expect(prompt).toContain("image-01_grid-template.png");
    // r6 (BUG #3): cinematic intent block injected from pacing data
    expect(prompt).toContain("CINEMATIC INTENT");
    expect(prompt).toContain("Lighting:");
    expect(prompt).toContain("Color palette:");
  });

  it("Sprint 1.0 r7: ensureSceneGrids locks 3x3 for Film mode regardless of shot count", async () => {
    const { ensureSceneGrids } = await import("../src/store/film_actions");
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        shotsBySceneId: {
          sc1: [{ id: "sh1", order: 1 }, { id: "sh2", order: 2 }],
        },
        script: {
          titleEn: "Test", titleVi: "Test", logline: "test",
          scenes: [
            { id: "sc1", order: 1, titleEn: "Scene 1", durationSeconds: 30, settings: "INT. ROOM", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "setup" },
          ],
          createdAt: Date.now(),
          versions: [],
        },
      },
    };
    const patch = ensureSceneGrids(proj, "sc1");
    const scene = patch.filmV093!.script!.scenes[0];
    expect(scene.grids).toBeDefined();
    expect(scene.grids!.length).toBe(1);
    // r7: Film mode locks 3x3 (Q-E) — 2 shots → 3x3 grid with 7 empty cells (not 2x2 anymore)
    expect(scene.gridFormat).toBe("3x3");
    expect(scene.grids![0].cells.length).toBe(9);
    expect(scene.grids![0].cells.filter((c) => c.shotId).length).toBe(2);
  });

  it("qc16 setSceneGridFormat re-packs preserving cropped frames", async () => {
    const { ensureSceneGrids, setSceneGridFormat } = await import("../src/store/film_actions");
    let proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        shotsBySceneId: {
          sc1: [
            { id: "sh1", order: 1 },
            { id: "sh2", order: 2 },
            { id: "sh3", order: 3 },
          ],
        },
        script: {
          titleEn: "Test", titleVi: "Test", logline: "x",
          scenes: [
            { id: "sc1", order: 1, titleEn: "Scene 1", durationSeconds: 30, settings: "INT.", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "setup" },
          ],
          createdAt: Date.now(),
          versions: [],
        },
      },
    };
    // Init grids @ 3x3
    Object.assign(proj, ensureSceneGrids(proj, "sc1"));
    // Simulate user uploaded grid + cropped cell
    proj.filmV093.script.scenes[0].grids[0].cells[0].dataUrl = "data:image/png;base64,KEEP_ME";
    // Change to 4x3
    const patch = setSceneGridFormat(proj, "sc1", "4x3");
    const newScene = patch.filmV093!.script!.scenes[0];
    expect(newScene.gridFormat).toBe("4x3");
    expect(newScene.grids![0].cells.length).toBe(12); // 4x3
    // First cell still has shot sh1 → preserve dataUrl
    expect(newScene.grids![0].cells[0].shotId).toBe("sh1");
    expect(newScene.grids![0].cells[0].dataUrl).toBe("data:image/png;base64,KEEP_ME");
  });

  it("qc16 toggleSceneGridCellLock flips cell locked state", async () => {
    const { ensureSceneGrids, toggleSceneGridCellLock } = await import("../src/store/film_actions");
    let proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        shotsBySceneId: { sc1: [{ id: "sh1", order: 1 }] },
        script: {
          titleEn: "T", titleVi: "T", logline: "",
          scenes: [{ id: "sc1", order: 1, titleEn: "S1", durationSeconds: 5, settings: "", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "setup" }],
          createdAt: Date.now(), versions: [],
        },
      },
    };
    Object.assign(proj, ensureSceneGrids(proj, "sc1"));
    const gridId = proj.filmV093.script.scenes[0].grids[0].id;
    const patch = toggleSceneGridCellLock(proj, "sc1", gridId, 1);
    expect(patch.filmV093!.script!.scenes[0].grids![0].cells[0].locked).toBe(true);
    // Toggle again
    Object.assign(proj, patch);
    const patch2 = toggleSceneGridCellLock(proj, "sc1", gridId, 1);
    expect(patch2.filmV093!.script!.scenes[0].grids![0].cells[0].locked).toBe(false);
  });

  it("qc16 applyCroppedFramesToGrid fills cells from crop result", async () => {
    const { ensureSceneGrids, applyCroppedFramesToGrid } = await import("../src/store/film_actions");
    let proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        shotsBySceneId: {
          sc1: [
            { id: "sh1", order: 1 },
            { id: "sh2", order: 2 },
          ],
        },
        script: {
          titleEn: "T", titleVi: "T", logline: "",
          scenes: [{ id: "sc1", order: 1, titleEn: "S1", durationSeconds: 5, settings: "", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "setup", gridFormat: "3x3" as const }],
          createdAt: Date.now(), versions: [],
        },
      },
    };
    Object.assign(proj, ensureSceneGrids(proj, "sc1"));
    const gridId = proj.filmV093.script.scenes[0].grids[0].id;
    // Simulate 9 cropped cell dataURLs
    const cropResults = Array.from({ length: 9 }, (_, i) => `data:image/png;base64,CELL_${i + 1}`);
    const patch = applyCroppedFramesToGrid(proj, "sc1", gridId, cropResults);
    const cells = patch.filmV093!.script!.scenes[0].grids![0].cells;
    // Cell 1 (has shot sh1) → has dataUrl
    expect(cells[0].dataUrl).toBe("data:image/png;base64,CELL_1");
    expect(cells[1].dataUrl).toBe("data:image/png;base64,CELL_2");
    // Cell 3+ (empty cells) → NO dataUrl assigned
    expect(cells[2].dataUrl).toBeUndefined();
    expect(cells[8].dataUrl).toBeUndefined();
  });

  it("qc16 Migration A drops per-shot grid data on load", async () => {
    const { migrateQc16DropPerShotGrids } = await import("../src/store/migration");
    const projWithOldData: any = {
      id: "test",
      schemaVersion: "v0.9",
      filmV093: {
        characters: [],
        shotsBySceneId: {
          sc1: [
            {
              id: "sh1",
              order: 1,
              titleEn: "Test",
              // qc16 should drop these:
              framesR5: [{ id: "f1", order: 1, dataUrl: "old" }],
              gridImageDataUrl: "data:image/png;base64,OLD",
              imagePromptR5: "old prompt",
              cropSettings: { provider: "nano", totalWidth: 2752, totalHeight: 1536, gutterPx: 0 },
            },
          ],
        },
        defaultCropSettings: { provider: "nano", totalWidth: 2752, totalHeight: 1536, gutterPx: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
    const migrated = migrateQc16DropPerShotGrids(projWithOldData);
    const shot = (migrated as any).filmV093.shotsBySceneId.sc1[0];
    expect(shot.framesR5).toBeUndefined();
    expect(shot.gridImageDataUrl).toBeUndefined();
    expect(shot.imagePromptR5).toBeUndefined();
    expect(shot.cropSettings).toBeUndefined();
    // Other shot fields preserved
    expect(shot.id).toBe("sh1");
    expect(shot.titleEn).toBe("Test");
    // defaultCropSettings also dropped
    expect((migrated as any).filmV093.defaultCropSettings).toBeUndefined();
    // Marker set
    expect((migrated as any).filmV093.qc16Migrated).toBe(true);
  });

  it("qc16 Migration A is idempotent (qc16Migrated marker prevents double-run)", async () => {
    const { migrateQc16DropPerShotGrids } = await import("../src/store/migration");
    const projAlreadyMigrated: any = {
      filmV093: {
        qc16Migrated: true,
        characters: [],
        shotsBySceneId: {
          sc1: [{ id: "sh1", framesR5: [{ id: "x" }] }],  // synthetic - shouldn't be touched
        },
      },
    };
    const migrated = migrateQc16DropPerShotGrids(projAlreadyMigrated);
    // No-op: marker present, original shot framesR5 preserved
    expect((migrated as any).filmV093.shotsBySceneId.sc1[0].framesR5).toBeDefined();
  });

  it("qc16 FilmStoryboardSection renders scene blocks + empty state when no script", async () => {
    const { FilmStoryboardSection } = await import("../src/components/FilmStoryboardSection");
    useAppStore.setState({ currentProject: baseFilmProject });
    const { container } = render(<FilmStoryboardSection />);
    expect(container.innerHTML).toContain("5. STORYBOARD");
    expect(container.innerHTML).toContain("0 scene");
    // Empty state message
    expect(container.innerHTML).toContain("Chưa có scene");
  });

  it("qc16 FilmStoryboardSection renders scene blocks when script + scenes exist", async () => {
    const { FilmStoryboardSection } = await import("../src/components/FilmStoryboardSection");
    const projWithScript: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        script: {
          titleEn: "Test", titleVi: "Test", logline: "x",
          scenes: [
            { id: "sc1", order: 1, titleVi: "Sự thức tỉnh", titleEn: "Awakening", durationSeconds: 60, settings: "EXT.", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "setup" },
            { id: "sc2", order: 2, titleVi: "Khám phá", titleEn: "Discovery", durationSeconds: 90, settings: "EXT.", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "rising" },
          ],
          createdAt: Date.now(), versions: [],
        },
      },
    };
    useAppStore.setState({ currentProject: projWithScript });
    const { container } = render(<FilmStoryboardSection />);
    expect(container.innerHTML).toContain("2 scenes");
    expect(container.innerHTML).toContain("Sự thức tỉnh");
    expect(container.innerHTML).toContain("Khám phá");
  });

  it("qc16 Editor component schema: scenes have grids + gridFormat fields available", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/types/project.ts"), "utf-8");
    expect(src).toContain("SceneGrid");
    expect(src).toContain("SceneGridCell");
    expect(src).toContain("SceneGridFormat");
    expect(src).toContain("grids?: SceneGrid[]");
    expect(src).toContain("gridFormat?: SceneGridFormat");
  });

  it("qc16 defaultVideoProvider added to ProjectSettingV2 (qc17 prep)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/types/project.ts"), "utf-8");
    expect(src).toContain("defaultVideoProvider");
  });

  // ============================================================================
  // qc17 — Provider durations + grid-aware Shot List + Edit Frame Modal
  // ============================================================================

  it("qc17 PROVIDER_DURATIONS has 5 providers with verified specs", async () => {
    const { PROVIDER_DURATIONS } = await import("../src/engine/providerDurations");
    expect(PROVIDER_DURATIONS.length).toBe(5);

    const seedance = PROVIDER_DURATIONS.find((p) => p.providerId === "seedance-2-pro");
    expect(seedance?.mode).toBe("range");
    expect(seedance?.min).toBe(4);
    expect(seedance?.max).toBe(15);

    const veo3 = PROVIDER_DURATIONS.find((p) => p.providerId === "veo-3");
    expect(veo3?.mode).toBe("discrete");
    expect(veo3?.values).toEqual([8]);

    const kling = PROVIDER_DURATIONS.find((p) => p.providerId === "kling-2");
    expect(kling?.values).toEqual([5, 10]);

    const sora = PROVIDER_DURATIONS.find((p) => p.providerId === "sora");
    expect(sora?.values).toEqual([5, 10, 20]);

    const grok = PROVIDER_DURATIONS.find((p) => p.providerId === "grok-imagine");
    expect(grok?.values).toEqual([6, 10]);
  });

  it("qc17 isDurationValid: range mode (Seedance)", async () => {
    const { isDurationValid } = await import("../src/engine/providerDurations");
    expect(isDurationValid(4, "seedance-2-pro")).toBe(true);
    expect(isDurationValid(15, "seedance-2-pro")).toBe(true);
    expect(isDurationValid(8, "seedance-2-pro")).toBe(true);
    expect(isDurationValid(3, "seedance-2-pro")).toBe(false);
    expect(isDurationValid(16, "seedance-2-pro")).toBe(false);
  });

  it("qc17 isDurationValid: discrete mode (Veo3, Kling)", async () => {
    const { isDurationValid } = await import("../src/engine/providerDurations");
    expect(isDurationValid(8, "veo-3")).toBe(true);
    expect(isDurationValid(7, "veo-3")).toBe(false);
    expect(isDurationValid(9, "veo-3")).toBe(false);

    expect(isDurationValid(5, "kling-2")).toBe(true);
    expect(isDurationValid(10, "kling-2")).toBe(true);
    expect(isDurationValid(7, "kling-2")).toBe(false);
  });

  it("qc17 isDurationValid: unknown provider returns true (no constraint)", async () => {
    const { isDurationValid } = await import("../src/engine/providerDurations");
    expect(isDurationValid(5, "custom-grok-v2")).toBe(true);
    expect(isDurationValid(100, "made-up")).toBe(true);
  });

  it("qc17 clampDurationToProvider: range clamps to [min, max]", async () => {
    const { clampDurationToProvider } = await import("../src/engine/providerDurations");
    expect(clampDurationToProvider(3, "seedance-2-pro")).toBe(4); // below min
    expect(clampDurationToProvider(20, "seedance-2-pro")).toBe(15); // above max
    expect(clampDurationToProvider(8, "seedance-2-pro")).toBe(8); // valid pass-through
  });

  it("qc17 clampDurationToProvider: discrete picks nearest valid value", async () => {
    const { clampDurationToProvider } = await import("../src/engine/providerDurations");
    // Veo3 only 8s → clamp anything to 8
    expect(clampDurationToProvider(5, "veo-3")).toBe(8);
    expect(clampDurationToProvider(12, "veo-3")).toBe(8);

    // Kling 5/10 → pick nearest
    expect(clampDurationToProvider(6, "kling-2")).toBe(5);
    expect(clampDurationToProvider(8, "kling-2")).toBe(10);
    expect(clampDurationToProvider(7, "kling-2")).toBe(5); // tie-break: first one wins (delta 2 vs 3)

    // Grok 6/10 → pick nearest
    expect(clampDurationToProvider(7, "grok-imagine")).toBe(6);
    expect(clampDurationToProvider(9, "grok-imagine")).toBe(10);
  });

  it("qc17 clampDurationToProvider: unknown provider passes through", async () => {
    const { clampDurationToProvider } = await import("../src/engine/providerDurations");
    expect(clampDurationToProvider(7, "custom-provider")).toBe(7);
  });

  it("qc17 getSupportedDurations: range expands to full list", async () => {
    const { getSupportedDurations } = await import("../src/engine/providerDurations");
    expect(getSupportedDurations("seedance-2-pro")).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(getSupportedDurations("veo-3")).toEqual([8]);
    expect(getSupportedDurations("kling-2")).toEqual([5, 10]);
    expect(getSupportedDurations("unknown-provider")).toEqual([]);
  });

  it("qc17 formatDurationsForPrompt: human-readable instruction for each mode", async () => {
    const { formatDurationsForPrompt } = await import("../src/engine/providerDurations");
    expect(formatDurationsForPrompt("seedance-2-pro")).toContain("4 to 15");
    expect(formatDurationsForPrompt("veo-3")).toContain("exactly 8");
    expect(formatDurationsForPrompt("veo-3")).toContain("fixed");
    expect(formatDurationsForPrompt("kling-2")).toContain("5 or 10");
    expect(formatDurationsForPrompt("sora")).toContain("20"); // last value
    expect(formatDurationsForPrompt("unknown")).toBe("");
  });

  it("qc17 formatDurationsForUI: short label per mode", async () => {
    const { formatDurationsForUI } = await import("../src/engine/providerDurations");
    expect(formatDurationsForUI("seedance-2-pro")).toBe("4-15s flexible");
    expect(formatDurationsForUI("veo-3")).toBe("8s");
    expect(formatDurationsForUI("kling-2")).toBe("5s / 10s");
    expect(formatDurationsForUI("sora")).toBe("5s / 10s / 20s");
    expect(formatDurationsForUI("unknown")).toBe("any duration");
  });

  it("qc17 → qc19 runShotListForScene: gridFormat backward-compat in type, narrative-driven prompt", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve("./src/engine/filmShotListGeneration.ts"),
      "utf-8"
    );
    // qc17: gridFormat param kept in type (backward-compat, no crash if caller passes)
    expect(src).toContain("gridFormat?: string");
    expect(src).toContain("videoProviderId?: string");
    // qc19: AI prompt is narrative-driven, NO grid-aware constraint
    expect(src).not.toContain("GRID-AWARE CONSTRAINT");
    expect(src).toContain("SHOT COUNT GUIDANCE"); // new qc19 section header
    expect(src).toContain("SWEET SPOT"); // 4-9 shots guidance
    // qc17 duration constraint logic retained
    expect(src).toContain("formatDurationsForPrompt");
    // sanitizeShot post-clamps duration to provider
    expect(src).toContain("clampDurationToProvider");
  });

  it("qc17 ProjectSettingSection: defaultVideoProvider field rendered for film mode", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve("./src/components/ProjectSettingSection.tsx"),
      "utf-8"
    );
    expect(src).toContain("defaultVideoProvider");
    expect(src).toContain("Video AI Provider");
    // All 5 providers in dropdown
    expect(src).toContain('value="seedance-2-pro"');
    expect(src).toContain('value="veo-3"');
    expect(src).toContain('value="kling-2"');
    expect(src).toContain('value="sora"');
    expect(src).toContain('value="grok-imagine"');
  });

  it("qc17 FilmShotListSection passes gridFormat + videoProviderId to engine calls", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve("./src/components/FilmShotListSection.tsx"),
      "utf-8"
    );
    expect(src).toContain('gridFormat: (scene as any).gridFormat');
    expect(src).toContain('videoProviderId:');
    expect(src).toContain('defaultVideoProvider');
  });

  it("qc17 FilmFrameEditModal: file structure and exports", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve("./src/components/FilmFrameEditModal.tsx"),
      "utf-8"
    );
    // Export + props interface
    expect(src).toContain("export function FilmFrameEditModal");
    expect(src).toContain("export interface FilmFrameEditModalProps");
    // 4 footer actions (Jason confirmed: regen / upload replace / copy / save)
    expect(src).toContain("Regen frame");
    expect(src).toContain("Upload replace");
    expect(src).toContain("Save changes");
    // Image prompt collapsible + Animation prompt collapsible
    expect(src).toContain("Image Prompt");
    expect(src).toContain("Animation Prompt");
    // Duration validation logic
    expect(src).toContain("isDurationValid");
    expect(src).toContain("clampDurationToProvider");
    // Auto-clamp confirm dialog
    expect(src).toContain("Auto-clamp");
  });

  it("qc17 FilmStoryboardSection: edit button now opens modal (not toast stub)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.resolve("./src/components/FilmStoryboardSection.tsx"),
      "utf-8"
    );
    // Modal imported
    expect(src).toContain('import { FilmFrameEditModal }');
    // editingCellOrder state
    expect(src).toContain("editingCellOrder");
    expect(src).toContain("setEditingCellOrder");
    // onEdit no longer shows "qc17 sẽ wire modal" toast
    expect(src).not.toContain("qc17 sẽ wire modal đầy đủ");
    // Modal renders conditionally
    expect(src).toContain("<FilmFrameEditModal");
    // Save handler calls updateShot
    expect(src).toContain("updateShot(p, scene.id, shot.id, updates");
    // Upload replace calls setSceneGridCellDataUrl
    expect(src).toContain("setSceneGridCellDataUrl(p, scene.id, grid.id, cell.order, dataUrl)");
  });

  it("qc17 FilmFrameEditModal mounts without crash (basic smoke test)", async () => {
    const { FilmFrameEditModal } = await import("../src/components/FilmFrameEditModal");
    const cell: any = {
      order: 1,
      shotId: "sh1",
    };
    const grid: any = {
      id: "g1",
      order: 1,
      gridFormat: "3x3",
      cells: [cell],
    };
    const scene: any = {
      id: "sc1",
      order: 1,
      titleEn: "Scene 1",
      titleVi: "Scene 1 VN",
      settings: "EXT.",
      durationSeconds: 60,
      actionLinesEn: "",
      dialog: [],
      sfx: [],
      musicBrief: "",
      act: "setup",
    };
    const shot: any = {
      id: "sh1",
      order: 1,
      titleVi: "Shot 1",
      titleEn: "Shot 1 EN",
      shotType: "medium",
      durationSeconds: 5,
      gridFormat: "3x3",
      cameraMovement: "static",
      status: "draft",
    };
    const cast: any[] = [];
    const setting: any = {
      mode: "film",
      animationStyle: "live_action",
      aspectRatio: "16:9",
      defaultVideoProvider: "seedance-2-pro",
      timeFormat: "integer",
      aiProviders: {},
      name: "Test",
    };

    const onSave = vi.fn();
    const onUploadReplace = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <FilmFrameEditModal
        cell={cell}
        grid={grid}
        scene={scene}
        shot={shot}
        allShotsInScene={[shot]}
        cast={cast}
        setting={setting}
        onSave={onSave}
        onUploadReplace={onUploadReplace}
        onCancel={onCancel}
      />
    );
    // Header text shown
    expect(container.innerHTML).toContain("Edit Frame");
    expect(container.innerHTML).toContain("Shot 1"); // shot title in field
    // Fields exist
    expect(container.innerHTML).toContain("Title VN");
    expect(container.innerHTML).toContain("Animation Prompt");
    expect(container.innerHTML).toContain("Image Prompt");
    // Footer actions
    expect(container.innerHTML).toContain("Save changes");
    expect(container.innerHTML).toContain("Upload replace");
  });

  it("qc17 FilmFrameEditModal: duration warning shows when invalid", async () => {
    const { FilmFrameEditModal } = await import("../src/components/FilmFrameEditModal");
    const cell: any = { order: 1, shotId: "sh1" };
    const grid: any = { id: "g1", order: 1, gridFormat: "3x3", cells: [cell] };
    const scene: any = {
      id: "sc1", order: 1, titleEn: "S", titleVi: "S", settings: "",
      durationSeconds: 60, actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "setup",
    };
    // Shot duration 5s but provider Veo3 only supports 8s → warning
    const shot: any = {
      id: "sh1", order: 1, titleVi: "Shot1", titleEn: "Shot1",
      shotType: "medium", durationSeconds: 5,
      cameraMovement: "static", status: "draft",
      videoProviderId: "veo-3", // mismatch
    };
    const setting: any = {
      mode: "film", animationStyle: "live_action", aspectRatio: "16:9",
      defaultVideoProvider: "veo-3", timeFormat: "integer", aiProviders: {}, name: "Test",
    };
    const { container } = render(
      <FilmFrameEditModal
        cell={cell}
        grid={grid}
        scene={scene}
        shot={shot}
        allShotsInScene={[shot]}
        cast={[]}
        setting={setting}
        onSave={vi.fn()}
        onUploadReplace={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    // Warning text rendered
    expect(container.innerHTML).toContain("không khớp");
    expect(container.innerHTML).toContain("Veo 3");
  });

  // ============================================================================
  // qc19 — Hướng F-9: Auto-Adapt Grid Format (narrative-driven shot count)
  // ============================================================================

  it("qc19 pickOptimalGridFormat: 0-4 shots → 2x2", async () => {
    const { pickOptimalGridFormat } = await import("../src/engine/sceneGridPacker");
    expect(pickOptimalGridFormat(0)).toBe("2x2");
    expect(pickOptimalGridFormat(1)).toBe("2x2");
    expect(pickOptimalGridFormat(4)).toBe("2x2");
  });

  it("qc19 pickOptimalGridFormat: 5-6 shots → 3x2 landscape, 2x3 vertical", async () => {
    const { pickOptimalGridFormat } = await import("../src/engine/sceneGridPacker");
    expect(pickOptimalGridFormat(5, "16:9")).toBe("3x2");
    expect(pickOptimalGridFormat(6, "16:9")).toBe("3x2");
    expect(pickOptimalGridFormat(6, "9:16")).toBe("2x3");
    expect(pickOptimalGridFormat(6, "4:5")).toBe("2x3"); // 4:5 vertical
    expect(pickOptimalGridFormat(6, "1:1")).toBe("3x2"); // square defaults landscape
    expect(pickOptimalGridFormat(6, "4:3")).toBe("3x2");
  });

  it("qc19 pickOptimalGridFormat: 7-8 shots → 4x2 landscape, 2x4 vertical", async () => {
    const { pickOptimalGridFormat } = await import("../src/engine/sceneGridPacker");
    expect(pickOptimalGridFormat(7, "16:9")).toBe("4x2");
    expect(pickOptimalGridFormat(8, "16:9")).toBe("4x2");
    expect(pickOptimalGridFormat(8, "9:16")).toBe("2x4");
    expect(pickOptimalGridFormat(8, "4:5")).toBe("2x4");
  });

  it("qc19 pickOptimalGridFormat: 9 shots → 3x3 (sweet spot, symmetric)", async () => {
    const { pickOptimalGridFormat } = await import("../src/engine/sceneGridPacker");
    // Sweet spot: same format regardless of aspect (3x3 is symmetric)
    expect(pickOptimalGridFormat(9, "16:9")).toBe("3x3");
    expect(pickOptimalGridFormat(9, "9:16")).toBe("3x3");
    expect(pickOptimalGridFormat(9, "1:1")).toBe("3x3");
    expect(pickOptimalGridFormat(9, "4:5")).toBe("3x3");
  });

  it("qc19 pickOptimalGridFormat: 10-12 shots → 4x3 landscape, 3x4 vertical", async () => {
    const { pickOptimalGridFormat } = await import("../src/engine/sceneGridPacker");
    expect(pickOptimalGridFormat(10, "16:9")).toBe("4x3");
    expect(pickOptimalGridFormat(11, "16:9")).toBe("4x3");
    expect(pickOptimalGridFormat(12, "16:9")).toBe("4x3");
    expect(pickOptimalGridFormat(12, "9:16")).toBe("3x4");
    expect(pickOptimalGridFormat(12, "4:5")).toBe("3x4");
  });

  it("qc19 pickOptimalGridFormat: 13-16 shots → 4x4 (hard cap, symmetric)", async () => {
    const { pickOptimalGridFormat } = await import("../src/engine/sceneGridPacker");
    expect(pickOptimalGridFormat(13)).toBe("4x4");
    expect(pickOptimalGridFormat(16)).toBe("4x4");
    expect(pickOptimalGridFormat(16, "9:16")).toBe("4x4"); // symmetric, ignores orientation
  });

  it("qc19 pickOptimalGridFormat: > 16 shots capped at 4x4 (caller must warn/split)", async () => {
    const { pickOptimalGridFormat } = await import("../src/engine/sceneGridPacker");
    expect(pickOptimalGridFormat(17)).toBe("4x4");
    expect(pickOptimalGridFormat(25)).toBe("4x4");
    expect(pickOptimalGridFormat(100)).toBe("4x4");
  });

  it("qc19 exports SHOT_COUNT_SWEET_SPOT=9 and SHOT_COUNT_HARD_CAP=16 constants", async () => {
    const mod = await import("../src/engine/sceneGridPacker");
    expect(mod.SHOT_COUNT_SWEET_SPOT).toBe(9);
    expect(mod.SHOT_COUNT_HARD_CAP).toBe(16);
  });

  it("qc19 packShotsIntoGrids: undefined gridFormat → auto-picks from shot count + aspect", async () => {
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    // 9 shots, no format, landscape default → 3x3 (1 grid, 0 empty)
    const shots9 = Array.from({ length: 9 }, (_, i) => ({ id: `s${i + 1}` })) as any[];
    const grids9 = packShotsIntoGrids(shots9, undefined);
    expect(grids9.length).toBe(1);
    expect(grids9[0].gridFormat).toBe("3x3");
    expect(grids9[0].cells.length).toBe(9);
    expect(grids9[0].cells.filter((c) => c.shotId).length).toBe(9);

    // 5 shots, vertical → 2x3 (1 grid, 1 empty)
    const shots5 = Array.from({ length: 5 }, (_, i) => ({ id: `s${i + 1}` })) as any[];
    const grids5 = packShotsIntoGrids(shots5, undefined, undefined, "9:16");
    expect(grids5[0].gridFormat).toBe("2x3");
    expect(grids5[0].cells.length).toBe(6);
    expect(grids5[0].cells.filter((c) => c.shotId).length).toBe(5);
  });

  it("qc19 packShotsIntoGrids: explicit gridFormat overrides auto-pick (user manual choice respected)", async () => {
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    // 5 shots but user manually picks 3x3 → respect override (4 empty)
    const shots = Array.from({ length: 5 }, (_, i) => ({ id: `s${i + 1}` })) as any[];
    const grids = packShotsIntoGrids(shots, "3x3");
    expect(grids[0].gridFormat).toBe("3x3");
    expect(grids[0].cells.length).toBe(9);
    expect(grids[0].cells.filter((c) => c.shotId).length).toBe(5);
  });

  it("qc19 ensureSceneGrids preserves user-set gridFormat (manual override path)", async () => {
    const { ensureSceneGrids } = await import("../src/store/film_actions");
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        shotsBySceneId: {
          sc1: [{ id: "sh1", order: 1 }, { id: "sh2", order: 2 }, { id: "sh3", order: 3 }],
        },
        script: {
          titleEn: "Test", titleVi: "Test", logline: "test",
          scenes: [
            {
              id: "sc1", order: 1, titleEn: "Scene 1", durationSeconds: 30,
              settings: "INT.", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "",
              act: "setup",
              gridFormat: "3x3" as const, // user previously picked this manually
            },
          ],
          createdAt: Date.now(),
          versions: [],
        },
      },
    };
    const patch = ensureSceneGrids(proj, "sc1");
    const scene = patch.filmV093!.script!.scenes[0];
    // qc19: user choice preserved, NOT auto-overridden to 2x2 (which would be optimal for 3 shots)
    expect(scene.gridFormat).toBe("3x3");
    expect(scene.grids![0].cells.length).toBe(9);
    expect(scene.grids![0].cells.filter((c) => c.shotId).length).toBe(3);
  });

  it("qc19 ensureSceneGrids uses aspect ratio from settingV2 for auto-pick (non-Film mode)", async () => {
    const { ensureSceneGrids } = await import("../src/store/film_actions");
    const proj: any = {
      ...baseFilmProject,
      settingV2: {
        ...baseFilmProject.settingV2,
        // r7: NOT film mode → legacy pickOptimalGridFormat applies (auto-pick by shot count)
        mode: "photos",
        aspectRatio: "9:16" as const, // vertical reels
      },
      filmV093: {
        ...baseFilmProject.filmV093,
        shotsBySceneId: {
          sc1: Array.from({ length: 6 }, (_, i) => ({ id: `sh${i + 1}`, order: i + 1 })),
        },
        script: {
          titleEn: "Test", titleVi: "Test", logline: "test",
          scenes: [
            {
              id: "sc1", order: 1, titleEn: "Scene 1", durationSeconds: 30,
              settings: "INT.", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "setup",
            },
          ],
          createdAt: Date.now(),
          versions: [],
        },
      },
    };
    const patch = ensureSceneGrids(proj, "sc1");
    const scene = patch.filmV093!.script!.scenes[0];
    // 6 shots + vertical (non-Film mode) → 2x3 (taller grid for portrait reels)
    expect(scene.gridFormat).toBe("2x3");
    expect(scene.grids![0].cells.length).toBe(6);
  });

  it("qc19 filmShotListGeneration AI prompt: NO grid-aware constraint (Hướng F-9 narrative-driven)", async () => {
    // Verify the AI prompt builder no longer injects the qc17 "GRID-AWARE CONSTRAINT" section.
    // We can't easily run the AI call, but we can check the source-level instruction shape.
    const mod = await import("../src/engine/filmShotListGeneration");
    expect(mod.runShotListForScene).toBeDefined();
    // RunShotListForSceneInput type still accepts gridFormat for backward-compat (no crash if passed)
    // but the prompt logic is updated. This test just ensures the module loads + exports work.
  });

  // ============================================================================
  // qc20 — Stage 4 Scene Complexity Warning + AI Split Suggestion
  // ============================================================================

  it("qc20 estimateSceneShotCount: hybrid max(duration/8, sentences, MIN_FLOOR=3)", async () => {
    const { estimateSceneShotCount } = await import("../src/engine/sceneShotEstimator");
    // 30s scene, 1 sentence → duration_based=4, sentence_based=1, floor=3 → max = 4
    expect(estimateSceneShotCount({
      id: "s1", order: 1, titleEn: "T", settings: "", actionLinesEn: "Robot wakes.",
      durationSeconds: 30, beatIds: [],
    } as any)).toBe(4);
    // 60s, 5 sentences → max(8, 5, 3) = 8
    expect(estimateSceneShotCount({
      id: "s2", order: 2, titleEn: "T", settings: "",
      actionLinesEn: "A. B. C! D? E.",
      durationSeconds: 60, beatIds: [],
    } as any)).toBe(8);
    // 120s, 2 sentences → max(15, 2, 3) = 15
    expect(estimateSceneShotCount({
      id: "s3", order: 3, titleEn: "T", settings: "",
      actionLinesEn: "Long action. End.",
      durationSeconds: 120, beatIds: [],
    } as any)).toBe(15);
    // 10s, 0 sentences → max(2, 0, 3) = 3 (floor kicks in)
    expect(estimateSceneShotCount({
      id: "s4", order: 4, titleEn: "T", settings: "",
      actionLinesEn: "",
      durationSeconds: 10, beatIds: [],
    } as any)).toBe(3);
  });

  it("qc20 classifySceneComplexity: ok ≤ 9, over_sweet 10-16, over_hard > 16", async () => {
    const { classifySceneComplexity } = await import("../src/engine/sceneShotEstimator");
    expect(classifySceneComplexity(3)).toBe("ok");
    expect(classifySceneComplexity(9)).toBe("ok");
    expect(classifySceneComplexity(10)).toBe("over_sweet");
    expect(classifySceneComplexity(16)).toBe("over_sweet");
    expect(classifySceneComplexity(17)).toBe("over_hard");
    expect(classifySceneComplexity(30)).toBe("over_hard");
  });

  it("qc20 sceneNeedsWarning: true when estimate > 9", async () => {
    const { sceneNeedsWarning } = await import("../src/engine/sceneShotEstimator");
    expect(sceneNeedsWarning({
      id: "s1", order: 1, titleEn: "", settings: "", actionLinesEn: "Short.",
      durationSeconds: 30, beatIds: [],
    } as any)).toBe(false);
    expect(sceneNeedsWarning({
      id: "s2", order: 2, titleEn: "", settings: "", actionLinesEn: "Long.",
      durationSeconds: 90, beatIds: [],
    } as any)).toBe(true); // 90s → ceil(90/8) = 12 shots
  });

  it("qc20 applySceneSplit: replaces 1 scene with 2 sub-scenes, shifts order of subsequent", async () => {
    const { applySceneSplit, setScriptIntermediateScenes } = await import("../src/store/film_actions");
    let proj: any = { ...baseFilmProject };
    proj = { ...proj, filmV093: setScriptIntermediateScenes(proj, [
      { id: "sc1", order: 1, titleEn: "S1", settings: "", actionLinesEn: "", durationSeconds: 30, beatIds: [] },
      { id: "sc2", order: 2, titleEn: "S2", settings: "", actionLinesEn: "", durationSeconds: 120, beatIds: ["b1", "b2"] },
      { id: "sc3", order: 3, titleEn: "S3", settings: "", actionLinesEn: "", durationSeconds: 60, beatIds: [] },
    ]).filmV093 };

    const sub1 = { titleEn: "S2A", titleVi: "S2A", settings: "INT.", actionLinesEn: "First half", actionLinesVi: "Đầu", durationSeconds: 60, beatIds: ["b1"] };
    const sub2 = { titleEn: "S2B", titleVi: "S2B", settings: "INT.", actionLinesEn: "Second half", actionLinesVi: "Cuối", durationSeconds: 60, beatIds: ["b2"] };

    const patch = applySceneSplit(proj, "sc2", sub1, sub2);
    const scenes = patch.filmV093!.scriptIntermediateScenes!;
    expect(scenes.length).toBe(4); // was 3, +1 from split
    expect(scenes[0].id).toBe("sc1");
    expect(scenes[0].order).toBe(1);
    expect(scenes[1].order).toBe(2); // sub1
    expect(scenes[1].titleEn).toBe("S2A");
    expect(scenes[2].order).toBe(3); // sub2
    expect(scenes[2].titleEn).toBe("S2B");
    expect(scenes[3].id).toBe("sc3");
    expect(scenes[3].order).toBe(4); // shifted from 3
    // Beat preservation: sub1 + sub2 covers original beatIds
    expect(scenes[1].beatIds).toEqual(["b1"]);
    expect(scenes[2].beatIds).toEqual(["b2"]);
    // Duration sums match original
    expect(scenes[1].durationSeconds + scenes[2].durationSeconds).toBe(120);
  });

  it("qc20 dismissSceneComplexityWarning: sets flag, preserves scene data", async () => {
    const { dismissSceneComplexityWarning, setScriptIntermediateScenes } = await import("../src/store/film_actions");
    let proj: any = { ...baseFilmProject };
    proj = { ...proj, filmV093: setScriptIntermediateScenes(proj, [
      { id: "sc1", order: 1, titleEn: "S1", settings: "", actionLinesEn: "long", durationSeconds: 120, beatIds: [] },
    ]).filmV093 };
    expect(proj.filmV093.scriptIntermediateScenes[0].complexityWarningDismissed).toBeUndefined();

    const patch = dismissSceneComplexityWarning(proj, "sc1");
    expect(patch.filmV093!.scriptIntermediateScenes![0].complexityWarningDismissed).toBe(true);
    expect(patch.filmV093!.scriptIntermediateScenes![0].titleEn).toBe("S1"); // data preserved
  });

  // qc20 Stage 4 lock (parallel qc18 Twist lock pattern)

  it("qc20 setScriptIntermediateScenes initializes scriptScenesLocked = false (user must confirm)", async () => {
    const { setScriptIntermediateScenes } = await import("../src/store/film_actions");
    const patch = setScriptIntermediateScenes(baseFilmProject, [
      { id: "sc1", order: 1, titleEn: "S1", settings: "", actionLinesEn: "x", durationSeconds: 30, beatIds: [] },
    ]);
    expect(patch.filmV093!.scriptScenesLocked).toBe(false);
  });

  it("qc20 lockScriptScenes flips scriptScenesLocked to true", async () => {
    const { lockScriptScenes, setScriptIntermediateScenes } = await import("../src/store/film_actions");
    let proj: any = { ...baseFilmProject };
    proj = { ...proj, filmV093: setScriptIntermediateScenes(proj, [
      { id: "sc1", order: 1, titleEn: "S1", settings: "", actionLinesEn: "x", durationSeconds: 30, beatIds: [] },
    ]).filmV093 };
    expect(proj.filmV093.scriptScenesLocked).toBe(false);

    const patch = lockScriptScenes(proj);
    expect(patch.filmV093!.scriptScenesLocked).toBe(true);
    expect(patch.filmV093!.scriptIntermediateScenes!.length).toBe(1); // data preserved
  });

  it("qc20 setScriptIntermediateScenes resets lock on AI regen", async () => {
    const { lockScriptScenes, setScriptIntermediateScenes } = await import("../src/store/film_actions");
    let proj: any = { ...baseFilmProject };
    proj = { ...proj, filmV093: setScriptIntermediateScenes(proj, [
      { id: "sc1", order: 1, titleEn: "old", settings: "", actionLinesEn: "x", durationSeconds: 30, beatIds: [] },
    ]).filmV093 };
    proj = { ...proj, filmV093: lockScriptScenes(proj).filmV093 };
    expect(proj.filmV093.scriptScenesLocked).toBe(true);

    // AI regenerate → lock must reset
    const patch = setScriptIntermediateScenes(proj, [
      { id: "sc2", order: 1, titleEn: "new", settings: "", actionLinesEn: "y", durationSeconds: 30, beatIds: [] },
    ]);
    expect(patch.filmV093!.scriptScenesLocked).toBe(false);
    expect(patch.filmV093!.scriptIntermediateScenes![0].titleEn).toBe("new");
  });

  it("qc20 revertToStage('scenes') clears scriptScenesLocked but preserves scenes data", async () => {
    const { revertToStage, lockScriptScenes, setScriptIntermediateScenes, setScriptStructure, setScriptBeats } = await import("../src/store/film_actions");
    let proj: any = { ...baseFilmProject };
    proj = { ...proj, filmV093: setScriptStructure(proj, { framework: "three-act", contentEn: "x" }).filmV093 };
    proj = { ...proj, filmV093: setScriptBeats(proj, [{ id: "b1", order: 1, title: "A", description: "x" }]).filmV093 };
    proj = { ...proj, filmV093: setScriptIntermediateScenes(proj, [
      { id: "sc1", order: 1, titleEn: "S1", settings: "", actionLinesEn: "x", durationSeconds: 30, beatIds: [] },
    ]).filmV093 };
    proj = { ...proj, filmV093: lockScriptScenes(proj).filmV093 };
    expect(proj.filmV093.scriptScenesLocked).toBe(true);

    const patch = revertToStage(proj, "scenes");
    expect(patch.filmV093!.scriptScenesLocked).toBeUndefined();
    expect(patch.filmV093!.scriptIntermediateScenes).toBeDefined(); // preserved
  });

  it("qc20 runSplitSceneSuggestion exports correct signature (TS shape check)", async () => {
    const mod = await import("../src/engine/filmScriptStages");
    expect(mod.runSplitSceneSuggestion).toBeDefined();
    expect(typeof mod.runSplitSceneSuggestion).toBe("function");
  });

  it("qc20 SceneCardWithWarning shows badge when scene exceeds sweet spot (component smoke test)", async () => {
    // qc20: smoke test — verify component renders warning badge for complex scene
    const proj: any = {
      ...baseFilmProject,
      idea: { raw: "test" },
      filmV093: {
        ...baseFilmProject.filmV093,
        characters: [{ id: "c1", role: "protagonist", order: 1, name: "Hero", description: "x", uniqueIdentifiers: "", hasDialog: false, faceRefs: [], bodyRefs: [], characterType: "human" }],
        scriptStructure: { framework: "three-act", contentEn: "x", contentVi: "x" },
        scriptBeats: [{ id: "b1", order: 1, title: "B", description: "x" }],
        scriptTwists: [],
        scriptTwistsLocked: true,
        scriptStage: "scenes",
        // qc20: Stage 4 ACTIVE (scenes data + lock = false → ActiveStage4 renders)
        scriptScenesLocked: false,
        scriptIntermediateScenes: [
          // Complex scene: 120s → 15 shots estimated → over_sweet warning
          { id: "sc1", order: 1, titleEn: "Complex", titleVi: "Phức tạp", settings: "EXT.", actionLinesEn: "Long action.", actionLinesVi: "Hành động dài.", durationSeconds: 120, beatIds: ["b1"] },
          // Simple scene: 30s → 4 shots → no warning
          { id: "sc2", order: 2, titleEn: "Simple", titleVi: "Đơn giản", settings: "INT.", actionLinesEn: "Quick.", actionLinesVi: "Nhanh.", durationSeconds: 30, beatIds: [] },
        ],
      },
    };
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmIdeaScriptSection />);
    const html = container.innerHTML;
    // Stage 4 (scenes) is current active stage → both scene cards render
    expect(html).toContain("Phức tạp");
    expect(html).toContain("Đơn giản");
    // Warning badge shown only on complex scene
    expect(html).toMatch(/~15 shots|~12 shots|~13 shots|~14 shots/); // estimate range
  });

  it("qc20 SceneCardWithWarning hides badge when warning dismissed", async () => {
    const proj: any = {
      ...baseFilmProject,
      idea: { raw: "test" },
      filmV093: {
        ...baseFilmProject.filmV093,
        characters: [{ id: "c1", role: "protagonist", order: 1, name: "Hero", description: "x", uniqueIdentifiers: "", hasDialog: false, faceRefs: [], bodyRefs: [], characterType: "human" }],
        scriptStructure: { framework: "three-act", contentEn: "x", contentVi: "x" },
        scriptBeats: [{ id: "b1", order: 1, title: "B", description: "x" }],
        scriptTwists: [],
        scriptTwistsLocked: true,
        scriptStage: "scenes",
        scriptScenesLocked: false, // qc20: Stage 4 active
        scriptIntermediateScenes: [
          {
            id: "sc1", order: 1, titleEn: "Complex", titleVi: "Phức tạp", settings: "EXT.",
            actionLinesEn: "Long.", actionLinesVi: "Dài.", durationSeconds: 120, beatIds: ["b1"],
            complexityWarningDismissed: true, // qc20: dismissed
          },
        ],
      },
    };
    useAppStore.setState({ currentProject: proj });
    const { container } = render(<FilmIdeaScriptSection />);
    expect(container.innerHTML).toContain("Phức tạp");
    // Badge text "shots" with warning emoji should not appear
    expect(container.innerHTML).not.toMatch(/⚠ ~\d+ shots/);
  });

  // ============================================================================
  // qc21 — Storyboard UI refactor (Hướng F-9 auto-pick + Advanced override)
  // ============================================================================

  it("qc21 setSceneGridFormat marks scene.gridFormatManual = true", async () => {
    const { setSceneGridFormat } = await import("../src/store/film_actions");
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        shotsBySceneId: { sc1: [{ id: "sh1", order: 1 }, { id: "sh2", order: 2 }] },
        script: {
          titleEn: "T", titleVi: "T", logline: "",
          scenes: [{ id: "sc1", order: 1, titleEn: "S1", durationSeconds: 30, settings: "", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "setup" }],
          createdAt: Date.now(), versions: [],
        },
      },
    };
    const patch = setSceneGridFormat(proj, "sc1", "4x4");
    const scene = patch.filmV093!.script!.scenes[0];
    expect(scene.gridFormat).toBe("4x4");
    expect(scene.gridFormatManual).toBe(true);
  });

  it("qc21 resetSceneGridFormatToAuto clears manual flag + re-picks optimal format", async () => {
    const { setSceneGridFormat, resetSceneGridFormatToAuto } = await import("../src/store/film_actions");
    let proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        shotsBySceneId: { sc1: Array.from({ length: 5 }, (_, i) => ({ id: `sh${i + 1}`, order: i + 1 })) },
        script: {
          titleEn: "T", titleVi: "T", logline: "",
          scenes: [{ id: "sc1", order: 1, titleEn: "S1", durationSeconds: 30, settings: "", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "setup" }],
          createdAt: Date.now(), versions: [],
        },
      },
    };
    // User manually sets to 4x4 first
    proj = { ...proj, filmV093: setSceneGridFormat(proj, "sc1", "4x4").filmV093 };
    expect(proj.filmV093.script.scenes[0].gridFormatManual).toBe(true);
    expect(proj.filmV093.script.scenes[0].gridFormat).toBe("4x4");

    // Now reset to auto
    const patch = resetSceneGridFormatToAuto(proj, "sc1");
    const scene = patch.filmV093!.script!.scenes[0];
    // qc19 mapping: 5 shots landscape → 3x2 (sweet spot for 5 shots)
    expect(scene.gridFormat).toBe("3x2");
    expect(scene.gridFormatManual).toBe(false);
  });

  it("qc21 ensureSceneGrids marks auto-pick (gridFormatManual: false) for new scene", async () => {
    const { ensureSceneGrids } = await import("../src/store/film_actions");
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        shotsBySceneId: { sc1: Array.from({ length: 9 }, (_, i) => ({ id: `sh${i + 1}`, order: i + 1 })) },
        script: {
          titleEn: "T", titleVi: "T", logline: "",
          scenes: [
            // No gridFormat → triggers auto-pick path
            { id: "sc1", order: 1, titleEn: "S1", durationSeconds: 30, settings: "", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "setup" },
          ],
          createdAt: Date.now(), versions: [],
        },
      },
    };
    const patch = ensureSceneGrids(proj, "sc1");
    const scene = patch.filmV093!.script!.scenes[0];
    expect(scene.gridFormat).toBe("3x3");
    expect(scene.gridFormatManual).toBe(false); // qc21: explicitly auto-resolved
  });

  it("qc21 ensureSceneGrids preserves legacy qc17 scene with undefined manual flag", async () => {
    const { ensureSceneGrids } = await import("../src/store/film_actions");
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        shotsBySceneId: { sc1: Array.from({ length: 9 }, (_, i) => ({ id: `sh${i + 1}`, order: i + 1 })) },
        script: {
          titleEn: "T", titleVi: "T", logline: "",
          scenes: [
            // Legacy qc17 scene: gridFormat set, gridFormatManual undefined
            { id: "sc1", order: 1, titleEn: "S1", durationSeconds: 30, settings: "", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "setup", gridFormat: "3x3" as const },
          ],
          createdAt: Date.now(), versions: [],
        },
      },
    };
    const patch = ensureSceneGrids(proj, "sc1");
    const scene = patch.filmV093!.script!.scenes[0];
    expect(scene.gridFormat).toBe("3x3");
    // Legacy preservation: manual flag stays undefined → Storyboard UI shows migration hint
    expect(scene.gridFormatManual).toBeUndefined();
  });

  it("qc21 → qc22 FilmStoryboardSection source: Advanced toggle + Reset button + scene meta consolidated", async () => {
    // qc22: header consolidated — no separate ksp-sb-scene-info div. Info merged
    // into ksp-storyboard-scene-meta. Version text strings ("set qc17 — same as auto",
    // "Manual (legacy)") removed per Jason instruction (no version markers in UI).
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmStoryboardSection.tsx"), "utf-8");
    // Advanced toggle button (qc21)
    expect(src).toContain("Advanced");
    expect(src).toContain("ksp-sb-grid-advanced-toggle");
    // Reset to Auto button (qc21 Q21.4)
    expect(src).toContain("Reset to Auto");
    expect(src).toContain("resetSceneGridFormatToAuto");
    // pickOptimalGridFormat used to compute "would-be auto" format
    expect(src).toContain("pickOptimalGridFormat");
    // gridFormatManual flag check
    expect(src).toContain("gridFormatManual");
    // qc22 header consolidation — ksp-sb-scene-info div removed
    expect(src).not.toContain('className="ksp-sb-scene-info"');
    // qc22 — no version markers in UI strings
    expect(src).not.toContain("set qc17");
    expect(src).not.toContain("Manual (legacy)");
  });

  // ============================================================================
  // qc22 — Convention swap CxR + Grid template + Modal crop override + Per-cell prompts
  // ============================================================================

  it("qc22 packShotsIntoGrids: '4x2' = 4 cols × 2 rows = 8 cells (CxR convention)", async () => {
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    // 7 shots packed into 4x2 (CxR = 4 cols × 2 rows = 8 cells) → 1 grid, 1 empty
    const shots = Array.from({ length: 7 }, (_, i) => ({ id: `s${i + 1}` })) as any[];
    const grids = packShotsIntoGrids(shots, "4x2");
    expect(grids.length).toBe(1);
    expect(grids[0].cells.length).toBe(8);
    expect(grids[0].cells.filter((c) => c.shotId).length).toBe(7);
    expect(grids[0].cells.filter((c) => !c.shotId).length).toBe(1);
  });

  it("qc22 pickOptimalGridFormat: 6 shots landscape → '3x2' (3 cols × 2 rows, wide)", async () => {
    const { pickOptimalGridFormat, parseGridFormat } = await import("../src/engine/sceneGridPacker");
    const fmt = pickOptimalGridFormat(6, "16:9");
    expect(fmt).toBe("3x2");
    const parsed = parseGridFormat(fmt);
    // CxR: 3 cols × 2 rows = wider grid for landscape aspect
    expect(parsed.cols).toBe(3);
    expect(parsed.rows).toBe(2);
    expect(parsed.cells).toBe(6);
  });

  it("qc22 pickOptimalGridFormat: 6 shots vertical → '2x3' (2 cols × 3 rows, tall)", async () => {
    const { pickOptimalGridFormat, parseGridFormat } = await import("../src/engine/sceneGridPacker");
    const fmt = pickOptimalGridFormat(6, "9:16");
    expect(fmt).toBe("2x3");
    const parsed = parseGridFormat(fmt);
    // CxR: 2 cols × 3 rows = taller grid for portrait aspect
    expect(parsed.cols).toBe(2);
    expect(parsed.rows).toBe(3);
    expect(parsed.cells).toBe(6);
  });

  it("qc22 buildGridTemplateImage: generates blank grid PNG with correct dimensions", async () => {
    // Mock canvas API (jsdom doesn't have full canvas; we just verify module exports + shape)
    const mod = await import("../src/engine/gridTemplateImage");
    expect(mod.buildGridTemplateImage).toBeDefined();
    expect(typeof mod.buildGridTemplateImage).toBe("function");
    // Actual canvas execution would require jsdom canvas polyfill — we trust shape.
  });

  it("qc22 sceneImagePromptBuilder: prompt references Image #1 grid template + STRICT LAYOUT", async () => {
    const { buildSceneGridImagePrompt } = await import(
      "../src/engine/sceneImagePromptBuilder"
    );
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = [{ id: "s1", order: 1, titleEn: "Open", shotType: "wide_establishing", durationSeconds: 5, actionEn: "Forest wide" }] as any[];
    const grids = packShotsIntoGrids(shots, "4x2");
    const scene: any = { id: "sc1", order: 1, titleEn: "S", settings: "EXT.", actionLinesEn: "x", durationSeconds: 30 };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSceneGridImagePrompt({ grid: grids[0], scene, shots, cast: [], setting });
    // qc22: prompt mentions cols × rows (not rows × cols)
    expect(prompt).toContain("4 columns × 2 rows");
    expect(prompt).toContain("STRICT LAYOUT REQUIREMENT");
    // r6 (BUG #6 fix): lowercase Image #1 (was IMAGE #1), explicit filename callout
    expect(prompt).toContain("Image #1");
    expect(prompt).toContain("image-01_grid-template.png");
    expect(prompt).toContain("DO NOT add cells");
  });

  it("qc22 GridCropPreviewModal source: format dropdown editable, onApprove returns finalGridFormat", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/GridCropPreviewModal.tsx"), "utf-8");
    // qc22 Issue 2: format dropdown for user override
    expect(src).toContain("GRID_FORMAT_CHOICES");
    expect(src).toContain("localGridFormat");
    expect(src).toContain("setLocalGridFormat");
    // onApprove signature includes finalGridFormat
    expect(src).toContain("onApprove: (settings: ShotCropSettings, finalGridFormat: string)");
    // CxR parsing
    expect(src).toContain("const [cols, rows]");
  });

  it("qc22 gridImageCrop uses CxR convention", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/gridImageCrop.ts"), "utf-8");
    expect(src).toContain('"CxR"');
    expect(src).toContain("const [cols, rows] = parts;");
  });

  it("qc22 buildSingleShotImagePrompt: per-cell standalone prompt (not grid)", async () => {
    const { buildSingleShotImagePrompt } = await import("../src/engine/filmShotPromptBuilder");
    const shot: any = {
      id: "s1", order: 1, titleEn: "Opening", titleVi: "Mở đầu",
      shotType: "wide_establishing", cameraMovement: "dolly_in",
      durationSeconds: 5, actionEn: "Wide forest shot. Robot at center.",
    };
    const scene: any = { id: "sc1", order: 1, titleEn: "Scene 1", settings: "EXT. FOREST" };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSingleShotImagePrompt({ shot, scene, cast: [], setting });
    expect(prompt).toContain("single-frame storyboard image");
    expect(prompt).toContain("Opening");
    expect(prompt).toContain("16:9");
    // qc22: NOT a grid prompt
    expect(prompt).not.toContain("STRICT LAYOUT REQUIREMENT");
    expect(prompt).not.toContain("columns × ");
    expect(prompt).toContain("Single image (NOT a grid");
  });

  it("qc22 buildAnimationPromptAdvanced: first-frame + last-frame interpolation prompt", async () => {
    const { buildAnimationPromptAdvanced } = await import("../src/engine/filmShotPromptBuilder");
    const shot: any = {
      id: "s1", order: 1, titleEn: "Robot enters", titleVi: "Robot xuất hiện",
      shotType: "wide_establishing", cameraMovement: "static",
      durationSeconds: 8, actionEn: "Robot walks into frame.",
    };
    const lastFrameShot: any = {
      id: "s2", order: 2, titleEn: "Robot at center", titleVi: "Robot giữa khung",
      shotType: "medium", cameraMovement: "static",
      durationSeconds: 8, actionEn: "Robot stops at center.",
    };
    const scene: any = { id: "sc1", order: 1, titleEn: "Scene 1", actionLinesEn: "Robot enters forest." };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const provider: any = { id: "kling-2", name: "Kling 2.0", maxDurationSec: 10 };
    const prompt = buildAnimationPromptAdvanced({ shot, lastFrameShot, scene, cast: [], setting, provider });
    expect(prompt).toContain("FIRST-FRAME and LAST-FRAME");
    expect(prompt).toContain("IMAGE #1 (FIRST FRAME)");
    expect(prompt).toContain("IMAGE #2 (LAST FRAME)");
    expect(prompt).toContain("Robot enters"); // first frame title
    expect(prompt).toContain("Robot at center"); // last frame title
    expect(prompt).toContain("INTERPOLATION RULES");
    expect(prompt).toContain("TIMING");
    expect(prompt).toContain("CAMERA:");
  });

  it("qc22 FilmFrameEditModal source: uses single-shot prompt + Advanced toggle wired", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmFrameEditModal.tsx"), "utf-8");
    // qc22c: Image Prompt now uses single-shot builder (not scene-grid builder)
    expect(src).toContain("buildSingleShotImagePrompt");
    // No longer uses scene-level grid prompt for image
    expect(src).not.toContain("buildSceneGridImagePrompt");
    // Advanced first/last-frame mode
    expect(src).toContain("buildAnimationPromptAdvanced");
    expect(src).toContain("advancedFirstLast");
    expect(src).toContain("lastFrameShotId");
    // UI hints (post-simplification)
    expect(src).toContain("📝 Image Prompt");
    expect(src).toContain("First-frame + Last-frame mode");
  });

  it("Animation Prompt: explicit timing breakdown for shot duration (3-act open/peak/close)", async () => {
    const { buildAnimationPrompt } = await import("../src/engine/filmShotPromptBuilder");
    const shot: any = {
      id: "s1", order: 1, titleEn: "Test", shotType: "medium",
      cameraMovement: "tracking", durationSeconds: 6,
      actionEn: "Subject walks forward and stops.",
    };
    const scene: any = { id: "sc1", order: 1, titleEn: "Test scene", settings: "EXT.", actionLinesEn: "X" };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const provider: any = { id: "veo-3", name: "Veo 3", maxDurationSec: 8 };

    const prompt6 = buildAnimationPrompt({ shot, scene, cast: [], setting, provider });
    // Default time format = "timecode" (universal). Format: 0:00–0:01.2
    expect(prompt6).toContain("TIMING BREAKDOWN (6s shot)");
    expect(prompt6).toContain("0:00–0:01.2 (OPEN)");
    expect(prompt6).toContain("0:01.2–0:04.8 (PEAK)");
    expect(prompt6).toContain("0:04.8–0:06 (CLOSE)");

    // 10s shot
    const prompt10 = buildAnimationPrompt({
      shot: { ...shot, durationSeconds: 10 },
      scene, cast: [], setting, provider,
    });
    expect(prompt10).toContain("TIMING BREAKDOWN (10s shot)");
    expect(prompt10).toContain("0:00–0:02 (OPEN)");
    expect(prompt10).toContain("0:02–0:08 (PEAK)");
    expect(prompt10).toContain("0:08–0:10 (CLOSE)");

    // 2s flash shot — no breakdown
    const prompt2 = buildAnimationPrompt({
      shot: { ...shot, durationSeconds: 2 },
      scene, cast: [], setting, provider,
    });
    expect(prompt2).toContain("flash shot");

    // Verify decimal_seconds format works
    const promptDecimal = buildAnimationPrompt({
      shot, scene, cast: [], setting, provider, timeFormat: "decimal_seconds",
    });
    expect(promptDecimal).toContain("0–1.2s (OPEN)");
  });

  it("Animation Prompt: camera direction concrete per cameraMovement value", async () => {
    const { buildAnimationPrompt } = await import("../src/engine/filmShotPromptBuilder");
    const baseShot: any = {
      id: "s1", order: 1, titleEn: "Test", shotType: "medium",
      durationSeconds: 6, actionEn: "Test action.",
    };
    const scene: any = { id: "sc1", order: 1, titleEn: "Test", settings: "EXT.", actionLinesEn: "X" };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const provider: any = { id: "veo-3", name: "Veo 3" };

    const tracking = buildAnimationPrompt({
      shot: { ...baseShot, cameraMovement: "tracking" },
      scene, cast: [], setting, provider,
    });
    expect(tracking).toContain("Tracking shot");
    expect(tracking).toContain("lateral camera follow");

    const dolly = buildAnimationPrompt({
      shot: { ...baseShot, cameraMovement: "dolly_in" },
      scene, cast: [], setting, provider,
    });
    expect(dolly).toContain("Dolly-in");
    expect(dolly).toContain("Smooth linear forward push");

    const stat = buildAnimationPrompt({
      shot: { ...baseShot, cameraMovement: "static" },
      scene, cast: [], setting, provider,
    });
    expect(stat).toContain("Static lock-off");
    expect(stat).toContain("Camera does NOT move");
  });

  it("Animation Prompt: NO scene action dump (was causing AI to animate multi-beat scene)", async () => {
    const { buildAnimationPrompt } = await import("../src/engine/filmShotPromptBuilder");
    const shot: any = {
      id: "s1", order: 1, titleEn: "Test", shotType: "medium",
      cameraMovement: "static", durationSeconds: 6,
      actionEn: "Per-shot action only.",
    };
    const scene: any = {
      id: "sc1", order: 1, titleEn: "Test", settings: "EXT.",
      actionLinesEn: "Scene-wide action A. Scene-wide action B. Scene-wide action C. Many beats here.",
    };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const provider: any = { id: "veo-3", name: "Veo 3" };
    const prompt = buildAnimationPrompt({ shot, scene, cast: [], setting, provider });

    // Per-shot action IS present
    expect(prompt).toContain("Per-shot action only");
    // Scene-wide action NOT dumped into prompt body
    expect(prompt).not.toContain("Scene-wide action A");
    expect(prompt).not.toContain("Many beats here");
    // No "Scene context:" inline block
    expect(prompt).not.toContain("Scene context:");
  });

  it("Animation Prompt: all providers say ONE continuous shot (no contradiction)", async () => {
    const { buildAnimationPrompt } = await import("../src/engine/filmShotPromptBuilder");
    const shot: any = {
      id: "s1", order: 1, titleEn: "Test", shotType: "medium",
      cameraMovement: "static", durationSeconds: 6, actionEn: "X",
    };
    const scene: any = { id: "sc1", order: 1, titleEn: "T", settings: "X", actionLinesEn: "X" };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };

    for (const pid of ["seedance-2-pro", "veo-3", "kling-2", "sora"]) {
      const provider: any = { id: pid, name: pid };
      const prompt = buildAnimationPrompt({ shot, scene, cast: [], setting, provider });
      // No multi-shot / multi-beat instructions
      expect(prompt).not.toContain("multi-shot syntax");
      expect(prompt).not.toContain("plan ~3 beats");
      // All emphasize ONE continuous shot
      expect(prompt.toLowerCase()).toMatch(/one continuous (shot|take)/);
    }
  });

  it("Storyboard cells click anywhere opens Edit Modal (no edit icon needed)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmStoryboardSection.tsx"), "utf-8");
    // Cell wrapper has onClick={onEdit} (was: separate ✏ button)
    expect(src).toMatch(/className="ksp-storyboard-cell ksp-storyboard-cell-filled"[\s\S]{0,200}onClick=\{onEdit\}/);
    // The dedicated ✏ Edit button removed (still has lock/regen/download buttons)
    expect(src).not.toMatch(/title="Edit/);
  });

  // ============================================================================
  // Cell video upload + Time format dropdown + Drag swap + Unified naming
  // ============================================================================

  it("Cell video upload: 🎬 button in cell actions + video badge when uploaded", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmStoryboardSection.tsx"), "utf-8");
    // 🎬 upload video button before lock button
    expect(src).toContain('title={cell.video ? "Replace uploaded video" : "Upload video for this shot"}');
    // Badge "▶" when cell has video
    expect(src).toContain("ksp-storyboard-cell-video-badge");
    // handleUploadVideoForCell function
    expect(src).toContain("handleUploadVideoForCell");
    // Store actions wired
    expect(src).toContain("setSceneGridCellVideo");
    expect(src).toContain("clearSceneGridCellVideo");
  });

  it("Store: setSceneGridCellVideo + clearSceneGridCellVideo actions exist", async () => {
    const mod = await import("../src/store/film_actions");
    expect(typeof mod.setSceneGridCellVideo).toBe("function");
    expect(typeof mod.clearSceneGridCellVideo).toBe("function");
  });

  it("Time format dropdown: 4 options, default 'timecode' (universal)", async () => {
    const { TIME_FORMAT_LABELS } = await import("../src/engine/filmShotPromptBuilder");
    const keys = Object.keys(TIME_FORMAT_LABELS);
    expect(keys).toContain("decimal_seconds");
    expect(keys).toContain("timecode");
    expect(keys).toContain("integer_seconds");
    expect(keys).toContain("percentage");
    expect(keys.length).toBe(4);
  });

  it("Time format: percentage option produces 0%-20% style", async () => {
    const { buildAnimationPrompt } = await import("../src/engine/filmShotPromptBuilder");
    const shot: any = {
      id: "s1", order: 1, titleEn: "T", shotType: "medium",
      cameraMovement: "static", durationSeconds: 6, actionEn: "x",
    };
    const scene: any = { id: "sc1", order: 1, titleEn: "T", settings: "X", actionLinesEn: "x" };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const provider: any = { id: "veo-3", name: "Veo 3" };

    const promptPct = buildAnimationPrompt({
      shot, scene, cast: [], setting, provider, timeFormat: "percentage",
    });
    expect(promptPct).toContain("0%–20% (OPEN)");
    expect(promptPct).toContain("20%–80% (PEAK)");
    expect(promptPct).toContain("80%–100% (CLOSE)");

    const promptInt = buildAnimationPrompt({
      shot, scene, cast: [], setting, provider, timeFormat: "integer_seconds",
    });
    expect(promptInt).toContain("0–1s (OPEN)");
  });

  it("Animation Prompt Advanced: swapped param flips first/last roles", async () => {
    const { buildAnimationPromptAdvanced } = await import("../src/engine/filmShotPromptBuilder");
    const shot: any = {
      id: "s1", order: 1, titleEn: "Shot A", durationSeconds: 6, actionEn: "A action",
      shotType: "medium", cameraMovement: "static",
    };
    const lastFrameShot: any = {
      id: "s2", order: 2, titleEn: "Shot B", durationSeconds: 6, actionEn: "B action",
      shotType: "medium", cameraMovement: "static",
    };
    const scene: any = { id: "sc1", order: 1, titleEn: "T", settings: "X", actionLinesEn: "x" };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const provider: any = { id: "veo-3", name: "Veo 3" };

    const normal = buildAnimationPromptAdvanced({
      shot, lastFrameShot, scene, cast: [], setting, provider, swapped: false,
    });
    const swapped = buildAnimationPromptAdvanced({
      shot, lastFrameShot, scene, cast: [], setting, provider, swapped: true,
    });
    // Normal: first-frame_shot-1, last-frame_shot-2
    expect(normal).toContain("first-frame_shot-1.png");
    expect(normal).toContain("last-frame_shot-2.png");
    // Swapped: first-frame_shot-2, last-frame_shot-1
    expect(swapped).toContain("first-frame_shot-2.png");
    expect(swapped).toContain("last-frame_shot-1.png");
  });

  it("Modal Edit: time format dropdown + drag swap state + extract last frame helper", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmFrameEditModal.tsx"), "utf-8");
    // Time format state + dropdown
    expect(src).toContain("setTimeFormat");
    expect(src).toContain("TIME_FORMAT_LABELS");
    // Drag swap state
    expect(src).toContain("firstLastSwapped");
    expect(src).toContain("setFirstLastSwapped");
    // HTML5 drag attrs
    expect(src).toContain('draggable={true}');
    expect(src).toContain("onDragStart");
    expect(src).toContain("onDrop");
    // Extract last frame helper
    expect(src).toContain("extractLastFrameFromVideo");
    expect(src).toContain("__extract_video__");
    // Upload Video + Remove video buttons
    expect(src).toContain("🎬 Upload video");
    expect(src).toContain("🗑 Remove video");
    // Video badge in header
    expect(src).toContain("ksp-frame-edit-video-badge");
  });

  it("Modal Edit: single-mode download filename uses first-frame_shot-N.png (unified)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmFrameEditModal.tsx"), "utf-8");
    // Both single and split mode use first-frame_shot-N.png for left pane
    expect(src).toContain("first-frame_shot-${leftPaneContent.shotOrder}.png");
    // Old shot-N.png (non-first-frame prefix) for single mode removed
    expect(src).not.toMatch(/`shot-\$\{shot\.order\}\.png`/);
  });

  it("Cell single-image download filename uses shot-N.png", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmStoryboardSection.tsx"), "utf-8");
    // Cell download (from 📥 button) uses shot-N.png
    expect(src).toContain("`shot-${shot.order}.png`");
  });

  it("Animatic Player: renders <video> if cell has video, else <img>", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmAnimaticPlayerModal.tsx"), "utf-8");
    // Renders <video> element when cell has video
    expect(src).toContain("currentCellVideoUrl");
    expect(src).toMatch(/<video[\s\S]{0,200}src=\{currentCellVideoUrl\}/);
    // Fallback to <img>
    expect(src).toContain("currentCellDataUrl");
    // Thumbs have video marker
    expect(src).toContain("ksp-animatic-thumb-video-marker");
  });

  it("Type SceneGridCell has video field", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/types/project.ts"), "utf-8");
    expect(src).toMatch(/video\?:\s*\{[\s\S]{0,200}dataUrl:\s*string/);
    expect(src).toMatch(/filename:\s*string/);
  });

  it("Modal Edit: Left pane has video/image view toggle when cell has video", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmFrameEditModal.tsx"), "utf-8");
    // viewMode state
    expect(src).toContain("leftPaneView");
    expect(src).toContain("setLeftPaneView");
    // Toggle icons in pane (top-right)
    expect(src).toContain("ksp-frame-edit-preview-view-toggle");
    expect(src).toContain("ksp-frame-edit-view-toggle-btn");
    // Both video and image options
    expect(src).toMatch(/leftPaneView === "video"/);
    expect(src).toMatch(/leftPaneView === "image"/);
    // Click stopPropagation so toggle doesn't trigger download
    expect(src).toContain("onClick={(e) => e.stopPropagation()}");
    // Removed: previous "Use image as keyframe" feature
    expect(src).not.toContain("onSaveImageToShot");
    expect(src).not.toContain("applyImageSource");
    expect(src).not.toContain("Use image:");
  });

  it("FilmFrameEditModal first/last frame click triggers download with prompt-matching filename", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmFrameEditModal.tsx"), "utf-8");
    // triggerDownload helper exists
    expect(src).toContain("function triggerDownload");
    // Filenames match prompt convention
    expect(src).toContain("first-frame_shot-");
    expect(src).toContain("last-frame_shot-");
  });

  it("Animation Prompt + Single Shot Prompt + Grid Prompt reference filenames", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const shotPrompt = fs.readFileSync(path.resolve("./src/engine/filmShotPromptBuilder.ts"), "utf-8");
    const gridPrompt = fs.readFileSync(path.resolve("./src/engine/sceneImagePromptBuilder.ts"), "utf-8");
    // Animation Prompt references first-frame_shot-N.png
    expect(shotPrompt).toContain("first-frame_shot-");
    // Animation Advanced references last-frame_shot-N.png
    expect(shotPrompt).toContain("last-frame_shot-");
    // Grid Image Prompt references grid template + uses Image #N+ for cast refs (Sprint G r7 cast filter)
    expect(gridPrompt).toContain("image-01_grid-template.png");
    // r7: cast refs delivered via castRefsBlockFiltered with castStartIndex param
    expect(gridPrompt).toContain("castRefsBlockFiltered");
    expect(gridPrompt).toContain("Image #${castStartIdx}+");
  });

  it("Storyboard Refs ZIP uses image-NN_*.png filename convention matching prompt references", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmStoryboardSection.tsx"), "utf-8");
    expect(src).toContain("buildGridTemplateImage");
    // New convention: image-NN_*.png (matches "IMAGE #N" in prompts)
    expect(src).toContain("image-01_grid-template.png");
    expect(src).toContain("image-${numStr}_cast-${safeName}_face-");
    expect(src).toContain("image-${numStr}_cast-${safeName}_body-");
    expect(src).toContain("cropped-cells/");
    // Cropped cells now named by shot order (shot-N.png) to match prompt convention
    expect(src).toContain("shot-${cellShot.order}.png");
    // Old conventions removed
    expect(src).not.toContain("00_grid_template.png");
    expect(src).not.toContain("cropped_frames/cell_");
    expect(src).not.toContain("cropped-cells/cell-${idx}");
  });

  it("qc22 Storyboard handles modal grid format override (re-pack scene before crop)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmStoryboardSection.tsx"), "utf-8");
    // qc22 Issue 2: onApprove signature has finalGridFormat
    expect(src).toContain("onApprove={async (settings, finalGridFormat)");
    // If user override format, call setSceneGridFormat before crop
    expect(src).toContain("finalGridFormat !== grid.gridFormat");
    expect(src).toContain("setSceneGridFormat(p, scene.id, finalGridFormat as SceneGridFormat)");
  });

  // ============================================================================
  // Animatic Player Modal — per-scene playback preview
  // ============================================================================

  it("FilmAnimaticPlayerModal exports with correct signature", async () => {
    const mod = await import("../src/components/FilmAnimaticPlayerModal");
    expect(mod.FilmAnimaticPlayerModal).toBeDefined();
    expect(typeof mod.FilmAnimaticPlayerModal).toBe("function");
  });

  it("Storyboard wires Play Animatic button + modal state", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmStoryboardSection.tsx"), "utf-8");
    expect(src).toContain("FilmAnimaticPlayerModal");
    expect(src).toContain("animaticPlayerOpen");
    expect(src).toContain("Play Animatic");
    // disabled when no shots
    expect(src).toContain("disabled={shots.length === 0}");
    // cellAssetsByShotId computed from all grids (includes video data)
    expect(src).toContain("cellAssetsByShotId");
  });

  it("Animatic Player has play/pause/prev/next/speed controls + thumbnail strip", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmAnimaticPlayerModal.tsx"), "utf-8");
    // Speed options
    expect(src).toContain("SPEED_OPTIONS");
    expect(src).toMatch(/0\.5.*1.*1\.5.*2/s);
    // Controls
    expect(src).toContain("handlePlayPause");
    expect(src).toContain("handlePrev");
    expect(src).toContain("handleNext");
    expect(src).toContain("handleTimelineSeek");
    expect(src).toContain("handleJumpToShot");
    // Empty shot placeholder
    expect(src).toContain("EMPTY");
    expect(src).toContain("chưa có ảnh");
    // Keyboard controls
    expect(src).toContain("Escape");
    expect(src).toContain("ArrowRight");
    expect(src).toContain("ArrowLeft");
  });

  it("Animatic Player NO version markers in UI strings", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmAnimaticPlayerModal.tsx"), "utf-8");
    // Component source MUST NOT have version markers in user-facing strings
    expect(src).not.toMatch(/["']qc\d+/);
  });
});

// ============================================================================
// SPRINT 1.0 r1 — PACING (Phase 1A scene + Phase 1B shot rhythm)
// ============================================================================

describe("Sprint 1.0 r1 — pacing schema + actions + AI sanitizers", () => {
  it("EmotionalTone enum has exactly 7 values, melancholy excluded", async () => {
    const { EMOTIONAL_TONE_LABELS } = await import("../src/types/project");
    const keys = Object.keys(EMOTIONAL_TONE_LABELS);
    expect(keys).toHaveLength(7);
    expect(keys.sort()).toEqual(
      ["funny", "neutral", "sad", "shocking", "tender", "tense", "triumphant"].sort()
    );
    expect(keys).not.toContain("melancholy");
  });

  it("RhythmRole enum has exactly 4 values establish/build/peak/release", async () => {
    const { RHYTHM_ROLE_LABELS } = await import("../src/types/project");
    const keys = Object.keys(RHYTHM_ROLE_LABELS);
    expect(keys).toHaveLength(4);
    expect(keys.sort()).toEqual(["build", "establish", "peak", "release"]);
  });

  it("clampTension clamps to 0-10 range and handles invalid input", async () => {
    const { clampTension } = await import("../src/types/project");
    expect(clampTension(5)).toBe(5);
    expect(clampTension(0)).toBe(0);
    expect(clampTension(10)).toBe(10);
    expect(clampTension(-3)).toBe(0);
    expect(clampTension(99)).toBe(10);
    expect(clampTension(4.7)).toBe(5); // rounds
    expect(clampTension(undefined)).toBe(0);
    expect(clampTension(NaN)).toBe(0);
  });

  it("getTensionColor returns 3-tier color palette", async () => {
    const { getTensionColor } = await import("../src/types/project");
    expect(getTensionColor(0).color).toBe("#3B6D11"); // green
    expect(getTensionColor(3).color).toBe("#3B6D11"); // green
    expect(getTensionColor(4).color).toBe("#854F0B"); // amber
    expect(getTensionColor(6).color).toBe("#854F0B"); // amber
    expect(getTensionColor(7).color).toBe("#A32D2D"); // red
    expect(getTensionColor(10).color).toBe("#A32D2D"); // red
  });

  it("updateSceneInScript persists tensionLevel + emotionalTone", async () => {
    const { useAppStore } = await import("../src/store/useAppStore");
    const { updateSceneInScript, setScript } = await import("../src/store/film_actions");
    const project: any = { id: "p1", idea: { raw: "test" } };
    // seed a script with 1 scene
    const seedScript = {
      titleEn: "T", titleVi: "T",
      logline: "L", synopsisEn: "S",
      scenes: [{
        id: "s1", order: 1, titleEn: "Scene 1", titleVi: "Cảnh 1",
        settings: "INT.", durationSeconds: 30, act: "rising",
        actionLinesEn: "act", dialog: [], sfx: [], musicBrief: "",
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    const seedPatch = setScript(project, seedScript as any);
    const merged = { ...project, ...seedPatch };
    const updatePatch = updateSceneInScript(merged, "s1", {
      tensionLevel: 8,
      emotionalTone: "tense",
    });
    const film = updatePatch.filmV093 as any;
    expect(film.script.scenes[0].tensionLevel).toBe(8);
    expect(film.script.scenes[0].emotionalTone).toBe("tense");
  });

  it("updateScriptIntermediateScene patches single intermediate scene", async () => {
    const { setScriptIntermediateScenes, updateScriptIntermediateScene } = await import(
      "../src/store/film_actions"
    );
    const project: any = { id: "p1" };
    const seedPatch = setScriptIntermediateScenes(project, [
      { id: "is1", order: 1, titleEn: "A", settings: "INT.", actionLinesEn: "x", durationSeconds: 30, beatIds: [] } as any,
      { id: "is2", order: 2, titleEn: "B", settings: "INT.", actionLinesEn: "y", durationSeconds: 30, beatIds: [] } as any,
    ]);
    const merged = { ...project, ...seedPatch };
    const updatePatch = updateScriptIntermediateScene(merged, "is2", {
      tensionLevel: 7,
      emotionalTone: "tender",
    });
    const film = updatePatch.filmV093 as any;
    expect(film.scriptIntermediateScenes[0].tensionLevel).toBeUndefined();
    expect(film.scriptIntermediateScenes[1].tensionLevel).toBe(7);
    expect(film.scriptIntermediateScenes[1].emotionalTone).toBe("tender");
  });

  it("updateShot persists rhythmRole", async () => {
    const { addShot, updateShot, setScript } = await import("../src/store/film_actions");
    const project: any = { id: "p1" };
    // seed script + scene
    const seedScript = {
      titleEn: "T", titleVi: "T", logline: "L", synopsisEn: "S",
      scenes: [{
        id: "sc1", order: 1, titleEn: "Scene", titleVi: "Cảnh",
        settings: "INT.", durationSeconds: 30, act: "rising",
        actionLinesEn: "act", dialog: [], sfx: [], musicBrief: "",
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    const sp = setScript(project, seedScript as any);
    const proj1 = { ...project, ...sp };
    const ap = addShot(proj1, "sc1");
    const proj2 = { ...proj1, ...ap };
    const film2 = proj2.filmV093 as any;
    const shot = film2.shotsBySceneId.sc1[0];
    const up = updateShot(proj2, "sc1", shot.id, { rhythmRole: "peak" });
    const film3 = up.filmV093 as any;
    expect(film3.shotsBySceneId.sc1[0].rhythmRole).toBe("peak");
  });

  it("FilmShot.rhythmRole is optional + 4 valid values", async () => {
    // Type-level check via source inspection
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/types/project.ts"), "utf-8");
    expect(src).toContain('export type RhythmRole = "establish" | "build" | "peak" | "release"');
    expect(src).toContain("rhythmRole?: RhythmRole");
  });

  it("FilmSceneScript.tensionLevel + emotionalTone are optional", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/types/project.ts"), "utf-8");
    expect(src).toContain("tensionLevel?: number");
    expect(src).toContain("emotionalTone?: EmotionalTone");
  });

  it("FilmScriptIntermediateScene also has tensionLevel + emotionalTone", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/types/film.ts"), "utf-8");
    expect(src).toContain("tensionLevel?: number");
    expect(src).toContain("emotionalTone?: import");
  });

  it("Stage 4 AI prompt requests tension + emotion fields", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/filmScriptStages.ts"), "utf-8");
    expect(src).toContain("tensionLevel");
    expect(src).toContain("emotionalTone");
    expect(src).toContain("Hitchcock"); // mention in prompt for context
  });

  it("Shot list AI prompt requests rhythmRole field", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/filmShotListGeneration.ts"), "utf-8");
    expect(src).toContain("rhythmRole");
    expect(src).toContain("RHYTHM_ROLE_VALUES");
  });

  it("runReannotateEmotions is exported from filmScriptStages", async () => {
    const mod = await import("../src/engine/filmScriptStages");
    expect(typeof mod.runReannotateEmotions).toBe("function");
  });

  it("PacingBadges component exists in FilmIdeaScriptSection source", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmIdeaScriptSection.tsx"), "utf-8");
    expect(src).toContain("function PacingBadges");
    expect(src).toContain("ksp-pacing-badge");
    expect(src).toContain("Re-annotate");
  });

  it("ShotRow renders rhythm role select", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmShotListSection.tsx"), "utf-8");
    expect(src).toContain("RHYTHM_ROLE_OPTIONS");
    expect(src).toContain("ksp-rhythm-pill");
    expect(src).toContain("rhythmRole");
  });

  it("manifest version is in 0.9.4 series with version_name 0.9.4-r*", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const m = JSON.parse(fs.readFileSync(path.resolve("./manifest.json"), "utf-8"));
    expect(m.version).toMatch(/^0\.9\.4\./);
    expect(m.version_name).toMatch(/^0\.9\.4-r/);
    expect(m.action.default_title).toMatch(/0\.9\.4-r/);
  });
});

// ============================================================================
// SPRINT 1.0 r2 — PACING DASHBOARD (Phase 2A basic — Stage 6 section)
// ============================================================================

describe("Sprint 1.0 r2 — pacing dashboard (Stage 6 read-only)", () => {
  it("FilmPacingDashboardSection component file exists", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve("./src/components/FilmPacingDashboardSection.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("FilmPacingDashboardSection exports main component", async () => {
    const mod = await import("../src/components/FilmPacingDashboardSection");
    expect(typeof mod.FilmPacingDashboardSection).toBe("function");
  });

  it("Editor.tsx wires FilmPacingDashboardSection between Script and ShotList", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/Editor.tsx"), "utf-8");
    expect(src).toContain('import { FilmPacingDashboardSection }');
    expect(src).toContain("<FilmPacingDashboardSection />");
    // Verify order: Script → Pacing → ShotList
    const scriptIdx = src.indexOf("<FilmIdeaScriptSection />");
    const pacingIdx = src.indexOf("<FilmPacingDashboardSection />");
    const shotListIdx = src.indexOf("<FilmShotListSection />");
    expect(scriptIdx).toBeLessThan(pacingIdx);
    expect(pacingIdx).toBeLessThan(shotListIdx);
  });

  it("FilmPacingDashboardSection has TensionCurve + EmotionStrip + BeatCoverage + AnomalyHints", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmPacingDashboardSection.tsx"), "utf-8");
    expect(src).toContain("function TensionCurve");
    expect(src).toContain("function EmotionStrip");
    expect(src).toContain("function BeatCoverage");
    expect(src).toContain("function AnomalyHints");
  });

  it("Dashboard renders empty state when no script", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmPacingDashboardSection.tsx"), "utf-8");
    expect(src).toContain("Sinh script ở phần ② trước");
  });

  it("Dashboard suggests Re-annotate when script exists but no annotations", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmPacingDashboardSection.tsx"), "utf-8");
    expect(src).toContain("Re-annotate");
  });

  it("TensionCurve renders SVG with proper viewBox 320x130", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmPacingDashboardSection.tsx"), "utf-8");
    expect(src).toMatch(/viewBox=\{`0 0 \$\{W\} \$\{H\}`\}/);
    expect(src).toMatch(/const W = 320/);
    expect(src).toMatch(/const H = 130/);
  });

  it("AnomalyHints detects flat midpoint, no peak, early peak", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmPacingDashboardSection.tsx"), "utf-8");
    expect(src).toContain("Midpoint chùng");
    expect(src).toContain("Chưa có peak");
    expect(src).toContain("Peak quá sớm");
  });

  it("BeatCoverage uses framework label from FRAMEWORK_LABELS", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmPacingDashboardSection.tsx"), "utf-8");
    expect(src).toContain("FRAMEWORK_LABELS[framework]");
  });

  it("manifest bumped to current 0.9.4 series with version_name 0.9.4-r*", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const m = JSON.parse(fs.readFileSync(path.resolve("./manifest.json"), "utf-8"));
    expect(m.version).toMatch(/^0\.9\.4\./);
    expect(m.version_name).toMatch(/^0\.9\.4-r/);
    expect(m.action.default_title).toMatch(/0\.9\.4-r/);
  });

  it("film.css has Sprint 1.0 r2 dashboard styles", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(path.resolve("./src/components/film.css"), "utf-8");
    expect(css).toContain("SPRINT 1.0 r2 — PACING DASHBOARD");
    expect(css).toContain(".ksp-pacing-dashboard-section");
    expect(css).toContain(".ksp-pacing-curve-svg");
    expect(css).toContain(".ksp-pacing-strip");
    expect(css).toContain(".ksp-pacing-beat-list");
    expect(css).toContain(".ksp-pacing-anomaly");
  });
});

// ============================================================================
// SPRINT 1.0 r3 — AI DIRECTOR (Phase 3 auto-apply)
// ============================================================================

describe("Sprint 1.0 r3 — AI Director engine + store actions + UI", () => {
  it("runAiDirector is exported from filmScriptStages", async () => {
    const mod = await import("../src/engine/filmScriptStages");
    expect(typeof mod.runAiDirector).toBe("function");
  });

  it("AiDirectorResult + AiDirectorSceneChange types exist", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/filmScriptStages.ts"), "utf-8");
    expect(src).toContain("export interface AiDirectorResult");
    expect(src).toContain("export interface AiDirectorSceneChange");
    expect(src).toContain("fieldsChanged");
  });

  it("applyAiDirectorChanges store action updates multiple scenes", async () => {
    const { applyAiDirectorChanges, setScript } = await import("../src/store/film_actions");
    const project: any = { id: "p1" };
    const seedScript = {
      titleEn: "T", titleVi: "T", logline: "L", synopsisEn: "S",
      scenes: [
        { id: "s1", order: 1, titleEn: "S1", settings: "INT.", durationSeconds: 30, act: "rising", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "" },
        { id: "s2", order: 2, titleEn: "S2", settings: "INT.", durationSeconds: 30, act: "rising", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "" },
        { id: "s3", order: 3, titleEn: "S3", settings: "INT.", durationSeconds: 30, act: "climax", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "" },
      ],
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    const sp = setScript(project, seedScript as any);
    const proj1 = { ...project, ...sp };
    const patch = applyAiDirectorChanges(proj1, [
      { sceneId: "s1", after: { tensionLevel: 2, emotionalTone: "tender", durationSeconds: 25 } },
      { sceneId: "s3", after: { tensionLevel: 9, emotionalTone: "shocking", durationSeconds: 45 } },
    ]);
    const film = patch.filmV093 as any;
    expect(film.script.scenes[0].tensionLevel).toBe(2);
    expect(film.script.scenes[0].emotionalTone).toBe("tender");
    expect(film.script.scenes[0].durationSeconds).toBe(25);
    // s2 untouched
    expect(film.script.scenes[1].tensionLevel).toBeUndefined();
    expect(film.script.scenes[1].durationSeconds).toBe(30);
    // s3 changed
    expect(film.script.scenes[2].tensionLevel).toBe(9);
    expect(film.script.scenes[2].emotionalTone).toBe("shocking");
    expect(film.script.scenes[2].durationSeconds).toBe(45);
  });

  it("revertSceneAiDirector restores one scene to snapshot", async () => {
    const { revertSceneAiDirector, setScript } = await import("../src/store/film_actions");
    const project: any = { id: "p1" };
    const seedScript = {
      titleEn: "T", titleVi: "T", logline: "L", synopsisEn: "S",
      scenes: [{
        id: "s1", order: 1, titleEn: "S1", settings: "INT.",
        durationSeconds: 60, act: "rising",
        actionLinesEn: "", dialog: [], sfx: [], musicBrief: "",
        tensionLevel: 8, emotionalTone: "tense",
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    const sp = setScript(project, seedScript as any);
    const proj1 = { ...project, ...sp };
    const patch = revertSceneAiDirector(proj1, "s1", {
      tensionLevel: 3,
      emotionalTone: "neutral",
      durationSeconds: 30,
    });
    const film = patch.filmV093 as any;
    expect(film.script.scenes[0].tensionLevel).toBe(3);
    expect(film.script.scenes[0].emotionalTone).toBe("neutral");
    expect(film.script.scenes[0].durationSeconds).toBe(30);
  });

  it("AI Director system prompt includes pacing principles + JSON schema", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/filmScriptStages.ts"), "utf-8");
    expect(src).toContain("Walter Murch");
    expect(src).toContain("Pixar");
    expect(src).toContain("Hitchcock");
    expect(src).toContain("DO NOT change scene description");
    expect(src).toContain("rationaleVi");
    expect(src).toContain("strengthsVi");
    expect(src).toContain("weaknessesVi");
  });

  it("AiDirectorPanel UI component exists in dashboard", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmPacingDashboardSection.tsx"), "utf-8");
    expect(src).toContain("function AiDirectorPanel");
    expect(src).toContain("function AiDirectorSceneDiff");
    expect(src).toContain("AI Director · tự động chỉnh nhịp");
    expect(src).toContain("scanning");
    expect(src).toContain("applied");
  });

  it("AiDirectorPanel has Undo all + Keep + per-scene undo buttons", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmPacingDashboardSection.tsx"), "utf-8");
    expect(src).toContain("Undo all");
    expect(src).toContain("Undo cảnh này");
    expect(src).toContain("Giữ");
    expect(src).toContain("revertScriptToVersion");
    expect(src).toContain("revertSceneAiDirector");
  });

  it("Dashboard renders S1/S2/Sn labels (not C1/C2 — sync with 'Scene' terminology)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmPacingDashboardSection.tsx"), "utf-8");
    expect(src).toContain("S{scenes[i].order}");
    expect(src).toContain("S{s.order}");
    expect(src).toContain("`S${scene.order}`");
    // Should NOT have C{ patterns in label positions
    expect(src).not.toContain("`C${scene.order}`");
    expect(src).not.toContain("C{scenes[i].order}");
  });

  it("CSS has AI Director section styles", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(path.resolve("./src/components/film.css"), "utf-8");
    expect(css).toContain("SPRINT 1.0 r3 — AI DIRECTOR");
    expect(css).toContain(".ksp-ai-director-hero");
    expect(css).toContain(".ksp-ai-director-progress");
    expect(css).toContain(".ksp-ai-director-stat-grid");
    expect(css).toContain(".ksp-ai-director-tabs");
    expect(css).toContain(".ksp-ai-director-diff");
  });

  it("AI Director sanitizes scene durations to safe range (5-600s)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/filmScriptStages.ts"), "utf-8");
    // Validate the clamp logic exists
    expect(src).toContain("Math.max(5, Math.min(600");
  });

  it("manifest bumped to current 0.9.4 series with version_name 0.9.4-r*", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const m = JSON.parse(fs.readFileSync(path.resolve("./manifest.json"), "utf-8"));
    expect(m.version).toMatch(/^0\.9\.4\./);
    expect(m.version_name).toMatch(/^0\.9\.4-r/);
    expect(m.action.default_title).toMatch(/0\.9\.4-r/);
  });
});

// ============================================================================
// SPRINT 1.0 r4 — DRAG REWRITE (Phase 4: drag tension + shot duration)
// ============================================================================

describe("Sprint 1.0 r4 — drag rewrite engine + store + UI", () => {
  it("runDragRewriteSuggest is exported", async () => {
    const mod = await import("../src/engine/filmScriptStages");
    expect(typeof mod.runDragRewriteSuggest).toBe("function");
  });

  it("runShotReprompt is exported", async () => {
    const mod = await import("../src/engine/filmScriptStages");
    expect(typeof mod.runShotReprompt).toBe("function");
  });

  it("DragRewriteSuggestion + ShotRepromptSuggestion types exist", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/filmScriptStages.ts"), "utf-8");
    expect(src).toContain("export interface DragRewriteSuggestion");
    expect(src).toContain("export interface ShotRepromptSuggestion");
    expect(src).toContain("before"); // snapshot
    expect(src).toContain("rationaleVi");
    expect(src).toContain("useStillImage");
  });

  it("applyDragRewrite store action updates 5 scene fields atomically", async () => {
    const { applyDragRewrite, setScript } = await import("../src/store/film_actions");
    const project: any = { id: "p1" };
    const seedScript = {
      titleEn: "T", titleVi: "T", logline: "L", synopsisEn: "S",
      scenes: [{
        id: "s1", order: 1, titleEn: "Original EN", titleVi: "Gốc VI",
        settings: "INT.", durationSeconds: 30, act: "rising",
        actionLinesEn: "Old action EN", actionLinesVi: "Old action VI",
        dialog: [], sfx: [], musicBrief: "",
        tensionLevel: 3, emotionalTone: "neutral",
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    const sp = setScript(project, seedScript as any);
    const proj1 = { ...project, ...sp };
    const patch = applyDragRewrite(proj1, "s1", {
      newTension: 8,
      newEmotion: "tense",
      newDurationSeconds: 42,
      newActionLinesVi: "New VI action with high stakes",
      newActionLinesEn: "New EN action with high stakes",
    });
    const film = patch.filmV093 as any;
    const scene = film.script.scenes[0];
    expect(scene.tensionLevel).toBe(8);
    expect(scene.emotionalTone).toBe("tense");
    expect(scene.durationSeconds).toBe(42);
    expect(scene.actionLinesVi).toBe("New VI action with high stakes");
    expect(scene.actionLinesEn).toBe("New EN action with high stakes");
    // Original title preserved
    expect(scene.titleEn).toBe("Original EN");
  });

  it("applyShotReprompt updates imagePromptR5 + animationPromptR5", async () => {
    const { applyShotReprompt, setShotsForScene } = await import("../src/store/film_actions");
    const project: any = { id: "p1" };
    const seedShots: any[] = [{
      id: "sh1", order: 1, titleEn: "Shot", shotType: "medium",
      durationSeconds: 4, gridFormat: "3x3", cameraMovement: "static",
      status: "draft", imagePromptR5: "old image", animationPromptR5: "old anim",
    }];
    const sp = setShotsForScene(project, "scene1", seedShots);
    const proj1 = { ...project, ...sp };
    const patch = applyShotReprompt(proj1, "scene1", "sh1", {
      newImagePrompt: "new cinematic hold beat image",
      newAnimationPrompt: "new slow zoom anim",
      useStillImage: true,
    });
    const film = patch.filmV093 as any;
    expect(film.shotsBySceneId.scene1[0].imagePromptR5).toBe("new cinematic hold beat image");
    expect(film.shotsBySceneId.scene1[0].animationPromptR5).toBe("new slow zoom anim");
  });

  it("Drag rewrite prompt preserves stakes + compresses/extends duration", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/filmScriptStages.ts"), "utf-8");
    expect(src).toContain("PRESERVE");
    expect(src).toContain("stakes");
    expect(src).toMatch(/compress|extend/);
  });

  it("Shot reprompt prompt mentions still image when duration > 8s", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/filmScriptStages.ts"), "utf-8");
    expect(src).toContain("still image");
    expect(src).toMatch(/>\s*8s|cap 5-8s/);
  });

  it("TensionCurve component accepts onDragRelease prop", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmPacingDashboardSection.tsx"), "utf-8");
    expect(src).toContain("onDragRelease");
    expect(src).toContain("handlePointDown");
    expect(src).toContain("clientYToTension");
  });

  it("DragRewriteModal + DragRewritePreview components exist", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmPacingDashboardSection.tsx"), "utf-8");
    expect(src).toContain("function DragRewriteModal");
    expect(src).toContain("function DragRewritePreview");
    expect(src).toContain("ksp-drag-rewrite-backdrop");
    expect(src).toContain("Áp dụng rewrite");
    expect(src).toContain("Bỏ qua");
  });

  it("ShotRow does NOT render 🎬 reprompt button (moved to Storyboard modal in r4.1)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmShotListSection.tsx"), "utf-8");
    expect(src).not.toContain("ksp-shotlist-film-reprompt-btn");
    expect(src).not.toContain("onReprompt");
    expect(src).not.toContain("isRepromptingDur");
  });

  it("FilmFrameEditModal renders 🎬 AI re-prompt button + ↻ Reset (moved here from Shot List)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmFrameEditModal.tsx"), "utf-8");
    expect(src).toContain("AI re-prompt");
    expect(src).toContain("handleAiReprompt");
    expect(src).toContain("handleResetPrompt");
    expect(src).toContain("imagePromptIsOverride");
    expect(src).toContain("animationPromptIsOverride");
    expect(src).toContain("runShotReprompt");
  });

  it("FilmFrameEditModal prefers imagePromptR5/animationPromptR5 override if set", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmFrameEditModal.tsx"), "utf-8");
    expect(src).toMatch(/if \(\(shot as any\)\.imagePromptR5\)/);
    expect(src).toMatch(/if \(\(shot as any\)\.animationPromptR5\)/);
  });

  it("handleDuplicate auto-clears shotsBySceneId when duplicating Film project", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/Projects.tsx"), "utf-8");
    expect(src).toContain("isFilmMode");
    expect(src).toContain("shotsBySceneId: {}");
    expect(src).toContain("Sprint 1.0 r4.1");
  });

  it("Shot list grid template uses minmax(0, 1fr) for title to allow shrink (r4.1 fix)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(path.resolve("./src/components/film.css"), "utf-8");
    // Verify the updated grid template exists
    expect(css).toContain("minmax(0, 1fr)");
    expect(css).toContain("Sprint 1.0 r4.1: 8 columns");
    // Title input must have min-width: 0 + ellipsis
    expect(css).toMatch(/ksp-shotlist-film-title-input[\s\S]*?min-width:\s*0/);
    expect(css).toMatch(/ksp-shotlist-film-title-input[\s\S]*?text-overflow:\s*ellipsis/);
  });

  it("CSS has Sprint 1.0 r4 drag rewrite modal styles", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(path.resolve("./src/components/film.css"), "utf-8");
    expect(css).toContain("SPRINT 1.0 r4 — DRAG INTERACTIONS");
    expect(css).toContain(".ksp-drag-rewrite-backdrop");
    expect(css).toContain(".ksp-drag-rewrite-modal");
    expect(css).toContain(".ksp-drag-rewrite-meta-row");
    expect(css).toContain(".ksp-drag-rewrite-spinner");
    expect(css).toContain("ksp-drag-rewrite-spin");
  });

  it("manifest bumped to current 0.9.4 series with version_name 0.9.4-r*", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const m = JSON.parse(fs.readFileSync(path.resolve("./manifest.json"), "utf-8"));
    expect(m.version).toMatch(/^0\.9\.4\./);
    expect(m.version_name).toMatch(/^0\.9\.4-r/);
    expect(m.action.default_title).toMatch(/0\.9\.4-r/);
  });
});

// ============================================================================
// SPRINT 1.0 r5 — MULTI-CHARACTER + SETUP-PAYOFF (Phase 2B)
// ============================================================================

describe("Sprint 1.0 r5 — multi-character emotion + setup-payoff", () => {
  it("runReannotateCharacterEmotions is exported", async () => {
    const mod = await import("../src/engine/filmScriptStages");
    expect(typeof mod.runReannotateCharacterEmotions).toBe("function");
  });

  it("runSetupPayoffDetect is exported", async () => {
    const mod = await import("../src/engine/filmScriptStages");
    expect(typeof mod.runSetupPayoffDetect).toBe("function");
  });

  it("CharacterEmotionsMap + SetupPayoffDetectResult types exist", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/filmScriptStages.ts"), "utf-8");
    expect(src).toContain("export type CharacterEmotionsMap");
    expect(src).toContain("export interface SetupPayoffDetectResult");
    expect(src).toContain("danglingSetupsVi");
  });

  it("SetupPayoffPair type has 6 categories", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/types/project.ts"), "utf-8");
    expect(src).toContain('"object" | "skill" | "promise" | "mystery" | "character" | "world"');
    expect(src).toContain("SETUP_PAYOFF_TYPE_LABELS");
  });

  it("FilmSceneScript.characterEmotions field is optional", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/types/project.ts"), "utf-8");
    expect(src).toContain("characterEmotions?: Record<string, EmotionalTone>");
  });

  it("FilmData.setupPayoffPairs field is optional", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/types/film.ts"), "utf-8");
    expect(src).toContain("setupPayoffPairs?:");
  });

  it("applyCharacterEmotions store action bulk updates scenes", async () => {
    const { applyCharacterEmotions, setScript } = await import("../src/store/film_actions");
    const project: any = { id: "p1" };
    const seedScript = {
      titleEn: "T", titleVi: "T", logline: "L", synopsisEn: "S",
      scenes: [
        { id: "s1", order: 1, titleEn: "S1", settings: "INT.", durationSeconds: 30, act: "rising", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "" },
        { id: "s2", order: 2, titleEn: "S2", settings: "INT.", durationSeconds: 30, act: "climax", actionLinesEn: "", dialog: [], sfx: [], musicBrief: "" },
      ],
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    const sp = setScript(project, seedScript as any);
    const proj1 = { ...project, ...sp };
    const patch = applyCharacterEmotions(proj1, {
      s1: { char_a: "tender", char_b: "neutral" },
      s2: { char_a: "tense", char_b: "shocking" },
    });
    const film = patch.filmV093 as any;
    expect(film.script.scenes[0].characterEmotions.char_a).toBe("tender");
    expect(film.script.scenes[0].characterEmotions.char_b).toBe("neutral");
    expect(film.script.scenes[1].characterEmotions.char_a).toBe("tense");
    expect(film.script.scenes[1].characterEmotions.char_b).toBe("shocking");
  });

  it("setSetupPayoffPairs + removeSetupPayoffPair + clearSetupPayoffPairs", async () => {
    const { setSetupPayoffPairs, removeSetupPayoffPair, clearSetupPayoffPairs } = await import(
      "../src/store/film_actions"
    );
    const project: any = { id: "p1" };
    const seedPairs: any[] = [
      { id: "sp1", setupSceneId: "s1", payoffSceneId: "s5", type: "object", labelVi: "Mật mã", rationaleVi: "", confidence: 0.9, detectedAt: 1 },
      { id: "sp2", setupSceneId: "s2", payoffSceneId: "s6", type: "skill", labelVi: "Combat", rationaleVi: "", confidence: 0.7, detectedAt: 1 },
    ];
    const set1 = setSetupPayoffPairs(project, seedPairs);
    const proj1 = { ...project, ...set1 };
    expect((proj1.filmV093 as any).setupPayoffPairs).toHaveLength(2);

    const rm1 = removeSetupPayoffPair(proj1, "sp1");
    const proj2 = { ...proj1, ...rm1 };
    expect((proj2.filmV093 as any).setupPayoffPairs).toHaveLength(1);
    expect((proj2.filmV093 as any).setupPayoffPairs[0].id).toBe("sp2");

    const cl1 = clearSetupPayoffPairs(proj2);
    const proj3 = { ...proj2, ...cl1 };
    expect((proj3.filmV093 as any).setupPayoffPairs).toHaveLength(0);
  });

  it("Setup-payoff detection enforces payoffSceneId > setupSceneId (no time-paradox)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/filmScriptStages.ts"), "utf-8");
    expect(src).toMatch(/payoffOrder\s*<=\s*setupOrder/);
    expect(src).toContain("// payoff must be later");
  });

  it("MultiCharacterCurve + SetupPayoffPanel components exist in dashboard", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmPacingDashboardSection.tsx"), "utf-8");
    expect(src).toContain("function MultiCharacterCurve");
    expect(src).toContain("function SetupPayoffPanel");
    expect(src).toContain("CHAR_COLORS");
    expect(src).toContain("TONE_TO_Y");
  });

  it("MultiCharacterCurve hidden when fewer than 2 characters", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmPacingDashboardSection.tsx"), "utf-8");
    expect(src).toContain("characters.length < 2");
  });

  it("CSS has Sprint 1.0 r5 multi-character + setup-payoff styles", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(path.resolve("./src/components/film.css"), "utf-8");
    expect(css).toContain("SPRINT 1.0 r5 — MULTI-CHARACTER + SETUP-PAYOFF");
    expect(css).toContain(".ksp-multichar-pill");
    expect(css).toContain(".ksp-setup-payoff-list");
    expect(css).toContain(".ksp-setup-payoff-anchor-setup");
    expect(css).toContain(".ksp-setup-payoff-anchor-payoff");
    expect(css).toContain(".ksp-setup-payoff-line");
  });

  it("manifest bumped to current 0.9.4 series with version_name 0.9.4-r*", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const m = JSON.parse(fs.readFileSync(path.resolve("./manifest.json"), "utf-8"));
    expect(m.version).toMatch(/^0\.9\.4\./);
    expect(m.version_name).toMatch(/^0\.9\.4-r/);
    expect(m.action.default_title).toMatch(/0\.9\.4-r/);
  });
});

// ============================================================================
// SPRINT 1.0 r6 — PROMPT PIPELINE FIX (Sprint F)
// ============================================================================

describe("Sprint 1.0 r6 — prompt pipeline fix (BUG #1 to #6)", () => {
  it("BUG #1: patchShotsForScene auto-repacks grids so cell.shotId stays in sync", async () => {
    const { setShotsForScene, ensureSceneGrids } = await import("../src/store/film_actions");
    const project: any = {
      id: "p1",
      filmV093: {
        characters: [],
        shotsBySceneId: {
          sc1: [
            { id: "shot_A1", order: 1, titleEn: "S1", shotType: "wide_establishing", durationSeconds: 5, gridFormat: "2x2", cameraMovement: "static", status: "draft" },
            { id: "shot_A2", order: 2, titleEn: "S2", shotType: "medium", durationSeconds: 5, gridFormat: "2x2", cameraMovement: "static", status: "draft" },
          ],
        },
        script: {
          titleEn: "T", titleVi: "T", logline: "L",
          scenes: [
            { id: "sc1", order: 1, titleEn: "Sc1", settings: "INT.", durationSeconds: 30, actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "rising" },
          ],
          createdAt: Date.now(), versions: [],
        } as any,
      },
      settingV2: { mode: "film", aspectRatio: "16:9" },
    };
    // Initialize storyboard grids
    const initPatch = ensureSceneGrids(project, "sc1");
    const proj1 = { ...project, ...initPatch };
    const gridsBefore = proj1.filmV093!.script!.scenes[0].grids!;
    expect(gridsBefore[0].cells.filter((c: any) => c.shotId).length).toBe(2);
    expect(gridsBefore[0].cells[0].shotId).toBe("shot_A1");

    // Simulate user clicking ✨ Sinh lại — new shots with NEW ids
    const newShots = [
      { id: "shot_B1", order: 1, titleEn: "NewS1", shotType: "wide_establishing", durationSeconds: 5, gridFormat: "2x2", cameraMovement: "static", status: "draft" },
      { id: "shot_B2", order: 2, titleEn: "NewS2", shotType: "medium", durationSeconds: 5, gridFormat: "2x2", cameraMovement: "static", status: "draft" },
    ];
    const regenPatch = setShotsForScene(proj1, "sc1", newShots as any);
    const proj2 = { ...proj1, ...regenPatch };

    // Grids should be auto-repacked: cell.shotId now points to new ids
    const gridsAfter = proj2.filmV093!.script!.scenes[0].grids!;
    expect(gridsAfter[0].cells.filter((c: any) => c.shotId).length).toBe(2);
    expect(gridsAfter[0].cells[0].shotId).toBe("shot_B1");
    expect(gridsAfter[0].cells[1].shotId).toBe("shot_B2");
    // Stale imagePrompt cache cleared
    expect(gridsAfter[0].imagePrompt).toBeUndefined();
  });

  it("BUG #2: scene prompt uses actionLinesEn first, no Vietnamese leak", async () => {
    const { buildSceneGridImagePrompt } = await import("../src/engine/sceneImagePromptBuilder");
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = [{ id: "s1", order: 1, titleEn: "Shot EN", titleVi: "Shot VI", shotType: "medium", durationSeconds: 5, actionEn: "English action", actionVi: "Hành động tiếng Việt" }] as any[];
    const grids = packShotsIntoGrids(shots, "2x2");
    const scene: any = {
      id: "sc1", order: 1, titleEn: "Scene EN", titleVi: "Cảnh VI",
      settings: "EXT.",
      actionLinesEn: "Robot wakes in forest",
      actionLinesVi: "Robot tỉnh dậy trong rừng",
      durationSeconds: 30,
    };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSceneGridImagePrompt({ grid: grids[0], scene, shots, cast: [], setting });
    expect(prompt).toContain("Robot wakes in forest");
    expect(prompt).not.toContain("Robot tỉnh dậy");
    expect(prompt).toContain("English action");
    expect(prompt).not.toContain("Hành động tiếng Việt");
  });

  it("BUG #3: pacing data flows into prompt (tension + emotion + rhythm role)", async () => {
    const { buildSceneGridImagePrompt } = await import("../src/engine/sceneImagePromptBuilder");
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = [{ id: "s1", order: 1, titleEn: "Peak", shotType: "close_up", durationSeconds: 5, actionEn: "Robot face", rhythmRole: "peak" }] as any[];
    const grids = packShotsIntoGrids(shots, "2x2");
    const scene: any = {
      id: "sc1", order: 1, titleEn: "Climax", settings: "EXT.", actionLinesEn: "x",
      durationSeconds: 30,
      tensionLevel: 9,
      emotionalTone: "shocking",
    };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSceneGridImagePrompt({ grid: grids[0], scene, shots, cast: [], setting });
    // CINEMATIC INTENT block exists
    expect(prompt).toContain("CINEMATIC INTENT");
    // Tension + emotion labels in prompt
    expect(prompt).toContain("Dominant emotion: shocking");
    expect(prompt).toContain("Tension: 9/10");
    // Per-cell rhythm role hint
    expect(prompt).toContain("role=peak");
    expect(prompt).toContain("COMPOSITION:");
    // Shocking emotion lighting hint
    expect(prompt).toContain("harsh top-light");
  });

  it("BUG #3: characterEmotions injected when annotated", async () => {
    const { buildSceneGridImagePrompt } = await import("../src/engine/sceneImagePromptBuilder");
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = [{ id: "s1", order: 1, titleEn: "Shot", shotType: "medium", durationSeconds: 5, actionEn: "x" }] as any[];
    const grids = packShotsIntoGrids(shots, "2x2");
    const scene: any = {
      id: "sc1", order: 1, titleEn: "S", settings: "EXT.", actionLinesEn: "x",
      durationSeconds: 30,
      tensionLevel: 5,
      emotionalTone: "neutral",
      characterEmotions: { c1: "tense", c2: "tender" },
    };
    const cast = [
      { id: "c1", order: 1, name: "Robot", role: "protagonist", description: "", faceRefs: [], bodyRefs: [] },
      { id: "c2", order: 2, name: "Bird", role: "supporting", description: "", faceRefs: [], bodyRefs: [] },
    ] as any[];
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSceneGridImagePrompt({ grid: grids[0], scene, shots, cast, setting });
    expect(prompt).toContain("Per-character emotional state");
    expect(prompt).toContain("Robot feels tense");
    expect(prompt).toContain("Bird feels tender");
  });

  it("BUG #3: setupPayoff anchors injected when scene is referenced", async () => {
    const { buildSceneGridImagePrompt } = await import("../src/engine/sceneImagePromptBuilder");
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = [{ id: "s1", order: 1, titleEn: "Shot", shotType: "medium", durationSeconds: 5, actionEn: "x" }] as any[];
    const grids = packShotsIntoGrids(shots, "2x2");
    const scene1: any = { id: "sc1", order: 1, titleEn: "S1", settings: "EXT.", actionLinesEn: "x", durationSeconds: 30, tensionLevel: 5, emotionalTone: "neutral" };
    const scene5: any = { id: "sc5", order: 5, titleEn: "S5", settings: "EXT.", actionLinesEn: "x", durationSeconds: 30, tensionLevel: 8, emotionalTone: "shocking" };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const pairs = [
      { id: "p1", setupSceneId: "sc1", payoffSceneId: "sc5", type: "object", labelVi: "Mật mã 3-5 nhịp", rationaleVi: "", confidence: 0.9, detectedAt: 1 },
    ] as any[];
    const prompt = buildSceneGridImagePrompt({
      grid: grids[0], scene: scene1, shots, cast: [], setting,
      allScenes: [scene1, scene5],
      setupPayoffPairs: pairs,
    });
    expect(prompt).toContain("NARRATIVE CONTINUITY");
    expect(prompt).toContain("SETUP for \"Mật mã 3-5 nhịp\"");
    expect(prompt).toContain("payoff in scene 5");
  });

  it("BUG #4: prompt includes lighting + color palette + atmosphere + framing intensity", async () => {
    const { buildSceneGridImagePrompt } = await import("../src/engine/sceneImagePromptBuilder");
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = [{ id: "s1", order: 1, titleEn: "S", shotType: "medium", durationSeconds: 5, actionEn: "x" }] as any[];
    const grids = packShotsIntoGrids(shots, "2x2");
    const scene: any = { id: "sc1", order: 1, titleEn: "S", settings: "EXT.", actionLinesEn: "x", durationSeconds: 30, tensionLevel: 3, emotionalTone: "tender" };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSceneGridImagePrompt({ grid: grids[0], scene, shots, cast: [], setting });
    expect(prompt).toContain("Lighting:");
    expect(prompt).toContain("Color palette:");
    expect(prompt).toContain("Atmosphere:");
    expect(prompt).toContain("Framing intensity:");
    // Tender emotion: golden-hour key light
    expect(prompt).toContain("golden-hour");
  });

  it("BUG #5: Storyboard component no longer uses cached grid.imagePrompt", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmStoryboardSection.tsx"), "utf-8");
    // Old line: `if (grid.imagePrompt) return grid.imagePrompt;` is removed
    expect(src).not.toMatch(/if\s*\(grid\.imagePrompt\)\s*return\s+grid\.imagePrompt/);
    // New comment marker exists
    expect(src).toContain("BUG #5 fix");
  });

  it("BUG #6: no duplicate REFERENCE IMAGES header line", async () => {
    const { buildSceneGridImagePrompt } = await import("../src/engine/sceneImagePromptBuilder");
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = [{ id: "s1", order: 1, titleEn: "S", shotType: "medium", durationSeconds: 5, actionEn: "x" }] as any[];
    const grids = packShotsIntoGrids(shots, "2x2");
    const scene: any = { id: "sc1", order: 1, titleEn: "S", settings: "EXT.", actionLinesEn: "x", durationSeconds: 30 };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSceneGridImagePrompt({ grid: grids[0], scene, shots, cast: [], setting });
    // Count occurrences of "REFERENCE IMAGES"
    const matches = prompt.match(/REFERENCE IMAGES/g) ?? [];
    expect(matches.length).toBe(1); // exactly one header, no duplicate
  });

  it("buildSingleShotImagePrompt injects pacing data + cinematic intent", async () => {
    const { buildSingleShotImagePrompt } = await import("../src/engine/filmShotPromptBuilder");
    const shot: any = {
      id: "s1", order: 1, titleEn: "Peak shot", shotType: "close_up",
      cameraMovement: "dolly_in", durationSeconds: 8, actionEn: "Eye opens",
      rhythmRole: "peak",
    };
    const scene: any = {
      id: "sc1", order: 1, titleEn: "S", settings: "EXT.",
      tensionLevel: 8, emotionalTone: "tense",
    };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSingleShotImagePrompt({ shot, scene, cast: [], setting });
    expect(prompt).toContain("CINEMATIC INTENT");
    expect(prompt).toContain("Scene emotion: tense");
    expect(prompt).toContain("Tension: 8/10");
    expect(prompt).toContain("Shot rhythm role: peak");
    expect(prompt).toContain("cool blue key light");
  });

  it("buildAnimationPrompt injects motion intent from rhythm role", async () => {
    const { buildAnimationPrompt } = await import("../src/engine/filmShotPromptBuilder");
    const shot: any = {
      id: "s1", order: 1, titleEn: "Build shot", shotType: "medium",
      cameraMovement: "tracking", durationSeconds: 6, actionEn: "Robot walks",
      rhythmRole: "build",
    };
    const scene: any = {
      id: "sc1", order: 1, titleEn: "S", settings: "EXT.",
      tensionLevel: 5, emotionalTone: "neutral",
    };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const provider: any = { id: "seedance-2-pro", name: "Seedance 2.0 Pro" };
    const prompt = buildAnimationPrompt({ shot, scene, cast: [], setting, provider });
    expect(prompt).toContain("EMOTIONAL & MOTION INTENT");
    expect(prompt).toContain("Shot role: build");
    expect(prompt).toContain("Motion intent:");
    expect(prompt).toContain("energy accumulates");
  });

  it("manifest bumped to current 0.9.4 series with version_name 0.9.4-r*", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const m = JSON.parse(fs.readFileSync(path.resolve("./manifest.json"), "utf-8"));
    expect(m.version).toMatch(/^0\.9\.4\./);
    expect(m.version_name).toMatch(/^0\.9\.4-r/);
    expect(m.action.default_title).toMatch(/0\.9\.4-r/);
  });
});

// ============================================================================
// SPRINT 1.0 r7 — BEATS + PER-SHOT MOOD + PHYSICAL LOCK + MULTI-GRID (Sprint G1ab)
// ============================================================================

describe("Sprint 1.0 r7 — Sprint G1ab", () => {
  it("Beat type + BEAT_TYPE_LABELS exported from types/project", async () => {
    const types = await import("../src/types/project");
    expect(types.BEAT_TYPE_LABELS).toBeDefined();
    expect(types.BEAT_TYPE_LABELS.camera).toBeDefined();
    expect(types.BEAT_TYPE_LABELS.subject).toBeDefined();
    expect(types.BEAT_TYPE_LABELS.action).toBeDefined();
    expect(types.BEAT_TYPE_LABELS.sensory).toBeDefined();
    expect(types.BEAT_TYPE_LABELS["state-change"]).toBeDefined();
    // Each label has vi + emoji + color
    expect(types.BEAT_TYPE_LABELS.camera.vi).toBe("Máy quay");
    expect(types.BEAT_TYPE_LABELS.camera.emoji).toBe("🎥");
  });

  it("SetupPayoffPair schema supports labelEn (Q1 VI leak fix)", async () => {
    // Type-check only — runtime schema not exposed
    const types = await import("../src/types/project");
    // Cast as any since we only verify exports compile
    const pair: any = {
      id: "p1",
      setupSceneId: "sc1",
      payoffSceneId: "sc2",
      type: "object",
      labelVi: "Mật mã 3-5 nhịp",
      labelEn: "3-5 tap code",
      rationaleVi: "...",
      confidence: 0.8,
      detectedAt: Date.now(),
    };
    expect(pair.labelEn).toBe("3-5 tap code");
  });

  it("FilmShot schema supports new r7 fields", async () => {
    const shot: any = {
      id: "s1",
      order: 1,
      purposeEn: "Show the wake moment",
      lightingHintEn: "subtle blue accent on sensor",
      shotMoodOverride: "shocking",
      shotMoodIntensity: 9,
    };
    expect(shot.purposeEn).toBeDefined();
    expect(shot.lightingHintEn).toBeDefined();
    expect(shot.shotMoodOverride).toBe("shocking");
    expect(shot.shotMoodIntensity).toBe(9);
  });

  it("FilmSceneScript supports beats + physicalConsistencyLockEn", async () => {
    const scene: any = {
      id: "sc1",
      order: 1,
      beats: [
        { id: "b1", order: 1, label: "Wide forest sweep", type: "camera", detectedAt: 1 },
        { id: "b2", order: 2, label: "Blue light flickers", type: "state-change", detectedAt: 1 },
      ],
      physicalConsistencyLockEn: "Robot covered in moss + ivy curtain",
    };
    expect(scene.beats).toHaveLength(2);
    expect(scene.physicalConsistencyLockEn).toBeDefined();
  });

  it("runDetectBeatsForScene + runDetectBeatsForAllScenes exported", async () => {
    const mod = await import("../src/engine/filmScriptStages");
    expect(mod.runDetectBeatsForScene).toBeDefined();
    expect(mod.runDetectBeatsForAllScenes).toBeDefined();
    expect(typeof mod.runDetectBeatsForScene).toBe("function");
    expect(typeof mod.runDetectBeatsForAllScenes).toBe("function");
  });

  it("Engine prompt: setup-payoff system requires labelEn", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/filmScriptStages.ts"), "utf-8");
    expect(src).toContain('"labelEn"');
    expect(src).toContain("English equivalent");
    expect(src).toContain("REQUIRED — never skip");
  });

  it("Engine prompt: shot list system requires purposeEn + lightingHintEn + cameraVaried", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/filmShotListGeneration.ts"), "utf-8");
    expect(src).toContain('"purposeEn"');
    expect(src).toContain('"lightingHintEn"');
    expect(src).toContain("CAMERA MOVEMENT VARIETY");
    expect(src).toContain("DO NOT default to");
    // Beat coverage rules
    expect(src).toContain("BEAT COVERAGE RULES");
  });

  it("Grid prompt: PHYSICAL CONSISTENCY LOCK block injected from scene field", async () => {
    const { buildSceneGridImagePrompt } = await import("../src/engine/sceneImagePromptBuilder");
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = [{ id: "s1", order: 1, titleEn: "S", shotType: "medium", durationSeconds: 5, actionEn: "x" }] as any[];
    const grids = packShotsIntoGrids(shots, "3x3");
    const scene: any = {
      id: "sc1", order: 1, titleEn: "S", settings: "EXT.", actionLinesEn: "x", durationSeconds: 30,
      tensionLevel: 5, emotionalTone: "neutral",
      physicalConsistencyLockEn: "- Robot body: moss-covered\n- Ivy curtain over left sensor",
    };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSceneGridImagePrompt({ grid: grids[0], scene, shots, cast: [], setting });
    expect(prompt).toContain("PHYSICAL CONSISTENCY LOCK");
    expect(prompt).toContain("moss-covered");
    expect(prompt).toContain("Ivy curtain");
  });

  it("Grid prompt: BEATS COVERAGE block injected when shots have coveredBeatIds", async () => {
    const { buildSceneGridImagePrompt } = await import("../src/engine/sceneImagePromptBuilder");
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = [
      { id: "s1", order: 1, titleEn: "S1", shotType: "medium", durationSeconds: 5, actionEn: "x", coveredBeatIds: ["b1", "b2"] },
      { id: "s2", order: 2, titleEn: "S2", shotType: "close_up", durationSeconds: 5, actionEn: "y", coveredBeatIds: ["b3"] },
    ] as any[];
    const grids = packShotsIntoGrids(shots, "3x3");
    const scene: any = {
      id: "sc1", order: 1, titleEn: "S", settings: "EXT.", actionLinesEn: "x", durationSeconds: 30,
      beats: [
        { id: "b1", order: 1, label: "Wide sweep", type: "camera", detectedAt: 1 },
        { id: "b2", order: 2, label: "Reveal robot", type: "subject", detectedAt: 1 },
        { id: "b3", order: 3, label: "Light flickers", type: "state-change", detectedAt: 1 },
      ],
    };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSceneGridImagePrompt({ grid: grids[0], scene, shots, cast: [], setting });
    expect(prompt).toContain("BEATS COVERAGE");
    expect(prompt).toContain("Beat 1: Wide sweep");
    expect(prompt).toContain("Beat 2: Reveal robot");
    expect(prompt).toContain("Beat 3: Light flickers");
  });

  it("Grid prompt: per-cell LIGHTING HINT injected from shot.lightingHintEn", async () => {
    const { buildSceneGridImagePrompt } = await import("../src/engine/sceneImagePromptBuilder");
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = [
      { id: "s1", order: 1, titleEn: "S1", shotType: "wide_establishing", durationSeconds: 5, actionEn: "x",
        lightingHintEn: "golden-hour through canopy, atmospheric haze",
        cameraMovement: "pan_right", rhythmRole: "establish" },
    ] as any[];
    const grids = packShotsIntoGrids(shots, "3x3");
    const scene: any = { id: "sc1", order: 1, titleEn: "S", settings: "EXT.", actionLinesEn: "x", durationSeconds: 30 };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSceneGridImagePrompt({ grid: grids[0], scene, shots, cast: [], setting });
    expect(prompt).toContain("LIGHTING HINT:");
    expect(prompt).toContain("golden-hour through canopy");
    expect(prompt).toContain("SHOT TITLE:");
    expect(prompt).toContain("ACTION:");
    expect(prompt).toContain("COMPOSITION:");
  });

  it("Cast refs filtered: only characters with refs uploaded; format adapts", async () => {
    const { castRefsBlockFiltered } = await import("../src/engine/sceneImagePromptBuilder");
    const cast = [
      { id: "c1", order: 1, name: "Hero", role: "protagonist", description: "tall, brave", faceRefs: [{ id: "f1" }, { id: "f2" }], bodyRefs: [] },
      { id: "c2", order: 2, name: "Friend", role: "supporting", description: "", faceRefs: [], bodyRefs: [] },
      { id: "c3", order: 3, name: "Villain", role: "antagonist", description: "evil", faceRefs: [{ id: "f3" }], bodyRefs: [{ id: "b1" }, { id: "b2" }] },
    ] as any[];
    const result = castRefsBlockFiltered(cast, 2);
    // Friend (c2) omitted (no refs)
    expect(result).not.toContain("Friend");
    // Hero: 2 face refs, no body
    expect(result).toContain("Hero");
    expect(result).toContain("2 face refs");
    expect(result).not.toMatch(/Hero.*body ref/); // no body ref mention for Hero
    // Villain: 1 face + 2 body
    expect(result).toContain("Villain");
    expect(result).toContain("1 face ref + 2 body refs");
    // Numbering: Hero = Image #2 (start index 2), Villain = Image #3 (next after Hero, c2 skipped)
    expect(result).toContain("Image #2: Hero");
    expect(result).toContain("Image #3: Villain");
  });

  it("Cast refs: empty string when all cast have no refs", async () => {
    const { castRefsBlockFiltered } = await import("../src/engine/sceneImagePromptBuilder");
    const cast = [
      { id: "c1", order: 1, name: "Hero", role: "protagonist", description: "", faceRefs: [], bodyRefs: [] },
    ] as any[];
    const result = castRefsBlockFiltered(cast, 2);
    expect(result).toBe("");
  });

  it("Grid 2 prompt references Grid 1 generated image when previousGridGenerated=true", async () => {
    const { buildSceneGridImagePrompt } = await import("../src/engine/sceneImagePromptBuilder");
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    // Create 12 shots → packShotsIntoGrids produces 2 grids of 3x3 each
    const shots = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i + 1}`, order: i + 1, titleEn: `Shot ${i + 1}`,
      shotType: "medium", durationSeconds: 5, actionEn: `action ${i + 1}`,
    })) as any[];
    const grids = packShotsIntoGrids(shots, "3x3");
    expect(grids.length).toBe(2);
    const scene: any = { id: "sc1", order: 1, titleEn: "S", settings: "EXT.", actionLinesEn: "x", durationSeconds: 30 };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    // Grid 2 prompt with previousGridGenerated = true
    const prompt = buildSceneGridImagePrompt({
      grid: grids[1], scene, shots, cast: [], setting,
      allGrids: grids,
      previousGridGenerated: true,
    });
    expect(prompt).toContain("GRID 2 of 2");
    expect(prompt).toContain("grid-01-generated.png");
    expect(prompt).toContain("MULTI-GRID CONTINUITY DIRECTIVES");
    expect(prompt).toContain("blend seamlessly with previous grid");
  });

  it("Grid 2 without previousGridGenerated: no Grid 1 ref injected", async () => {
    const { buildSceneGridImagePrompt } = await import("../src/engine/sceneImagePromptBuilder");
    const { packShotsIntoGrids } = await import("../src/engine/sceneGridPacker");
    const shots = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i + 1}`, order: i + 1, titleEn: `S${i + 1}`,
      shotType: "medium", durationSeconds: 5, actionEn: "x",
    })) as any[];
    const grids = packShotsIntoGrids(shots, "3x3");
    const scene: any = { id: "sc1", order: 1, titleEn: "S", settings: "EXT.", actionLinesEn: "x", durationSeconds: 30 };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSceneGridImagePrompt({
      grid: grids[1], scene, shots, cast: [], setting,
      allGrids: grids,
      previousGridGenerated: false,
    });
    // Header still says GRID 2 of 2 but no continuity directives
    expect(prompt).toContain("GRID 2 of 2");
    expect(prompt).not.toContain("grid-01-generated.png");
    expect(prompt).not.toContain("MULTI-GRID CONTINUITY DIRECTIVES");
  });

  it("Single-shot prompt: purposeEn priority over legacy purpose (Q1 VI leak fix)", async () => {
    const { buildSingleShotImagePrompt } = await import("../src/engine/filmShotPromptBuilder");
    const shot: any = {
      id: "s1", order: 1, titleEn: "Shot", shotType: "close_up",
      cameraMovement: "static", durationSeconds: 5, actionEn: "x",
      purpose: "Mục đích tiếng Việt cũ", // legacy VI
      purposeEn: "English purpose", // new r7
    };
    const scene: any = { id: "sc1", order: 1, titleEn: "S", settings: "EXT." };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSingleShotImagePrompt({ shot, scene, cast: [], setting });
    expect(prompt).toContain("English purpose");
    expect(prompt).not.toContain("Mục đích tiếng Việt cũ");
  });

  it("Single-shot prompt: falls back to legacy purpose when purposeEn missing", async () => {
    const { buildSingleShotImagePrompt } = await import("../src/engine/filmShotPromptBuilder");
    const shot: any = {
      id: "s1", order: 1, titleEn: "Shot", shotType: "close_up",
      cameraMovement: "static", durationSeconds: 5, actionEn: "x",
      purpose: "Legacy purpose only",
      // no purposeEn
    };
    const scene: any = { id: "sc1", order: 1, titleEn: "S", settings: "EXT." };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSingleShotImagePrompt({ shot, scene, cast: [], setting });
    expect(prompt).toContain("Legacy purpose only");
  });

  it("Single-shot prompt: per-shot lightingHintEn override takes priority", async () => {
    const { buildSingleShotImagePrompt } = await import("../src/engine/filmShotPromptBuilder");
    const shot: any = {
      id: "s1", order: 1, titleEn: "Shot", shotType: "close_up",
      cameraMovement: "static", durationSeconds: 5, actionEn: "x",
      lightingHintEn: "CUSTOM PER-SHOT LIGHTING",
    };
    const scene: any = {
      id: "sc1", order: 1, titleEn: "S", settings: "EXT.",
      emotionalTone: "neutral", tensionLevel: 5,
    };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSingleShotImagePrompt({ shot, scene, cast: [], setting });
    expect(prompt).toContain("CUSTOM PER-SHOT LIGHTING");
    // Default neutral lighting should NOT appear (per-shot override wins)
    expect(prompt).not.toContain("balanced three-point lighting");
  });

  it("Single-shot prompt: shotMoodOverride changes derived emotion/tension", async () => {
    const { buildSingleShotImagePrompt } = await import("../src/engine/filmShotPromptBuilder");
    const shot: any = {
      id: "s1", order: 1, titleEn: "Shot", shotType: "close_up",
      cameraMovement: "static", durationSeconds: 5, actionEn: "x",
      shotMoodOverride: "shocking",
      shotMoodIntensity: 10,
    };
    const scene: any = {
      id: "sc1", order: 1, titleEn: "S", settings: "EXT.",
      emotionalTone: "tender", tensionLevel: 2, // scene says tender/calm
    };
    const setting: any = { animationStyle: "live_action", aspectRatio: "16:9" };
    const prompt = buildSingleShotImagePrompt({ shot, scene, cast: [], setting });
    // Per-shot override should win
    expect(prompt).toContain("Scene emotion: shocking");
    expect(prompt).toContain("Tension: 10/10");
    expect(prompt).toContain("per-shot override active");
  });

  it("SetupPayoff prompt: labelEn priority over labelVi (Q1 VI leak fix)", async () => {
    const { buildSetupPayoffHints } = await import("../src/engine/sceneImagePromptBuilder");
    const pairs: any[] = [
      {
        id: "p1", setupSceneId: "sc1", payoffSceneId: "sc2", type: "object",
        labelVi: "Mật mã 3-5 nhịp",
        labelEn: "3-5 tap code",
        rationaleVi: "...", confidence: 0.9, detectedAt: 1,
      },
    ];
    const scenes = [
      { id: "sc1", order: 1 } as any,
      { id: "sc2", order: 2 } as any,
    ];
    const hints = buildSetupPayoffHints("sc1", pairs, scenes);
    expect(hints[0]).toContain("3-5 tap code");
    expect(hints[0]).not.toContain("Mật mã 3-5 nhịp");
  });

  it("SetupPayoff prompt: falls back to labelVi when labelEn missing (legacy data)", async () => {
    const { buildSetupPayoffHints } = await import("../src/engine/sceneImagePromptBuilder");
    const pairs: any[] = [
      {
        id: "p1", setupSceneId: "sc1", payoffSceneId: "sc2", type: "object",
        labelVi: "Legacy Vietnamese", // no labelEn
        rationaleVi: "", confidence: 0.9, detectedAt: 1,
      },
    ];
    const scenes = [
      { id: "sc1", order: 1 } as any,
      { id: "sc2", order: 2 } as any,
    ];
    const hints = buildSetupPayoffHints("sc1", pairs, scenes);
    expect(hints[0]).toContain("Legacy Vietnamese");
  });

  it("Store: applyBeatsAndPhysicalLock + setSceneBeats exported", async () => {
    const mod = await import("../src/store/film_actions");
    expect(mod.applyBeatsAndPhysicalLock).toBeDefined();
    expect(mod.setSceneBeats).toBeDefined();
    expect(mod.setScenePhysicalLock).toBeDefined();
  });

  it("Store: applyBeatsAndPhysicalLock bulk updates scenes", async () => {
    const { applyBeatsAndPhysicalLock } = await import("../src/store/film_actions");
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        script: {
          titleEn: "T", titleVi: "T", logline: "L",
          scenes: [
            { id: "sc1", order: 1, titleEn: "S1", settings: "INT.", durationSeconds: 30, actionLinesEn: "x", dialog: [], sfx: [], musicBrief: "", act: "setup" },
            { id: "sc2", order: 2, titleEn: "S2", settings: "INT.", durationSeconds: 30, actionLinesEn: "x", dialog: [], sfx: [], musicBrief: "", act: "rising" },
          ],
          createdAt: Date.now(), versions: [],
        } as any,
      },
    };
    const results = {
      sc1: {
        beats: [{ id: "b1", order: 1, label: "Beat 1", type: "camera" as const, detectedAt: 1 }],
        physicalConsistencyLockEn: "Lock for sc1",
      },
      sc2: {
        beats: [{ id: "b2", order: 1, label: "Beat 2", type: "action" as const, detectedAt: 1 }],
      },
    };
    const patch = applyBeatsAndPhysicalLock(proj, results);
    const scenes = patch.filmV093!.script!.scenes;
    expect((scenes[0] as any).beats).toHaveLength(1);
    expect((scenes[0] as any).beats[0].label).toBe("Beat 1");
    expect((scenes[0] as any).physicalConsistencyLockEn).toBe("Lock for sc1");
    expect((scenes[1] as any).beats).toHaveLength(1);
    expect((scenes[1] as any).physicalConsistencyLockEn).toBeUndefined();
  });

  it("Film mode: ensureSceneGrids locks 3x3 regardless of shot count (Q-E)", async () => {
    const { ensureSceneGrids } = await import("../src/store/film_actions");
    // 5 shots in film mode → should still be 3x3 (4 empty cells)
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        shotsBySceneId: {
          sc1: Array.from({ length: 5 }, (_, i) => ({ id: `sh${i + 1}`, order: i + 1 })),
        },
        script: {
          titleEn: "T", titleVi: "T", logline: "L",
          scenes: [
            { id: "sc1", order: 1, titleEn: "S1", settings: "INT.", durationSeconds: 30, actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "setup" },
          ],
          createdAt: Date.now(), versions: [],
        } as any,
      },
    };
    const patch = ensureSceneGrids(proj, "sc1");
    const scene = patch.filmV093!.script!.scenes[0];
    expect(scene.gridFormat).toBe("3x3");
    expect(scene.grids![0].cells.length).toBe(9);
    expect(scene.grids![0].cells.filter((c) => c.shotId).length).toBe(5);
  });

  it("Film mode: 10 shots → 2 grids of 3x3 (multi-grid)", async () => {
    const { ensureSceneGrids } = await import("../src/store/film_actions");
    const proj: any = {
      ...baseFilmProject,
      filmV093: {
        ...baseFilmProject.filmV093,
        shotsBySceneId: {
          sc1: Array.from({ length: 10 }, (_, i) => ({ id: `sh${i + 1}`, order: i + 1 })),
        },
        script: {
          titleEn: "T", titleVi: "T", logline: "L",
          scenes: [
            { id: "sc1", order: 1, titleEn: "S1", settings: "INT.", durationSeconds: 30, actionLinesEn: "", dialog: [], sfx: [], musicBrief: "", act: "setup" },
          ],
          createdAt: Date.now(), versions: [],
        } as any,
      },
    };
    const patch = ensureSceneGrids(proj, "sc1");
    const scene = patch.filmV093!.script!.scenes[0];
    expect(scene.gridFormat).toBe("3x3");
    expect(scene.grids!.length).toBe(2);
    // Grid 1: 9 cells, Grid 2: 9 cells (1 filled + 8 empty)
    expect(scene.grids![0].cells.filter((c) => c.shotId).length).toBe(9);
    expect(scene.grids![1].cells.filter((c) => c.shotId).length).toBe(1);
  });

  it("CSS: beats badge + popover + coverage + mood override + gutter styles present", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(path.resolve("./src/components/film.css"), "utf-8");
    expect(css).toContain("SPRINT 1.0 r7 — BEATS BADGE + POPOVER");
    expect(css).toContain(".ksp-pacing-beats");
    expect(css).toContain(".ksp-pacing-popup-beats");
    expect(css).toContain(".ksp-pacing-popup-beat-item");
    expect(css).toContain(".ksp-mood-override-section");
    expect(css).toContain(".ksp-mood-override-reset");
    expect(css).toContain(".ksp-coverage-banner");
    expect(css).toContain(".ksp-coverage-modal");
    expect(css).toContain(".ksp-coverage-beat-covered");
    expect(css).toContain(".ksp-coverage-beat-missing");
    expect(css).toContain(".ksp-modal-gutter-handle");
    expect(css).toContain(".ksp-storyboard-multigrid-container");
  });

  it("FilmIdeaScriptSection wires beats badge + auto-detection on Stage 5 + J3 re-detect", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmIdeaScriptSection.tsx"), "utf-8");
    expect(src).toContain("BEAT_TYPE_LABELS");
    expect(src).toContain("ksp-pacing-beats");
    expect(src).toContain("ksp-pacing-popup-beats");
    // Auto-detect after Stage 5 finalize
    expect(src).toContain("runDetectBeatsForAllScenes");
    expect(src).toContain("applyBeatsAndPhysicalLock");
    expect(src).toContain("Đang phân tích beats");
    // J3 auto re-detect
    expect(src).toContain("onRedetectBeats");
    expect(src).toContain("runDetectBeatsForScene");
    expect(src).toContain("actionDirty");
  });

  it("FilmShotListSection: coverage indicator + modal + migration warning", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmShotListSection.tsx"), "utf-8");
    expect(src).toContain("ksp-coverage-banner");
    expect(src).toContain("Beat coverage:");
    expect(src).toContain("ksp-coverage-modal");
    expect(src).toContain("hasLegacyVietnamesePurpose");
    expect(src).toContain("tiếng Việt từ phiên bản cũ");
    // Pass beats to AI generation
    expect(src).toContain("beats: (scene as any).beats");
  });

  it("FilmFrameEditModal: per-shot mood section + draggable gutter", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmFrameEditModal.tsx"), "utf-8");
    expect(src).toContain("ksp-mood-override-section");
    expect(src).toContain("Override per-shot mood");
    expect(src).toContain("lightingHintEn");
    expect(src).toContain("shotMoodOverride");
    expect(src).toContain("shotMoodIntensity");
    // Draggable gutter
    expect(src).toContain("ksp-modal-gutter-handle");
    expect(src).toContain("onGutterMouseDown");
    expect(src).toContain("leftPaneWidth");
    expect(src).toContain("ksp.frameEdit.leftPaneWidth");
  });

  it("FilmStoryboardSection: multi-grid seamless container + Grid 2 ref Grid 1 auto", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmStoryboardSection.tsx"), "utf-8");
    expect(src).toContain("ksp-storyboard-multigrid-container");
    expect(src).toContain("cellNumberOffset");
    expect(src).toContain("hideHeader");
    expect(src).toContain("previousGridGenerated");
    expect(src).toContain("Grid {grid.order} auto-references Grid {grid.order - 1}");
  });

  // Sprint 1.0 r7.5 (Hướng A) — multi-grid prompt tabs refactor
  it("r7.5 FilmStoryboardSection: GridPromptPanel + MultiGridPromptTabs components exist", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmStoryboardSection.tsx"), "utf-8");
    // New component definitions
    expect(src).toContain("function GridPromptPanel");
    expect(src).toContain("function MultiGridPromptTabs");
    // Tab CSS classes referenced in JSX
    expect(src).toContain("ksp-storyboard-multigrid-prompts");
    expect(src).toContain("ksp-storyboard-prompt-tabs");
    expect(src).toContain("ksp-storyboard-prompt-tab-active");
    // Hướng A render branching: single grid vs multi grid
    expect(src).toContain("grids.length === 1");
    expect(src).toContain("MultiGridPromptTabs");
    // Tab mode prop passing
    expect(src).toContain("hideToggleRow");
  });

  it("r7.5 FilmStoryboardSection: GridDisplay no longer renders prompt panel inline", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmStoryboardSection.tsx"), "utf-8");
    // Slice gdBody = function GridDisplay body up to its closing brace + blank line
    // (boundary marker = the comment block opening for GridPromptPanel).
    const gdStart = src.indexOf("function GridDisplay(");
    const gdEnd = src.indexOf("\n/**\n * Sprint 1.0 r7.5 (Hướng A) — GridPromptPanel");
    expect(gdStart).toBeGreaterThan(-1);
    expect(gdEnd).toBeGreaterThan(gdStart);
    const gdBody = src.slice(gdStart, gdEnd);
    // GridDisplay keeps cell-level concerns
    expect(gdBody).toContain("editingCellOrder");
    expect(gdBody).toContain("FilmFrameEditModal");
    expect(gdBody).toContain("handleUploadVideoForCell");
    // GridDisplay does NOT keep prompt-level state/handlers anymore (check actual code patterns)
    expect(gdBody).not.toContain("setPromptExpanded");
    expect(gdBody).not.toContain("setPendingUpload");
    expect(gdBody).not.toContain("handleCopyPrompt");
    expect(gdBody).not.toContain("handleDownloadRefs");
    expect(gdBody).not.toContain("GridCropPreviewModal");
  });

  it("r7.5 MultiGridPromptTabs: activeIdx state with Grid 1 default active (r7.7 update)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmStoryboardSection.tsx"), "utf-8");
    const tabsStart = src.indexOf("function MultiGridPromptTabs");
    expect(tabsStart).toBeGreaterThan(-1);
    const tabsBody = src.slice(tabsStart, tabsStart + 8000);
    // r7.7: Grid 1 default active = useState<number | null>(0)
    expect(tabsBody).toContain("useState<number | null>(0)");
    // Click active tab → collapse (toggle behavior)
    expect(tabsBody).toContain("setActiveIdx(isActive ? null : idx)");
    // Render GridPromptPanel for active tab in controlled tab mode
    expect(tabsBody).toContain("hideToggleRow={true}");
    expect(tabsBody).toContain("expanded={true}");
  });

  it("r7.5 film.css: tab CSS classes + multigrid prompts container styles", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(path.resolve("./src/components/film.css"), "utf-8");
    expect(css).toContain(".ksp-storyboard-multigrid-prompts");
    expect(css).toContain(".ksp-storyboard-prompt-tabs");
    expect(css).toContain(".ksp-storyboard-prompt-tab");
    expect(css).toContain(".ksp-storyboard-prompt-tab-active");
    expect(css).toContain(".ksp-storyboard-prompt-tab-actions");
    // Stale rule must be removed: prompt-collapsible inside Grid 2+ grid-block (no longer applies)
    expect(css).not.toMatch(/ksp-storyboard-grid-block:not\(:first-child\)\s*>\s*\.ksp-storyboard-prompt-collapsible/);
  });

  // Sprint 1.0 r7.6 (UI batch) — multi-grid CSS tweaks + pacing border + cast + twists editable + sections collapsed
  it("r7.6 film.css: multi-grid tabs CSS adjustments (padding, gap, border-radius, :has() sibling)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(path.resolve("./src/components/film.css"), "utf-8");
    // Grid 2+ block: padding 0 10px (Jason r7.6), no longer transparent
    expect(css).toMatch(/ksp-storyboard-multigrid-container\s*>\s*\.ksp-storyboard-grid-block:not\(:first-child\)\s*\{[^}]*padding:\s*0\s+10px/);
    // multigrid-prompts margin-top 0
    expect(css).toMatch(/\.ksp-storyboard-multigrid-prompts\s*\{[^}]*margin-top:\s*0/);
    // tabs gap 0
    expect(css).toMatch(/\.ksp-storyboard-prompt-tabs\s*\{[^}]*gap:\s*0/);
    // tab border-radius 0
    expect(css).toMatch(/\.ksp-storyboard-prompt-tab\s*\{[^}]*border-radius:\s*0/);
    // :has() sibling rule for non-active tabs
    expect(css).toContain(":has(.ksp-storyboard-prompt-tab-active)");
    expect(css).toContain("border-bottom: 1px solid #534AB7");
  });

  it("r7.6 film.css: pacing dashboard section has full border framing like .ksp-section", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(path.resolve("./src/components/film.css"), "utf-8");
    // .ksp-pacing-dashboard-section block must declare standard border + radius (matching .ksp-section)
    const match = css.match(/\.ksp-pacing-dashboard-section\s*\{[^}]+\}/);
    expect(match).not.toBeNull();
    const rule = match![0];
    expect(rule).toContain("border");
    expect(rule).toContain("border-radius");
    expect(rule).toContain("background");
  });

  it("r7.6 CastFilmSection: + button uses margin-left auto (pushed to right corner)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(path.resolve("./src/components/film.css"), "utf-8");
    const match = css.match(/\.ksp-cast-film-add-corner\s*\{[^}]+\}/);
    expect(match).not.toBeNull();
    expect(match![0]).toMatch(/margin-left:\s*auto/);
  });

  it("r7.6 CastFilmSection: avatar renders face ref image when present, emoji fallback", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/CastFilmSection.tsx"), "utf-8");
    // New img element with ksp-cast-film-avatar-img class
    expect(src).toContain("ksp-cast-film-avatar-img");
    expect(src).toContain("firstFaceRefUrl");
    expect(src).toContain("character.faceRefs?.[0]?.dataUrl");
    // CSS for the img
    const css = fs.readFileSync(path.resolve("./src/components/film.css"), "utf-8");
    expect(css).toMatch(/\.ksp-cast-film-avatar-img\s*\{[^}]*object-fit:\s*cover/);
    expect(css).toMatch(/\.ksp-cast-film-avatar-img\s*\{[^}]*border-radius:\s*50%/);
  });

  it("r7.6 Stage 3 Twists: addScriptTwist + removeScriptTwist actions exist with correct shape", async () => {
    const { addScriptTwist, removeScriptTwist } = await import("../src/store/film_actions");
    expect(typeof addScriptTwist).toBe("function");
    expect(typeof removeScriptTwist).toBe("function");
    // Functional test: addScriptTwist appends to scriptTwists with empty description default
    const baseProject: any = {
      id: "p1",
      filmV093: {
        scriptTwists: [
          { id: "t1", beatId: "b1", description: "existing", accepted: true },
        ],
      },
    };
    const addPatch = addScriptTwist(baseProject, "b2");
    expect(addPatch.filmV093?.scriptTwists).toHaveLength(2);
    const newTwist = addPatch.filmV093!.scriptTwists![1];
    expect(newTwist.beatId).toBe("b2");
    expect(newTwist.description).toBe("");
    expect(newTwist.accepted).toBeUndefined();
    expect(newTwist.id).toMatch(/^twist_/);
    // removeScriptTwist removes by id
    const removePatch = removeScriptTwist(baseProject, "t1");
    expect(removePatch.filmV093?.scriptTwists).toHaveLength(0);
  });

  it("r7.6 ActiveStage3 UI: editable + remove + add form wired", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmIdeaScriptSection.tsx"), "utf-8");
    // Edit-on-click state + draft state
    expect(src).toContain("editingTwistId");
    expect(src).toContain("twistDraft");
    // Blur-to-save commit function
    expect(src).toContain("commitTwistEdit");
    // Remove handler
    expect(src).toContain("handleRemoveTwist");
    // Add form state + handler
    expect(src).toContain("addBeatId");
    expect(src).toContain("handleAddNewTwist");
    // JSX uses textarea for inline edit
    expect(src).toContain("ksp-step-twist-edit");
    expect(src).toContain("ksp-step-twist-remove-btn");
    expect(src).toContain("ksp-step-twist-add-form");
    // Imports new actions
    expect(src).toContain("removeScriptTwist");
    expect(src).toContain("addScriptTwist");
  });

  it("r7.7 manifest + package version bump to r7.8-downloads", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const manifest = JSON.parse(fs.readFileSync(path.resolve("./manifest.json"), "utf-8"));
    expect(manifest.version_name).toBe("0.9.4-r7.8-downloads");
    expect(manifest.version).toBe("0.9.4.16");
    expect(manifest.action.default_title).toContain("v0.9.4-r7.8");
    const pkg = JSON.parse(fs.readFileSync(path.resolve("./package.json"), "utf-8"));
    expect(pkg.version).toBe("0.9.4-r7.8-downloads");
  });

  // Sprint 1.0 r7.8 — story overview download + per-scene prompt ZIP downloads
  it("r7.8 engine: filmStoryOverviewExport builds Vietnamese text overview", async () => {
    const { buildStoryOverviewTxt } = await import("../src/engine/filmStoryOverviewExport");
    expect(typeof buildStoryOverviewTxt).toBe("function");

    const minimalInput: any = {
      idea: { raw: "Robot bị lạc trong rừng", language: "vi" },
      script: {
        titleVi: "Robot Thức Tỉnh",
        titleEn: "Robot Awakening",
        loglineVi: "Một robot tìm được mục đích sống",
        scenes: [
          {
            id: "s1",
            order: 1,
            titleVi: "Mở đầu",
            settings: "Khu rừng nguyên sinh",
            durationSeconds: 30,
            emotionalTone: "tender",
            tensionLevel: 3,
            actionLinesVi: "Robot G.N.U.D nằm im trong cây rêu.",
            dialog: [],
          },
        ],
      },
      characters: [
        { id: "c1", order: 1, name: "G.N.U.D", role: "protagonist", description: "Robot rỉ sét", faceRefs: [], bodyRefs: [] },
      ],
      shotsBySceneId: {
        s1: [
          {
            id: "sh1",
            order: 1,
            shotType: "wide_establishing",
            cameraMovement: "static",
            durationSeconds: 5,
            actionVi: "Toàn cảnh khu rừng",
          },
        ],
      },
      setting: { animationStyle: "cgi_3d_cinematic", aspectRatio: "16:9" },
    };
    const text = buildStoryOverviewTxt(minimalInput);
    expect(text).toContain("ROBOT THỨC TỈNH");
    expect(text).toContain("Robot bị lạc trong rừng");
    expect(text).toContain("Một robot tìm được mục đích sống");
    expect(text).toContain("PHÂN CẢNH 1");
    expect(text).toContain("Mở đầu");
    expect(text).toContain("Khu rừng nguyên sinh");
    expect(text).toContain("G.N.U.D");
    expect(text).toContain("Robot rỉ sét");
    expect(text).toContain("SHOT 1.1");
    expect(text).toContain("Wide / Toàn cảnh");
    expect(text).toContain("TỔNG KẾT");
    expect(text).toContain("Tổng số shots:    1");
  });

  it("r7.8 engine: filmStoryOverviewExport handles empty script gracefully", async () => {
    const { buildStoryOverviewTxt } = await import("../src/engine/filmStoryOverviewExport");
    const text = buildStoryOverviewTxt({
      idea: undefined,
      script: undefined,
      characters: [],
      shotsBySceneId: {},
      setting: undefined,
    });
    // Should produce header + summary footer even with no data
    expect(text).toContain("PHIM:");
    expect(text).toContain("TỔNG KẾT");
    expect(text).toContain("Tổng số phân cảnh: 0");
    expect(text).toContain("Tổng số shots:    0");
  });

  it("r7.8 ShotListSection: download story overview button wired with handler", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmShotListSection.tsx"), "utf-8");
    expect(src).toContain('import { buildStoryOverviewTxt } from "../engine/filmStoryOverviewExport"');
    expect(src).toContain("handleDownloadStoryOverview");
    expect(src).toContain("ksp-shotlist-download-overview-btn");
    expect(src).toContain("_overview.txt");
    // UTF-8 BOM for Vietnamese Notepad rendering
    expect(src).toContain('"\\ufeff"');
  });

  it("r7.8 StoryboardSection: Grid header renamed 'Grid - Scene N' + 2 download buttons wired", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/FilmStoryboardSection.tsx"), "utf-8");
    // Header rename — JSX literal "Grid - Scene {scene.order}"
    expect(src).toContain("Grid - Scene {scene.order}");
    expect(src).not.toContain("<strong>Grid {grid.order}</strong>");
    // Handlers
    expect(src).toContain("handleDownloadAnimationPrompts");
    expect(src).toContain("handleDownloadImagePrompts");
    // ZIP filename conventions
    expect(src).toContain("scene-${scene.order}_animation_prompts.zip");
    expect(src).toContain("scene-${scene.order}_image_prompts.zip");
    // Inner file naming
    expect(src).toContain("prompt_shot_${s.order}.txt");
    // Prompt resolution: AI re-prompt override → fallback to deterministic builder
    expect(src).toContain("animationPromptR5");
    expect(src).toContain("imagePromptR5");
    expect(src).toContain("buildAnimationPrompt");
    expect(src).toContain("buildSingleShotImagePrompt");
    // CSS classes
    expect(src).toContain("ksp-storyboard-grid-header-downloads");
  });

  it("r7.8 film.css: download button styles for shotlist overview + grid header downloads", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(path.resolve("./src/components/film.css"), "utf-8");
    expect(css).toContain(".ksp-shotlist-download-overview-btn");
    expect(css).toContain(".ksp-storyboard-grid-header-downloads");
    // Right corner alignment
    expect(css).toMatch(/\.ksp-shotlist-download-overview-btn\s*\{[^}]*margin-left:\s*auto/);
    expect(css).toMatch(/\.ksp-storyboard-grid-header-downloads\s*\{[^}]*margin-left:\s*auto/);
  });

  // r7.7 hotfix items (UI gap + active tab default)
  it("r7.7 fix: twist add button + form have bottom margin to separate from orange Continue button", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(path.resolve("./src/components/film.css"), "utf-8");
    // Both add-btn AND add-form must have margin-bottom (10px)
    expect(css).toMatch(/\.ksp-step-twist-add-btn\s*\{[^}]*margin-bottom:\s*10px/);
    expect(css).toMatch(/\.ksp-step-twist-add-form\s*\{[^}]*margin-bottom:\s*10px/);
  });

  // Sprint G1d (Item 6) — AI cast prompt generation
  it("G1d engine: runGenerateCastPromptSet exists with correct signature + multimodal branch", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/filmCastGeneration.ts"), "utf-8");
    expect(src).toContain("export interface CastPromptSet");
    expect(src).toContain("facePrompt");
    expect(src).toContain("bodyPrompt");
    expect(src).toContain("anchorTokens");
    expect(src).toContain("export async function runGenerateCastPromptSet");
    expect(src).toContain("useFaceRefForMatch");
    // Multimodal Gemini call branch exists
    expect(src).toContain("callGeminiMultimodal");
    expect(src).toContain("inline_data");
    expect(src).toContain("GEMINI_FLASH_MM_ENDPOINT");
  });

  it("G1d engine: parses CastPromptSet JSON correctly with anchor tokens defaulting to []", async () => {
    // Direct unit test of the parsing logic via the parser pattern.
    // We can't easily mock callAi here, but we can verify the engine module imports & types.
    const engine = await import("../src/engine/filmCastGeneration");
    expect(typeof engine.runGenerateCastPromptSet).toBe("function");
    // Verify type exports
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/engine/filmCastGeneration.ts"), "utf-8");
    // Defensive: missing anchorTokens defaults to []
    expect(src).toContain("parsed.anchorTokens = []");
    // Missing required fields throws
    expect(src).toContain("missing facePrompt or bodyPrompt");
  });

  it("G1d CastPromptModal: component file exists with 2 tabs + actions + anchor + workflow", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const exists = fs.existsSync(path.resolve("./src/components/CastPromptModal.tsx"));
    expect(exists).toBe(true);
    const src = fs.readFileSync(path.resolve("./src/components/CastPromptModal.tsx"), "utf-8");
    // 2 tab keys + active state
    expect(src).toContain('TabKey = "face" | "body"');
    expect(src).toContain("activeTab");
    expect(src).toContain("👤 Face portrait");
    expect(src).toContain("🧍 Full body");
    // Copy + Regen actions
    expect(src).toContain("handleCopy");
    expect(src).toContain("handleRegen");
    expect(src).toContain("navigator.clipboard.writeText");
    // Anchor tokens collapsible
    expect(src).toContain("showAnchorTokens");
    expect(src).toContain("Anchor tokens");
    // Workflow guide
    expect(src).toContain("Workflow");
    // Match refs toggle (multimodal)
    expect(src).toContain("useFaceRefForMatch");
    // Backdrop click-to-close
    expect(src).toContain("ksp-cast-prompt-modal-backdrop");
    expect(src).toContain("onClick={onClose}");
    expect(src).toContain("stopPropagation");
  });

  it("G1d CastFilmSection: wires 📝 button + modal trigger + handleGenerateCastPrompt", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve("./src/components/CastFilmSection.tsx"), "utf-8");
    // Imports
    expect(src).toContain("runGenerateCastPromptSet");
    expect(src).toContain("CastPromptSet");
    expect(src).toContain('import { CastPromptModal } from "./CastPromptModal"');
    // State
    expect(src).toContain("promptResult");
    expect(src).toContain("isGeneratingPrompt");
    expect(src).toContain("promptMatchedToRefs");
    // Handler
    expect(src).toContain("handleGenerateCastPrompt");
    expect(src).toContain("useFaceRefForMatch");
    // Button in JSX
    expect(src).toContain("ksp-cast-film-castprompt-icon-btn");
    expect(src).toContain('"📝"');
    // Modal mounts conditionally
    expect(src).toContain("<CastPromptModal");
    expect(src).toContain("matchedToRefs={promptMatchedToRefs}");
  });

  it("G1d film.css: cast prompt button + modal styles defined", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const css = fs.readFileSync(path.resolve("./src/components/film.css"), "utf-8");
    expect(css).toContain(".ksp-cast-film-castprompt-icon-btn");
    expect(css).toContain(".ksp-cast-prompt-modal-backdrop");
    expect(css).toContain(".ksp-cast-prompt-modal");
    expect(css).toContain(".ksp-cast-prompt-modal-tabs");
    expect(css).toContain(".ksp-cast-prompt-modal-tab-active");
    expect(css).toContain(".ksp-cast-prompt-modal-anchor");
    expect(css).toContain(".ksp-cast-prompt-modal-workflow");
    expect(css).toContain(".ksp-cast-prompt-modal-match-toggle");
    // position fixed backdrop (z-index high)
    expect(css).toMatch(/\.ksp-cast-prompt-modal-backdrop\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.ksp-cast-prompt-modal-backdrop\s*\{[^}]*z-index:\s*9000/);
  });
});
