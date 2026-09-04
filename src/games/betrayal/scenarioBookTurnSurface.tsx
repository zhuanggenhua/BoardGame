import React from "react";
import { useTranslation } from "react-i18next";
import { FoldLinePageFlipStage } from "../../components/home-v2/FoldLinePageFlipStage";
import {
  SCENARIO_BOOK_TURN_DURATION_MS,
  type ScenarioReaderPage,
  type ScenarioReaderSection,
} from "./scenarioReader";

export function ScenarioBookTurnSheet({
  direction,
  fromPages,
  toPages,
  title,
  isPhoneLandscapeLayout = false,
  onTurnComplete,
}: {
  direction: "back" | "forward" | null;
  fromPages: [ScenarioReaderPage | null, ScenarioReaderPage | null];
  toPages: [ScenarioReaderPage | null, ScenarioReaderPage | null];
  title: string;
  isPhoneLandscapeLayout?: boolean;
  onTurnComplete?: () => void;
}) {
  const { t } = useTranslation("game-betrayal");
  if (!direction) return null;

  const isForward = direction === "forward";
  const renderPageFace = (
    page: ScenarioReaderPage | null,
    section: ScenarioReaderSection | null,
    face: "front" | "back",
  ) => (
    <div
      className={`relative h-full w-full overflow-hidden border border-[#c7a06b] bg-[radial-gradient(circle_at_48%_18%,rgba(255,243,204,0.96),rgba(229,200,151,0.98)_58%,rgba(205,164,102,0.98)_100%)] p-3 text-[#3b2211] shadow-[inset_0_0_0_1px_rgba(255,246,215,0.36),inset_0_0_42px_rgba(95,54,19,0.18)] sm:p-4 lg:p-6 ${face === "back" ? "[backface-visibility:hidden]" : ""}`}
      style={{ backfaceVisibility: "hidden" }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:repeating-linear-gradient(0deg,rgba(92,55,24,0.08)_0_1px,transparent_1px_8px),radial-gradient(circle_at_18%_22%,rgba(88,49,18,0.12),transparent_18%),radial-gradient(circle_at_80%_70%,rgba(96,55,21,0.10),transparent_22%)]" />
      <div className="pointer-events-none absolute inset-[10px] border border-[#b98343]/40" />
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7d5129]">
          {page ? `剧本 ${String(page.pageNumber).padStart(2, "0")}` : title}
        </div>
        <h3 className="mt-2 text-[21px] font-black tracking-[0.04em] text-[#3b2211] lg:text-[27px]">
          {page?.type === "cover"
            ? title
            : section
              ? t(section.labelKey)
              : t("board.scenario.readerNext")}
        </h3>
        {section ? (
          <>
            <div className={`mt-3 border-l-4 ${section.accentClass} pl-3`}>
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#7d5129]">
                {t(section.labelKey)}
              </div>
              <p className="mt-2 max-h-[190px] overflow-hidden whitespace-pre-line text-[14px] leading-6 text-[#4e321c] lg:text-[16px] lg:leading-7">
                {t(section.bodyKey)}
              </p>
            </div>
          </>
        ) : (
          <p className="mt-4 text-[15px] font-semibold leading-7 text-[#57361f] lg:text-[17px] lg:leading-8">
            {title}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between border-t border-[#b98343]/36 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86643f]">
          <span>{section ? t(section.labelKey) : title}</span>
          <span>{page ? String(page.pageNumber).padStart(2, "0") : "—"}</span>
        </div>
      </div>
    </div>
  );

  const renderSpread = (
    leftPage: ScenarioReaderPage | null,
    rightPage: ScenarioReaderPage | null,
  ) => (
    <div className="grid h-full w-full grid-cols-2 gap-2 bg-[#2a170d] p-1.5">
      {renderPageFace(leftPage, leftPage?.sections?.[0] ?? null, "front")}
      {renderPageFace(rightPage, rightPage?.sections?.[0] ?? null, "front")}
    </div>
  );

  const viewportWidth =
    typeof window === "undefined" ? 1000 : Math.max(320, window.innerWidth);
  const viewportHeight =
    typeof window === "undefined" ? 680 : Math.max(260, window.innerHeight);
  const stageWidth = isPhoneLandscapeLayout
    ? Math.max(320, Math.min(viewportWidth * 0.94, 900))
    : Math.max(640, Math.min(viewportWidth * 0.9, 1080));
  const stageHeight = isPhoneLandscapeLayout
    ? Math.max(260, Math.min(viewportHeight - 88, 420))
    : Math.max(420, Math.min(viewportHeight * 0.78, 720));

  return (
    <div
      data-testid="betrayal-scenario-book-turning-sheet"
      data-flip-direction={direction}
      data-flip-implementation="turnjs-real-page-flip"
      data-flip-from-page={fromPages.map((page) => page?.id ?? "").join(",")}
      data-flip-to-page={toPages.map((page) => page?.id ?? "").join(",")}
      aria-hidden="true"
      className="pointer-events-none absolute inset-[7px] z-20 overflow-hidden"
    >
      <FoldLinePageFlipStage
        mode={isForward ? "flippingToDetail" : "flippingToOverview"}
        testId="betrayal-scenario-book-real-flip-stage"
        durationMs={SCENARIO_BOOK_TURN_DURATION_MS}
        renderOverviewStage={() =>
          renderSpread(
            ...(isForward ? fromPages : toPages),
          )
        }
        renderDetailStage={() =>
          renderSpread(
            ...(isForward ? toPages : fromPages),
          )
        }
        overviewStageSize={{ width: stageWidth, height: stageHeight }}
        detailStageSize={{ width: stageWidth, height: stageHeight }}
        leftPageRect={{ left: "0%", top: "0%", width: "50%", height: "100%" }}
        rightPageRect={{ left: "50%", top: "0%", width: "50%", height: "100%" }}
        onFlipToDetailComplete={onTurnComplete}
        onFlipToOverviewComplete={onTurnComplete}
      />
    </div>
  );
}
