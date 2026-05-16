/**
 * KSP Image v0.9.0 — Store actions for v0.9.0 entities
 *
 * These functions wrap useAppStore.updateCurrentProject() with type-safe
 * patches for v0.9.0 fields. Used by Cast/Script/Concept/Scenes/Shots UI components.
 *
 * Pattern: pure functions taking project + patch, returning new project.
 * Components call these via updateCurrentProject((p) => actions.X(p, args)).
 */

import type { PromptProject } from "../types";
import type {
  ProjectV09Extensions,
  FilmCharacterV2,
  FilmScript,
  FilmSceneScript,
  TvcConcept,
  FilmShot,
  ShotFrame,
  FilmStructure,
  FilmSceneShot,
  CharacterRef,
  ScriptVersion,
  ConceptVersion,
} from "../types/project";
import { genId } from "./useGlobalStore";

type ProjectV09 = PromptProject & ProjectV09Extensions;

// ============================================================================
// CAST CRUD
// ============================================================================

export function addCharacter(p: ProjectV09, character: Omit<FilmCharacterV2, "id" | "order">): Partial<ProjectV09> {
  const existing = p.filmCharactersV2 ?? [];
  const newChar: FilmCharacterV2 = {
    ...character,
    id: genId("char"),
    order: existing.length,
  };
  return {
    filmCharactersV2: [...existing, newChar],
    schemaVersion: "v0.9",
  };
}

export function updateCharacter(
  p: ProjectV09,
  characterId: string,
  patch: Partial<FilmCharacterV2>
): Partial<ProjectV09> {
  const existing = p.filmCharactersV2 ?? [];
  return {
    filmCharactersV2: existing.map((c) =>
      c.id === characterId ? { ...c, ...patch } : c
    ),
  };
}

export function deleteCharacter(p: ProjectV09, characterId: string): Partial<ProjectV09> {
  const existing = p.filmCharactersV2 ?? [];
  return {
    filmCharactersV2: existing
      .filter((c) => c.id !== characterId)
      .map((c, i) => ({ ...c, order: i })), // Re-order
  };
}

export function reorderCharacters(p: ProjectV09, orderedIds: string[]): Partial<ProjectV09> {
  const existing = p.filmCharactersV2 ?? [];
  const lookup = new Map(existing.map((c) => [c.id, c]));
  return {
    filmCharactersV2: orderedIds
      .map((id, i) => {
        const c = lookup.get(id);
        return c ? { ...c, order: i } : null;
      })
      .filter((c): c is FilmCharacterV2 => c !== null),
  };
}

// ----------------------------------------------------------------------------
// Character refs (face / body)
// ----------------------------------------------------------------------------

export function addCharacterRef(
  p: ProjectV09,
  characterId: string,
  refType: "face" | "body",
  ref: Omit<CharacterRef, "id">
): Partial<ProjectV09> {
  const existing = p.filmCharactersV2 ?? [];
  return {
    filmCharactersV2: existing.map((c) => {
      if (c.id !== characterId) return c;
      const newRef: CharacterRef = { ...ref, id: genId("ref") };
      return refType === "face"
        ? { ...c, faceRefs: [...c.faceRefs, newRef] }
        : { ...c, bodyRefs: [...c.bodyRefs, newRef] };
    }),
  };
}

export function deleteCharacterRef(
  p: ProjectV09,
  characterId: string,
  refType: "face" | "body",
  refId: string
): Partial<ProjectV09> {
  const existing = p.filmCharactersV2 ?? [];
  return {
    filmCharactersV2: existing.map((c) => {
      if (c.id !== characterId) return c;
      return refType === "face"
        ? { ...c, faceRefs: c.faceRefs.filter((r) => r.id !== refId) }
        : { ...c, bodyRefs: c.bodyRefs.filter((r) => r.id !== refId) };
    }),
  };
}

// ============================================================================
// SCRIPT CRUD (Film mode)
// ============================================================================

