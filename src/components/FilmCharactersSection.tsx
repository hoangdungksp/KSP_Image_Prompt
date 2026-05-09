import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { Section } from "./Section";
import { saveReferenceImage, getReferenceImage } from "../store/db";
import type { FilmCharacter } from "../types";

const ROLES: Array<{ value: FilmCharacter["role"]; label: string; emoji: string }> = [
  { value: "protagonist", label: "Protagonist", emoji: "⭐" },
  { value: "antagonist", label: "Antagonist", emoji: "😈" },
  { value: "supporting", label: "Supporting", emoji: "👥" },
  { value: "extra", label: "Extra", emoji: "👤" },
];

function generateCharId() {
  return `char_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function FilmCharactersSection() {
  const { currentProject, updateCurrentProject, showToast } = useAppStore();
  if (!currentProject) return null;

  const characters = currentProject.filmCharacters || [];
  const subjectMode = currentProject.filmSubjectMode || "simple";

  const updateCharacters = (newCharacters: FilmCharacter[]) => {
    updateCurrentProject({ filmCharacters: newCharacters });
  };

  const handleAddCharacter = () => {
    const newChar: FilmCharacter = {
      id: generateCharId(),
      name: `Character ${characters.length + 1}`,
      role: characters.length === 0 ? "protagonist" : "supporting",
      faceImageIds: [],
      outfitImageIds: [],
      order: characters.length,
    };
    updateCharacters([...characters, newChar]);
    showToast(`✓ Added character: ${newChar.name}`, "success");
  };

  const handleDeleteCharacter = (id: string) => {
    const char = characters.find((c) => c.id === id);
    if (!char) return;
    const filtered = characters.filter((c) => c.id !== id);
    // Renumber order
    const reordered = filtered.map((c, idx) => ({ ...c, order: idx }));
    updateCharacters(reordered);
    showToast(`✓ Đã xóa "${char.name}"`, "success");
  };

  const handleUpdateCharacter = (id: string, updates: Partial<FilmCharacter>) => {
    const updated = characters.map((c) => (c.id === id ? { ...c, ...updates } : c));
    updateCharacters(updated);
  };

  const handleMoveCharacter = (id: string, direction: "up" | "down") => {
    const idx = characters.findIndex((c) => c.id === id);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= characters.length) return;
    const newChars = [...characters];
    [newChars[idx], newChars[targetIdx]] = [newChars[targetIdx], newChars[idx]];
    const reordered = newChars.map((c, i) => ({ ...c, order: i }));
    updateCharacters(reordered);
  };

  return (
    <Section title="🎭 Film Cast & Characters">
      {/* Subject mode toggle */}
      <div className="p-2 bg-ksp-bg/30 border border-ksp-border rounded">
        <label className="text-[11px] !mb-1">Quản lý nhân vật:</label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => updateCurrentProject({ filmSubjectMode: "simple" })}
            className={`p-2 rounded text-[11px] transition-colors ${
              subjectMode === "simple"
                ? "bg-ksp-accent text-black font-semibold"
                : "bg-ksp-bg border border-ksp-border hover:border-ksp-accent"
            }`}
          >
            <div className="font-medium">📋 Đơn giản</div>
            <div className="text-[9px] opacity-70 mt-0.5">Dùng Subject DNA chung</div>
          </button>
          <button
            onClick={() => updateCurrentProject({ filmSubjectMode: "characters" })}
            className={`p-2 rounded text-[11px] transition-colors ${
              subjectMode === "characters"
                ? "bg-ksp-accent text-black font-semibold"
                : "bg-ksp-bg border border-ksp-border hover:border-ksp-accent"
            }`}
          >
            <div className="font-medium">🎬 Chi tiết</div>
            <div className="text-[9px] opacity-70 mt-0.5">Character cards riêng</div>
          </button>
        </div>
      </div>

      {/* Only show character list in detailed mode */}
      {subjectMode === "characters" && (
        <>
          <div className="flex items-center justify-between">
            <label className="!mb-0">
              👥 Cast ({characters.length} nhân vật)
            </label>
            <button
              onClick={handleAddCharacter}
              className="text-[11px] px-2 py-1 bg-ksp-accent text-black rounded font-medium hover:opacity-90"
            >
              + Add Character
            </button>
          </div>

          {characters.length === 0 && (
            <div className="p-4 bg-ksp-bg/30 border border-dashed border-ksp-border rounded text-center text-[11px] text-ksp-muted">
              Chưa có nhân vật nào.
              <br />
              Click "+ Add Character" để bắt đầu.
            </div>
          )}

          <div className="space-y-2">
            {characters.map((char, idx) => (
              <CharacterCard
                key={char.id}
                character={char}
                isFirst={idx === 0}
                isLast={idx === characters.length - 1}
                onUpdate={(updates) => handleUpdateCharacter(char.id, updates)}
                onDelete={() => handleDeleteCharacter(char.id)}
                onMove={(dir) => handleMoveCharacter(char.id, dir)}
              />
            ))}
          </div>
        </>
      )}

      {subjectMode === "simple" && (
        <div className="p-2 bg-blue-500/5 border border-blue-500/30 rounded text-[11px] text-blue-400 leading-relaxed">
          💡 Mode "Đơn giản" - dùng <strong>Subject DNA</strong> bên dưới + face/outfit references chung. Phù hợp khi film có 1 nhân vật chính hoặc cảnh đơn giản.
          <br />
          <br />
          Khi cần multi-character với từng face/outfit riêng → chuyển sang mode "🎬 Chi tiết".
        </div>
      )}
    </Section>
  );
}

function CharacterCard({
  character,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMove,
}: {
  character: FilmCharacter;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (updates: Partial<FilmCharacter>) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const { showToast } = useAppStore();
  const [expanded, setExpanded] = useState(true);

  const handleUploadFace = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const id = await saveReferenceImage({
      blob: file,
      category: "face",
      tags: [],
      source: "upload",
      name: `${character.name} face`,
    });
    onUpdate({ faceImageIds: [...character.faceImageIds, id] });
    showToast(`✓ Added face for ${character.name}`, "success");
  };

  const handleUploadOutfit = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const id = await saveReferenceImage({
      blob: file,
      category: "outfit",
      tags: [],
      source: "upload",
      name: `${character.name} outfit`,
    });
    onUpdate({ outfitImageIds: [...character.outfitImageIds, id] });
    showToast(`✓ Added outfit for ${character.name}`, "success");
  };

  const removeFaceAt = (idx: number) => {
    onUpdate({ faceImageIds: character.faceImageIds.filter((_, i) => i !== idx) });
  };

  const removeOutfitAt = (idx: number) => {
    onUpdate({ outfitImageIds: character.outfitImageIds.filter((_, i) => i !== idx) });
  };

  const roleConfig = ROLES.find((r) => r.value === character.role) || ROLES[2];

  return (
    <div className="border border-ksp-border rounded bg-ksp-bg/40">
      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b border-ksp-border">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-ksp-muted hover:text-ksp-text"
        >
          {expanded ? "▼" : "▶"}
        </button>
        <span className="text-[11px]">{roleConfig.emoji}</span>
        <input
          type="text"
          value={character.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="text-[11px] flex-1 px-1.5 py-0.5"
          placeholder="Character name..."
        />
        <select
          value={character.role}
          onChange={(e) => onUpdate({ role: e.target.value as FilmCharacter["role"] })}
          className="text-[10px] px-1.5 py-0.5"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.emoji} {r.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => onMove("up")}
          disabled={isFirst}
          className="text-[10px] px-1.5 py-0.5 bg-ksp-bg border border-ksp-border rounded hover:border-ksp-accent disabled:opacity-30"
          title="Move up"
        >
          ↑
        </button>
        <button
          onClick={() => onMove("down")}
          disabled={isLast}
          className="text-[10px] px-1.5 py-0.5 bg-ksp-bg border border-ksp-border rounded hover:border-ksp-accent disabled:opacity-30"
          title="Move down"
        >
          ↓
        </button>
        <button
          onClick={onDelete}
          className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20"
          title="Delete character"
        >
          🗑
        </button>
      </div>

      {expanded && (
        <div className="p-2 space-y-2">
          {/* Description */}
          <div>
            <label className="text-[10px] !mb-1">Description (age, ethnicity, build, demeanor)</label>
            <input
              type="text"
              value={character.description || ""}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="VD: Cô gái 25 tuổi, Vietnamese, slender, intelligent and determined"
              className="text-[11px]"
            />
          </div>

          {/* Unique identifiers (boost face fidelity) */}
          <div>
            <label className="text-[10px] !mb-1">🎯 Unique features (boost similarity)</label>
            <input
              type="text"
              value={character.uniqueIdentifiers || ""}
              onChange={(e) => onUpdate({ uniqueIdentifiers: e.target.value })}
              placeholder="VD: nốt ruồi má trái, mí đôi, sống mũi cao"
              className="text-[11px]"
            />
          </div>

          {/* Face references */}
          <div>
            <label className="text-[10px] !mb-1">📷 Face references ({character.faceImageIds.length})</label>
            <div className="grid grid-cols-4 gap-1">
              {character.faceImageIds.map((id, idx) => (
                <FaceThumb key={id} refId={id} onRemove={() => removeFaceAt(idx)} />
              ))}
              {character.faceImageIds.length < 6 && (
                <label className="aspect-square border border-dashed border-ksp-border rounded flex items-center justify-center cursor-pointer hover:border-ksp-accent text-[10px] text-ksp-muted">
                  + Face
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadFace(f);
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Outfit references */}
          <div>
            <label className="text-[10px] !mb-1">👗 Outfit references ({character.outfitImageIds.length})</label>
            <div className="grid grid-cols-4 gap-1">
              {character.outfitImageIds.map((id, idx) => (
                <FaceThumb key={id} refId={id} onRemove={() => removeOutfitAt(idx)} />
              ))}
              {character.outfitImageIds.length < 4 && (
                <label className="aspect-square border border-dashed border-ksp-border rounded flex items-center justify-center cursor-pointer hover:border-ksp-accent text-[10px] text-ksp-muted">
                  + Outfit
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadOutfit(f);
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FaceThumb({ refId, onRemove }: { refId: string; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let blobUrl: string | null = null;
    getReferenceImage(refId).then((ref) => {
      if (ref) {
        blobUrl = URL.createObjectURL(ref.blob);
        setUrl(blobUrl);
      }
    });
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [refId]);

  return (
    <div className="relative aspect-square border border-ksp-border rounded overflow-hidden group">
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="bg-ksp-bg/50 w-full h-full" />
      )}
      <button
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 bg-black/60 text-white text-[9px] w-4 h-4 rounded opacity-0 group-hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
