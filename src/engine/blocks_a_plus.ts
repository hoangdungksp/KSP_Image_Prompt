/**
 * KSP Image — Engine A+ block builders (v0.9.1)
 *
 * Refactor of v0.4 13-block engine, redesigned to match Danh Seven gold-standard
 * 18-doc patterns + 8 KSP-specific improvements that go beyond Danh Seven.
 *
 * 12 blocks ordered for AI parse efficiency:
 *   1.  FACE LOCK            — compressed identity instruction (multi-face avg if N≥2)
 *   2.  REFERENCE META       — 01_, 02_, 03_ filename ordering convention
 *   3.  APPEARANCE           — gộp body + hair + makeup + skin + nails (1 block)
 *   4.  OUTFIT               — image #N + brand specificity injection
 *   5.  POSITION             — pose + framing
 *   6.  BACKGROUND           — foreground / midground / background depth
 *   7.  ATMOSPHERE/MOOD      — per-shot mood variation (6 mood types)
 *   8.  LIGHTING RECIPE      — time + direction + Kelvin + shadow style
 *   9.  COMPOSITION          — rule-of-thirds, eye level, leading lines
 *   10. CAMERA               — auto-match shot type (85mm close, 50mm medium, 35mm wide)
 *   11. NEGATIVE             — anti-AI-beautified + identity protection
 *   12. OUTPUT CONTROL       — resolution exact + sRGB + no watermark
 *
 * Beyond Danh Seven:
 *   - Multi-face average lock (Danh Seven only single-face)
 *   - Anti-AI-beautified protection (no Korean idol face, no plastic skin)
 *   - Per-shot mood variation (Danh Seven all-same)
 *   - Camera-shot auto-match (Danh Seven uses same lens for all shots)
 *   - Resolution explicit per AR (Danh Seven inconsistent)
 *   - Lighting recipe specific (Danh Seven generic)
 *   - Composition block (Danh Seven absent)
 *   - Output control block (Danh Seven absent)
 */

import type {
  CameraStyle,
  ReferenceImagesInput,
  SubjectDNA,
  SubjectType,
  IdeaInput,
  AspectRatio,
  PoseConfig,
} from "../types";

// ============================================================================
// BLOCK 1: FACE LOCK — compressed, supports single + multi-face
// ============================================================================

export function buildFaceLockAPlus(
  hasFace: boolean,
  faceCount: number,
  subjectType: SubjectType,
  faceLabels?: string[]
): string {
  if (!hasFace) return "";

  // Multi-face: KSP improvement — average facial structure across angles
  if (faceCount >= 2) {
    const labels = faceLabels && faceLabels.length === faceCount
      ? faceLabels
      : ["front", "3/4 left", "3/4 right", "profile", "looking up", "additional angle"].slice(0, faceCount);

    const labelList = labels.map((l, i) => `image #${i + 1} = ${l}`).join(", ");
    return `Please take a portrait of me with my face exactly like the attached reference images, 100% identical. No editing of my face is allowed. ${faceCount} face references provided (${labelList}) — average the facial structure across all angles to lock the exact identity: eye spacing, nose bridge, jawline, cheekbone height, forehead shape, and chin. Use natural average skin tone across references (ignore lighting cast from any single image).`;
  }

  // Single face — verbatim style from doc18 + doc11 hybrid
  if (subjectType === "couple") {
    return `Please take a portrait of the woman and the man with their faces exactly like the attached reference images, 100% identical. No editing of their faces is allowed. Image #1 = woman's face, image #2 = man's face — keep both 100% accurate.`;
  }
  if (subjectType === "family" || subjectType === "friends_group") {
    return `Please take a group portrait with each person's face exactly like the attached reference images, 100% identical. No editing of any face is allowed. Match each face reference to the corresponding person in the scene.`;
  }
  // Single female / male
  return `Please take a portrait of me with my face exactly like the attached image #1, 100% identical. No editing of my face is allowed.`;
}

// ============================================================================
// BLOCK 2: REFERENCE META — file ordering convention (kept from v0.4)
// ============================================================================

