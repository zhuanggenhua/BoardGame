import { BookOpen, LocateFixed } from "lucide-react";
import { useTranslation } from "react-i18next";

type BetrayalReferenceQuickActionsSurfaceProps = {
  showScenarioReferenceButton: boolean;
  dimScenarioReferenceButton: boolean;
  scenarioReferenceAccessibleLabel: string;
  scenarioReferenceButtonLabel: string;
  currentExplorerRoomId: string;
  onOpenScenarioReference: () => void;
  onOpenReferenceCards: () => void;
  onFocusSelfRoom: () => void;
};

type BetrayalMobileScenarioReferenceButtonProps = {
  isVisible: boolean;
  isDimmed: boolean;
  scenarioReferenceAccessibleLabel: string;
  scenarioReferenceButtonLabel: string;
  onOpenScenarioReference: () => void;
};

export function BetrayalReferenceQuickActionsSurface({
  showScenarioReferenceButton,
  dimScenarioReferenceButton,
  scenarioReferenceAccessibleLabel,
  scenarioReferenceButtonLabel,
  currentExplorerRoomId,
  onOpenScenarioReference,
  onOpenReferenceCards,
  onFocusSelfRoom,
}: BetrayalReferenceQuickActionsSurfaceProps) {
  const { t } = useTranslation("game-betrayal");

  return (
    <div className="mt-0.5 flex justify-start gap-1.5">
      {showScenarioReferenceButton ? (
        <button
          type="button"
          onClick={onOpenScenarioReference}
          data-testid="betrayal-open-scenario"
          data-tutorial-id="betrayal-open-scenario"
          className={`inline-flex h-[40px] min-w-[84px] items-center gap-1.5 rounded-[7px] border border-[#58472f] bg-[linear-gradient(180deg,rgba(25,24,19,0.9),rgba(13,15,12,0.94))] px-2.5 text-[#d8bf81] transition hover:border-[#8b744d] ${
            dimScenarioReferenceButton ? "opacity-[0.72]" : ""
          }`}
          aria-label={scenarioReferenceAccessibleLabel}
          title={scenarioReferenceAccessibleLabel}
        >
          <BookOpen size={15} />
          <span className="text-[11px] font-semibold tracking-[0.06em]">
            {scenarioReferenceButtonLabel}
          </span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={onOpenReferenceCards}
        data-testid="betrayal-open-reference"
        data-tutorial-id="betrayal-reference-entry"
        className="inline-flex h-[40px] min-w-[72px] items-center gap-1.5 rounded-[7px] border border-[#58472f] bg-[linear-gradient(180deg,rgba(25,24,19,0.9),rgba(13,15,12,0.94))] px-2.5 text-[#d8bf81] transition hover:border-[#8b744d]"
        title={t("board.reference.button")}
      >
        <BookOpen size={15} />
        <span className="text-[11px] font-semibold tracking-[0.06em]">
          {t("board.reference.button")}
        </span>
      </button>
      <button
        type="button"
        onClick={onFocusSelfRoom}
        data-testid="betrayal-focus-self-room"
        data-tutorial-id="betrayal-focus-self-room"
        data-room-focus-action="self-room"
        data-room-focus-target-id={currentExplorerRoomId}
        data-room-focus-icon="locate-fixed"
        className="grid h-[40px] w-[40px] place-items-center rounded-[7px] border border-[#58472f] bg-[linear-gradient(180deg,rgba(25,24,19,0.9),rgba(13,15,12,0.94))] text-[#d8bf81] transition hover:border-[#8b744d]"
        title={t("board.rooms.focusSelf")}
        aria-label={t("board.rooms.focusSelf")}
      >
        <LocateFixed size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function BetrayalMobileScenarioReferenceButton({
  isVisible,
  isDimmed,
  scenarioReferenceAccessibleLabel,
  scenarioReferenceButtonLabel,
  onOpenScenarioReference,
}: BetrayalMobileScenarioReferenceButtonProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onOpenScenarioReference}
      data-testid="betrayal-open-scenario"
      data-tutorial-id="betrayal-open-scenario"
      className={`mx-auto inline-flex min-h-[30px] items-center justify-center gap-1 rounded-[5px] border border-[rgba(211,179,109,0.28)] bg-[rgba(10,13,10,0.48)] px-2 text-[10px] font-semibold tracking-[0.04em] text-[#fff1b8] transition hover:border-[#e2c57e] hover:bg-[rgba(211,179,109,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#e2c57e] ${
        isDimmed ? "opacity-[0.72]" : ""
      }`}
      aria-label={scenarioReferenceAccessibleLabel}
      title={scenarioReferenceAccessibleLabel}
    >
      <BookOpen size={12} strokeWidth={2.35} />
      {scenarioReferenceButtonLabel}
    </button>
  );
}
