/**
 * KSP Image - Block Builders v0.4
 *
 * Now uses MAGIC PHRASES extracted verbatim from 18 verified prompt sets.
 * Supports 5 subject types: female, male, couple, family, friends_group.
 */

import type {
  CameraStyle,
  HairConfig,
  MakeupConfig,
  PoseConfig,
  ReferenceImagesInput,
  SubjectDNA,
  SubjectType,
  IdeaInput,
  AspectRatio,
} from "../types";

import {
  FACE_LOCK_PHRASES,
  SKIN_PARADOX_PHRASES,
  CAMERA_PHRASES,
  NEGATIVE_PHRASES,
  UNIVERSAL_PHRASES,
  FACE_FEATURE_PHRASES,
} from "./magicPhrases";

// ============================================================================
// BLOCK 1: FACE LOCK (uses verbatim magic phrase, supports multi-face refs)
// ============================================================================

export function buildFaceLock(
  hasFace: boolean,
  subjectType: SubjectType = "female",
  faceCount: number = 1,
  uniqueIdentifiers?: string
): string {
  if (!hasFace) {
    if (subjectType === "couple") return "Create a photorealistic portrait of a young Vietnamese couple.";
    if (subjectType === "family") return "Create a photorealistic portrait of a young Vietnamese family.";
    if (subjectType === "friends_group") return "Create a photorealistic group portrait of young Vietnamese friends.";
    if (subjectType === "male") return "Create a photorealistic portrait of a young Vietnamese man.";
    return "Create a photorealistic portrait of a young Vietnamese woman.";
  }

  // ===== COUPLE / FAMILY / GROUP — handled separately =====
  if (subjectType === "couple") {
    return "Please create a photo using the same faces as in attached images #1 (woman) and #2 (man), keeping the face of both persons 100% accurate from the reference images. Maintain the exact facial structures of both subjects.";
  }
  if (subjectType === "family") {
    return "Please create a photo using the same faces as in the attached image(s), keeping each family member's face 100% accurate from the reference images. Maintain exact facial structures.";
  }
  if (subjectType === "friends_group") {
    return "Please create a group photo using the same faces as in the attached images, keeping each person's face 100% accurate from the reference images. Maintain exact facial structures.";
  }

  // ===== SINGLE SUBJECT (female/male) =====

  // v0.6.2: Build unique identifiers section if user provided specific features
  const identifiersBlock = uniqueIdentifiers && uniqueIdentifiers.trim()
    ? ` Specifically preserve these unique features visible in the reference: ${uniqueIdentifiers.trim()}.`
    : "";

  // Single face reference — v0.6.2 with verified "100% accurate" phrase
  if (faceCount <= 1) {
    return [
      FACE_LOCK_PHRASES.standard,
      "",
      `Identity preservation: Keep the face of the person 100% accurate from the reference image. The output face must look exactly like the same person — friends and family should immediately recognize them. Take all the following directly from the reference photo (do not change them based on any other description in this prompt): skin tone, skin texture, eye color, eye shape, eyebrow shape, nose shape, lip shape, jawline, and hair color. Preserve unique identifying features like moles, freckles, distinctive eyebrows, and natural facial asymmetries.${identifiersBlock}`,
      "",
      "Important: Do not generate a generic 'pretty Asian face' or 'Korean idol face' — keep the specific features of the person in the reference. Use AI styling only for makeup tweaks (lipstick, blush), pose, and lighting adjustments to fit the new scene. Never modify the underlying face structure or skin tone.",
      "",
      "If any later instruction in this prompt mentions specific skin tone, eye color, or hair color that conflicts with the reference photo, ignore it and use what's shown in the reference.",
    ].join(" ");
  }

  // Multi-face references — v0.6.2 with verified "100% accurate" phrase
  const refList = Array.from({ length: faceCount }, (_, i) => `#${i + 1}`).join(", ");
  return [
    `Please create a photo using the same person's face shown in all ${faceCount} attached reference images (${refList}), keeping the face 100% accurate from the references. These photos show the same person from different angles, lighting, and expressions — combine them to understand the person's face in 3D.`,
    "",
    `Identity preservation: The output face must look exactly like the same person from the references — friends and family should immediately recognize them. Combine information from all ${faceCount} reference angles to lock in the exact facial structure: eye spacing, nose bridge, jawline, cheekbone height, forehead, and chin shape.${identifiersBlock}`,
    "",
    `Take all the following directly from the references (do not change them based on any other description in this prompt): skin tone, skin texture, eye color, eye shape, eyebrows, nose, lips, and hair color. Preserve unique identifying features like moles, freckles, distinctive eyebrows, ear shape, and natural asymmetries.`,
    "",
    `Important: Do not generate a generic 'pretty Asian model face' or 'Korean idol face' — keep the specific features of the person in the references. Use AI styling only for makeup tweaks, pose, and lighting adjustments. Never modify the underlying face structure.`,
    "",
    `For skin tone, average across all ${faceCount} references — if one photo has reddish indoor lighting and another has natural light, use the natural average tone, not any single reference's lighting cast. If any later instruction in this prompt mentions specific skin tone, eye color, or hair color that conflicts with the references, ignore it and use what's shown in the photos.`,
  ].join(" ");
}

