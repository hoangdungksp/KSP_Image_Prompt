/**
 * OpenAI ChatGPT API client v0.6.5
 *
 * Mirror of gemini.ts API surface for unified AI provider abstraction.
 * Used for storyboard frame generation + Vietnamese-to-English translation.
 */

import { getSettings } from "./gemini";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini"; // Cost-effective, fast

/**
 * Translate Vietnamese text to English using OpenAI.
 */
export async function translateVnToEnOpenAI(vietnameseText: string): Promise<string> {
  if (!vietnameseText.trim()) return "";

  const settings = await getSettings();
  if (!settings.openaiApiKey) {
    throw new Error("Chưa có OpenAI API key. Vào ⚙️ Settings để thêm key.");
  }

  const userPrompt = `Translate the following Vietnamese description to fluent, vivid English suitable for an AI image generation prompt. Preserve all specific details (locations, brand names, traditional Vietnamese terms like "áo dài", "phở", etc. — keep these in original Vietnamese with proper diacritics if they're proper nouns or culinary terms). Output ONLY the English translation, no preamble, no quotes, no explanation.

Vietnamese: "${vietnameseText}"

English translation:`;

  try {
    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const translated = data?.choices?.[0]?.message?.content?.trim() || "";

    if (!translated) {
      throw new Error("Empty translation result from OpenAI");
    }

    return translated;
  } catch (e: any) {
    console.error("OpenAI translation failed:", e);
    throw e;
  }
}

/**
 * Generic OpenAI completion call (for storyboard generation).
 */
export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 4096
): Promise<string> {
  const settings = await getSettings();
  if (!settings.openaiApiKey) {
    throw new Error("Chưa có OpenAI API key. Vào ⚙️ Settings để thêm key.");
  }

  const response = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!content) throw new Error("Empty response from OpenAI");
  return content;
}

/**
 * Test if OpenAI API key is valid.
 */
export async function testOpenAIKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [{ role: "user", content: "Say 'ok' in one word." }],
        max_tokens: 10,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
