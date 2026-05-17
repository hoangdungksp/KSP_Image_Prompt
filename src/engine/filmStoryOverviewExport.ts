/**
 * Sprint 1.0 r7.8 — Story Overview Export
 *
 * Builds a human-readable Vietnamese text overview of the entire film:
 * scenes (title + setting + duration + emotion + summary + dialog) + shots
 * (number + type + camera + duration + action). Result is plain UTF-8 text
 * ready to download as a single .txt file the user can read end-to-end as
 * "the whole story".
 *
 * NOT markdown — Jason requested plain text format "rõ ràng dễ đọc". We use
 * box-drawing dividers + indentation for hierarchy without depending on a
 * rendering engine.
 */

import type {
  FilmShot,
  ProjectSettingV2,
  FilmScript,
  FilmSceneScript,
} from "../types/project";
import {
  EMOTIONAL_TONE_LABELS,
} from "../types/project";
import type {
  FilmCharacter,
  FilmStoryFramework,
} from "../types/film";
import { FRAMEWORK_LABELS } from "../types/film";
import type { IdeaInput } from "../types/index";

// ============================================================================
// SHOT TYPE / CAMERA LABELS (Vietnamese)
// ============================================================================
const SHOT_TYPE_VI: Record<string, string> = {
  wide_establishing: "Wide / Toàn cảnh",
  medium: "Medium / Trung cảnh",
  close_up: "Close-up / Cận",
  insert: "Insert / Chèn",
  over_shoulder: "Over shoulder / Qua vai",
  two_shot: "Two-shot / 2 người",
  pov: "POV / Góc nhìn",
};

const CAMERA_VI: Record<string, string> = {
  static: "đứng yên",
  pan_left: "pan trái",
  pan_right: "pan phải",
  tilt_up: "tilt lên",
  tilt_down: "tilt xuống",
  zoom_in: "zoom in",
  zoom_out: "zoom out",
  dolly_in: "dolly in",
  dolly_out: "dolly out",
  handheld: "handheld",
  tracking: "tracking",
};

const ROLE_VI: Record<FilmCharacter["role"], string> = {
  protagonist: "Chính",
  antagonist: "Phản diện",
  companion: "Đồng hành",
  extra: "Phụ",
};

// ============================================================================
// FORMATTERS
// ============================================================================
function fmtDuration(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s === 0 ? `${m} phút` : `${m} phút ${s} giây`;
  }
  return `${Math.round(seconds * 10) / 10} giây`;
}

function divider(char: string, len = 78): string {
  return char.repeat(len);
}

function indent(text: string, level = 1, indentStr = "  "): string {
  const pad = indentStr.repeat(level);
  return text
    .split("\n")
    .map((line) => (line.length > 0 ? pad + line : line))
    .join("\n");
}

function wrapText(text: string, width = 72, indentLevel = 0): string {
  // Simple word-wrap for readability in plaintext viewers (Notepad).
  // Preserves intentional newlines (paragraph breaks). Indent is added per line.
  const pad = "  ".repeat(indentLevel);
  const paragraphs = text.split(/\n+/);
  const wrapped = paragraphs.map((para) => {
    const words = para.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if ((current + " " + word).trim().length > width) {
        lines.push(pad + current.trim());
        current = word;
      } else {
        current = (current + " " + word).trim();
      }
    }
    if (current) lines.push(pad + current);
    return lines.join("\n");
  });
  return wrapped.join("\n\n");
}

// ============================================================================
// MAIN BUILDER
// ============================================================================
export interface BuildStoryOverviewInput {
  idea: IdeaInput | undefined;
  script: FilmScript | undefined;
  characters: FilmCharacter[];
  shotsBySceneId: Record<string, FilmShot[]>;
  setting: ProjectSettingV2 | undefined;
  framework?: FilmStoryFramework;
  projectName?: string;
}

/**
 * Build a human-readable Vietnamese story overview as a single plain text string.
 * Output is meant to be downloaded as .txt and read end-to-end like a film treatment.
 *
 * Structure:
 *   ===== HEADER =====
 *   Title, logline, idea, settings (animation style, aspect, dialog mode)
 *
 *   ===== CAST =====
 *   Per character: name, role, description
 *
 *   ===== SCENES =====
 *   Per scene:
 *     - Scene N: Title (duration, emotion, tension)
 *     - Setting + characters in scene
 *     - Summary (action lines VI)
 *     - Dialog (if any)
 *     - SHOTS sub-section: each shot with type, camera, duration, action
 *
 *   ===== SUMMARY =====
 *   Total scenes, total shots, total duration
 */
