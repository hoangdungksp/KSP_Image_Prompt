import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { Section } from "./Section";
import { ThemePicker } from "./ThemePicker";
import type { ThemePreset } from "../engine/themes";

// v0.6.3: Dynamic placeholder examples based on mode + industry
const PLACEHOLDER_EXAMPLES: Record<string, Record<string, string>> = {
  lifestyle: {
    skincare: "VD: Cô gái ngồi trước cửa sổ buổi sáng, ánh nắng nhẹ chiếu vào mặt, đang vỗ kem dưỡng lên má, không khí thư giãn",
    fnb: "VD: Cô gái ngồi cafe Đà Lạt sương mù, hai tay ôm cốc cafe nóng, ánh nắng vàng xuyên cửa sổ, biểu cảm thư giãn",
    tech: "VD: Cô gái đeo smart glasses đi dạo phố Sài Gòn, vibe tương lai, ánh đèn neon phản chiếu trên kính",
    fashion: "VD: Cô gái mặc áo dài trắng đứng trước nhà thờ Đức Bà Sài Gòn vào hoàng hôn vàng cam, gió nhẹ thổi tóc",
    travel: "VD: Cô gái balo xách máy ảnh đi giữa cánh đồng lúa Sapa, ánh nắng vàng cuối ngày, núi non làm background",
    general: "VD: Cô gái ngồi cafe Đà Lạt sương mù, ôm cốc cafe nóng, biểu cảm thư giãn, ánh sáng vàng buổi sáng",
  },
  tvc_commercial: {
    skincare: "VD: Cô gái cầm hộp serum Vichy giơ ngang ngực, mỉm cười tự tin trước camera, da glowing dewy, background trắng studio",
    fnb: "VD: Cô gái cầm chai nước giải khát Pocari Sweat giơ cao trước mặt, vibe energetic, background gradient xanh trời",
    tech: "VD: Cô gái đeo headphones Sony WH-1000XM5, gật đầu theo nhạc, biểu cảm thoải mái, background gradient minimalist",
    fashion: "VD: Cô gái mặc áo Adidas Originals, đứng pose tự tin trước background gradient, vibe streetwear premium",
    general: "VD: Cô gái cầm sản phẩm giơ cao trước ngực, mỉm cười tự tin trước camera, background studio trắng, vibe TVC commercial",
  },
  product_photo: {
    skincare: "VD: Hộp serum Vichy đỏ trên marble trắng, lighting studio mềm, background gradient nhẹ, góc 45 độ",
    fnb: "VD: Chai nước Pocari Sweat trên ice cubes, drops nước freeze mid-air, lighting studio sáng, background xanh gradient",
    tech: "VD: Smart glasses RayNeo trên platform black acrylic, lighting cinematic, reflections rõ trên kính",
    fashion: "VD: Túi xách Hermès Birkin trên silk fabric, lighting luxury studio, soft shadows, background be tone",
    general: "VD: Sản phẩm trên marble trắng, lighting studio mềm, background gradient, góc 45 độ, vibe e-commerce premium",
  },
  editorial_fashion: {
    fashion: "VD: Cô gái mặc váy Dior Couture, pose Vogue spread, lighting cinematic dramatic, background đỏ deep, biểu cảm intense",
    general: "VD: Cô gái mặc trang phục high-fashion, pose dramatic editorial, lighting cinematic, background bold color, vibe Vogue magazine",
  },
};

function getPlaceholder(mode: string | undefined, industry: string | undefined): string {
  const m = mode || "lifestyle";
  const i = industry || "general";
  const modePlaceholders = PLACEHOLDER_EXAMPLES[m] || PLACEHOLDER_EXAMPLES.lifestyle;
  return modePlaceholders[i] || modePlaceholders.general || PLACEHOLDER_EXAMPLES.lifestyle.general;
}

export function IdeaSection() {
  const { currentProject, updateCurrentProject, showToast } = useAppStore();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!currentProject) return null;
  const { idea } = currentProject;
  const mode = (currentProject as any).mode;
  const industry = (currentProject as any).industry;
  const dynamicPlaceholder = getPlaceholder(mode, industry);

  const handleSelectTheme = (theme: ThemePreset) => {
    updateCurrentProject({
      idea: {
        raw: theme.description,
        language: "vi",
        translatedEn: theme.descriptionEn,
        hints: {
          time: theme.time,
          mood: theme.mood,
        },
      },
      cameraStyle: theme.cameraStyle,
    });
    showToast(`✅ Đã chọn: ${theme.name}`, "success");
  };

  return (
    <Section title="💡 Ý tưởng">
      <button
        onClick={() => setPickerOpen(true)}
        className="w-full px-3 py-2 bg-ksp-accent/10 border border-ksp-accent text-ksp-accent rounded text-xs font-medium hover:bg-ksp-accent/20"
      >
        🎨 Chọn từ thư viện ý tưởng (430+)
      </button>

      <div>
        <label>Mô tả ý tưởng (tiếng Việt)</label>
        <textarea
          value={idea.raw}
          onChange={(e) =>
            updateCurrentProject({
              idea: { ...idea, raw: e.target.value, language: "vi", translatedEn: undefined },
            })
          }
          placeholder={dynamicPlaceholder}
          rows={4}
        />
      </div>

      <details className="mt-1">
        <summary className="cursor-pointer text-[11px] text-ksp-muted hover:text-ksp-text">
          ⚙️ Tùy chỉnh nâng cao (time, mood)
        </summary>
        <div className="mt-2 space-y-2 pt-2 border-t border-ksp-border">
          <div>
            <label>Time / Lighting</label>
            <select
              value={idea.hints?.time || ""}
              onChange={(e) =>
                updateCurrentProject({
                  idea: {
                    ...idea,
                    hints: {
                      ...idea.hints,
                      time: (e.target.value as any) || undefined,
                    },
                  },
                })
              }
            >
              <option value="">Auto từ ý tưởng</option>
              <option value="golden_hour">Golden Hour (hoàng hôn)</option>
              <option value="blue_hour">Blue Hour (chạng vạng)</option>
              <option value="midday">Midday (giữa trưa)</option>
              <option value="afternoon">Afternoon (chiều)</option>
              <option value="night">Night (đêm)</option>
              <option value="overcast">Overcast (trời mây)</option>
              <option value="indoor">Indoor (trong nhà)</option>
            </select>
          </div>

          <div>
            <label>Mood (cách nhau bằng dấu phẩy)</label>
            <input
              type="text"
              value={idea.hints?.mood?.join(", ") || ""}
              onChange={(e) =>
                updateCurrentProject({
                  idea: {
                    ...idea,
                    hints: {
                      ...idea.hints,
                      mood: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  },
                })
              }
              placeholder="cinematic, romantic, elegant"
            />
          </div>
        </div>
      </details>

      {pickerOpen && <ThemePicker onSelect={handleSelectTheme} onClose={() => setPickerOpen(false)} />}
    </Section>
  );
}
