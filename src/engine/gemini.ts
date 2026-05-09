/**
 * Gemini API translation service.
 * Used to translate Vietnamese ideas to English for Banana Pro consumption.
 *
 * User provides their own API key in Settings.
 */

const SETTINGS_KEY = "ksp_settings";

export type AIProvider = "gemini" | "openai";

export interface KSPSettings {
  geminiApiKey?: string;
  /** v0.6.5: OpenAI API key */
  openaiApiKey?: string;
  /** v0.6.5: Preferred AI provider for storyboard generation */
  preferredAIProvider?: AIProvider;
}

export async function getSettings(): Promise<KSPSettings> {
  if (typeof chrome === "undefined" || !chrome.storage) return {};
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return result[SETTINGS_KEY] || {};
  } catch {
    return {};
  }
}

export async function saveSettings(settings: KSPSettings): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage) return;
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

// v0.6.6: Updated to gemini-2.5-flash (gemini-2.0-flash shutdown for new users March 2026)
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Translate Vietnamese text to English using Gemini Flash.
 * Returns the original text if API call fails (graceful degradation).
 */
export async function translateVnToEn(vietnameseText: string): Promise<string> {
  if (!vietnameseText.trim()) return "";

  const settings = await getSettings();
  if (!settings.geminiApiKey) {
    throw new Error(
      "Chưa có Gemini API key. Vào ⚙️ Settings để thêm key."
    );
  }

  const prompt = `Translate the following Vietnamese description to fluent, vivid English suitable for an AI image generation prompt. Preserve all specific details (locations, brand names, traditional Vietnamese terms like "áo dài", "phở", etc. — keep these in original Vietnamese with proper diacritics if they're proper nouns or culinary terms). Output ONLY the English translation, no preamble, no quotes, no explanation.

Vietnamese: "${vietnameseText}"

English translation:`;

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${settings.geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!translated) {
      throw new Error("Empty translation result from Gemini");
    }

    return translated;
  } catch (e: any) {
    console.error("Translation failed:", e);
    throw e;
  }
}

/**
 * Quick test if API key is valid.
 */
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Say 'ok' in one word." }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Generic Gemini completion call (for storyboard generation) - v0.6.5
 * Returns JSON-formatted response.
 */
export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 4096
): Promise<string> {
  const settings = await getSettings();
  if (!settings.geminiApiKey) {
    throw new Error("Chưa có Gemini API key. Vào ⚙️ Settings để thêm key.");
  }

  const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${settings.geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: combinedPrompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  if (!content) throw new Error("Empty response from Gemini");
  return content;
}

/**
 * v0.6.6: Multimodal Gemini call with image - for auto face feature extraction.
 *
 * Takes a face image as base64 + a prompt → Gemini analyzes face and returns
 * specific identifying features (moles, freckles, dimples, distinctive eyebrows etc.)
 */
export async function callGeminiVision(
  systemPrompt: string,
  userPrompt: string,
  imageBase64: string,
  imageMimeType: string = "image/jpeg",
  temperature: number = 0.4,
  maxTokens: number = 1024
): Promise<string> {
  const settings = await getSettings();
  if (!settings.geminiApiKey) {
    throw new Error("Chưa có Gemini API key. Vào ⚙️ Settings để thêm key.");
  }

  // Strip data URL prefix if present
  const cleanBase64 = imageBase64.startsWith("data:")
    ? imageBase64.split(",")[1]
    : imageBase64;

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${settings.geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: `${systemPrompt}\n\n${userPrompt}` },
          {
            inline_data: {
              mime_type: imageMimeType,
              data: cleanBase64,
            },
          },
        ],
      }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini Vision API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  if (!content) throw new Error("Empty response from Gemini Vision");
  return content;
}
