import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  saveReferenceImage,
  getReferenceImage,
  listReferenceImages,
  incrementRefUseCount,
  type StoredReferenceImage,
  type RefCategory,
} from "../store/db";
import { Section } from "./Section";

// ============================================================================
// MULTI-FACE SLOT — supports 1-6+ face images
// ============================================================================

interface MultiFaceSlotProps {
  faceIds: string[];
  onChange: (faceIds: string[]) => void;
}

const FACE_LABELS = [
  "Chính diện",
  "3/4 trái",
  "3/4 phải",
  "Side profile",
  "Nhìn lên",
  "Góc khác",
];

function MultiFaceSlot({ faceIds, onChange }: MultiFaceSlotProps) {
  const { showToast } = useAppStore();
  const [pickerOpenForSlot, setPickerOpenForSlot] = useState<number | null>(null);

  const handleFile = async (file: File, slotIdx: number) => {
    if (!file.type.startsWith("image/")) {
      showToast("Chỉ hỗ trợ file ảnh", "error");
      return;
    }

    // v0.4.5: Stronger face quality validation
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);

    await new Promise<void>((resolve) => {
      img.onload = () => {
        // Check 1: Resolution
        if (img.width < 1024 || img.height < 1024) {
          showToast(
            `⚠️ Ảnh ${img.width}×${img.height} thấp hơn 1024×1024 — face có thể không giống. Khuyến nghị upload ảnh chất lượng cao hơn.`,
            "info"
          );
        }

        // Check 2: Aspect ratio extreme (face refs should be ~portrait or square)
        const ratio = img.width / img.height;
        if (ratio > 2 || ratio < 0.5) {
          showToast(
            `⚠️ Tỷ lệ ảnh ${img.width}×${img.height} quá bất thường — face refs nên ~vuông hoặc dọc`,
            "info"
          );
        }

        // Check 3: Lighting cast detection (sample center pixels)
        try {
          const canvas = document.createElement("canvas");
          const sampleSize = 200;
          canvas.width = sampleSize;
          canvas.height = sampleSize;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            // Sample center of image
            const sx = Math.max(0, (img.width - sampleSize * 2) / 2);
            const sy = Math.max(0, (img.height - sampleSize * 2) / 2);
            ctx.drawImage(
              img, sx, sy, sampleSize * 2, sampleSize * 2,
              0, 0, sampleSize, sampleSize
            );
            const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
            let totalR = 0, totalG = 0, totalB = 0;
            const pixelCount = data.length / 4;
            for (let i = 0; i < data.length; i += 4) {
              totalR += data[i];
              totalG += data[i + 1];
              totalB += data[i + 2];
            }
            const avgR = totalR / pixelCount;
            const avgG = totalG / pixelCount;
            const avgB = totalB / pixelCount;
            const avg = (avgR + avgG + avgB) / 3;

            // Detect strong color cast
            const rDiff = avgR - avg;
            const gDiff = avgG - avg;
            const bDiff = avgB - avg;

            if (rDiff > 25 && rDiff > gDiff + 15 && rDiff > bDiff + 15) {
              showToast(
                "⚠️ Ảnh có lighting đỏ rực — AI sẽ học sai skin tone. Nên upload thêm ảnh lighting tự nhiên.",
                "error"
              );
            } else if (bDiff > 25 && bDiff > rDiff + 15) {
              showToast(
                "⚠️ Ảnh có lighting xanh — AI có thể học sai skin tone",
                "info"
              );
            }

            // Detect very dark/very bright
            if (avg < 50) {
              showToast(`⚠️ Ảnh quá tối (brightness ${Math.round(avg)}/255) — face khó nhận diện`, "info");
            } else if (avg > 220) {
              showToast(`⚠️ Ảnh quá sáng (over-exposed) — chi tiết mặt có thể bị mất`, "info");
            }
          }
        } catch (e) {
          // Image analysis failed, skip silently
        }

        URL.revokeObjectURL(blobUrl);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        resolve();
      };
      img.src = blobUrl;
    });

    const id = await saveReferenceImage({
      blob: file,
      category: "face",
      tags: [`face_angle_${slotIdx + 1}`],
      source: "upload",
    });
    await incrementRefUseCount(id);

    const newIds = [...faceIds];
    newIds[slotIdx] = id;
    onChange(newIds.filter(Boolean));
    showToast(`✓ Đã upload Face #${slotIdx + 1}`, "success");
  };

  const handleSelectFromLibrary = async (id: string, slotIdx: number) => {
    await incrementRefUseCount(id);
    const newIds = [...faceIds];
    newIds[slotIdx] = id;
    onChange(newIds.filter(Boolean));
    setPickerOpenForSlot(null);
  };

  const handleRemove = (slotIdx: number) => {
    const newIds = faceIds.filter((_, i) => i !== slotIdx);
    onChange(newIds);
  };

  // Calculate slots to show: existing + 1 empty slot for adding more (max 6)
  // v0.5.3: Single-face DEFAULT - only show 1 slot unless user enables multi-face
  const multiFaceEnabled = faceIds.length > 1; // Auto-enabled if multiple uploaded already
  const [showMulti, setShowMulti] = useState(multiFaceEnabled);

  const totalSlots = showMulti
    ? Math.min(Math.max(faceIds.length + 1, 1), 6)
    : 1; // Single-face default
  const slots = Array.from({ length: totalSlots }, (_, i) => i);

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="!mb-0">
            👤 Face reference{showMulti ? `s (${faceIds.length}/6)` : ""}
          </label>
          {!showMulti && (
            <button
              onClick={() => setShowMulti(true)}
              className="text-[10px] text-ksp-accent hover:underline"
              title="Thêm góc khác (multi-face)"
            >
              + Thêm góc khác
            </button>
          )}
          {showMulti && faceIds.length === 0 && (
            <button
              onClick={() => setShowMulti(false)}
              className="text-[10px] text-ksp-muted hover:underline"
            >
              ← Single-face
            </button>
          )}
        </div>

        <div className={showMulti ? "grid grid-cols-3 gap-1.5" : ""}>
          {slots.map((slotIdx) => (
            <FaceSlotItem
              key={slotIdx}
              slotIdx={slotIdx}
              label={showMulti ? (FACE_LABELS[slotIdx] || `Góc ${slotIdx + 1}`) : "Chính diện"}
              refId={faceIds[slotIdx]}
              onUpload={(file) => handleFile(file, slotIdx)}
              onPickFromLibrary={() => setPickerOpenForSlot(slotIdx)}
              onRemove={() => handleRemove(slotIdx)}
              fullWidth={!showMulti}
            />
          ))}
        </div>

        <p className="text-[10px] text-ksp-muted leading-relaxed">
          {showMulti ? (
            <>💡 <strong>Multi-face mode:</strong> Mỗi ảnh ≥ 1024×1024px, lighting đều. Multi-face có thể không giống bằng single-face — khuyến nghị thử single-face trước.</>
          ) : (
            <>💡 <strong>Single-face mode (recommend):</strong> 1 ảnh chính diện, ≥ 1024×1024px, lighting tự nhiên, mặt chiếm 30-50% khung. Cách này match với dataset gốc → kết quả giống hơn.</>
          )}
        </p>
      </div>

      {pickerOpenForSlot !== null && (
        <LibraryPicker
          category="face"
          onSelect={(id) => handleSelectFromLibrary(id, pickerOpenForSlot)}
          onClose={() => setPickerOpenForSlot(null)}
        />
      )}
    </>
  );
}