export function buildReferenceMetaAPlus(
  refs: ReferenceImagesInput,
  subjectType: SubjectType
): string {
  if (!refs.hasFace) return "";

  const parts: string[] = [];
  parts.push(
    `Reference image ordering: files are named with numeric prefixes (01_, 02_, 03_, ...) matching "Image #N" in this prompt — process in numeric order.`
  );

  let nextN = 1;

  if (subjectType === "couple") {
    parts.push(`Image #1 = woman's face. Image #2 = man's face.`);
    nextN = 3;
  } else if (subjectType === "family" || subjectType === "friends_group") {
    const c = refs.faceCount || 1;
    parts.push(`Images #1–#${c} = face references for each person.`);
    nextN = c + 1;
  } else {
    const c = refs.faceCount || 1;
    if (c === 1) {
      parts.push(`Image #1 = face reference (use this exact face).`);
      nextN = 2;
    } else {
      parts.push(`Images #1–#${c} = face references of the SAME PERSON (different angles).`);
      nextN = c + 1;
    }
  }

  if (refs.hasOutfit) {
    parts.push(`Image #${nextN} = outfit reference (use this exact outfit, render faithfully).`);
    nextN++;
  }

  if (refs.productCount > 0 && refs.productDescriptions) {
    refs.productDescriptions.forEach((d, i) => {
      if (d) parts.push(`Image #${nextN + i} = product reference (${d}).`);
    });
  }

  return parts.join(" ");
}

// ============================================================================
// BLOCK 3: APPEARANCE — gộp body + hair + makeup + skin + nails
// ============================================================================

export function buildAppearanceAPlus(subject: SubjectDNA, hasFace: boolean): string {
  const parts: string[] = [];

  // BODY — short, leverage face ref defer when available
  const figure = subject.figureBuild
    ? mapFigure(subject.figureBuild)
    : "slender";
  const bust = subject.bust ? mapBust(subject.bust) : "";

  const ethnicity = subject.ethnicity || "Asian";
  const subjectGender = subject.subjectType === "male" ? "man" : "woman";

  if (hasFace) {
    parts.push(
      `*Appearance:* Young ${ethnicity} ${subjectGender} with a ${figure} figure${bust ? `, ${bust}` : ""}, model-like physique. Face, skin tone, and complexion come directly from the face reference — do not override.`
    );
  } else {
    parts.push(
      `*Appearance:* Young ${ethnicity} ${subjectGender} with a ${figure} figure${bust ? `, ${bust}` : ""}, model-like physique.`
    );
  }

  // HAIR — 1 short sentence
  if (subject.hair && (subject.hair.length || subject.hair.style)) {
    const hairLengthMap: Record<string, string> = {
      "very_short": "very short",
      "short": "short",
      "shoulder": "shoulder-length",
      "shoulder-length": "shoulder-length",
      "medium": "medium-length",
      "long": "long",
      "waist": "waist-length",
      "waist-length": "waist-length",
      "extra_long": "extra-long, hip-length",
    };
    const hairLength = hairLengthMap[subject.hair.length || ""] || subject.hair.length || "shoulder-length";
    const hairStyleMap: Record<string, string> = {
      "straight": "straight",
      "wavy": "naturally wavy",
      "curly": "curly",
      "natural": "natural",
    };
    const hairStyle = hairStyleMap[subject.hair.style || ""] || subject.hair.style || "natural";
    const hairColor = hasFace ? "color matches face reference" : (subject.hair.color || "dark brown");
    const movement = subject.hair.movement === "wind_blowing" ? ", gently blowing in the wind" : "";
    parts.push(
      `*Hair:* ${hairLength}, ${hairStyle}${movement}${hasFace ? ` (${hairColor})` : `, ${hairColor}`}.`
    );
  }

  // MAKEUP — short, pink/peach defaults from Danh Seven (smart-trim "Light X" duplicates)
  if (!hasFace || (subject.makeup && (subject.makeup.style || subject.makeup.lipsType))) {
    const blushColor = subject.makeup?.blushColor || "light pink";
    const lipsType = subject.makeup?.lipsType || "glossy peach-pink";
    // If blushColor already contains "light"/"soft", don't double-prefix
    const blushPhrase = /^(light|soft|natural)/i.test(blushColor)
      ? `${blushColor} blush`
      : `light ${blushColor} blush`;
    parts.push(
      `*Makeup:* ${capFirst(blushPhrase)}, ${lipsType} lips. Korean-style curled eyelashes (upper and lower).${hasFace ? " Eye color and eyebrow shape come from the face reference." : ""}`
    );
  }

  // SKIN PARADOX — short, 1 phrase as Danh Seven
  parts.push(
    `*Skin:* Smooth, glass-like skin with natural pores visible — NOT plastic, NOT airbrushed, NOT AI-beautified. Real human skin texture preserved.`
  );

  // NAILS — short
  if (subject.nails && (subject.nails.color || subject.nails.shape)) {
    const nailShape = subject.nails.shape || "almond";
    const nailColor = subject.nails.color || "glossy light pink";
    parts.push(`*Nails:* ${nailShape}-shaped, ${nailColor}.`);
  } else {
    parts.push(`*Nails:* Glossy light pink, well-groomed.`);
  }

  return parts.join(" ");
}

