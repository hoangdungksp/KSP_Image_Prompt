/**
 * KSP Image v0.9.1 — Photos mode CRUD actions
 *
 * Pure functions that take a project and return a patch.
 * Components call: useAppStore.getState().updateCurrentProject(photosAction(...))
 *
 * All actions are reduce-style: produce updated PhotosV091Data, never mutate.
 */

import {
  createDefaultPhotosV091,
  createCastMember,
  createPhotosShot,
  type PhotosV091Data,
  type PhotosCastMember,
  type PhotosImageRef,
  type PhotosShot,
  MAX_FACE_REFS,
  DEFAULT_FACE_LABELS,
  DEFAULT_SHOT_COUNT,
} from "../types/photos_v091";
import type { PromptProject, ProjectV09Extensions, SubjectType, CameraStyle } from "../types";
import { ANGLE_PRESETS, pickNextAngle } from "../engine/angles";
import {
  POSES,
  autoVaryPickPoses,
  getPoseById,
} from "../engine/poses_a_plus";

type ProjWithPhotos = PromptProject & ProjectV09Extensions;

/** Get photos data, creating default if missing. */
export function ensurePhotosData(project: PromptProject): PhotosV091Data {
  const p = project as ProjWithPhotos;
  return p.photosV091 ?? createDefaultPhotosV091();
}

function patch(data: PhotosV091Data): Partial<ProjWithPhotos> {
  return { photosV091: { ...data, updatedAt: Date.now() } };
}

// ============================================================================
// CAST CRUD
// ============================================================================

export function addCastMember(
  project: PromptProject,
  subjectType: SubjectType = "female"
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  const newCast = createCastMember(data.cast.length + 1, subjectType);
  const next: PhotosV091Data = {
    ...data,
    cast: [...data.cast, newCast],
    // Auto-select first cast added
    selectedCastId: data.selectedCastId ?? newCast.id,
  };
  return patch(next);
}

export function updateCastMember(
  project: PromptProject,
  castId: string,
  updates: Partial<PhotosCastMember>
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  const next: PhotosV091Data = {
    ...data,
    cast: data.cast.map((c) => (c.id === castId ? { ...c, ...updates } : c)),
  };
  return patch(next);
}

export function removeCastMember(
  project: PromptProject,
  castId: string
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  const remaining = data.cast.filter((c) => c.id !== castId);
  const next: PhotosV091Data = {
    ...data,
    cast: remaining.map((c, i) => ({ ...c, order: i + 1 })),
    // If removed was selected, fall back to first remaining (or undefined)
    selectedCastId:
      data.selectedCastId === castId ? remaining[0]?.id : data.selectedCastId,
  };
  return patch(next);
}

export function selectCast(
  project: PromptProject,
  castId: string
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  return patch({ ...data, selectedCastId: castId });
}

// ============================================================================
// FACE REFS CRUD (dynamic 1-6 slots, progressive disclosure)
// ============================================================================

export function addFaceRef(
  project: PromptProject,
  castId: string,
  ref: Omit<PhotosImageRef, "id" | "label">
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  const cast = data.cast.find((c) => c.id === castId);
  if (!cast) return {};
  if (cast.faceRefs.length >= MAX_FACE_REFS) return {}; // hard cap

  const slotIndex = cast.faceRefs.length;
  const label = DEFAULT_FACE_LABELS[slotIndex] ?? `face ${slotIndex + 1}`;
  const newRef: PhotosImageRef = {
    ...ref,
    id: `face_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    label,
  };
  return updateCastMember(project, castId, {
    faceRefs: [...cast.faceRefs, newRef],
  });
}

export function removeFaceRef(
  project: PromptProject,
  castId: string,
  refId: string
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  const cast = data.cast.find((c) => c.id === castId);
  if (!cast) return {};
  return updateCastMember(project, castId, {
    faceRefs: cast.faceRefs.filter((r) => r.id !== refId),
  });
}

export function relabelFaceRef(
  project: PromptProject,
  castId: string,
  refId: string,
  newLabel: string
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  const cast = data.cast.find((c) => c.id === castId);
  if (!cast) return {};
  return updateCastMember(project, castId, {
    faceRefs: cast.faceRefs.map((r) =>
      r.id === refId ? { ...r, label: newLabel } : r
    ),
  });
}

export function setOutfitRef(
  project: PromptProject,
  castId: string,
  ref: Omit<PhotosImageRef, "id" | "label"> | null
): Partial<ProjWithPhotos> {
  if (ref === null) {
    return updateCastMember(project, castId, { outfitRef: undefined });
  }
  const newRef: PhotosImageRef = {
    ...ref,
    id: `outfit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    label: "outfit",
  };
  return updateCastMember(project, castId, { outfitRef: newRef });
}

