/**
 * KSP Image — Camera Movement Single Source of Truth (r7.21)
 *
 * 19 camera movement values categorized by:
 *   - Universal: works for both Veo3 and Omni output
 *   - Veo3-only: traditional cinematography terms Veo understands
 *   - Omni-only: Gemini Omni-specific vocabulary per DeepMind official guide
 *
 * Architecture decision: AI picks from ALL 19 values regardless of project mode.
 * Mode-specific filtering happens at PROMPT RENDER TIME (when user clicks Copy
 * Veo3 or Copy Omni). This way the AI can suggest e.g. `dolly_zoom` (Omni-only)
 * for a Hitchcock-style scene, and KSP renders it differently per target model.
 *
 * Adding new values: add to CAMERA_MOVEMENT_OPTIONS array. Type
 * CameraMovementValue auto-derives from the array — no separate type to keep in sync.
 *
 * Backward compat: projects created before r7.21 may have legacy values like
 * "steadicam_smooth" or "drone_aerial" from the old 7-value FilmCameraMovement
 * type. getLabel() / isKnownValue() handle unknown values gracefully.
 */

export type CameraMovementMode = "veo3" | "omni" | "both";
export type CameraMovementCategory = "static" | "movement" | "transition" | "specialty";

export interface CameraMovementOption {
  /** Stable identifier — persisted on FilmShot.cameraMovement */
  value: string;
  /** Vietnamese label shown in UI dropdown */
  labelVi: string;
  /** English term used in downstream prompt rendering (Banana Pro / Veo / Omni) */
  labelEn: string;
  /** Grouping for AI prompt rules + future UI grouping */
  category: CameraMovementCategory;
  /** Whether Veo 3.1 understands this term natively */
  veo3Compatible: boolean;
  /** Whether Gemini Omni recognizes this term (per DeepMind prompt guide) */
  omniCompatible: boolean;
  /** Short hint for AI shot list generation — when to pick this movement */
  aiHint: string;
}

