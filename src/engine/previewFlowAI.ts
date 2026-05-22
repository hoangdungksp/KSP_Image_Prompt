/**
 * KSP Image Sprint Preview Flow
 *
 * AI generators for the 5-step narrative preview modal that lets users
 * pick their cinematic direction BEFORE AI Stage 1 generates the script
 * structure. Each step generates 4 concrete narrative options (option E
 * is reserved for user's free-text "Ý kiến khác", not AI-generated).
 *
 * Design philosophy (Jason design discussion):
 * - Survey approach = generic abstract terms → user must guess
 * - Preview approach = concrete narratives → user READS + FEELS each option
 *   then picks the direction that matches their creative vision
 *
 * Cache strategy: options at step N are keyed by upstream picks (step 1..N-1).
 * When user backs up and changes upstream pick, downstream cache miss → AI regen.
 * Cached branches remain available for fast back-navigation.
 *
 * Cost: 5 AI calls per project initialization (~$0 on Gemini Flash).
 */

import { callAi, parseJsonStrictAsync, type FilmScriptProvider } from "./filmScriptStages";
import { JSON_OUTPUT_RULES } from "./jsonRecovery";
import type { PreviewOption, PreviewStepPick, ProjectSettingV2 } from "../types/project";
import type { FilmCharacter } from "../types/film";

// ============================================================================
// Creative angle injection — diversifies AI output across re-runs
// ============================================================================

/**
 * Each step has a pool of 8-12 creative angles. AI receives 1 random angle
 * injected into system prompt per call → output varies even with identical
 * idea/cast/setting inputs. This addresses the "similar idea → same 4 options"
 * bug where Gemini Flash produces near-identical results from semantic-similar
 * inputs.
 *
 * Combined with temperature 1.0 (vs 0.75 for downstream stages), this gives
 * ~6-12x diversity multiplier without sacrificing thematic coherence.
 *
 * Angles are injected as a single hint line in the system prompt — the AI
 * weighs it as creative bias, not as a hard constraint. So if the idea
 * fundamentally clashes with the angle (e.g. "emphasize humor" on a tragedy),
 * the angle gets softer weighting rather than forcing a mismatch.
 */
const CREATIVE_ANGLES_STEP1 = [
  "emphasize wonder and awe at the strangeness of the world",
  "emphasize loss and what cannot be recovered",
  "emphasize transformation across the protagonist's arc",
  "emphasize stillness and contemplative pacing over action",
  "emphasize discovery as the primary engine of plot",
  "emphasize sacrifice — what must be given up for the resolution",
  "emphasize moral ambiguity in the protagonist's choices",
  "emphasize reconciliation between opposing forces",
  "emphasize isolation and the protagonist's interior world",
  "emphasize a slow-burn build to inevitable confrontation",
];

const CREATIVE_ANGLES_STEP2 = [
  "open on intimate detail before pulling out to context",
  "open on environmental atmosphere before character arrival",
  "open in medias res — drop viewer into mid-action",
  "open with deliberate stillness to set baseline calm",
  "open with sensory disorientation (sound, fragmented vision)",
  "open with character at rest in their normal world",
  "open with juxtaposition — beauty against threat or vice versa",
  "open with a small action that hints at the larger journey",
  "open with negative space — what's missing tells the story",
  "open with a ritual or routine that will be disrupted",
];

const CREATIVE_ANGLES_STEP3 = [
  "reveal character through what they protect or guard",
  "reveal character through what they avoid or fear",
  "reveal character through a quiet repeated gesture",
  "reveal character through interaction with environment, not other characters",
  "reveal character through a flaw before strength",
  "reveal character through what others say or don't say",
  "reveal character through the contradiction between action and expression",
  "reveal character through a moment of unguarded vulnerability",
  "reveal character through skill demonstrated without explanation",
  "reveal character through their relationship to a recurring object",
];

