/**
 * KSP Image v0.9.0 — Migration logic
 *
 * Upgrades projects from v0.8.x schema to v0.9.0:
 * - "lifestyle" / "editorial_fashion" → "photos" mode
 * - Old film "storyboard" (single grid) → wrapped into Scene 1 → Shot 1.1
 * - filmCharacters → filmCharactersV2 (with proper face/body refs)
 * - Settings scattered → consolidated settingV2
 *
 * Strategy: Silent upgrade on project load. No user intervention.
 * Run only once per project (schemaVersion marker prevents re-runs).
 */

import type { PromptProject, ShotMode, FilmCharacter } from "../types";
import type {
  ProjectV09Extensions,
  ProjectModeV2,
  FilmStructure,
  FilmCharacterV2,
  CharacterRef,
  FilmShot,
  ShotFrame,
} from "../types/project";
import { createDefaultSettingV2, genId } from "./useGlobalStore";

// ============================================================================
// MODE MAPPING (v0.8 → v0.9)
// ============================================================================

export function mapOldModeToV2(oldMode?: ShotMode): ProjectModeV2 {
  switch (oldMode) {
    case "tvc_commercial":
      return "tvc_commercial";
    case "product_photo":
      return "product_photo";
    case "film":
      return "film";
    case "lifestyle":
    case "editorial_fashion":
      return "photos";
    default:
      return "photos";
  }
}

// ============================================================================
// CHARACTER MIGRATION
// ============================================================================

function migrateCharacter(
  oldChar: FilmCharacter,
  index: number
): FilmCharacterV2 {
  const faceRefs: CharacterRef[] = (oldChar.faceImageIds ?? []).map((id, i) => ({
    id,
    angle: i === 0 ? "front" : i === 1 ? "three_quarter_left" : "side",
    generatedByAi: false,
  }));

  const bodyRefs: CharacterRef[] = (oldChar.outfitImageIds ?? []).map((id, i) => ({
    id,
    angle: i === 0 ? "full_body" : "torso",
    generatedByAi: false,
  }));

  return {
    id: oldChar.id ?? genId("char"),
    order: index,
    name: oldChar.name ?? `Character ${index + 1}`,
    role: (oldChar.role as FilmCharacterV2["role"]) ?? (index === 0 ? "protagonist" : "supporting"),
    description: oldChar.description ?? "",
    uniqueIdentifiers: oldChar.uniqueIdentifiers ?? "",
    hasDialog: false,
    faceRefs,
    bodyRefs,
    characterType: "human",
  };
}

// ============================================================================
// FILM STRUCTURE MIGRATION
// (Old: single storyboard with 9 frames → New: 1 scene → 1 shot → 9 frames)
// ============================================================================

function migrateFilmStructure(project: PromptProject): FilmStructure | undefined {
  // Only migrate if old project had storyboard data
  if (!project.storyboard?.frames) return undefined;

  const oldFrames = project.storyboard.frames;
  const totalDurationSeconds = oldFrames.length * 3; // Estimate 3s per frame

  // Wrap old single storyboard into Scene 1 → Shot 1.1
  const sceneId = genId("scene");
  const shotId = genId("shot");

  const shotFrames: ShotFrame[] = oldFrames.map((f, i) => ({
    id: genId("frame"),
    order: i,
    timingSeconds: { start: i * 3, end: (i + 1) * 3 },
    role: i === 0 ? "establishing" : i === oldFrames.length - 1 ? "resolution" : "motion",
    actionEn: (f as any).actionEn ?? (f as any).action ?? "",
    actionVi: (f as any).action ?? (f as any).actionVi ?? "",
    locked: (f as any).locked ?? false,
  }));

  const shot: FilmShot = {
    id: shotId,
    order: 0,
    titleEn: "Shot 1.1 — Migrated from v0.8.x",
    titleVi: "Shot 1.1 — Chuyển từ v0.8.x",
    shotType: "wide_establishing",
    durationSeconds: totalDurationSeconds,
    gridFormat: (project.storyboard.format as FilmShot["gridFormat"]) ?? "3x3",
    cameraMovement: "auto_per_genre",
    purpose: "Migrated single storyboard from v0.8.x project",
    frames: shotFrames,
    gridImageId: project.storyboard.gridImageId,
    croppedFrameIds: project.storyboard.croppedFrameIds,
    status: project.storyboard.gridImageId ? "rendered" : "draft",
  };

  return {
    totalDurationMinutes: Math.max(1, Math.ceil(totalDurationSeconds / 60)),
    scenes: [
      {
        id: sceneId,
        order: 0,
        shots: [shot],
      },
    ],
  };
}

// ============================================================================
// MAIN MIGRATION ENTRY
// ============================================================================

/**
 * Migrate a v0.8.x project to v0.9.0 schema.
 * Idempotent: returns unchanged if already v0.9.0 (schemaVersion === "v0.9").
 *
 * IMPORTANT: This does NOT mutate the original project.
 * Returns a new merged object.
 */