// ============================================================================
// BLOCK 2: BODY / FIGURE (subject-aware)
// ============================================================================

export function buildBody(subject: SubjectDNA, hasFace: boolean = false): string {
  const ethnicity = subject.ethnicity;

  // ===== MALE =====
  if (subject.subjectType === "male") {
    const ms = subject.maleStyle;
    if (!ms) {
      return hasFace
        ? `The photo depicts a young ${ethnicity} man with an athletic build. His face and skin tone come directly from the face reference image.`
        : `The photo depicts a young ${ethnicity} man with an athletic build, fair skin, well-groomed appearance.`;
    }
    const buildDesc = {
      slim: "a slim, lean build",
      athletic: "an athletic, well-toned build",
      muscular: "a strong, muscular build",
      average: "an average, balanced build",
    }[ms.build];
    const skinDesc = hasFace ? "" : `, ${getSkinDesc(subject.skinTone)}`;
    const ageDesc = subject.ageRange ? mapAgeRangeToText(subject.ageRange, "male") : "young";
    return `The photo depicts a ${ageDesc} ${ethnicity} man with ${buildDesc}${skinDesc}.${hasFace ? " His face, skin tone, and complexion come directly from the face reference image." : ""}`;
  }

  // ===== COUPLE =====
  if (subject.subjectType === "couple") {
    return `The photo depicts a young ${ethnicity} couple — a slender woman with fair skin and a well-groomed man with athletic build, both Vietnamese, dressed harmoniously.`;
  }

  // ===== FAMILY =====
  if (subject.subjectType === "family") {
    const composition = subject.groupComposition?.members ||
      "a father, mother, and their children, all with healthy fair skin";
    return `The photo depicts a young ${ethnicity} family: ${composition}.`;
  }

  // ===== FRIENDS GROUP =====
  if (subject.subjectType === "friends_group") {
    const count = subject.groupComposition?.count || 4;
    const composition = subject.groupComposition?.members ||
      `${count} young ${ethnicity} friends in their early-to-mid twenties, mix of women and men, energetic and stylish`;
    return `The photo depicts a group of ${composition}.`;
  }

  // ===== FEMALE (default) =====
  const figure = {
    slender: "a slender figure",
    hourglass: "an hourglass figure, full and voluptuous",
    balanced: "a balanced figure",
    "model-like": "a slender, model-like physique",
  }[subject.figureBuild || "slender"];

  const bust = {
    petite: "petite bust",
    full: "a full bust",
    voluptuous: "a full and voluptuous bust",
  }[subject.bust || "full"];

  const waistDesc = subject.waist === "small" ? ", a small waist" : "";

  // v0.6.1: Friendly tone when face ref present
  if (hasFace) {
    return `The photo depicts a young ${ethnicity} woman with ${figure}${waistDesc}, ${bust}, model-like physique. Her face, skin tone, eye color, and complexion all come directly from the face reference image — please don't override these.`;
  }

  // No face ref → full description with skin tone
  const skinDesc = getSkinDesc(subject.skinTone);
  return `The photo depicts a young ${ethnicity} woman with ${figure}, ${skinDesc}${waistDesc}, ${bust}, model-like physique.`;
}