export function setScript(p: ProjectV09, script: FilmScript): Partial<ProjectV09> {
  return { script: { ...script, updatedAt: Date.now() } };
}

export function updateScriptField(
  p: ProjectV09,
  patch: Partial<FilmScript>
): Partial<ProjectV09> {
  if (!p.script) return {};
  return {
    script: { ...p.script, ...patch, updatedAt: Date.now() },
  };
}

export function snapshotScriptVersion(p: ProjectV09, label: string): Partial<ProjectV09> {
  if (!p.script) return {};
  const { versions, ...snapshot } = p.script;
  const newVersion: ScriptVersion = {
    id: genId("scriptver"),
    timestamp: Date.now(),
    label,
    scriptSnapshot: snapshot,
  };
  return {
    script: {
      ...p.script,
      versions: [...(versions ?? []), newVersion].slice(-10), // Keep last 10
    },
  };
}

export function revertScriptToVersion(
  p: ProjectV09,
  versionId: string
): Partial<ProjectV09> {
  if (!p.script) return {};
  const version = p.script.versions?.find((v) => v.id === versionId);
  if (!version) return {};
  return {
    script: {
      ...version.scriptSnapshot,
      versions: p.script.versions, // Keep version history
      updatedAt: Date.now(),
    },
  };
}

// ----------------------------------------------------------------------------
// Scene CRUD inside Script
// ----------------------------------------------------------------------------

export function addScriptScene(
  p: ProjectV09,
  scene: Omit<FilmSceneScript, "id" | "order">
): Partial<ProjectV09> {
  if (!p.script) return {};
  const order = p.script.scenes.length;
  const newScene: FilmSceneScript = {
    ...scene,
    id: genId("scene"),
    order,
  };
  return {
    script: {
      ...p.script,
      scenes: [...p.script.scenes, newScene],
      updatedAt: Date.now(),
    },
  };
}

export function updateScriptScene(
  p: ProjectV09,
  sceneId: string,
  patch: Partial<FilmSceneScript>
): Partial<ProjectV09> {
  if (!p.script) return {};
  return {
    script: {
      ...p.script,
      scenes: p.script.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
      updatedAt: Date.now(),
    },
  };
}

export function deleteScriptScene(p: ProjectV09, sceneId: string): Partial<ProjectV09> {
  if (!p.script) return {};
  return {
    script: {
      ...p.script,
      scenes: p.script.scenes.filter((s) => s.id !== sceneId).map((s, i) => ({ ...s, order: i })),
      updatedAt: Date.now(),
    },
  };
}

// ============================================================================
// CONCEPT CRUD (TVC mode)
// ============================================================================

export function setConcept(p: ProjectV09, concept: TvcConcept): Partial<ProjectV09> {
  return { concept: { ...concept, updatedAt: Date.now() } };
}

export function updateConceptField(
  p: ProjectV09,
  patch: Partial<TvcConcept>
): Partial<ProjectV09> {
  if (!p.concept) return {};
  return {
    concept: { ...p.concept, ...patch, updatedAt: Date.now() },
  };
}

export function snapshotConceptVersion(p: ProjectV09, label: string): Partial<ProjectV09> {
  if (!p.concept) return {};
  const { versions, ...snapshot } = p.concept;
  const newVersion: ConceptVersion = {
    id: genId("conceptver"),
    timestamp: Date.now(),
    label,
    conceptSnapshot: snapshot,
  };
  return {
    concept: {
      ...p.concept,
      versions: [...(versions ?? []), newVersion].slice(-10),
    },
  };
}

// ============================================================================
// FILM STRUCTURE CRUD (Scenes + Shots hierarchy)
// ============================================================================

/**
 * Sync filmStructureV2 scenes from script scenes.
 * Each Script scene → 1 FilmSceneShot container in structure.
 * Existing shots within scenes are preserved.
 */