export function migrateProjectToV09(
  project: PromptProject
): PromptProject & ProjectV09Extensions {
  const ext = project as PromptProject & ProjectV09Extensions;

  // Already migrated? Skip.
  if (ext.schemaVersion === "v0.9") {
    return ext;
  }

  const v2Mode = mapOldModeToV2(project.mode);

  // Build settingV2 from scattered fields
  const settingV2 = createDefaultSettingV2(v2Mode, project.name ?? "Migrated Project");
  if (project.aspectRatio) {
    settingV2.aspectRatio = project.aspectRatio as any;
  }
  if (project.industry) {
    settingV2.industry = project.industry;
  }
  if ((project as any).filmGenre) {
    settingV2.genre = (project as any).filmGenre;
  }
  if ((project as any).animationStyle) {
    settingV2.animationStyle = (project as any).animationStyle;
  }
  settingV2.createdAt = project.createdAt ?? Date.now();
  settingV2.updatedAt = Date.now();

  // Build film extensions if applicable
  let filmStructureV2: FilmStructure | undefined;
  let filmCharactersV2: FilmCharacterV2[] | undefined;

  if (v2Mode === "film") {
    filmStructureV2 = migrateFilmStructure(project);

    if ((project as any).filmCharacters?.length) {
      filmCharactersV2 = (project as any).filmCharacters.map(
        (c: FilmCharacter, i: number) => migrateCharacter(c, i)
      );
    }
  }

  // Return merged project
  return {
    ...project,
    schemaVersion: "v0.9",
    settingV2,
    filmStructureV2,
    filmCharactersV2,
    // concept and script start empty — user generates fresh after migration
    // voice, musicSfx, bundleConfig also start empty
  };
}

/**
 * Bulk migrate multiple projects (e.g. on app load from IndexedDB).
 */
export function migrateAllProjects(
  projects: PromptProject[]
): (PromptProject & ProjectV09Extensions)[] {
  return projects
    .map((p) => migrateProjectToV09(p))
    .map(migratePerShotGridsToSceneLevel)
    .map(backfillConceptSheet);
}

/**
 * Migration A: Drop deprecated per-shot grid data (paradigm shift).
 *
 * Per-shot grid fields (framesR5, gridImageDataUrl, imagePromptR5, cropSettings on shot)
 * are replaced by scene-level SceneGrid[]. Old data is dropped on first load —
 * user re-uploads grids in new Storyboard UI.
 *
 * This is a CLEAN BREAK (Jason confirmed Q5=A): we don't try to convert per-shot
 * grids to scene-level (would be lossy and confusing). Just clear and re-init.
 *
 * Idempotent: safe to call multiple times. Marker field `qc16Migrated` (legacy
 * persisted field name — DO NOT RENAME, will break existing user data) prevents
 * double-runs.
 */
export function migratePerShotGridsToSceneLevel(
  project: PromptProject & ProjectV09Extensions
): PromptProject & ProjectV09Extensions {
  const film = (project as any).filmV093;
  if (!film) return project;
  // Note: `qc16Migrated` is a legacy persisted field name kept verbatim for
  // backward compatibility with user projects already in IndexedDB.
  if ((film as any).qc16Migrated) return project;

  // Drop per-shot grid fields from all shots in all scenes
  const shotsBySceneId = film.shotsBySceneId ?? {};
  const cleanedShots: Record<string, any[]> = {};
  for (const [sceneId, shots] of Object.entries(shotsBySceneId)) {
    cleanedShots[sceneId] = (shots as any[]).map((shot) => {
      const {
        framesR5,
        gridImageDataUrl,
        imagePromptR5,
        cropSettings,
        ...rest
      } = shot;
      return rest;
    });
  }

  // Drop defaultCropSettings from film data (was per-project default)
  const { defaultCropSettings, ...filmRest } = film as any;

  return {
    ...project,
    filmV093: {
      ...filmRest,
      shotsBySceneId: cleanedShots,
      qc16Migrated: true,
      updatedAt: Date.now(),
    },
  } as PromptProject & ProjectV09Extensions;
}

/**
 * Backfill `conceptSheet` field on characters that only have legacy faceRefs.
 * Idempotent — safe to call on every project load. Does NOT touch existing
 * conceptSheet values, does NOT delete legacy faceRefs/bodyRefs.
 *
 * Rule: if character has faceRefs[0] but no conceptSheet → copy faceRefs[0] → conceptSheet.
 * This lets old projects display in new UI without user re-uploading.
 */
export function backfillConceptSheet(
  project: PromptProject & ProjectV09Extensions
): PromptProject & ProjectV09Extensions {
  const film = (project as any).filmV093;
  if (!film || !Array.isArray(film.characters)) return project;

  let anyChanged = false;
  const updatedCharacters = film.characters.map((char: any) => {
    if (char.conceptSheet) return char;
    const firstFace = char.faceRefs?.[0];
    if (firstFace && firstFace.dataUrl) {
      anyChanged = true;
      return { ...char, conceptSheet: { ...firstFace, label: "concept sheet" } };
    }
    return char;
  });

  if (!anyChanged) return project;

  return {
    ...project,
    filmV093: {
      ...film,
      characters: updatedCharacters,
      updatedAt: Date.now(),
    },
  } as PromptProject & ProjectV09Extensions;
}

/**
 * Check if a project needs migration (for UI badges / banners if needed).
 */
export function needsMigration(project: PromptProject): boolean {
  const ext = project as PromptProject & ProjectV09Extensions;
  return ext.schemaVersion !== "v0.9";
}