export function buildStoryOverviewTxt(input: BuildStoryOverviewInput): string {
  const { idea, script, characters, shotsBySceneId, setting, framework, projectName } = input;
  const lines: string[] = [];

  // ---- Header ----
  lines.push(divider("="));
  const title = projectName || script?.titleVi || script?.titleEn || "(Chưa có tên phim)";
  lines.push(`PHIM: ${title.toUpperCase()}`);
  lines.push(divider("="));
  lines.push("");

  if (idea?.raw) {
    lines.push("Ý TƯỞNG:");
    lines.push(wrapText(idea.raw, 72, 1));
    lines.push("");
  }

  if (script?.loglineVi || script?.logline) {
    lines.push("LOGLINE:");
    lines.push(wrapText((script.loglineVi || script.logline) as string, 72, 1));
    lines.push("");
  }

  if (setting) {
    lines.push("CẤU HÌNH PHIM:");
    if (setting.genre) lines.push(`  • Thể loại: ${setting.genre}`);
    if (setting.animationStyle) {
      const styleVi: Record<string, string> = {
        live_action: "Live action (người thật)",
        anime_2d: "Anime 2D",
        cgi_3d_cinematic: "CGI 3D cinematic",
        film_noir: "Film noir đen-trắng",
      };
      lines.push(`  • Phong cách: ${styleVi[setting.animationStyle] ?? setting.animationStyle}`);
    }
    if (setting.aspectRatio) lines.push(`  • Tỷ lệ khung: ${setting.aspectRatio}`);
    if (framework) {
      const fwLabel = FRAMEWORK_LABELS[framework];
      lines.push(`  • Cấu trúc: ${fwLabel?.name ?? framework}`);
    }
    if ((setting as any).dialog) {
      const dialogVi: Record<string, string> = {
        has_dialog: "Có thoại",
        no_dialog: "Không thoại (kể bằng hình + nhạc)",
      };
      lines.push(`  • Chế độ thoại: ${dialogVi[(setting as any).dialog] ?? (setting as any).dialog}`);
    }
    lines.push("");
  }

  // ---- Cast ----
  if (characters.length > 0) {
    lines.push(divider("="));
    lines.push(`NHÂN VẬT (${characters.length} người)`);
    lines.push(divider("="));
    lines.push("");
    characters.forEach((c, i) => {
      lines.push(`${i + 1}. ${c.name || `Character ${c.order}`}  [${ROLE_VI[c.role]}]`);
      if (c.description) {
        lines.push(wrapText(c.description, 72, 1));
      } else {
        lines.push("  (Chưa có mô tả)");
      }
      const refsParts: string[] = [];
      if (c.faceRefs?.length > 0) refsParts.push(`${c.faceRefs.length} face ref`);
      if (c.bodyRefs?.length > 0) refsParts.push(`${c.bodyRefs.length} body ref`);
      if (refsParts.length > 0) lines.push(`  📷 Refs: ${refsParts.join(" + ")}`);
      lines.push("");
    });
  }

  // ---- Scenes ----
  if (script?.scenes && script.scenes.length > 0) {
    lines.push(divider("="));
    lines.push(`KỊCH BẢN — ${script.scenes.length} PHÂN CẢNH`);
    lines.push(divider("="));
    lines.push("");

    script.scenes.forEach((scene: FilmSceneScript, sceneIdx: number) => {
      const sceneShots = shotsBySceneId[scene.id] ?? [];
      const sceneTitle = scene.titleVi || scene.titleEn || `Scene ${scene.order}`;

      lines.push(divider("─"));
      lines.push(`PHÂN CẢNH ${scene.order}: ${sceneTitle}`);
      lines.push(divider("─"));

      // Scene meta
      const metaParts: string[] = [];
      if (scene.durationSeconds) metaParts.push(`⏱ ${fmtDuration(scene.durationSeconds)}`);
      if ((scene as any).emotionalTone) {
        const tone = (scene as any).emotionalTone;
        const toneInfo = EMOTIONAL_TONE_LABELS[tone as keyof typeof EMOTIONAL_TONE_LABELS];
        metaParts.push(`💭 ${toneInfo ? `${toneInfo.emoji} ${toneInfo.vi}` : tone}`);
      }
      if ((scene as any).tensionLevel !== undefined) {
        metaParts.push(`📈 Tension ${(scene as any).tensionLevel}/10`);
      }
      if (metaParts.length > 0) lines.push(metaParts.join("  ·  "));

      if (scene.settings) {
        lines.push("");
        lines.push("BỐI CẢNH:");
        lines.push(wrapText(scene.settings, 72, 1));
      }

      // Characters in this scene (from beats / action)
      const charsInScene = (scene as any).characterEmotions
        ? Object.keys((scene as any).characterEmotions)
            .map((cid: string) => characters.find((c) => c.id === cid))
            .filter((c): c is FilmCharacter => !!c)
        : [];
      if (charsInScene.length > 0) {
        lines.push("");
        lines.push(
          `NHÂN VẬT TRONG CẢNH: ${charsInScene.map((c) => c.name || `Character ${c.order}`).join(", ")}`
        );
      }

      // Action lines
      const action = ((scene as any).actionLinesVi || scene.actionLinesEn || "") as string;
      if (action.trim()) {
        lines.push("");
        lines.push("DIỄN BIẾN:");
        lines.push(wrapText(action, 72, 1));
      }

      // Dialog
      const dialog = (scene.dialog ?? []) as any[];
      if (dialog.length > 0) {
        lines.push("");
        lines.push("THOẠI:");
        dialog.forEach((d) => {
          const char = characters.find((c) => c.id === d.characterId);
          const charName = char?.name || d.characterName || "(?)";
          const text = d.textVi || d.text || "";
          lines.push(`  ${charName.toUpperCase()}:`);
          lines.push(wrapText(text, 70, 2));
        });
      }

      // Setup/payoff beats summary (if scene beats annotated)
      const beats = (scene as any).beats as any[] | undefined;
      if (beats && beats.length > 0) {
        lines.push("");
        lines.push(`BEATS (${beats.length}):`);
        beats.forEach((b: any) => {
          const type = b.type ? `[${b.type}]` : "";
          lines.push(`  • ${type} ${b.description || b.text || "(?)"}`);
        });
      }

      // Shots
      if (sceneShots.length > 0) {
        lines.push("");
        lines.push(`SHOT LIST (${sceneShots.length} shots):`);
        sceneShots.forEach((shot) => {
          const typeLabel = SHOT_TYPE_VI[shot.shotType] ?? shot.shotType;
          const cameraLabel = CAMERA_VI[shot.cameraMovement] ?? shot.cameraMovement;
          const dur = fmtDuration(shot.durationSeconds ?? 0);
          const shotTitle = (shot as any).titleVi || (shot as any).titleEn || "";
          lines.push("");
          lines.push(
            `  SHOT ${scene.order}.${shot.order}${shotTitle ? ` — ${shotTitle}` : ""}`
          );
          lines.push(`    ┃ Loại: ${typeLabel}`);
          lines.push(`    ┃ Máy quay: ${cameraLabel}`);
          lines.push(`    ┃ Thời lượng: ${dur}`);
          const shotAction = ((shot as any).actionVi || (shot as any).actionEn || "") as string;
          if (shotAction.trim()) {
            lines.push(`    ┃ Hành động:`);
            lines.push(wrapText(shotAction, 68, 3));
          }
        });
      } else {
        lines.push("");
        lines.push("  (Chưa có shot list cho phân cảnh này)");
      }
      lines.push("");
      // Spacer between scenes (skip after last)
      if (sceneIdx < script.scenes.length - 1) {
        lines.push("");
      }
    });
  }

  // ---- Summary footer ----
  lines.push(divider("="));
  lines.push("TỔNG KẾT");
  lines.push(divider("="));
  const totalScenes = script?.scenes?.length ?? 0;
  const totalShots = Object.values(shotsBySceneId).reduce(
    (sum, arr) => sum + (arr?.length ?? 0),
    0
  );
  const totalDuration = (script?.scenes ?? []).reduce(
    (sum: number, s: FilmSceneScript) => sum + (s.durationSeconds ?? 0),
    0
  );
  lines.push(`  • Tổng số phân cảnh: ${totalScenes}`);
  lines.push(`  • Tổng số shots:    ${totalShots}`);
  lines.push(`  • Tổng thời lượng:  ${fmtDuration(totalDuration)}`);
  lines.push(`  • Tổng số nhân vật: ${characters.length}`);
  lines.push("");
  lines.push(divider("="));
  lines.push(`Xuất từ KSP Image · ${new Date().toLocaleString("vi-VN")}`);
  lines.push(divider("="));

  return lines.join("\n");
}
