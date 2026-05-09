/**
 * Animation Prompts Generator v0.6
 * 
 * Generates prompts to animate from Frame N → Frame N+1 using AI video tools.
 * Generic format that works for Kling / Veo3 / Runway / Luma / Higgsfield.
 */

import type { StoryArc, FrameTemplate } from "./arcs";

export interface AnimationPromptOptions {
  arc: StoryArc;
  /** Optional brand-specific notes */
  brandName?: string;
  /** Camera movement preference */
  cameraStyle?: "static" | "subtle" | "dynamic" | "cinematic";
}

export interface AnimationPair {
  fromFrame: number;
  toFrame: number;
  fromTiming: string;
  toTiming: string;
  duration: number;
  prompt: string;
}

/**
 * v0.7.2: Describe aspect ratio with use-case context for AI to understand intent.
 */
function describeAspectRatio(ratio: string): string {
  switch (ratio) {
    case "9:16":
      return "vertical mobile-first format for TikTok / Reels / Shorts / Stories";
    case "16:9":
      return "horizontal landscape format for YouTube / Web / TV / cinematic viewing";
    case "1:1":
      return "square format for Instagram feed / Facebook / LinkedIn";
    case "4:5":
      return "portrait format for Instagram feed (taller than square, occupies more screen)";
    case "21:9":
      return "ultra-wide cinematic format for cinema / movie-style content";
    default:
      return "standard video format";
  }
}

const CAMERA_MOVEMENT_HINTS = {
  static: "minimal camera movement, mostly subject motion, locked-off camera feel",
  subtle: "subtle gentle camera push-in or pan, smooth controlled movement",
  dynamic: "dynamic camera movement with energy, push, pull, or swirl as appropriate to the action",
  cinematic: "cinematic camera work, dolly moves, parallax, professional commercial feel",
};

/**
 * Generate transition prompt between two consecutive frames.
 * Designed to work for ANY image-to-video AI tool (Kling, Veo3, Runway, Luma, Higgsfield).
 */
export function generateAnimationPrompts(opts: AnimationPromptOptions): AnimationPair[] {
  const { arc, cameraStyle = "subtle" } = opts;
  const cameraHint = CAMERA_MOVEMENT_HINTS[cameraStyle];

  const pairs: AnimationPair[] = [];

  for (let i = 0; i < arc.frames.length - 1; i++) {
    const from = arc.frames[i];
    const to = arc.frames[i + 1];
    const duration = 3; // Each transition ~3 seconds

    pairs.push({
      fromFrame: from.num,
      toFrame: to.num,
      fromTiming: from.timing,
      toTiming: to.timing,
      duration,
      prompt: buildTransitionPrompt(from, to, duration, cameraHint),
    });
  }

  return pairs;
}

function buildTransitionPrompt(
  from: FrameTemplate,
  to: FrameTemplate,
  duration: number,
  cameraHint: string
): string {
  return [
    `Image-to-video animation (${duration} seconds)`,
    ``,
    `Starting frame (Frame ${from.num} - ${from.timing} - ${from.role}): ${from.action}`,
    ``,
    `Ending frame (Frame ${to.num} - ${to.timing} - ${to.role}): ${to.action}`,
    ``,
    `Animation: Smoothly transition from the starting frame to the ending frame over ${duration} seconds. The same person and setting should remain consistent throughout. Show natural realistic motion that connects the two frames — the subject's pose, expression, or interaction with the product/environment evolves naturally.`,
    ``,
    `Camera: ${cameraHint}.`,
    ``,
    `Motion quality: Natural human movement at realistic speed. No teleportation, no morphing. If the action involves the product, the product remains identifiable with the same packaging throughout. Lighting and color grading stay consistent — same warm/cool tone as the source image. Maintain identical face features (no identity drift).`,
    ``,
    `Transition type: ${getTransitionTypeForRoles(from.role, to.role)}.`,
    ``,
    `Avoid: identity drift, product redesign, inconsistent lighting, jerky motion, abrupt cuts, blurry frames, watermarks, text artifacts.`,
  ].join("\n");
}

/**
 * Determine appropriate transition type based on the role of the two frames.
 */
