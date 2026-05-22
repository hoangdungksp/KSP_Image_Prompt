/**
 * KSP Image Sprint Preview Flow Modal
 *
 * 5-step progressive narrative preview that captures user's creative direction
 * BEFORE AI Stage 1 generates structure. User reads 4 AI-generated concrete
 * narrative options per step + 1 free-text "Ý kiến khác" option, picks 1, advances.
 *
 * Steps:
 *   1. Story Structure (3-act / Hero's Journey / Mystery / Tragedy / Other)
 *   2. Opening Scene (Environment-first / Character-first / In-medias-res / Documentary / Other)
 *   3. Character Introduction (Slow reveal / Sudden / Childlike / Confused soldier / Other)
 *   4. Midpoint Twist (Audio-trigger / Environmental / Tech intrusion / External command / Other)
 *   5. Ending (Hope wins / Self-sacrifice / Wisdom / Cyclical / Other)
 *
 * After step 5, shows Final Consolidated Preview with "Edit any step" navigation.
 *
 * Cache: in-memory during session, persisted to project.previewCache on complete.
 * Skippable: user can cancel at any step → AI Stage 1 runs without direction (legacy).
 */
import React, { useEffect, useState } from "react";
import type {
  PreviewOption,
  PreviewStepPick,
  PreviewCache,
  NarrativeDirection,
  ProjectSettingV2,
} from "../types/project";
import type { FilmCharacter } from "../types/film";
import type { FilmScriptProvider } from "../engine/filmScriptStages";
import {
  generateStep1StoryStructureOptions,
  generateStep2OpeningSceneOptions,
  generateStep3CharacterIntroOptions,
  generateStep4MidpointTwistOptions,
  generateStep5EndingOptions,
} from "../engine/previewFlowAI";
import {
  buildPickFromOption,
  buildPickFromFreeText,
  buildPickFromMultipleOptions,
  buildNarrativeDirection,
  getCachedStep1, getCachedStep2, getCachedStep3, getCachedStep4, getCachedStep5,
  setCachedStep1, setCachedStep2, setCachedStep3, setCachedStep4, setCachedStep5,
  invalidateCacheForStep,
} from "../engine/previewFlowSynthesizer";

// Framework label map for Step 1 option badge display
const FRAMEWORK_BADGE_LABELS: Record<string, string> = {
  "three-act": "3-Act",
  "hero-journey": "Hero's Journey",
  "save-the-cat": "Save the Cat",
  "kishotenketsu": "Kishōtenketsu",
  "mystery-thriller": "Mystery Thriller",
  "tragedy-doom": "Tragedy Doom",
};

const STEP_LABELS = {
  1: { en: "Story Structure", vi: "Cấu trúc câu chuyện", icon: "📖" },
  2: { en: "Opening Scene", vi: "Cảnh mở đầu", icon: "🎬" },
  3: { en: "Character Intro", vi: "Giới thiệu nhân vật", icon: "👤" },
  4: { en: "Midpoint Twist", vi: "Cú bẻ nhịp", icon: "⚡" },
  5: { en: "Ending", vi: "Kết thúc", icon: "🎯" },
} as const;

type StepNum = 1 | 2 | 3 | 4 | 5 | 6; // 6 = final review

export interface PreviewFlowModalProps {
  idea: string;
  setting: ProjectSettingV2;
  characters: FilmCharacter[];
  provider?: FilmScriptProvider;
  /** Initial cache from project (may be empty). Used for fast re-entry. */
  initialCache?: PreviewCache;
  onComplete: (direction: NarrativeDirection, finalCache: PreviewCache) => void;
  onCancel: () => void;
  showToast: (msg: string, kind?: "success" | "error" | "info") => void;
  /**
   * r7.33: Persist cache to Dexie incrementally after each successful AI gen.
   * Prevents AI cost waste when user reloads tab mid-flow. Called with full
   * PreviewCache object every time it grows.
   */
  onCachePersist?: (cache: PreviewCache) => void;
}

