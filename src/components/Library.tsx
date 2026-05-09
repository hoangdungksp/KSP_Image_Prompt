import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  listReferenceImages,
  saveReferenceImage,
  updateReferenceImage,
  deleteReferenceImage,
  deleteAllReferenceImages,
  processPendingImports,
  type StoredReferenceImage,
  type RefCategory,
} from "../store/db";

const CATEGORIES: { value: RefCategory | "all"; label: string; emoji: string }[] = [
  { value: "all", label: "Tất cả", emoji: "📁" },
  { value: "face", label: "Khuôn mặt", emoji: "📷" },
  { value: "outfit", label: "Trang phục", emoji: "👗" },
  { value: "product", label: "Sản phẩm", emoji: "📦" },
  { value: "inspiration", label: "Tham khảo", emoji: "💡" },
  { value: "general", label: "Chưa phân loại", emoji: "📁" },
];

export function Library() {
  const { showToast } = useAppStore();
  const [images, setImages] = useState<StoredReferenceImage[]>([]);
  const [filter, setFilter] = useState<RefCategory | "all">("all");
  const [selected, setSelected] = useState<StoredReferenceImage | null>(null);

  const refresh = useCallback(async () => {
    // First, process any pending Pinterest imports
    const importedCount = await processPendingImports();
    if (importedCount > 0) {
      showToast(`Đã import ${importedCount} ảnh từ Pinterest`, "success");
    }

    const list =
      filter === "all"
        ? await listReferenceImages()
        : await listReferenceImages(filter);
    setImages(list);
  }, [filter, showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen to PENDING_IMPORT_ADDED messages
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg?.type === "PENDING_IMPORT_ADDED") refresh();
    };
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handler);
      return () => chrome.runtime.onMessage.removeListener(handler);
    }
  }, [refresh]);

  const handleUpload = async (files: FileList | null, category: RefCategory) => {
    if (!files || files.length === 0) return;
    let count = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      await saveReferenceImage({
        blob: file,
        category,
        tags: [],
        source: "upload",
      });
      count++;
    }
    showToast(`Đã upload ${count} ảnh`, "success");
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa ảnh này khỏi Library?")) return;
    await deleteReferenceImage(id);
    showToast("Đã xóa", "success");
    setSelected(null);
    refresh();
  };

  // v0.6.4: Delete all images (filtered by current filter or all)
  const handleDeleteAll = async () => {
    const cat = filter === "all" ? undefined : filter;
    const label = filter === "all" ? "TẤT CẢ" : `loại "${CATEGORIES.find((c) => c.value === filter)?.label}"`;

    const first = confirm(
      `⚠️ Xóa ${label} ảnh trong Library (${images.length} ảnh)?\n\nKhông hoàn tác được. Tất cả face/outfit/product references sẽ bị xóa vĩnh viễn.`
    );
    if (!first) return;

    // Double confirm để chắc chắn
    const second = confirm(`Bạn CHẮC CHẮN muốn xóa ${images.length} ảnh? Click OK để xác nhận lần cuối.`);
    if (!second) return;

    const deleted = await deleteAllReferenceImages(cat);
    showToast(`✓ Đã xóa ${deleted} ảnh`, "success");
    setSelected(null);
    refresh();
  };

  const handleUpdateRef = async (id: string, updates: Partial<StoredReferenceImage>) => {
    await updateReferenceImage(id, updates);
    refresh();
    if (selected?.id === id) {
      setSelected({ ...selected, ...updates });
    }
  };

  return (
    <div className="p-3 space-y-3">
      {/* Header with filter + delete all */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilter(cat.value)}
            className={`px-2 py-1 text-xs rounded ${
              filter === cat.value
                ? "bg-ksp-accent text-black"
                : "bg-ksp-panel border border-ksp-border text-ksp-muted hover:text-ksp-text"
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
        {images.length > 0 && (
          <button
            onClick={handleDeleteAll}
            className="ml-auto px-2 py-1 text-xs rounded bg-ksp-bad/20 border border-ksp-bad/40 text-ksp-bad hover:bg-ksp-bad/30"
            title={filter === "all" ? "Xóa tất cả ảnh trong Library" : `Xóa tất cả ảnh loại ${filter}`}
          >
            🗑 Xóa tất cả ({images.length})
          </button>
        )}
      </div>

      {/* Upload */}
      <div className="bg-ksp-panel border border-ksp-border rounded p-2">
        <div className="text-xs text-ksp-muted mb-2">📤 Upload ảnh mới</div>
        <div className="grid grid-cols-2 gap-2">
          {(["face", "outfit", "product", "general"] as RefCategory[]).map((cat) => {
            const c = CATEGORIES.find((x) => x.value === cat)!;
            return (
              <label
                key={cat}
                className="px-2 py-1.5 bg-ksp-bg border border-ksp-border rounded text-xs cursor-pointer hover:border-ksp-accent text-center"
              >
                {c.emoji} {c.label}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files, cat)}
                />
              </label>
            );
          })}
        </div>
        <div className="text-[10px] text-ksp-muted mt-2 leading-relaxed">
          💡 Hoặc <strong>right-click</strong> bất kỳ ảnh nào trên web (Pinterest, Google Images...) → <strong>Save to KSP ImagePrompt</strong> → chọn category.
        </div>
      </div>

      {/* Grid */}
      {images.length === 0 ? (
        <div className="text-xs text-ksp-muted text-center py-8">
          Library trống. Upload hoặc right-click ảnh trên web để bắt đầu.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <RefThumb
              key={img.id}
              image={img}
              onClick={() => setSelected(img)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <RefDetail
          image={selected}
          onClose={() => setSelected(null)}
          onDelete={() => handleDelete(selected.id)}
          onUpdate={(updates) => handleUpdateRef(selected.id, updates)}
        />
      )}
    </div>
  );
}

function RefThumb({
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

  const catEmoji = CATEGORIES.find((c) => c.value === image.category)?.emoji || "📁";

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) return;
    const ext = image.blob.type.split("/")[1] || "jpg";
    const name = image.name || image.category || "ref";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}_${image.id.slice(-6)}.${ext}`;
    a.click();
  };

  return (
    <div
      onClick={onClick}
      className="relative aspect-square bg-ksp-panel border border-ksp-border rounded overflow-hidden cursor-pointer hover:border-ksp-accent group"
    >
      {url && (
        <img
          src={url}
          alt={image.name || image.category}
          className="w-full h-full object-cover"
        />
      )}
      <div className="absolute top-1 left-1 px-1 bg-black/70 rounded text-[10px]">
        {catEmoji}
      </div>
      {image.source === "pinterest" && (
        <div className="absolute top-1 right-1 px-1 bg-red-600 rounded text-[10px] text-white font-bold">
          P
        </div>
      )}
      {/* DOWNLOAD ICON - appears on hover */}
      <button
        onClick={handleDownload}
        title="Download ảnh để upload sang AI provider"
        className="absolute bottom-1 left-1 w-6 h-6 bg-black/80 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-ksp-accent hover:text-black transition-opacity"
      >
        <span className="text-xs">⬇</span>
      </button>
      {image.useCount > 0 && (
        <div className="absolute bottom-1 right-1 px-1 bg-black/70 rounded text-[10px]">
          {image.useCount}×
        </div>
      )}
    </div>
  );
}

