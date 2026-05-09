/**
 * KSP Image v0.9.1 — Photos prompt builder
 *
 * Adapter that converts PhotosV091Data + selected cast + selected shot
 * into the existing v0.4 PromptProject shape, then delegates to assemblePrompt.
 *
 * This way Photos mode v0.9.1 inherits the proven 13-block engine for free:
 *   - Bifurcation Camera Style (BOKEH/DOCUMENTARY) — magic phrases verbatim
 *   - Skin Paradox auto-inject
 *   - Identity Lock Mode (smart auto-defer when faceRefs.length > 0)
 *   - Dynamic single/multi-face prompt logic (driven by references.faceCount)
 *   - Theme-aware negative prompts
 *   - 8 angle preset variation injection
 */

import { assemblePromptAPlus } from "./assembler_a_plus";
import { getThemeById } from "./themes";
import { applyAnglePreset, getAngleById } from "./angles";
import type {
  PromptProject,
  ProjectV09Extensions,
  Shot,
  AssembledPrompt,
  IdeaInput,
  ReferenceImagesInput,
  SubjectDNA,
  CameraStyle,
  AspectRatio,
} from "../types";
import type { PhotosCastMember, PhotosShot, PhotosV091Data } from "../types/photos_v091";

type ProjWithPhotos = PromptProject & ProjectV09Extensions;

/**
 * Build prompt for a single Photos shot — uses Engine A+ (12 blocks, Danh Seven format + 8 KSP improvements).
 * Returns null when prerequisites missing (no cast selected, etc.).
 */
export function buildPhotosShotPrompt(
  project: PromptProject,
  shot: PhotosShot
): AssembledPrompt | null {
  const photos = (project as ProjWithPhotos).photosV091;
  if (!photos) return null;

  const cast = photos.cast.find((c) => c.id === photos.selectedCastId) ?? photos.cast[0];
  if (!cast) return null;

  const adapted = adaptToLegacyProject(project, photos, cast, shot);
  const legacyShot = adaptToLegacyShot(shot, photos.cameraStyle);

  // Pass A+ extras: brand specificity + face labels for multi-face avg lock
  return assemblePromptAPlus(adapted, legacyShot, {
    poseNote: shot.poseNote,
    brandSpecificity: cast.brandSpecificity,
    faceLabels: cast.faceRefs.map((f) => f.label),
  });
}

/**
 * Build prompts for ALL shots in current Photos project.
 * Used by ImageGen list view to populate cachedPrompt for each row.
 */
export function buildAllPhotosPrompts(
  project: PromptProject
): Map<string, AssembledPrompt> {
  const photos = (project as ProjWithPhotos).photosV091;
  const result = new Map<string, AssembledPrompt>();
  if (!photos) return result;
  for (const shot of photos.shots) {
    const p = buildPhotosShotPrompt(project, shot);
    if (p) result.set(shot.id, p);
  }
  return result;
}

// ============================================================================
// ADAPTERS
// ============================================================================

function adaptToLegacyProject(
  project: PromptProject,
  photos: PhotosV091Data,
  cast: PhotosCastMember,
  _shot: PhotosShot
): PromptProject {
  // Resolve idea text from theme or custom
  const idea = resolveIdea(photos);

  // Build references metadata for engine
  const references: ReferenceImagesInput = {
    hasFace: cast.faceRefs.length > 0,
    faceCount: cast.faceRefs.length,
    hasOutfit: !!cast.outfitRef,
    productCount: 0,
  };

  // Subject DNA — preserve project.subject defaults but override subjectType from cast.
  // Identity Lock auto-defer in engine reads `references.hasFace` to skip skin/eye/hair color.
  const subject: SubjectDNA = {
    ...project.subject,
    subjectType: cast.subjectType,
  };

  // Camera style + aspect ratio from photos data + project setting
  const cameraStyle: CameraStyle = photos.cameraStyle;
  const aspectRatio = (project.aspectRatio || "9:16") as AspectRatio;

  return {
    ...project,
    mode: "lifestyle", // Photos mode → lifestyle in legacy engine (closest match)
    idea,
    references,
    subject,
    cameraStyle,
    aspectRatio,
  };
}

function adaptToLegacyShot(photosShot: PhotosShot, _projectCameraStyle: CameraStyle): Shot {
  const angle = getAngleById(photosShot.anglePresetId);
  const basePose = {
    position: photosShot.poseNote ?? "",
    lookingAt: "camera" as const,
    expression: "natural smile",
    framing: angle?.framing ?? "medium",
    cameraAngle: angle?.cameraAngle ?? "eye_level",
  };
  const pose = photosShot.anglePresetId
    ? applyAnglePreset(basePose, photosShot.anglePresetId)
    : basePose;

  return {
    id: photosShot.id,
    order: photosShot.order,
    name: angle ? `${photosShot.order}. ${angle.name}` : `Shot ${photosShot.order}`,
    pose,
    anglePresetId: photosShot.anglePresetId,
    cameraOverride: photosShot.cameraStyleOverride
      ? { style: photosShot.cameraStyleOverride }
      : undefined,
  };
}

function resolveIdea(photos: PhotosV091Data): IdeaInput {
  const themeId = photos.theme.themeId;
  const customIntentEn = photos.theme.customIntentEn?.trim();
  const customIntentVi = photos.theme.customIntentVi?.trim();
  // Combine custom intent into description (gets injected into Background block)
  const intentSuffix = customIntentEn
    ? ` Custom user intent: ${customIntentEn}.`
    : customIntentVi
    ? ` Custom user intent (Vietnamese, untranslated): ${customIntentVi}.`
    : "";

  if (themeId) {
    const theme = getThemeById(themeId);
    if (theme) {
      return {
        raw: theme.description + (customIntentVi ? `. ${customIntentVi}` : ""),
        language: "vi",
        translatedEn: (theme.descriptionEn || "") + intentSuffix,
        hints: {
          time: theme.time,
          mood: theme.mood,
        },
      };
    }
  }
  // Fallback to custom idea (Vietnamese free-text — engine translates separately)
  const customVi = photos.theme.customIdeaVi ?? "";
  return {
    raw: customVi + (customIntentVi ? `. ${customIntentVi}` : ""),
    language: "vi",
    translatedEn: intentSuffix.trim() || undefined,
  };
}
