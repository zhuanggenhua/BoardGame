import { ChevronRight } from "lucide-react";

import { CinematicNarrationPanel } from "./cinematicNarrationSurface";

type BetrayalScenarioStartOpeningStageSurfaceProps = {
  label: string;
  text: string;
  continueLabel: string;
  compact: boolean;
  onContinue: () => void;
};

export function BetrayalScenarioStartOpeningStageSurface({
  label,
  text,
  continueLabel,
  compact,
  onContinue,
}: BetrayalScenarioStartOpeningStageSurfaceProps) {
  return (
    <div
      data-testid="betrayal-start-scenario-opening-stage"
      className="fixed inset-0 z-[240] bg-[rgba(0,0,0,0.58)] text-[#f5e6c7]"
    >
      <CinematicNarrationPanel
        testId="betrayal-start-scenario-opening-cinematic"
        label={label}
        text={text}
        variant="opening"
        presentation="stage"
        compact={compact}
        actionSlot={
          <button
            type="button"
            data-testid="betrayal-start-scenario-opening-continue"
            onClick={onContinue}
            className="inline-flex min-h-11 min-w-[144px] cursor-pointer items-center justify-center gap-2 border border-[rgba(242,207,130,0.42)] bg-[rgba(8,10,9,0.82)] px-6 text-[12px] font-black uppercase tracking-[0.22em] text-[#f5e6c7] shadow-[0_16px_38px_rgba(0,0,0,0.58)] transition hover:border-[#f2cf82] hover:bg-[rgba(18,20,16,0.92)]"
          >
            {continueLabel}
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        }
        className="h-full min-h-full"
      />
    </div>
  );
}
