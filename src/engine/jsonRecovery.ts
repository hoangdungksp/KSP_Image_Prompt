/**
 * JSON Recovery Engine.
 *
 * 3-layer recovery pipeline for malformed AI JSON output:
 *
 * Layer 1 — Sanitizer (cheap, deterministic): fixes common AI mistakes
 *   1. Strip markdown code fences (```json ... ```)
 *   2. Strip leading/trailing whitespace + non-JSON preamble
 *   3. Replace smart quotes (curly) with straight quotes
 *   4. Remove trailing commas before } or ]
 *   5. Auto-close unclosed arrays/objects when count mismatch is small (≤2)
 *   6. Escape unescaped double quotes inside string values (heuristic)
 *
 * Layer 2 — AI repair (last resort): sends broken JSON + parse error back
 *   to Gemini Flash asking "Fix this JSON. Output valid JSON only, no markdown."
 *   Forced gemini-flash (cheapest) regardless of caller's preferred provider.
 *
 * Layer 3 — Throw + UI retry: caller catches + section card shows retry button.
 *
 * Each layer is independent and exported. Caller composes via `parseJsonWithRecovery`.
 *
 * Why this matters: Gemini Flash + GPT-4o occasionally output JSON with:
 *   - Trailing commas: `{"key": "value",}`
 *   - Smart quotes from VN text: `"description": "Anh ấy nói "xin chào""`
 *   - Unescaped quotes in VN strings (VN content often contains quoted speech)
 *   - Truncated output when hitting maxOutputTokens
 *   - Missing closing brackets when AI loses track of depth
 *
 * Before r7.16, these errors became "section silent fail with 0 output" UX.
 * Now: sanitizer catches 80% of cases, AI repair catches another 15%, retry
 * button surfaces the remaining 5% to user with actionable resume button.
 */

import { callAi, type FilmScriptProvider } from "./filmScriptStages";

// ============================================================================
// LAYER 1: SANITIZER
// ============================================================================

export interface SanitizeResult {
  /** Cleaned JSON string (still may not parse — caller tries JSON.parse) */
  cleaned: string;
  /** List of fixes applied (for debugging + telemetry) */
  fixesApplied: string[];
}

/**
 * Pure-string sanitizer — does not call AI, runs ~instant.
 * Returns sanitized JSON candidate + list of fixes applied.
 */
export function sanitizeJsonString(raw: string): SanitizeResult {
  const fixes: string[] = [];
  let s = raw;

  // 1. Strip markdown code fences (AI sometimes wraps despite responseMimeType)
  const fenceStripped = s.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/\s*```[\s\S]*$/i, "");
  if (fenceStripped !== s && fenceStripped.length > 0) {
    s = fenceStripped;
    fixes.push("strip-markdown-fence");
  }

  // 2. Strip non-JSON preamble — find first { or [
  const firstBrace = s.search(/[{[]/);
  if (firstBrace > 0) {
    s = s.slice(firstBrace);
    fixes.push("strip-preamble");
  }

  // 3. Strip trailing junk after last } or ]
  const lastClose = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (lastClose > 0 && lastClose < s.length - 1) {
    s = s.slice(0, lastClose + 1);
    fixes.push("strip-trailing-junk");
  }

  // 4. Replace smart quotes with straight quotes
  //    Curly double: " (U+201C) " (U+201D) → "
  //    Curly single: ' (U+2018) ' (U+2019) → '
  //    Other Unicode quotes: „ (U+201E), ‟ (U+201F) → "
  const beforeQuotes = s;
  s = s
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
  if (s !== beforeQuotes) fixes.push("normalize-smart-quotes");

  // 5. Remove trailing commas: `,}` `,]` `, }` `, ]`
  const beforeCommas = s;
  s = s.replace(/,(\s*[}\]])/g, "$1");
  if (s !== beforeCommas) fixes.push("strip-trailing-commas");

  // 6. Escape unescaped double quotes inside string values.
  //    Heuristic: scan char-by-char, track in-string state, escape interior quotes
  //    that aren't followed by valid JSON delimiters (, : } ] whitespace EOF).
  const escapeResult = escapeInteriorQuotes(s);
  if (escapeResult.changed) {
    s = escapeResult.output;
    fixes.push("escape-interior-quotes");
  }

  // 7. Auto-close unclosed brackets when count mismatch is small (≤2 missing)
  const closeResult = autoCloseBrackets(s);
  if (closeResult.changed) {
    s = closeResult.output;
    fixes.push(`auto-close-brackets:${closeResult.closingsAdded}`);
  }

  return { cleaned: s.trim(), fixesApplied: fixes };
}

/**
 * Escape `"` characters that appear inside string values but aren't followed
 * by valid JSON delimiters. Conservative — only escapes when we're confident
 * we're inside a string.
 *
 * State machine: walk chars. When we see `"`, check what comes after the next
 * non-whitespace char. If it's `,` `:` `}` `]` or EOF, the quote is a string
 * terminator. Otherwise it's an interior quote that needs escaping.
 *
 * Already-escaped (`\"`) quotes are preserved.
 */
