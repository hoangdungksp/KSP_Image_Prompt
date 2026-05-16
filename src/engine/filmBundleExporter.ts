/**
 * KSP Image v0.9.3-r6 — Film Bundle Exporter (Mockup 5)
 *
 * Exports complete project bundle as ZIP per MOCKUPS_FILM.md spec verbatim:
 *
 *   {project-slug}-bundle.zip
 *   ├── README.md
 *   ├── script.txt              (Hướng A: plain text, jsPDF defer 0.9.4)
 *   ├── cast/
 *   │   ├── {char}_face_01.png ... 0N.png
 *   │   └── {char}_body_01.png ... 0M.png
 *   ├── shots/
 *   │   └── scene{N}_shot{M}_{type}/
 *   │       ├── grid_{NxM}.png
 *   │       ├── cropped/01.png ... 0K.png
 *   │       ├── image_prompt.txt
 *   │       └── animation_prompt_{providerId}.txt
 *   ├── voice/               (empty if no_dialog)
 *   │   └── {characterName}_lines.txt
 *   ├── music/
 *   │   ├── scene{N}_brief.txt
 *   │   └── full_score_arc.txt
 *   └── sfx/
 *       ├── sfx_list_per_scene.md
 *       └── freesound_links.txt  (or epidemic_search.md / suno_sfx_prompts.md)
 *
 * Pure async function — no UI dependency. Returns Blob ready for download.
 */

import JSZip from "jszip";
import type { PromptProject, ProjectV09Extensions } from "../types";
import type { FilmShot, FilmSceneScript, FilmScript } from "../types/project";
import { ensureFilmData, getAllVideoProviders } from "../store/film_actions";
import {
  resolveVideoProvider,
  VOICE_PROVIDER_LABELS,
  SFX_PROVIDER_LABELS,
  type FilmCharacter,
  type FilmSfxProvider,
} from "../types/film";

type Proj = PromptProject & ProjectV09Extensions;

// ============================================================================
// MAIN EXPORT
// ============================================================================

export interface BundleExportStats {
  characterCount: number;
  sceneCount: number;
  shotCount: number;
  totalImages: number;
  voiceLineCount: number;
  estimatedSizeKb: number;
}

