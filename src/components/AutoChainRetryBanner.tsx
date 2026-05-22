/**
 * KSP Image — Reusable retry banner for sections affected by auto-chain errors
 * (r7.29 Feature 1A)
 *
 * Renders an error banner with a "🔄 Retry from this section" button when
 * one or more auto-chain sections error out. Used by FilmShotListSection
 * (analyze-scenes + shot-list) and FilmStoryboardSection (grid-build).
 *
 * Sources `narrativeDirection` from project (persisted) — NOT from a ref —
 * so retry works cross-session if user closes + reopens Chrome.
 */

import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { SectionId } from "../engine/autoChainOrchestrator";

interface AutoChainRetryBannerProps {
  /** Section IDs to monitor — banner shows when ANY of these has status="error" */
  sectionIds: SectionId[];
  /** Human label for retry button (e.g. "Analyze Scenes", "Shot List", "Storyboard") */
  sectionLabel: string;
}

export function AutoChainRetryBanner({ sectionIds, sectionLabel }: AutoChainRetryBannerProps) {
  const project = useAppStore((s) => s.currentProject);
  const autoChainState = useAppStore((s) => s.autoChainState);
  const updateProject = useAppStore((s) => s.updateCurrentProject);
  const showToast = useAppStore((s) => s.showToast);
  const setAutoChainState = useAppStore((s) => s.setAutoChainState);
  const [isRetrying, setIsRetrying] = useState(false);

  if (!project) return null;

  // Find first section with error status (in order)
  const erroredSection = sectionIds.find(
    (id) => autoChainState.sections[id]?.status === "error"
  );
  if (!erroredSection) return null;

  const errorMessage =
    autoChainState.sections[erroredSection]?.errorMessage ||
    "Unknown error — check console for details";

  async function handleRetry() {
    if (!erroredSection || !project) return;
    // r7.29: narrativeDirection lives on project (ProjectV09Extensions), not FilmData
    const direction = (project as any).narrativeDirection;
    if (!direction) {
      showToast(
        "Không có narrative direction để retry. Chạy lại từ đầu bằng 'Phân tích ý tưởng'.",
        "error"
      );
      return;
    }
    setIsRetrying(true);
    try {
      const { AutoChainOrchestrator } = await import("../engine/autoChainOrchestrator");
      const orch = new AutoChainOrchestrator({
        getProject: () => useAppStore.getState().currentProject!,
        updateProject: (updater) => updateProject(updater),
        showToast,
      });
      const unsubscribe = orch.subscribe((state) => setAutoChainState(state));
      try {
        await orch.retryFromSection(erroredSection, direction);
      } finally {
        unsubscribe();
      }
    } catch (err) {
      console.error("[AutoChain retry] error:", err);
      showToast(`Retry lỗi: ${(err as Error).message}`, "error");
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <div className="ksp-autochain-retry-banner" role="alert">
      <div className="ksp-autochain-retry-banner-icon">⚠️</div>
      <div className="ksp-autochain-retry-banner-body">
        <div className="ksp-autochain-retry-banner-title">
          {sectionLabel} bị lỗi
        </div>
        <div className="ksp-autochain-retry-banner-msg">{errorMessage}</div>
      </div>
      <button
        type="button"
        className="ksp-autochain-retry-banner-btn"
        onClick={handleRetry}
        disabled={isRetrying}
        title={`Re-run từ ${sectionLabel} xuống đến cuối pipeline. Các stage đã hoàn thành phía trên KHÔNG bị chạy lại (tiết kiệm AI cost).`}
      >
        {isRetrying ? "⏳ Đang retry..." : "🔄 Retry từ đây"}
      </button>
    </div>
  );
}
