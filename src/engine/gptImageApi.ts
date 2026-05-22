/**
 * GPT Image 2 API integration.
 *
 * Wraps OpenAI's Images API (gpt-image-2 model) for in-app character sheet
 * generation. Replaces the manual copy-paste workflow when user opts in.
 *
 * Endpoints used:
 * - POST /v1/images/generations — text-to-image (concept sheet from prompt)
 * - POST /v1/images/edits       — image-to-image with reference (storyboard
 *   frames driven by concept sheet for character consistency)
 *
 * Cost estimates (per OpenAI calculator, May 2026):
 * - 1024×1024 low:    ~$0.006
 * - 1024×1024 medium: ~$0.053
 * - 1024×1024 high:   ~$0.211
 * - 1536×1024 low:    ~$0.005 (cheaper than square due to aspect math)
 * - 1536×1024 high:   ~$0.165
 *
 * Quality default: "high" for character sheets (one-time generation, quality
 * matters), "medium" for storyboard frames (volume sensitivity).
 *
 * Error handling: all calls throw with actionable Vietnamese messages.
 * Caller wraps in try/catch + showToast.
 */

import { useGlobalStore } from "../store/useGlobalStore";

const OPENAI_IMAGES_GENERATE = "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGES_EDIT = "https://api.openai.com/v1/images/edits";

export type GptImageQuality = "low" | "medium" | "high";

/** Supported sizes per OpenAI docs — must be 16-multiples within constraints */
export type GptImageSize =
  | "1024x1024" // 1:1 square
  | "1536x1024" // 3:2 landscape (best for character sheets with 3 views)
  | "1024x1536" // 2:3 portrait
  | "1792x1024" // 16:9 cinema wide
  | "1024x1792"; // 9:16 mobile portrait

export interface GenerateSheetInput {
  /** The full prompt (built by buildCharacterSheetPrompt) */
  prompt: string;
  size?: GptImageSize;
  quality?: GptImageQuality;
}

export interface GenerateSheetResult {
  /** Generated image as data URL (base64 PNG) — ready to store as FilmImageRef */
  dataUrl: string;
  /** Estimated cost in USD for this generation (best-effort estimate) */
  costEstimateUsd?: number;
  /** Model snapshot used (for debugging) */
  model: string;
}

/**
 * Generate a fresh character reference sheet from a text prompt.
 * Used by Cast section "AI Sheet" action.
 */
export async function generateCharacterSheet(
  input: GenerateSheetInput
): Promise<GenerateSheetResult> {
  const apiKey = useGlobalStore.getState().apiKeys.openai;
  if (!apiKey) {
    throw new Error(
      "Cần OpenAI API key để dùng GPT Image 2. Vào Project Setting → API Keys để thêm key."
    );
  }

  const size: GptImageSize = input.size ?? "1536x1024";
  const quality: GptImageQuality = input.quality ?? "high";

  let response: Response;
  try {
    response = await fetch(OPENAI_IMAGES_GENERATE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt: input.prompt,
        size,
        quality,
        n: 1,
        // Return base64 directly (not URL) so we can store as dataURL in IndexedDB
        // immediately. Avoids second fetch + CORS issues with CDN URLs.
        response_format: "b64_json",
      }),
    });
  } catch (err) {
    throw new Error(`Network lỗi khi gọi GPT Image 2: ${(err as Error).message}`);
  }

  if (!response.ok) {
    const errText = await response.text();
    let errMsg: string;
    try {
      const parsed = JSON.parse(errText);
      errMsg = parsed.error?.message ?? errText.slice(0, 200);
    } catch {
      errMsg = errText.slice(0, 200);
    }
    if (response.status === 401) {
      throw new Error("OpenAI API key không hợp lệ. Check lại trong Project Setting.");
    }
    if (response.status === 403) {
      throw new Error(
        "GPT Image 2 bị từ chối (403). Có thể cần verify Organization trong OpenAI dashboard."
      );
    }
    if (response.status === 429) {
      throw new Error("OpenAI rate limit (429). Đợi vài giây rồi thử lại.");
    }
    if (response.status === 400 && errMsg.toLowerCase().includes("safety")) {
      throw new Error(
        "GPT Image 2 từ chối do safety filter (description chứa từ nhạy cảm). Sửa description rồi thử lại."
      );
    }
    throw new Error(`GPT Image 2 error (${response.status}): ${errMsg}`);
  }

  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64 || typeof b64 !== "string") {
    throw new Error(
      `GPT Image 2 response thiếu base64 image. Response shape: ${JSON.stringify(Object.keys(data || {})).slice(0, 100)}`
    );
  }

  const dataUrl = `data:image/png;base64,${b64}`;

  // Cost estimate based on OpenAI calculator numbers (May 2026)
  const costEstimateUsd = estimateImageCost(size, quality);

  // r7.20a: emit cost event for pipeline tracker
  const { emitImageCost } = await import("./costTracker");
  emitImageCost(quality === "high" ? "high" : "low");

  return {
    dataUrl,
    costEstimateUsd,
    model: data?.model ?? "gpt-image-2",
  };
}