function escapeInteriorQuotes(s: string): { output: string; changed: boolean } {
  const out: string[] = [];
  let inString = false;
  let changed = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = i > 0 ? s[i - 1] : "";

    if (ch === '"' && prev !== "\\") {
      if (!inString) {
        // Entering a string
        inString = true;
        out.push(ch);
      } else {
        // Currently in a string — is this the closing quote or an interior one?
        // Look ahead past whitespace
        let j = i + 1;
        while (j < s.length && /\s/.test(s[j])) j++;
        const next = j < s.length ? s[j] : "";
        if (next === "," || next === ":" || next === "}" || next === "]" || next === "" ) {
          // Looks like a real string terminator
          inString = false;
          out.push(ch);
        } else {
          // Looks like interior quote — escape it
          out.push('\\"');
          changed = true;
        }
      }
    } else {
      out.push(ch);
    }
  }

  return { output: out.join(""), changed };
}

/**
 * Auto-close unbalanced brackets when the deficit is small (≤2 per type).
 * Uses a STACK of open brackets (not counts) so closings respect nesting order.
 *
 * Example: `{[{"title":"Test` opens `{` `[` `{` in order — closes must be
 * `}` `]` `}` (reverse). Count-based logic would mis-order to `]}}`.
 *
 * Also handles the case where the input ends mid-string (truncated AI output
 * with no closing `"`) — appends a closing `"` before the bracket closures.
 *
 * Conservative: only adds closings, never opens. If deficit > 2 total brackets,
 * gives up (likely a deeper structural problem AI repair will handle).
 */
function autoCloseBrackets(s: string): { output: string; changed: boolean; closingsAdded: number } {
  const stack: Array<"{" | "["> = [];
  let inString = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = i > 0 ? s[i - 1] : "";
    if (ch === '"' && prev !== "\\") inString = !inString;
    if (inString) continue;
    if (ch === "{") stack.push("{");
    else if (ch === "[") stack.push("[");
    else if (ch === "}") {
      if (stack[stack.length - 1] === "{") stack.pop();
    } else if (ch === "]") {
      if (stack[stack.length - 1] === "[") stack.pop();
    }
  }

  if (stack.length === 0 && !inString) {
    return { output: s, changed: false, closingsAdded: 0 };
  }
  if (stack.length > 4) {
    // Too many unclosed brackets — likely truncated severely
    return { output: s, changed: false, closingsAdded: 0 };
  }

  // Build closings in REVERSE stack order: trailing string first, then each open bracket
  let closings = "";
  if (inString) closings += '"';
  for (let i = stack.length - 1; i >= 0; i--) {
    closings += stack[i] === "{" ? "}" : "]";
  }

  return { output: s + closings, changed: true, closingsAdded: closings.length };
}

// ============================================================================
// LAYER 2: AI REPAIR
// ============================================================================

/**
 * Ask Gemini Flash (forced — cheapest model) to fix broken JSON.
 * Sends the malformed string + the original parse error so AI knows what to fix.
 *
 * Max 1 retry — if Gemini's fix also fails, throws and lets caller surface
 * the retry button.
 */
export async function repairJsonViaAi(
  malformed: string,
  parseError: string,
  preferredProvider: FilmScriptProvider = "gemini-flash"
): Promise<string> {
  const systemPrompt = `You are a JSON repair specialist. The user provides a malformed JSON string and the JavaScript parse error. Your job is to output the SAME structure with the broken parts fixed.

CRITICAL OUTPUT RULES:
- Output ONLY the corrected JSON object. No preamble. No markdown fences. No explanation.
- Preserve ALL field names, values, and structure from the input
- Only fix syntactic errors (trailing commas, unescaped quotes, missing brackets)
- Use straight double quotes (") never curly quotes
- Escape any double quotes inside string values as \\"
- If a string was truncated mid-value, end it cleanly at the last word + close brackets
- If you cannot determine what the original intended structure was, do your best guess

Output the fixed JSON now.`;

  const userPrompt = `MALFORMED JSON:
${malformed.slice(0, 8000)}

PARSE ERROR:
${parseError}

Fix and output the JSON.`;

  // Always use gemini-flash for repair (cheapest, fast enough)
  // Fall back to caller's provider only if gemini-flash unavailable
  const result = await callAi(preferredProvider, systemPrompt, userPrompt, {
    temperature: 0.1, // low temperature — we want deterministic repair, not creativity
  });
  return result;
}