function mapFigure(f: string): string {
  const map: Record<string, string> = {
    slender: "slender",
    athletic: "athletic",
    curvy: "curvy hourglass",
    petite: "petite",
    average: "natural",
  };
  return map[f] || f;
}
function mapBust(b: string): string {
  const map: Record<string, string> = {
    small: "delicate bust",
    medium: "natural bust",
    full: "full bust",
    voluptuous: "voluptuous bust",
  };
  return map[b] || "";
}
function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================================
// BLOCK 4: OUTFIT — image ref + brand specificity (KSP improvement)
// ============================================================================

export function buildOutfitAPlus(
  refs: ReferenceImagesInput,
  subjectType: SubjectType,
  brandSpecificity?: string
): string {
  const parts: string[] = [];

  // Outfit ref
  if (refs.hasOutfit) {
    let imgIdx = 2; // single subject default
    if (subjectType === "couple") imgIdx = 3;
    else if (subjectType === "family" || subjectType === "friends_group") {
      imgIdx = (refs.faceCount || 1) + 1;
    } else {
      imgIdx = (refs.faceCount || 1) + 1;
    }
    parts.push(`*Outfit:* Wearing the outfit shown in attached image #${imgIdx} (full set, exactly as shown).`);
  } else {
    parts.push(`*Outfit:* Casual modern outfit suitable for the scene.`);
  }

  // Brand specificity — KSP improvement vs Danh Seven (always present, not just outfit-tied)
  if (brandSpecificity && brandSpecificity.trim()) {
    parts.push(`Accessories & products: ${brandSpecificity.trim()}.`);
  }

  return parts.join(" ");
}

// ============================================================================
// BLOCK 5: POSITION — pose + framing (per-shot)
// ============================================================================

export function buildPositionAPlus(pose: PoseConfig, poseNote?: string): string {
  const parts: string[] = [];
  if (poseNote && poseNote.trim()) {
    parts.push(`*Position:* ${poseNote.trim()}`);
  } else {
    const posStr = pose.position || "Standing pose";
    const looking = pose.lookingAt === "camera"
      ? "Looking at the camera"
      : pose.lookingAt === "away"
      ? "Looking away from the camera"
      : "Gaze natural";
    const expr = pose.expression || "natural smile";
    parts.push(`*Position:* ${posStr}. ${looking}, ${expr}.`);
  }
  return parts.join(" ");
}

// ============================================================================
// BLOCK 6: BACKGROUND — depth layered (KSP improvement)
// ============================================================================

export function buildBackgroundAPlus(idea: IdeaInput): string {
  const desc = idea.translatedEn || idea.raw || "Natural outdoor setting";
  return `*Background and Atmosphere:* ${desc}. Render with layered depth — detailed foreground textures, rich midground elements, and clear background scenery, every layer crisp and realistic.`;
}

// ============================================================================
// BLOCK 7: ATMOSPHERE/MOOD — per-shot 6 mood variations (KSP improvement)
// ============================================================================