function getSkinDesc(tone: SubjectDNA["skinTone"]): string {
  return {
    milky_white: "fair, smooth milky-white skin",
    porcelain: "fair, porcelain-smooth skin",
    fair: "fair, smooth skin",
    vietnamese_warm: "fair skin with warm Vietnamese undertones",
    tan: "naturally tanned skin",
  }[tone];
}

function mapAgeRangeToText(range: string, subjectGender: string): string {
  if (range === "18-25") return "young";
  if (range === "25-35") return "young adult";
  if (range === "35-45") return "mature";
  if (range === "45+") return "middle-aged";
  if (range === "child") return "child";
  return "young";
}

// ============================================================================
// BLOCK 3: HAIR (subject-aware)
// ============================================================================

export function buildHair(subject: SubjectDNA, hasFace: boolean = false): string {
  // ===== MALE =====
  if (subject.subjectType === "male") {
    const ms = subject.maleStyle;
    if (!ms) return hasFace
      ? "Hair: short, neatly styled hair (color taken from face reference image)."
      : "Short, neatly styled dark hair, clean appearance.";

    const hairDesc = {
      short_neat: "short, neatly styled hair, polished and clean",
      undercut: "modern undercut hairstyle, longer on top and faded on the sides",
      messy: "messy, textured hair styled deliberately for a casual look",
      long_tied: "long hair tied back in a low ponytail or bun",
      side_parted_classic: "classic side-parted hairstyle, smooth and refined",
      buzz_cut: "very short buzz cut, clean and minimalist",
    }[ms.hair];

    const beardDesc = {
      clean_shaven: "clean-shaven face",
      stubble: "light stubble adding masculine character",
      short_beard: "well-groomed short beard",
      full_beard: "full, well-maintained beard",
    }[ms.beard];

    const colorNote = hasFace ? " Hair color comes directly from the face reference image." : " Dark hair.";
    return `Hair: ${hairDesc}.${colorNote} Facial hair: ${beardDesc}.`;
  }

  // ===== GROUP types — skip hair details =====
  if (subject.subjectType === "couple" || subject.subjectType === "family" || subject.subjectType === "friends_group") {
    return "Hair: each person has natural Vietnamese hair styled appropriately for the scene.";
  }

  // ===== FEMALE (default) =====
  const hair = subject.hair;
  if (!hair) return hasFace
    ? "Hair: styled naturally — length and color come directly from the face reference image."
    : "Long, dark brown hair styled naturally.";

  const lengthDesc = {
    shoulder: "shoulder-length",
    waist: "long, waist-length",
    hip: "very long, hip-length",
    floor: "extremely long, reaching the floor",
  }[hair.length];

  const styleDesc = {
    straight: "straight",
    wavy: "with natural waves",
    braided: "braided",
    ponytail: "tied in a ponytail",
    bun: "tied in a loose bun",
    pigtails: "in two loose pigtails",
  }[hair.style];

  const movementDesc = {
    static: "",
    wind_blowing: ", with small strands of hair gently blowing in the wind",
    damp: ", slightly damp",
  }[hair.movement];

  const partingDesc = hair.parting === "middle" ? ", parted in the middle"
    : hair.parting === "side" ? ", side-parted"
    : "";

  const bangsDesc = hair.bangs ? " with bangs" : "";

  // v0.6.1: Friendly when face ref exists
  if (hasFace) {
    return `Hair: ${lengthDesc} hair${bangsDesc}, ${styleDesc}${partingDesc}, healthy and voluminous${movementDesc}. Hair color comes directly from the face reference image — please don't override.`;
  }

  return `Her ${lengthDesc}, ${hair.color} hair${bangsDesc} is ${styleDesc}${partingDesc}, looks healthy and voluminous${movementDesc}.`;
}

// ============================================================================
// BLOCK 4: FACIAL FEATURES + MAKEUP (subject-aware, uses magic phrases)
// ============================================================================