function getTransitionTypeForRoles(fromRole: string, toRole: string): string {
  // Logo end is usually a clean fade or product reveal
  if (toRole.includes("Logo") || toRole.includes("End")) {
    return "Subject finishes their action, camera slowly pulls back or fades, transitioning to clean product/logo end card";
  }

  // Hero shots are often a confident pose reveal
  if (toRole.includes("Hero")) {
    return "Subject moves into final confident hero pose, camera settles into clean commercial composition";
  }

  // Product reveal moments — focus shift to product
  if (toRole.includes("Product") || toRole.includes("Reveal") || toRole.includes("Sees")) {
    return "Camera/focus shifts toward the product as it enters the scene, subject's reaction visible";
  }

  // Apply / Use / Sip — action close-up
  if (toRole.includes("Apply") || toRole.includes("Use") || toRole.includes("Sip") || toRole.includes("Bite")) {
    return "Smooth motion into product interaction, hands and product visible, subject focused on action";
  }

  // Reaction / Result — emotional shift
  if (toRole.includes("Reaction") || toRole.includes("Result") || toRole.includes("Achievement")) {
    return "Natural emotional transition, expression evolves from neutral to positive (smile, eyes widening, satisfaction)";
  }

  // Default
  return "Smooth natural action continuation, maintaining mood and pacing";
}

/**
 * Generate a master animation README that explains the workflow.
 */
export function generateAnimationReadme(arc: StoryArc, pairs: AnimationPair[]): string {
  return `# TVC Animation Workflow

## Project info
- Format: ${arc.format} grid (${arc.frames.length} frames)
- Total duration: ~${arc.duration} seconds
- Industry: ${arc.industry}

## You have 2 workflow options:

### Option A: Grid-based AI (RECOMMENDED — easier, smoother result)

Use **Seedance 2.0** / **Pika 2.1** / **Sora 2** / **Runway Aleph** — these AI tools can take a grid storyboard image directly and generate a complete cohesive video.

1. Open the AI tool
2. Upload the FULL grid_${arc.format}.png file (no need to crop!)
3. Paste contents of \`all_frames_prompt_for_seedance_pika_sora.txt\`
4. Generate → ~${arc.duration}s complete video

The all-frames prompt uses TVC Director role-play with professional cinematography directives → result feels more cohesive than per-clip approach.

### Option B: Per-pair clips (more control, more work)

Use **Kling 2.0** / **Veo3** / **Runway Gen-3** / **Luma Dream Machine** / **Higgsfield** — these tools work best with image-to-video on individual frame pairs.

1. For each pair (${pairs.length} pairs total):
   - Open AI tool
   - Upload frame N as start, frame N+1 as end (or first frame if tool only supports one)
   - Paste corresponding animation_NN_frame*_to_frame*.txt
   - Generate ~3 second clip
2. Open clips in CapCut/Premiere/DaVinci Resolve
3. Place clips in order, adjust timing
4. Add background music + voiceover
5. Export final TVC

## Files in this ZIP
- \`0_storyboard_prompt.txt\` — Original storyboard generation prompt
- \`all_frames_prompt_for_seedance_pika_sora.txt\` — **(NEW)** Single comprehensive prompt for grid-based AI tools
- \`animation_01_to_02.txt\` ... \`animation_${String(pairs.length).padStart(2, "0")}_to_${String(pairs.length + 1).padStart(2, "0")}.txt\` — Per-pair prompts for Kling/Veo3 etc.
- \`frame_01.png\` ... \`frame_0${arc.frames.length}.png\` — Individual frames (for Option B)
- \`grid_${arc.format}.png\` — Full grid (for Option A)
- \`README.md\` — This file
`;
}

/**
 * v0.6.8: Generate ALL-FRAMES prompt for grid-based AI video tools.
 *
 * Some AI video tools (Seedance 2.0, Pika 2.1, Sora 2) can take a grid storyboard
 * image and a single comprehensive prompt → output a complete video with smooth
 * narrative flow.
 *
 * This is different from per-pair animation prompts because:
 * - Single prompt covers entire narrative
 * - AI handles all transitions internally
 * - Result is one cohesive video (no need for CapCut splicing)
 * - Role-play as TVC director gives professional context
 */
