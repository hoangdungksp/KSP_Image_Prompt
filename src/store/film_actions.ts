/**
 * KSP Image v0.9.3 — Film mode CRUD actions
 *
 * Pure functions returning patches.
 * Components call: useAppStore.getState().updateCurrentProject(filmAction(...))
 *
 * Mirrors photos_actions.ts pattern but for Film schema (film_v093.ts).
 *
 * All actions reduce-style: produce updated FilmData, never mutate.
 */

import {
  createDefaultFilmV093,
  createFilmCharacter,
  type FilmData,
  type FilmCharacter,
  type FilmImageRef,
  type FilmCharacterRole,
  MAX_FACE_REFS_FILM,
  MAX_BODY_REFS,
} from "../types/film";
import type { PromptProject, ProjectV09Extensions } from "../types";

type ProjWithFilm = PromptProject & ProjectV09Extensions;

/** Get film data, creating default if missing. */
export function ensureFilmData(project: PromptProject): FilmData {
  const p = project as ProjWithFilm;
  return p.filmV093 ?? createDefaultFilmV093();
}

function patch(data: FilmData): Partial<ProjWithFilm> {
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
  const next: FilmData = {
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
  const next: FilmData = {
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
  const next: FilmData = {
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

import type { FilmScript } from "../types/project";

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

  // qc12 fix: When Stage 5 completes, clear scriptStage so all 5 stages
  // render as done preview (no active panel). User can still click any
  // done stage's "Regen / Edit" button to re-enter active mode.
  return patch({
    ...data,
    script: {
      ...script,
      versions: archivedVersions,
    },
    scriptStage: undefined,
  });
}

/**
 * Clear current script (reset to no-script state).
 */
export function clearScript(project: PromptProject): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const { script, ...rest } = data;
  return patch(rest as FilmData);
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

import type { FilmSceneScript } from "../types/project";

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

import type { FilmShot } from "../types/project";

export type FilmShotGridFormat = "2x2" | "2x3" | "3x2" | "3x3" | "4x3" | "3x4";

export function getShotsForScene(
  project: PromptProject,
  sceneId: string
): FilmShot[] {
  const data = ensureFilmData(project);
  return data.shotsBySceneId?.[sceneId] ?? [];
}

function patchShotsForScene(
  data: FilmData,
  sceneId: string,
  shots: FilmShot[]
): FilmData {
  return {
    ...data,
    shotsBySceneId: {
      ...(data.shotsBySceneId ?? {}),
      [sceneId]: shots,
    },
  };
}

/**
 * qc10: Bulk replace shots for a scene. Used after AI generates shot list.
 * Overwrites entire array — caller decides whether to merge or replace.
 */
export function setShotsForScene(
  project: PromptProject,
  sceneId: string,
  shots: FilmShot[]
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch(patchShotsForScene(data, sceneId, shots));
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

// ============================================================================
// r5 — SHOT DETAIL PANEL ACTIONS (Mockup 4 inline expand drawer)
// ============================================================================

import {
  type FilmVideoProvider,
  type ShotR5Frame,
  DEFAULT_VIDEO_PROVIDERS,
  createShotR5Frames,
} from "../types/film";

/**
 * Expand a shot (or collapse if same shot already expanded).
 * Singleton: only one shot can be expanded at a time, even across scenes.
 */
export function expandShot(
  project: PromptProject,
  shotId: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const isAlreadyExpanded = data.expandedShotId === shotId;
  return patch({
    ...data,
    expandedShotId: isAlreadyExpanded ? undefined : shotId,
  });
}

export function collapseShot(project: PromptProject): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({ ...data, expandedShotId: undefined });
}

/** r5 image prompt EN — separate field from legacy imagePrompt to avoid mixing data. */
export function setShotImagePrompt(
  project: PromptProject,
  sceneId: string,
  shotId: string,
  promptEn: string
): Partial<ProjWithFilm> {
  return updateShot(project, sceneId, shotId, { imagePromptR5: promptEn });
}

/** r5 animation prompt EN — flat string, not chunks array (replaces legacy animationPrompts). */
export function setShotAnimationPrompt(
  project: PromptProject,
  sceneId: string,
  shotId: string,
  promptEn: string
): Partial<ProjWithFilm> {
  return updateShot(project, sceneId, shotId, { animationPromptR5: promptEn });
}

/** r5 selected video provider — defaults to "seedance-2-pro" if no prior selection. */
export function setShotVideoProvider(
  project: PromptProject,
  sceneId: string,
  shotId: string,
  providerId: string
): Partial<ProjWithFilm> {
  return updateShot(project, sceneId, shotId, { videoProviderId: providerId });
}

/**
 * r5 set grid image — saves base64 dataURL inline + auto-derives frame slots from grid format.
 * Idempotent: if frames already match grid count, preserves them; else regenerates.
 */
export function setShotGridImage(
  project: PromptProject,
  sceneId: string,
  shotId: string,
  dataUrl: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const existing = data.shotsBySceneId?.[sceneId] ?? [];
  const shot = existing.find((s) => s.id === shotId);
  if (!shot) return {};
  const expectedCount = shot.gridFormat
    .split("x")
    .map(Number)
    .reduce((a, b) => a * b, 1);
  const needsFreshFrames =
    !shot.framesR5 || shot.framesR5.length !== expectedCount;
  return updateShot(project, sceneId, shotId, {
    gridImageDataUrl: dataUrl,
    framesR5: needsFreshFrames ? createShotR5Frames(shot.gridFormat) : shot.framesR5,
    status: "rendered", // grid uploaded → status auto-transition (r4 lock)
  });
}

export function clearShotGridImage(
  project: PromptProject,
  sceneId: string,
  shotId: string
): Partial<ProjWithFilm> {
  return updateShot(project, sceneId, shotId, {
    gridImageDataUrl: undefined,
    framesR5: undefined,
    status: "draft",
  });
}

export function toggleShotFrameLock(
  project: PromptProject,
  sceneId: string,
  shotId: string,
  frameId: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const existing = data.shotsBySceneId?.[sceneId] ?? [];
  const shot = existing.find((s) => s.id === shotId);
  if (!shot || !shot.framesR5) return {};
  const nextFrames = shot.framesR5.map((f) =>
    f.id === frameId ? { ...f, locked: !f.locked } : f
  );
  return updateShot(project, sceneId, shotId, { framesR5: nextFrames });
}

// ============================================================================
// r5 — CUSTOM VIDEO PROVIDER CRUD (Hướng A — name only required, others optional)
// ============================================================================

export function addCustomVideoProvider(
  project: PromptProject,
  provider: Omit<FilmVideoProvider, "id" | "isCustom">
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const newProvider: FilmVideoProvider = {
    ...provider,
    id: `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    isCustom: true,
  };
  return patch({
    ...data,
    customVideoProviders: [...(data.customVideoProviders ?? []), newProvider],
  });
}

export function removeCustomVideoProvider(
  project: PromptProject,
  providerId: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({
    ...data,
    customVideoProviders: (data.customVideoProviders ?? []).filter(
      (p) => p.id !== providerId
    ),
  });
}

export function updateCustomVideoProvider(
  project: PromptProject,
  providerId: string,
  updates: Partial<Omit<FilmVideoProvider, "id" | "isCustom">>
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({
    ...data,
    customVideoProviders: (data.customVideoProviders ?? []).map((p) =>
      p.id === providerId ? { ...p, ...updates } : p
    ),
  });
}

/** Get all providers (defaults + customs) — for dropdown rendering. */
export function getAllVideoProviders(
  project: PromptProject
): FilmVideoProvider[] {
  const data = ensureFilmData(project);
  return [...DEFAULT_VIDEO_PROVIDERS, ...(data.customVideoProviders ?? [])];
}

// ============================================================================
// r6 — VOICE + SFX ACTIONS (Mockup 5)
// ============================================================================

import type { FilmVoiceProvider, FilmSfxProvider } from "../types/film";

/** Set voice provider for a specific character (overrides global). null = skip voice. */
export function setVoiceAssignment(
  project: PromptProject,
  characterId: string,
  provider: FilmVoiceProvider | null
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const next = {
    ...(data.voiceAssignments ?? {}),
    [characterId]: provider,
  };
  return patch({ ...data, voiceAssignments: next });
}

/** Clear per-char assignment (revert to global default). */
export function clearVoiceAssignment(
  project: PromptProject,
  characterId: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const next = { ...(data.voiceAssignments ?? {}) };
  delete next[characterId];
  return patch({ ...data, voiceAssignments: next });
}

export function setVoiceProviderGlobal(
  project: PromptProject,
  provider: FilmVoiceProvider
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({ ...data, voiceProviderGlobal: provider });
}

export function setSfxProvider(
  project: PromptProject,
  provider: FilmSfxProvider
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({ ...data, sfxProvider: provider });
}

/** Update one scene's musicBrief (manual edit by user in r6 UI). */
export function setSceneMusicBrief(
  project: PromptProject,
  sceneId: string,
  brief: string
): Partial<ProjWithFilm> {
  return updateSceneInScript(project, sceneId, { musicBrief: brief });
}

/** Update one scene's SFX list (manual edit by user — array of strings). */
export function setSceneSfx(
  project: PromptProject,
  sceneId: string,
  sfx: string[]
): Partial<ProjWithFilm> {
  return updateSceneInScript(project, sceneId, { sfx });
}

// ============================================================================
// r7 — MULTI-STAGE SCRIPT WIZARD ACTIONS
// ============================================================================

import {
  type FilmScriptMode,
  type FilmScriptStage,
  type FilmScriptStructure,
  type FilmScriptBeat,
  type FilmScriptTwist,
  type FilmScriptIntermediateScene,
} from "../types/film";

export function setScriptMode(
  project: PromptProject,
  mode: FilmScriptMode
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({ ...data, scriptMode: mode });
}

export function setScriptStage(
  project: PromptProject,
  stage: FilmScriptStage
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({ ...data, scriptStage: stage });
}

export function setScriptStructure(
  project: PromptProject,
  structure: FilmScriptStructure
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({ ...data, scriptStructure: structure });
}

export function setScriptBeats(
  project: PromptProject,
  beats: FilmScriptBeat[]
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({ ...data, scriptBeats: beats });
}

export function updateScriptBeat(
  project: PromptProject,
  beatId: string,
  updates: Partial<FilmScriptBeat>
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const beats = (data.scriptBeats ?? []).map((b) =>
    b.id === beatId ? { ...b, ...updates } : b
  );
  return patch({ ...data, scriptBeats: beats });
}

export function addScriptBeat(
  project: PromptProject,
  beat: Omit<FilmScriptBeat, "id" | "order">
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const existing = data.scriptBeats ?? [];
  const newBeat: FilmScriptBeat = {
    ...beat,
    id: `beat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    order: existing.length + 1,
  };
  return patch({ ...data, scriptBeats: [...existing, newBeat] });
}

export function removeScriptBeat(
  project: PromptProject,
  beatId: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const beats = (data.scriptBeats ?? [])
    .filter((b) => b.id !== beatId)
    .map((b, i) => ({ ...b, order: i + 1 }));
  return patch({ ...data, scriptBeats: beats });
}

export function setScriptTwists(
  project: PromptProject,
  twists: FilmScriptTwist[]
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  // qc18 Hướng B: AI regen → reset lock to false. User must re-confirm via
  // "Tiếp: ④ Phân cảnh →" button before stage becomes done. Without this,
  // user re-running Stage 3 would auto-skip without seeing the new twists.
  return patch({ ...data, scriptTwists: twists, scriptTwistsLocked: false });
}

/**
 * qc18 Hướng B: Lock Stage 3 twists.
 *
 * Called when user clicks "Tiếp: ④ Phân cảnh →" button in ActiveStage3.
 * Sets scriptTwistsLocked = true so isStageDone("twists") returns true and
 * the stepper renders the done preview (green ✓). User can still revert via
 * the stage indicator (revertToStage clears this flag).
 *
 * Pure: only flips lock flag. Caller composes with setScriptStage("scenes")
 * to advance the wizard.
 */
export function lockScriptTwists(
  project: PromptProject
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({ ...data, scriptTwistsLocked: true });
}

export function updateScriptTwist(
  project: PromptProject,
  twistId: string,
  updates: Partial<FilmScriptTwist>
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const twists = (data.scriptTwists ?? []).map((t) =>
    t.id === twistId ? { ...t, ...updates } : t
  );
  return patch({ ...data, scriptTwists: twists });
}

export function setScriptIntermediateScenes(
  project: PromptProject,
  scenes: FilmScriptIntermediateScene[]
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  // qc20 parallel qc18 Twist pattern: AI regen → reset lock to false.
  // User must re-confirm via "Tiếp: ⑤ Lời thoại →" button before stage becomes done.
  return patch({ ...data, scriptIntermediateScenes: scenes, scriptScenesLocked: false });
}

/**
 * qc20 (parallel qc18 lockScriptTwists): Lock Stage 4 scenes.
 *
 * Called when user clicks "Tiếp: ⑤ Lời thoại →" button in ActiveStage4.
 * Sets scriptScenesLocked = true so isStageDone("scenes") returns true.
 * Pure: only flips lock flag. Caller composes with setScriptStage("dialogues").
 */
export function lockScriptScenes(
  project: PromptProject
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({ ...data, scriptScenesLocked: true });
}

/**
 * qc20 Q20.4: Apply AI-suggested split — replace 1 scene with 2 sub-scenes.
 *
 * Caller (UI) gets SceneSplitSuggestion from runSplitSceneSuggestion, shows preview,
 * and on user confirm calls this action.
 *
 * Order field auto-recomputed (sub-scene 1 inherits original's order, sub-scene 2 gets
 * order+1, all subsequent scenes shift by +1).
 */
export function applySceneSplit(
  project: PromptProject,
  sceneId: string,
  subScene1: Omit<FilmScriptIntermediateScene, "id" | "order">,
  subScene2: Omit<FilmScriptIntermediateScene, "id" | "order">
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const scenes = data.scriptIntermediateScenes ?? [];
  const idx = scenes.findIndex((s) => s.id === sceneId);
  if (idx < 0) return {};

  const orig = scenes[idx];
  const sub1: FilmScriptIntermediateScene = {
    ...subScene1,
    id: `scene_${Date.now().toString(36)}_a`,
    order: orig.order,
  };
  const sub2: FilmScriptIntermediateScene = {
    ...subScene2,
    id: `scene_${Date.now().toString(36)}_b`,
    order: orig.order + 1,
  };

  // Replace orig (at idx) with sub1+sub2, shift order of subsequent scenes
  const newScenes: FilmScriptIntermediateScene[] = [];
  for (let i = 0; i < scenes.length; i++) {
    if (i === idx) {
      newScenes.push(sub1, sub2);
    } else if (i > idx) {
      newScenes.push({ ...scenes[i], order: scenes[i].order + 1 });
    } else {
      newScenes.push(scenes[i]);
    }
  }

  return patch({ ...data, scriptIntermediateScenes: newScenes });
}

/**
 * qc20 Q20.5: User explicitly dismisses "scene too complex" warning for a scene.
 *
 * Marker stored in a Set field on the scene itself. Once dismissed, UI no longer shows
 * the warning badge for this scene. User can still see auto-picked grid in Storyboard
 * (qc19 will pick 4x3 or 4x4 for 10-16 shot scenes).
 *
 * Pure pass-through: just flips scene.complexityWarningDismissed = true.
 */
export function dismissSceneComplexityWarning(
  project: PromptProject,
  sceneId: string
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const scenes = data.scriptIntermediateScenes ?? [];
  const newScenes = scenes.map((s) =>
    s.id === sceneId ? { ...s, complexityWarningDismissed: true } : s
  );
  return patch({ ...data, scriptIntermediateScenes: newScenes });
}

/**
 * qc6: User-specified target scene count for Stage 4.
 * Default: AI decides based on duration. User can override for richer storytelling.
 */
export function setScriptTargetSceneCount(
  project: PromptProject,
  count: number | undefined
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  return patch({ ...data, scriptTargetSceneCount: count });
}

/**
 * Revert to a specific stage in the multi-stage wizard.
 * Clears ALL downstream stage outputs (so re-running from this stage produces fresh results).
 * Q3 Hướng A confirmed: this is called AFTER user confirms via dialog in UI layer.
 *
 * Stage order: structure → beats → twists → scenes → dialogues
 */
export function revertToStage(
  project: PromptProject,
  stage: FilmScriptStage
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const next: FilmData = { ...data, scriptStage: stage };

  // Clear downstream stages based on which stage we reverted to
  if (stage === "structure") {
    delete (next as any).scriptBeats;
    delete (next as any).scriptTwists;
    delete (next as any).scriptTwistsLocked; // qc18
    delete (next as any).scriptIntermediateScenes;
    delete (next as any).scriptScenesLocked; // qc20
    delete (next as any).script;
  } else if (stage === "beats") {
    delete (next as any).scriptTwists;
    delete (next as any).scriptTwistsLocked; // qc18
    delete (next as any).scriptIntermediateScenes;
    delete (next as any).scriptScenesLocked; // qc20
    delete (next as any).script;
  } else if (stage === "twists") {
    // qc18: clear lock so ActiveStage3 renders again (user can re-pick).
    // scriptTwists itself preserved — user often wants to re-confirm same twists.
    delete (next as any).scriptTwistsLocked;
    delete (next as any).scriptIntermediateScenes;
    delete (next as any).scriptScenesLocked; // qc20
    delete (next as any).script;
  } else if (stage === "scenes") {
    // qc20: clear lock so ActiveStage4 renders again (user can review warnings).
    // scriptIntermediateScenes preserved — user often wants to re-confirm same scenes.
    delete (next as any).scriptScenesLocked;
    delete (next as any).script;
  }
  // stage === "dialogues" → no-op (final stage, nothing downstream)

  return patch(next);
}

/**
 * qc12: Clear a single stage's data + set scriptStage to that stage
 * so user can re-enter active mode to regenerate from scratch.
 *
 * Use case: user clicks "🔄 Regen / Edit" on a DONE stage that has no
 * downstream data (typically Stage 5 final). Without clearing, the stage
 * would still be marked done → wizard stays in "all done" state and won't
 * render active panel.
 */
export function clearStageData(
  project: PromptProject,
  stage: FilmScriptStage
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const next: FilmData = { ...data, scriptStage: stage };

  if (stage === "structure") {
    delete (next as any).scriptStructure;
  } else if (stage === "beats") {
    delete (next as any).scriptBeats;
  } else if (stage === "twists") {
    delete (next as any).scriptTwists;
    delete (next as any).scriptTwistsLocked; // qc18
  } else if (stage === "scenes") {
    delete (next as any).scriptIntermediateScenes;
    delete (next as any).scriptScenesLocked; // qc20
  } else if (stage === "dialogues") {
    delete (next as any).script;
  }

  return patch(next);
}

// ============================================================================
// qc16 — Scene-level grids (paradigm shift from per-shot grids)
// ============================================================================

import {
  packShotsIntoGrids,
  parseGridFormat,
  getShotsInGrid,
} from "../engine/sceneGridPacker";
import type {
  SceneGrid,
  SceneGridCell,
  SceneGridFormat,
  ShotCropSettings,
} from "../types/project";
import { buildSceneGridImagePrompt } from "../engine/sceneImagePromptBuilder";

/**
 * Get scene by id from current film script.
 */
function getSceneFromScript(
  project: PromptProject,
  sceneId: string
): FilmSceneScript | undefined {
  const film = ensureFilmData(project);
  return film.script?.scenes.find((s) => s.id === sceneId);
}

/**
 * Update one scene within the script.
 */
function patchScene(
  project: PromptProject,
  sceneId: string,
  updater: (scene: FilmSceneScript) => FilmSceneScript
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  if (!data.script) return {};
  const newScenes = data.script.scenes.map((s) =>
    s.id === sceneId ? updater(s) : s
  );
  return patch({
    ...data,
    script: { ...data.script, scenes: newScenes },
  });
}

/**
 * Set scene's grid format + re-pack shots into grids.
 * Preserves existing cropped frames where shotIds still match.
 *
 * qc21: This is the USER OVERRIDE path. Marks `gridFormatManual: true` so
 * future ensureSceneGrids/repackSceneGrids preserve user's choice and
 * Storyboard UI shows "↺ Reset to Auto" button.
 */
export function setSceneGridFormat(
  project: PromptProject,
  sceneId: string,
  format: SceneGridFormat
): Partial<ProjWithFilm> {
  const data = ensureFilmData(project);
  const scene = getSceneFromScript(project, sceneId);
  if (!scene) return {};
  const shots = getShotsForScene(project, sceneId);
  const newGrids = packShotsIntoGrids(shots, format, scene.grids);
  return patchScene(project, sceneId, (s) => ({
    ...s,
    gridFormat: format,
    gridFormatManual: true, // qc21: explicit user choice
    grids: newGrids,
  }));
}

/**
 * qc21 Q21.4: Reset scene's grid format to auto-pick.
 *
 * Clears `gridFormat` + `gridFormatManual` flags so `ensureSceneGrids` /
 * `repackSceneGrids` will re-evaluate optimal format from current shot count + aspect.
 * Existing cropped frames preserved where shot ids still match (via packShotsIntoGrids).
 */
export function resetSceneGridFormatToAuto(
  project: PromptProject,
  sceneId: string
): Partial<ProjWithFilm> {
  const scene = getSceneFromScript(project, sceneId);
  if (!scene) return {};
  const shots = getShotsForScene(project, sceneId);
  const aspectRatio = (project as any).settingV2?.aspectRatio ?? "16:9";
  // Pass undefined gridFormat → auto-pick
  const newGrids = packShotsIntoGrids(shots, undefined, scene.grids, aspectRatio);
  const resolvedFormat = newGrids[0]?.gridFormat;
  return patchScene(project, sceneId, (s) => ({
    ...s,
    gridFormat: resolvedFormat,
    gridFormatManual: false, // qc21: explicitly auto
    grids: newGrids,
  }));
}

/**
 * Ensure scene has grids initialized. Idempotent.
 * Used when user first opens Storyboard for a scene.
 *
 * qc19 Hướng F-9: If scene.gridFormat undefined (new scene), auto-pick optimal
 * format from shot count + project aspect ratio. If user already chose a format
 * (manual override), preserve it.
 *
 * qc21: When auto-picking, sets `gridFormatManual: false` so UI can distinguish
 * auto vs manual. When preserving existing format from qc17/qc18 project (legacy
 * where gridFormatManual is undefined), the format is preserved and the
 * Storyboard UI shows a migration hint allowing user to opt into auto.
 */
export function ensureSceneGrids(
  project: PromptProject,
  sceneId: string
): Partial<ProjWithFilm> {
  const scene = getSceneFromScript(project, sceneId);
  if (!scene) return {};
  if (scene.grids && scene.grids.length > 0) return {};

  const shots = getShotsForScene(project, sceneId);
  const aspectRatio = (project as any).settingV2?.aspectRatio ?? "16:9";
  // qc19: pass undefined → packShotsIntoGrids auto-picks via pickOptimalGridFormat.
  // If scene.gridFormat already set (legacy or manual override), honor it.
  const newGrids = packShotsIntoGrids(shots, scene.gridFormat, scene.grids, aspectRatio);
  const resolvedFormat = newGrids[0]?.gridFormat ?? scene.gridFormat ?? "3x3";
  // qc21: If gridFormat was undefined before this call, auto-pick happened → mark as auto.
  // If gridFormat was already set, preserve gridFormatManual as-is (legacy = undefined,
  // explicit qc21 override = true, explicit qc21 auto = false).
  const isAutoPickNow = scene.gridFormat === undefined;
  return patchScene(project, sceneId, (s) => ({
    ...s,
    gridFormat: resolvedFormat,
    gridFormatManual: isAutoPickNow ? false : s.gridFormatManual,
    grids: newGrids,
  }));
}

/**
 * Re-pack grids for a scene (call after shots are added/removed/reordered).
 * Preserves existing cropped frames where shotIds still match.
 *
 * qc19: If scene.gridFormat is undefined (auto-pick mode), re-evaluate optimal
 * format based on new shot count. If user chose a format manually, preserve it.
 */
export function repackSceneGrids(
  project: PromptProject,
  sceneId: string
): Partial<ProjWithFilm> {
  const scene = getSceneFromScript(project, sceneId);
  if (!scene) return {};
  const shots = getShotsForScene(project, sceneId);
  const aspectRatio = (project as any).settingV2?.aspectRatio ?? "16:9";
  const newGrids = packShotsIntoGrids(shots, scene.gridFormat, scene.grids, aspectRatio);
  const resolvedFormat = newGrids[0]?.gridFormat ?? scene.gridFormat ?? "3x3";
  return patchScene(project, sceneId, (s) => ({
    ...s,
    gridFormat: resolvedFormat,
    grids: newGrids,
  }));
}

/**
 * Set image prompt for a specific grid in a scene.
 */
export function setSceneGridImagePrompt(
  project: PromptProject,
  sceneId: string,
  gridId: string,
  prompt: string
): Partial<ProjWithFilm> {
  return patchScene(project, sceneId, (s) => {
    if (!s.grids) return s;
    return {
      ...s,
      grids: s.grids.map((g) =>
        g.id === gridId ? { ...g, imagePrompt: prompt } : g
      ),
    };
  });
}

/**
 * Save uploaded grid image (Base64 dataURL) + crop settings.
 * Does NOT auto-crop cells — that's done by component after this.
 */
export function setSceneGridImage(
  project: PromptProject,
  sceneId: string,
  gridId: string,
  dataUrl: string,
  cropSettings: ShotCropSettings
): Partial<ProjWithFilm> {
  return patchScene(project, sceneId, (s) => {
    if (!s.grids) return s;
    return {
      ...s,
      grids: s.grids.map((g) =>
        g.id === gridId
          ? { ...g, gridImageDataUrl: dataUrl, cropSettings }
          : g
      ),
    };
  });
}

/**
 * Set cell dataUrl after crop (from grid upload + crop engine).
 * Preserves cell shotId, locked, promptOverride.
 */
export function setSceneGridCellDataUrl(
  project: PromptProject,
  sceneId: string,
  gridId: string,
  cellOrder: number,
  dataUrl: string | undefined
): Partial<ProjWithFilm> {
  return patchScene(project, sceneId, (s) => {
    if (!s.grids) return s;
    return {
      ...s,
      grids: s.grids.map((g) =>
        g.id === gridId
          ? {
              ...g,
              cells: g.cells.map((cell) =>
                cell.order === cellOrder ? { ...cell, dataUrl } : cell
              ),
            }
          : g,
      ),
    };
  });
}

/**
 * Apply ALL cropped cell dataUrls at once (after crop engine completes).
 */
export function applyCroppedFramesToGrid(
  project: PromptProject,
  sceneId: string,
  gridId: string,
  cellDataUrls: (string | undefined)[]
): Partial<ProjWithFilm> {
  return patchScene(project, sceneId, (s) => {
    if (!s.grids) return s;
    return {
      ...s,
      grids: s.grids.map((g) => {
        if (g.id !== gridId) return g;
        return {
          ...g,
          cells: g.cells.map((cell, i) => ({
            ...cell,
            // Only set dataUrl if shotId exists (skip empty cells)
            dataUrl: cell.shotId ? cellDataUrls[i] : undefined,
          })),
        };
      }),
    };
  });
}

/**
 * Clear grid image + cropped cells (keep prompt + cropSettings).
 */
export function clearSceneGridImage(
  project: PromptProject,
  sceneId: string,
  gridId: string
): Partial<ProjWithFilm> {
  return patchScene(project, sceneId, (s) => {
    if (!s.grids) return s;
    return {
      ...s,
      grids: s.grids.map((g) =>
        g.id === gridId
          ? {
              ...g,
              gridImageDataUrl: undefined,
              cells: g.cells.map((c) => ({ ...c, dataUrl: undefined })),
            }
          : g,
      ),
    };
  });
}

/**
 * Toggle cell lock (prevent regen from overwriting).
 */
export function toggleSceneGridCellLock(
  project: PromptProject,
  sceneId: string,
  gridId: string,
  cellOrder: number
): Partial<ProjWithFilm> {
  return patchScene(project, sceneId, (s) => {
    if (!s.grids) return s;
    return {
      ...s,
      grids: s.grids.map((g) =>
        g.id === gridId
          ? {
              ...g,
              cells: g.cells.map((cell) =>
                cell.order === cellOrder
                  ? { ...cell, locked: !cell.locked }
                  : cell
              ),
            }
          : g,
      ),
    };
  });
}

/**
 * Attach a video to a specific grid cell. Used after user generates the shot
 * externally (Veo3/Kling/Seedance) and uploads the result back. Animatic Player
 * will play the video instead of showing the keyframe still.
 */
export function setSceneGridCellVideo(
  project: PromptProject,
  sceneId: string,
  gridId: string,
  cellOrder: number,
  video: { dataUrl: string; filename: string; durationSeconds?: number }
): Partial<ProjWithFilm> {
  return patchScene(project, sceneId, (s) => {
    if (!s.grids) return s;
    return {
      ...s,
      grids: s.grids.map((g) =>
        g.id === gridId
          ? {
              ...g,
              cells: g.cells.map((cell) =>
                cell.order === cellOrder ? { ...cell, video } : cell
              ),
            }
          : g,
      ),
    };
  });
}

/** Remove video attachment from a cell. */
export function clearSceneGridCellVideo(
  project: PromptProject,
  sceneId: string,
  gridId: string,
  cellOrder: number
): Partial<ProjWithFilm> {
  return patchScene(project, sceneId, (s) => {
    if (!s.grids) return s;
    return {
      ...s,
      grids: s.grids.map((g) =>
        g.id === gridId
          ? {
              ...g,
              cells: g.cells.map((cell) => {
                if (cell.order !== cellOrder) return cell;
                const { video, ...rest } = cell;
                return rest;
              }),
            }
          : g,
      ),
    };
  });
}

/**
 * Re-generate the scene grid image prompt (uses current shots + cast + setting).
 * Stores result in grid.imagePrompt.
 */
export function regenerateSceneGridImagePrompt(
  project: PromptProject,
  sceneId: string,
  gridId: string
): Partial<ProjWithFilm> {
  const scene = getSceneFromScript(project, sceneId);
  if (!scene || !scene.grids) return {};
  const grid = scene.grids.find((g) => g.id === gridId);
  if (!grid) return {};
  const shots = getShotsForScene(project, sceneId);
  const film = ensureFilmData(project);
  const setting = (project as any).settingV2;
  if (!setting) return {};
  const prompt = buildSceneGridImagePrompt({
    grid,
    scene,
    shots,
    cast: film.characters,
    setting,
  });
  return setSceneGridImagePrompt(project, sceneId, gridId, prompt);
}
