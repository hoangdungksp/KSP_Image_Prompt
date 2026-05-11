/**
 * Test render từng v0.9.0 component standalone để chắc rằng
 * không có component nào crash khi mount.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import { useAppStore } from "../src/store/useAppStore";

import { ProjectSettingSectionV09 } from "../src/components/ProjectSettingSectionV09";
import { CastFilmSection } from "../src/components/CastFilmSection";
import { FilmIdeaScriptSection } from "../src/components/FilmIdeaScriptSection";
import { FilmStoryboardSection } from "../src/components/FilmStoryboardSection";
import { VoiceSectionV09 } from "../src/components/VoiceSectionV09";
import { MusicSfxSectionV09 } from "../src/components/MusicSfxSectionV09";
import { BundleExportV09 } from "../src/components/BundleExportV09";
import { ShotDetailPanel } from "../src/components/ShotDetailPanel";

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

  it("ProjectSettingSectionV09 renders", () => {
    useAppStore.setState({ currentProject: filmProject });
    const { container } = render(<ProjectSettingSectionV09 />);
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

  it("VoiceSectionV09 renders", () => {
    useAppStore.setState({ currentProject: filmProject });
    const { container } = render(<VoiceSectionV09 />);
    expect(container.innerHTML).toContain("VOICE");
  });

  it("MusicSfxSectionV09 renders (with script)", () => {
    const projWithScript = {
      ...filmProject,
      script: {
        titleEn: "T",
        titleVi: "T",
        logline: "x",
        synopsisEn: "x",
        scenes: [
          {
            id: "s1",
            order: 0,
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
    };
    useAppStore.setState({ currentProject: projWithScript });
    const { container } = render(<MusicSfxSectionV09 />);
    expect(container.innerHTML).toContain("MUSIC");
  });

  it("BundleExportV09 renders (Film mode)", () => {
    useAppStore.setState({ currentProject: filmProject });
    const { container } = render(<BundleExportV09 />);
    expect(container.innerHTML).toContain("BUNDLE");
  });

  it("ShotDetailPanel renders empty state", () => {
    useAppStore.setState({ currentProject: filmProject });
    const { container } = render(<ShotDetailPanel />);
    expect(container.innerHTML).toContain("Click");
  });
});