function FaceSlotItem({
  slotIdx,
  label,
  refId,
  onUpload,
  onPickFromLibrary,
  onRemove,
  fullWidth = false,
}: {
  slotIdx: number;
  label: string;
  refId?: string;
  onUpload: (file: File) => void;
  onPickFromLibrary: () => void;
  onRemove: () => void;
  fullWidth?: boolean;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    if (refId) {
      getReferenceImage(refId).then((ref) => {
        if (ref) {
          url = URL.createObjectURL(ref.blob);
          setBlobUrl(url);
        }
      });
    } else {
      setBlobUrl(null);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [refId]);

  return (
    // v0.5.3 + v0.6.1: Single-face compact horizontal layout
    fullWidth && blobUrl ? (
      <div className="border border-ksp-border rounded p-2 bg-ksp-bg/30 flex items-center gap-3">
        <img
          src={blobUrl}
          alt={label}
          className="w-16 h-16 object-cover rounded flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-ksp-text mb-0.5">
            {label}
          </div>
          <div className="text-[10px] text-ksp-muted">✓ Đã upload</div>
        </div>
        <button
          onClick={onRemove}
          className="text-[11px] text-ksp-muted hover:text-ksp-bad px-2 py-1"
          title="Xóa"
        >
          ✕
        </button>
      </div>
    ) : fullWidth && !blobUrl ? (
      <div
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) onUpload(file);
        }}
        onDragOver={(e) => e.preventDefault()}
        className="border border-dashed border-ksp-border rounded p-3 hover:border-ksp-accent transition-colors flex items-center gap-3"
      >
        <div className="w-16 h-16 rounded bg-ksp-bg/50 flex items-center justify-center text-2xl flex-shrink-0">
          👤
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <div className="text-[11px] font-medium">{label}</div>
          <div className="flex gap-2">
            <label className="cursor-pointer">
              <span className="text-[10px] text-ksp-accent hover:underline">
                📤 Upload
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                }}
              />
            </label>
            <button
              onClick={onPickFromLibrary}
              className="text-[10px] text-ksp-accent hover:underline"
            >
              📚 Library
            </button>
          </div>
        </div>
      </div>
    ) : (
    // Multi-face mode: original square slots
    <div
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) onUpload(file);
      }}
      onDragOver={(e) => e.preventDefault()}
      className="border border-dashed border-ksp-border rounded p-1 hover:border-ksp-accent transition-colors flex flex-col aspect-square"
    >
      <div className="text-[9px] text-ksp-muted text-center leading-tight mb-0.5">
        #{slotIdx + 1} {label}
      </div>
      {blobUrl ? (
        <div className="flex-1 relative group">
          <img
            src={blobUrl}
            alt={label}
            className="w-full h-full object-cover rounded"
          />
          <button
            onClick={onRemove}
            className="absolute top-0.5 right-0.5 w-4 h-4 bg-ksp-bad text-white rounded-full text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity"
            title="Xóa"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
          <label className="cursor-pointer text-center">
            <span className="text-[10px] text-ksp-muted hover:text-ksp-accent">
              📤 Upload
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
              }}
            />
          </label>
          <button
            onClick={onPickFromLibrary}
            className="text-[10px] text-ksp-muted hover:text-ksp-accent"
          >
            📚 Library
          </button>
        </div>
      )}
    </div>
    )
  );
}