export function syncFilmStructureFromScript(p: ProjectV09): Partial<ProjectV09> {
  if (!p.script) return {};
  const existing = p.filmStructureV2?.scenes ?? [];
  const existingByScriptId = new Map(existing.map((s) => [s.id, s]));

  const newScenes: FilmSceneShot[] = p.script.scenes.map((scriptScene) => {
    const exists = existingByScriptId.get(scriptScene.id);
    if (exists) {
      return { ...exists, order: scriptScene.order };
    }
    return {
      id: scriptScene.id,
      order: scriptScene.order,
      shots: [],
    };
  });

  return {
    filmStructureV2: {
      totalDurationMinutes: p.filmStructureV2?.totalDurationMinutes ?? 5,
      scenes: newScenes,
    },
  };
}

export function addShotToScene(
  p: ProjectV09,
  sceneId: string,
  shot: Omit<FilmShot, "id" | "order">
): Partial<ProjectV09> {
  if (!p.filmStructureV2) return {};
  const scenes = p.filmStructureV2.scenes;
  const target = scenes.find((s) => s.id === sceneId);
  if (!target) return {};

  const newShot: FilmShot = {
    ...shot,
    id: genId("shot"),
    order: target.shots.length,
  };

  return {
    filmStructureV2: {
      ...p.filmStructureV2,
      scenes: scenes.map((s) =>
        s.id === sceneId ? { ...s, shots: [...s.shots, newShot] } : s
      ),
    },
  };
}

export function addMultipleShotsToScene(
  p: ProjectV09,
  sceneId: string,
  shots: FilmShot[]
): Partial<ProjectV09> {
  if (!p.filmStructureV2) return {};
  return {
    filmStructureV2: {
      ...p.filmStructureV2,
      scenes: p.filmStructureV2.scenes.map((s) =>
        s.id === sceneId
          ? {
              ...s,
              shots: [
                ...s.shots,
                ...shots.map((shot, i) => ({
                  ...shot,
                  order: s.shots.length + i,
                })),
              ],
            }
          : s
      ),
    },
  };
}

export function updateShot(
  p: ProjectV09,
  shotId: string,
  patch: Partial<FilmShot>
): Partial<ProjectV09> {
  if (!p.filmStructureV2) return {};
  return {
    filmStructureV2: {
      ...p.filmStructureV2,
      scenes: p.filmStructureV2.scenes.map((s) => ({
        ...s,
        shots: s.shots.map((sh) => (sh.id === shotId ? { ...sh, ...patch } : sh)),
      })),
    },
  };
}

export function deleteShot(p: ProjectV09, shotId: string): Partial<ProjectV09> {
  if (!p.filmStructureV2) return {};
  return {
    filmStructureV2: {
      ...p.filmStructureV2,
      scenes: p.filmStructureV2.scenes.map((s) => ({
        ...s,
        shots: s.shots
          .filter((sh) => sh.id !== shotId)
          .map((sh, i) => ({ ...sh, order: i })),
      })),
    },
  };
}

// ----------------------------------------------------------------------------
// Frame CRUD inside Shot
// ----------------------------------------------------------------------------

export function setShotFrames(
  p: ProjectV09,
  shotId: string,
  frames: ShotFrame[]
): Partial<ProjectV09> {
  return updateShot(p, shotId, { frames });
}

export function updateFrame(
  p: ProjectV09,
  shotId: string,
  frameId: string,
  patch: Partial<ShotFrame>
): Partial<ProjectV09> {
  if (!p.filmStructureV2) return {};
  return {
    filmStructureV2: {
      ...p.filmStructureV2,
      scenes: p.filmStructureV2.scenes.map((s) => ({
        ...s,
        shots: s.shots.map((sh) => {
          if (sh.id !== shotId) return sh;
          if (!sh.frames) return sh;
          return {
            ...sh,
            frames: sh.frames.map((f) => (f.id === frameId ? { ...f, ...patch } : f)),
          };
        }),
      })),
    },
  };
}