export function generateAllFramesPrompt(opts: AnimationPromptOptions): string {
  const { arc, brandName, cameraStyle = "subtle" } = opts;
  const cameraHint = CAMERA_MOVEMENT_HINTS[cameraStyle];

  const totalDuration = arc.duration;
  const frameCount = arc.frames.length;
  const [cols, rows] = arc.format.split("x").map(Number);

  // Build chronological narrative description
  const narrative = arc.frames.map((f, idx) => {
    const transitionHint = idx < arc.frames.length - 1
      ? ` [transition to next: ${getTransitionTypeForRoles(f.role, arc.frames[idx + 1].role)}]`
      : "";
    return `Frame ${f.num} (${f.timing}) — ${f.role}: ${f.action}${transitionHint}`;
  }).join("\n");

  return [
    // ROLE — establishes professional context
    `# ROLE`,
    `You are an experienced TVC (Television Commercial) Director with 15+ years working on premium brand campaigns. You've directed commercials for global brands across skincare, F&B, tech, and fashion industries. You combine the expertise of a Director, Cinematographer (DP), and Editor to create cohesive, brand-quality video content.`,
    ``,

    // CRITICAL — most important instruction (v0.6.9)
    `# CRITICAL — HOW TO READ THE INPUT IMAGE`,
    `The attached image is a ${cols}x${rows} grid storyboard — it is a REFERENCE TOOL showing the planned shots, NOT the actual video output.`,
    ``,
    `IMPORTANT: Do not show the full storyboard grid on screen. Do not render the grid layout, panel borders, or multiple frames simultaneously in the output. Start directly inside panel 1 as the first shot, filling the entire video frame, then move through the panels in order from 1 to ${frameCount}. Treat each panel as a separate full-screen 9:16 shot in one smooth final video. The result should feel like a real premium TVC ad, not a moving storyboard page.`,
    ``,
    `Each panel = one full-screen scene of the final video. Transitions between panels should feel like natural cinematic cuts or camera movements, not "page-turning" or "panel-switching" effects.`,
    ``,

    // CONTEXT
    `# CONTEXT`,
    `Total target duration: ~${totalDuration} seconds`,
    `Format: 9:16 vertical (mobile-first, optimized for Reels/TikTok/Shorts) — fill the entire 9:16 frame for every shot`,
    brandName ? `Brand: ${brandName}` : ``,
    ``,

    // STORYBOARD BREAKDOWN
    `# STORYBOARD BREAKDOWN (read panels left-to-right, top-to-bottom)`,
    `Each panel becomes one full-screen scene in the final video. Reproduce each panel's content as a standalone 9:16 shot:`,
    ``,
    narrative,
    ``,

    // DIRECTOR'S NOTES — applies expertise from multiple roles
    `# DIRECTOR'S NOTES (applying expertise as Director + DP + Editor)`,
    ``,
    `## Pacing & Rhythm (Director + Editor)`,
    `- Each panel represents approximately 3 seconds of video`,
    `- Maintain TVC commercial pacing — not too slow (boring), not too fast (chaotic)`,
    `- Build emotional momentum: hook → tension → resolution → call-to-action`,
    `- Final logo panel should hold for clean brand recall`,
    ``,
    `## Camera Direction (Cinematographer/DP)`,
    `- ${cameraHint}`,
    `- Match camera language to scene emotion: intimate close-ups for product reveal, wider shots for lifestyle, hero shots for confidence moments`,
    `- Maintain consistent depth of field (cinematic shallow focus)`,
    `- Smooth camera transitions only — no jarring cuts or shaky motion`,
    `- Each shot should fill the full 9:16 vertical frame — never show split-screen or grid layouts`,
    ``,
    `## Continuity (Editor)`,
    `- Same person across all panels — no identity drift, no facial morphing between scenes`,
    `- Same product packaging, same brand identity throughout`,
    `- Lighting consistency: same color temperature, same mood, same time-of-day feel`,
    `- Wardrobe continuity unless storyboard shows intentional outfit changes`,
    ``,
    `## Motion Quality`,
    `- Natural human movement at realistic speed`,
    `- No teleportation, morphing, or supernatural transitions between panels`,
    `- Subjects move with intention and grace — commercial-grade direction`,
    `- Product interactions look authentic, not staged or robotic`,
    ``,
    `## Brand Voice`,
    `- Premium, polished, aspirational tone (matching TVC commercial standards from agencies like Ogilvy, BBDO, Wieden+Kennedy)`,
    `- ${brandName ? `Reflects ${brandName} brand values` : `Brand-friendly aesthetic`}`,
    `- Audience-appropriate emotional register`,
    ``,

    // OUTPUT REQUIREMENTS
    `# OUTPUT`,
    `Generate a single ~${totalDuration}-second video at 9:16 vertical aspect ratio. The video shows the scenes from the storyboard panels played in sequence as full-screen shots — NOT the grid storyboard image itself. Smooth cinematic transitions between scenes. Unified visual style throughout. Do NOT render any text labels, frame numbers, panel borders, or timing markers in the output video — only the brand logo and tagline (if any) should appear in the final logo scene.`,
    ``,

    // AVOID LIST
    `# AVOID`,
    `- ❌ Showing the storyboard grid layout on screen (panels, borders, multiple frames at once)`,
    `- ❌ "Page-turning" or "panel-switching" transition effects`,
    `- ❌ Visible panel numbers, timing labels (0:00-0:03s), or storyboard text overlays`,
    `- ❌ Letterboxed or split-screen layouts — every shot fills the full 9:16 frame`,
    `- Identity drift between scenes (same person must remain recognizable)`,
    `- Product redesign or simplified branding`,
    `- Inconsistent lighting or color grading between scenes`,
    `- Jerky motion, abrupt cuts, or jarring transitions`,
    `- Watermarks, artifacts, or AI generation signatures`,
    `- Unrealistic motion (teleportation, morphing, supernatural effects)`,
    `- Generic stock footage feel — this should look like a directed commercial`,
  ].filter(Boolean).join("\n");
}

