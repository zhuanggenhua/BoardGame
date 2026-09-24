import React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import { MagnifyOverlay } from "../../components/common/overlays/MagnifyOverlay";
import { UI_Z_INDEX } from "../../core";
import { BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO } from "./possessionAtlas";
import type { ReferencePage } from "./referencePresentation";
import {
  isScenarioReaderCinematicSection,
  type ScenarioBookTurnSnapshot,
  type ScenarioReaderPage,
  type ScenarioReaderScope,
  type ScenarioReaderSection,
} from "./scenarioReader";
import { CinematicNarrationPanel } from "./cinematicNarrationSurface";
import { ScenarioBookTurnSheet } from "./scenarioBookTurnSurface";

const REFERENCE_CARD_FRAME_WIDTH = "492px";
const SCENARIO_REFERENCE_BOOK_FRAME_WIDTH = "1120px";
const SCENARIO_REFERENCE_BOOK_FRAME_HEIGHT = "760px";
const SCENARIO_READER_MODAL_Z_INDEX = UI_Z_INDEX.modalContent;

type BetrayalReferenceOverlaySurfaceProps = {
  referenceOpen: boolean;
  scenarioReaderOpen: boolean;
  isReferenceScenarioOpeningStage: boolean;
  currentReferencePage?: ReferencePage;
  referenceFallbackAsset?: string;
  effectiveLocale: string;
  scenarioReaderScope: ScenarioReaderScope;
  scenarioReaderScopeLabel: string;
  activeHauntCaseLabel: string;
  activeHauntTitle: string;
  referenceScenarioBookSpreadCount: number;
  referenceScenarioReaderProgressLabel: string;
  referenceScenarioOpeningSection: ScenarioReaderSection | null;
  referenceScenarioTurnDirection: "back" | "forward" | null;
  referenceScenarioTurnSnapshot: ScenarioBookTurnSnapshot | null;
  referenceScenarioLeftPage: ScenarioReaderPage | null;
  referenceScenarioRightPage: ScenarioReaderPage | null;
  showScenarioReaderTitle?: boolean;
  canTurnReferenceScenarioBack: boolean;
  canTurnReferenceScenarioForward: boolean;
  onClose: () => void;
  onToggleReferenceSide?: () => void;
  onReferenceScenarioTurn: (direction: "back" | "forward") => void;
  onScenarioTurnComplete?: () => void;
};