function RefDetail({
  image,
  onClose,
  onDelete,
  onUpdate,
}: {
  image: StoredReferenceImage;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<StoredReferenceImage>) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(image.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [image.blob]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-ksp-panel border border-ksp-border rounded-lg max-w-sm w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Image */}
        {url && (
          <img
            src={url}
            alt={image.name || ""}
            className="w-full max-h-64 object-contain bg-black"
          />
        )}

        {/* Form */}
        <div className="p-3 space-y-2">
          <div>
            <label>Tên</label>
            <input
              type="text"
              value={image.name || ""}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="VD: Hương face"
            />
          </div>

          <div>
            <label>Category</label>
            <select
              value={image.category}
              onChange={(e) => onUpdate({ category: e.target.value as RefCategory })}
            >
              {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                <option key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Tags (cách nhau bằng phẩy)</label>
            <input
              type="text"
              value={image.tags.join(", ")}
              onChange={(e) =>
                onUpdate({
                  tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="VD: áo dài, đỏ, truyền thống"
            />
          </div>

          <div>
            <label>Notes</label>
            <textarea
              value={image.notes || ""}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              rows={2}
              placeholder="Ghi chú riêng"
            />
          </div>

          {image.sourceUrl && (
            <div className="text-[10px] text-ksp-muted truncate">
              🔗 Source:{" "}
              <a href={image.sourceUrl} target="_blank" className="underline" rel="noreferrer">
                {image.sourceUrl}
              </a>
            </div>
          )}

          <div className="text-[10px] text-ksp-muted">
            Đã dùng {image.useCount}× · Tạo{" "}
            {new Date(image.createdAt).toLocaleDateString("vi-VN")}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                if (!url) return;
                const ext = image.blob.type.split("/")[1] || "jpg";
                const name = image.name || image.category || "ref";
                const a = document.createElement("a");
                a.href = url;
                a.download = `${name}_${image.id.slice(-6)}.${ext}`;
                a.click();
              }}
              className="flex-1 px-3 py-2 bg-ksp-accent text-black rounded text-xs font-semibold"
            >
              ⬇ Download
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 bg-ksp-bg border border-ksp-border rounded text-xs"
            >
              Đóng
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-2 bg-ksp-bad/20 border border-ksp-bad text-ksp-bad rounded text-xs"
            >
              🗑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