/**
 * v0.7.0: Generate provider-aware chunked prompts.
 *
 * Each chunk is a complete, standalone prompt that fits within the provider's
 * max single-clip duration. For multi-chunk plans, prompts include continuity
 * directives so chunk N+1 picks up where chunk N left off.
 */
import type { ChunkPlan, PlanResult } from "./chunkPlanner";

export interface ProviderChunkPrompt {
  chunkNum: number;
  totalChunks: number;
  duration: number;
  /** Frames covered by this chunk */
  frameRange: string;
  /** The actual prompt text */
  prompt: string;
}

export interface ProviderAwareOptions {
  plan: PlanResult;
  cameraStyle?: "static" | "subtle" | "dynamic" | "cinematic";
  brandName?: string;
  tagline?: string;
  /** v0.7.2: Aspect ratio for video output */
  aspectRatio?: string;
  /** v0.8.0: Animation style for film mode (live_action/anime_2d/etc) */
  animationStyle?: string;
  /** v0.8.0: Film genre (action/drama/etc) */
  filmGenre?: string;
  /** v0.8.0: Film characters cast */
  filmCharacters?: Array<{
    name: string;
    role: string;
    description?: string;
  }>;
  /** v0.8.0: True if film mode (changes "TVC director" → "film director" framing) */
  isFilmMode?: boolean;
}

export function generateProviderAwarePrompts(opts: ProviderAwareOptions): ProviderChunkPrompt[] {
  const {
    plan,
    cameraStyle = "subtle",
    brandName,
    tagline,
    aspectRatio = "9:16",
    animationStyle,
    filmGenre,
    filmCharacters,
    isFilmMode = false,
  } = opts;
  const cameraHint = CAMERA_MOVEMENT_HINTS[cameraStyle];
  const provider = plan.provider;

  return plan.chunks.map((chunk) => {
    const prompt = buildChunkPrompt(
      chunk,
      plan,
      cameraHint,
      brandName,
      tagline,
      aspectRatio,
      animationStyle,
      filmGenre,
      filmCharacters,
      isFilmMode,
    );
    return {
      chunkNum: chunk.chunkNum,
      totalChunks: chunk.totalChunks,
      duration: chunk.duration,
      frameRange: chunk.totalChunks === 1
        ? `Frames ${chunk.startFrameNum}-${chunk.endFrameNum}`
        : `Chunk ${chunk.chunkNum}/${chunk.totalChunks} — Frames ${chunk.startFrameNum}-${chunk.endFrameNum}`,
      prompt,
    };
  });
}

