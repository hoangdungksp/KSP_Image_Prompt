import { useEffect, useState } from "react";
import { useAppStore, createEmptyProject, createEmptyShot } from "../store/useAppStore";
import { listProjects, saveProject, deleteProject, deleteAllReferenceImages, listReferenceImages, type StoredProject } from "../store/db";
import { SHOT_MODES, INDUSTRIES } from "../engine/themes_industry/_modes_industries";

export function Projects() {
  const { currentProject, setCurrentProject, setActiveView, showToast } = useAppStore();
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [search, setSearch] = useState("");

  const refresh = async () => {
    const list = await listProjects();
    setProjects(list);
  };

  /**
   * r7.23: Create + open new project directly from Project List header.
   * Previously the only way to create a project was via Editor's empty state
   * (had to delete all projects first to see it). Now accessible anytime.
   */
  const handleCreateNewProject = async () => {
    const empty = createEmptyProject();
    empty.shots = [createEmptyShot(1)];
    await saveProject(empty);
    setCurrentProject(empty);
    setActiveView("editor");
    showToast("Đã tạo project mới", "success");
    refresh();
  };

  useEffect(() => {
    refresh();
  }, [currentProject]);

  const handleOpen = (project: StoredProject) => {
    setCurrentProject(project);
    setActiveView("editor");
    showToast(`Đã mở: ${project.name}`, "success");
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Xóa project "${name}"?\n(Không hoàn tác được)`)) return;
    await deleteProject(id);

    // v0.6.4: Auto-cleanup orphaned reference images when last project deleted
    const remaining = await listProjects();
    if (remaining.length === 0) {
      // Find references not used by any project
      const allRefs = await listReferenceImages();
      if (allRefs.length > 0) {
        const cleanup = confirm(
          `Đã xóa project cuối cùng. Bạn có muốn xóa luôn ${allRefs.length} hình tham chiếu (face/outfit/product) trong Library không?\n\n(Khuyến nghị: Có — để bắt đầu lại từ đầu)`
        );
        if (cleanup) {
          const deleted = await deleteAllReferenceImages();
          showToast(`Đã xóa project + ${deleted} hình`, "success");
        } else {
          showToast("Đã xóa project (giữ lại hình trong Library)", "success");
        }
      } else {
        showToast("Đã xóa project", "success");
      }
    } else {
      showToast("Đã xóa", "success");
    }

    if (currentProject?.id === id) {
      setCurrentProject(remaining[0] || null);
    }
    refresh();
  };

  const handleDuplicate = async (project: StoredProject) => {
    // r7.28-fix: When duplicating a Film project, clear ALL generated script data
    // — not just shotsBySceneId (Sprint 1.0 r4.1 was too narrow).
    //
    // Root cause of "Gấu Bự → Robot N.A.M.O" bug (May 21, 2026): if user duplicated
    // a finished project then edited the idea, Stage 1-4 would regenerate cleanly
    // from new idea + direction, but film.script (Stage 5 output) leaked from the
    // template and contaminated all downstream (Shot List, Storyboard).
    //
    // Preserved on duplicate: characters (concept sheets reusable), settingV2, idea.
    // Cleared on duplicate: script, structure, beats, twists, intermediateScenes,
    // narrativeDirection, sceneGrids, shotsBySceneId, and their lock flags.
    const isFilmMode =
      (project as any).settingV2?.mode === "film" || (project as any).filmV093 !== undefined;
    const newFilmV093 = isFilmMode && (project as any).filmV093
      ? {
          ...(project as any).filmV093,
          // Clear all generated script + storyboard data so duplicate starts fresh
          script: undefined,
          scriptStructure: undefined,
          scriptBeats: undefined,
          scriptTwists: undefined,
          scriptTwistsLocked: undefined,
          scriptIntermediateScenes: undefined,
          scriptScenesLocked: undefined,
          scriptStage: undefined,
          narrativeDirection: undefined,
          sceneGrids: undefined,
          shotsBySceneId: {},
        }
      : (project as any).filmV093;

    const newProject: StoredProject = {
      ...project,
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: `${project.name} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(isFilmMode ? { filmV093: newFilmV093 } : {}),
    } as StoredProject;
    await saveProject(newProject);
    showToast(
      isFilmMode
        ? "Đã clone project — script + storyboard cũ bị xóa, giữ characters + setting + idea"
        : "Đã clone project",
      "success"
    );
    refresh();
  };

  // Filter by search
  const filteredProjects = search.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.idea.raw.toLowerCase().includes(search.toLowerCase())
      )
    : projects;

  const formatDate = (ts: number) => {
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60_000) return "vừa xong";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)} phút trước`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h trước`;
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} ngày trước`;
    return new Date(ts).toLocaleDateString("vi-VN");
  };

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">📁 Projects ({projects.length})</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateNewProject}
            className="text-[11px] px-2 py-1 bg-ksp-accent text-black font-semibold rounded hover:opacity-90"
            title="Tạo project mới + mở Editor"
          >
            + New
          </button>
          <button
            onClick={refresh}
            className="text-[11px] px-2 py-1 bg-ksp-panel border border-ksp-border rounded hover:border-ksp-accent"
            title="Refresh project list"
          >
            🔄
          </button>
        </div>
      </div>

      {projects.length > 3 && (
        <input
          type="text"
          placeholder="🔍 Tìm project..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs"
        />
      )}

      {filteredProjects.length === 0 ? (
        <p className="text-xs text-ksp-muted text-center py-8">
          {search.trim() ? "Không tìm thấy project phù hợp." : "Chưa có project nào."}
        </p>
      ) : (
        filteredProjects.map((p) => {
          const isActive = currentProject?.id === p.id;
          const mode = (p as any).mode;
          const industry = (p as any).industry;
          const modeConfig = mode ? SHOT_MODES.find((m) => m.id === mode) : null;
          const industryConfig = industry ? INDUSTRIES.find((i) => i.id === industry) : null;
          const refCount =
            (p.references?.faceCount || 0) +
            (p.references?.hasOutfit ? 1 : 0) +
            (p.references?.productCount || 0);

          return (
            <div
              key={p.id}
              className={`rounded p-2 transition-colors ${
                isActive
                  ? "bg-ksp-accent/10 border border-ksp-accent"
                  : "bg-ksp-panel border border-ksp-border hover:border-ksp-accent/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    {isActive && (
                      <span className="text-[9px] px-1 py-0.5 bg-ksp-accent text-black rounded font-medium flex-shrink-0">
                        Đang mở
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-ksp-muted flex-wrap">
                    {modeConfig && (
                      <span>{modeConfig.emoji} {modeConfig.name}</span>
                    )}
                    {industryConfig && industryConfig.id !== "general" && (
                      <span>· {industryConfig.emoji} {industryConfig.name}</span>
                    )}
                    {refCount > 0 && <span>· {refCount} refs</span>}
                    <span>· {formatDate(p.updatedAt)}</span>
                  </div>

                  {p.idea.raw && (
                    <div className="text-[11px] text-ksp-muted mt-1 line-clamp-1">
                      💭 {p.idea.raw}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 flex-shrink-0">
                  {!isActive && (
                    <button
                      onClick={() => handleOpen(p)}
                      className="text-[11px] px-2 py-1 bg-ksp-accent text-black rounded font-medium"
                    >
                      Mở
                    </button>
                  )}
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleDuplicate(p)}
                      className="text-[11px] px-1.5 py-1 bg-ksp-bg border border-ksp-border rounded hover:border-ksp-accent"
                      title="Clone project"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="text-[11px] px-1.5 py-1 text-ksp-bad hover:bg-ksp-bad/10 rounded"
                      title="Xóa"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