export function buildMakeup(subject: SubjectDNA, hasFace: boolean = false): string {
  // ===== MALE — natural masculine grooming =====
  if (subject.subjectType === "male") {
    return "Natural, masculine grooming. Clear well-defined eyebrows. Subtle skin care, no obvious makeup. Lips natural color.";
  }

  // ===== GROUP — generic =====
  if (subject.subjectType === "couple") {
    return "Female: Korean-style natural makeup, glossy lips, dewy skin. Male: clean-shaven or light stubble, natural masculine grooming.";
  }
  if (subject.subjectType === "family" || subject.subjectType === "friends_group") {
    return "Each person has appropriate natural makeup or grooming for their gender and age.";
  }

  // ===== FEMALE (default) =====
  const makeup = subject.makeup;

  // v0.5.2: When face ref exists, SKIP eye descriptions (color/shape from ref)
  // Only describe makeup STYLE TWEAKS (blush, lipstick) the user explicitly chose
  if (hasFace) {
    if (!makeup) {
      return "Makeup: subtle natural enhancement, glossy lips, fresh dewy finish — keeping the natural facial features from the reference unchanged.";
    }

    const styleDesc = {
      korean_wonyoung: "soft Wonyoung-inspired Korean makeup tweaks",
      douyin: "subtle Douyin-style makeup enhancement",
      natural_no_makeup: "minimal no-makeup look, just subtle enhancement",
      korean_glass_skin: "light glass-skin highlight (subtle, not changing skin tone)",
      fresh_dewy: "light fresh dewy makeup",
      vietnamese_traditional: "soft traditional Vietnamese rosy tones",
    }[makeup.style];

    const blush = makeup.blushColor || "soft pink";
    const lips = makeup.lipsType || "glossy peach-pink";

    return `Makeup: ${styleDesc}. ${blush.charAt(0).toUpperCase() + blush.slice(1)} blush applied lightly. Lips coated with ${lips}, creating a smooth radiant look. Eye color, eye shape, and eyebrows come directly from the face reference image — please don't modify these.`;
  }

  // No face ref → full description with eye magic phrases
  const eyes = subject.eyes;
  const eyeDesc = eyes?.shape === "almond"
    ? FACE_FEATURE_PHRASES.eyesAlmond
    : FACE_FEATURE_PHRASES.eyesStandard;

  if (!makeup) {
    return `Facial features: ${eyeDesc}. Natural Korean-style makeup with pink tones. ${FACE_FEATURE_PHRASES.glossyLips}.`;
  }

  const styleDesc = {
    korean_wonyoung: "Wonyoung's sweet style, Korean-style makeup with pink tones",
    douyin: FACE_FEATURE_PHRASES.douyinMakeup,
    natural_no_makeup: "Natural, no-makeup look with subtle enhancement",
    korean_glass_skin: "Natural Korean-style makeup with glass-skin base",
    fresh_dewy: "Light, fresh dewy makeup",
    vietnamese_traditional: "Soft, traditional Vietnamese makeup with natural rosy tones",
  }[makeup.style];

  const blush = makeup.blushColor || "soft pink";
  const lips = makeup.lipsType || "glossy peach-pink";

  return `Facial features: ${eyeDesc}. Makeup: ${styleDesc}. ${blush.charAt(0).toUpperCase() + blush.slice(1)} blush applied lightly. Lips coated with ${lips}, creating a smooth, radiant look. Natural eyebrows.`;
}

// ============================================================================
// BLOCK 5: SKIN PARADOX (uses magic phrases verbatim)
// ============================================================================