function buildChunkPrompt(
  chunk: ChunkPlan,
  plan: PlanResult,
  cameraHint: string,
  brandName: string | undefined,
  tagline: string | undefined,
  aspectRatio: string,
  animationStyle?: string,
  filmGenre?: string,
  filmCharacters?: Array<{ name: string; role: string; description?: string }>,
  isFilmMode: boolean = false,
): string {
  const provider = plan.provider;
  const isMultiChunk = chunk.totalChunks > 1;
  const isFirstChunk = chunk.chunkNum === 1;
  const isLastChunk = chunk.chunkNum === chunk.totalChunks;

  const aspectDescription = describeAspectRatio(aspectRatio);

  // v0.7.3: Strip aspect-conflicting text from frame actions
  function cleanFrameAction(action: string): string {
    return action
      .replace(/\.?\s*Vertical 9:16\.?/gi, "")
      .replace(/\.?\s*Horizontal 16:9\.?/gi, "")
      .replace(/\.?\s*Square 1:1\.?/gi, "")
      .replace(/\s*\(9:16\)/gi, "")
      .replace(/\s*\(16:9\)/gi, "")
      .replace(/\s*\(1:1\)/gi, "")
      .trim();
  }

  // v0.7.4: COMPACT prompt format — fits within Seedance 4000 char limit
  // Uses Seedance native "0–Xs:" multi-shot format which is optimal per official docs
  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // Multi-shot breakdown using Seedance-recommended format
  const shots = chunk.frames.map((f, idx) => {
    const startSec = chunk.cumulativeStartSec + idx * chunk.secondsPerFrame;
    const endSec = startSec + chunk.secondsPerFrame;
    const cleanAction = cleanFrameAction(f.action);
    return `${fmtTime(startSec)}–${fmtTime(endSec)} (${f.role}): ${cleanAction}`;
  }).join("\n");

  // Continuity note for multi-chunk plans (compact)
  let continuityNote = "";
  if (isMultiChunk) {
    if (isFirstChunk) {
      continuityNote = ` Part ${chunk.chunkNum}/${chunk.totalChunks}: end clip in motion ready to continue, no logo yet.`;
    } else if (isLastChunk) {
      const prevLast = plan.chunks[chunk.chunkNum - 2].frames.slice(-1)[0];
      continuityNote = ` Part ${chunk.chunkNum}/${chunk.totalChunks} (FINAL): continue from previous "${prevLast.role}" scene with same person/lighting/outfit. Include brand logo cleanly in final scene.`;
    } else {
      const prevLast = plan.chunks[chunk.chunkNum - 2].frames.slice(-1)[0];
      continuityNote = ` Part ${chunk.chunkNum}/${chunk.totalChunks}: continue from previous "${prevLast.role}" scene with same person/lighting/outfit. End ready for next part.`;
    }
  }

  const brandLine = brandName
    ? `Brand: ${brandName}${tagline ? ` (tagline: "${tagline}")` : ""}.`
    : "";

  // Compact prompt — follows Seedance multi-shot best practice
  // ROLE kept (AI needs context for tone/style), metadata removed (set in UI)

  // v0.8.0: Film vs TVC context
  const ANIMATION_STYLE_DESCRIPTORS: Record<string, string> = {
    live_action: "live action cinematography, photorealistic, 35mm film aesthetic, ARRI Alexa camera, professional color grading, cinematic depth of field",
    anime_2d: "2D anime style, hand-drawn aesthetic, Studio Ghibli inspiration, vibrant colors, expressive character design, anime cel shading",
    cgi_3d: "3D CGI animation, Pixar/DreamWorks style, polished rendering, expressive character animation, vibrant colors, cinematic lighting in 3D space",
    stop_motion: "stop-motion animation, handcrafted puppet aesthetic, Wes Anderson / Aardman / Laika style, tactile texture, slight choppy 12fps feel",
    cartoon_2d: "2D cartoon style, flat colors, Western animation aesthetic, bold outlines, expressive character design",
    film_noir: "film noir style, black and white cinematography, high-contrast chiaroscuro lighting, 1940s-50s aesthetic, dramatic shadows",
  };

  const roleLine = isFilmMode
    ? `You are an experienced film director${filmGenre ? ` specializing in ${filmGenre.replace("_", "-")} films` : ""}. Direct a cinematic ${chunk.frames.length}-shot scene with strong visual storytelling.${continuityNote}`
    : `You are an experienced TVC commercial director. Direct a cinematic ${chunk.frames.length}-shot premium brand commercial.${continuityNote}`;

  const styleLine = isFilmMode && animationStyle
    ? `Style: ${ANIMATION_STYLE_DESCRIPTORS[animationStyle] || ANIMATION_STYLE_DESCRIPTORS.live_action}. Consistent style, lighting, and color grading across all shots.`
    : `Style: Premium TVC commercial quality, photorealistic, 35mm film aesthetic, professional color grading, sharp focus, cinematic depth of field. Same person, same outfit, and same lighting consistent across all shots.`;

  // v0.8.0: Multi-character continuity line
  let castLine = "";
  if (isFilmMode && filmCharacters && filmCharacters.length > 0) {
    const castSummary = filmCharacters
      .map((c) => `${c.name} (${c.role})`)
      .join(", ");
    castLine = `Cast: ${castSummary}. Each character maintains their own distinct identity throughout — do not blend or swap their features between shots.`;
  }

  // Avoid line — different for film vs TVC
  const avoidLine = isFilmMode
    ? `Avoid: character identity drift between shots, inconsistent lighting, jerky motion, page-turning effects, watermarks, AI artifacts, visible text overlays.`
    : `Avoid: identity drift between shots, product redesign, inconsistent lighting, jerky motion, page-turning effects, watermarks, AI artifacts.`;

  const prompt = [
    roleLine,
    ``,
    `Multi-shot breakdown:`,
    shots,
    ``,
    `Camera: ${cameraHint}. Smooth cinematic transitions between shots. ${brandLine}`,
    castLine,
    ``,
    styleLine,
    ``,
    `Important: The attached image is a storyboard reference grid showing planned shots — do NOT render the grid layout, panel borders, or multiple frames at once. Each shot fills the entire video frame as a standalone scene. No visible text overlays, panel numbers, or timing markers in the output${isLastChunk && brandName ? ` (only the brand logo appears in the final scene)` : ""}.`,
    ``,
    avoidLine,
  ].filter((s) => s !== "").join("\n");

  return prompt;
}