export interface EditImageInput {
  prompt: string;
  /** Up to 10 reference images (data URLs) — first ref is the primary subject */
  referenceImages: string[];
  size?: GptImageSize;
  quality?: GptImageQuality;
}

export interface EditImageResult {
  dataUrl: string;
  costEstimateUsd?: number;
  model: string;
}

/**
 * Edit an existing image with a text prompt + optional reference images.
 * Used by Storyboard frame regen — pass conceptSheet as reference + scene
 * description as edit prompt → output preserves character identity while
 * changing the scene context.
 *
 * Per OpenAI docs: gpt-image-2 processes all reference images at high fidelity
 * automatically (no input_fidelity parameter needed — that's gpt-image-1.5 only).
 */
export async function editImageWithReference(input: EditImageInput): Promise<EditImageResult> {
  const apiKey = useGlobalStore.getState().apiKeys.openai;
  if (!apiKey) {
    throw new Error("Cần OpenAI API key. Vào Project Setting → API Keys.");
  }
  if (input.referenceImages.length === 0) {
    throw new Error("editImageWithReference cần ít nhất 1 reference image");
  }
  if (input.referenceImages.length > 10) {
    throw new Error("Tối đa 10 reference images per call");
  }

  const size: GptImageSize = input.size ?? "1536x1024";
  const quality: GptImageQuality = input.quality ?? "medium"; // medium default for storyboards

  // Build multipart form data — edit endpoint requires multipart, not JSON
  const formData = new FormData();
  formData.append("model", "gpt-image-2");
  formData.append("prompt", input.prompt);
  formData.append("size", size);
  formData.append("quality", quality);
  formData.append("n", "1");

  // Convert each reference dataURL → Blob and append as image[] field
  // Edit endpoint accepts repeated `image` field for multi-reference
  for (let i = 0; i < input.referenceImages.length; i++) {
    const dataUrl = input.referenceImages[i];
    const blob = dataUrlToBlob(dataUrl);
    formData.append("image[]", blob, `ref_${i}.png`);
  }

  let response: Response;
  try {
    response = await fetch(OPENAI_IMAGES_EDIT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // NOTE: do NOT set Content-Type — browser sets multipart boundary automatically
      },
      body: formData,
    });
  } catch (err) {
    throw new Error(`Network lỗi khi gọi GPT Image 2 edit: ${(err as Error).message}`);
  }

  if (!response.ok) {
    const errText = await response.text();
    let errMsg: string;
    try {
      const parsed = JSON.parse(errText);
      errMsg = parsed.error?.message ?? errText.slice(0, 200);
    } catch {
      errMsg = errText.slice(0, 200);
    }
    if (response.status === 401)
      throw new Error("OpenAI API key không hợp lệ.");
    if (response.status === 429)
      throw new Error("OpenAI rate limit (429). Đợi vài giây.");
    throw new Error(`GPT Image 2 edit error (${response.status}): ${errMsg}`);
  }

  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64 || typeof b64 !== "string") {
    throw new Error("GPT Image 2 edit response thiếu base64 image");
  }

  return {
    dataUrl: `data:image/png;base64,${b64}`,
    costEstimateUsd: estimateImageCost(size, quality),
    model: data?.model ?? "gpt-image-2",
  };
}

/**
 * Convert data URL → Blob for multipart upload.
 * Throws if dataURL is malformed.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL format");
  const mimeType = match[1];
  const base64 = match[2];
  const binStr = atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/**
 * Best-effort cost estimate from OpenAI calculator (May 2026 prices).
 * Returns USD. Used for UX hints only — actual billing per API token usage.
 */
function estimateImageCost(size: GptImageSize, quality: GptImageQuality): number {
  // Approximate per-image costs from OpenAI's calculator + community testing
  const table: Record<GptImageSize, Record<GptImageQuality, number>> = {
    "1024x1024": { low: 0.006, medium: 0.053, high: 0.211 },
    "1536x1024": { low: 0.005, medium: 0.041, high: 0.165 },
    "1024x1536": { low: 0.005, medium: 0.041, high: 0.165 },
    "1792x1024": { low: 0.008, medium: 0.06, high: 0.241 },
    "1024x1792": { low: 0.008, medium: 0.06, high: 0.241 },
  };
  return table[size][quality];
}

/**
 * Check whether GPT Image 2 in-app generation is available.
 * Returns false if OpenAI API key is missing. UI uses this to enable/disable
 * the "AI Sheet" button + show install hint.
 */
export function isGptImage2Available(): boolean {
  return !!useGlobalStore.getState().apiKeys.openai;
}