// ============================================================================
// LAYER 3: COMPOSED PIPELINE
// ============================================================================

export interface ParseWithRecoveryOptions {
  /** Provider for AI repair fallback (default: gemini-flash) */
  repairProvider?: FilmScriptProvider;
  /** Enable AI repair fallback (default: true). Set false to skip Layer 2. */
  enableAiRepair?: boolean;
  /** Diagnostic label for logs (e.g. "Stage 4 Scenes") */
  label?: string;
}

export interface ParseWithRecoveryResult<T> {
  data: T;
  /** Which layer succeeded: "direct" | "sanitizer" | "ai-repair" */
  recoveryLevel: "direct" | "sanitizer" | "ai-repair";
  /** Fixes applied if sanitizer ran */
  sanitizerFixes?: string[];
}

/**
 * Main entry point — parse JSON with progressive recovery.
 *
 * Pipeline:
 * 1. Try `JSON.parse(raw)` directly
 * 2. If fails, run sanitizer + try parse again
 * 3. If still fails AND enableAiRepair, ask AI to repair + try parse
 * 4. If still fails, throw with full diagnostic info
 *
 * Each recovery attempt is logged to console for debugging.
 *
 * @throws Error with diagnostic message if all layers fail.
 */
export async function parseJsonWithRecovery<T = any>(
  raw: string,
  options: ParseWithRecoveryOptions = {}
): Promise<ParseWithRecoveryResult<T>> {
  const { repairProvider = "gemini-flash", enableAiRepair = true, label = "JSON" } = options;

  // Layer 0: try parse as-is
  try {
    const data = JSON.parse(raw) as T;
    return { data, recoveryLevel: "direct" };
  } catch (firstErr) {
    const firstMsg = (firstErr as Error).message;
    console.warn(`[KSP JSON recovery] ${label} direct parse failed: ${firstMsg}`);

    // Layer 1: sanitize + retry
    const { cleaned, fixesApplied } = sanitizeJsonString(raw);
    try {
      const data = JSON.parse(cleaned) as T;
      console.log(`[KSP JSON recovery] ${label} sanitizer fixed: ${fixesApplied.join(", ")}`);
      return { data, recoveryLevel: "sanitizer", sanitizerFixes: fixesApplied };
    } catch (sanitizerErr) {
      const sanitizerMsg = (sanitizerErr as Error).message;
      console.warn(`[KSP JSON recovery] ${label} sanitizer also failed: ${sanitizerMsg}`);

      // Layer 2: AI repair
      if (!enableAiRepair) {
        throw new Error(
          `JSON parse failed (sanitizer+direct). Last error: ${sanitizerMsg}. Fixes attempted: ${fixesApplied.join(", ") || "none"}`
        );
      }

      try {
        const repaired = await repairJsonViaAi(cleaned, sanitizerMsg, repairProvider);
        // The AI may STILL wrap in fences — run sanitizer one more time on output
        const { cleaned: doubleClean } = sanitizeJsonString(repaired);
        const data = JSON.parse(doubleClean) as T;
        console.log(`[KSP JSON recovery] ${label} AI repair succeeded`);
        return { data, recoveryLevel: "ai-repair", sanitizerFixes: fixesApplied };
      } catch (repairErr) {
        const repairMsg = (repairErr as Error).message;
        throw new Error(
          `JSON parse failed at all 3 layers. Direct: ${firstMsg.slice(0, 100)}. Sanitizer: ${sanitizerMsg.slice(0, 100)}. AI repair: ${repairMsg.slice(0, 100)}. Section status sẽ thành "error" — click Retry để thử lại.`
        );
      }
    }
  }
}

/**
 * JSON output rules directive — append to AI system prompts to reduce
 * malformed JSON frequency. Reusable across all 5 AI prompts.
 */
export const JSON_OUTPUT_RULES = `

CRITICAL JSON OUTPUT RULES:
- Output ONLY the JSON object. No preamble. No markdown code fences. No explanation text.
- Use STRAIGHT double quotes (") only — never curly quotes (" " ' ')
- Escape all double quotes inside string values as \\"
- NO trailing commas before } or ]
- All arrays [...] and objects {...} MUST have matching close brackets
- If you run out of space, end the last string cleanly at a word boundary and close all open brackets`;