export const CAMERA_MOVEMENT_OPTIONS: CameraMovementOption[] = [
  // ============================================================================
  // UNIVERSAL — works for both Veo3 and Omni (3 values)
  // ============================================================================
  {
    value: "static",
    labelVi: "Đứng yên (Static)",
    labelEn: "static",
    category: "static",
    veo3Compatible: true,
    omniCompatible: true,
    aiHint: "dialogue, intimate moments, micro-expression close-ups",
  },
  {
    value: "handheld",
    labelVi: "Cầm tay (Handheld)",
    labelEn: "handheld",
    category: "movement",
    veo3Compatible: true,
    omniCompatible: true,
    aiHint: "action shots, energy, documentary feel, urgency",
  },
  {
    value: "tracking",
    labelVi: "Tracking (theo nhân vật)",
    labelEn: "tracking",
    category: "movement",
    veo3Compatible: true,
    omniCompatible: true,
    aiHint: "following character motion, walk-and-talk, chase",
  },

  // ============================================================================
  // VEO3-ONLY — traditional cinematography terms (8 values)
  // ============================================================================
  {
    value: "pan_left",
    labelVi: "Pan trái",
    labelEn: "pan left",
    category: "movement",
    veo3Compatible: true,
    omniCompatible: false,
    aiHint: "reveal space horizontally leftward",
  },
  {
    value: "pan_right",
    labelVi: "Pan phải",
    labelEn: "pan right",
    category: "movement",
    veo3Compatible: true,
    omniCompatible: false,
    aiHint: "reveal space horizontally rightward, establishing shots",
  },
  {
    value: "tilt_up",
    labelVi: "Tilt lên",
    labelEn: "tilt up",
    category: "movement",
    veo3Compatible: true,
    omniCompatible: false,
    aiHint: "reveal verticality, awe, grandeur from below",
  },
  {
    value: "tilt_down",
    labelVi: "Tilt xuống",
    labelEn: "tilt down",
    category: "movement",
    veo3Compatible: true,
    omniCompatible: false,
    aiHint: "reveal details below, intimacy, ground-level focus",
  },
  {
    value: "zoom_in",
    labelVi: "Zoom in",
    labelEn: "zoom in",
    category: "movement",
    veo3Compatible: true,
    omniCompatible: false,
    aiHint: "intensify focus, detail emphasis",
  },
  {
    value: "zoom_out",
    labelVi: "Zoom out",
    labelEn: "zoom out",
    category: "movement",
    veo3Compatible: true,
    omniCompatible: false,
    aiHint: "reveal context, reaction shots, isolation",
  },
  {
    value: "dolly_in",
    labelVi: "Dolly in",
    labelEn: "dolly in",
    category: "movement",
    veo3Compatible: true,
    omniCompatible: false,
    aiHint: "emotional weight, peak moments, slow approach",
  },
  {
    value: "dolly_out",
    labelVi: "Dolly out",
    labelEn: "dolly out",
    category: "movement",
    veo3Compatible: true,
    omniCompatible: false,
    aiHint: "isolation, ending, retreat from subject",
  },

  // ============================================================================
  // OMNI-ONLY — Gemini Omni native vocabulary (8 values)
  // Source: deepmind.google/models/gemini-omni/prompt-guide (May 2026)
  // ============================================================================
  {
    value: "oner",
    labelVi: "Oner (1 take liền)",
    labelEn: "one continuous shot",
    category: "specialty",
    veo3Compatible: false,
    omniCompatible: true,
    aiHint: "continuous narrative scene, no cuts, immersive long take",
  },
  {
    value: "locked_off",
    labelVi: "Locked off (tripod)",
    labelEn: "locked off",
    category: "static",
    veo3Compatible: false,
    omniCompatible: true,
    aiHint: "tripod feel, observational, documentary realism",
  },
  {
    value: "push_in",
    labelVi: "Push in",
    labelEn: "push in",
    category: "movement",
    veo3Compatible: false,
    omniCompatible: true,
    aiHint: "Omni equivalent of dolly_in — more direct, conversational",
  },
  {
    value: "punch_in",
    labelVi: "Punch in (snap zoom)",
    labelEn: "punch in",
    category: "transition",
    veo3Compatible: false,
    omniCompatible: true,
    aiHint: "quick zoom for emphasis, comedic timing, reaction beats",
  },
  {
    value: "dolly_zoom",
    labelVi: "Dolly zoom (Vertigo)",
    labelEn: "dolly zoom",
    category: "specialty",
    veo3Compatible: false,
    omniCompatible: true,
    aiHint: "psychological tension, Hitchcock effect, disorientation",
  },
  {
    value: "smartphone_zoom",
    labelVi: "Smartphone zoom",
    labelEn: "natural smartphone zoom",
    category: "specialty",
    veo3Compatible: false,
    omniCompatible: true,
    aiHint: "vlog feel, found footage, social media aesthetic",
  },
  {
    value: "film_camera",
    labelVi: "Film camera (analog)",
    labelEn: "film camera",
    category: "specialty",
    veo3Compatible: false,
    omniCompatible: true,
    aiHint: "vintage analog feel, grain, retro cinematic",
  },
  {
    value: "webcam_style",
    labelVi: "Webcam style",
    labelEn: "webcam style",
    category: "specialty",
    veo3Compatible: false,
    omniCompatible: true,
    aiHint: "low-fi, intimate confessional, video diary",
  },
];

/** Auto-derived union type — TypeScript enforces exactly these 19 values */
export type CameraMovementValue = typeof CAMERA_MOVEMENT_OPTIONS[number]["value"];

/**
 * Return options filtered by target output mode.
 * Used in UI dropdown when user has selected a project-level mode preference.
 */
export function getOptionsForMode(mode: CameraMovementMode): CameraMovementOption[] {
  if (mode === "veo3") return CAMERA_MOVEMENT_OPTIONS.filter((o) => o.veo3Compatible);
  if (mode === "omni") return CAMERA_MOVEMENT_OPTIONS.filter((o) => o.omniCompatible);
  return CAMERA_MOVEMENT_OPTIONS;
}

/**
 * Get Vietnamese label for a stored value. Falls back to the raw value for
 * unknown / legacy values (e.g. "steadicam_smooth" from pre-r7.21 projects).
 */
export function getLabel(value: string): string {
  const opt = CAMERA_MOVEMENT_OPTIONS.find((o) => o.value === value);
  return opt?.labelVi ?? value;
}

/**
 * Get English term for prompt rendering. Falls back to formatted value
 * (snake_case → space-separated) for unknown values.
 */
export function getEnglishTerm(value: string): string {
  const opt = CAMERA_MOVEMENT_OPTIONS.find((o) => o.value === value);
  if (opt) return opt.labelEn;
  // Legacy fallback: "dolly_tracking" → "dolly tracking"
  return value.replace(/_/g, " ");
}

