/**
 * KSP Image v0.9.0 — Idea Card (Mockup 2)
 *
 * Step 1 trong pipeline: ý tưởng raw input cho AI Script/Concept writer.
 * Đơn giản theo Mockup 2 — KHÔNG duplicate heading, KHÔNG "Tùy chỉnh nâng cao".
 *
 * Header được provide bởi PipelineStep wrapper bên ngoài,
 * component này chỉ render content (textarea + helper).
 */

import React from "react";
import { useAppStore } from "../store/useAppStore";

const PLACEHOLDER_BY_MODE: Record<string, string> = {
  film: "VD: Robot cuối cùng thức dậy sau hàng trăm năm ngủ quên trong rừng nguyên sinh, nhận ra thế giới đã hồi sinh không có loài người, bắt đầu chạy về phía một khu rừng xa hơn — như tìm về nguồn cội hoặc chạy trốn ký ức.",
  tvc_commercial: "VD: Cô gái 25 tuổi bận rộn buổi sáng nhưng chỉ cần 30 giây skincare routine với serum X, da trở nên căng mịn rạng rỡ, cô tự tin bước ra đường với nụ cười.",
  product_photo: "VD: Chai serum đỏ Vichy trên marble trắng, lighting studio mềm, background gradient nhẹ, góc 45 độ.",
  photos: "VD: Cô gái ngồi cafe Đà Lạt sương mù, ôm cốc cafe nóng, ánh nắng vàng buổi sáng.",
};

export function IdeaCardV09() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);

  if (!project) return null;

  // idea field is legacy v0.8.x: { raw, language, translatedEn, hints }
  const ideaObj = (project as any).idea ?? { raw: "" };
  const ideaText: string = typeof ideaObj === "string" ? ideaObj : (ideaObj.raw ?? "");
  const mode = (project as any).mode ?? "film";
  const placeholder = PLACEHOLDER_BY_MODE[mode] ?? PLACEHOLDER_BY_MODE.film;
  const charCount = ideaText.length;

  const handleChange = (val: string) => {
    updateProject({
      idea: {
        ...ideaObj,
        raw: val,
        language: "vi",
        translatedEn: undefined, // invalidate translation when source changes
      },
    } as any);
  };

  return (
    <div style={{ padding: "12px 14px" }}>
      <label
        style={{
          display: "block",
          fontSize: 9,
          color: "#888",
          letterSpacing: "0.06em",
          marginBottom: 6,
        }}
      >
        MÔ TẢ Ý TƯỞNG (TIẾNG VIỆT)
      </label>
      <textarea
        className="ksp-input ksp-textarea"
        rows={5}
        value={ideaText}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: 10,
          background: "#1a1a1c",
          border: "0.5px solid #2a2a2c",
          borderRadius: 4,
          color: "#ddd",
          fontSize: 12,
          fontFamily: "inherit",
          resize: "vertical",
          minHeight: 100,
          lineHeight: 1.5,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 6,
          fontSize: 10,
          color: "#666",
        }}
      >
        <span>{charCount} ký tự</span>
        <span style={{ fontStyle: "italic" }}>
          AI Script/Concept sẽ dùng nội dung này
        </span>
      </div>
    </div>
  );
}
