/**
 * KSP Image - Main Assembler v0.5
 *
 * Mode-aware assembly:
 *   - lifestyle: default (227+30 themes, subject-focused)
 *   - tvc_commercial: subject + product, polished pro studio feel
 *   - product_photo: SKIP subject DNA, focus product
 *   - editorial_fashion: dramatic poses, cinematic, magazine style
 */

import type { AssembledPrompt, PromptProject, Shot, ShotMode } from "../types";

import {
  buildBody,
  buildCamera,
  buildFaceLock,
  buildHair,
  buildLighting,
  buildLocation,
  buildMakeup,
  buildNails,
  buildNegative,
  buildOutfit,
  buildPose,
  buildProductIntegration,
  buildReferencesMeta,
  buildSkinParadox,
  buildStyle,
} from "./blocks";

import { applyAnglePreset, getAngleById } from "./angles";

export function assemblePrompt(
  project: PromptProject,
  shot: Shot
): AssembledPrompt {
  const mode: ShotMode = (project.mode as ShotMode) || "lifestyle";
  const cameraStyle = shot.cameraOverride?.style ?? project.cameraStyle;
  const aspectRatio = shot.cameraOverride?.aspectRatio ?? project.aspectRatio;
  const subjectType = project.subject.subjectType || "female";

  let effectivePose = shot.pose;
  let angleInstruction = "";
  if (shot.anglePresetId) {
    effectivePose = applyAnglePreset(shot.pose, shot.anglePresetId);
    const preset = getAngleById(shot.anglePresetId);
    if (preset) {
      angleInstruction = `\n\nCAMERA VARIATION FOR THIS SHOT: ${preset.cameraInstruction}`;
    }
  }

  // Product photography mode skips subject blocks entirely
  if (mode === "product_photo") {
    return assembleProductPhotoMode(project, shot, angleInstruction, aspectRatio);
  }

  const hasFace = project.references.hasFace;

  const blocks = {
    faceLock: buildFaceLock(
      hasFace,
      subjectType,
      project.references.faceCount || 1,
      project.subject.uniqueIdentifiers
    ),
    body: buildBody(project.subject, hasFace),
    hair: buildHair(project.subject, hasFace),
    makeup: buildMakeup(project.subject, hasFace),
    skinParadox: buildSkinParadox(project.subject, hasFace),
    nails: buildNails(project.subject),
    outfit: buildOutfit(project.references, subjectType),
    productIntegration: buildProductIntegration(project.references),
    pose: buildPose(effectivePose) + angleInstruction,
    location: buildLocation(project.idea),
    lighting: buildLighting(project.idea),
    camera: buildCamera(cameraStyle, effectivePose, aspectRatio),
    style: buildStyle(cameraStyle, project.idea),
    negative: buildNegative(cameraStyle, effectivePose, subjectType),
  };

  const refsMeta = buildReferencesMeta(project.references, subjectType);
  const modeHint = getModeHint(mode);

  const orderedBlocks = [
    modeHint,
    refsMeta,
    blocks.faceLock,
    blocks.body,
    blocks.hair,
    blocks.makeup,
    blocks.skinParadox,
    blocks.nails,
    blocks.outfit,
    blocks.productIntegration,
    blocks.pose,
    blocks.location,
    blocks.lighting,
    blocks.camera,
    blocks.style,
    blocks.negative,
  ].filter((b) => b && b.trim().length > 0);

  const prompt = orderedBlocks.join("\n\n");

  return {
    prompt,
    blocks,
    estimatedTokens: Math.ceil(prompt.length / 4),
  };
}

function assembleProductPhotoMode(
  project: PromptProject,
  shot: Shot,
  angleInstruction: string,
  aspectRatio: string
): AssembledPrompt {
  const productBlock = buildProductIntegration(project.references);
  const refsMeta = buildReferencesMeta(project.references, "female");

  const productPhotoIntro =
    "Product photography style: This is a product-only shot — no people in the frame. The product is the sole subject of the photograph, styled on a professional photographic background.";

  const styledBackground = `Background and styling: ${
    project.idea.translatedEn || project.idea.raw || "Clean professional product photography background, studio quality"
  }. The composition follows premium e-commerce and catalog product photography standards.`;

  const productLighting =
    "Lighting: Professional 3-point product photography lighting setup. Key light from the upper-left at 45°, fill light from the lower-right, rim light from behind to separate the product from the background. Even highlights, soft shadows, and true-to-life colors. No harsh shadows or color casts on white surfaces.";

  const productCamera = `Camera: Shot with a high-end macro lens (Canon RF 100mm f/2.8 Macro or Sony 90mm Macro G), aperture f/8 to f/11 for sharp product details across the entire frame. Tripod-stabilized with sharp focus throughout the product. Aspect ratio: ${aspectRatio}. 8K resolution, hi-res commercial product photography quality.${angleInstruction}`;

  const productStyle =
    "Style: Premium commercial product photography, magazine-quality, hi-end e-commerce catalog aesthetic. Sharp product details, brand logos and labels clearly readable, true colors, professional studio finish. Style references: Apple product photography, luxury cosmetics ads, Vogue product features.";

  const productNegative =
    "Avoid: people, hands holding the product, fingers visible, body parts, low quality, blurry, pixelation, JPEG errors, harsh shadows, color cast, fake plastic look, distorted product proportions, illegible brand text, redesigned packaging, simplified branding.";

  const orderedBlocks = [
    productPhotoIntro,
    refsMeta,
    productBlock,
    styledBackground,
    productLighting,
    productCamera,
    productStyle,
    productNegative,
  ].filter((b) => b && b.trim().length > 0);

  const prompt = orderedBlocks.join("\n\n");

  return {
    prompt,
    blocks: {
      faceLock: "",
      body: "",
      hair: "",
      makeup: "",
      skinParadox: "",
      nails: "",
      outfit: "",
      productIntegration: productBlock,
      pose: "",
      location: styledBackground,
      lighting: productLighting,
      camera: productCamera,
      style: productStyle,
      negative: productNegative,
    },
    estimatedTokens: Math.ceil(prompt.length / 4),
  };
}

function getModeHint(mode: ShotMode): string {
  if (mode === "tvc_commercial") {
    return "TVC Commercial style: This is a polished commercial advertisement shot. The subject poses confidently with the product as a brand ambassador. Use clean professional studio lighting, balanced composition, and brand-friendly aesthetics. Both the product and the subject's face should be sharp and clearly visible. Composition follows premium TVC commercial standards (similar to Apple, Samsung, L'Oreal, or Vichy commercials).";
  }
  if (mode === "editorial_fashion") {
    return "Editorial Fashion style: This is a high-fashion magazine editorial shot. Use dramatic poses, cinematic lighting, and bold composition. Style follows Vogue, Harper's Bazaar, or Elle magazine editorial spreads. Allow some artistic interpretation while maintaining the subject's facial identity. Background and lighting should feel moody, premium, and visually striking.";
  }
  return "";
}

export function assembleAllShots(
  project: PromptProject
): Map<string, AssembledPrompt> {
  const result = new Map<string, AssembledPrompt>();
  for (const shot of project.shots) {
    result.set(shot.id, assemblePrompt(project, shot));
  }
  return result;
}
