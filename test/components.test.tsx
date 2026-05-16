/**
 * Test render từng v0.9.0 component standalone để chắc rằng
 * không có component nào crash khi mount.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import { useAppStore } from "../src/store/useAppStore";

import { ProjectSettingSection } from "../src/components/ProjectSettingSection";
import { CastFilmSection } from "../src/components/CastFilmSection";
import { FilmIdeaScriptSection } from "../src/components/FilmIdeaScriptSection";
import { FilmStoryboardSection } from "../src/components/FilmStoryboardSection";
import { FilmVoiceSection } from "../src/components/FilmVoiceSection";
import { FilmMusicSfxSection } from "../src/components/FilmMusicSfxSection";
import { FilmBundleExportSection } from "../src/components/FilmBundleExportSection";

const filmProject: any = {
  id: "p1",
  name: "Test",
  mode: "film",
  idea: { raw: "test" },
  shots: [],
  createdAt: Date.now(),
  schemaVersion: "v0.9",
  settingV2: {
    name: "Test",
    mode: "film",
    genre: "drama",
    animationStyle: "live_action",
    aspectRatio: "21:9",
    durationMinutes: 5,
    timeFormat: "integer",
    aiProviders: {
      scriptWriter: "gemini-flash",
      conceptWriter: "gemini-flash",
      storyboardFrames: "gemini-flash",
      imageGen: "imagen-4-standard",
      voiceTts: "elevenlabs",
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  filmCharactersV2: [],
  filmStructureV2: { totalDurationMinutes: 5, scenes: [] },
};

// tvcProject fixture removed v0.9.3-r1 (TVC archived)

describe("Each v0.9.0 component renders standalone", () => {
  beforeEach(() => {
    cleanup();
  });

  it("ProjectSettingSection renders", () => {
    useAppStore.setState({ currentProject: filmProject });
    const { container } = render(<ProjectSettingSection />);
    expect(container.innerHTML).toContain("PROJECT SETTING");
  });

  it("CastFilmSection renders (Film mode)", () => {
    useAppStore.setState({ currentProject: filmProject });
    const { container } = render(<CastFilmSection />);
    expect(container.innerHTML).toContain("CAST");
  });

  it("FilmIdeaScriptSection renders", () => {
    useAppStore.setState({ currentProject: filmProject });
    const { container } = render(<FilmIdeaScriptSection />);
    expect(container.innerHTML).toContain("SCRIPT");
  });

  it("FilmStoryboardSection renders", () => {
    useAppStore.setState({ currentProject: filmProject });
    const { container } = render(<FilmStoryboardSection />);
    expect(container.innerHTML).toContain("STORYBOARD");
  });

  it("FilmVoiceSection renders (no_dialog mode)", () => {
    useAppStore.setState({ currentProject: filmProject });
    const { container } = render(<FilmVoiceSection />);
    expect(container.innerHTML).toContain("VOICE");
  });

  it("FilmMusicSfxSection renders (with script)", () => {
    const projWithScript = {
      ...filmProject,
      filmV093: {
        schemaVersion: "v0.9.3-film",
        characters: [],
        script: {
          titleEn: "T",
          titleVi: "T",
          logline: "x",
          synopsisEn: "x",
          scenes: [
            {
              id: "s1",
              order: 1,
              titleEn: "Scene 1",
              settings: "EXT.",
              durationSeconds: 30,
              act: "setup",
              actionLinesEn: "x",
              dialog: [],
              sfx: [],
              musicBrief: "",
            },
          ],
          versions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
    useAppStore.setState({ currentProject: projWithScript });
    const { container } = render(<FilmMusicSfxSection />);
    expect(container.innerHTML).toContain("MUSIC");
  });

  it("FilmBundleExportSection renders", () => {
    useAppStore.setState({ currentProject: filmProject });
    const { container } = render(<FilmBundleExportSection />);
    expect(container.innerHTML).toContain("BUNDLE");
  });

  // qc16: FilmShotDetailPanel deleted (paradigm shift to scene-level grids).
  // Storyboard tests now cover scene grid display.
});
