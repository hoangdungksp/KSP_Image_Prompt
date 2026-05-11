/**
 * KSP Image v0.9.3 — Film mode CRUD actions
 *
 * Pure functions returning patches.
 * Components call: useAppStore.getState().updateCurrentProject(filmAction(...))
 *
 * Mirrors photos_actions.ts pattern but for Film schema (film_v093.ts).
 *
 * All actions reduce-style: produce updated FilmV093Data, never mutate.
 */

import {
  createDefaultFilmV093,
  createFilmCharacter,
  type FilmV093Data,
  type FilmCharacter,
  type FilmImageRef,
  type FilmCharacterRole,
  MAX_FACE_REFS_FILM,
  MAX_BODY_REFS,
} from "../types/film_v093";
import type { PromptProject, ProjectV09Extensions } from "../types";

type ProjWithFilm = PromptProject & ProjectV09Extensions;

/** Get film data, creating default if missing. */
export function ensureFilmData(project: PromptProject): FilmV093Data {
  const p = project as ProjWithFilm;
  return p.filmV093 ?? createDefaultFilmV093();
}

function patch(data: FilmV093Data): Partial<ProjWithFilm> {
  return { filmV093: { ...data, updatedAt: Date.now() } };
}

// ============================================================================
// CHARACTER CRUD
// ============================================================================

export function addCharacter(
  project: PromptProject,
  role: FilmCharacterRole = "protagonist"
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const newChar = createFilmCharacter(data.characters.length + 1, role);
  const next: FilmV093Data = {
    ...data,
    characters: [...data.characters, newChar],
    selectedCharacterId: data.selectedCharacterId ?? newChar.id,
  };
  return patch(next);
}

export function updateCharacter(
  project: PromptProject,
  characterId: string,
  updates: Partial<FilmCharacter>
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const next: FilmV093Data = {
    ...data,
    characters: data.characters.map((c) =>
      c.id === characterId ? { ...c, ...updates } : c
    ),
  };
  return patch(next);
}

export function removeCharacter(
  project: PromptProject,
  characterId: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const remaining = data.characters.filter((c) => c.id !== characterId);
  // Re-order
  const reordered = remaining.map((c, idx) => ({ ...c, order: idx + 1 }));
  const next: FilmV093Data = {
    ...data,
    characters: reordered,
    selectedCharacterId:
      data.selectedCharacterId === characterId
        ? reordered[0]?.id
        : data.selectedCharacterId,
  };
  return patch(next);
}

export function selectCharacter(
  project: PromptProject,
  characterId: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({ ...data, selectedCharacterId: characterId });
}

// ============================================================================
// FACE REFS CRUD (Q3: cap 1-4)
// ============================================================================

export function addFaceRef(
  project: PromptProject,
  characterId: string,
  imageRef: FilmImageRef
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({
    ...data,
    characters: data.characters.map((c) => {
      if (c.id !== characterId) return c;
      if (c.faceRefs.length >= MAX_FACE_REFS_FILM) return c; // cap enforced
      return { ...c, faceRefs: [...c.faceRefs, imageRef] };
    }),
  });
}

export function removeFaceRef(
  project: PromptProject,
  characterId: string,
  refId: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({
    ...data,
    characters: data.characters.map((c) =>
      c.id === characterId
        ? { ...c, faceRefs: c.faceRefs.filter((r) => r.id !== refId) }
        : c
    ),
  });
}

export function relabelFaceRef(
  project: PromptProject,
  characterId: string,
  refId: string,
  newLabel: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({
    ...data,
    characters: data.characters.map((c) =>
      c.id === characterId
        ? {
            ...c,
            faceRefs: c.faceRefs.map((r) =>
              r.id === refId ? { ...r, label: newLabel } : r
            ),
          }
        : c
    ),
  });
}

// ============================================================================
// BODY REFS CRUD (Q3: cap 1-3)
// ============================================================================

