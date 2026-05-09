import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { Section } from "./Section";
import type { SubjectType } from "../types";
import { extractFaceFeatures } from "../engine/faceFeatureExtractor";
import { getReferenceImage } from "../store/db";

const SUBJECT_TYPES: { value: SubjectType; label: string; emoji: string; desc: string }[] = [
  { value: "female", label: "Nữ", emoji: "👩", desc: "Cô gái (mặc định)" },
  { value: "male", label: "Nam", emoji: "👨", desc: "Chàng trai" },
  { value: "couple", label: "Cặp đôi", emoji: "👫", desc: "1 nam + 1 nữ" },
  { value: "family", label: "Gia đình", emoji: "👨‍👩‍👧", desc: "Cha mẹ + con" },
  { value: "friends_group", label: "Nhóm bạn", emoji: "👥", desc: "3-5 người" },
];

export function SubjectSection() {
  const { currentProject, updateCurrentProject, showToast } = useAppStore();
  const [extracting, setExtracting] = useState(false);
  if (!currentProject) return null;

  const { subject } = currentProject;
  const subjectType = subject.subjectType || "female";
  const hasFace = currentProject.references.hasFace;
  const faceCount = currentProject.references.faceCount || 0;

  const updateSubject = (updates: Partial<typeof subject>) =>
    updateCurrentProject({ subject: { ...subject, ...updates } });

  // v0.6.6: AI auto-extract face features from reference image
  const handleExtractFeatures = async () => {
    const refIds = (currentProject as any).refImageIds || {};
    const faceIds: string[] = refIds.faces || (refIds.face ? [refIds.face] : []);
    const firstFaceId = faceIds[0];

    if (!firstFaceId) {
      showToast("⚠️ Upload face reference trước", "error");
      return;
    }

    setExtracting(true);
    try {
      const ref = await getReferenceImage(firstFaceId);
      if (!ref) {
        showToast("Không tìm thấy ảnh face", "error");
        return;
      }

      const features = await extractFaceFeatures(ref.blob);
      // Append to existing or replace
      const existing = subject.uniqueIdentifiers?.trim();
      const newValue = existing
        ? `${existing}\n${features}`
        : features;
      updateSubject({ uniqueIdentifiers: newValue });
      showToast("✓ AI đã extract đặc điểm — review và edit nếu cần", "success");
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, "error");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Section title="👤 Subject DNA">
      {/* v0.5.2: Warning when face refs are active — prevents DNA conflicts */}
      {hasFace && (
        <div className="p-2 bg-ksp-accent/10 border border-ksp-accent/40 rounded text-[11px] text-ksp-accent">
          <div className="font-medium mb-1">🔒 Identity Lock Mode đang BẬT (có {faceCount} face ref)</div>
          <div className="text-ksp-text/80 leading-snug">
            Engine sẽ <strong>tự động skip</strong> những fields đang lấy từ face reference:
            <br />→ Skin tone, eye color/shape, hair color, skin texture
            <br />Nhưng vẫn giữ những fields user có thể muốn variation:
            <br />→ Body figure, hair style/length, makeup tweaks (blush, lipstick), outfit
            <br /><span className="italic text-[10px]">Nhờ vậy face refs sẽ không bị override bởi DNA defaults → mặt giống ref hơn.</span>
          </div>
        </div>
      )}

      {/* v0.6.2: Unique Identifiers - boost face fidelity (v0.6.6: AI auto-extract) */}
      {hasFace && (
        <div className="p-2 bg-purple-500/5 border border-purple-500/30 rounded space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="!mb-0 flex items-center gap-1.5">
              <span>🎯 Unique features (boost similarity)</span>
            </label>
            <button
              onClick={handleExtractFeatures}
              disabled={extracting}
              className="text-[10px] px-2 py-1 bg-purple-500 text-white rounded hover:opacity-90 disabled:opacity-30"
              title="Gemini Vision phân tích face ref → tự liệt kê đặc điểm"
            >
              {extracting ? "⏳ Đang phân tích..." : "🤖 AI tự extract"}
            </button>
          </div>
          <textarea
            value={subject.uniqueIdentifiers || ""}
            onChange={(e) => updateSubject({ uniqueIdentifiers: e.target.value })}
            placeholder="VD: nốt ruồi nhỏ ở má trái, lúm đồng tiền 2 bên, lông mày dày cong, mí đôi, sống mũi thẳng cao... (hoặc click '🤖 AI tự extract' để Gemini đọc ảnh và tự liệt kê)"
            rows={3}
            className="text-xs"
          />
          <p className="text-[10px] text-ksp-muted leading-relaxed">
            💡 Có 2 cách: <strong>(1)</strong> Click <strong>"🤖 AI tự extract"</strong> — Gemini Vision đọc ảnh face và tự liệt kê đặc điểm bằng tiếng Việt → Jason review/edit. <strong>(2)</strong> Tự nhập tay (tiếng Việt hoặc tiếng Anh đều OK). Nghiên cứu cho thấy specific identifiers boost similarity 4x trên Banana Pro.
          </p>
        </div>
      )}

      {/* Subject Type Selector */}
      <div>
        <label>Loại đối tượng</label>
        <div className="grid grid-cols-5 gap-1">
          {SUBJECT_TYPES.map((st) => (
            <button
              key={st.value}
              onClick={() => updateSubject({ subjectType: st.value })}
              className={`p-1.5 rounded text-center text-[10px] border transition-colors ${
                subjectType === st.value
                  ? "bg-ksp-accent text-black border-ksp-accent"
                  : "bg-ksp-bg border-ksp-border hover:border-ksp-accent/50"
              }`}
              title={st.desc}
            >
              <div className="text-base leading-tight">{st.emoji}</div>
              <div className="leading-tight mt-0.5">{st.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label>Ethnicity</label>
        <select
          value={subject.ethnicity}
          onChange={(e) => updateSubject({ ethnicity: e.target.value as any })}
        >
          <option value="Vietnamese">Vietnamese</option>
          <option value="Asian">Asian (chung)</option>
          <option value="Korean">Korean</option>
          <option value="Japanese">Japanese</option>
          <option value="Chinese">Chinese</option>
          <option value="Mixed">Mixed</option>
        </select>
      </div>

      {/* ===== FEMALE-specific ===== */}
      {subjectType === "female" && (
        <details open>
          <summary className="cursor-pointer text-[11px] text-ksp-accent">
            ⚙️ Tùy chỉnh nữ
          </summary>
          <div className="mt-2 space-y-2 grid grid-cols-2 gap-2">
            <div>
              <label>Figure</label>
              <select
                value={subject.figureBuild || "slender"}
                onChange={(e) => updateSubject({ figureBuild: e.target.value as any })}
              >
                <option value="slender">Slender</option>
                <option value="hourglass">Hourglass</option>
                <option value="balanced">Balanced</option>
                <option value="model-like">Model-like</option>
              </select>
            </div>

            {!hasFace && (
              <div>
                <label>Skin tone</label>
                <select
                  value={subject.skinTone}
                  onChange={(e) => updateSubject({ skinTone: e.target.value as any })}
                >
                  <option value="vietnamese_warm">Vietnamese warm</option>
                  <option value="porcelain">Porcelain</option>
                  <option value="milky_white">Milky white</option>
                  <option value="fair">Fair</option>
                  <option value="tan">Tan</option>
                </select>
              </div>
            )}

            <div>
              <label>Hair length</label>
              <select
                value={subject.hair?.length || "waist"}
                onChange={(e) =>
                  updateSubject({
                    hair: { ...subject.hair!, length: e.target.value as any },
                  })
                }
              >
                <option value="shoulder">Shoulder</option>
                <option value="waist">Waist</option>
                <option value="hip">Hip</option>
                <option value="floor">Floor</option>
              </select>
            </div>

            <div>
              <label>Hair style</label>
              <select
                value={subject.hair?.style || "straight"}
                onChange={(e) =>
                  updateSubject({
                    hair: { ...subject.hair!, style: e.target.value as any },
                  })
                }
              >
                <option value="straight">Straight</option>
                <option value="wavy">Wavy</option>
                <option value="braided">Braided</option>
                <option value="ponytail">Ponytail</option>
                <option value="bun">Bun</option>
                <option value="pigtails">Pigtails</option>
              </select>
            </div>

            {/* v0.5.3: Hair color dropdown — auto-hide when has face ref (taken from reference) */}
            {!hasFace && (
              <div className="col-span-2">
                <label>Hair color</label>
                <select
                  value={subject.hair?.color || "dark brown"}
                  onChange={(e) =>
                    updateSubject({
                      hair: { ...subject.hair!, color: e.target.value },
                    })
                  }
                >
                  <option value="black">🖤 Đen tự nhiên</option>
                  <option value="dark brown">☕ Nâu đen (mặc định)</option>
                  <option value="chestnut brown">🌰 Nâu hạt dẻ</option>
                  <option value="milk tea brown">🥛 Nâu trà sữa</option>
                  <option value="honey blonde">🍯 Nâu mật ong</option>
                  <option value="auburn">🦊 Đỏ auburn</option>
                  <option value="platinum blonde">⚪ Bạch kim</option>
                </select>
              </div>
            )}

            <div className="col-span-2">
              <label>Makeup style</label>
              <select
                value={subject.makeup?.style || "korean_glass_skin"}
                onChange={(e) =>
                  updateSubject({
                    makeup: { ...subject.makeup!, style: e.target.value as any },
                  })
                }
              >
                <option value="vietnamese_traditional">Vietnamese traditional</option>
                <option value="korean_glass_skin">Korean glass skin</option>
                <option value="korean_wonyoung">Korean Wonyoung</option>
                <option value="douyin">Douyin</option>
                <option value="natural_no_makeup">Natural no-makeup</option>
                <option value="fresh_dewy">Fresh dewy</option>
              </select>
            </div>
          </div>
        </details>
      )}

      {/* ===== MALE-specific ===== */}
      {subjectType === "male" && (
        <details open>
          <summary className="cursor-pointer text-[11px] text-ksp-accent">
            ⚙️ Tùy chỉnh nam
          </summary>
          <div className="mt-2 space-y-2 grid grid-cols-2 gap-2">
            <div>
              <label>Build</label>
              <select
                value={subject.maleStyle?.build || "athletic"}
                onChange={(e) =>
                  updateSubject({
                    maleStyle: {
                      hair: subject.maleStyle?.hair || "short_neat",
                      beard: subject.maleStyle?.beard || "clean_shaven",
                      build: e.target.value as any,
                      styleVibe: subject.maleStyle?.styleVibe || "modern_business",
                    },
                  })
                }
              >
                <option value="slim">Slim (mảnh)</option>
                <option value="athletic">Athletic (thể thao)</option>
                <option value="muscular">Muscular (cơ bắp)</option>
                <option value="average">Average (trung bình)</option>
              </select>
            </div>

            <div>
              <label>Skin tone</label>
              <select
                value={subject.skinTone}
                onChange={(e) => updateSubject({ skinTone: e.target.value as any })}
              >
                <option value="vietnamese_warm">Vietnamese warm</option>
                <option value="fair">Fair</option>
                <option value="tan">Tan</option>
              </select>
            </div>

            <div>
              <label>Hair</label>
              <select
                value={subject.maleStyle?.hair || "short_neat"}
                onChange={(e) =>
                  updateSubject({
                    maleStyle: {
                      hair: e.target.value as any,
                      beard: subject.maleStyle?.beard || "clean_shaven",
                      build: subject.maleStyle?.build || "athletic",
                      styleVibe: subject.maleStyle?.styleVibe || "modern_business",
                    },
                  })
                }
              >
                <option value="short_neat">Short neat (ngắn gọn)</option>
                <option value="undercut">Undercut</option>
                <option value="messy">Messy textured</option>
                <option value="long_tied">Long tied (dài cột)</option>
                <option value="side_parted_classic">Side parted classic</option>
                <option value="buzz_cut">Buzz cut</option>
              </select>
            </div>

            <div>
              <label>Beard</label>
              <select
                value={subject.maleStyle?.beard || "clean_shaven"}
                onChange={(e) =>
                  updateSubject({
                    maleStyle: {
                      hair: subject.maleStyle?.hair || "short_neat",
                      beard: e.target.value as any,
                      build: subject.maleStyle?.build || "athletic",
                      styleVibe: subject.maleStyle?.styleVibe || "modern_business",
                    },
                  })
                }
              >
                <option value="clean_shaven">Clean shaven</option>
                <option value="stubble">Stubble (lún phún)</option>
                <option value="short_beard">Short beard</option>
                <option value="full_beard">Full beard</option>
              </select>
            </div>

            <div className="col-span-2">
              <label>Style vibe</label>
              <select
                value={subject.maleStyle?.styleVibe || "modern_business"}
                onChange={(e) =>
                  updateSubject({
                    maleStyle: {
                      hair: subject.maleStyle?.hair || "short_neat",
                      beard: subject.maleStyle?.beard || "clean_shaven",
                      build: subject.maleStyle?.build || "athletic",
                      styleVibe: e.target.value as any,
                    },
                  })
                }
              >
                <option value="korean_idol">Korean idol</option>
                <option value="vintage">Vintage cổ điển</option>
                <option value="modern_business">Modern business</option>
                <option value="casual_streetwear">Casual streetwear</option>
                <option value="rugged_outdoor">Rugged outdoor</option>
              </select>
            </div>
          </div>
        </details>
      )}

      {/* ===== GROUP types ===== */}
      {(subjectType === "couple" || subjectType === "family" || subjectType === "friends_group") && (
        <details open>
          <summary className="cursor-pointer text-[11px] text-ksp-accent">
            ⚙️ Tùy chỉnh nhóm
          </summary>
          <div className="mt-2 space-y-2">
            <div>
              <label>Số người</label>
              <input
                type="number"
                min={2}
                max={10}
                value={subject.groupComposition?.count || (subjectType === "couple" ? 2 : subjectType === "family" ? 4 : 4)}
                onChange={(e) =>
                  updateSubject({
                    groupComposition: {
                      count: parseInt(e.target.value) || 2,
                      members: subject.groupComposition?.members || "",
                      vibe: subject.groupComposition?.vibe,
                    },
                  })
                }
              />
            </div>

            <div>
              <label>Mô tả thành viên</label>
              <textarea
                value={subject.groupComposition?.members || ""}
                onChange={(e) =>
                  updateSubject({
                    groupComposition: {
                      count: subject.groupComposition?.count || 2,
                      members: e.target.value,
                      vibe: subject.groupComposition?.vibe,
                    },
                  })
                }
                placeholder={
                  subjectType === "couple"
                    ? "VD: chàng trai 28t cao 1m75 áo sơ mi trắng, cô gái 25t mặc đầm hoa..."
                    : subjectType === "family"
                    ? "VD: bố 35t, mẹ 32t, con gái 5t, con trai 3t, mặc áo dài đỏ..."
                    : "VD: 4 cô gái 22-24t mặc áo dài trắng đồng phục đại học..."
                }
                rows={3}
              />
            </div>

            <div>
              <label>Vibe / không khí nhóm</label>
              <input
                type="text"
                value={subject.groupComposition?.vibe || ""}
                onChange={(e) =>
                  updateSubject({
                    groupComposition: {
                      count: subject.groupComposition?.count || 2,
                      members: subject.groupComposition?.members || "",
                      vibe: e.target.value,
                    },
                  })
                }
                placeholder="VD: ấm cúng gia đình, vui vẻ tuổi trẻ, lãng mạn cặp đôi..."
              />
            </div>
          </div>
        </details>
      )}
    </Section>
  );
}