/** Whether the value is in the official 19-value list. */
export function isKnownValue(value: string): boolean {
  return CAMERA_MOVEMENT_OPTIONS.some((o) => o.value === value);
}

/** Get the option metadata or undefined if unknown. */
export function getOption(value: string): CameraMovementOption | undefined {
  return CAMERA_MOVEMENT_OPTIONS.find((o) => o.value === value);
}

/**
 * Generate AI prompt rules block listing all 19 values categorized by use case.
 * Used by filmShotListGeneration.ts to instruct AI when to pick which value.
 *
 * Mode-agnostic: AI sees all 19 options. Mode-specific filtering happens at
 * Copy Prompt time, not at AI shot list gen time.
 *
 * r7.27: Added FORBIDDEN COMBINATIONS section (hard constraints) to prevent
 * AI from picking nonsensical camera-action pairings (e.g. dolly_zoom on chase
 * scene, handheld on intimate whisper close-up). Keyword detection is
 * case-insensitive substring match on the shot's English action field.
 */
export function buildAiPromptRules(): string {
  const universal = CAMERA_MOVEMENT_OPTIONS.filter((o) => o.veo3Compatible && o.omniCompatible);
  const veoOnly = CAMERA_MOVEMENT_OPTIONS.filter((o) => o.veo3Compatible && !o.omniCompatible);
  const omniOnly = CAMERA_MOVEMENT_OPTIONS.filter((o) => !o.veo3Compatible && o.omniCompatible);

  return `⚡ CAMERA MOVEMENT VARIETY (CRITICAL):
- Pick from these 19 values. Both Veo3 and Omni terms are valid — mode rendering happens at Copy Prompt time, not shot list gen time.

UNIVERSAL (works everywhere):
${universal.map((o) => `  - "${o.value}": ${o.aiHint}`).join("\n")}

VEO3 TRADITIONAL:
${veoOnly.map((o) => `  - "${o.value}": ${o.aiHint}`).join("\n")}

OMNI-FRIENDLY (Gemini Omni native vocabulary):
${omniOnly.map((o) => `  - "${o.value}": ${o.aiHint}`).join("\n")}

RULES:
- DO NOT default to "static" for every shot — visual variety is essential
- ESTABLISHING shots: pan/tilt to reveal SPACE
- BUILD shots: tracking/dolly/push_in to follow motion
- PEAK shots: dolly_in OR push_in OR dolly_zoom for emotional weight
- ACTION shots: handheld/tracking for energy
- DIALOGUE shots: static OR locked_off for stability
- SPECIALTY moments: dolly_zoom for psychological tension, oner for immersive narrative, smartphone_zoom for vlog feel
- Aim for AT LEAST 3 different camera movements across the shot list

🚫 FORBIDDEN COMBINATIONS (camera-action mismatches — HARD constraints):
Apply BEFORE picking camera. If action text contains forbidden keywords for the candidate camera, pick a different camera.

- Action contains ANY of [run, sprint, chase, race, flee, dash, leap, jump, rush]
  → AVOID [dolly_zoom, push_in, punch_in, dolly_in]
  Reason: slow contemplative cameras + fast action = visual mismatch.
  Prefer instead: [handheld, tracking, pan_left, pan_right]

- Action contains ANY of [whisper, breathe, tear, gaze, intimate, sigh, kiss, hug, hold, weep, breath, stare]
  → AVOID [handheld, tracking, oner, smartphone_zoom]
  Reason: intimate moments need camera stability; motion breaks fragile emotion.
  Prefer instead: [static, locked_off, push_in, dolly_in]

- shotType = "wide_establishing"
  → AVOID [push_in, punch_in, dolly_zoom, dolly_in]
  Reason: close-up camera moves on wide framing produce no visual impact; the audience cannot read the motion at that scale.
  Prefer instead: [static, pan_left, pan_right, tilt_up, tilt_down, oner]

- Action describes a static object or environment (no character movement, no dialogue)
  → AVOID [handheld, tracking]
  Reason: handheld implies an observer's body following motion; without motion the camera looks shaky for no reason.
  Prefer instead: [static, locked_off, pan_left, pan_right, dolly_in, push_in]`;
}