export function addBodyRef(
  project: PromptProject,
  characterId: string,
  imageRef: FilmImageRef
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({
    ...data,
    characters: data.characters.map((c) => {
      if (c.id !== characterId) return c;
      if (c.bodyRefs.length >= MAX_BODY_REFS) return c; // cap enforced
      return { ...c, bodyRefs: [...c.bodyRefs, imageRef] };
    }),
  });
}

export function removeBodyRef(
  project: PromptProject,
  characterId: string,
  refId: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({
    ...data,
    characters: data.characters.map((c) =>
      c.id === characterId
        ? { ...c, bodyRefs: c.bodyRefs.filter((r) => r.id !== refId) }
        : c
    ),
  });
}

export function relabelBodyRef(
  project: PromptProject,
  characterId: string,
  refId: string,
  newLabel: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({
    ...data,
    characters: data.characters.map((c) =>
      c.id === characterId
        ? {
            ...c,
            bodyRefs: c.bodyRefs.map((r) =>
              r.id === refId ? { ...r, label: newLabel } : r
            ),
          }
        : c
    ),
  });
}

// ============================================================================
// AI GENERATE STUB (Q4 — save description, no API call r2)
// ============================================================================

export function setAiGenDescription(
  project: PromptProject,
  characterId: string,
  description: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({
    ...data,
    characters: data.characters.map((c) =>
      c.id === characterId ? { ...c, aiGenDescription: description } : c
    ),
  });
}

export function clearAiGenDescription(
  project: PromptProject,
  characterId: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({
    ...data,
    characters: data.characters.map((c) => {
      if (c.id !== characterId) return c;
      const { aiGenDescription, ...rest } = c;
      return rest;
    }),
  });
}

// ============================================================================
// SCRIPT CRUD (r3 — Mockup 2 Stage 5 quick path)
// ============================================================================

import type { FilmScript } from "../types/v0_9_0";

/**
 * Set/replace film script. Pushes current script (if exists) onto versions stack (last-10).
 */
