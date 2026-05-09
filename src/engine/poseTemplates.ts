/**
 * Pose Templates v0.5.3 — 1-click fill Position + Hands + Expression
 *
 * Templates filtered by Mode (Lifestyle / TVC / Editorial).
 * Each template provides ready-to-use English prompt fragments.
 */

export interface PoseTemplate {
  id: string;
  name: string;
  emoji: string;
  mode: "lifestyle" | "tvc_commercial" | "editorial_fashion" | "any";
  industry?: "skincare" | "fnb" | "tech" | "fashion" | "travel" | "general";
  position: string;
  hands: string;
  expression: string;
  /** Auto-set looking_at when this template is picked */
  lookingAt?: "camera" | "away" | "down" | "up" | "side" | "object";
  /** Auto-set framing */
  framing?: string;
}

export const POSE_TEMPLATES: PoseTemplate[] = [
  // ============================================================
  // LIFESTYLE (universal)
  // ============================================================
  {
    id: "ls_walking_smile",
    name: "Walking & Smiling",
    emoji: "🚶",
    mode: "lifestyle",
    position: "Walking confidently down the street, body in mid-stride motion",
    hands: "Both hands relaxed naturally by sides, slight swing motion",
    expression: "Bright natural smile, warm eyes, joyful and relaxed",
    lookingAt: "camera",
    framing: "medium shot",
  },
  {
    id: "ls_cafe_sitting",
    name: "Cafe Sitting",
    emoji: "☕",
    mode: "lifestyle",
    position: "Sitting at outdoor cafe table, body slightly turned three-quarters toward camera",
    hands: "Right hand holding coffee cup, left hand resting on table",
    expression: "Gentle natural smile, warm contemplative eyes",
    lookingAt: "camera",
    framing: "medium shot",
  },
  {
    id: "ls_window_light",
    name: "Window Light",
    emoji: "🪟",
    mode: "lifestyle",
    position: "Standing by a large window, body turned slightly toward incoming light",
    hands: "One hand gently touching the window frame, other hand at side",
    expression: "Soft contemplative expression, dreamy distant gaze",
    lookingAt: "side",
    framing: "medium shot",
  },
  {
    id: "ls_stairs_sitting",
    name: "Stairs Sitting",
    emoji: "🪑",
    mode: "lifestyle",
    position: "Sitting on outdoor stone stairs, knees together, body relaxed",
    hands: "Both hands resting on knees, fingers gently interlocked",
    expression: "Subtle thoughtful smile, calm relaxed mood",
    lookingAt: "camera",
    framing: "medium shot",
  },
  {
    id: "ls_tree_standing",
    name: "Under the Tree",
    emoji: "🌳",
    mode: "lifestyle",
    position: "Standing under a tree with dappled sunlight, body slightly leaning",
    hands: "One hand resting against tree trunk, other hand at side",
    expression: "Peaceful content smile, eyes soft and serene",
    lookingAt: "camera",
    framing: "medium shot",
  },
  {
    id: "ls_walking_phone",
    name: "Phone in Hand",
    emoji: "📱",
    mode: "lifestyle",
    position: "Walking on city street while looking at phone screen",
    hands: "Both hands holding phone at chest height, casual urban grip",
    expression: "Focused calm expression with hint of smile",
    lookingAt: "down",
    framing: "medium shot",
  },
  {
    id: "ls_friends_laugh",
    name: "Friends Laughing",
    emoji: "😄",
    mode: "lifestyle",
    position: "Sitting close to a friend, body turned toward them in mid-laugh",
    hands: "One hand near face covering laugh, other resting on leg",
    expression: "Genuine joyful laugh, eyes crinkled, candid moment",
    lookingAt: "side",
    framing: "medium shot",
  },

  // ============================================================
  // TVC COMMERCIAL
  // ============================================================
  {
    id: "tvc_product_hero",
    name: "Product Hero",
    emoji: "📢",
    mode: "tvc_commercial",
    position: "Standing facing camera straight-on, professional commercial pose",
    hands: "Both hands holding product elegantly at chest level, displaying clearly toward camera",
    expression: "Confident bright smile, warm inviting eyes, brand ambassador energy",
    lookingAt: "camera",
    framing: "medium close-up",
  },
  {
    id: "tvc_side_display",
    name: "Side Display",
    emoji: "✋",
    mode: "tvc_commercial",
    position: "Side profile pose, body angled three-quarters toward camera",
    hands: "Right hand raising product up to face level, gesture of presenting",
    expression: "Eyes closed in serene enjoyment, slight peaceful smile",
    lookingAt: "object",
    framing: "medium close-up",
  },
  {
    id: "tvc_walking_camera",
    name: "Walking Toward Camera",
    emoji: "🚶‍♀️",
    mode: "tvc_commercial",
    position: "Walking confidently toward the camera with poised stride",
    hands: "One hand swinging naturally, other holding product casually at side",
    expression: "Charming confident smile, direct eye contact with camera",
    lookingAt: "camera",
    framing: "medium shot",
  },
  {
    id: "tvc_subject_using",
    name: "Subject Using Product",
    emoji: "💆",
    mode: "tvc_commercial",
    position: "Three-quarter pose, body slightly leaning forward in active engagement",
    hands: "Both hands actively using product (applying, drinking, wearing) in natural gesture",
    expression: "Eyes closed in pleasure, soft smile of enjoyment, authentic moment",
    lookingAt: "down",
    framing: "close-up",
  },
  {
    id: "tvc_two_hands_offer",
    name: "Two Hands Offering",
    emoji: "🤝",
    mode: "tvc_commercial",
    position: "Standing facing camera, body upright and warm",
    hands: "Both hands cupping product gently at chest height, offering gesture",
    expression: "Warm inviting smile, eyes welcoming, brand-friendly mood",
    lookingAt: "camera",
    framing: "medium close-up",
  },
  {
    id: "tvc_sitting_table",
    name: "Sitting at Table",
    emoji: "🪑",
    mode: "tvc_commercial",
    position: "Sitting at clean white commercial table, body upright facing camera",
    hands: "One hand on table near product, other gesturing toward it",
    expression: "Approachable confident smile, eyes engaged with viewer",
    lookingAt: "camera",
    framing: "medium shot",
  },

  // ============================================================
  // EDITORIAL FASHION
  // ============================================================
  {
    id: "ed_vogue_pose",
    name: "Vogue Pose",
    emoji: "👑",
    mode: "editorial_fashion",
    position: "Standing tall with body elongated, slight S-curve fashion stance",
    hands: "One hand running through hair dramatically, other on hip",
    expression: "Intense smoldering gaze, lips slightly parted, fashion editorial drama",
    lookingAt: "camera",
    framing: "medium shot",
  },
  {
    id: "ed_twirl_motion",
    name: "Twirl Motion",
    emoji: "💃",
    mode: "editorial_fashion",
    position: "In mid-twirl, dress flowing with motion blur, dynamic spin",
    hands: "Both arms extended outward gracefully for balance",
    expression: "Joyful laugh with eyes sparkling, free-spirited energy",
    lookingAt: "away",
    framing: "wide shot",
  },
  {
    id: "ed_wall_lean",
    name: "Wall Lean",
    emoji: "🧱",
    mode: "editorial_fashion",
    position: "Side profile leaning against bold colored wall, body elongated",
    hands: "One hand against wall behind head, other on hip",
    expression: "Mysterious half-smile, distant gaze into space",
    lookingAt: "side",
    framing: "medium shot",
  },
  {
    id: "ed_lying_silk",
    name: "Lying on Silk",
    emoji: "🛏",
    mode: "editorial_fashion",
    position: "Lying on red silk fabric, body extended elegantly, dress flowing",
    hands: "One hand resting near face, other extended along body",
    expression: "Sensual half-lidded eyes, lips slightly parted, magazine spread mood",
    lookingAt: "camera",
    framing: "wide shot",
  },
  {
    id: "ed_sitting_chair",
    name: "Editorial Chair",
    emoji: "🪑",
    mode: "editorial_fashion",
    position: "Sitting elegantly on designer chair, legs crossed, body angled",
    hands: "One hand draped over chair arm, other resting on thigh",
    expression: "Sophisticated cool gaze, slight haughty expression, high-fashion aura",
    lookingAt: "camera",
    framing: "medium shot",
  },
  {
    id: "ed_arms_up",
    name: "Arms Up Drama",
    emoji: "🙌",
    mode: "editorial_fashion",
    position: "Standing with body arched slightly, head tilted back",
    hands: "Both arms raised above head, hands gracefully framing face",
    expression: "Eyes closed serenely, lips slightly parted, ethereal mood",
    lookingAt: "up",
    framing: "medium shot",
  },
];

export function getPoseTemplatesForMode(
  mode: "lifestyle" | "tvc_commercial" | "product_photo" | "editorial_fashion"
): PoseTemplate[] {
  // Product photography doesn't use poses (no subject)
  if (mode === "product_photo") return [];
  return POSE_TEMPLATES.filter((t) => t.mode === mode || t.mode === "any");
}

export function getPoseTemplateById(id: string): PoseTemplate | undefined {
  return POSE_TEMPLATES.find((t) => t.id === id);
}