export function PreviewFlowModal({
  idea,
  setting,
  characters,
  provider = "gemini-flash",
  initialCache,
  onComplete,
  onCancel,
  showToast,
  onCachePersist,
}: PreviewFlowModalProps) {
  const [currentStep, setCurrentStep] = useState<StepNum>(1);
  const [picks, setPicks] = useState<{
    step1?: PreviewStepPick;
    step2?: PreviewStepPick;
    step3?: PreviewStepPick;
    step4?: PreviewStepPick;
    step5?: PreviewStepPick;
  }>({});
  const [cache, setCache] = useState<PreviewCache>(initialCache ?? {});
  const [currentOptions, setCurrentOptions] = useState<PreviewOption[]>([]);
  const [freeTextInput, setFreeTextInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Step 4 multi-pick state (max 3 picks). Empty array when not on Step 4
  // or when user hasn't ticked anything yet. Reset when Step 4 re-entered.
  const [step4Selected, setStep4Selected] = useState<string[]>([]);

  // Load options for current step (cache hit → instant, miss → AI gen)
  useEffect(() => {
    if (currentStep === 6) return; // final review, no options
    loadOptionsForStep(currentStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  async function loadOptionsForStep(step: StepNum, opts?: { skipCache?: boolean }) {
    if (step === 6) return;
    const skipCache = opts?.skipCache === true;
    setError(null);
    setFreeTextInput("");
    // reset multi-pick state when entering Step 4 (or any other step)
    // when re-entering Step 4, restore previous selection (visual continuity)
    if (step === 4 && picks.step4) {
      const previous: string[] = [picks.step4.optionId];
      if (picks.step4.additionalPicks) {
        for (const p of picks.step4.additionalPicks) previous.push(p.optionId);
      }
      // Filter out "E" (free text) since checkbox UI doesn't support free text mode
      setStep4Selected(previous.filter((id) => id !== "E"));
    } else {
      setStep4Selected([]);
    }

    // r7.29 Feature 2A: when skipCache=true, bypass cache check + invalidate
    // existing cached options so user gets fresh 4 options on regen click.
    if (skipCache) {
      setCache((c) => invalidateCacheForStep(c, step, picks));
    }

    // Try cache first (skipped if user clicked regen)
    let cached: PreviewOption[] | undefined;
    if (!skipCache) {
      if (step === 1) cached = getCachedStep1(cache);
      else if (step === 2 && picks.step1) cached = getCachedStep2(cache, picks.step1);
      else if (step === 3 && picks.step1 && picks.step2) cached = getCachedStep3(cache, picks.step1, picks.step2);
      else if (step === 4 && picks.step1 && picks.step2 && picks.step3) cached = getCachedStep4(cache, picks.step1, picks.step2, picks.step3);
      else if (step === 5 && picks.step1 && picks.step2 && picks.step3 && picks.step4) cached = getCachedStep5(cache, picks.step1, picks.step2, picks.step3, picks.step4);
    }

    if (cached && cached.length === 4) {
      setCurrentOptions(cached);
      return;
    }

    // Cache miss — AI gen
    setLoading(true);
    try {
      const baseInput = { idea, setting, characters, provider };
      let options: PreviewOption[] = [];

      if (step === 1) {
        options = await generateStep1StoryStructureOptions(baseInput);
        if (options.length === 4) {
          const newCache = setCachedStep1(cache, options);
          setCache(newCache);
          onCachePersist?.(newCache);
        }
      } else if (step === 2 && picks.step1) {
        options = await generateStep2OpeningSceneOptions({ ...baseInput, step1Pick: picks.step1 });
        if (options.length === 4) {
          const newCache = setCachedStep2(cache, picks.step1!, options);
          setCache(newCache);
          onCachePersist?.(newCache);
        }
      } else if (step === 3 && picks.step1 && picks.step2) {
        options = await generateStep3CharacterIntroOptions({ ...baseInput, step1Pick: picks.step1, step2Pick: picks.step2 });
        if (options.length === 4) {
          const newCache = setCachedStep3(cache, picks.step1!, picks.step2!, options);
          setCache(newCache);
          onCachePersist?.(newCache);
        }
      } else if (step === 4 && picks.step1 && picks.step2 && picks.step3) {
        options = await generateStep4MidpointTwistOptions({ ...baseInput, step1Pick: picks.step1, step2Pick: picks.step2, step3Pick: picks.step3 });
        if (options.length === 4) {
          const newCache = setCachedStep4(cache, picks.step1!, picks.step2!, picks.step3!, options);
          setCache(newCache);
          onCachePersist?.(newCache);
        }
      } else if (step === 5 && picks.step1 && picks.step2 && picks.step3 && picks.step4) {
        options = await generateStep5EndingOptions({ ...baseInput, step1Pick: picks.step1, step2Pick: picks.step2, step3Pick: picks.step3, step4Pick: picks.step4 });
        if (options.length === 4) {
          const newCache = setCachedStep5(cache, picks.step1!, picks.step2!, picks.step3!, picks.step4!, options);
          setCache(newCache);
          onCachePersist?.(newCache);
        }
      }

      if (options.length !== 4) {
        throw new Error(`AI returned ${options.length} options instead of 4. Có thể response bị truncate hoặc malformed JSON.`);
      }
      setCurrentOptions(options);
    } catch (err) {
      setError((err as Error).message);
      showToast(`Step ${step} lỗi: ${(err as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  function handlePickOption(option: PreviewOption) {
    const pick = buildPickFromOption(option);
    advanceWithPick(pick);
  }

  function handleSubmitFreeText() {
    const text = freeTextInput.trim();
    if (text.length < 10) {
      showToast("Mô tả phải ít nhất 10 ký tự", "info");
      return;
    }
    const pick = buildPickFromFreeText(text);
    advanceWithPick(pick);
  }

  /**
   * Step 4 checkbox toggle handler. Toggles option id in step4Selected.
   * Max 3 picks enforced — clicking a 4th unticked checkbox shows toast warning.
   */
  function handleToggleStep4Option(optionId: string) {
    setStep4Selected((prev) => {
      if (prev.includes(optionId)) {
        // Untick
        return prev.filter((id) => id !== optionId);
      }
      if (prev.length >= 3) {
        showToast("Tối đa 3 twists. Bỏ tick 1 cái trước khi chọn cái mới.", "info");
        return prev;
      }
      return [...prev, optionId];
    });
  }

  /**
   * Step 4 multi-pick submit. Builds PreviewStepPick from selected option ids
   * (1-3 options) using buildPickFromMultipleOptions. Order in step4Selected = primary first.
   */
  function handleSubmitStep4MultiPick() {
    if (step4Selected.length === 0) {
      showToast("Chọn ít nhất 1 twist", "info");
      return;
    }
    const selectedOptions = step4Selected
      .map((id) => currentOptions.find((o) => o.id === id))
      .filter((o): o is PreviewOption => o !== undefined);
    if (selectedOptions.length === 0) {
      showToast("Lỗi nội bộ: không tìm thấy options đã chọn", "error");
      return;
    }
    const pick = buildPickFromMultipleOptions(selectedOptions);
    advanceWithPick(pick);
  }

  function advanceWithPick(pick: PreviewStepPick) {
    const stepKey = `step${currentStep}` as "step1" | "step2" | "step3" | "step4" | "step5";
    const newPicks = { ...picks, [stepKey]: pick };
    setPicks(newPicks);

    // Advance to next step (1→2→3→4→5→6 final review)
    setCurrentStep((s) => (s < 6 ? ((s + 1) as StepNum) : s));
  }

  function handleBack() {
    if (currentStep === 1) return;
    setCurrentStep((s) => (s - 1) as StepNum);
  }

  function handleEditStep(step: StepNum) {
    setCurrentStep(step);
  }

  function handleConfirmComplete() {
    if (!picks.step1 || !picks.step2 || !picks.step3 || !picks.step4 || !picks.step5) {
      showToast("Chưa hoàn thành 5 steps", "error");
      return;
    }
    // r7.19: pass current idea as snapshot so we can detect stale direction later
    // when user changes their idea but keeps the existing direction in project.
    const direction = buildNarrativeDirection({
      step1: picks.step1, step2: picks.step2, step3: picks.step3, step4: picks.step4, step5: picks.step5,
    }, idea);
    onComplete(direction, cache);
  }

  // RENDER
  const stepLabel = currentStep < 6 ? STEP_LABELS[currentStep as 1 | 2 | 3 | 4 | 5] : null;
  // r7.20b: include Step 6 (Review) in progress dots — 6 total
  const progressDots = [1, 2, 3, 4, 5, 6].map((n) => {
    const done = n < currentStep;
    const active = n === currentStep;
    return done ? "●" : active ? "◉" : "○";
  }).join(" ");

  return (
    <div
      className="ksp-preview-flow-backdrop"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onKeyDown={(e) => {
        // r7.35: ESC closes modal (user has Preview button to re-open from Idea section)
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      ref={(el) => {
        // Auto-focus backdrop on mount so ESC keydown is captured
        if (el && document.activeElement !== el) {
          el.focus();
        }
      }}
    >
      <div className="ksp-preview-flow-modal">
        <header className="ksp-preview-flow-header">
          <div className="ksp-preview-flow-title">
            {currentStep < 6 ? (
              <>
                <span className="ksp-preview-flow-step-icon">{stepLabel!.icon}</span>
                <span className="ksp-preview-flow-step-name">
                  Step {currentStep}/6 — {stepLabel!.vi}
                </span>
              </>
            ) : (
              <>
                <span className="ksp-preview-flow-step-icon">✅</span>
                <span className="ksp-preview-flow-step-name">
                  Step 6/6 — Review &amp; Confirm
                </span>
              </>
            )}
          </div>
          <div className="ksp-preview-flow-progress">{progressDots}</div>
          {/* r7.33: "Bỏ qua" button REMOVED — user must complete all 6 steps. Decision: lock user in to force careful reading.
              No ESC, no click-outside dismissal either. Exit only via Step 6 "Lưu & Đóng". */}
        </header>

        <div className="ksp-preview-flow-body">
          {currentStep < 6 && (
            <>
              {loading && (
                <div className="ksp-preview-flow-loading">
                  <div className="ksp-preview-flow-spinner" />
                  <p>AI đang sinh 4 options cho {stepLabel!.vi}... ~10-15s</p>
                </div>
              )}

              {error && (
                <div className="ksp-preview-flow-error">
                  <p><strong>Lỗi:</strong> {error}</p>
                  <button type="button" className="ksp-btn ksp-btn-sm" onClick={() => loadOptionsForStep(currentStep)}>
                    🔄 Thử lại
                  </button>
                </div>
              )}

              {!loading && !error && currentOptions.length === 4 && (() => {
                /* r7.15d-fix2: derive picked state from picks[stepN] for visual indicator
                 * when user navigates back. Step 4 multi-pick reads optionId + additionalPicks. */
                const previousPick = (picks as any)[`step${currentStep}`] as PreviewStepPick | undefined;
                const previouslyPickedIds: Set<string> = new Set();
                if (previousPick) {
                  previouslyPickedIds.add(previousPick.optionId);
                  if (previousPick.additionalPicks) {
                    for (const p of previousPick.additionalPicks) previouslyPickedIds.add(p.optionId);
                  }
                }
                const isFreeTextPreviouslyPicked = previousPick?.optionId === "E";
                return (
                <>
                  <div className="ksp-preview-flow-hint-row">
                    <p className="ksp-preview-flow-hint">
                      {currentStep === 4
                        ? `Tick 1-3 twists muốn dùng (tối đa 3). Position sẽ tự assign khi sinh Beats. Đã chọn ${step4Selected.length}/3.`
                        : previousPick
                          ? `Bạn đã chọn option ${previousPick.optionId} trước đó (highlight orange). Click option khác để đổi, hoặc click option đã chọn để giữ nguyên.`
                          : "Đọc 4 options dưới đây + chọn 1, hoặc nhập \"Ý kiến khác\" nếu có direction riêng."}
                    </p>
                    {/* r7.29 Feature 2A (r7.30 reposition): Regen button — invalidate cache + AI gen fresh 4 options.
                        Đặt inline cạnh hint để KHÔNG bị nút "Bỏ qua" che. */}
                    <button
                      type="button"
                      className="ksp-preview-step-regen-btn"
                      onClick={() => loadOptionsForStep(currentStep, { skipCache: true })}
                      disabled={loading}
                      title="Tạo lại 4 options mới (AI sẽ gen lại với góc nhìn sáng tạo khác)"
                      aria-label="Regenerate 4 options"
                    >
                      <span className={loading ? "spin" : ""}>{loading ? "⟳" : "🔄"}</span> Regen 4 options
                    </button>
                  </div>
                  <div className="ksp-preview-flow-options">
                    {currentStep === 4 ? (
                      // Step 4 multi-pick checkbox UI
                      currentOptions.map((opt) => {
                        const checked = step4Selected.includes(opt.id);
                        const order = checked ? step4Selected.indexOf(opt.id) + 1 : 0;
                        return (
                          <PreviewOptionCheckboxCard
                            key={opt.id}
                            option={opt}
                            checked={checked}
                            order={order}
                            onToggle={() => handleToggleStep4Option(opt.id)}
                          />
                        );
                      })
                    ) : (
                      currentOptions.map((opt) => (
                        <PreviewOptionCard
                          key={opt.id}
                          option={opt}
                          onPick={() => handlePickOption(opt)}
                          showFrameworkBadge={currentStep === 1}
                          isPreviouslyPicked={previouslyPickedIds.has(opt.id)}
                        />
                      ))
                    )}
                    {/* Option E — free text. r7.15d-fix2: highlight if previously picked. */}
                    <div className={`ksp-preview-flow-option ksp-preview-flow-option-freetext${isFreeTextPreviouslyPicked ? " ksp-preview-flow-option-picked" : ""}`}>
                      <div className="ksp-preview-flow-option-header">
                        <span className="ksp-preview-flow-option-id">E</span>
                        <span className="ksp-preview-flow-option-title">✏️ Ý kiến khác</span>
                        {isFreeTextPreviouslyPicked && (
                          <span className="ksp-preview-flow-option-picked-badge">✓ Đã chọn</span>
                        )}
                      </div>
                      <textarea
                        className="ksp-preview-flow-freetext"
                        placeholder={isFreeTextPreviouslyPicked && previousPick?.customTextVi
                          ? previousPick.customTextVi
                          : "Mô tả direction riêng của anh (ít nhất 10 ký tự)..."}
                        value={freeTextInput}
                        onChange={(e) => setFreeTextInput(e.target.value)}
                        rows={3}
                      />
                      <button
                        type="button"
                        className="ksp-btn ksp-btn-primary ksp-btn-sm"
                        onClick={handleSubmitFreeText}
                        disabled={freeTextInput.trim().length < 10}
                      >
                        Dùng ý kiến này →
                      </button>
                    </div>
                  </div>
                  {/* Step 4 submit bar for multi-pick */}
                  {currentStep === 4 && (
                    <div className="ksp-preview-flow-multipick-submit">
                      <span className="ksp-preview-flow-multipick-count">
                        Đã chọn: <strong>{step4Selected.length}/3</strong> twists
                      </span>
                      <button
                        type="button"
                        className="ksp-btn ksp-btn-primary"
                        onClick={handleSubmitStep4MultiPick}
                        disabled={step4Selected.length === 0}
                      >
                        Tiếp tục với {step4Selected.length} twist{step4Selected.length > 1 ? "s" : ""} →
                      </button>
                    </div>
                  )}
                </>
                );
              })()}
            </>
          )}

          {currentStep === 6 && (
            <FinalReviewPanel
              picks={picks as Required<typeof picks>}
              onEditStep={handleEditStep}
              onConfirm={handleConfirmComplete}
              onBack={() => setCurrentStep(5)}
            />
          )}
        </div>

        {currentStep < 6 && (
          <footer className="ksp-preview-flow-footer">
            <button
              type="button"
              className="ksp-btn ksp-btn-sm"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              ← Quay lại
            </button>
            <span className="ksp-preview-flow-footer-spacer" />
            <button type="button" className="ksp-btn ksp-btn-sm ksp-btn-ghost" onClick={onCancel}>
              ✕ Thoát
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

function PreviewOptionCard({
  option,
  onPick,
  showFrameworkBadge = false,
  isPreviouslyPicked = false,
}: {
  option: PreviewOption;
  onPick: () => void;
  showFrameworkBadge?: boolean;
  /** r7.15d-fix2: highlight orange border + "✓ Đã chọn trước đây" badge when user
   *  navigates back to a step they already picked. Click again to confirm same pick
   *  or pick a different option (state then updates). */
  isPreviouslyPicked?: boolean;
}) {
  // Step 1 shows framework badge under title
  const frameworkLabel = showFrameworkBadge && option.frameworkCode
    ? FRAMEWORK_BADGE_LABELS[option.frameworkCode] || option.frameworkCode
    : null;

  const className = isPreviouslyPicked
    ? "ksp-preview-flow-option ksp-preview-flow-option-picked"
    : "ksp-preview-flow-option";

  return (
    <button type="button" className={className} onClick={onPick}>
      <div className="ksp-preview-flow-option-header">
        <span className="ksp-preview-flow-option-id">{option.id}</span>
        <span className="ksp-preview-flow-option-title">{option.titleVi}</span>
        {isPreviouslyPicked && (
          <span className="ksp-preview-flow-option-picked-badge">✓ Đã chọn</span>
        )}
      </div>
      {frameworkLabel && (
        <div className="ksp-preview-flow-option-badge">
          Framework: {frameworkLabel}
        </div>
      )}
      <p className="ksp-preview-flow-option-desc">{option.descriptionVi}</p>
      <span className="ksp-preview-flow-option-pick">
        {isPreviouslyPicked ? `Giữ option ${option.id} (đang chọn) →` : `Chọn option ${option.id} →`}
      </span>
    </button>
  );
}

/**
 * Step 4 multi-pick checkbox card.
 * Visual: card has tick state + order number (1/2/3 = pick order).
 * Click toggles tick. Max 3 picks enforced by parent state handler.
 */
function PreviewOptionCheckboxCard({
  option,
  checked,
  order,
  onToggle,
}: {
  option: PreviewOption;
  checked: boolean;
  order: number;  // 1-based pick order if checked, 0 if not
  onToggle: () => void;
}) {
  return (
    <div
      className={`ksp-preview-flow-option ksp-preview-flow-option-checkbox${checked ? " ksp-preview-flow-option-checked" : ""}`}
      onClick={onToggle}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="ksp-preview-flow-option-header">
        <span className="ksp-preview-flow-option-id">
          {checked ? `✓ ${order}` : option.id}
        </span>
        <span className="ksp-preview-flow-option-title">{option.titleVi}</span>
      </div>
      <p className="ksp-preview-flow-option-desc">{option.descriptionVi}</p>
      <span className="ksp-preview-flow-option-pick">
        {checked ? `Đang chọn (vị trí ${order})` : "Tick để chọn twist này"}
      </span>
    </div>
  );
}

function FinalReviewPanel({
  picks,
  onEditStep,
  onConfirm,
  onBack,
}: {
  picks: { step1: PreviewStepPick; step2: PreviewStepPick; step3: PreviewStepPick; step4: PreviewStepPick; step5: PreviewStepPick };
  onEditStep: (step: StepNum) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const stepPicks = [
    { num: 1 as StepNum, label: STEP_LABELS[1], pick: picks.step1 },
    { num: 2 as StepNum, label: STEP_LABELS[2], pick: picks.step2 },
    { num: 3 as StepNum, label: STEP_LABELS[3], pick: picks.step3 },
    { num: 4 as StepNum, label: STEP_LABELS[4], pick: picks.step4 },
    { num: 5 as StepNum, label: STEP_LABELS[5], pick: picks.step5 },
  ];

  // r7.20b: Step 4 multi-pick — surface twist count if user picked multiple
  const twistCount = 1 + (picks.step4.additionalPicks?.length ?? 0);

  return (
    <div className="ksp-preview-flow-final-review">
      <p className="ksp-preview-flow-hint">
        ✅ Direction câu chuyện đã có. Review trước khi confirm — anh có thể edit bất kỳ step nào.
      </p>

      {stepPicks.map(({ num, label, pick }) => {
        const isStep4MultiPick = num === 4 && twistCount > 1;
        return (
          <div
            key={num}
            className={`ksp-preview-flow-review-item${isStep4MultiPick ? " multi-pick" : ""}`}
          >
            <div className="ksp-preview-flow-review-header">
              <span className="ksp-preview-flow-review-icon">{label.icon}</span>
              <span className="ksp-preview-flow-review-label">
                {num}. {label.vi}
                {isStep4MultiPick && (
                  <span className="ksp-preview-flow-review-multipick-badge">
                    {twistCount} PICKS
                  </span>
                )}
              </span>
              <button
                type="button"
                className="ksp-btn ksp-btn-sm ksp-btn-ghost"
                onClick={() => onEditStep(num)}
                title={`Edit ${label.vi} — quay về Step ${num}`}
              >
                ✏️ Edit
              </button>
            </div>
            <div className="ksp-preview-flow-review-content">
              <strong>{pick.resolvedTitleEn || (pick.optionId === "E" ? "Custom direction" : `Option ${pick.optionId}`)}</strong>
              <p className="ksp-preview-flow-review-desc">
                {pick.resolvedDescriptionVi || pick.customTextVi || "(no description)"}
              </p>
              {/* r7.20b: For Step 4 multi-pick, list additional twists below primary */}
              {isStep4MultiPick && pick.additionalPicks && pick.additionalPicks.length > 0 && (
                <ul className="ksp-preview-flow-review-additional">
                  {pick.additionalPicks.map((ap, i) => (
                    <li key={i}>
                      <strong>+ {ap.resolvedTitleEn || `Option ${ap.optionId}`}</strong>
                      {ap.resolvedDescriptionVi && (
                        <span> — {ap.resolvedDescriptionVi.slice(0, 120)}{ap.resolvedDescriptionVi.length > 120 ? "..." : ""}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}

      {/* r7.20b: cost estimate line + 2 buttons (Back to Step 5 + Confirm) */}
      <div className="ksp-preview-flow-final-cta-block">
        <div className="ksp-preview-flow-cost-hint">
          <span className="ksp-preview-flow-cost-icon" aria-hidden="true">💾</span>
          Bấm "Lưu &amp; Đóng" để save direction. Modal đóng → section Ý tưởng sẽ có 2 nút: <strong>START</strong> (chạy auto-chain) + <strong>Preview</strong> (mở modal lại để chỉnh).
          <br /><br />
          <strong>💰 Cost estimate (Gemini 2.5 Flash standard, May 2026):</strong>
          <br />• <strong>Pipeline text-only:</strong> ~$0.15-0.30 (~3,800-7,600 VND) cho 5-10 scenes — bao gồm Preview Flow (5 calls) + Stages 3-5 + Analyze Scenes + Shot List
          <br />• <strong>Nếu bật image gen concept sheet:</strong> +$0.21/cast (~5,400 VND/cast)
          <br />• <strong>Nếu bật image gen storyboard grid:</strong> +$0.21/scene (~5,400 VND/scene) — phần TỐN NHẤT
          <br />Track chính xác trong "Pipeline cost" widget bên dưới section.
        </div>
        <div className="ksp-preview-flow-final-cta">
          <button
            type="button"
            className="ksp-btn ksp-btn-sm"
            onClick={onBack}
            title="Quay về Step 5 Ending"
          >
            ← Quay lại sửa
          </button>
          <button
            type="button"
            className="ksp-btn ksp-btn-primary"
            onClick={onConfirm}
            title="Lưu direction + đóng modal. Sau đó bấm nút START ở section Ý tưởng để chạy auto-chain."
          >
            ✓ Lưu &amp; Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