export function setScript(
  project: PromptProject,
  script: FilmScript
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const prevVersions = data.script?.versions ?? [];

  let archivedVersions: typeof prevVersions = prevVersions;
  if (data.script) {
    const { versions, ...snapshot } = data.script;
    const newVersion = {
      id: `ver_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      timestamp: Date.now(),
      label: `version ${prevVersions.length + 1}`,
      scriptSnapshot: snapshot,
    };
    archivedVersions = [...prevVersions, newVersion].slice(-10);
  }

  return patch({
    ...data,
    script: {
      ...script,
      versions: archivedVersions,
    },
  });
}

/**
 * Clear current script (reset to no-script state).
 */
export function clearScript(project: PromptProject): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const { script, ...rest } = data;
  return patch(rest as FilmV093Data);
}

/**
 * Revert to a specific archived version (0-indexed from versions array).
 */
export function revertScriptToVersion(
  project: PromptProject,
  versionIndex: number
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  if (!data.script?.versions || versionIndex < 0 || versionIndex >= data.script.versions.length) {
    return {};
  }
  const target = data.script.versions[versionIndex];
  const remainingVersions = data.script.versions.filter((_, i) => i !== versionIndex);

  // Restore snapshot fields onto a full FilmScript with the remaining versions array
  const restoredScript: FilmScript = {
    ...target.scriptSnapshot,
    versions: remainingVersions,
  };
  return patch({
    ...data,
    script: restoredScript,
  });
}

export function setScriptProvider(
  project: PromptProject,
  provider: "gemini-flash" | "openai-4o"
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({ ...data, scriptProvider: provider });
}

// ============================================================================
// MANUAL SCRIPT EDITS (r3 — user edits scenes after AI generation)
// ============================================================================

import type { FilmSceneScript } from "../types/v0_9_0";

export function updateSceneInScript(
  project: PromptProject,
  sceneId: string,
  updates: Partial<FilmSceneScript>
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  if (!data.script) return {};
  return patch({
    ...data,
    script: {
      ...data.script,
      scenes: data.script.scenes.map((s) =>
        s.id === sceneId ? { ...s, ...updates } : s
      ),
    },
  });
}

export function addEmptyScene(
  project: PromptProject
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  if (!data.script) return {};
  const order = data.script.scenes.length + 1;
  const newScene: FilmSceneScript = {
    id: `scene_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    order,
    titleEn: `Scene ${order}`,
    titleVi: `Cảnh ${order}`,
    settings: "INT. — DAY",
    durationSeconds: 30,
    act: "rising",
    actionLinesEn: "",
    dialog: [],
    sfx: [],
    musicBrief: "",
  };
  return patch({
    ...data,
    script: {
      ...data.script,
      scenes: [...data.script.scenes, newScene],
    },
  });
}

export function removeScene(
  project: PromptProject,
  sceneId: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  if (!data.script) return {};
  return patch({
    ...data,
    script: {
      ...data.script,
      scenes: data.script.scenes
        .filter((s) => s.id !== sceneId)
        .map((s, i) => ({ ...s, order: i + 1 })),
    },
  });
}

// ============================================================================
// r4 — SHOT CRUD (Mockup 3 Storyboard)
// ============================================================================

import type { FilmShot } from "../types/v0_9_0";

export type FilmShotGridFormat = "2x2" | "2x3" | "3x2" | "3x3" | "4x3";

export function getShotsForScene(
  project: PromptProject,
  sceneId: string
): FilmShot[] {
  const data = ensureFilmData(project);
  return data.shotsBySceneId?.[sceneId] ?? [];
}

function patchShotsForScene(
  data: FilmV093Data,
  sceneId: string,
  shots: FilmShot[]
): FilmV093Data {
  return {
    ...data,
    shotsBySceneId: {
      ...(data.shotsBySceneId ?? {}),
      [sceneId]: shots,
    },
  };
}

export function addShot(
  project: PromptProject,
  sceneId: string,
  override?: Partial<FilmShot>
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const existing = data.shotsBySceneId?.[sceneId] ?? [];
  const order = existing.length + 1;
  const newShot: FilmShot = {
    id: `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    order,
    titleEn: `Shot ${order}`,
    titleVi: `Shot ${order}`,
    shotType: "medium",
    durationSeconds: 5,
    gridFormat: "3x3",
    cameraMovement: "handheld_documentary" as any,
    status: "draft",
    ...override,
  };
  return patch(patchShotsForScene(data, sceneId, [...existing, newShot]));
}

export function updateShot(
  project: PromptProject,
  sceneId: string,
  shotId: string,
  updates: Partial<FilmShot>
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const existing = data.shotsBySceneId?.[sceneId] ?? [];
  return patch(
    patchShotsForScene(
      data,
      sceneId,
      existing.map((s) => (s.id === shotId ? { ...s, ...updates } : s))
    )
  );
}

export function removeShot(
  project: PromptProject,
  sceneId: string,
  shotId: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const existing = data.shotsBySceneId?.[sceneId] ?? [];
  const remaining = existing
    .filter((s) => s.id !== shotId)
    .map((s, i) => ({ ...s, order: i + 1 }));
  return patch(patchShotsForScene(data, sceneId, remaining));
}

export function setShotStatus(
  project: PromptProject,
  sceneId: string,
  shotId: string,
  status: FilmShot["status"]
): Partial<ProjWithFilm> {
  return updateShot(project, sceneId, shotId, { status });
}

export function toggleShotLocked(
  project: PromptProject,
  sceneId: string,
  shotId: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const existing = data.shotsBySceneId?.[sceneId] ?? [];
  const shot = existing.find((s) => s.id === shotId);
  if (!shot) return {};
  return updateShot(project, sceneId, shotId, { locked: !shot.locked });
}
