/**
 * Pose Datalist Suggestions v0.5.3
 * 
 * Per-field dropdown suggestions for Position / Hands / Expression.
 * User can pick from list OR type their own.
 */

export const POSITION_SUGGESTIONS = {
  lifestyle: [
    "Standing in front of cafe entrance",
    "Sitting at outdoor cafe table",
    "Walking confidently down city street",
    "Standing by large window with natural light",
    "Sitting on outdoor stone stairs",
    "Standing under tree with dappled sunlight",
    "Leaning against brick wall casually",
    "Standing at street corner",
    "Sitting on park bench",
    "Walking through narrow alley",
    "Standing on balcony looking out",
    "Sitting cross-legged on grass",
    "Standing near motorcycle on street",
    "Walking on beach barefoot",
  ],
  tvc_commercial: [
    "Standing facing camera straight-on",
    "Side profile pose, body angled three-quarters",
    "Walking confidently toward the camera",
    "Standing with body slightly leaning forward",
    "Sitting at clean white commercial table",
    "Standing against gradient studio backdrop",
    "Three-quarter pose with poised stance",
    "Sitting elegantly on commercial chair",
    "Standing in well-lit minimalist setting",
  ],
  editorial_fashion: [
    "Standing tall with body elongated, fashion stance",
    "In mid-twirl with dress flowing, motion blur",
    "Side profile leaning against bold colored wall",
    "Lying on silk fabric, body extended elegantly",
    "Sitting elegantly on designer chair, legs crossed",
    "Standing with body arched slightly, head tilted",
    "Walking down runway with confidence",
    "Standing with one leg crossed over other",
    "Crouching low with body coiled",
    "Standing in dramatic Y-shape pose",
  ],
};

export const HANDS_SUGGESTIONS = {
  lifestyle: [
    "Both hands relaxed naturally by sides",
    "Right hand holding coffee cup, left at side",
    "Both hands holding tote bag in front",
    "One hand in pocket, other at side",
    "Both hands cupping warm drink",
    "One hand touching hair, other at side",
    "Hands clasped in front naturally",
    "One hand on hip, other at side",
    "Hands holding phone at chest height",
    "One hand carrying handbag, other free",
    "Arms crossed loosely at chest",
    "Hands together holding small flower",
  ],
  tvc_commercial: [
    "Both hands holding product elegantly at chest level",
    "Right hand raising product up to face",
    "Both hands cupping product, offering gesture",
    "One hand presenting product, other at side",
    "Hands actively using product (applying, drinking)",
    "Both hands on product label facing camera",
    "One hand on hip, other holding product",
    "Hands gently touching product packaging",
    "Both hands gesture of revealing product",
  ],
  editorial_fashion: [
    "One hand running through hair dramatically",
    "Both arms extended outward gracefully",
    "Both hands on hips, fashion stance",
    "One hand against wall behind head",
    "Hands clasped behind back",
    "Both arms raised above head framing face",
    "One hand gracefully touching neck",
    "Hands draped over chair arms",
    "One hand pulling clothing slightly",
    "Both hands in hair pulling it up",
  ],
};

export const EXPRESSION_SUGGESTIONS = {
  lifestyle: [
    "Gentle natural smile, warm eyes",
    "Bright joyful laugh, eyes crinkled",
    "Subtle thoughtful smile",
    "Serene peaceful contemplation",
    "Warm contemplative gaze",
    "Soft dreamy expression",
    "Genuine candid laugh",
    "Calm relaxed neutral expression",
    "Surprised playful smile",
    "Mysterious half-smile",
    "Confident gentle smirk",
    "Wide bright laughing smile",
  ],
  tvc_commercial: [
    "Confident bright smile, brand ambassador energy",
    "Warm inviting smile, welcoming eyes",
    "Charming approachable smile",
    "Eyes closed in serene enjoyment",
    "Excited delighted expression",
    "Reassuring calm smile",
    "Joyful authentic enjoyment of product",
    "Direct confident eye contact with camera",
    "Soft satisfied smile",
  ],
  editorial_fashion: [
    "Intense smoldering gaze, lips slightly parted",
    "Distant mysterious gaze",
    "Sensual half-lidded eyes",
    "Sophisticated cool haughty expression",
    "Eyes closed serenely, ethereal mood",
    "Dramatic determined fierce look",
    "Slight pout, fashion editorial mood",
    "Confident direct stare",
    "Joyful free-spirited laugh",
    "Mysterious knowing half-smile",
  ],
};

export const FRAMING_SUGGESTIONS = [
  "wide shot",
  "medium shot",
  "medium close-up",
  "close-up",
  "extreme close-up",
  "full body",
  "three-quarter shot",
];

export function getSuggestionsForMode<T extends Record<string, string[]>>(
  suggestions: T,
  mode: string
): string[] {
  if (mode in suggestions) return (suggestions as any)[mode];
  return suggestions.lifestyle || [];
}