export function buildSkinParadox(subject: SubjectDNA, hasFace: boolean = false): string {
  // v0.6.1: Friendly when face ref exists
  if (hasFace) {
    return "Skin texture: preserve the natural skin texture from the face reference — visible pores, realistic fine details, subtle imperfections. Not plastic, not airbrushed, not 'AI-beautified'. Light should reflect naturally on real human skin. Match the exact skin texture quality shown in the face reference image.";
  }

  // ===== MALE — slightly different paradox =====
  if (subject.subjectType === "male") {
    return "Skin: healthy fair-toned masculine skin with Natural Skin Texture preserved. Smooth but with realistic pores and fine details. Light reflects naturally — NOT plastic, NOT airbrushed, NOT velvet-smooth.";
  }

  // ===== GROUPS — apply paradox to all visible faces =====
  if (subject.subjectType === "couple" || subject.subjectType === "family" || subject.subjectType === "friends_group") {
    return "All visible skin (every face): smooth healthy texture WITH Natural Skin Texture preserved. NOT plastic, NOT airbrushed. Light reflects naturally creating fresh, dewy effect — but maintaining realistic human skin appearance.";
  }

  // ===== FEMALE — pick paradox variant based on skin tone =====
  if (subject.skinTone === "porcelain") {
    return SKIN_PARADOX_PHRASES.porcelain;
  }

  // Korean glass skin makeup → use glass skin variant
  if (subject.makeup?.style === "korean_glass_skin") {
    return SKIN_PARADOX_PHRASES.glassSkin;
  }

  return SKIN_PARADOX_PHRASES.paradox;
}

// ============================================================================
// BLOCK 6: NAILS (only for female subjects)
// ============================================================================

export function buildNails(subject: SubjectDNA): string {
  // Only render nails for female subjects
  if (subject.subjectType !== "female") return "";

  const nails = subject.nails;
  if (!nails) return "";

  const decoration = nails.decoration ? `, ${nails.decoration}` : "";
  return `${nails.shape.charAt(0).toUpperCase() + nails.shape.slice(1)}-shaped nails painted in ${nails.color}${decoration}.`;
}

// ============================================================================
// BLOCK 7: OUTFIT
// ============================================================================

export function buildOutfit(refs: ReferenceImagesInput, subjectType: SubjectType): string {
  if (refs.hasOutfit) {
    if (subjectType === "couple") return "Outfits: each person wears the matching outfit shown in the corresponding outfit reference image (image #2+).";
    if (subjectType === "family" || subjectType === "friends_group") return "Outfits: each person wears the outfit shown in the matching reference image, rendered faithfully.";
    return "Wearing the outfit shown in attached image #2 (full set, exactly as shown).";
  }

  if (refs.outfitTextDescription) {
    return `Outfit: ${refs.outfitTextDescription}`;
  }

  return "Wearing a stylish, well-fitted outfit appropriate for the scene.";
}

// ============================================================================
// BLOCK 7b (NEW v0.4.5): PRODUCT INTEGRATION — describe how products appear in scene
// ============================================================================

const PRODUCT_PLACEMENT_DESCRIPTIONS = {
  held_in_hand:
    "naturally held in the subject's hand at a comfortable, natural position. The product is clearly visible and identifiable, but the pose feels unforced — as if the subject is using or showing it casually.",
  displayed_held_high:
    "held up by the subject at chest or face level, directly facing the camera in a clear product display pose. This is a classic commercial pose — the product is the focal point alongside the subject's face. Both the subject's face and the product label should be clearly visible and sharp.",
  placed_foreground:
    "placed prominently in the foreground of the composition, between the camera and the subject. The product is the visual anchor of the shot, with the subject as supporting context behind. The product label should be sharp and clearly readable.",
  subject_using:
    "actively being used by the subject in a natural lifestyle gesture (e.g., applying skincare, sipping a drink, wearing or holding the device, using the gadget). The interaction should look authentic — not staged.",
  next_to_subject:
    "positioned close to the subject (on a table, beside them, or held loosely) as a contextual element. The product is visible but not the primary focus.",
  background_styled:
    "incorporated into the styled background or surroundings as part of the lifestyle setting (e.g., on a vanity, kitchen counter, or table). The product should be recognizable but the overall composition is the focus.",
  auto:
    "integrated naturally into the scene in a way that complements the subject and setting.",
};