export const MOOD_VARIATIONS = [
  "contemplative",
  "playful",
  "confident",
  "serene",
  "dynamic",
  "intimate",
] as const;

export type MoodType = typeof MOOD_VARIATIONS[number];

export function pickMoodForShot(shotOrder: number): MoodType {
  // Rotate through 6 moods. Shot 1 = contemplative, 2 = playful, ... 7 wraps back.
  const idx = (shotOrder - 1) % MOOD_VARIATIONS.length;
  return MOOD_VARIATIONS[idx];
}

export function buildAtmosphereAPlus(
  idea: IdeaInput,
  shotOrder: number,
  cameraStyle: CameraStyle
): string {
  const mood = pickMoodForShot(shotOrder);
  const moodDescriptors: Record<MoodType, string> = {
    contemplative: "thoughtful, introspective, calm",
    playful: "bright, cheerful, mischievous",
    confident: "self-assured, poised, empowered",
    serene: "peaceful, dreamy, tranquil",
    dynamic: "energetic, lively, in motion",
    intimate: "warm, soft, personal",
  };
  const baseEmotion = moodDescriptors[mood];
  const themeMoodArr = idea.hints?.mood;
  const themeMood = themeMoodArr && themeMoodArr.length > 0
    ? `, ${themeMoodArr.join(", ")}`
    : "";

  // Color tone hint based on camera style
  const colorTone = cameraStyle === "BOKEH"
    ? "Warm, romantic, gentle pastels with soft contrast"
    : "Natural, true-to-life, vibrant with iPhone-style color science";

  return `*Color Tone:* ${colorTone}${themeMood}. *Emotion:* ${baseEmotion} — enjoying the moment.`;
}

// ============================================================================
// BLOCK 8: LIGHTING RECIPE — specific (KSP improvement vs Danh Seven generic)
// ============================================================================

export function buildLightingAPlus(idea: IdeaInput, cameraStyle: CameraStyle): string {
  const time = idea.hints?.time || "afternoon";
  const recipes: Record<string, string> = {
    morning: "Soft morning light, low warm sun from camera-side, ~3500K, gentle long shadows, rim light on hair",
    afternoon: "Natural afternoon light, ~4500K daylight, soft directional, mild shadows",
    golden_hour: "Golden hour 5pm, low warm sun, ~3200K, single rim light, soft long shadows, glowing skin highlights",
    sunset: "Sunset glow, warm 2800K backlight, silhouette accents, vibrant orange-pink sky",
    night: "Night with practical lights — warm yellow lanterns or street lamps ~2700K, soft fill, cinematic shadows",
    overcast: "Overcast diffused light, soft even illumination ~5500K, no harsh shadows, natural color rendition",
    dawn: "Dawn cool blue, ~5200K, soft east light, misty atmosphere",
  };
  const recipe = recipes[time] || recipes.afternoon;

  // BOKEH adds artistic light quality
  const bokehMod = cameraStyle === "BOKEH"
    ? ". Light interacts with soft bokeh highlights in the background, cinematic glow on subject."
    : ". Even illumination across frame, documentary-style natural light.";

  return `*Lighting:* ${recipe}${bokehMod}`;
}

// ============================================================================
// BLOCK 9: COMPOSITION — explicit guide (KSP improvement, absent in Danh Seven)
// ============================================================================

export function buildCompositionAPlus(framing: string): string {
  const compositions: Record<string, string> = {
    close_up: "Tight close-up framing, subject's face fills 60-70% of frame, eye level, rule of thirds with eyes on upper third line, shallow background",
    medium: "Medium shot from waist up, subject centered or right-third placement, eye level, balanced background, natural breathing room above head",
    medium_full: "Medium-full shot from knee up, subject at left or right third, eye level, leading lines from background guiding to subject",
    full: "Full body shot, subject occupying central vertical line, lower-third grounded, eye level, environment visible 360°",
    wide: "Wide establishing shot, subject placed at rule-of-thirds intersection, low or eye-level camera, full context visible, sense of scale",
    extreme_close_up: "Extreme close-up of facial detail, fills entire frame, dramatic but flattering angle",
    over_the_shoulder: "Over-the-shoulder framing, subject's back/shoulder in foreground 30%, environment in focus middle ground",
  };
  const guide = compositions[framing] || compositions.medium;
  return `*Composition:* ${guide}.`;
}