// ============================================================================
// CAMERA STYLE
// ============================================================================

export function setCameraStyle(
  project: PromptProject,
  style: CameraStyle
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  return patch({ ...data, cameraStyle: style });
}

// ============================================================================
// THEME
// ============================================================================

export function selectTheme(
  project: PromptProject,
  themeId: string | undefined
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  return patch({ ...data, theme: { ...data.theme, themeId } });
}

export function setCustomIdea(
  project: PromptProject,
  idea: string
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  return patch({ ...data, theme: { ...data.theme, customIdeaVi: idea } });
}

export function setThemeCategory(
  project: PromptProject,
  categoryId: string | undefined
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  return patch({
    ...data,
    theme: { ...data.theme, selectedCategoryId: categoryId },
  });
}

/**
 * Set custom user intent (Vietnamese) on top of selected theme.
 * customIntentEn is set separately when user clicks "Dịch" (calls Gemini).
 * Pass `null` to clear both VI + EN (e.g., when user removes theme).
 */
export function setCustomIntent(
  project: PromptProject,
  intent: { vi?: string; en?: string } | null
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  if (intent === null) {
    return patch({
      ...data,
      theme: { ...data.theme, customIntentVi: undefined, customIntentEn: undefined },
    });
  }
  return patch({
    ...data,
    theme: {
      ...data.theme,
      ...(intent.vi !== undefined && { customIntentVi: intent.vi }),
      ...(intent.en !== undefined && { customIntentEn: intent.en }),
    },
  });
}

// ============================================================================
// SHOTS — auto-pick angle presets so each shot has a different angle
// ============================================================================

/**
 * Generate N shots with auto-picked angles, replacing existing shots.
 * Default: 6 shots cycling through the 8 angle presets.
 */
/**
 * Auto-pick N shots with varied pose + camera angle.
 *
 * @param project - Current project
 * @param count - Number of shots to create (default DEFAULT_SHOT_COUNT)
 * @param options.poseId - If set: all shots use this exact pose (vary only angle)
 * @param options.poseCategory - If set: shots picked from this pose category only
 * @param options.angleId - If set: all shots use this exact camera angle (vary only pose)
 *
 * Behavior:
 *   - poseId set + angleId set → all N shots identical (Aha A/B test)
 *   - poseId set + angleId unset → all N shots same pose, varied angles
 *   - poseId unset + angleId set → varied poses, all same angle
 *   - both unset → fully auto-vary (default, recommended)
 *   - poseCategory set → only pick from that category
 */
export function autoPickShots(
  project: PromptProject,
  count: number = DEFAULT_SHOT_COUNT,
  options: {
    poseId?: string;
    poseCategory?: string;
    angleId?: string;
  } = {}
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  const safeCount = Math.max(1, Math.min(count, ANGLE_PRESETS.length));

  // Pick poses
  let poseSequence: any[] = [];
  if (options.poseId) {
    // All shots same pose
    const pose = getPoseById(options.poseId);
    poseSequence = Array(safeCount).fill(pose);
  } else if (options.poseCategory) {
    // Vary within category
    const categoryPoses = POSES.filter((p) => p.category === options.poseCategory);
    poseSequence = categoryPoses.slice(0, safeCount);
    while (poseSequence.length < safeCount && categoryPoses.length > 0) {
      poseSequence.push(categoryPoses[poseSequence.length % categoryPoses.length]);
    }
  } else {
    // Full auto-vary across all 100
    poseSequence = autoVaryPickPoses(safeCount);
  }

  // Pick angles
  const shots: PhotosShot[] = [];
  const usedIds: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    const angleId = options.angleId || pickNextAngle(usedIds).id;
    usedIds.push(angleId);
    const shot = createPhotosShot(i + 1, angleId);
    if (poseSequence[i]) {
      shot.posePresetId = poseSequence[i].id;
    }
    shots.push(shot);
  }
  return patch({ ...data, shots });
}

export function addShot(project: PromptProject): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  const usedIds = data.shots.map((s) => s.anglePresetId);
  const next = pickNextAngle(usedIds);
  const shot = createPhotosShot(data.shots.length + 1, next.id);
  return patch({ ...data, shots: [...data.shots, shot] });
}

export function removeShot(
  project: PromptProject,
  shotId: string
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  const remaining = data.shots
    .filter((s) => s.id !== shotId)
    .map((s, i) => ({ ...s, order: i + 1 }));
  return patch({ ...data, shots: remaining });
}

export function updateShot(
  project: PromptProject,
  shotId: string,
  updates: Partial<PhotosShot>
): Partial<ProjWithPhotos> {
  const data = ensurePhotosData(project);
  return patch({
    ...data,
    shots: data.shots.map((s) => (s.id === shotId ? { ...s, ...updates } : s)),
  });
}
