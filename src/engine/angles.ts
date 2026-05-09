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
  /** English instruction injected into prompt for variety (Camera block) */
  cameraInstruction: string;
  /**
   * MANDATORY enforcement directive — prepended at TOP of prompt as
   * "*MANDATORY CAMERA ANGLE:*" block before any other content. Strong wording
   * with explicit camera position + lens direction so AI image models cannot
   * default to eye-level.
   */
  enforcement: string;
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
      "(Wide-angle shot) Wide establishing shot, eye-level frontal view capturing the full subject and the surrounding environment in frame.",
    enforcement:
      "(wide-angle eye-level shot, full-body, environment-establishing). Camera positioned at the subject's eye height, lens pointing horizontally straight at the subject. Show the entire body from head to feet with generous environmental context surrounding and behind. Composition: wide frame, subject occupies central 40-60% of frame.",
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
      "(Low-angle shot, looking up) Medium shot from a low angle looking upward, making the subject appear taller and more powerful, with sky or background structures visible above.",
    enforcement:
      "(low-angle shot, camera looking upward at the subject). MANDATORY camera position: camera is below the subject's chest level (approximately at waist or hip height of the subject), lens tilted upward at 25-35 degrees toward the face. The subject must appear taller, more powerful, and dominant in the frame. Sky, ceiling, or background structures must be visible above the subject. Do NOT use eye level. Do NOT use high angle.",
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
      "(Close-up profile shot, side view) Close-up side profile shot, focusing intimately on the facial features and expression, with shallow depth softening the background.",
    enforcement:
      "(close-up profile shot, 90 degree side view). MANDATORY composition: tight frame from shoulders up, subject's face turned exactly 90 degrees away from camera so only the side profile is visible (one ear, side of nose, jawline, lashes from the side). Camera at eye level. Show only side of the face, NOT three-quarter, NOT frontal.",
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
      "(Three-quarter angle shot, 45 degree turn) Three-quarter angle shot, subject turned 45 degrees from camera, balancing facial features and the contextual background.",
    enforcement:
      "(three-quarter angle, 45 degree subject turn). MANDATORY: subject's body and face turned exactly 45 degrees away from camera so we see one full eye, partial second eye, the bridge of the nose, and the cheekbone of the turned-away side. Camera at eye level. Both face and environmental context visible in frame. Do NOT use straight-on frontal. Do NOT use full profile.",
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
      "(Over-the-shoulder shot, looking back) Over-the-shoulder shot from behind, subject glancing back over her shoulder toward the camera, candid cinematic feel with environment leading the eye.",
    enforcement:
      "(over-the-shoulder shot, subject's back facing camera, head turned back). MANDATORY: camera positioned behind the subject's left or right shoulder. Subject's back and one shoulder dominate the foreground while she turns her head back to glance at the camera. The face is visible only in profile or three-quarter from this rear position. The environment ahead of the subject is the visual destination of the shot. Do NOT show the front of the body fully.",
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
      "(Bird's-eye view, top-down, overhead shot) High overhead bird's-eye view shooting downward, capturing the subject and the ground/floor pattern, modern lifestyle composition.",
    enforcement:
      "(bird's-eye view, overhead shot, top-down 90 degrees). MANDATORY camera position: camera is directly above the subject, lens pointing straight down at 90 degrees to the ground. The viewer sees the subject from directly overhead — top of the head, shoulders, and the ground/floor surrounding her. This is a flat-lay perspective, drone-style overhead. The ground or floor pattern must dominate the frame. Do NOT use eye level. Do NOT use side view.",
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
      "(Back-view shot, subject facing away) Subject fully facing away from camera, looking out at the scenery, contemplative and dreamy mood, with the environment as the visual focus.",
    enforcement:
      "(back-view shot, subject facing 180 degrees away from camera). MANDATORY: subject's back must be fully facing the camera. We see the back of the head, shoulders, hair, and back of the outfit. The face is NOT visible at all (no profile, no glance back). The subject is gazing out toward the distant landscape ahead of her. Camera at eye level. The environment in front of the subject is the focal point of the composition.",
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
      "(Macro detail shot, tight crop on accessory or hand) Tight detail shot focusing on hands, accessories, or specific feature interactions with objects in the scene; not a full-body or full-face composition.",
    enforcement:
      "(extreme close-up macro detail shot, tight crop). MANDATORY composition: tight crop on a specific small detail — hands holding an object, jewelry, fabric texture, foot on pavement, etc. The face is NOT the focal point and may be only partially visible or cropped out entirely. Background blurred to extreme shallow depth of field. Do NOT show full body. Do NOT show full face.",
  },
  // === v0.9.1 r11 — 4 additional angles with strong enforcement ===
  {
    id: "dutch_tilt",
    name: "Dutch Tilt",
    emoji: "📐",
    description: "Góc nghiêng (Dutch tilt) — dynamic, cinematic",
    framing: "medium",
    cameraAngle: "eye_level",
    hintVn: "Camera nghiêng (Dutch angle) — tạo cảm giác dynamic, không ổn định, cinematic",
    cameraInstruction:
      "(Dutch angle shot, tilted frame, canted camera) Dutch tilt camera angle, frame canted approximately 15-20 degrees off horizontal, creating dynamic energy and cinematic instability.",
    enforcement:
      "(Dutch angle shot, canted angle, tilted camera, 20 degree tilt). MANDATORY: the entire frame is rotated 15-25 degrees off horizontal. The horizon line must be diagonal, NOT level. Vertical lines (buildings, trees, walls) must be tilted. This creates an unsettling, dynamic, cinematic quality. Do NOT use a level horizon. Do NOT keep verticals vertical. The tilt must be visible and intentional.",
  },
  {
    id: "worm_eye",
    name: "Worm's Eye",
    emoji: "🐛",
    description: "Góc cực thấp nhìn lên (worm's eye)",
    framing: "full-body",
    cameraAngle: "low",
    hintVn: "Góc cực thấp gần mặt đất nhìn lên — dramatic, kéo dài chân, sky-stretch effect",
    cameraInstruction:
      "(Worm's-eye view, ground level shot, extreme low angle, looking straight up) Extreme low worm's-eye angle from near ground level pointing upward, dramatically elongating the legs and emphasizing the sky or canopy above.",
    enforcement:
      "(worm's-eye view, ground-level shot, extreme low angle from below, lens pointing nearly straight upward). MANDATORY camera position: camera placed on the ground or within 30cm of the floor, lens tilted UPWARD at 70-80 degrees toward the subject who towers above. The viewer is looking up at the subject from below. The subject's legs appear dramatically elongated. The sky, ceiling, or canopy fills the upper 60-70% of the frame above the subject. Subject's chin and underside of jaw are visible. Do NOT use eye level. Do NOT use high angle. Do NOT center the subject normally — exaggerate the upward perspective.",
  },
  {
    id: "selfie_pov",
    name: "Selfie POV",
    emoji: "🤳",
    description: "POV như tự sướng — tay cầm phone giơ cao",
    framing: "close-up",
    cameraAngle: "slight_high",
    hintVn: "Camera angle giả vờ như selfie — slightly above eye level, intimate, personal vibe",
    cameraInstruction:
      "(Selfie shot, first-person POV, arm extended holding phone) Selfie point-of-view angle: camera held by the subject at arm's length slightly above eye level, intimate personal vibe with subject filling most of the frame.",
    enforcement:
      "(selfie POV shot, first-person perspective, arm-extended phone selfie). MANDATORY: the shot is composed as if the subject is taking the photo herself — her own extended arm holding a phone is visible in one corner of the frame. Camera at arm's length distance, slightly above her eye level so the lens looks slightly down at her face. Subject fills 60-70% of frame. Background visible above and behind her shoulders. Intimate and personal vibe. Do NOT use third-person framing.",
  },
  {
    id: "looking_up_pov",
    name: "Looking Up POV",
    emoji: "🌤",
    description: "Camera dưới nhìn lên người — romantic gaze",
    framing: "medium",
    cameraAngle: "low",
    hintVn: "Góc thấp cận, như đang ngước nhìn lên người — romantic, dreamy",
    cameraInstruction:
      "(Low angle close shot, looking up at subject's face) Low angle looking up at the subject's face from slightly below chin level, romantic dreamy gaze with sky or canopy as backdrop framing the subject.",
    enforcement:
      "(low-angle close shot, camera below chin level, looking up at the face). MANDATORY camera position: camera positioned slightly below the subject's chin, lens tilted upward at 30-45 degrees toward her face. We see her face from below — the underside of the chin and jawline is visible, the eyes appear gazing slightly downward toward the camera, and sky or tree canopy frames her head from behind/above. Romantic, dreamy, cinematic mood. Do NOT use eye level. Do NOT use top-down or bird's eye.",
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
