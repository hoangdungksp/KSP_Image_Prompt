/**
 * KSP Image v0.9.0 — Image generation API clients
 *
 * Supports:
 * - Imagen 4 Standard / Fast (text-only input → image)
 * - Gemini 2.5 Flash Image / Nano Banana (multi-image input → image, for single-frame replacement with refs)
 *
 * Both use Gemini API key from useGlobalStore.
 *
 * Returns: blob URL ready to save to IndexedDB OR download.
 *
 * NOTE: Direct API calls. CORS handled via background script if needed.
 */

import { useGlobalStore } from "../store/useGlobalStore";

// ============================================================================
// IMAGEN 4 — text-only
// ============================================================================

const IMAGEN_4_STANDARD_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict";
const IMAGEN_4_FAST_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict";

export interface Imagen4GenerateOptions {
  prompt: string;
  variations?: 1 | 2 | 3 | 4;
  aspectRatio?: "1:1" | "9:16" | "16:9" | "3:4" | "4:3";
  fast?: boolean; // Use fast model (cheaper, lower quality)
}

export interface Imagen4Result {
  /** Base64-encoded PNG. Convert to Blob via base64ToBlob() */
  base64: string;
  prompt: string;
  model: string;
}

export async function generateImage(opts: Imagen4GenerateOptions): Promise<Imagen4Result[]> {
  const apiKey = useGlobalStore.getState().apiKeys.gemini;
  if (!apiKey) {
    throw new Error("Cần Gemini API key. Vào Project Setting → API Keys.");
  }

  const endpoint = opts.fast ? IMAGEN_4_FAST_ENDPOINT : IMAGEN_4_STANDARD_ENDPOINT;
  const url = `${endpoint}?key=${apiKey}`;

  const body = {
    instances: [{ prompt: opts.prompt }],
    parameters: {
      sampleCount: opts.variations ?? 1,
      aspectRatio: opts.aspectRatio ?? "1:1",
      personGeneration: "allow_all",
      includeRaiReason: true,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 403) {
      throw new Error(
        "Imagen 4 access denied. API key có thể chưa enable Imagen API. Vào Google AI Studio → enable Imagen."
      );
    }
    throw new Error(`Imagen API error (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const predictions = data.predictions ?? [];

  if (predictions.length === 0) {
    throw new Error("Imagen returned no images. Prompt có thể bị filter (try less explicit content).");
  }

  return predictions.map((p: any) => ({
    base64: p.bytesBase64Encoded ?? "",
    prompt: opts.prompt,
    model: opts.fast ? "imagen-4-fast" : "imagen-4-standard",
  }));
}

// ============================================================================
// NANO BANANA — multi-image input (for single-frame replacement with cast refs)
// ============================================================================

const NANO_BANANA_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";

export interface NanoBananaInput {
  prompt: string;
  /** Up to 14 reference images as base64 */
  referenceImages: { base64: string; mimeType?: string }[];
}

export async function generateImageWithRefs(input: NanoBananaInput): Promise<Imagen4Result> {
  const apiKey = useGlobalStore.getState().apiKeys.gemini;
  if (!apiKey) {
    throw new Error("Cần Gemini API key. Vào Project Setting → API Keys.");
  }

  if (input.referenceImages.length > 14) {
    throw new Error("Nano Banana max 14 reference images. Reduce refs.");
  }

  const url = `${NANO_BANANA_ENDPOINT}?key=${apiKey}`;

  const parts: any[] = [{ text: input.prompt }];
  input.referenceImages.forEach((ref) => {
    parts.push({
      inlineData: {
        mimeType: ref.mimeType ?? "image/png",
        data: ref.base64,
      },
    });
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["IMAGE"],
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Nano Banana error (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();

  // Find image part in response
  const imagePart = data.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData?.data
  );

  if (!imagePart) {
    throw new Error("Nano Banana returned no image. Try different prompt.");
  }

  return {
    base64: imagePart.inlineData.data,
    prompt: input.prompt,
    model: "gemini-2.5-flash-image",
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert base64 string to Blob for IndexedDB storage.
 */
export function base64ToBlob(base64: string, mimeType = "image/png"): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Convert Blob to base64 (for sending to Nano Banana).
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Trigger browser download of base64 image.
 */
export function downloadBase64Image(base64: string, filename: string): void {
  const blob = base64ToBlob(base64);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
