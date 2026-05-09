/**
 * Storyboard Prompt Generator v0.6
 * 
 * Generates a prompt that creates a NxM grid storyboard image.
 * User pastes this into Banana Pro / Imagen / Midjourney etc.
 */

import type { PromptProject } from "../../types";
import type { StoryArc, FrameTemplate, GridFormat } from "./arcs";
import { FORMAT_CONFIGS } from "./arcs";

export interface StoryboardPromptOptions {
  /** Story arc with frames */
  arc: StoryArc;
  /** Project context (for subject DNA, references) */
  project: PromptProject;
  /** Optional brand name for logo frame */
  brandName?: string;
  /** Optional tagline */
  tagline?: string;
  /** Visual style consistency notes */
  visualStyle?: string;
}

export function generateStoryboardPrompt(opts: StoryboardPromptOptions): string {
  const { arc, project, brandName, tagline, visualStyle } = opts;
  const format = arc.format;
  const config = FORMAT_CONFIGS[format];

  // v0.8.0: Film mode context
  const mode = (project as any).mode || "lifestyle";
  const isFilmMode = mode === "film";
  const filmGenre = (project as any).filmGenre;
  const animationStyle = (project as any).animationStyle || "live_action";
  const filmCharacters = (project as any).filmCharacters || [];
  const filmSubjectMode = (project as any).filmSubjectMode || "simple";
  const useCharacterCards = isFilmMode && filmSubjectMode === "characters";

  // Parse format dimensions
  const [cols, rows] = format.split("x").map(Number);
  const totalCells = cols * rows;

  // ============================================================
  // REFERENCE ORDERING HEADER (v0.6.7 fix)
  // Critical: tells AI which attached file is which reference
  // ============================================================
  const refOrderingParts: string[] = [];
  let imageNum = 1;

  // v0.8.0: Multi-character refs (when using character cards)
  if (useCharacterCards && filmCharacters.length > 0) {
    filmCharacters.forEach((char: any) => {
      char.faceImageIds.forEach((_: string, faceIdx: number) => {
        const label = char.faceImageIds.length === 1
          ? `${char.name} (${char.role}) face`
          : `${char.name} (${char.role}) face angle ${faceIdx + 1}`;
        refOrderingParts.push(
          `Image #${imageNum} (file "${String(imageNum).padStart(2, "0")}_") = ${label}`
        );
        imageNum++;
      });
      char.outfitImageIds.forEach((_: string, outfitIdx: number) => {
        const label = char.outfitImageIds.length === 1
          ? `${char.name} (${char.role}) outfit`
          : `${char.name} (${char.role}) outfit ${outfitIdx + 1}`;
        refOrderingParts.push(
          `Image #${imageNum} (file "${String(imageNum).padStart(2, "0")}_") = ${label}`
        );
        imageNum++;
      });
    });
  } else if (project.references.hasFace) {
    const faceCount = project.references.faceCount || 1;
    if (faceCount === 1) {
      refOrderingParts.push(`Image #${imageNum} (file starting with "${String(imageNum).padStart(2, "0")}_") = face reference`);
      imageNum++;
    } else {
      for (let i = 0; i < faceCount; i++) {
        refOrderingParts.push(`Image #${imageNum} (file "${String(imageNum).padStart(2, "0")}_") = face reference angle ${i + 1}`);
        imageNum++;
      }
    }
  }

  if (!useCharacterCards && project.references.hasOutfit) {
    refOrderingParts.push(`Image #${imageNum} (file "${String(imageNum).padStart(2, "0")}_") = outfit reference`);
    imageNum++;
  }

  // v0.8.0: Skip product refs in film mode
  if (!isFilmMode && project.references.productCount > 0 && project.references.productDescriptions) {
    project.references.productDescriptions.forEach((desc, i) => {
      if (desc) {
        refOrderingParts.push(`Image #${imageNum} (file "${String(imageNum).padStart(2, "0")}_") = product reference: ${desc}`);
        imageNum++;
      }
    });
  }

  const referenceHeader = refOrderingParts.length > 0
    ? [
        `REFERENCE IMAGES (must be used to create the storyboard):`,
        `The attached image files are named with numeric prefixes (01_, 02_, 03_, ...) matching the order below. Process them in this exact order:`,
        ...refOrderingParts.map((p) => `- ${p}`),
        ``,
        useCharacterCards
          ? `These reference images are CRITICAL inputs — each character's face and outfit must appear EXACTLY as shown in their reference images. Each character maintains 100% identity consistency across every frame they appear in. Do not mix or blend characters' features.`
          : `These reference images are CRITICAL inputs — the storyboard MUST use them. The face from the face reference must appear in every applicable frame. The outfit (if provided) must be worn correctly.${isFilmMode ? "" : " The product (if provided) must appear with exactly the same packaging design."}`,
      ].join("\n")
    : "";

  // ============================================================
  // HEADER — grid layout instructions (mode-aware)
  // ============================================================
  const aspectRatio = project.aspectRatio || "9:16";
  const contentType = isFilmMode
    ? `short film${filmGenre ? ` (${filmGenre} genre)` : ""}`
    : `TVC commercial advertisement`;

  const header = [
    `Create a ${cols}x${rows} grid storyboard image showing ${totalCells} sequential frames of a ${contentType}, total duration approximately ${config.totalDuration} seconds.`,
    `The grid layout should be exactly ${cols} columns by ${rows} rows, with ${totalCells} equal-sized cells arranged in a clean grid format. Each cell shows a different frame in chronological order, reading left-to-right, top-to-bottom.`,
    `Each cell should be in ${aspectRatio} aspect ratio internally, with thin neat black borders separating cells.`,
    `IMPORTANT: Do NOT render any text, timing labels, frame numbers, or watermarks inside the frames. Each frame should be a CLEAN ${animationStyle === "live_action" ? "photographic" : "rendered"} image showing only the scene content.${isFilmMode ? "" : " The only text allowed is the brand logo and tagline in the FINAL frame (logo end)."}`,
  ].join(" ");

  // ============================================================
  // SUBJECT IDENTITY (consistency across all frames)
  // ============================================================
  const hasFace = project.references.hasFace;
  let subjectIdentity: string;
  if (useCharacterCards && filmCharacters.length > 0) {
    // Multi-character identity
    const charLines = filmCharacters
      .map((c: any) => {
        const idParts = [
          c.description ? c.description : "",
          c.uniqueIdentifiers ? `Unique features: ${c.uniqueIdentifiers}` : "",
        ].filter(Boolean).join(". ");
        return `- ${c.name} (${c.role}): ${idParts || "as shown in reference image"}`;
      })
      .join("\n");
    subjectIdentity = `MULTI-CHARACTER identity consistency (CRITICAL): The film has ${filmCharacters.length} distinct characters who must each maintain 100% identity consistency across every frame they appear in. Use the attached face/outfit references for each character — do NOT mix or blend their features. Friends and family of each character should immediately recognize them from the reference.

Cast:
${charLines}

For each frame, the breakdown specifies which character(s) appear. When a character appears, their facial features, skin tone, eye color, eye shape, hair, and outfit must match their reference EXACTLY.`;
  } else if (hasFace) {
    subjectIdentity = `Identity consistency (very important): The same person must appear in all ${totalCells} frames. Use the attached face reference image(s) to establish the person's identity. Their facial features, skin tone, eye color, eye shape, and hair color must be identical across all frames — only their pose, expression, outfit, and surroundings change. The face reference takes priority over any conflicting description below.`;
  } else {
    subjectIdentity = `The same ${isFilmMode ? "characters" : "person"} should appear consistently across all ${totalCells} frames with identical facial features, skin tone, and hair color. Only their pose, expression, and surroundings change.`;
  }

  // ============================================================
  // PRODUCT CONSISTENCY (skip in film mode)
  // ============================================================
  const productDesc = project.references.productDescriptions?.[0] || "";
  const productConsistency = !isFilmMode && project.references.productCount > 0
    ? `Product consistency: The product (${productDesc}) must appear with exactly the same packaging, design, logo, and colors across all frames it appears in. Do not redesign or simplify the branding. Use the attached product reference image to lock the appearance.`
    : "";

  // ============================================================
  // VISUAL STYLE CONSISTENCY (animation-style aware in film mode)
  // ============================================================
  // v0.8.0: Animation style descriptors per style
  const ANIMATION_STYLE_DESCRIPTORS: Record<string, string> = {
    live_action: "live action cinematography, photorealistic, 35mm film aesthetic, ARRI Alexa camera, professional color grading, cinematic depth of field",
    anime_2d: "2D anime style, hand-drawn aesthetic, Studio Ghibli inspiration, vibrant colors, expressive character design, Makoto Shinkai-style backgrounds, anime cel shading",
    cgi_3d: "3D CGI animation, Pixar/DreamWorks style, polished rendering, expressive character animation, vibrant colors, cinematic lighting in 3D space",
    stop_motion: "stop-motion animation style, handcrafted puppet aesthetic, Wes Anderson Isle of Dogs / Aardman / Laika Studios inspiration, tactile texture, slight choppy frame quality (12fps feel)",
    cartoon_2d: "2D cartoon style, flat colors, Western animation aesthetic (Disney classic / Adventure Time / Avatar TLA influence), bold outlines, expressive character design",
    film_noir: "film noir style, black and white cinematography, high-contrast chiaroscuro lighting, 1940s-1950s aesthetic, dramatic shadows, venetian blind shadow patterns, smoke atmosphere",
  };
  let styleNote: string;
  if (visualStyle) {
    styleNote = visualStyle;
  } else if (isFilmMode) {
    styleNote = ANIMATION_STYLE_DESCRIPTORS[animationStyle] || ANIMATION_STYLE_DESCRIPTORS.live_action;
  } else {
    styleNote = project.cameraStyle === "BOKEH"
      ? "Cinematic bokeh style throughout — Sony A7R V, 85mm f/1.8, shallow depth of field, golden hour warm lighting, premium commercial aesthetic"
      : "Cinematic but sharper documentary style — iPhone 15 Pro look, deeper focus throughout, natural lighting, authentic mood";
  }
  const styleConsistency = `Visual style (consistent across all frames): ${styleNote}. Same color grading, same lighting mood, same level of detail, same ${isFilmMode ? "rendering" : "camera"} quality across every frame. The ${totalCells} frames should feel like they were ${isFilmMode ? "produced together as part of one cohesive film" : "shot together as part of one cohesive commercial"}.`;

  // ============================================================
  // FRAME-BY-FRAME breakdown
  // ============================================================
  const frameLines = arc.frames.map((frame: FrameTemplate, idx: number) => {
    const isLogoFrame = frame.role === "Logo End" || frame.role === "Brand End" || frame.role === "Logo";
    let action = frame.action;

    if (isLogoFrame && brandName) {
      action = action.replace(/brand logo/gi, `${brandName} brand logo`);
      if (tagline) {
        action += ` Tagline reads: "${tagline}".`;
      }
    }

    return `Frame ${frame.num} (${frame.timing}) — ${frame.role}: ${action}`;
  }).join("\n");

  // ============================================================
  // ASSEMBLY
  // ============================================================
  const blocks = [
    referenceHeader,
    header,
    subjectIdentity,
    productConsistency,
    styleConsistency,
    "",
    `--- ${totalCells} frames breakdown (timing is for narrative pacing reference, NOT to be rendered as text on frames) ---`,
    frameLines,
    "",
    `Output requirements: Produce a single high-resolution image (minimum 2048×2048 if 3x3, or appropriate for the grid layout) showing all ${totalCells} frames laid out as a ${cols}x${rows} grid storyboard. Each frame should be detailed enough to be cropped out and used as a standalone image. The timing labels (0:00-0:03s, etc.) shown in the breakdown above are FOR YOUR REFERENCE ONLY to understand the narrative pacing — DO NOT render these timing labels as visible text on the actual frames. The frames must be CLEAN photographic images without any timing text, frame numbers, or labels.`,
    `Avoid: visible text or timing labels rendered on the frames (the frames must be clean photos), blurry frames, mismatched lighting between frames, inconsistent person identity across frames, irregular grid spacing, watermarks, frame number text, signature artifacts. Text is ONLY acceptable in the final logo frame for the brand name and tagline.`,
  ].filter((b) => b && b.trim().length > 0);

  return blocks.join("\n\n");
}