export function BetrayalReferenceOverlaySurface({
  referenceOpen,
  scenarioReaderOpen,
  isReferenceScenarioOpeningStage,
  currentReferencePage,
  referenceFallbackAsset,
  effectiveLocale,
  scenarioReaderScope,
  scenarioReaderScopeLabel,
  activeHauntCaseLabel,
  activeHauntTitle,
  referenceScenarioBookSpreadCount,
  referenceScenarioReaderProgressLabel,
  referenceScenarioOpeningSection,
  referenceScenarioTurnDirection,
  referenceScenarioTurnSnapshot,
  referenceScenarioLeftPage,
  referenceScenarioRightPage,
  showScenarioReaderTitle = false,
  canTurnReferenceScenarioBack,
  canTurnReferenceScenarioForward,
  onClose,
  onToggleReferenceSide,
  onReferenceScenarioTurn,
  onScenarioTurnComplete,
}: BetrayalReferenceOverlaySurfaceProps) {
  const { t } = useTranslation("game-betrayal");

  return (
    <MagnifyOverlay
      isOpen={referenceOpen || scenarioReaderOpen}
      onClose={onClose}
      closeOnBackdrop={false}
      closeButtonClassName="hidden"
      renderInPlace={!scenarioReaderOpen}
      overlayTestId={
        scenarioReaderOpen
          ? "betrayal-scenario-reader-dialog"
          : "betrayal-reference-overlay"
      }
      overlayClassName={
        scenarioReaderOpen && isReferenceScenarioOpeningStage
          ? "bg-[rgba(0,0,0,0.58)] p-0 backdrop-blur-[1px]"
          : "bg-[rgba(3,6,5,0.82)] p-6"
      }
      containerClassName="rounded-none overflow-visible bg-transparent"
      zIndex={
        scenarioReaderOpen ? SCENARIO_READER_MODAL_Z_INDEX : UI_Z_INDEX.magnify
      }
    >
      <div
        className="pointer-events-auto relative"
        style={
          scenarioReaderOpen
            ? isReferenceScenarioOpeningStage
              ? {
                  width: "min(1920px, 100vw)",
                  height: "min(1080px, 100vh)",
                }
              : {
                  width: `min(${SCENARIO_REFERENCE_BOOK_FRAME_WIDTH}, calc(100vw - 2rem))`,
                  height: `min(${SCENARIO_REFERENCE_BOOK_FRAME_HEIGHT}, calc(100vh - 2rem))`,
                }
            : {
                width: REFERENCE_CARD_FRAME_WIDTH,
                aspectRatio: `${BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO} / 1`,
              }
        }
      >
        {!scenarioReaderOpen ? (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleReferenceSide}
              data-testid="betrayal-reference-toggle"
              className="inline-flex items-center gap-1 rounded-[5px] bg-[rgba(9,13,12,0.84)] px-3 py-1.5 text-xs font-medium text-[#f3e0b4] shadow-[0_8px_22px_rgba(0,0,0,0.32)] transition hover:bg-[rgba(22,31,27,0.92)]"
            >
              <ChevronRight size={14} />
              <span>{t("board.reference.toggle")}</span>
            </button>
          </div>
        ) : null}
        {!scenarioReaderOpen || isReferenceScenarioOpeningStage ? (
          <button
            type="button"
            onClick={onClose}
            data-testid={
              isReferenceScenarioOpeningStage
                ? "betrayal-scenario-reader-close"
                : "betrayal-reference-close"
            }
            aria-label={
              isReferenceScenarioOpeningStage
                ? t("board.characterSelect.hideScenarioDetails")
                : t("board.reference.close")
            }
            className="pointer-events-auto absolute right-3 top-3 z-50 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[5px] bg-[rgba(9,13,12,0.84)] px-4 text-[12px] font-medium text-[#f3e0b4] shadow-[0_8px_22px_rgba(0,0,0,0.32)] transition hover:bg-[rgba(22,31,27,0.92)]"
          >
            {isReferenceScenarioOpeningStage
              ? t("board.characterSelect.hideScenarioDetails")
              : t("board.reference.close")}
          </button>
        ) : null}
        {scenarioReaderOpen ? (
          <div data-testid="betrayal-scenario-detail-panel" className="contents">
            <div
              data-testid="betrayal-scenario-objective-page"
              data-reference-page="scenario"
              data-scenario-reader-scope={scenarioReaderScope}
              className="relative flex h-full w-full flex-col overflow-hidden text-[#f3e0b4]"
            >
            <div
              data-testid={
                isReferenceScenarioOpeningStage
                  ? "betrayal-scenario-opening-stage"
                  : "betrayal-scenario-book"
              }
              data-tutorial-protected-region={
                isReferenceScenarioOpeningStage ? undefined : "scenario-book"
              }
              className={`relative min-h-0 flex h-full w-full flex-1 flex-col overflow-hidden ${
                isReferenceScenarioOpeningStage
                  ? "mt-0"
                  : "border border-[#7b633d] bg-[linear-gradient(180deg,rgba(31,24,15,0.98),rgba(10,12,9,0.98))] p-2 shadow-[0_24px_56px_rgba(0,0,0,0.44)] sm:p-3"
              }`}
            >
              {isReferenceScenarioOpeningStage &&
              referenceScenarioOpeningSection ? (
                <>
                  <span
                    data-testid="betrayal-scenario-reader-case-label"
                    className="sr-only"
                  >
                    {activeHauntCaseLabel}
                  </span>
                  <span
                    data-testid="betrayal-scenario-reader-role"
                    className="sr-only"
                  >
                    {scenarioReaderScopeLabel}
                  </span>
                  <span
                    data-testid="betrayal-scenario-reader-header-progress"
                    className="sr-only"
                  >
                    {referenceScenarioReaderProgressLabel}
                  </span>
                  <CinematicNarrationPanel
                    testId="betrayal-scenario-opening-cinematic"
                    label={t(referenceScenarioOpeningSection.labelKey)}
                    text={t(referenceScenarioOpeningSection.bodyKey)}
                    variant="opening"
                    presentation="stage"
                    compact={false}
                    actionSlot={
                      <>
                        <span
                          data-testid="betrayal-scenario-reader-footer-progress"
                          className="sr-only"
                        >
                          {referenceScenarioReaderProgressLabel}
                        </span>
                        <button
                          type="button"
                          data-testid="betrayal-scenario-reader-next-zone"
                          onClick={() => onReferenceScenarioTurn("forward")}
                          disabled={!canTurnReferenceScenarioForward}
                          className="inline-flex min-h-11 min-w-[144px] items-center justify-center gap-2 border border-[rgba(242,207,130,0.42)] bg-[rgba(8,10,9,0.82)] px-6 text-[12px] font-black uppercase tracking-[0.22em] text-[#f5e6c7] shadow-[0_16px_38px_rgba(0,0,0,0.58)] transition hover:border-[#f2cf82] hover:bg-[rgba(18,20,16,0.92)] disabled:opacity-35"
                        >
                          {t("board.scenario.readerEnterBook")}
                          <ChevronRight size={16} aria-hidden="true" />
                        </button>
                      </>
                    }
                    className="h-full min-h-full"
                  />
                </>
              ) : (
                <>
                  <button
                    type="button"
                    data-testid="betrayal-scenario-reader-close"
                    onClick={onClose}
                    aria-label={t("board.characterSelect.hideScenarioDetails")}
                    title={t("board.characterSelect.hideScenarioDetails")}
                    className="pointer-events-auto absolute right-3 top-3 z-50 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[5px] border border-[rgba(214,191,129,0.42)] bg-[rgba(18,23,18,0.9)] text-[#e2c57e] shadow-[0_8px_24px_rgba(0,0,0,0.38)] transition hover:border-[#e2c57e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2c57e]"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                  <div className="sr-only">
                    <span data-testid="betrayal-scenario-reader-case-label">
                      {activeHauntCaseLabel}
                    </span>
                    <span data-testid="betrayal-scenario-reader-role">
                      {scenarioReaderScopeLabel}
                    </span>
                    <span>
                      {scenarioReaderScope === "traitor"
                        ? t("board.scenario.readerScopeTraitor")
                        : scenarioReaderScope === "heroes"
                          ? t("board.scenario.readerScopeHero")
                          : t("board.scenario.readerScopePublic")}
                    </span>
                  <span
                    data-testid="betrayal-scenario-reader-header-progress"
                  >
                    {referenceScenarioReaderProgressLabel}
                  </span>
                  </div>
                  <div
                    className={`absolute inset-2 grid grid-cols-2 ${
                      "gap-3"
                    }`}
                  >
                    {showScenarioReaderTitle ? (
                      <div className="pointer-events-none absolute inset-x-3 top-2 z-30 flex items-center justify-center">
                        <span
                          data-testid="betrayal-scenario-reader-title"
                          className="rounded-[4px] border border-[rgba(123,99,61,0.46)] bg-[rgba(245,226,173,0.9)] px-3 py-1 text-center text-[14px] font-black tracking-[0.08em] text-[#3b2211] shadow-[0_4px_12px_rgba(54,31,12,0.18)] sm:text-[18px]"
                        >
                          {activeHauntTitle}
                        </span>
                      </div>
                    ) : null}
                    <ScenarioBookTurnSheet
                      direction={referenceScenarioTurnDirection}
                      fromPages={
                        referenceScenarioTurnSnapshot?.fromPages ?? [null, null]
                      }
                      toPages={
                        referenceScenarioTurnSnapshot?.toPages ?? [null, null]
                      }
                      title={activeHauntTitle}
                      onTurnComplete={onScenarioTurnComplete}
                    />
                    {[
                      referenceScenarioLeftPage,
                      referenceScenarioRightPage,
                    ].map((page, sideIndex) => (
                      <section
                        key={page?.id ?? `blank-${sideIndex}`}
                        data-testid={
                          page
                            ? `betrayal-scenario-book-page-${page.id}`
                            : `betrayal-scenario-book-page-blank-${sideIndex}`
                        }
                        className="relative min-h-0 overflow-hidden border border-[#c7a06b] bg-[radial-gradient(circle_at_48%_18%,rgba(255,243,204,0.94),rgba(229,200,151,0.98)_58%,rgba(205,164,102,0.98)_100%)] p-6 text-[#3b2211] shadow-[inset_0_0_0_1px_rgba(255,246,215,0.36),inset_0_0_42px_rgba(95,54,19,0.18)]"
                      >
                          <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:repeating-linear-gradient(0deg,rgba(92,55,24,0.08)_0_1px,transparent_1px_8px),radial-gradient(circle_at_18%_22%,rgba(88,49,18,0.12),transparent_18%),radial-gradient(circle_at_80%_70%,rgba(96,55,21,0.10),transparent_22%)]" />
                        {page ? (
                          <div className="relative flex h-full flex-col">
                            <div
                              data-testid={
                                sideIndex === 0
                                  ? "betrayal-scenario-reader-page-label-desktop-left"
                                  : "betrayal-scenario-reader-page-label-desktop-right"
                              }
                              className="absolute left-0 top-0 text-[12px] font-bold tracking-[0.14em] text-[#86643f]"
                            >
                              {String(page.pageNumber).padStart(2, "0")}
                            </div>
                            <div
                              data-testid="betrayal-scenario-reader-body-scroll"
                              className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1"
                            >
                              <div
                                className={`grid min-h-full content-center ${
                                  "gap-6 px-3 py-10 pb-16"
                                }`}
                              >
                                {(page.sections ?? []).map((section) => {
                                  const isCinematicSection =
                                    isScenarioReaderCinematicSection(
                                      section.id,
                                    );

                                  return (
                                    <section
                                      key={section.id}
                                      data-testid={`betrayal-scenario-book-section-${section.id}`}
                                      data-cinematic-narration={
                                        isCinematicSection
                                          ? "opening"
                                          : undefined
                                      }
                                      className={
                                        isCinematicSection
                                          ? "min-h-[250px]"
                                          : `border-l-4 pl-4 ${section.accentClass}`
                                      }
                                    >
                                      {isCinematicSection ? (
                                        <CinematicNarrationPanel
                                          label={t(section.labelKey)}
                                          text={t(section.bodyKey)}
                                          variant="opening"
                                          compact={false}
                                          className={
                                            "min-h-[390px]"
                                          }
                                        />
                                      ) : (
                                        <>
                                          <h2
                                            data-testid={`betrayal-scenario-book-section-title-${section.id}`}
                                            className="text-[22px] font-black tracking-[0.03em] text-[#3b2211]"
                                          >
                                            {t(section.labelKey)}
                                          </h2>
                                          <p
                                            className="mt-3 text-[14px] leading-[1.6] whitespace-pre-line font-medium text-[#4e321c]"
                                          >
                                            {t(section.bodyKey)}
                                          </p>
                                        </>
                                      )}
                                    </section>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        {sideIndex === 0 ? (
                          <button
                            type="button"
                            data-testid="betrayal-scenario-reader-prev-zone"
                            onClick={() => onReferenceScenarioTurn("back")}
                            disabled={!canTurnReferenceScenarioBack}
                            aria-label={t("board.scenario.readerPrev")}
                            title={t("board.scenario.readerPrev")}
                            className={`pointer-events-auto absolute z-50 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[5px] border border-[rgba(211,179,109,0.42)] bg-[rgba(9,13,12,0.88)] text-[#f3e0b4] shadow-[0_8px_18px_rgba(0,0,0,0.32)] transition hover:bg-[rgba(22,31,27,0.94)] disabled:opacity-35 disabled:hover:bg-[rgba(9,13,12,0.88)] ${
                              "bottom-3 left-3"
                            }`}
                          >
                            <ChevronLeft size={16} aria-hidden="true" />
                          </button>
                        ) : null}
                        {sideIndex === 1 ? (
                          <button
                            type="button"
                            data-testid="betrayal-scenario-reader-next-zone"
                            onClick={() => onReferenceScenarioTurn("forward")}
                            disabled={!canTurnReferenceScenarioForward}
                            aria-label={t("board.scenario.readerNext")}
                            title={t("board.scenario.readerNext")}
                            className={`pointer-events-auto absolute z-50 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[5px] border border-[rgba(211,179,109,0.42)] bg-[rgba(9,13,12,0.88)] text-[#f3e0b4] shadow-[0_8px_18px_rgba(0,0,0,0.32)] transition hover:bg-[rgba(22,31,27,0.94)] disabled:opacity-35 disabled:hover:bg-[rgba(9,13,12,0.88)] ${
                              "bottom-3 right-3"
                            }`}
                          >
                            <ChevronRight size={16} aria-hidden="true" />
                          </button>
                        ) : null}
                      </section>
                    ))}
                  </div>
                  <div
                    data-testid="betrayal-scenario-reader-footer-progress-anchor"
                    className="pointer-events-none absolute inset-x-2 bottom-2 z-40 flex justify-center"
                  >
                    <span
                      data-testid="betrayal-scenario-reader-footer-progress"
                      className="rounded-full border border-[rgba(211,179,109,0.22)] bg-[rgba(9,13,12,0.84)] px-3 py-1 text-[12px] font-semibold text-[#d5c5a2] shadow-[0_8px_18px_rgba(0,0,0,0.32)]"
                    >
                      {referenceScenarioReaderProgressLabel}
                    </span>
                  </div>
                </>
              )}
            </div>
            </div>
          </div>
        ) : (
          <OptimizedImage
            src={currentReferencePage?.asset ?? referenceFallbackAsset ?? ""}
            locale={effectiveLocale}
            alt={t(`board.reference.${currentReferencePage?.id ?? "front"}`)}
            data-testid="betrayal-reference-card-image"
            data-asset-src={currentReferencePage?.asset}
            className="h-full w-full object-contain shadow-[0_24px_56px_rgba(0,0,0,0.44)]"
            draggable={false}
          />
        )}
      </div>
    </MagnifyOverlay>
  );
}