// ============================================================================
// BLOCK 10: CAMERA — auto-match shot type (KSP improvement)
// ============================================================================

export function buildCameraAPlus(
  cameraStyle: CameraStyle,
  framing: string,
  cameraAngle: string,
  aspectRatio: AspectRatio
): string {
  // Auto-match focal length to shot type for natural look
  const lensMatch: Record<string, { lens: string; aperture: string }> = {
    extreme_close_up: { lens: "100mm macro", aperture: "f/2.8" },
    close_up: { lens: "85mm", aperture: "f/1.8" },
    medium: { lens: "50mm", aperture: "f/1.8" },
    medium_full: { lens: "50mm", aperture: "f/2.0" },
    full: { lens: "35mm", aperture: "f/2.2" },
    wide: { lens: "24mm", aperture: "f/4.0" },
    over_the_shoulder: { lens: "35mm", aperture: "f/2.0" },
  };
  const lens = lensMatch[framing] || lensMatch.medium;
  const angleHumanReadable = cameraAngle.replace(/_/g, " ");

  if (cameraStyle === "BOKEH") {
    return `*Camera:* Shot with a high-end mirrorless camera (Sony A7R V or Canon R5) with a ${lens.lens} lens at ${lens.aperture}, focusing sharply on the model. Soft impressive lighting, high contrast, beautiful skin texture, shallow depth of field, elegant cinematic feel. Camera angle: ${angleHumanReadable}.`;
  }
  // DOCUMENTARY — iPhone style
  return `*Camera:* Taken with iPhone 15 Pro / iPhone 15 Pro Max in standard camera mode. Sharp throughout the entire frame, deep depth of field, natural lifestyle aesthetic. Camera angle: ${angleHumanReadable}.`;
}

// ============================================================================
// BLOCK 11: NEGATIVE — anti-AI-beautified + identity protection (KSP improvement)
// ============================================================================

export function buildNegativeAPlus(cameraStyle: CameraStyle): string {
  const baseNegative = [
    "blurry",
    "low quality",
    "distorted",
    "3D render",
    "CGI",
    "illustration",
    "cartoon",
    "anime",
    "fake skin",
    "extra limbs",
    "extra fingers",
    "duplicate fingers",
    "deformed hands",
    "incorrect anatomy",
    "motion blur on subject",
  ];

  // KSP improvement: identity protection + anti-AI-beautified (Danh Seven absent)
  const identityProtection = [
    "no Korean idol face",
    "no AI-beautified skin",
    "no plastic skin",
    "no airbrushed face",
    "no facial morphing",
    "no different person",
    "no celebrity look-alike",
    "no generic pretty Asian face",
  ];

  // DOC mode adds anti-bokeh; BOKEH mode no extras
  const docExtras = cameraStyle === "DOCUMENTARY"
    ? ["no portrait mode artifacts", "no excessive bokeh"]
    : [];

  return `*Negative:* ${[...baseNegative, ...identityProtection, ...docExtras].join(", ")}.`;
}

// ============================================================================
// BLOCK 12: OUTPUT CONTROL — resolution + format (KSP improvement, absent Danh Seven)
// ============================================================================

export function buildOutputControlAPlus(aspectRatio: AspectRatio): string {
  const resolutionMap: Record<AspectRatio, string> = {
    "9:16": "1080x1920px (vertical, TikTok/Reels)",
    "16:9": "1920x1080px (horizontal, YouTube)",
    "1:1": "2048x2048px (square, Instagram)",
    "3:4": "1536x2048px (portrait, classic)",
    "2:3": "1366x2048px (portrait, photographic)",
  };
  const resolution = resolutionMap[aspectRatio] || `aspect ratio ${aspectRatio}`;
  return `*Output:* Aspect ratio ${aspectRatio}. Resolution: ${resolution}. 8K detail, photorealistic DSLR HD quality, sRGB color profile, no watermark, no text overlay, no logo overlay.`;
}