function getNextRoleHint(currentChunk: ChunkPlan, plan: PlanResult): string {
  const nextChunk = plan.chunks[currentChunk.chunkNum];
  if (!nextChunk) return "next scene";
  return nextChunk.frames[0]?.role || "next scene";
}

/**
 * Generate a stitching guide README for multi-chunk plans.
 */
export function generateStitchingGuide(plan: PlanResult, brandName?: string, aspectRatio: string = "9:16"): string {
  if (plan.isSingleShot) {
    return `# Single-shot workflow

Provider: ${plan.provider.name}
Total duration: ${plan.actualDuration}s
Frames: ${plan.chunks[0].frames.length}

## Steps

1. Open ${plan.provider.name} (${plan.provider.url})
2. Upload the grid storyboard image as reference
3. Paste the prompt from \`prompt_chunk_01.txt\`
4. Generate → ~${plan.actualDuration}s video
5. Download — done!

No stitching needed. Single clip is your final TVC.
`;
  }

  return `# Multi-chunk workflow

Provider: ${plan.provider.name} (max ${plan.provider.maxClipDuration}s/clip)
Target total duration: ${plan.targetDuration}s
Actual total: ${plan.actualDuration}s
Number of clips to generate: ${plan.chunks.length}

## Why multi-chunk?

${plan.provider.name} can only generate up to ${plan.provider.maxClipDuration}s per clip. To reach ${plan.targetDuration}s total, we split the storyboard into ${plan.chunks.length} clips:

${plan.chunks.map((c) => `- **Clip ${c.chunkNum}** (${c.duration}s): Frames ${c.startFrameNum}-${c.endFrameNum} (${c.frames.map((f) => f.role).join(", ")})`).join("\n")}

## Generation steps (do for each clip)

For each chunk_NN.txt:
1. Open ${plan.provider.name} (${plan.provider.url})
2. Upload the grid storyboard image as reference
3. Paste the prompt from \`prompt_chunk_NN.txt\`
4. Generate → ~${plan.chunks[0].duration}s video
5. Download as \`clip_NN.mp4\`

## Stitching in CapCut/Premiere/DaVinci Resolve

1. Open editor and create new ${aspectRatio} project
2. Drop \`clip_01.mp4\` → \`clip_${String(plan.chunks.length).padStart(2, "0")}.mp4\` in order
3. Add **smooth crossfade** between clips (0.3-0.5s overlap, "Dissolve" or "Cross Dissolve")
4. Verify continuity — same person, same lighting, same mood
5. Add background music + voiceover
6. ${brandName ? `Verify ${brandName} logo appears cleanly at the end` : ""}
7. Export as appropriate resolution MP4 (${aspectRatio})

## Tips for stitching

- **Color grading:** If clips don't quite match, apply same color grading to all clips
- **Audio:** Use single background music track across all clips, not per-clip audio
- **Pacing:** If a clip feels too long/short, trim within editor
- **Continuity errors:** If person looks different between clips, regenerate with stronger reference

## Final assembly

Total duration after stitching: ~${plan.actualDuration}s
Recommended export: H.264 MP4, 30fps, 1080×1920 or 2160×3840 vertical
`;
}
