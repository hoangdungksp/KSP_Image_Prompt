import { useAppStore } from "../store/useAppStore";
import { Section } from "./Section";

export function CameraSection() {
  const { currentProject, updateCurrentProject } = useAppStore();
  if (!currentProject) return null;

  return (
    <Section title="🎥 Camera Style">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => updateCurrentProject({ cameraStyle: "BOKEH" })}
          className={`p-2 rounded text-left text-xs border transition-colors ${
            currentProject.cameraStyle === "BOKEH"
              ? "bg-ksp-accent text-black border-ksp-accent"
              : "bg-ksp-bg border-ksp-border hover:border-ksp-accent/50"
          }`}
        >
          <div className="font-semibold">📸 BOKEH</div>
          <div className="text-[10px] opacity-80 mt-0.5">
            Sony A7R V f/1.8, blur background, cinematic editorial
          </div>
        </button>

        <button
          onClick={() => updateCurrentProject({ cameraStyle: "DOCUMENTARY" })}
          className={`p-2 rounded text-left text-xs border transition-colors ${
            currentProject.cameraStyle === "DOCUMENTARY"
              ? "bg-ksp-accent text-black border-ksp-accent"
              : "bg-ksp-bg border-ksp-border hover:border-ksp-accent/50"
          }`}
        >
          <div className="font-semibold">📱 DOCUMENTARY</div>
          <div className="text-[10px] opacity-80 mt-0.5">
            iPhone f/22 deep focus, raw photo, NO bokeh, đời thường
          </div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label>Aspect ratio</label>
          <select
            value={currentProject.aspectRatio}
            onChange={(e) => updateCurrentProject({ aspectRatio: e.target.value as any })}
          >
            <option value="9:16">9:16 (Story / Reels)</option>
            <option value="3:4">3:4 (Portrait)</option>
            <option value="2:3">2:3 (Vertical)</option>
            <option value="1:1">1:1 (Square)</option>
            <option value="16:9">16:9 (Landscape)</option>
          </select>
        </div>
      </div>

      <div className="text-[10px] text-ksp-muted leading-relaxed mt-1">
        💡 <strong>BOKEH</strong>: cảnh artistic/editorial, ảnh đẹp lung linh.<br />
        💡 <strong>DOCUMENTARY</strong>: cảnh thể thao/đường phố/đời thường, ảnh trông như iPhone chụp thật.
      </div>
    </Section>
  );
}
