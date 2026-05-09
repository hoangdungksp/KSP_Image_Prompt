/**
 * KSP Image — Assembler A+ (v0.9.1)
 *
 * Orchestrates 12 blocks from blocks_a_plus.ts in optimal order:
 *   FACE LOCK first (highest priority for AI), reference meta, then content blocks,
 *   then technical (camera/composition), then negative + output control last.
 */

import type { AssembledPrompt, PromptProject, Shot } from "../types";
import {
  buildFaceLockAPlus,
  buildReferenceMetaAPlus,
  buildAppearanceAPlus,
  buildOutfitAPlus,
  buildPositionAPlus,
  buildBackgroundAPlus,
  buildAtmosphereAPlus,
  buildLightingAPlus,
  buildCompositionAPlus,
  buildCameraAPlus,
  buildNegativeAPlus,
  buildOutputControlAPlus,
} from "./blocks_a_plus";
import { applyAnglePreset, getAngleById } from "./angles";

interface AssembleAPlusOptions {
  /** Per-shot pose note from PhotosShot (overrides project.pose if present) */
  poseNote?: string;
  /** Cast brand specificity (e.g. "Apple Watch white strap, Honda Vision titanium silver") */
  brandSpecificity?: string;
  /** Face labels for multi-face lock (e.g. ["front", "3/4 left", "3/4 right"]) */
  faceLabels?: string[];
}

export function assemblePromptAPlus(
  project: PromptProject,
  shot: Shot,
  options: AssembleAPlusOptions = {}
): AssembledPrompt {
  const cameraStyle = shot.cameraOverride?.style ?? project.cameraStyle;
  const aspectRatio = shot.cameraOverride?.aspectRatio ?? project.aspectRatio ?? "9:16";
  const subjectType = project.subject.subjectType || "female";

  let effectivePose = shot.pose;
  if (shot.anglePresetId) {
    effectivePose = applyAnglePreset(shot.pose, shot.anglePresetId);
  }
  const framing = effectivePose.framing || "medium";
  const cameraAngle = effectivePose.cameraAngle || "eye_level";

  const hasFace = project.references.hasFace;
  const faceCount = project.references.faceCount || 1;

  // Build all 12 blocks
  const faceLock = buildFaceLockAPlus(hasFace, faceCount, subjectType, options.faceLabels);
  const refMeta = buildReferenceMetaAPlus(project.references, subjectType);
  const appearance = buildAppearanceAPlus(project.subject, hasFace);
  const outfit = buildOutfitAPlus(project.references, subjectType, options.brandSpecificity);
  const position = buildPositionAPlus(effectivePose, options.poseNote);
  const background = buildBackgroundAPlus(project.idea);
  const atmosphere = buildAtmosphereAPlus(project.idea, shot.order, cameraStyle);
  const lighting = buildLightingAPlus(project.idea, cameraStyle);
  const composition = buildCompositionAPlus(framing);
  const camera = buildCameraAPlus(cameraStyle, framing, cameraAngle, aspectRatio);
  const negative = buildNegativeAPlus(cameraStyle);
  const output = buildOutputControlAPlus(aspectRatio);

  // Optimal order for AI parsing:
  //   1. Face lock + ref meta first — set identity priority
  //   2. Appearance block — quick reference for human description
  //   3. Outfit + Position + Background + Atmosphere — scene narrative
  //   4. Lighting + Composition + Camera — technical photography
  //   5. Negative + Output — guardrails last
  const orderedBlocks = [
    faceLock,
    refMeta,
    appearance,
    outfit,
    position,
    background,
    atmosphere,
    lighting,
    composition,
    camera,
    negative,
    output,
  ].filter((b) => b && b.trim().length > 0);

  const prompt = orderedBlocks.join("\n\n");

  // Map back to v0.4 AssembledPrompt.blocks shape for backward compat
  return {
    prompt,
    blocks: {
      faceLock,
      body: appearance, // gộp appearance vào body slot
      hair: "",
      makeup: "",
      skinParadox: "",
      nails: "",
      outfit,
      productIntegration: "",
      pose: position + (atmosphere ? "\n" + atmosphere : ""),
      location: background + (lighting ? "\n" + lighting : ""),
      lighting,
      camera: camera + (composition ? "\n" + composition : ""),
      style: output,
      negative,
    },
    estimatedTokens: Math.ceil(prompt.length / 4),
  };
}