export function buildProductIntegration(refs: ReferenceImagesInput): string {
  if (!refs.productCount || refs.productCount === 0) return "";
  if (!refs.productDescriptions || refs.productDescriptions.length === 0) return "";

  const placements = refs.productPlacements || [];

  const parts: string[] = ["Product placement in the scene:"];

  refs.productDescriptions.forEach((desc, i) => {
    if (!desc) return;
    const placement = (placements[i] || "auto") as keyof typeof PRODUCT_PLACEMENT_DESCRIPTIONS;
    const placementDesc = PRODUCT_PLACEMENT_DESCRIPTIONS[placement];
    parts.push(
      `The ${desc} should be ${placementDesc} The product appearance must match the reference image exactly — same packaging design, same logo, same colors, same shape. Do not redesign or simplify the branding.`
    );
  });

  parts.push(
    "All products should be sharp, in focus, and clearly identifiable. Brand names and labels should be readable if visible. Products should not be cropped awkwardly or hidden behind other elements unless that's the intended composition."
  );

  return parts.join(" ");
}

// ============================================================================
// BLOCK 8: POSE + ACTION + EMOTION
// ============================================================================

export function buildPose(pose: PoseConfig): string {
  const lookingDesc = {
    camera: "looking directly at the camera",
    away: "looking away from the camera",
    down: "looking downward",
    object: "looking at an object in her hands",
    side: "looking to the side",
    up: "looking upward",
  }[pose.lookingAt];

  const handsDesc = pose.hands ? ` Hands: ${pose.hands}.` : "";
  const notesDesc = pose.notes ? ` ${pose.notes}` : "";

  // v0.4.3 fix: Don't render empty "Position: ." when user leaves position blank
  const trimmedPosition = (pose.position || "").trim();
  const positionLine = trimmedPosition
    ? `Position: ${trimmedPosition}.${handsDesc}`
    : (handsDesc ? `${handsDesc.trim()}` : "");

  return [
    positionLine,
    `Subject ${lookingDesc}.`,
    `Expression: ${pose.expression}.`,
    UNIVERSAL_PHRASES.standoutLine,
    notesDesc,
  ].filter((s) => s && s.trim().length > 0).join(" ");
}

// ============================================================================
// BLOCK 9: LOCATION
// ============================================================================

export function buildLocation(idea: IdeaInput): string {
  const locationText = (idea.translatedEn || idea.raw || "").trim();

  // Bug fix: If both raw and translated are empty, use generic placeholder
  if (!locationText) {
    return "Location & Background: A natural, photographically appropriate setting that complements the subject and lighting. The location should be rendered with layered depth: detailed foreground textures, rich midground elements, and clear background scenery — every layer crisp and realistic.";
  }

  const parts: string[] = [`Location & Background: ${locationText}.`];

  if (idea.hints?.location) {
    parts.push(`Specific setting: ${idea.hints.location}.`);
  }

  if (idea.hints?.vietnameseText && idea.hints.vietnameseText.length > 0) {
    const textInstructions = idea.hints.vietnameseText
      .map(
        (vt) =>
          `Render the Vietnamese text "${vt.text}" (with proper diacritics) as a ${vt.style}, ${vt.placement}.`
      )
      .join(" ");
    parts.push(textInstructions);
  }

  parts.push(
    "The location should be rendered with layered depth: detailed foreground textures, rich midground elements, and clear background scenery — every layer crisp and realistic."
  );

  return parts.join(" ");
}

// ============================================================================
// BLOCK 10: LIGHTING
// ============================================================================

export function buildLighting(idea: IdeaInput): string {
  const time = idea.hints?.time;
  const moods = idea.hints?.mood || [];

  const lightingDesc = time
    ? {
        golden_hour: "Golden hour lighting, warm sunset glow with soft directional light",
        blue_hour: "Blue hour lighting, cool twilight tones after sunset",
        midday: "Bright midday natural daylight, clear and even illumination",
        afternoon: "Soft afternoon natural light with gentle shadows",
        night: "Night scene with practical lights and ambient glow, cinematic shadows",
        overcast: "Soft, diffused light from overcast cloudy sky",
        indoor: "Indoor lighting with motivated practical sources, naturalistic",
      }[time]
    : "Natural lighting appropriate to the scene, with motivated light sources";

  const moodDesc = moods.length > 0 ? ` Overall mood: ${moods.join(", ")}.` : "";

  return [
    `Lighting: ${lightingDesc}.${moodDesc}`,
    "Light interacts naturally with the subject — soft highlights on skin, realistic shadows, no flat or studio-like illumination.",
  ].join(" ");
}

