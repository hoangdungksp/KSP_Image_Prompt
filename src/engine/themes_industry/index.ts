/**
 * v0.5 — Index file for all industry themes
 *
 * Merges new industry-specific themes (200+) into one array.
 * Old themes (227) auto-tagged as industry="travel" + mode="lifestyle" via merger in themes.ts.
 */

import type { ThemePreset } from "../themes";

import { SKINCARE_THEMES } from "./skincare";
import { FNB_THEMES } from "./fnb";
import { TECH_THEMES } from "./tech";
import { FASHION_THEMES } from "./fashion";
import { TRAVEL_NEW_THEMES } from "./travel_new";

export const INDUSTRY_THEMES: ThemePreset[] = [
  ...SKINCARE_THEMES,
  ...FNB_THEMES,
  ...TECH_THEMES,
  ...FASHION_THEMES,
  ...TRAVEL_NEW_THEMES,
];

// Stats helper
export function getIndustryStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  INDUSTRY_THEMES.forEach((t) => {
    const key = `${t.industry || "general"}_${t.mode || "lifestyle"}`;
    stats[key] = (stats[key] || 0) + 1;
  });
  return stats;
}

export { SHOT_MODES, INDUSTRIES, getModeById, getIndustryById, isModeSupportedForIndustry } from "./_modes_industries";
export type { ShotMode, Industry, ModeConfig, IndustryConfig } from "./_modes_industries";
