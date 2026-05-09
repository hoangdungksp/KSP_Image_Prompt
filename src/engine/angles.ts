/**
 * Camera Angle Variation Engine
 *
 * Problem: When user creates 5 shots with same subject + scene, all shots
 * end up looking similar because they share the same camera angle/framing.
 *
 * Solution: 8 angle presets representing how a real photographer would
 * vary shots at one location. When adding a new shot, auto-pick a preset
 * that hasn't been used yet (or used least recently).
 */

import type { PoseConfig } from "../types";

export interface AnglePreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  framing: PoseConfig["framing"];
  cameraAngle: PoseConfig["cameraAngle"];
  /** Vietnamese hint for the user */
  hintVn: string;
  /** English instruction injected into prompt for variety */
  cameraInstruction: string;
}

export const ANGLE_PRESETS: AnglePreset[] = [
  {
    id: "wide_front",
    name: "Wide Front",
    emoji: "📐",
    description: "Toàn cảnh chính diện, thấy đủ nhân vật + bối cảnh",
    framing: "wide",
    cameraAngle: "eye_level",
    hintVn: "Góc rộng nhìn thẳng từ trước, lấy nguyên nhân vật + bối cảnh phía sau",
    cameraInstruction:
      "Wide establishing shot, eye-level frontal view capturing the full subject and the surrounding environment in frame.",
  },
  {
    id: "medium_low",
    name: "Medium Low",
    emoji: "⬆️",
    description: "Trung cảnh, góc thấp nhìn lên",
    framing: "medium",
    cameraAngle: "low",
    hintVn: "Trung cảnh, góc máy thấp nhìn lên — làm nhân vật trông cao và uy nghiêm",
    cameraInstruction:
      "Medium shot from a low angle looking upward, making the subject appear taller and more powerful, with sky or background structures visible above.",
  },
  {
    id: "closeup_side",
    name: "Close-up Side",
    emoji: "👁",
    description: "Cận cảnh nghiêng",
    framing: "close-up",
    cameraAngle: "eye_level",
    hintVn: "Cận cảnh từ bên hông, focus vào gương mặt nghiêng và biểu cảm",
    cameraInstruction:
      "Close-up side profile shot, focusing intimately on the facial features and expression, with shallow depth softening the background.",
  },
  {
    id: "three_quarter",
    name: "3/4 View",
    emoji: "🔄",
    description: "Góc 3/4 — vừa thấy mặt vừa thấy bối cảnh",
    framing: "medium",
    cameraAngle: "eye_level",
    hintVn: "Góc 3/4 — nhân vật xoay 45 độ, lý tưởng khi vừa muốn show mặt vừa show bối cảnh phía sau",
    cameraInstruction:
      "Three-quarter angle shot, subject turned 45 degrees from camera, balancing facial features and the contextual background.",
  },
  {
    id: "over_shoulder",
    name: "Over Shoulder",
    emoji: "👀",
    description: "Sau lưng, ngó lại",
    framing: "medium",
    cameraAngle: "eye_level",
    hintVn: "Quay lưng lại camera nhưng ngó qua vai — cảm giác candid, cinematic",
    cameraInstruction:
      "Over-the-shoulder shot from behind, subject glancing back over her shoulder toward the camera, candid cinematic feel with environment leading the eye.",
  },
  {
    id: "bird_eye",
    name: "Bird's Eye",
    emoji: "🦅",
    description: "Góc cao nhìn xuống",
    framing: "full-body",
    cameraAngle: "bird_eye",
    hintVn: "Góc cao nhìn xuống — flat lay style, hợp với cảnh ngồi/nằm/lifestyle",
    cameraInstruction:
      "High overhead bird's-eye view shooting downward, capturing the subject and the ground/floor pattern, modern lifestyle composition.",
  },
  {
    id: "back_facing",
    name: "Back Facing",
    emoji: "🌅",
    description: "Quay lưng nhìn ra xa",
    framing: "full-body",
    cameraAngle: "eye_level",
    hintVn: "Quay lưng hoàn toàn nhìn ra cảnh — cảm giác mơ mộng, suy tư",
    cameraInstruction:
      "Subject fully facing away from camera, looking out at the scenery, contemplative and dreamy mood, with the environment as the visual focus.",
  },
  {
    id: "detail",
    name: "Detail Shot",
    emoji: "🔍",
    description: "Chi tiết — tay, chân, phụ kiện",
    framing: "close-up",
    cameraAngle: "slight_high",
    hintVn: "Cận chi tiết — tay cầm vật, chân, phụ kiện, gương mặt nghiêng — tránh full body",
    cameraInstruction:
      "Tight detail shot focusing on hands, accessories, or specific feature interactions with objects in the scene; not a full-body or full-face composition.",
  },
];

/**
 * Pick the next angle preset for a new shot, avoiding recently used ones.
 *
 * @param usedAngleIds - IDs of angles already used in current project
 * @returns Next angle preset (cycles through if all used)
 */
export function pickNextAngle(usedAngleIds: string[]): AnglePreset {
  // Find first preset not yet used
  for (const preset of ANGLE_PRESETS) {
    if (!usedAngleIds.includes(preset.id)) {
      return preset;
    }
  }
  // All used - cycle from start with offset
  const idx = usedAngleIds.length % ANGLE_PRESETS.length;
  return ANGLE_PRESETS[idx];
}

export function getAngleById(id: string): AnglePreset | undefined {
  return ANGLE_PRESETS.find((p) => p.id === id);
}

/**
 * Apply an angle preset to a pose config, overriding camera-related fields.
 */
export function applyAnglePreset(pose: PoseConfig, presetId: string): PoseConfig {
  const preset = getAngleById(presetId);
  if (!preset) return pose;

  return {
    ...pose,
    framing: preset.framing,
    cameraAngle: preset.cameraAngle,
  };
}
