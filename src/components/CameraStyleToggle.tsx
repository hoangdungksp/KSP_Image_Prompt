/**
 * KSP Image v0.9.1 — Camera Style Toggle
 *
 * Top-level pipeline decision (HANDOFF Nguyên tắc 1: Bifurcation Camera Style).
 * BOKEH (Phe A): Sony A7R V, 85mm f/1.8 — portraits, café, áo dài, lifestyle artistic
 * DOCUMENTARY (Phe B): iPhone 15 Pro f/22 — sport, street, đời thường, du lịch
 *
 * Default = BOKEH (most common for Photos use case).
 * User can override per-shot in Image Gen list view.
 */

import React from "react";
import { useAppStore } from "../store/useAppStore";
import { ensurePhotosData, setCameraStyle } from "../store/photos_actions";
import type { CameraStyle } from "../types";

export function CameraStyleToggle() {
  const project = useAppStore((s) => s.currentProject);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  if (!project) return null;
  const photos = ensurePhotosData(project);

  const select = (style: CameraStyle) => updateProject(setCameraStyle(project, style));

  return (
    <section className="ksp-section ksp-camera-style-block">
      <header className="ksp-section-header ksp-camera-style-header">
        <span className="ksp-section-icon">📷</span>
        <h2 className="ksp-section-title">CAMERA STYLE</h2>
        <span className="ksp-camera-style-hint">override per-shot OK</span>
      </header>

      <div className="ksp-radio-cards">
        <label
          className={`ksp-radio-card ${photos.cameraStyle === "BOKEH" ? "ksp-radio-card-selected" : ""}`}
        >
          <input
            type="radio"
            name="ksp-camera-style"
            checked={photos.cameraStyle === "BOKEH"}
            onChange={() => select("BOKEH")}
          />
          <div className="ksp-radio-card-body">
            <div className="ksp-radio-card-title">🎨 Bokeh · Phe A</div>
            <div className="ksp-radio-card-desc">Sony A7R V · 85mm · f/1.8 — shallow DOF</div>
            <div className="ksp-radio-card-tag">Portrait, café, áo dài, lifestyle artistic</div>
          </div>
        </label>

        <label
          className={`ksp-radio-card ${photos.cameraStyle === "DOCUMENTARY" ? "ksp-radio-card-selected" : ""}`}
        >
          <input
            type="radio"
            name="ksp-camera-style"
            checked={photos.cameraStyle === "DOCUMENTARY"}
            onChange={() => select("DOCUMENTARY")}
          />
          <div className="ksp-radio-card-body">
            <div className="ksp-radio-card-title">📱 Documentary · Phe B</div>
            <div className="ksp-radio-card-desc">iPhone 17 Pro Max · 48MP · deep focus everywhere</div>
            <div className="ksp-radio-card-tag">Sport, street, đời thường, du lịch</div>
          </div>
        </label>
      </div>
    </section>
  );
}