export async function exportFilmBundle(project: PromptProject): Promise<{
  blob: Blob;
  filename: string;
  stats: BundleExportStats;
}> {
  const proj = project as Proj;
  const film = ensureFilmData(project);
  const setting = (proj as any).settingV2;
  if (!setting) {
    throw new Error("Project settingV2 missing — cannot export bundle");
  }

  const zip = new JSZip();
  const stats: BundleExportStats = {
    characterCount: film.characters.length,
    sceneCount: film.script?.scenes.length ?? 0,
    shotCount: 0,
    totalImages: 0,
    voiceLineCount: 0,
    estimatedSizeKb: 0,
  };

  // README.md
  zip.file("README.md", buildReadme(proj, film, setting, stats));

  // script.txt (Hướng A — plain text, jsPDF defer 0.9.4)
  if (film.script) {
    zip.file("script.txt", buildScriptTxt(film.script));
  }

  // cast/ — face + body refs
  film.characters.forEach((c) => {
    const safeName = sanitize(c.name || `char${c.order}`);
    c.faceRefs.forEach((ref, i) => {
      const idx = String(i + 1).padStart(2, "0");
      const ext = filenameExt(ref.filename);
      zip.file(
        `cast/${safeName}_face_${idx}.${ext}`,
        dataUrlToBlob(ref.dataUrl)
      );
      stats.totalImages++;
    });
    c.bodyRefs.forEach((ref, i) => {
      const idx = String(i + 1).padStart(2, "0");
      const ext = filenameExt(ref.filename);
      zip.file(
        `cast/${safeName}_body_${idx}.${ext}`,
        dataUrlToBlob(ref.dataUrl)
      );
      stats.totalImages++;
    });
  });

  // shots/ — grid PNG + cropped frames + image_prompt.txt + animation_prompt_{provider}.txt
  if (film.script) {
    for (const scene of film.script.scenes) {
      const shots = film.shotsBySceneId?.[scene.id] ?? [];
      stats.shotCount += shots.length;
      for (const shot of shots) {
        const sceneNum = String(scene.order).padStart(2, "0");
        const shotNum = String(shot.order).padStart(2, "0");
        const shotDir = `shots/scene${sceneNum}_shot${shotNum}_${shot.shotType}/`;

        // grid PNG (r5 inline base64)
        if (shot.gridImageDataUrl) {
          zip.file(`${shotDir}grid_${shot.gridFormat}.png`, dataUrlToBlob(shot.gridImageDataUrl));
          stats.totalImages++;
        }

        // cropped frames
        (shot.framesR5 ?? []).forEach((frame) => {
          if (frame.dataUrl) {
            const fIdx = String(frame.order).padStart(2, "0");
            zip.file(`${shotDir}cropped/${fIdx}.png`, dataUrlToBlob(frame.dataUrl));
            stats.totalImages++;
          }
        });

        // image_prompt.txt
        if (shot.imagePromptR5) {
          zip.file(`${shotDir}image_prompt.txt`, shot.imagePromptR5);
        }

        // animation_prompt_{providerId}.txt
        if (shot.animationPromptR5) {
          const providerId = shot.videoProviderId ?? "seedance-2-pro";
          zip.file(
            `${shotDir}animation_prompt_${providerId}.txt`,
            shot.animationPromptR5
          );
        }
      }
    }
  }

  // voice/ — per-character lines (only if has_dialog)
  if (setting.dialog === "has_dialog" && film.script) {
    const linesByCharId: Record<string, { name: string; lines: string[] }> = {};
    for (const scene of film.script.scenes) {
      for (const d of scene.dialog ?? []) {
        if (!linesByCharId[d.characterId]) {
          linesByCharId[d.characterId] = { name: d.characterName, lines: [] };
        }
        const sceneLabel = `[Scene ${scene.order}]`;
        const parenthetical = d.parenthetical ? `(${d.parenthetical}) ` : "";
        const lineText = d.lineVi ? `EN: ${d.lineEn}\nVI: ${d.lineVi}` : d.lineEn;
        linesByCharId[d.characterId].lines.push(
          `${sceneLabel} ${parenthetical}\n${lineText}\n`
        );
        stats.voiceLineCount++;
      }
    }
    Object.entries(linesByCharId).forEach(([_charId, { name, lines }]) => {
      const safeName = sanitize(name);
      const voiceProvider = resolveCharVoiceProvider(_charId, film);
      const header = `# Voice lines: ${name}\nProvider: ${voiceProvider}\nTotal lines: ${lines.length}\n\n---\n\n`;
      zip.file(`voice/${safeName}_lines.txt`, header + lines.join("\n"));
    });
  } else {
    zip.file("voice/.gitkeep", "(no dialog mode — voice folder empty)");
  }

  // music/ — per-scene brief + full_score_arc
  if (film.script) {
    const briefs: string[] = [];
    for (const scene of film.script.scenes) {
      const sceneNum = String(scene.order).padStart(2, "0");
      const brief = scene.musicBrief?.trim() || "(no brief yet — generate via Music section)";
      const header = `# Music brief — Scene ${scene.order}: ${scene.titleEn || scene.titleVi || ""}\nDuration: ${scene.durationSeconds}s\n\n`;
      zip.file(`music/scene${sceneNum}_brief.txt`, header + brief);
      briefs.push(`## Scene ${scene.order}: ${scene.titleEn || scene.titleVi || ""}\n${brief}\n`);
    }
    // Hướng A: auto-derived full score arc
    zip.file(
      "music/full_score_arc.txt",
      `# Full Score Arc\n# Auto-concatenated from all scene briefs.\n# Use this as composer brief for overall musical concept.\n\n${briefs.join("\n---\n\n")}`
    );
  }

  // sfx/ — list + provider-specific links
  if (film.script) {
    const sfxProvider = film.sfxProvider ?? "freesound";
    let sfxListMd = "# SFX list per scene\n\n";
    const freesoundUrls: string[] = [];
    const epidemicHints: string[] = [];
    const sunoPrompts: string[] = [];

    for (const scene of film.script.scenes) {
      if (!scene.sfx || scene.sfx.length === 0) continue;
      sfxListMd += `## Scene ${scene.order}\n`;
      for (const cue of scene.sfx) {
        sfxListMd += `- ${cue}\n`;
        const cleanCue = cue.replace(/[^\w\s]/g, "").trim();
        if (cleanCue) {
          freesoundUrls.push(
            `# Scene ${scene.order} — ${cue}\nhttps://freesound.org/search/?q=${encodeURIComponent(cleanCue)}\n`
          );
          epidemicHints.push(`# Scene ${scene.order} — ${cue}\nSearch Epidemic Sound library: "${cleanCue}"\n`);
          sunoPrompts.push(
            `# Scene ${scene.order} — ${cue}\nSuno SFX prompt: ${cue}, sound effect, cinematic, isolated track\n`
          );
        }
      }
      sfxListMd += "\n";
    }
    zip.file("sfx/sfx_list_per_scene.md", sfxListMd);

    if (sfxProvider === "freesound" && freesoundUrls.length) {
      zip.file("sfx/freesound_links.txt", freesoundUrls.join("\n"));
    } else if (sfxProvider === "epidemic" && epidemicHints.length) {
      zip.file("sfx/epidemic_search.md", epidemicHints.join("\n"));
    } else if (sfxProvider === "suno-sfx" && sunoPrompts.length) {
      zip.file("sfx/suno_sfx_prompts.md", sunoPrompts.join("\n"));
    }
  }

  // Generate
  const blob = await zip.generateAsync({ type: "blob" });
  stats.estimatedSizeKb = Math.round(blob.size / 1024);

  const slug = sanitize(setting.name || proj.name || "film-bundle");
  const filename = `${slug}-bundle.zip`;
  return { blob, filename, stats };
}

