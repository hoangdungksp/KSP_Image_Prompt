/**
 * KSP Image v0.9.0 — Bundle Export (Mockup 5)
 *
 * Generates ZIP package containing:
 * - README.md (workflow guide)
 * - script.md (Film) or concept.md (TVC)
 * - cast/ (face + body refs as PNG)
 * - shots/<scene_shot>/grid.png + cropped/01-09.png + image_prompt.txt + animation_prompt_<provider>.txt
 * - voice/ (placeholder for audio files)
 * - music/ (per-scene briefs + full score arc)
 * - sfx/ (sfx_list.md + freesound_links.txt)
 *
 * User downloads → unpacks → uses content with external tools.
 */

import React, { useState } from "react";
import JSZip from "jszip";
import { useAppStore } from "../store/useAppStore";
import { migrateProjectToV09 } from "../store/migration_v09";
import type {
  ProjectModeV2,
  FilmShot,
  FilmSceneShot,
  AnimationChunk,
} from "../types/v0_9_0";

export function BundleExportV09() {
  const project = useAppStore((s) => s.currentProject);
  const showToast = useAppStore((s) => s.showToast);
  const [building, setBuilding] = useState(false);

  if (!project) return null;
  const migrated = migrateProjectToV09(project);
  const mode = (migrated.settingV2?.mode ?? "photos") as ProjectModeV2;

  if (mode === "photos" || mode === "product_photo") return null; // Bundle for film+tvc

  async function buildBundle() {
    setBuilding(true);
    try {
      const zip = new JSZip();
      const setting = migrated.settingV2!;
      const projectName = setting.name.replace(/\s+/g, "-").toLowerCase();

      // 1. README.md
      zip.file("README.md", buildReadme(migrated));

      // 2. Script (Film) or Concept (TVC)
      if (mode === "film" && migrated.script) {
        zip.file("script.md", buildScriptMd(migrated.script));
      }
      if (mode === "tvc_commercial" && migrated.concept) {
        zip.file("concept.md", buildConceptMd(migrated.concept));
      }

      // 3. Cast folder
      if (migrated.filmCharactersV2?.length) {
        const castFolder = zip.folder("cast")!;
        castFolder.file(
          "_README.md",
          `# Cast Reference Images\n\nUse these images as reference when generating shots in Banana Pro / Imagen.\nMaintain character consistency across all shots.\n\n` +
            migrated.filmCharactersV2
              .map(
                (c) =>
                  `## ${c.name} (${c.role})\n\n${c.description}\n\nUnique markers: ${c.uniqueIdentifiers}\n\nFace refs: ${c.faceRefs.length}\nBody refs: ${c.bodyRefs.length}\n`
              )
              .join("\n")
        );
        // NOTE: Actual image binary saving from IndexedDB requires Phase 5 wire-up
      }

      // 4. Shots folder (Film mode)
      if (mode === "film" && migrated.filmStructureV2) {
        const shotsFolder = zip.folder("shots")!;
        for (const sceneShot of migrated.filmStructureV2.scenes) {
          const scriptScene = migrated.script?.scenes.find((s) => s.id === sceneShot.id);
          for (const shot of sceneShot.shots) {
            const folderName = sanitize(
              `scene${(scriptScene?.order ?? 0) + 1}_shot${shot.order + 1}_${shot.titleEn}`
            );
            const shotFolder = shotsFolder.folder(folderName)!;

            // Image prompt
            if (shot.imagePrompt) {
              shotFolder.file("image_prompt.txt", shot.imagePrompt);
            }

            // Animation chunks
            if (shot.animationPrompts?.length) {
              for (const chunk of shot.animationPrompts) {
                shotFolder.file(
                  `animation_prompt_chunk${chunk.order + 1}.txt`,
                  chunk.prompt
                );
              }
            }

            // Frames text
            if (shot.frames?.length) {
              const framesText = shot.frames
                .map(
                  (f) =>
                    `## Frame ${f.order + 1} (${f.timingSeconds.start}s - ${f.timingSeconds.end}s)\n\n**EN:** ${f.actionEn}\n\n**VI:** ${f.actionVi ?? "(no translation)"}\n`
                )
                .join("\n---\n\n");
              shotFolder.file("frames.md", framesText);
            }

            // Shot info
            shotFolder.file(
              "shot_info.md",
              `# ${shot.titleEn}\n\n- Type: ${shot.shotType}\n- Grid: ${shot.gridFormat}\n- Duration: ${shot.durationSeconds}s\n- Camera: ${shot.cameraMovement}\n- Status: ${shot.status}\n${shot.purpose ? `- Purpose: ${shot.purpose}\n` : ""}`
            );

            // Grid image + cropped frames (Phase 5 binary saving)
            if (shot.gridImageId) {
              shotFolder.file(
                "_GRID_IMAGE_NOTE.txt",
                `Grid image stored at ID: ${shot.gridImageId}\nBinary export requires IndexedDB integration (Phase 5).`
              );
            }
          }
        }
      }

      // 5. Voice folder
      if (migrated.voice) {
        const voiceFolder = zip.folder("voice")!;
        voiceFolder.file(
          "_README.md",
          `# Voice / Dialog\n\nProvider: ${migrated.voice.provider}\nNarrator: ${migrated.voice.narratorEnabled ? "Enabled" : "Disabled"}\n\n## Per-character voice configs\n\n` +
            Object.entries(migrated.voice.characterVoices)
              .map(([id, cfg]) => `### Character ${id}\n- Voice: ${cfg.voiceName} (${cfg.voiceId})\n- Language: ${cfg.language}\n- Characteristics: ${cfg.characteristics}\n`)
              .join("\n")
        );
        if (migrated.voice.narratorConfig) {
          voiceFolder.file(
            "narrator_script.md",
            `# Narrator Script\n\n## Voice characteristics\n${migrated.voice.narratorConfig.voiceConfig.characteristics}\n\n## Script (EN)\n\n${migrated.voice.narratorConfig.scriptEn}\n\n## Script (VI)\n\n${migrated.voice.narratorConfig.scriptVi ?? ""}`
          );
        }
      }

      // 6. Music folder
      if (migrated.musicSfx) {
        const musicFolder = zip.folder("music")!;
        musicFolder.file(
          "_README.md",
          `# Music briefs\n\nPaste each brief into Suno or Udio to generate music.\n\nProvider: ${migrated.musicSfx.sfxProvider}`
        );
        for (const m of migrated.musicSfx.perSceneMusic) {
          musicFolder.file(
            `scene_${m.sceneId}_brief.txt`,
            `Duration: ${m.durationSeconds}s\nMood: ${m.mood.join(", ")}\n\nPROMPT FOR SUNO:\n${m.brief}`
          );
        }
        if (migrated.musicSfx.fullScoreArc) {
          musicFolder.file("full_score_arc.md", migrated.musicSfx.fullScoreArc);
        }
      }

      // 7. SFX folder
      if (migrated.musicSfx?.sfxByScene.length) {
        const sfxFolder = zip.folder("sfx")!;
        const sfxList = migrated.musicSfx.sfxByScene
          .map((s) => `## Scene ${s.sceneId}\n\n${s.sfx.map((x) => `- ${x}`).join("\n")}`)
          .join("\n\n");
        sfxFolder.file("sfx_list_per_scene.md", sfxList);
        sfxFolder.file(
          "_README.md",
          `# Sound Effects\n\nSource: ${migrated.musicSfx.sfxProvider}\n\nFor freesound.org: search each SFX term, download CC0/CC-BY licensed.\nFor Epidemic Sound: requires subscription.\nFor Suno SFX: paste each item as separate prompt.`
        );
      }

      // Generate ZIP
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName}-bundle-v090.zip`;
      a.click();
      URL.revokeObjectURL(url);

      showToast("✓ Bundle ZIP downloaded", "success");
    } catch (err: any) {
      showToast(`Lỗi build bundle: ${err.message}`, "error");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <section className="ksp-section ksp-bundle-section">
      <header className="ksp-section-header">
        <span className="ksp-section-icon">📦</span>
        <h2 className="ksp-section-title">BUNDLE EXPORT</h2>
      </header>

      <div className="ksp-bundle-content">
        <p className="ksp-bundle-desc">
          Download all project assets as ZIP. Includes: script/concept, cast refs, shots
          (prompts + grids + cropped frames), voice configs, music briefs, SFX list.
        </p>

        <BundlePreview migrated={migrated} />

        <button
          className="ksp-btn ksp-btn-orange ksp-btn-lg"
          onClick={buildBundle}
          disabled={building}
        >
          {building ? "⚙ Building..." : "📥 Download Bundle ZIP"}
        </button>

        <div className="ksp-info-banner">
          ℹ️ Image binaries (grid PNG + cropped frames) require IndexedDB blob retrieval — wired up in Phase 5.
          Currently exports: prompts, scripts, configs, briefs, lists.
        </div>
      </div>
    </section>
  );
}

function BundlePreview({ migrated }: { migrated: any }) {
  const setting = migrated.settingV2;
  const cast = migrated.filmCharactersV2 ?? [];
  const filmStructure = migrated.filmStructureV2;
  const totalShots = filmStructure?.scenes.reduce(
    (sum: number, s: FilmSceneShot) => sum + s.shots.length,
    0
  ) ?? 0;
  const projectName = setting?.name?.replace(/\s+/g, "-").toLowerCase() ?? "project";

  return (
    <pre className="ksp-bundle-preview">
{`📦 ${projectName}-bundle-v090.zip
├── 📄 README.md
├── 📄 ${setting?.mode === "film" ? "script.md" : "concept.md"}
├── 📁 cast/  (${cast.length} characters)
${cast.map((c: any) => `│   └── ${c.name.toLowerCase().replace(/\s+/g, "_")}/  (face×${c.faceRefs.length}, body×${c.bodyRefs.length})`).join("\n")}
├── 📁 shots/  (${totalShots} shots)
│   └── scene1_shot1_*/
│       ├── image_prompt.txt
│       ├── animation_prompt_chunk1.txt
│       ├── frames.md
│       └── shot_info.md
${migrated.voice ? "├── 📁 voice/\n│   ├── _README.md\n│   └── narrator_script.md" : ""}
${migrated.musicSfx ? "├── 📁 music/  (per-scene briefs for Suno)\n├── 📁 sfx/  (sfx list)" : ""}
└── README.md  (workflow guide)`}
    </pre>
  );
}

// ============================================================================
// FORMATTERS
// ============================================================================

function buildReadme(p: any): string {
  const setting = p.settingV2;
  return `# ${setting.name}

> KSP Image v0.9.0 Bundle Export
> Generated: ${new Date().toISOString()}

## Project info

- **Mode:** ${setting.mode}
- **Genre:** ${setting.genre ?? "N/A"}
- **Animation Style:** ${setting.animationStyle ?? "N/A"}
- **Aspect Ratio:** ${setting.aspectRatio}
- **Duration:** ${setting.durationMinutes ?? "?"} minutes

## Workflow

This bundle contains everything needed to produce your ${setting.mode === "film" ? "film" : "TVC"} using external AI tools.

### Step-by-step:

1. **Read script.md** (or concept.md) for full narrative.
2. **Use cast/ images** as reference when generating shots in Banana Pro / Imagen.
3. **For each shot in shots/**:
   - Open \`image_prompt.txt\` → paste into Banana Pro Pro → generate grid
   - Auto-cropped cells should be created (or use the storyboard generator output)
   - For animation: open \`animation_prompt_chunk*.txt\` → paste into Seedance / Veo3 / Kling
4. **For voice/**: use \`narrator_script.md\` characteristics in ElevenLabs UI.
5. **For music/**: paste each \`*_brief.txt\` into Suno AI to generate music.
6. **For sfx/**: search Freesound.org for each item in \`sfx_list_per_scene.md\`.
7. **Edit final**: Combine clips + audio in CapCut / Premiere / DaVinci.

## Notes

- All AI prompts are in English (international cinema standard).
- Cast references must be uploaded in order matching prompt's "Image #N" mentions.
- Animation chunks are designed to match each video provider's max duration.

Generated by KSP Image v0.9.0 — https://github.com/anthropics/ksp
`;
}

function buildScriptMd(script: any): string {
  return `# ${script.titleEn}

${script.titleVi ? `*${script.titleVi}*\n` : ""}

> **Logline:** ${script.logline}
${script.loglineVi ? `> *${script.loglineVi}*\n` : ""}

## Synopsis

${script.synopsisEn}

${script.scenes.map((s: any) => `

---

## Scene ${s.order + 1}: ${s.titleEn}

**Settings:** ${s.settings}
**Duration:** ${s.durationSeconds}s
**Act:** ${s.act}

### Action

${s.actionLinesEn}

${s.dialog?.length ? "### Dialog\n\n" + s.dialog.map((d: any) => `**${d.characterName}** ${d.parenthetical ?? ""}\n> ${d.lineEn}\n${d.lineVi ? `> *${d.lineVi}*\n` : ""}`).join("\n\n") : ""}

### SFX

${(s.sfx ?? []).map((x: string) => `- ${x}`).join("\n")}

### Music brief

${s.musicBrief}

${s.transitionToNext ? `### Transition\n\n${s.transitionToNext}` : ""}
`).join("")}
`;
}

function buildConceptMd(concept: any): string {
  return `# Creative Concept (Treatment)

## Logline

${concept.loglineEn}
${concept.loglineVi ? `*${concept.loglineVi}*` : ""}

## Synopsis

${concept.synopsisEn}

## Tone & Mood

${concept.tone.map((t: string) => `- ${t}`).join("\n")}

## Target Audience

- **Demographic:** ${concept.audience.demographic}
- **Psychographic:** ${concept.audience.psychographic}
- **Platform:** ${concept.audience.platform}

## Key Messages

${concept.keyMessages.map((m: string, i: number) => `${i + 1}. ${m}`).join("\n")}

## Visual References

${concept.visualReferences.map((v: string) => `- ${v}`).join("\n")}

## Brand Voice

${concept.brandVoice}

## CTA / Logo End

${concept.ctaLogoEnd}
`;
}

function sanitize(s: string): string {
  return s
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()
    .slice(0, 60);
}
