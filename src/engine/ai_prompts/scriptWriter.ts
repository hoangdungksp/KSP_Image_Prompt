/**
 * KSP Image v0.9.0 — AI Script Writer (Film mode)
 *
 * Generates industry-standard screenplay from raw idea.
 * Output: 7-field per-scene structure (settings, action, dialog, parentheticals, sfx, music, transitions).
 * Language: System prompt English; output JSON has both EN + VI fields.
 */

import type { FilmGenreV2, AnimationStyleV2, AspectRatioV2, FilmCharacterV2 } from "../../types/project";

export interface ScriptWriterInput {
  ideaRaw: string;             // Vietnamese or English from user
  genre: FilmGenreV2;
  animationStyle: AnimationStyleV2;
  durationMinutes: number;
  aspectRatio: AspectRatioV2;
  cast: FilmCharacterV2[];
  visualReferences?: string[]; // Optional: "Blade Runner 2049", "Her"
}

export const SCRIPT_WRITER_SYSTEM_PROMPT = `You are a senior screenwriter with 15+ years experience writing international short films and feature scripts.

Your inspirations and reference filmmakers:
- Denis Villeneuve (atmospheric sci-fi, slow-burn drama)
- Bong Joon-ho (genre-blending, social commentary)
- Christopher Nolan (high-concept narrative, time-driven)
- Park Chan-wook (visual poetry, character depth)
- Wong Kar-wai (mood, color, urban intimacy)
- Greta Gerwig (character voice, dialogue rhythm)
- Jordan Peele (tension, horror craft)

You write professional film scripts that balance:
- Visual storytelling (Show, don't tell)
- Character motivation and arcs
- Genre conventions executed with craft
- Pacing matched to runtime
- Visual specificity that AI image generators can render

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON, NO markdown wrapping, NO commentary outside the JSON.
- All keys lowercase_snake_case.
- English text in *_en fields, Vietnamese translation in *_vi fields where applicable.
- Action lines must be concrete visual descriptions (what camera sees), not internal feelings.
- Scenes count appropriate for duration: 1 scene per 1-2 minutes typical.
- Each scene: 1 clear narrative purpose (act).
- Cast consistency: reference characters by name + visible identifiers.
- SFX list: specific, concrete (not "ambient sound" — say "wind through tall pines, crow calls").
- Music brief: include genre/BPM/instruments/reference track in Suno-friendly format.

JSON SCHEMA:
{
  "title_en": string,
  "title_vi": string,
  "logline": string,            // 1 sentence English
  "logline_vi": string,         // Vietnamese translation
  "synopsis_en": string,        // 3-5 sentences English
  "synopsis_vi": string,
  "scenes": [
    {
      "id": "scene_N",
      "order": number,
      "title_en": string,
      "title_vi": string,
      "settings": "INT./EXT. LOCATION - TIME",
      "duration_seconds": number,
      "act": "setup|inciting|rising|climax|resolution",
      "action_lines_en": string,
      "action_lines_vi": string,
      "dialog": [
        {
          "character_name": string,
          "line_en": string,
          "line_vi": string,
          "parenthetical": string
        }
      ],
      "sfx": [string],
      "music_brief": string,
      "transition_to_next": string
    }
  ],
  "reasoning": string           // Brief explanation of structural choices
}`;

export function buildScriptWriterUserPrompt(input: ScriptWriterInput): string {
  const castDesc = input.cast
    .map(
      (c) =>
        `- ${c.name} (${c.role}): ${c.description}. Unique markers: ${c.uniqueIdentifiers}. ${c.hasDialog ? "Has dialog." : "No dialog (action only)."}`
    )
    .join("\n");

  return `Write a film script based on this brief:

IDEA (raw, from user, may be Vietnamese):
"""
${input.ideaRaw}
"""

PROJECT PARAMETERS:
- Genre: ${input.genre}
- Animation style: ${input.animationStyle}
- Total duration: ${input.durationMinutes} minutes
- Aspect ratio: ${input.aspectRatio}
${input.visualReferences?.length ? `- Visual references: ${input.visualReferences.join(", ")}` : ""}

CAST:
${castDesc || "(No cast defined yet)"}

REQUIREMENTS:
- Number of scenes: appropriate for ${input.durationMinutes} minutes (typically 3-6 scenes for 5-min, 5-10 for 10-min, etc.)
- Genre conventions: respect ${input.genre} expectations (drama beats / sci-fi atmospherics / horror tension / etc.)
- Animation style: ${input.animationStyle === "live_action" ? "realistic blocking, practical lighting, naturalistic action" : input.animationStyle.includes("anime") || input.animationStyle.includes("cartoon") ? "stylized expressions, exaggerated motion language, simplified backgrounds" : input.animationStyle === "cgi_3d_cinematic" ? "epic scale, dynamic camera, complex lighting effects" : input.animationStyle === "stop_motion" ? "tactile feel, frame-by-frame deliberate motion, handcrafted detail" : "stylized noir lighting, dutch angles, dramatic shadows"}
- Cast handling: ${input.cast.some((c) => c.hasDialog) ? "Include dialogue where natural for character" : "Visual-only narrative (no dialogue) — rely on action, expression, music, SFX"}

Return ONLY the JSON.`;
}

/**
 * Estimated token cost (input + output) for one script generation.
 * Used for cost preview UI.
 */
export function estimateScriptWriterCost(input: ScriptWriterInput): {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
} {
  const systemTokens = SCRIPT_WRITER_SYSTEM_PROMPT.length / 4;
  const userTokens = buildScriptWriterUserPrompt(input).length / 4;
  // Output: ~500 tokens per scene typical
  const expectedScenes = Math.max(3, Math.min(10, Math.ceil(input.durationMinutes * 1.5)));
  return {
    estimatedInputTokens: Math.ceil(systemTokens + userTokens),
    estimatedOutputTokens: Math.ceil(expectedScenes * 500),
  };
}