/**
 * r7.27: Generate animation-style-specific camera vocabulary constraints.
 *
 * Different animation styles have different camera language signatures. Major
 * studios (Pixar / DreamWorks / Ghibli / Wes Anderson stop-motion / classic
 * noir) have established conventions that audiences read subconsciously. AI
 * shot list gen should respect these conventions to avoid producing footage
 * that "looks wrong" for the chosen style.
 *
 * Mappings sourced from filmmaker conventions:
 *   - cgi_3d_cinematic (Pixar/DreamWorks): controlled CGI camera — avoid
 *     handheld which reads as "low-budget on CGI". Prefer static, oner,
 *     push_in (Pixar Up opening), dolly_in (Inside Out close-ups).
 *   - anime_2d (Ghibli): pan/tilt heavy due to drawn-cel limitations.
 *     Dolly_zoom rarely used (requires complex geometry redraw).
 *   - stop_motion (Wes Anderson, Aardman): physical camera rig constraint.
 *     Tracking + oner extremely difficult; static + locked_off dominate.
 *   - film_noir: high-contrast lighting requires stable frame; tension via
 *     dolly_zoom for vertigo moments (Hitchcock signature).
 *   - cartoon_2d (Disney TV / Cartoon Network): simple camera language —
 *     pan/tilt for action, static for dialogue. Specialty Omni moves feel
 *     anachronistic.
 *   - live_action: full vocabulary available; smartphone_zoom adds vlog feel.
 *
 * Returns empty string if style is unknown — graceful degradation.
 */
export function buildStyleCameraConstraints(animationStyle?: string): string {
  if (!animationStyle) return "";

  const constraints: Record<string, { prefer: string[]; avoid: string[]; reason: string }> = {
    live_action: {
      prefer: ["tracking", "handheld", "smartphone_zoom", "static", "push_in"],
      avoid: [],
      reason:
        "Full camera vocabulary available. Smartphone_zoom OK for vlog/POV moments. No hard restrictions.",
    },
    cgi_3d_cinematic: {
      prefer: ["static", "oner", "push_in", "dolly_in", "tracking"],
      avoid: ["handheld", "smartphone_zoom", "webcam_style"],
      reason:
        "Pixar/DreamWorks CGI uses controlled camera moves. Handheld on CGI reads as low-budget shake — audiences expect smooth motion in 3D animation. Smartphone/webcam styles anachronistic for cinematic 3D.",
    },
    anime_2d: {
      prefer: ["pan_left", "pan_right", "tilt_up", "tilt_down", "static", "tracking"],
      avoid: ["dolly_zoom", "smartphone_zoom", "webcam_style"],
      reason:
        "Ghibli/anime relies on pan/tilt heavily (drawn-cel limitation makes complex moves expensive). Dolly_zoom requires geometry redraw rarely justified.",
    },
    cartoon_2d: {
      prefer: ["static", "pan_left", "pan_right", "tilt_up", "tilt_down"],
      avoid: ["dolly_zoom", "smartphone_zoom", "webcam_style", "oner", "punch_in"],
      reason:
        "Simple 2D cartoon camera language. Specialty Omni moves (oner, punch_in, dolly_zoom) feel anachronistic for traditional cartoon aesthetic.",
    },
    stop_motion: {
      prefer: ["static", "locked_off", "pan_left", "pan_right", "push_in"],
      avoid: ["tracking", "oner", "handheld", "smartphone_zoom"],
      reason:
        "Stop-motion has physical camera rig constraints — tracking/oner extremely difficult to execute frame-by-frame. Wes Anderson signature: static lockdown + occasional push_in.",
    },
    film_noir: {
      prefer: ["static", "dolly_zoom", "push_in", "locked_off", "dolly_in"],
      avoid: ["smartphone_zoom", "webcam_style", "handheld"],
      reason:
        "Classic noir requires stable frame for high-contrast lighting and shadow play. Dolly_zoom for Hitchcock-style vertigo/revelation. Modern camera styles (smartphone, webcam) anachronistic.",
    },
  };

  const c = constraints[animationStyle];
  if (!c) return "";

  return `🎬 STYLE-SPECIFIC CAMERA SIGNATURE — ${animationStyle.toUpperCase()}:
PREFER:  [${c.prefer.join(", ")}]
${c.avoid.length > 0 ? `AVOID:   [${c.avoid.join(", ")}]\n` : ""}REASON:  ${c.reason}

This is an ADDITIONAL filter on top of the variety + forbidden combinations above. When 2+ camera options are valid for a shot's rhythm role, pick the one in PREFER list.`;
}

/** All values as a flat string list — for AI JSON schema enum constraint. */
export const CAMERA_MOVEMENT_VALUES: readonly string[] = CAMERA_MOVEMENT_OPTIONS.map((o) => o.value);
