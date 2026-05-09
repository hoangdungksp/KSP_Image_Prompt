/**
 * KSP Image v0.9.0 — AI Prompts central export
 *
 * 7 templates covering all AI generations in v0.9.0:
 * 1. Script Writer (Film mode)
 * 2. Concept Writer (TVC mode)
 * 3. Storyboard Shots Generator (per Scene → 2-4 shots)
 * 4. Frames Auto-Derive (per Shot → N frames)
 * 5. Single Frame Regen (1 frame, with continuity)
 * 6. Music Brief Generator (per Scene → Suno prompt)
 * 7. Voice Script Generator (dialog + narrator)
 * + Image gen prompt builders (character refs, shot grids)
 *
 * All system prompts: ENGLISH (Q3 confirmed — international cinema)
 * Output schemas: bilingual (en + vi fields where applicable)
 */

export * from "./scriptWriter";
export * from "./conceptWriter";
export * from "./storyboardGenerators";
export * from "./musicVoiceImage";