// ============================================================================
// FOLDER TREE PREVIEW (for UI display — read-only)
// ============================================================================

/**
 * Generate ASCII tree preview of what the ZIP will contain.
 * Used by FilmBundleExportSection UI before download.
 */
export function previewBundleTree(project: PromptProject): string {
  const proj = project as Proj;
  const film = ensureFilmData(project);
  const setting = (proj as any).settingV2;
  const slug = sanitize(setting?.name || proj.name || "film-bundle");

  const lines: string[] = [];
  lines.push(`${slug}-bundle.zip`);
  lines.push("├── README.md");
  if (film.script) lines.push("├── script.txt");

  // cast/
  const castFiles = film.characters.reduce(
    (sum, c) => sum + c.faceRefs.length + c.bodyRefs.length,
    0
  );
  lines.push(`├── cast/                   (${castFiles} images, ${film.characters.length} characters)`);

  // shots/
  const totalShots =
    film.script?.scenes.reduce(
      (sum, sc) => sum + (film.shotsBySceneId?.[sc.id]?.length ?? 0),
      0
    ) ?? 0;
  lines.push(`├── shots/                  (${totalShots} shots)`);
  if (totalShots > 0) {
    lines.push("│   └── scene{N}_shot{M}_{type}/");
    lines.push("│       ├── grid_{NxM}.png");
    lines.push("│       ├── cropped/01.png ... 0K.png");
    lines.push("│       ├── image_prompt.txt");
    lines.push("│       └── animation_prompt_{provider}.txt");
  }

  // voice/
  if (setting?.dialog === "has_dialog") {
    let voiceLines = 0;
    if (film.script) {
      for (const sc of film.script.scenes) voiceLines += sc.dialog?.length ?? 0;
    }
    lines.push(`├── voice/                  (${voiceLines} dialog lines)`);
  } else {
    lines.push("├── voice/                  (empty — no_dialog mode)");
  }

  // music/
  const briefCount = film.script?.scenes.filter((s) => s.musicBrief?.trim()).length ?? 0;
  lines.push(`├── music/                  (${film.script?.scenes.length ?? 0} scene briefs, ${briefCount} filled)`);
  lines.push("│   ├── scene{N}_brief.txt");
  lines.push("│   └── full_score_arc.txt");

  // sfx/
  const sfxProvider = film.sfxProvider ?? "freesound";
  let sfxCount = 0;
  film.script?.scenes.forEach((s) => (sfxCount += s.sfx?.length ?? 0));
  lines.push(`└── sfx/                    (${sfxCount} cues, ${SFX_PROVIDER_LABELS[sfxProvider].name})`);
  lines.push("    ├── sfx_list_per_scene.md");
  lines.push(`    └── ${sfxProvider === "freesound" ? "freesound_links.txt" : sfxProvider === "epidemic" ? "epidemic_search.md" : "suno_sfx_prompts.md"}`);

  return lines.join("\n");
}

// ============================================================================
// HELPERS
// ============================================================================

function sanitize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

function filenameExt(filename: string): string {
  const m = filename.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "png";
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] ?? "application/octet-stream";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function resolveCharVoiceProvider(charId: string, film: ReturnType<typeof ensureFilmData>): string {
  const assignment = film.voiceAssignments?.[charId];
  if (assignment === null) return "(skipped — no voice)";
  const provider = assignment ?? film.voiceProviderGlobal ?? "elevenlabs";
  return VOICE_PROVIDER_LABELS[provider].name;
}

