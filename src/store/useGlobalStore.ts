/**
 * KSP Image v0.9.0 — Store actions extension
 *
 * Adds Zustand actions for v0.9.0 features:
 * - API Keys management (encrypted local storage)
 * - Project Setting v2 (consolidated)
 * - Script CRUD (Film mode)
 * - Concept CRUD (TVC mode)
 * - Film hierarchy: Scenes → Shots → Frames CRUD
 * - Voice + Music + SFX sections
 * - Migration v0.8.x → v0.9.0
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ApiKeys,
  ApiKeysStatus,
  ProjectSettingV2,
  TimeFormat,
  FilmScript,
  FilmSceneScript,
  TvcConcept,
  FilmStructure,
  FilmShot,
  FilmCharacterV2,
  ProjectModeV2,
} from "../types/project";

// ============================================================================
// VIEW MODE (Hybrid: Sidebar 380px vs Editor tab 1400px)
// ============================================================================

export type ViewMode = "sidebar" | "editor";

// ============================================================================
// GLOBAL APP STATE (cross-project)
// ============================================================================

interface GlobalAppStateV2 {
  // API Keys (persisted, encrypted)
  apiKeys: ApiKeys;
  setApiKey: (provider: keyof ApiKeys, key: string) => void;
  removeApiKey: (provider: keyof ApiKeys) => void;
  getApiKeysStatus: () => ApiKeysStatus;

  // View mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Editor tab navigation (which step is currently focused)
  focusedStep: "project" | "cast" | "idea" | "concept" | "script" | "storyboard" | "image_gen" | "video_ai" | "voice" | "music" | "bundle";
  setFocusedStep: (step: GlobalAppStateV2["focusedStep"]) => void;

  // Editor focused entities
  focusedShotId: string | null;
  focusedSceneId: string | null;
  focusedCharacterId: string | null;
  setFocusedShot: (id: string | null) => void;
  setFocusedScene: (id: string | null) => void;
  setFocusedCharacter: (id: string | null) => void;
}

/**
 * Simple obfuscation for API keys in localStorage.
 * NOT real encryption — just discourages casual snooping in DevTools.
 * For real security, user should use Chrome's storage.local with proper encryption.
 */
function obfuscate(s: string): string {
  if (!s) return "";
  return btoa(s.split("").reverse().join(""));
}

function deobfuscate(s: string): string {
  if (!s) return "";
  try {
    return atob(s).split("").reverse().join("");
  } catch {
    return "";
  }
}

export const useGlobalStore = create<GlobalAppStateV2>()(
  persist(
    (set, get) => ({
      apiKeys: {},

      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),

      removeApiKey: (provider) =>
        set((state) => {
          const next = { ...state.apiKeys };
          delete next[provider];
          return { apiKeys: next };
        }),

      getApiKeysStatus: (): ApiKeysStatus => {
        const keys = get().apiKeys;
        const isPresent = (k?: string) =>
          k && k.length > 8 ? "connected" : k ? "invalid" : "empty";
        return {
          gemini: isPresent(keys.gemini) as ApiKeysStatus["gemini"],
          openai: isPresent(keys.openai) as ApiKeysStatus["openai"],
          elevenlabs: isPresent(keys.elevenlabs) as ApiKeysStatus["elevenlabs"],
          googleTts: isPresent(keys.googleTts) as ApiKeysStatus["googleTts"],
          suno: isPresent(keys.suno) as ApiKeysStatus["suno"],
        };
      },

      viewMode: "sidebar",
      setViewMode: (mode) => set({ viewMode: mode }),

      focusedStep: "project",
      setFocusedStep: (step) => set({ focusedStep: step }),

      focusedShotId: null,
      focusedSceneId: null,
      focusedCharacterId: null,
      setFocusedShot: (id) => set({ focusedShotId: id }),
      setFocusedScene: (id) => set({ focusedSceneId: id }),
      setFocusedCharacter: (id) => set({ focusedCharacterId: id }),
    }),
    {
      name: "ksp-global-v0.9.0",
      partialize: (state) => ({
        // Only persist API keys (obfuscated) and view mode
        apiKeys: Object.fromEntries(
          Object.entries(state.apiKeys).map(([k, v]) => [k, v ? obfuscate(v) : v])
        ),
        viewMode: state.viewMode,
      }),
      // On rehydrate, deobfuscate keys
      onRehydrateStorage: () => (state) => {
        if (state?.apiKeys) {
          state.apiKeys = Object.fromEntries(
            Object.entries(state.apiKeys).map(([k, v]) => [k, v ? deobfuscate(v as string) : v])
          ) as ApiKeys;
        }
      },
    }
  )
);

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Default project setting v2 with sensible defaults.
 * Q5 confirmed: timeFormat default = "integer".
 */
export function createDefaultSettingV2(
  mode: ProjectModeV2,
  name = "New Project"
): ProjectSettingV2 {
  const now = Date.now();
  return {
    name,
    mode,
    aspectRatio: mode === "film" ? "21:9" : "9:16",
    timeFormat: "integer", // Q5 default
    aiProviders: {
      scriptWriter: "gemini-flash",
      conceptWriter: "gemini-flash",
      storyboardFrames: "gemini-flash",
      imageGen: "imagen-4-standard",
      voiceTts: "elevenlabs",
    },
    autosaveIntervalSeconds: 30,
    versioningEnabled: true,
    uiTheme: "dark",
    defaultLanguage: "vi",
    createdAt: now,
    updatedAt: now,
    ...(mode === "film" ? { genre: "drama", animationStyle: "live_action", durationMinutes: 5 } : {}),
    ...(mode === "tvc_commercial" ? { industry: "skincare", durationMinutes: 0.5 } : {}),
  };
}

/**
 * Create empty Film Script structure.
 */
export function createEmptyScript(): FilmScript {
  const now = Date.now();
  return {
    titleEn: "",
    titleVi: "",
    logline: "",
    synopsisEn: "",
    scenes: [],
    versions: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create empty TVC Concept.
 */
export function createEmptyConcept(): TvcConcept {
  const now = Date.now();
  return {
    loglineEn: "",
    synopsisEn: "",
    tone: [],
    audience: { demographic: "", psychographic: "", platform: "" },
    keyMessages: [],
    visualReferences: [],
    brandVoice: "",
    ctaLogoEnd: "",
    versions: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create empty Film Structure.
 */
export function createEmptyFilmStructure(durationMinutes: number): FilmStructure {
  return {
    totalDurationMinutes: durationMinutes,
    scenes: [],
  };
}

/**
 * Generate ID with prefix.
 */
export function genId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
