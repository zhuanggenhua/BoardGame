import React from "react";
import { useTranslation } from "react-i18next";

import { splitCinematicNarrationText } from "./scenarioReader";

type CinematicNarrationVariant =
  | "opening"
  | "ending-survivors"
  | "ending-traitor"
  | "ending-haunt";

type CinematicNarrationPanelProps = {
  label: string;
  title?: string;
  text: string;
  variant: CinematicNarrationVariant;
  compact?: boolean;
  presentation?: "panel" | "stage";
  actionSlot?: React.ReactNode;
  testId?: string;
  className?: string;
};

export function CinematicNarrationPanel({
  label,
  title,
  text,
  variant,
  compact = false,
  presentation = "panel",
  actionSlot,
  testId,
  className = "",
}: CinematicNarrationPanelProps) {
  const { t } = useTranslation("game-betrayal");
  const lines = splitCinematicNarrationText(text);
  const isStage = presentation === "stage";
  const labelIsMainTitle = !title;

  return (
    <div
      data-testid={testId}
      data-cinematic-narration={variant}
      data-cinematic-stage={isStage ? "standalone" : undefined}
      className={`betrayal-cinematic-narration relative flex min-h-full overflow-hidden text-[#f5e6c7] ${
        isStage
          ? "border-y border-[rgba(242,207,130,0.30)] bg-[rgba(0,0,0,0.42)] shadow-[0_24px_90px_rgba(0,0,0,0.44)]"
          : "border border-[rgba(222,184,92,0.44)] bg-[#030506] shadow-[0_18px_46px_rgba(0,0,0,0.42),inset_0_0_0_1px_rgba(255,224,143,0.08)]"
      } ${
        compact ? "px-3 py-4" : "px-8 py-8"
      } ${className}`}
    >
      {!isStage ? (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(126,95,48,0.28),rgba(10,12,10,0.42)_36%,rgba(0,0,0,0.94)_76%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:repeating-linear-gradient(90deg,rgba(255,240,182,0.12)_0_1px,transparent_1px_7px),repeating-linear-gradient(0deg,rgba(255,255,255,0.08)_0_1px,transparent_1px_11px)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[18%] bg-[linear-gradient(180deg,rgba(0,0,0,0.98),rgba(0,0,0,0.64),transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[26%] bg-[linear-gradient(0deg,rgba(0,0,0,0.98),rgba(0,0,0,0.72),transparent)]" />
          <div className="pointer-events-none absolute inset-x-[8%] top-[14%] h-px bg-[linear-gradient(90deg,transparent,rgba(242,207,130,0.52),transparent)]" />
          <div className="pointer-events-none absolute inset-x-[12%] bottom-[16%] h-px bg-[linear-gradient(90deg,transparent,rgba(242,207,130,0.36),transparent)]" />
          <div className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l border-t border-[rgba(242,207,130,0.52)]" />
          <div className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r border-t border-[rgba(242,207,130,0.52)]" />
          <div className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 border-b border-l border-[rgba(242,207,130,0.42)]" />
          <div className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b border-r border-[rgba(242,207,130,0.42)]" />
        </>
      ) : null}

      <div className="relative z-10 flex min-h-full w-full flex-col justify-between text-center">
        <div>
          <div
            className={`font-black uppercase text-[#d8b15b] drop-shadow-[0_0_12px_rgba(228,173,76,0.32)] ${
              labelIsMainTitle
                ? compact
                  ? "text-[18px] tracking-[0.12em]"
                  : "text-[30px] tracking-[0.14em]"
                : compact
                ? "text-[12px] tracking-[0.16em]"
                : "text-[12px] tracking-[0.22em]"
            }`}
          >
            {label}
          </div>
          {title ? (
            <div
              className={`mt-3 font-black text-[#fff0b8] drop-shadow-[0_0_18px_rgba(228,173,76,0.28)] ${
                compact
                  ? "text-[18px] tracking-[0.08em]"
                  : "text-[30px] tracking-[0.12em]"
              }`}
            >
              {title}
            </div>
          ) : null}
        </div>

        <div
          className={`mx-auto flex min-h-0 max-w-[680px] flex-1 flex-col justify-center ${
            compact ? "gap-2 py-3" : "gap-4 py-8"
          }`}
        >
          {lines.map((line, index) => (
            <p
              key={`${line}-${index}`}
              className={`betrayal-cinematic-narration__line mx-auto text-balance font-semibold text-[#fff2cd] shadow-black [text-shadow:0_2px_6px_rgba(0,0,0,0.92),0_0_18px_rgba(240,197,104,0.18)] ${
                compact
                  ? "max-w-[92%] text-[14px] leading-[1.55]"
                  : "max-w-[92%] text-[21px] leading-[1.75]"
              }`}
              style={{ animationDelay: `${120 + index * 130}ms` }}
            >
              {line}
            </p>
          ))}
        </div>

        <div
          className={`relative z-10 flex flex-col items-center ${
            compact ? "gap-2 pb-1" : "gap-3 pb-2"
          }`}
        >
          <div
            aria-hidden="true"
            data-testid="betrayal-cinematic-terminal-mark"
            className={`font-black uppercase text-[#8f7140] ${
              compact
                ? "text-[12px] tracking-[0.12em]"
                : "text-[12px] tracking-[0.16em]"
            }`}
          >
            {t(
              variant.startsWith("ending")
                ? "board.scenario.cinematicTerminalEnd"
                : "board.scenario.cinematicTerminalPrologue",
            )}
          </div>
          {actionSlot ? (
            <div
              data-testid="betrayal-cinematic-action-slot"
              className="pointer-events-auto flex w-full justify-center px-2"
            >
              {actionSlot}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