function buildReadme(
  _proj: Proj,
  film: ReturnType<typeof ensureFilmData>,
  setting: any,
  _stats: BundleExportStats
): string {
  const lines: string[] = [];
  lines.push(`# ${setting.name || "Film bundle"}`);
  lines.push("");
  lines.push(`Generated by **KSP Image** v0.9.3-r6 — ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Project");
  lines.push(`- Mode: Film / Short Film`);
  lines.push(`- Genre: ${setting.genre ?? "—"}`);
  lines.push(`- Animation style: ${setting.animationStyle ?? "—"}`);
  lines.push(`- Aspect ratio: ${setting.aspectRatio}`);
  lines.push(`- Duration: ${setting.durationMinutes ?? "—"} minutes`);
  lines.push(`- Dialog: ${setting.dialog === "has_dialog" ? "Yes" : "No"}`);
  lines.push("");
  lines.push("## Cast");
  film.characters.forEach((c) => {
    lines.push(`- **${c.name || `Character ${c.order}`}** (${c.role}) — ${c.faceRefs.length} face refs + ${c.bodyRefs.length} body refs`);
  });
  if (film.characters.length === 0) lines.push("(no characters yet)");
  lines.push("");
  lines.push("## How to use this bundle");
  lines.push("");
  lines.push("1. **Cast references** (`cast/`): face + body images for each character. Use these as reference inputs when generating images in Banana Pro / Nano Banana.");
  lines.push("2. **Shots** (`shots/`): one folder per shot, named `scene{N}_shot{M}_{shotType}/`.");
  lines.push("   - `image_prompt.txt`: paste into Banana Pro along with cast refs → get the storyboard grid image.");
  lines.push("   - `grid_{NxM}.png`: the generated storyboard grid (if uploaded back to KSP).");
  lines.push("   - `cropped/`: individual cells auto-cropped from the grid.");
  lines.push("   - `animation_prompt_{provider}.txt`: paste into your video AI (Seedance/Veo/Kling/Sora/custom) to animate.");
  lines.push("3. **Voice** (`voice/`): dialog lines per character, organized by scene. Empty when project is no_dialog.");
  lines.push("4. **Music** (`music/`): per-scene briefs ready for Suno/Udio. Plus `full_score_arc.txt` for overall composer brief.");
  lines.push("5. **SFX** (`sfx/`): cue list per scene plus provider-specific search links.");
  lines.push("");
  lines.push("## Final assembly");
  lines.push("");
  lines.push("Once you have all the AI-generated assets (cropped frames + animated clips + voice audio + music + SFX), assemble in your editor of choice (CapCut, DaVinci Resolve, Premiere). The KSP Image extension is the **planning + prompt-generation** layer — final cut happens externally.");
  lines.push("");
  return lines.join("\n");
}

function buildScriptTxt(script: FilmScript): string {
  const lines: string[] = [];
  lines.push(`# ${script.titleEn || script.titleVi || "Untitled Film"}`);
  if (script.logline) {
    lines.push("");
    lines.push(`> ${script.logline}`);
  }
  if (script.synopsisEn) {
    lines.push("");
    lines.push("## Synopsis");
    lines.push(script.synopsisEn);
    if (script.synopsisVi) {
      lines.push("");
      lines.push(`(VN) ${script.synopsisVi}`);
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  for (const scene of script.scenes) {
    lines.push(`## SCENE ${scene.order} — ${scene.titleEn || scene.titleVi || ""}`);
    lines.push(`${scene.settings}`);
    lines.push(`Duration: ${scene.durationSeconds}s · Act: ${scene.act}`);
    lines.push("");
    if (scene.actionLinesEn) {
      lines.push(scene.actionLinesEn);
      lines.push("");
    }
    for (const d of scene.dialog ?? []) {
      lines.push(`**${d.characterName.toUpperCase()}**`);
      if (d.parenthetical) lines.push(`(${d.parenthetical})`);
      lines.push(d.lineEn);
      if (d.lineVi) lines.push(`[VN] ${d.lineVi}`);
      lines.push("");
    }
    if (scene.sfx && scene.sfx.length) {
      lines.push(`SFX: ${scene.sfx.join(", ")}`);
    }
    if (scene.musicBrief) {
      lines.push(`MUSIC: ${scene.musicBrief}`);
    }
    if (scene.transitionToNext) {
      lines.push(`TRANSITION: ${scene.transitionToNext}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}