// ============================================================================
// SINGLE-IMAGE SLOT (for outfit, products) — same as before
// ============================================================================

interface RefSlotProps {
  label: string;
  category: RefCategory;
  refId?: string;
  onChange: (refId: string | undefined) => void;
}

function RefSlot({ label, category, refId, onChange }: RefSlotProps) {
  const { showToast } = useAppStore();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    if (refId) {
      getReferenceImage(refId).then((ref) => {
        if (ref) {
          url = URL.createObjectURL(ref.blob);
          setBlobUrl(url);
        } else {
          onChange(undefined);
        }
      });
    } else {
      setBlobUrl(null);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [refId]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Chỉ hỗ trợ file ảnh", "error");
      return;
    }
    const id = await saveReferenceImage({
      blob: file,
      category,
      tags: [],
      source: "upload",
    });
    await incrementRefUseCount(id);
    onChange(id);
    showToast(`Đã upload ${label}`, "success");
  };

  const handleSelectFromLibrary = async (id: string) => {
    await incrementRefUseCount(id);
    onChange(id);
    setPickerOpen(false);
  };

  return (
    <>
      <div
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onDragOver={(e) => e.preventDefault()}
        className="border border-dashed border-ksp-border rounded-lg p-2 hover:border-ksp-accent transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium w-16">{label}</span>
          {blobUrl ? (
            <>
              <img
                src={blobUrl}
                alt={label}
                className="w-10 h-10 rounded object-cover bg-ksp-bg"
              />
              <button
                onClick={() => setPickerOpen(true)}
                className="text-xs text-ksp-muted hover:text-ksp-accent"
                title="Đổi ảnh từ Library"
              >
                📚
              </button>
              <button
                onClick={() => onChange(undefined)}
                className="ml-auto text-xs text-ksp-bad hover:underline"
              >
                Xóa
              </button>
            </>
          ) : (
            <div className="ml-auto flex gap-1">
              <button
                onClick={() => setPickerOpen(true)}
                className="px-2 py-1 bg-ksp-bg border border-ksp-border rounded text-xs hover:border-ksp-accent"
                title="Chọn từ Library"
              >
                📚 Library
              </button>
              <label className="px-2 py-1 bg-ksp-bg border border-ksp-border rounded text-xs cursor-pointer hover:border-ksp-accent">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {pickerOpen && (
        <LibraryPicker
          category={category}
          onSelect={handleSelectFromLibrary}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

// ============================================================================
// LIBRARY PICKER — same as before
// ============================================================================

function LibraryPicker({
  category,
  onSelect,
  onClose,
}: {
  category: RefCategory;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [images, setImages] = useState<StoredReferenceImage[]>([]);
  const [filter, setFilter] = useState<RefCategory | "all">(category);

  useEffect(() => {
    if (filter === "all") {
      listReferenceImages().then(setImages);
    } else {
      listReferenceImages(filter).then(setImages);
    }
  }, [filter]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-ksp-panel border border-ksp-border rounded-lg max-w-sm w-full max-h-[80vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-ksp-panel border-b border-ksp-border p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase">Chọn từ Library</h3>
            <button onClick={onClose} className="text-ksp-muted">
              ✕
            </button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {(["all", "face", "outfit", "product", "general"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`px-2 py-0.5 text-[11px] rounded ${
                  filter === c
                    ? "bg-ksp-accent text-black"
                    : "bg-ksp-bg border border-ksp-border text-ksp-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 grid grid-cols-3 gap-2">
          {images.length === 0 ? (
            <div className="col-span-3 text-xs text-ksp-muted text-center py-4">
              Chưa có ảnh nào trong category này
            </div>
          ) : (
            images.map((img) => (
              <PickerThumb key={img.id} image={img} onClick={() => onSelect(img.id)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PickerThumb({
  image,
  onClick,
}: {
  image: StoredReferenceImage;
  onClick: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(image.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [image.blob]);

  return (
    <button
      onClick={onClick}
      className="aspect-square bg-ksp-bg border border-ksp-border rounded overflow-hidden hover:border-ksp-accent"
    >
      {url && <img src={url} className="w-full h-full object-cover" alt="" />}
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ReferencesSection() {
  const { currentProject, updateCurrentProject } = useAppStore();
  if (!currentProject) return null;

  const refIds = (currentProject as any).refImageIds || {};

  // Migration: if old `face` (single) field exists, convert to `faces[]`
  let faces: string[] = refIds.faces || [];
  if (!refIds.faces && refIds.face) {
    faces = [refIds.face];
  }

  const products: string[] = refIds.products || [];

  const updateRefIds = (updates: any) => {
    const newRefIds = { ...refIds, ...updates };
    // Clean up legacy face field
    delete newRefIds.face;

    const facesArray = newRefIds.faces || [];
    const validFaces = facesArray.filter(Boolean);

    updateCurrentProject({
      ...(currentProject as any),
      refImageIds: { ...newRefIds, faces: validFaces },
      references: {
        ...currentProject.references,
        hasFace: validFaces.length > 0,
        faceCount: validFaces.length,
        hasOutfit: !!(updates.outfit !== undefined ? updates.outfit : refIds.outfit),
        productCount:
          updates.products !== undefined
            ? updates.products.filter(Boolean).length
            : (refIds.products || []).filter(Boolean).length,
      },
    } as any);
  };

  // v0.5.3: Hide Face + Outfit sections when in Product Photography mode
  const mode = (currentProject as any).mode || "lifestyle";
  const isProductPhotoMode = mode === "product_photo";
  // v0.8.0: Film mode hides product section. If using character cards, also hide central face/outfit refs.
  const isFilmMode = mode === "film";
  const filmSubjectMode = (currentProject as any).filmSubjectMode || "simple";
  const useCharacterCards = isFilmMode && filmSubjectMode === "characters";

  return (
    <Section title={isProductPhotoMode ? "📦 Sản phẩm tham chiếu" : "📷 Hình tham chiếu"}>
      {/* v0.8.0: Show notice when in character cards mode */}
      {useCharacterCards && (
        <div className="p-2 bg-blue-500/5 border border-blue-500/30 rounded text-[11px] text-blue-400 leading-relaxed">
          💡 Đang dùng <strong>Character cards</strong> — face/outfit references được quản lý riêng trong "🎭 Film Cast & Characters" phía trên.
        </div>
      )}

      {/* === FACE GROUP — hide in Product Photo mode AND character_cards mode === */}
      {!isProductPhotoMode && !useCharacterCards && (
        <div className="space-y-2 p-2.5 bg-ksp-bg/30 rounded border border-ksp-border">
          <div className="flex items-center justify-between">
            <label className="!mb-0 flex items-center gap-1.5">
              <span>👤 Khuôn mặt</span>
            </label>
          </div>
          <MultiFaceSlot
            faceIds={faces}
            onChange={(newFaces) => updateRefIds({ faces: newFaces })}
          />
        </div>
      )}

      {/* === OUTFIT GROUP — hide in Product Photo mode AND character_cards mode === */}
      {!isProductPhotoMode && !useCharacterCards && (
        <div className="space-y-2 p-2.5 bg-ksp-bg/30 rounded border border-ksp-border">
          <div className="flex items-center justify-between">
            <label className="!mb-0 flex items-center gap-1.5">
              <span>👗 Trang phục</span>
              <span className="text-[10px] text-ksp-muted font-normal">
                ({refIds.outfit ? "1 ảnh" : currentProject.references.outfitTextDescription ? "mô tả text" : "trống"})
              </span>
            </label>
          </div>
          <RefSlot
            label="Outfit"
            category="outfit"
            refId={refIds.outfit}
            onChange={(id) => updateRefIds({ outfit: id })}
          />
          {!refIds.outfit && (
            <div>
              <label className="text-[10px]">Hoặc mô tả bằng text</label>
              <textarea
                value={currentProject.references.outfitTextDescription || ""}
                onChange={(e) =>
                  updateCurrentProject({
                    references: {
                      ...currentProject.references,
                      outfitTextDescription: e.target.value,
                    },
                  })
                }
                placeholder="VD: White volleyball jersey with 'VIET BOXING' printed, black shorts..."
                rows={2}
                className="text-xs"
              />
            </div>
          )}
        </div>
      )}

      {/* === PRODUCT GROUP === (Hidden in Film mode) */}
      {!isFilmMode && (
      <div className="space-y-2 p-2.5 bg-ksp-bg/30 rounded border border-ksp-border">
        <div className="flex items-center justify-between">
          <label className="!mb-0 flex items-center gap-1.5">
            <span>📦 Sản phẩm</span>
            <span className="text-[10px] text-ksp-muted font-normal">
              ({products.filter(Boolean).length} sản phẩm)
            </span>
          </label>
          <button
            onClick={() => updateRefIds({ products: [...products, ""] })}
            className="text-[11px] px-2 py-1 bg-ksp-bg border border-ksp-border rounded hover:border-ksp-accent"
          >
            + Add
          </button>
        </div>
        {products.length === 0 && (
          <p className="text-[10px] text-ksp-muted italic">
            Chưa có sản phẩm nào. Click "+ Add" để thêm sản phẩm cần xuất hiện trong ảnh.
          </p>
        )}
        {products.map((id, idx) => (
          <div key={idx} className="space-y-1.5 pt-2 border-t border-ksp-border/50 first:border-t-0 first:pt-0">
            <RefSlot
              label={`SP ${idx + 1}`}
              category="product"
              refId={id || undefined}
              onChange={(newId) => {
                const next = [...products];
                if (newId) {
                  next[idx] = newId;
                } else {
                  next.splice(idx, 1);
                }
                updateRefIds({ products: next });

                const descs = currentProject.references.productDescriptions || [];
                while (descs.length < next.length) descs.push("");
                descs.length = next.length;
                updateCurrentProject({
                  references: {
                    ...currentProject.references,
                    productDescriptions: descs,
                  },
                });
              }}
            />
            <input
              type="text"
              placeholder="Mô tả sản phẩm (VD: Vichy Liftactiv collagen day cream, hộp đỏ)"
              value={currentProject.references.productDescriptions?.[idx] || ""}
              onChange={(e) => {
                const descs = [
                  ...(currentProject.references.productDescriptions || []),
                ];
                while (descs.length < products.length) descs.push("");
                descs[idx] = e.target.value;
                updateCurrentProject({
                  references: {
                    ...currentProject.references,
                    productDescriptions: descs,
                  },
                });
              }}
              className="text-xs"
            />
            <div>
              <label className="text-[10px]">📍 Cách đặt sản phẩm trong khung hình</label>
              <select
                value={currentProject.references.productPlacements?.[idx] || "auto"}
                onChange={(e) => {
                  const placements = [
                    ...(currentProject.references.productPlacements || []),
                  ];
                  while (placements.length < products.length) placements.push("auto");
                  placements[idx] = e.target.value as any;
                  updateCurrentProject({
                    references: {
                      ...currentProject.references,
                      productPlacements: placements,
                    },
                  });
                }}
                className="text-xs"
              >
                <option value="auto">🤖 Auto - AI tự quyết</option>
                <option value="held_in_hand">✋ Cầm tay tự nhiên</option>
                <option value="displayed_held_high">📢 Giơ cao trước mặt (TVC)</option>
                <option value="placed_foreground">🎯 Foreground (sản phẩm là chính)</option>
                <option value="subject_using">💆 Đang sử dụng (bôi/uống/dùng)</option>
                <option value="next_to_subject">👈 Đặt cạnh nhân vật</option>
                <option value="background_styled">🏡 Background lifestyle</option>
              </select>
            </div>
          </div>
        ))}
      </div>
      )}
    </Section>
  );
}