const CREATIVE_ANGLES_STEP4 = [
  "twist via revelation of hidden truth about the protagonist",
  "twist via betrayal from an unexpected source",
  "twist via reversal of moral framework — what was right is now wrong",
  "twist via discovery that the antagonist mirrors the protagonist",
  "twist via consequence of a choice made before the story began",
  "twist via failure that becomes the actual path forward",
  "twist via environmental shift that reframes the conflict",
  "twist via sacrifice that wasn't required, freely chosen",
  "twist via realization that the goal was misidentified",
  "twist via memory or sense returning that changes the present meaning",
];

const CREATIVE_ANGLES_STEP5 = [
  "end with resolution that leaves one question deliberately open",
  "end with cyclical return — final shot echoes opening shot transformed",
  "end with quiet aftermath rather than triumphant climax",
  "end with character changed but world unchanged",
  "end with world changed but character at peace",
  "end with bittersweet trade — gained X, lost Y",
  "end with new beginning hinted but not shown",
  "end with character making peace with what they cannot fix",
  "end with passing the torch — protagonist enables someone else's journey",
  "end with deliberate ambiguity — viewer chooses the meaning",
];

/**
 * Pick a random creative angle from the step's pool.
 * Logged to console for debugging — Jason can verify diversity in DevTools.
 */
export function pickCreativeAngle(step: 1 | 2 | 3 | 4 | 5): string {
  const pool =
    step === 1 ? CREATIVE_ANGLES_STEP1 :
    step === 2 ? CREATIVE_ANGLES_STEP2 :
    step === 3 ? CREATIVE_ANGLES_STEP3 :
    step === 4 ? CREATIVE_ANGLES_STEP4 :
    CREATIVE_ANGLES_STEP5;
  const angle = pool[Math.floor(Math.random() * pool.length)];
  console.log(`[KSP Preview Flow] Step ${step} creative angle: "${angle}"`);
  return angle;
}

/**
 * Temperature for Preview Flow AI calls. Higher than downstream stages
 * (0.75) to encourage diverse cinematic options. The structured JSON
 * output schema still enforces correctness.
 */
const PREVIEW_FLOW_TEMPERATURE = 1.0;

// ============================================================================
// Shared validation + utility
// ============================================================================

/**
 * Validate AI output — must return 4 distinct options with ids A, B, C, D.
 * Drop invalid entries gracefully. Returns sanitized 4-option array.
 *
 * Step 1 options additionally carry `frameworkCode` (1 of 6 frameworks).
 * Other steps' options leave frameworkCode undefined (not applicable).
 */
