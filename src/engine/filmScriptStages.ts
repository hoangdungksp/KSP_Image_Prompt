/**
 * KSP Image v0.9.3-r3 — Film Script Stages Engine
 *
 * Wrapper around existing `aiRuntime.generateFilmScript()` to bridge the new
 * Film v0.9.3 schema (FilmCharacter, FilmV093Data) with the legacy ScriptWriterInput
 * (FilmCharacterV2 shape).
 *
 * r3 ships Stage 5 quick path (1-cú generation full script).
 * Multi-stage wizard (Stage 1-4: Structure → Beats → Twists → Scenes) lands in r7.
 *
 * Reference: MOCKUPS_FILM.md Q2 (Multi-stage 5 stages) + scriptWriter.ts existing.
 */

import { generateFilmScript } from "./aiRuntime";
import type { ScriptWriterInput } from "./ai_prompts/scriptWriter";
import type { FilmScript, FilmCharacterV2, CharacterRef, ProjectSettingV2 } from "../types/v0_9_0";
import type { FilmCharacter } from "../types/film_v093";

export type FilmScriptProvider = "gemini-flash" | "openai-4o";

/**
 * Adapt new v0.9.3 FilmCharacter → legacy FilmCharacterV2 shape so existing
 * scriptWriter.ts prompts continue to work without rewrite.
 * AI uses cast for narrative context (name + description) — refs not consumed
 * by script writer, so we pass minimal shape.
 */
function adaptCharacter(c: FilmCharacter, hasDialog: boolean): FilmCharacterV2 {
  // Map new roles to legacy enum (legacy doesn't have "companion" — use "supporting")
  const legacyRole: FilmCharacterV2["role"] =
    c.role === "companion" ? "supporting" : (c.role as FilmCharacterV2["role"]);

  return {
    id: c.id,
    order: c.order,
    name: c.name || `Character ${c.order}`,
    role: legacyRole,
    description: c.description,
    uniqueIdentifiers: c.aiGenDescription ?? "",
    hasDialog,
    // Refs not used by script writer prompt, pass empty
    faceRefs: [] as CharacterRef[],
    bodyRefs: [] as CharacterRef[],
  };
}

export interface RunStage5QuickInput {
  idea: string;
  setting: ProjectSettingV2;
  characters: FilmCharacter[];
  provider?: FilmScriptProvider;
}

/**
 * Stage 5 quick path: 1-cú AI generation of full script with scenes containing
 * SFX/MUSIC/TRANSITION/DIALOG inline.
 *
 * Future: r7 will add wrapper functions `runStage1Structure`, `runStage2Beats`, etc.
 * for multi-stage wizard with user review between stages.
 */
export async function runStage5Quick(
  input: RunStage5QuickInput
): Promise<FilmScript> {
  const { idea, setting, characters, provider = "gemini-flash" } = input;

  const hasDialog = (setting.dialog ?? "no_dialog") === "has_dialog";

  // Map cast → legacy shape
  const cast: FilmCharacterV2[] = characters.map((c) => adaptCharacter(c, hasDialog));

  const writerInput: ScriptWriterInput = {
    ideaRaw: idea.trim(),
    genre: setting.genre ?? "drama",
    animationStyle: setting.animationStyle ?? "live_action",
    durationMinutes: setting.durationMinutes ?? 5,
    aspectRatio: setting.aspectRatio,
    cast,
  };

  const { script } = await generateFilmScript(writerInput, provider);

  // If dialog mode = "no_dialog", strip out any dialog lines AI may have generated
  // (some AI providers ignore the hasDialog hint and produce dialog anyway)
  if (!hasDialog) {
    script.scenes = script.scenes.map((s) => ({ ...s, dialog: [] }));
  }

  return script;
}