// ============================================================================
// BLOCK 11: CAMERA — uses MAGIC PHRASES verbatim from 18 docs
// ============================================================================

export function buildCamera(
  style: CameraStyle,
  pose: PoseConfig,
  aspectRatio: AspectRatio
): string {
  const angleDesc = {
    eye_level: "eye level",
    low: "low angle, shooting upward",
    bird_eye: "bird's-eye view, shooting downward",
    slight_high: "slightly elevated angle",
    slight_low: "slightly low angle",
  }[pose.cameraAngle];

  const framingDesc = {
    "close-up": "close-up shot",
    medium: "medium shot",
    "full-body": "full-body shot",
    wide: "wide shot",
    selfie: "selfie shot, taken from arm's length",
  }[pose.framing];

  if (style === "BOKEH") {
    return [
      CAMERA_PHRASES.bokeh,
      `Camera angle: ${angleDesc}, ${framingDesc}.`,
      `Aspect ratio: ${aspectRatio}.`,
      CAMERA_PHRASES.bokehResolution,
    ].join(" ");
  }

  // DOCUMENTARY style — verbatim phrases from docs 9, 15, 16, 17
  return [
    CAMERA_PHRASES.documentaryCore,
    CAMERA_PHRASES.documentaryAperture,
    `Camera angle: ${angleDesc}, ${framingDesc}.`,
    `Aspect ratio: ${aspectRatio}.`,
  ].join(" ");
}

// ============================================================================
// BLOCK 12: STYLE
// ============================================================================

export function buildStyle(cameraStyle: CameraStyle, idea: IdeaInput): string {
  const moods = idea.hints?.mood || [];

  // Bug fix v0.4.1: filter out mood words that are already in our style preamble
  // to avoid duplications like "professional and polished, cinematic, romantic, elegant"
  // when style preamble already contains "Cinematic editorial..."
  const STYLE_PREAMBLE_WORDS = new Set([
    "cinematic", "professional", "polished", "editorial",
    "documentary", "lifestyle", "natural", "raw"
  ]);
  const filteredMoods = moods.filter(m => !STYLE_PREAMBLE_WORDS.has(m.toLowerCase().trim()));
  const moodPart = filteredMoods.length > 0 ? `, ${filteredMoods.join(", ")}` : "";

  if (cameraStyle === "BOKEH") {
    return [
      `Style: Cinematic editorial portrait photography, professional and polished${moodPart}.`,
      "True-to-life colors, natural skin tones, photorealistic detail.",
      UNIVERSAL_PHRASES.qualityClosing,
    ].join(" ");
  }

  // DOCUMENTARY
  return [
    CAMERA_PHRASES.documentaryStyle,
    `${moodPart ? "Additional mood:" + moodPart + "." : ""}`,
    "True-to-life colors, natural lighting, photorealistic detail.",
  ].filter(Boolean).join(" ");
}

// ============================================================================
// BLOCK 13: NEGATIVE — uses verbatim 18-doc negative phrasing
// ============================================================================

