import { useState } from "react";
import { useAppStore, createEmptyShot } from "../store/useAppStore";
import { Section } from "./Section";
import { ShotEditor } from "./ShotEditor";
import { assemblePrompt } from "../engine/assembler";

export function ShotsSection() {
  const {
    currentProject,
    generatedPrompts,
    addShot,
    setGeneratedPrompt,
    showToast,
    reorderShots,
  } = useAppStore();

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (!currentProject) return null;

  const handleAddShot = () => {
    const shot = createEmptyShot(currentProject.shots.length + 1, currentProject.shots);
    addShot(shot);
  };

  const handleGenerateAll = () => {
    let count = 0;
    for (const shot of currentProject.shots) {
      try {
        const result = assemblePrompt(currentProject, shot);
        setGeneratedPrompt(shot.id, result);
        count++;
      } catch (e) {
        console.error(`Failed to generate shot ${shot.id}:`, e);
      }
    }
    showToast(`Đã tạo ${count} prompts`, "success");
  };

  const handleCopyAll = async () => {
    const all: string[] = [];
    for (const shot of currentProject.shots) {
      const result = generatedPrompts.get(shot.id);
      if (result) {
        all.push(`# ${shot.name}\n\n${result.prompt}\n\n${"=".repeat(60)}`);
      }
    }
    if (all.length === 0) {
      showToast("Chưa có prompt nào — generate trước", "error");
      return;
    }
    await navigator.clipboard.writeText(all.join("\n\n"));
    showToast(`Đã copy ${all.length} prompts`, "success");
  };

  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDragOver = (id: string) => {
    if (!draggingId || draggingId === id) return;
    setDragOverId(id);

    // Reorder live
    const shotIds = currentProject.shots.map((s) => s.id);
    const fromIdx = shotIds.indexOf(draggingId);
    const toIdx = shotIds.indexOf(id);
    if (fromIdx === -1 || toIdx === -1) return;

    const next = [...shotIds];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, draggingId);
    reorderShots(next);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  return (
    <Section
      title={`🎬 Shots (${currentProject.shots.length})`}
      rightAction={
        <button
          onClick={handleAddShot}
          className="text-xs px-2 py-1 bg-ksp-accent text-black rounded font-medium hover:opacity-90"
        >
          + Add
        </button>
      }
    >
      {currentProject.shots.length === 0 ? (
        <p className="text-xs text-ksp-muted text-center py-4">
          Chưa có shot nào. Click "+ Add" để bắt đầu.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {currentProject.shots.map((shot, idx) => (
              <ShotEditor
                key={shot.id}
                shot={shot}
                index={idx}
                isDragging={draggingId === shot.id}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>

          <div className="flex gap-2 mt-3 pt-3 border-t border-ksp-border">
            <button
              onClick={handleGenerateAll}
              className="flex-1 px-3 py-2 bg-ksp-accent text-black rounded text-xs font-semibold hover:opacity-90"
            >
              ⚡ Generate All ({currentProject.shots.length})
            </button>
            <button
              onClick={handleCopyAll}
              className="px-3 py-2 bg-ksp-panel border border-ksp-border rounded text-xs hover:border-ksp-accent"
            >
              📋 Copy All
            </button>
          </div>

          {dragOverId && (
            <p className="text-[10px] text-ksp-accent text-center mt-2">
              📍 Drop để di chuyển
            </p>
          )}
        </>
      )}
    </Section>
  );
}
