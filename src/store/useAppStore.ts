/**
 * Zustand store - v0.3
 * Adds: settings view, angle preset auto-pick
 */

import { create } from "zustand";
import type { PromptProject, Shot, AssembledPrompt } from "../types";
import { ANGLE_PRESETS, pickNextAngle } from "../engine/angles";

type ActiveView = "editor" | "library" | "history" | "settings";

interface AppState {
  currentProject: PromptProject | null;
  generatedPrompts: Map<string, AssembledPrompt>;
  activeView: ActiveView;
  toast: { message: string; type: "info" | "success" | "error" } | null;

  setCurrentProject: (project: PromptProject | null) => void;
  updateCurrentProject: (updates: Partial<PromptProject> | ((p: PromptProject) => Partial<PromptProject>)) => void;
  addShot: (shot: Shot) => void;
  updateShot: (shotId: string, updates: Partial<Shot>) => void;
  deleteShot: (shotId: string) => void;
  reorderShots: (shotIds: string[]) => void;

  setGeneratedPrompt: (shotId: string, result: AssembledPrompt) => void;
  clearGeneratedPrompts: () => void;

  setActiveView: (view: ActiveView) => void;
  showToast: (message: string, type?: "info" | "success" | "error") => void;
  hideToast: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentProject: null,
  generatedPrompts: new Map(),
  activeView: "editor",
  toast: null,

  setCurrentProject: (project) =>
    set({ currentProject: project, generatedPrompts: new Map() }),

  updateCurrentProject: (updates) =>
    set((state) => {
      if (!state.currentProject) return state;
      const patch = typeof updates === "function" ? updates(state.currentProject) : updates;
      return {
        currentProject: { ...state.currentProject, ...patch, updatedAt: Date.now() },
      };
    }),

  addShot: (shot) =>
    set((state) => {
      if (!state.currentProject) return state;
      return {
        currentProject: {
          ...state.currentProject,
          shots: [...state.currentProject.shots, shot],
          updatedAt: Date.now(),
        },
      };
    }),

  updateShot: (shotId, updates) =>
    set((state) => {
      if (!state.currentProject) return state;
      return {
        currentProject: {
          ...state.currentProject,
          shots: state.currentProject.shots.map((s) =>
            s.id === shotId ? { ...s, ...updates } : s
          ),
          updatedAt: Date.now(),
        },
      };
    }),

  deleteShot: (shotId) =>
    set((state) => {
      if (!state.currentProject) return state;
      return {
        currentProject: {
          ...state.currentProject,
          shots: state.currentProject.shots.filter((s) => s.id !== shotId),
          updatedAt: Date.now(),
        },
      };
    }),

  reorderShots: (shotIds) =>
    set((state) => {
      if (!state.currentProject) return state;
      const shotMap = new Map(state.currentProject.shots.map((s) => [s.id, s]));
      const reordered = shotIds
        .map((id, idx) => {
          const shot = shotMap.get(id);
          return shot ? { ...shot, order: idx + 1 } : null;
        })
        .filter((s): s is Shot => s !== null);
      return {
        currentProject: {
          ...state.currentProject,
          shots: reordered,
          updatedAt: Date.now(),
        },
      };
    }),

  setGeneratedPrompt: (shotId, result) =>
    set((state) => {
      const next = new Map(state.generatedPrompts);
      next.set(shotId, result);
      return { generatedPrompts: next };
    }),

  clearGeneratedPrompts: () => set({ generatedPrompts: new Map() }),

  setActiveView: (view) => set({ activeView: view }),

  showToast: (message, type = "info") => {
    set({ toast: { message, type } });
    setTimeout(() => {
      const current = get().toast;
      if (current?.message === message) set({ toast: null });
    }, 3000);
  },

  hideToast: () => set({ toast: null }),
}));

export function createEmptyProject(): PromptProject {
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name: "Project mới",
    mode: "lifestyle",
    industry: "general",
    idea: { raw: "", language: "vi" },
    references: { hasFace: false, hasOutfit: false, productCount: 0 },
    subject: {
      subjectType: "female",
      ethnicity: "Vietnamese",
      figureBuild: "slender",
      bust: "full",
      hair: {
        length: "waist",
        color: "dark brown",
        style: "straight",
        movement: "static",
      },
      makeup: {
        style: "korean_glass_skin",
        blushColor: "light pink",
        lipsType: "glossy peach-pink",
      },
      skinTone: "porcelain",
      eyes: { shape: "round", color: "dark_brown" },
    },
    cameraStyle: "BOKEH",
    aspectRatio: "9:16",
    shots: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a new shot with auto-picked angle preset based on existing shots in project.
 */
export function createEmptyShot(order: number, existingShots: Shot[] = []): Shot {
  const id = `shot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Auto-pick angle preset that hasn't been used recently
  const usedAngleIds = existingShots
    .map((s) => s.anglePresetId)
    .filter((id): id is string => !!id);
  const nextAngle = pickNextAngle(usedAngleIds);

  return {
    id,
    order,
    name: `Ảnh ${order} — ${nextAngle.name}`,
    anglePresetId: nextAngle.id,
    pose: {
      position: "",
      lookingAt: "camera",
      expression: "natural smile",
      framing: nextAngle.framing,
      cameraAngle: nextAngle.cameraAngle,
    },
  };
}