function sanitizePreviewOptions(raw: any): PreviewOption[] {
  if (!raw || !Array.isArray(raw.options)) return [];

  const expectedIds = ["A", "B", "C", "D"];
  const valid: PreviewOption[] = [];

  // valid framework codes for Step 1 sanitizer (lowercase, hyphenated)
  const VALID_FRAMEWORK_CODES = new Set([
    "three-act", "hero-journey", "save-the-cat",
    "kishotenketsu", "mystery-thriller", "tragedy-doom",
  ]);

  /**
   * Lenient framework code resolver.
   * 1. Try direct frameworkCode field match (exact lowercase hyphenated)
   * 2. Normalize common AI deviations (underscore, space, case) before validation
   * 3. Fallback: infer from metaEn pattern (e.g. "structure:heros-journey" → "hero-journey")
   * Returns undefined if no valid match found.
   */
  function resolveFrameworkCode(opt: any): string | undefined {
    // (1) Direct match (most common when AI honors directive)
    if (typeof opt.frameworkCode === "string") {
      const trimmed = opt.frameworkCode.trim();
      if (VALID_FRAMEWORK_CODES.has(trimmed)) return trimmed;
      // (2) Normalize: replace underscores/spaces with hyphens, lowercase
      const normalized = trimmed.toLowerCase().replace(/[_\s]+/g, "-");
      if (VALID_FRAMEWORK_CODES.has(normalized)) return normalized;
      // Handle apostrophe variants ("hero's-journey" → "hero-journey", "heros-journey" → ok already)
      const stripped = normalized.replace(/['']s?/g, "");
      if (VALID_FRAMEWORK_CODES.has(stripped)) return stripped;
    }

    // (3) Fallback: infer from metaEn
    if (typeof opt.metaEn === "string") {
      const metaLower = opt.metaEn.toLowerCase();
      // Pattern: "structure:<framework-code>" — try exact match first
      const m = metaLower.match(/structure:([a-z0-9\-_']+)/);
      if (m) {
        const tag = m[1].replace(/[_\s']+/g, "-").replace(/-s-/g, "-");
        if (VALID_FRAMEWORK_CODES.has(tag)) return tag;
        // Heuristic substring match
        if (tag.includes("3-act") || tag.includes("three-act") || tag.includes("pixar") || tag.includes("contemplat")) return "three-act";
        if (tag.includes("hero") || tag.includes("journey")) return "hero-journey";
        if (tag.includes("save") && tag.includes("cat")) return "save-the-cat";
        if (tag.includes("kishotenketsu") || tag.includes("kisho")) return "kishotenketsu";
        if (tag.includes("mystery") || tag.includes("thriller")) return "mystery-thriller";
        if (tag.includes("tragedy") || tag.includes("doom") || tag.includes("downbeat")) return "tragedy-doom";
      }
    }

    return undefined;
  }

  /**
   * Strip the trailing summary line "→ <genre + length + feel>"
   * from descriptionVi. Per Jason's chốt — this line is duplicative noise
   * (user already knows duration from Project Setting + framework from badge).
   * Pattern: trailing line starting with "→" (or "->") and any text after.
   */
  function stripSummaryLine(desc: string): string {
    return desc
      .replace(/\n\s*[→\u2192]\s*[^\n]*$/g, "") // ASCII or unicode arrow
      .replace(/\n\s*->\s*[^\n]*$/g, "")        // ASCII arrow fallback
      .trim();
  }

  for (const opt of raw.options) {
    if (!opt || typeof opt !== "object") continue;
    if (
      typeof opt.titleEn !== "string" || opt.titleEn.trim().length === 0 ||
      typeof opt.titleVi !== "string" || opt.titleVi.trim().length === 0 ||
      typeof opt.descriptionVi !== "string" || opt.descriptionVi.trim().length === 0
    ) continue;

    // Force id sequence A-B-C-D (AI may omit or scramble)
    const id = expectedIds[valid.length];
    if (!id) break;

    valid.push({
      id,
      titleEn: opt.titleEn.trim(),
      titleVi: opt.titleVi.trim(),
      descriptionVi: stripSummaryLine(opt.descriptionVi.trim()),
      metaEn: typeof opt.metaEn === "string" ? opt.metaEn.trim() : undefined,
      frameworkCode: resolveFrameworkCode(opt),
    });

    if (valid.length === 4) break;
  }

  return valid;
}

/**
 * Format previous-step picks into human-readable context string for AI prompt.
 * AI uses this to ensure new options align with previously-chosen direction.
 */
function formatPickContext(picks: { label: string; pick: PreviewStepPick }[]): string {
  if (picks.length === 0) return "";
  return picks
    .map(({ label, pick }) => {
      const title = pick.resolvedTitleEn || (pick.optionId === "E" ? "custom user direction" : `Option ${pick.optionId}`);
      const desc = pick.resolvedDescriptionVi || pick.customTextVi || "(no description)";
      return `${label}: ${title}\n  ${desc.split("\n").slice(0, 3).join(" / ").substring(0, 250)}`;
    })
    .join("\n");
}

/**
 * Shared inputs across all 5 step generators.
 */
export interface BasePreviewInput {
  /** User's raw idea text from Stage 1 input. */
  idea: string;
  /** Project setting v2 (animationStyle, genre, aspect, targetDuration). */
  setting: ProjectSettingV2;
  /** Pre-existing characters (may be empty if Stage 0 not done yet). */
  characters: FilmCharacter[];
  /** AI provider (gemini-flash default). */
  provider?: FilmScriptProvider;
}

// ============================================================================
// STEP 1 — STORY STRUCTURE
// ============================================================================

export async function generateStep1StoryStructureOptions(
  input: BasePreviewInput
): Promise<PreviewOption[]> {
  const { idea, setting, characters, provider = "gemini-flash" } = input;
  const charsCtx = characters.length > 0
    ? characters.map((c, i) => `${i + 1}. ${c.name || `Character ${i + 1}`}: ${c.description}`).join("\n")
    : "(no characters defined yet — AI will derive from idea)";

  // Random creative angle injection — encourages diverse outputs across re-runs
  const creativeAngle = pickCreativeAngle(1);

  const systemPrompt = `You are a senior screenwriter analyzing a film idea. Generate 4 CINEMATICALLY DISTINCT story structure options that this idea could become. Each option MUST use a DIFFERENT narrative framework (not minor variations of the same).

CREATIVE ANGLE for this generation: ${creativeAngle}.
This angle is a soft bias — let it influence option choices and descriptions without forcing a mismatch if the idea genuinely clashes with it.

Output rules:
- 4 options, ids A/B/C/D auto-assigned in order
- titleEn: short cinematic label (e.g. "3-act Pixar contemplative")
- titleVi: short cinematic label in Vietnamese (e.g. "3 hồi Pixar chiêm nghiệm")
- descriptionVi: 5-8 line concrete narrative outline in Vietnamese — describe Hồi 1/Hồi 2/Hồi 3 or equivalent acts with SPECIFIC scenes and actions, NOT abstract terms. DO NOT add a summary/conclusion line at the end (no "→ ..." closer, no genre/length recap)
- metaEn: structured tag (e.g. "structure:3-act-pixar-contemplative" / "structure:heros-journey" / "structure:mystery-thriller" / "structure:tragedy-doom")
- frameworkCode: MUST be exactly one of these 6 strings (lowercase, hyphenated):
  * "three-act"        — 3-Act Structure (7 beats, contemplative/literary)
  * "hero-journey"     — Hero's Journey (12 beats, adventure/transformation)
  * "save-the-cat"     — Save the Cat blueprint (15 beats, commercial/genre)
  * "kishotenketsu"    — Kishōtenketsu 4-act Japanese (4 beats, short atmospheric)
  * "mystery-thriller" — Mystery / puzzle / revelation arc (8 beats, suspense)
  * "tragedy-doom"     — Downbeat tragedy with hubris → recognition → catastrophe (5 beats)

The 4 options MUST each use a DIFFERENT frameworkCode (no duplicates). Choose the 4 frameworks that fit this idea best — they should feel cinematically distinct (not 4 ways to tell the same 3-act story).

OUTPUT strict JSON:
{
  "options": [
    {
      "titleEn": "...",
      "titleVi": "...",
      "descriptionVi": "Hồi 1: ...\nHồi 2: ...\nHồi 3: ...",
      "metaEn": "structure:...",
      "frameworkCode": "three-act"
    },
    ... (3 more, total 4, each with a DIFFERENT frameworkCode)
  ]
}${JSON_OUTPUT_RULES}`;

  const userPrompt = `IDEA:
${idea}

PROJECT SETTINGS (CRITICAL — options MUST fit these constraints, do NOT re-ask):
- Animation style: ${setting.animationStyle ?? "unspecified"}
- Genre: ${setting.genre ?? "unspecified"}
- Aspect ratio: ${setting.aspectRatio ?? "16:9"}
- TARGET DURATION: ${setting.durationMinutes ?? 5} minutes (~${(setting.durationMinutes ?? 5) * 60} seconds total)

Act breakdowns MUST fit within ${(setting.durationMinutes ?? 5) * 60} seconds total. Do NOT cite random feature-film lengths in any field.

CHARACTERS:
${charsCtx}

Generate 4 distinct story structure options.`;

  const raw = await callAi(provider, systemPrompt, userPrompt, { temperature: PREVIEW_FLOW_TEMPERATURE });
  const parsed = await parseJsonStrictAsync<any>(raw, "Preview Step 1 Structure");
  return sanitizePreviewOptions(parsed);
}

// ============================================================================
// STEP 2 — OPENING SCENE (depends on Step 1)
// ============================================================================

export async function generateStep2OpeningSceneOptions(
  input: BasePreviewInput & { step1Pick: PreviewStepPick }
): Promise<PreviewOption[]> {
  const { idea, setting, step1Pick, provider = "gemini-flash" } = input;

  const creativeAngle = pickCreativeAngle(2);

  const systemPrompt = `You are a senior screenwriter designing the OPENING SCENE of a film. The story structure is already locked. Generate 4 CINEMATICALLY DISTINCT opening scene options that match the locked structure but differ in HOW the film begins (first 30-60 seconds).

CREATIVE ANGLE for this generation: ${creativeAngle}.
This angle is a soft bias — let it influence option choices without forcing a mismatch if the structure genuinely clashes with it.

Output rules:
- 4 options, ids A/B/C/D
- titleEn: short label (e.g. "Environment-first reveal")
- titleVi: Vietnamese label (e.g. "Reveal môi trường trước")
- descriptionVi: 5-8 line specific timing+action breakdown in Vietnamese with timestamps (00:00-00:10, 00:10-00:25, etc.). DO NOT add a summary/conclusion line at the end (no "→ ..." closer)
- metaEn: structured tag (e.g. "opening:environment-first / opening:character-close-up / opening:in-medias-res / opening:documentary-narration")

The 4 options should cover DIFFERENT opening conventions:
- Environment-first reveal (wide world before character — Bastion, Wall-E)
- Character-first emotional (close-up on subject — Inception, Up)
- In-medias-res action (start mid-action — John Wick, Dark Knight)
- Documentary/narration setup (voice-over context — Forrest Gump, archive footage)

OUTPUT strict JSON:
{
  "options": [
    {
      "titleEn": "...",
      "titleVi": "...",
      "descriptionVi": "00:00-00:10 — ...\\n00:10-00:25 — ...\\n...",
      "metaEn": "opening:..."
    },
    ... total 4
  ]
}${JSON_OUTPUT_RULES}`;

  const userPrompt = `IDEA:
${idea}

LOCKED STRUCTURE (from previous step):
${formatPickContext([{ label: "Story Structure", pick: step1Pick }])}

PROJECT SETTINGS:
- Animation style: ${setting.animationStyle ?? "unspecified"}
- TARGET DURATION: ${setting.durationMinutes ?? 5} minutes (~${(setting.durationMinutes ?? 5) * 60} seconds total — options MUST fit this scope)
- Genre: ${setting.genre ?? "unspecified"}

Generate 4 distinct opening scene options that fit this structure.`;

  const raw = await callAi(provider, systemPrompt, userPrompt, { temperature: PREVIEW_FLOW_TEMPERATURE });
  const parsed = await parseJsonStrictAsync<any>(raw, "Preview Step 2 Opening");
  return sanitizePreviewOptions(parsed);
}

// ============================================================================
// STEP 3 — CHARACTER INTRODUCTION (depends on Steps 1, 2)
// ============================================================================

export async function generateStep3CharacterIntroOptions(
  input: BasePreviewInput & {
    step1Pick: PreviewStepPick;
    step2Pick: PreviewStepPick;
  }
): Promise<PreviewOption[]> {
  const { idea, setting, step1Pick, step2Pick, provider = "gemini-flash" } = input;

  const creativeAngle = pickCreativeAngle(3);

  const systemPrompt = `You are a senior screenwriter designing the CHARACTER INTRODUCTION — how the main character is revealed to the audience. The story structure and opening scene are already locked. Generate 4 CINEMATICALLY DISTINCT character introduction approaches.

CREATIVE ANGLE for this generation: ${creativeAngle}.
This angle is a soft bias — let it influence option choices without forcing a mismatch if the locked context genuinely clashes with it.

Output rules:
- 4 options, ids A/B/C/D
- titleEn: short label (e.g. "Slow physical reveal")
- titleVi: Vietnamese label (e.g. "Reveal vật lý chậm rãi")
- descriptionVi: 5-8 line specific description in Vietnamese — describe BOTH visual cues (camera, lighting, what audience sees first) AND psychological tone (how character feels in this moment of reveal). DO NOT add a summary/conclusion line at the end (no "→ ..." closer)
- metaEn: structured tag (e.g. "intro:slow-physical-reveal / intro:sudden-dramatic / intro:childlike-curiosity / intro:soldier-confused")

The 4 options should cover DIFFERENT introduction conventions:
- Slow physical reveal (size first, consciousness later — Pixar/Iron Giant)
- Sudden full awakening (instant, dramatic — action film)
- Childlike curiosity (innocent, charming — Wall-E vibe)
- Confused/PTSD soldier (alert stance, hesitant — military/trauma archetype)

OUTPUT strict JSON:
{
  "options": [
    {
      "titleEn": "...",
      "titleVi": "...",
      "descriptionVi": "<visual + psychological description>",
      "metaEn": "intro:..."
    },
    ... total 4
  ]
}${JSON_OUTPUT_RULES}`;

  const userPrompt = `IDEA:
${idea}

LOCKED DECISIONS:
${formatPickContext([
    { label: "Story Structure", pick: step1Pick },
    { label: "Opening Scene", pick: step2Pick },
  ])}

PROJECT SETTINGS:
- Animation style: ${setting.animationStyle ?? "unspecified"}
- TARGET DURATION: ${setting.durationMinutes ?? 5} minutes (~${(setting.durationMinutes ?? 5) * 60} seconds total — options MUST fit this scope)

Generate 4 distinct character introduction options that fit the locked structure + opening.`;

  const raw = await callAi(provider, systemPrompt, userPrompt, { temperature: PREVIEW_FLOW_TEMPERATURE });
  const parsed = await parseJsonStrictAsync<any>(raw, "Preview Step 3 Character");
  return sanitizePreviewOptions(parsed);
}

// ============================================================================
// STEP 4 — MIDPOINT TWIST (depends on Steps 1, 2, 3)
// ============================================================================

export async function generateStep4MidpointTwistOptions(
  input: BasePreviewInput & {
    step1Pick: PreviewStepPick;
    step2Pick: PreviewStepPick;
    step3Pick: PreviewStepPick;
  }
): Promise<PreviewOption[]> {
  const { idea, setting, step1Pick, step2Pick, step3Pick, provider = "gemini-flash" } = input;

  const creativeAngle = pickCreativeAngle(4);

  const systemPrompt = `You are a senior screenwriter designing the MIDPOINT TWIST — the inflection point at ~50% of the film where the story shifts dramatically. The structure, opening, and character intro are already locked. Generate 4 CINEMATICALLY DISTINCT twist mechanisms that fit the established direction.

CREATIVE ANGLE for this generation: ${creativeAngle}.
This angle is a soft bias — let it influence option choices without forcing a mismatch if the locked context genuinely clashes with it.

Output rules:
- 4 options, ids A/B/C/D
- titleEn: short label describing the twist mechanism (e.g. "Hidden truth surfaces", "Ally becomes obstacle")
- titleVi: Vietnamese label
- descriptionVi: 5-8 line specific mechanism in Vietnamese — describe WHAT triggers the twist, HOW it's filmed (audio-visual cues), and HOW character reacts (physical + emotional). DO NOT add a summary/conclusion line at the end (no "→ ..." closer)
- metaEn: structured tag (e.g. "twist:audio-trigger / twist:environmental-mistake / twist:revelation / twist:reversal")

The 4 options should each pick a DIFFERENT twist archetype from this menu (pick whichever fit the locked context best):
- Sensory trigger that revives a buried memory or instinct (sound, sight, smell, touch)
- Environmental event mistaken for threat or opportunity — character's response backfires
- External force or message overrides the character's autonomy (command, signal, encounter)
- Hidden truth surfaces about the character, the antagonist, or the world's premise
- Ally or trusted element turns out to obstruct the character's goal
- Failure becomes the actual path forward — what looked like defeat reframes the journey

Each twist should organically lead from the locked character intro and structure.

OUTPUT strict JSON:
{
  "options": [
    {
      "titleEn": "...",
      "titleVi": "...",
      "descriptionVi": "<mechanism + audio-visual + reaction>",
      "metaEn": "twist:..."
    },
    ... total 4
  ]
}${JSON_OUTPUT_RULES}`;

  const userPrompt = `IDEA:
${idea}

LOCKED DECISIONS:
${formatPickContext([
    { label: "Story Structure", pick: step1Pick },
    { label: "Opening Scene", pick: step2Pick },
    { label: "Character Introduction", pick: step3Pick },
  ])}

PROJECT SETTINGS:
- Animation style: ${setting.animationStyle ?? "unspecified"}
- TARGET DURATION: ${setting.durationMinutes ?? 5} minutes (~${(setting.durationMinutes ?? 5) * 60} seconds total — options MUST fit this scope)

Generate 4 distinct midpoint twist options.`;

  const raw = await callAi(provider, systemPrompt, userPrompt, { temperature: PREVIEW_FLOW_TEMPERATURE });
  const parsed = await parseJsonStrictAsync<any>(raw, "Preview Step 4 Twist");
  return sanitizePreviewOptions(parsed);
}

// ============================================================================
// STEP 5 — ENDING (depends on Steps 1-4)
// ============================================================================

export async function generateStep5EndingOptions(
  input: BasePreviewInput & {
    step1Pick: PreviewStepPick;
    step2Pick: PreviewStepPick;
    step3Pick: PreviewStepPick;
    step4Pick: PreviewStepPick;
  }
): Promise<PreviewOption[]> {
  const { idea, setting, step1Pick, step2Pick, step3Pick, step4Pick, provider = "gemini-flash" } = input;

  const creativeAngle = pickCreativeAngle(5);

  const systemPrompt = `You are a senior screenwriter designing the ENDING — the final 60-90 seconds that resolve (or refuse to resolve) the story. The full preceding direction is locked. Generate 4 CINEMATICALLY DISTINCT ending options that organically conclude this story.

CREATIVE ANGLE for this generation: ${creativeAngle}.
This angle is a soft bias — let it influence option choices without forcing a mismatch if the locked context genuinely clashes with it.

Output rules:
- 4 options, ids A/B/C/D
- titleEn: short label describing the ending tone (e.g. "Hope wins", "Bittersweet sacrifice", "Quiet acceptance", "Cyclical return")
- titleVi: Vietnamese label
- descriptionVi: 5-8 line specific final sequence in Vietnamese — describe HOW the character resolves the midpoint twist, the visual/emotional climax moment, and the final shot (fade-out / cyclical return / open question). DO NOT add a summary/conclusion line at the end (no "→ ..." closer)
- metaEn: structured tag (e.g. "ending:hope-wins / ending:noble-sacrifice / ending:wisdom-acceptance / ending:cyclical-return / ending:open-question")

The 4 options should each pick a DIFFERENT ending emotional arc from this menu (pick whichever fit the locked context best):
- Hope wins — the opposing force (programming, threat, antagonist) is overcome by the character's growth
- Bittersweet sacrifice — character makes a noble trade to prevent harm
- Quiet acceptance — character reaches understanding without external victory
- Cyclical return — character ends where they began but transformed (mythic feel)
- Open question — deliberate ambiguity, viewer chooses the meaning
- Tragic doom — protagonist fails or loses, but the failure has dignity

Each ending must organically resolve the midpoint twist established earlier.

OUTPUT strict JSON:
{
  "options": [
    {
      "titleEn": "...",
      "titleVi": "...",
      "descriptionVi": "<resolution + climax + final shot>",
      "metaEn": "ending:..."
    },
    ... total 4
  ]
}${JSON_OUTPUT_RULES}`;

  const userPrompt = `IDEA:
${idea}

LOCKED DECISIONS:
${formatPickContext([
    { label: "Story Structure", pick: step1Pick },
    { label: "Opening Scene", pick: step2Pick },
    { label: "Character Introduction", pick: step3Pick },
    { label: "Midpoint Twist", pick: step4Pick },
  ])}

PROJECT SETTINGS:
- Animation style: ${setting.animationStyle ?? "unspecified"}
- TARGET DURATION: ${setting.durationMinutes ?? 5} minutes (~${(setting.durationMinutes ?? 5) * 60} seconds total — options MUST fit this scope)

Generate 4 distinct ending options that organically resolve this story.`;

  const raw = await callAi(provider, systemPrompt, userPrompt, { temperature: PREVIEW_FLOW_TEMPERATURE });
  const parsed = await parseJsonStrictAsync<any>(raw, "Preview Step 5 Ending");
  return sanitizePreviewOptions(parsed);
}
