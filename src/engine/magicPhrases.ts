/**
 * MAGIC PHRASES — verbatim from 18 verified prompt sets.
 *
 * These are exact phrases that appear in 3+ of the original docs that produce
 * hyper-realistic images on Banana Pro / Nano Banana. Using these verbatim
 * (instead of paraphrasing) tends to produce better results because the
 * diffusion model has been "trained" by the cumulative effect of seeing
 * these exact phrases repeatedly.
 *
 * Reference: Cross-analysis of 18 docs from Danh Seven creator (Vietnamese
 * AI image prompt community).
 */

// ============================================================================
// FACE LOCK — Block 1
// ============================================================================

export const FACE_LOCK_PHRASES = {
  // Standard (most common, 18/18 docs)
  standard:
    "Please create a photo for me using the same face as in attached image #1, 100% unchanged, no editing or distortion (maintain the facial structure but use AI for makeup).",

  // Strict variant (5+ docs)
  strict:
    "Create a portrait with a face that is 100% identical to the one in the attached image #1. No editing of the face is allowed, maintain the exact facial structure.",

  // Loose variant (used in some docs for natural variation)
  loose:
    "Refer to the face in attached image #1 with a high degree of resemblance, allowing for small natural variations consistent with the scene.",
};

// ============================================================================
// SKIN PARADOX — Block 5 (most important anti-plastic trick)
// ============================================================================

export const SKIN_PARADOX_PHRASES = {
  // The "smooth + natural texture" paradox (key insight from doc1)
  paradox:
    "Smooth and flawless skin with virtually no pores (Poreless effect). IMPORTANT: maintain Natural Skin Texture so the skin looks human and realistic, NOT plastic, NOT airbrushed, NOT velvet-smooth. Light reflects naturally off the skin creating a fresh, dewy effect (not oily, not matte).",

  // Porcelain variant (docs 2, 6)
  porcelain:
    "Flawless, smooth like porcelain, radiant even in natural light, with healthy Natural Skin Texture preventing a plastic appearance.",

  // Korean glass skin (docs 9, 15)
  glassSkin:
    "Radiant, fresh, and smooth skin in the Korean glass-skin style, dewy finish, natural skin texture preserved (no fake skin, no airbrushed look).",
};

// ============================================================================
// CAMERA — Block 11 (verbatim from 18 docs)
// ============================================================================

export const CAMERA_PHRASES = {
  // BOKEH style — standard editorial portrait (10+ docs)
  bokeh:
    "Camera: Shot with a high-end mirrorless camera (Sony A7R V or Canon R5) with an 85mm lens at large aperture (f/1.8 or f/1.2), focusing sharply on the model. Soft, impressive lighting, high contrast, beautiful skin texture, shallow depth of field, elegant cinematic feel.",

  bokehResolution:
    "8K resolution, high-detail, realistic, and captivating DSLR HD image quality.",

  // DOCUMENTARY style — anti-bokeh (4+ docs, but very specific phrasing)
  documentaryCore:
    "Camera: Shot with iPhone 15 Pro / iPhone 15 Pro Max in standard camera mode (NOT portrait mode). EXTREMELY SHARP AND DETAILED throughout the entire frame. NO background blur, NO bokeh effect, NO shallow depth of field, NO depth blur, NO lens blur. Deep depth of field — everything is in focus, both subject AND background equally sharp.",

  documentaryAperture:
    "Aperture closed to f/22, super focal length, deep focus throughout. High-resolution documentary photography, ultra-sharp phone sensor aesthetics, raw image capture, natural lifestyle.",

  documentaryStyle:
    "Style: high-quality iPhone photo, raw photos, natural lifestyle, NO portrait mode, standard camera mode, Instagram celebrity style, street portrait aesthetic.",

  // Sport/indoor variant (docs 6, 7, 16)
  fluorescent:
    "Bright fluorescent lighting of the public arena perfectly illuminates the lines of her face and the surrounding environment, creating clean separation without harsh shadows.",
};

// ============================================================================
// NEGATIVE — Block 13 (verbatim, 6+ docs use this exact wording)
// ============================================================================

export const NEGATIVE_PHRASES = {
  // Standard negative (6/18 docs verbatim)
  standard:
    "blurry, smudged, low quality, pixelation, noise, graininess, JPEG errors, fake skin, animation, illustration, cartoon, anime, CGI face, distortion, deformed hands, extra fingers, extra limbs, incorrect anatomy, duplicate fingers",

  // Documentary-specific anti-bokeh (4 docs)
  documentary:
    "no background blur, no bokeh effect, no shallow depth of field, no depth blur, no lens blur, no portrait mode, no matte makeup, no setting powder, no dry face, no flat lighting, no software-edited skin, no artificial skin, no velvet smooth skin, no beauty filters, no thick foundation",
};

// ============================================================================
// SUBJECT DESCRIPTION — Block 2 (female, used in 12+ docs)
// ============================================================================

export const SUBJECT_PHRASES = {
  femaleSlender:
    "young Asian woman with a slender figure, fair skin, a small waist, a model-like physique, and a full bust",

  femaleHourglass:
    "young Asian woman with an hourglass figure, full and voluptuous bust, well-proportioned hips",

  femaleVietnamese:
    "young Vietnamese woman with a slender figure, fair warm-toned skin, model-like physique, full bust, natural Vietnamese facial features",
};

// ============================================================================
// HAIR — Block 3 (used in 7+ docs)
// ============================================================================

export const HAIR_PHRASES = {
  longWaistDarkBrown:
    "long, dark brown hair reaches her waist, looks healthy, with gentle natural waves framing her face, and small strands of hair gently blowing in the wind",

  longBlackStraight:
    "long, straight, natural black hair, healthy and shiny, parted in the middle, falling smoothly down her back",
};

// ============================================================================
// EYES + MAKEUP — Block 4 (5+ docs)
// ============================================================================

export const FACE_FEATURE_PHRASES = {
  eyesStandard:
    "Large, round, dark brown eyes with long, naturally curled eyelashes",

  eyesAlmond:
    "Almond-shaped, dark brown eyes with long curled eyelashes, brown contact lenses for clarity",

  koreanMakeup:
    "Korean-style makeup with pink tones, fair and smooth skin, soft pink blush on cheeks",

  douyinMakeup:
    "Douyin-style makeup emphasizing fresh dewy skin with pink tones, glossy lips, defined eyes",

  glossyLips:
    "Lips coated with glossy peach-pink lipstick, creating a smooth, radiant look",
};

// ============================================================================
// FRAMING (UNIVERSAL — appears in nearly all docs)
// ============================================================================

export const UNIVERSAL_PHRASES = {
  standoutLine: "She naturally stands out against the background.",

  qualityClosing:
    "Stunning 8K image quality. The subject's skin is highlighted with a radiant, fresh look, creating a sharp and impressive appearance.",

  proCamera:
    "Taken with a professional camera. Stunning 8K image quality.",
};
