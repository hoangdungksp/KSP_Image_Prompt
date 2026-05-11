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
} from "../src/types/film_v093";

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
} from "../src/store/film_actions";

import { CastFilmSection } from "../src/components/CastFilmSection";
import { FilmStoryboardSection } from "../src/components/FilmStoryboardSection";

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
    expect(container.innerHTML).toContain("+ Thêm");
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

  it("FilmStoryboardSection mounts without crash", () => {
    useAppStore.setState({ currentProject: baseFilmProject });
    const { container } = render(<FilmStoryboardSection />);
    expect(container.innerHTML).toContain("STORYBOARD");
  });
});
