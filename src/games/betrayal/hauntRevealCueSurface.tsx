import { useTranslation } from "react-i18next";
import { UI_Z_INDEX } from "../../core";
import type { BetrayalCore } from "./game";
import type { BetrayalHauntRevealProtocol } from "./hauntSetupModel";
import type { ScenarioReaderScope } from "./scenarioReader";

export function BetrayalHauntRevealCue({
  revealProtocol,
  scenarioRuntime,
  readerScope,
  isPhoneLandscapeLayout,
  onDismiss,
}: {
  revealProtocol: BetrayalHauntRevealProtocol;
  scenarioRuntime: BetrayalCore["scenarioRuntime"];
  readerScope: ScenarioReaderScope;
  isPhoneLandscapeLayout: boolean;
  onDismiss: () => void;
}) {
  const { t } = useTranslation("game-betrayal");
  const hasHauntSource = Boolean(
    scenarioRuntime.hauntScenarioCardTitle &&
      scenarioRuntime.triggeringOmenName &&
      scenarioRuntime.hauntCardNumber,
  );
  const viewerRoleCueKey =
    readerScope === "traitor"
      ? "board.status.hauntRevealViewerTraitor"
      : readerScope === "heroes"
        ? "board.status.hauntRevealViewerHero"
        : "board.status.hauntRevealViewerAll";

  return (
    <div
      data-testid="betrayal-haunt-reveal-cue"
      data-haunt-reveal-active="true"
      data-haunt-type={revealProtocol.hauntType}
      data-haunt-public-step-count={revealProtocol.publicSteps.length}
      data-haunt-setup-count={revealProtocol.setupQueue.length}
      className={`betrayal-haunt-reveal-cue pointer-events-none absolute left-1/2 -translate-x-1/2 ${
        isPhoneLandscapeLayout ? "top-2" : "top-[88px]"
      }`}
      style={{ zIndex: UI_Z_INDEX.overlayRaised + 4 }}
    >
      <div className="relative flex min-h-[44px] w-[min(760px,calc(100vw-2rem))] items-center justify-between gap-3 overflow-hidden rounded-[999px] border border-[rgba(255,207,137,0.34)] bg-[rgba(32,14,12,0.88)] px-4 py-2 text-left shadow-[0_14px_34px_rgba(0,0,0,0.34),0_0_24px_rgba(181,63,44,0.16)] backdrop-blur-[8px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,rgba(255,191,128,0),rgba(255,191,128,0.95),rgba(255,191,128,0))]" />
        <div className="relative flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            data-testid="betrayal-haunt-reveal-player-title"
            className="text-[14px] font-black tracking-[0.06em] text-[#fff1ca] drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
          >
            {t("board.status.hauntRevealPlayerTitle")}
          </span>
          <span
            data-testid="betrayal-haunt-reveal-lead"
            className="min-w-0 text-[13px] font-semibold tracking-[0.02em] text-[#ffe6bd]"
          >
            {t("board.status.hauntRevealLead")}
          </span>
          <span
            data-testid="betrayal-haunt-reveal-viewer-role"
            data-scenario-reader-scope={readerScope}
            className="min-w-0 text-[12px] font-black tracking-[0.03em] text-[#fff7dc]"
          >
            {t(viewerRoleCueKey)}
          </span>
          {hasHauntSource ? (
            <span
              data-testid="betrayal-haunt-reveal-source"
              data-haunt-scenario-card-id={scenarioRuntime.hauntScenarioCardId ?? undefined}
              data-haunt-triggering-omen-id={scenarioRuntime.triggeringOmenId ?? undefined}
              className="min-w-0 text-[11px] font-black tracking-[0.05em] text-[#ffd78e]"
            >
              {t("board.status.hauntRevealSource", {
                scenarioCard: scenarioRuntime.hauntScenarioCardTitle,
                omen: scenarioRuntime.triggeringOmenName,
                number: scenarioRuntime.hauntCardNumber,
              })}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          data-testid="betrayal-haunt-reveal-close"
          className="pointer-events-auto relative inline-flex min-h-[34px] shrink-0 items-center justify-center rounded-full border border-[rgba(255,207,137,0.28)] bg-[rgba(255,238,201,0.08)] px-3 text-[12px] font-black tracking-[0.08em] text-[#ffe6b9] transition hover:bg-[rgba(255,207,137,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe3a3]"
          onClick={onDismiss}
        >
          {t("board.status.hauntRevealDismiss")}
        </button>
      </div>
    </div>
  );
}