export function buildNegative(
  cameraStyle: CameraStyle,
  pose: PoseConfig,
  subjectType: SubjectType = "female"
): string {
  const parts: string[] = [NEGATIVE_PHRASES.standard];

  if (cameraStyle === "DOCUMENTARY") {
    parts.push(NEGATIVE_PHRASES.documentary);
  }

  // Pose-specific: detect props and add relevant negatives
  // IMPORTANT: Use word boundaries to avoid false positives (e.g., "glass" in "Sony A7R V or Canon R5" was being matched)
  const poseText = (
    pose.position + " " + (pose.hands || "") + " " + (pose.notes || "")
  ).toLowerCase();

  const poseNegatives: string[] = [];
  if (/\b(bicycle|bike)\b|xe đạp/i.test(poseText)) {
    poseNegatives.push("bent bicycle frame, deformed wheels");
  }
  if (/\b(cup|glass|drink|mug)\b|cốc|\bly\b|chén/i.test(poseText)) {
    poseNegatives.push("deformed cup, warped glass");
  }
  if (/\bphone\b|điện thoại/i.test(poseText)) {
    poseNegatives.push("warped phone screen, deformed phone");
  }
  if (/\b(motorcycle|scooter|moped)\b|xe máy/i.test(poseText)) {
    poseNegatives.push("deformed vehicle, bent vehicle frame");
  }
  if (/\b(crowd|people)\b|đám đông|người dân/i.test(poseText)) {
    poseNegatives.push("motion-smudged crowd, deformed background people");
  }

  // Subject-specific negatives
  if (subjectType === "couple" || subjectType === "family" || subjectType === "friends_group") {
    poseNegatives.push("merged faces, identical twin faces, distorted multi-person composition, wrong number of people");
  }
  if (subjectType === "male") {
    poseNegatives.push("feminine features, makeup on male");
  }

  if (poseNegatives.length > 0) {
    parts.push(poseNegatives.join(", "));
  }

  return `Avoid: ${parts.join(", ")}.`;
}

// ============================================================================
// REFERENCES META — explicit numbering, supports multi-face
// ============================================================================

export function buildReferencesMeta(refs: ReferenceImagesInput, subjectType: SubjectType): string {
  if (!refs.hasFace) return "";

  const parts: string[] = [];

  // FILENAME ORDERING HINT — critical for AI to match filenames to Image #N
  parts.push(
    "Reference image ordering: The attached image files are named with numeric prefixes (01_, 02_, 03_, ...) that match the 'Image #N' references in this prompt. Image #1 corresponds to the file starting with '01_', Image #2 to '02_', and so on. Please process them in this exact numeric order."
  );

  let nextImageNum = 1;

  // ===== COUPLE — fixed: #1 woman, #2 man =====
  if (subjectType === "couple") {
    parts.push("Attached image #1 = WOMAN's face reference (use this exact face, do not modify).");
    parts.push("Attached image #2 = MAN's face reference (use this exact face, do not modify).");
    nextImageNum = 3;
  }
  // ===== FAMILY / FRIENDS GROUP =====
  else if (subjectType === "family" || subjectType === "friends_group") {
    parts.push(`Attached image(s) #1+ = face references for each person. Match each face to the corresponding person in the scene.`);
    // Reserve image slots based on faceCount (default 1 if not set)
    nextImageNum = (refs.faceCount || 1) + 1;
  }
  // ===== SINGLE SUBJECT (female/male) — multi-face support =====
  else {
    const faceCount = refs.faceCount || 1;

    if (faceCount === 1) {
      parts.push("Attached image #1 = face reference (use this exact face, do not modify).");
      nextImageNum = 2;
    } else {
      // Multi-face — number them with descriptive labels
      parts.push(
        `Attached images #1 through #${faceCount} are ALL FACE REFERENCES of the SAME PERSON, showing different angles / lighting / expressions. Use ALL of them together for accurate facial identity:`
      );
      // Suggest labels for first 6 (most common shooting set)
      const FACE_LABELS = [
        "front view (primary face anchor)",
        "3/4 left view",
        "3/4 right view",
        "side profile",
        "looking up / from below angle",
        "additional angle reference",
      ];
      for (let i = 0; i < faceCount; i++) {
        const label = FACE_LABELS[i] || "additional face reference";
        parts.push(`  - Image #${i + 1}: face from ${label}`);
      }
      nextImageNum = faceCount + 1;
    }
  }

  // ===== OUTFIT =====
  if (refs.hasOutfit) {
    parts.push(`Attached image #${nextImageNum} = outfit reference (use this exact outfit, render faithfully).`);
    nextImageNum++;
  }

  // ===== PRODUCTS =====
  if (refs.productCount > 0 && refs.productDescriptions) {
    refs.productDescriptions.forEach((desc, i) => {
      if (desc) {
        parts.push(`Attached image #${nextImageNum + i} = product reference (${desc}).`);
      }
    });
  }

  return parts.join(" ");
}
