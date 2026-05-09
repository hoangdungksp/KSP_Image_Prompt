/**
 * Single Frame Operations v0.7.1
 *
 * Generate prompts and AI-assisted operations for individual frames.
 */

import { callGemini } from "../gemini";
import { callOpenAI } from "../openai";
import type { PromptProject } from "../../types";
import type { AIProvider as StoryboardAIProvider } from "./aiGenerator";

export interface SingleFrameContext {
  /** All frames in the storyboard */
  allFrames: Array<{
    num: number;
    role: string;
    action: string;
    actionVi?: string;
    locked?: boolean;
  }>;
  /** Index of the frame being regenerated */
  targetIdx: number;
  /** User's modification request (optional) */
  userRequest?: string;
  /** Project context */
  project: PromptProject;
  /** AI provider */
  provider: StoryboardAIProvider;
}

export interface RegeneratedFrame {
  role: string;
  actionVi: string;
  actionEn: string;
  reasoning?: string;
}

/**
 * v0.7.1: Regenerate text for a SINGLE frame using AI.
 * Provides surrounding context so AI maintains narrative continuity.
 */
export async function regenerateFrameText(opts: SingleFrameContext): Promise<RegeneratedFrame> {
  const { allFrames, targetIdx, userRequest, project, provider } = opts;
  const targetFrame = allFrames[targetIdx];

  const prevFrame = targetIdx > 0 ? allFrames[targetIdx - 1] : null;
  const nextFrame = targetIdx < allFrames.length - 1 ? allFrames[targetIdx + 1] : null;

  const systemPrompt = `Bạn là TVC creative director. Nhiệm vụ: viết lại 1 cảnh (frame) trong storyboard sao cho:
1. Mượt với cảnh trước và cảnh sau
2. Match với ý tưởng tổng thể TVC
3. Đủ chi tiết cho AI image generation

OUTPUT FORMAT (chỉ JSON, không markdown):
{
  "role": "<English role label, vd: Hook/Problem/Reveal/Apply/Result/Hero/Logo>",
  "actionVi": "<mô tả tiếng Việt, 1-2 câu, vivid và cụ thể>",
  "actionEn": "<English translation tối ưu cho image gen, vivid descriptors, lighting, mood, framing>",
  "reasoning": "<1 câu tiếng Việt giải thích logic vì sao chọn cảnh này>"
}`;

  const idea = project.idea?.raw || "";
  const productDescs = project.references?.productDescriptions?.filter(Boolean) || [];
  const industry = (project as any).industry || "general";

  const userPrompt = `# TVC IDEA: ${idea}

# CONTEXT
- Industry: ${industry}
- Total frames: ${allFrames.length}
- Target frame: #${targetFrame.num} (currently labeled "${targetFrame.role}")

${productDescs.length > 0 ? `# PRODUCT(S):\n${productDescs.map((d, i) => `${i + 1}. ${d}`).join("\n")}\n` : ""}

# SURROUNDING CONTEXT (để cảnh mới mượt với 2 bên)
${prevFrame ? `Frame trước (#${prevFrame.num}, ${prevFrame.role}): ${prevFrame.actionVi || prevFrame.action}` : "(Đây là cảnh đầu tiên)"}
${nextFrame ? `Frame sau (#${nextFrame.num}, ${nextFrame.role}): ${nextFrame.actionVi || nextFrame.action}` : "(Đây là cảnh cuối)"}

# CẢNH HIỆN TẠI (cần sửa lại):
Role: ${targetFrame.role}
Action: ${targetFrame.actionVi || targetFrame.action}

${userRequest ? `# USER REQUEST (yêu cầu cụ thể của user):\n${userRequest}\n` : ""}

# YOUR TASK
Viết lại cảnh #${targetFrame.num} sao cho:
- ${userRequest ? "Match với user request ở trên" : "Cải thiện chất lượng & detail"}
- Mượt với frame trước (${prevFrame?.role || "start"}) và frame sau (${nextFrame?.role || "end"})
- Đủ specific cho AI image gen (lighting, mood, pose, expression, framing)

Output ONLY the JSON object specified.`;

  let raw: string;
  if (provider === "openai") {
    raw = await callOpenAI(systemPrompt, userPrompt, 0.7, 1024);
  } else {
    raw = await callGemini(systemPrompt, userPrompt, 0.7, 1024);
  }

  // Strip markdown
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  const parsed = JSON.parse(cleaned);
  return {
    role: parsed.role || targetFrame.role,
    actionVi: parsed.actionVi || "",
    actionEn: parsed.actionEn || parsed.actionVi || "",
    reasoning: parsed.reasoning,
  };
}

/**
 * v0.7.1: Generate a prompt for regenerating a SINGLE frame as image.
 * This prompt is sent to Banana Pro to generate a single replacement image.
 */
export interface SingleFramePromptOpts {
  project: PromptProject;
  /** The frame to regenerate */
  frame: {
    num: number;
    role: string;
    action: string;
    actionVi?: string;
  };
  /** Frames before/after for visual consistency */
  prevFrame?: { role: string; action: string; actionVi?: string };
  nextFrame?: { role: string; action: string; actionVi?: string };
  /** User's modification request */
  userRequest?: string;
  brandName?: string;
}

export function generateSingleFramePrompt(opts: SingleFramePromptOpts): string {
  const { project, frame, prevFrame, nextFrame, userRequest, brandName } = opts;
  const cameraStyle = project.cameraStyle || "BOKEH";
  const aspectRatio = project.aspectRatio || "9:16";
  const hasFace = project.references?.hasFace;

  // Build reference list
  const refOrderingParts: string[] = [];
  let imageNum = 1;
  if (hasFace) {
    const faceCount = project.references.faceCount || 1;
    if (faceCount === 1) {
      refOrderingParts.push(`Image #${imageNum} = face reference (the same person from previous frames)`);
      imageNum++;
    } else {
      for (let i = 0; i < faceCount; i++) {
        refOrderingParts.push(`Image #${imageNum} = face reference angle ${i + 1}`);
        imageNum++;
      }
    }
  }
  if (project.references.hasOutfit) {
    refOrderingParts.push(`Image #${imageNum} = outfit reference`);
    imageNum++;
  }
  if (project.references.productCount > 0 && project.references.productDescriptions) {
    project.references.productDescriptions.forEach((desc) => {
      if (desc) {
        refOrderingParts.push(`Image #${imageNum} = product reference: ${desc}`);
        imageNum++;
      }
    });
  }

  const styleNote = cameraStyle === "BOKEH"
    ? "Cinematic BOKEH style — Sony A7R V, 85mm f/1.8, shallow depth of field, golden hour warm lighting, premium commercial aesthetic"
    : "Cinematic but sharper documentary style — iPhone 15 Pro look, deeper focus, natural lighting, authentic mood";

  const blocks: string[] = [];

  if (refOrderingParts.length > 0) {
    blocks.push(
      `REFERENCE IMAGES (must use these to maintain identity):`,
      ...refOrderingParts.map((p) => `- ${p}`),
      ``
    );
  }

  blocks.push(
    `# SINGLE FRAME REGENERATION`,
    `This is a regeneration of frame #${frame.num} from a TVC storyboard. The previous version of this frame was unsatisfactory and needs to be regenerated as a STANDALONE image while maintaining visual consistency with the surrounding frames.`,
    ``,
    `Output: A single ${aspectRatio} vertical image (NOT a grid, NOT multiple frames — just one clean photographic image).`,
    ``
  );

  if (userRequest) {
    blocks.push(
      `# USER MODIFICATION REQUEST`,
      userRequest,
      ``
    );
  }

  blocks.push(
    `# SCENE TO RENDER`,
    `Frame #${frame.num} — ${frame.role}: ${frame.action}`,
    ``
  );

  if (prevFrame || nextFrame) {
    blocks.push(`# CONTEXT FOR CONSISTENCY (DO NOT render these, just use for matching style/lighting/mood)`);
    if (prevFrame) {
      blocks.push(`- Previous frame (${prevFrame.role}): ${prevFrame.action}`);
    }
    if (nextFrame) {
      blocks.push(`- Next frame (${nextFrame.role}): ${nextFrame.action}`);
    }
    blocks.push(`Match the lighting, color grading, mood, person identity, outfit, and product appearance from these surrounding frames.`, ``);
  }

  if (hasFace) {
    blocks.push(
      `# IDENTITY CONSISTENCY`,
      `Keep the face of the person 100% accurate from the reference image. Friends and family should immediately recognize them. Take skin tone, eye color, eye shape, eyebrow shape, nose, lips, and hair color directly from the face reference.`,
      ``
    );
  }

  blocks.push(
    `# STYLE`,
    styleNote,
    `Aspect ratio: ${aspectRatio} vertical, hi-res 8K, premium commercial quality.`,
    ``,
    `# AVOID`,
    `- Multiple panels or grid layouts (this is ONE single image)`,
    `- Text overlays, frame numbers, timing labels`,
    `- Watermarks, AI signatures`,
    `- Identity drift from face reference`,
    `- Different style/lighting from surrounding frames (match them!)`
  );

  if (brandName) {
    blocks.push(`- Brand logo (only the final frame in storyboard has logo, this is a middle frame)`);
  }

  return blocks.join("\n");
}
