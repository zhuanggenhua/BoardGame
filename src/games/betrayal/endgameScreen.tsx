import React from "react";
import { BookOpen, ChevronRight, Footprints, House, RotateCcw, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import type { MatchPlayerInfo } from "../../engine/transport/protocol";
import type { BetrayalCore, BetrayalTraitKey } from "./game";
import { CinematicNarrationPanel } from "./cinematicNarrationSurface";
import {
  resolveEndgameHauntDossier,
  resolveEndgameNarrationSectionId,
} from "./scenarioReader";
import { resolveEndgameExplorerName } from "./playerPresentation";
import { TRAIT_LABEL_LOCAL } from "./traitTrackSurface";
import { BETRAYAL_TRAIT_MARKER_ASSETS } from "./traitAssets";
import {
  BETRAYAL_COVER_ASSET,
  BETRAYAL_OMEN_DECK_ASSET,
  BETRAYAL_TITLE_BANNER_ASSET,
} from "./uiAssets";

const ENDGAME_MEDALLION_CLIP_PATH =
  "polygon(50% 2%, 91% 25%, 91% 73%, 50% 98%, 9% 73%, 9% 25%)";

export function EndgameScreen({
  core,
  matchData,
  effectiveLocale,
}: {
  core: BetrayalCore;
  matchData?: MatchPlayerInfo[];
  effectiveLocale: string;
}) {
  const { t } = useTranslation("game-betrayal");
  const result = core.endgameResult;
  const endgameDossier = resolveEndgameHauntDossier(core);
  const allExplorers = [core.currentExplorer, ...core.otherExplorers];
  const survivorsWon =
    result?.outcome === "survivors" || result?.outcome === "solo";
  const hauntWon = result?.outcome === "haunt";
  const survivors = result
    ? allExplorers.filter((explorer) =>
        result.survivorsEscaped.includes(explorer.playerId),
      )
    : allExplorers.slice(0, Math.max(1, allExplorers.length - 1));
  const traitor = result && !hauntWon
    ? (allExplorers.find(
        (explorer) => explorer.playerId === result.traitorPlayerId,
      ) ?? allExplorers[allExplorers.length - 1])
    : result
      ? null
      : allExplorers[allExplorers.length - 1];
  const outcomeTitle = survivorsWon
    ? t("board.endgame.victory")
    : t("board.endgame.defeat");
  const outcomeSubtitle = hauntWon
    ? t("board.endgame.hauntSucceeded")
    : survivorsWon
    ? t("board.endgame.survivorsEscaped")
    : t("board.endgame.traitorSucceeded");
  const survivorsTitle = survivorsWon
    ? t("board.endgame.survivorsStatusWin")
    : t("board.endgame.survivorsStatusLose");
  const antagonistLabel = hauntWon
    ? t("board.endgame.haunt")
    : t("board.endgame.traitor");
  const antagonistTitle = hauntWon
    ? t("board.endgame.hauntStatusWin")
    : survivorsWon
    ? t("board.endgame.traitorStatusLose")
    : t("board.endgame.traitorStatusWin");
  const endgameTraitOrder = [
    "might",
    "speed",
    "knowledge",
    "sanity",
  ] as BetrayalTraitKey[];
  const roomsExploredCount =
    result?.stats.roomsExplored ??
    core.rooms.filter((room) => room.state === "discovered").length;
  const omensDrawnCount = result?.stats.omensDrawn ?? 0;
  const eventsDrawnCount = result?.stats.eventsDrawn ?? 0;
  const endgameNarrationSectionId = resolveEndgameNarrationSectionId(
    endgameDossier,
    result?.outcome,
  );
  const endgameNarrationKey = `board.haunts.${endgameDossier.id}.reader.${endgameNarrationSectionId}`;
  const endgameNarrationVariant =
    result?.outcome === "haunt"
      ? "ending-haunt"
      : result?.outcome === "traitor"
        ? "ending-traitor"
        : "ending-survivors";
  const endgameNarrationIdentity = `${endgameDossier.id}:${result?.outcome ?? "unknown"}:${result?.traitorPlayerId ?? "none"}`;
  const [endingNarrationOpen, setEndingNarrationOpen] =
    React.useState(true);

  React.useEffect(() => {
    setEndingNarrationOpen(true);
  }, [endgameNarrationIdentity]);

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    if (!endingNarrationOpen) {
      return undefined;
    }
    const root = document.documentElement;
    const attrName = "data-betrayal-cinematic-stage";
    root.setAttribute(attrName, "true");
    return () => {
      root.removeAttribute(attrName);
    };
  }, [endingNarrationOpen]);

  return (
    <div
      data-testid="betrayal-endgame-screen"
      data-tutorial-id="betrayal-endgame-screen"
      className="absolute inset-0 z-[240] flex h-full min-h-full flex-col overflow-hidden bg-transparent text-[#f1e8d4]"
      style={
        endingNarrationOpen
          ? undefined
          : {
              backgroundImage: [
                "radial-gradient(circle at 50% 10%, rgba(156,203,77,0.14), transparent 24%)",
                "repeating-linear-gradient(90deg, rgba(45,61,50,0.04) 0 2px, rgba(0,0,0,0) 2px 22px)",
                "repeating-linear-gradient(0deg, rgba(37,52,42,0.03) 0 2px, rgba(0,0,0,0) 2px 24px)",
                "linear-gradient(180deg, #0d1714 0%, #07100e 100%)",
              ].join(","),
            }
      }
    >
      {endingNarrationOpen ? (
        <section
          data-testid="betrayal-endgame-ending-stage"
          className="relative flex h-full min-h-full w-full flex-col overflow-hidden bg-[rgba(0,0,0,0.36)] backdrop-blur-[1px]"
        >
          <CinematicNarrationPanel
            testId="betrayal-endgame-ending-narration"
            label={t("board.endgame.endingNarrationLabel")}
            text={t(endgameNarrationKey)}
            variant={endgameNarrationVariant}
            presentation="stage"
            actionSlot={
              <button
                type="button"
                data-testid="betrayal-endgame-ending-continue"
                onClick={() => setEndingNarrationOpen(false)}
                className="inline-flex min-h-11 min-w-[168px] items-center justify-center gap-2 border border-[rgba(242,207,130,0.42)] bg-[rgba(8,10,9,0.82)] px-6 text-[12px] font-black uppercase tracking-[0.22em] text-[#f5e6c7] shadow-[0_16px_38px_rgba(0,0,0,0.58)] transition hover:border-[#f2cf82] hover:bg-[rgba(18,20,16,0.92)]"
              >
                {t("board.endgame.continueToReport")}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            }
            className="h-full min-h-full w-full"
          />
        </section>
      ) : (
      <div className="mx-auto flex h-full min-h-full w-full max-w-[1760px] p-3 md:p-4">
        <div className="relative flex min-h-full w-full flex-col overflow-hidden border border-[#876a3c] bg-[rgba(9,15,13,0.95)] shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
          <div className="pointer-events-none absolute inset-0 border border-[rgba(216,191,129,0.14)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(132,170,82,0.08),transparent_28%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(38,51,44,0.03)_0_2px,rgba(0,0,0,0)_2px_26px)]" />
          <div className="pointer-events-none absolute left-1 top-1 h-4 w-4 border-l border-t border-[rgba(216,191,129,0.6)]" />
          <div className="pointer-events-none absolute right-1 top-1 h-4 w-4 border-r border-t border-[rgba(216,191,129,0.6)]" />
          <div className="pointer-events-none absolute bottom-1 left-1 h-4 w-4 border-b border-l border-[rgba(216,191,129,0.6)]" />
          <div className="pointer-events-none absolute bottom-1 right-1 h-4 w-4 border-b border-r border-[rgba(216,191,129,0.6)]" />

          <header className="relative grid min-h-[118px] grid-cols-[minmax(300px,1fr)_1.42fr_minmax(330px,1fr)] divide-x divide-[#5e4b2e] border-b border-[#6a5637] bg-[linear-gradient(180deg,rgba(10,16,14,0.985),rgba(8,14,13,0.95))] px-5 py-3">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.3),transparent)]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.18),transparent)]" />
            <div className="relative flex items-center overflow-hidden px-4 py-2.5">
              <div className="pointer-events-none absolute inset-y-2 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.42),transparent)]" />
              <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.28),transparent)]" />
              <div className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.12),transparent)]" />
              <div className="relative flex h-[74px] w-full items-center overflow-hidden border border-[rgba(214,191,129,0.3)] bg-[linear-gradient(180deg,rgba(8,12,11,0.72),rgba(5,8,7,0.92))] px-3 shadow-[inset_0_0_0_1px_rgba(214,191,129,0.08)]">
                <div className="pointer-events-none absolute inset-[3px] border border-[rgba(214,191,129,0.12)]" />
                <OptimizedImage
                  src={BETRAYAL_TITLE_BANNER_ASSET}
                  locale={effectiveLocale}
                  alt={t("title")}
                  className="relative h-[58px] w-full object-contain object-left"
                  draggable={false}
                />
              </div>
            </div>
            <div className="relative flex flex-col items-center justify-center px-6 py-2 text-center">
              <div className="text-xs uppercase tracking-[0.34em] text-[#e1c480]">
                {t("board.endgame.title")}
              </div>
              <div
                className={`mt-1 text-[56px] font-bold tracking-[0.1em] drop-shadow-[0_0_18px_rgba(183,239,116,0.28)] ${
                  survivorsWon ? "text-[#b7ef74]" : "text-[#eb8a67]"
                }`}
              >
                {outcomeTitle}
              </div>
              <div className="mt-1 text-[17px] tracking-[0.24em] text-[#f1e1bb]">
                {outcomeSubtitle}
              </div>
              <div className="pointer-events-none absolute left-[14%] top-1/2 flex items-center gap-2">
                <span className="h-px w-16 bg-[linear-gradient(90deg,transparent,#9f854d)]" />
                <span className="h-1.5 w-1.5 rotate-45 border border-[rgba(209,177,111,0.72)] bg-[rgba(209,177,111,0.14)]" />
              </div>
              <div className="pointer-events-none absolute right-[14%] top-1/2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rotate-45 border border-[rgba(209,177,111,0.72)] bg-[rgba(209,177,111,0.14)]" />
                <span className="h-px w-16 bg-[linear-gradient(90deg,#9f854d,transparent)]" />
              </div>
            </div>
            <div className="relative flex items-stretch overflow-hidden px-4 py-2.5">
              <div className="pointer-events-none absolute inset-y-2 right-0 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.42),transparent)]" />
              <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.28),transparent)]" />
              <div className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.12),transparent)]" />
              <div className="relative flex flex-1 overflow-hidden border border-[rgba(214,191,129,0.3)] bg-[linear-gradient(180deg,rgba(8,12,11,0.72),rgba(5,8,7,0.92))] shadow-[inset_0_0_0_1px_rgba(214,191,129,0.08)]">
                <div className="pointer-events-none absolute inset-[3px] border border-[rgba(214,191,129,0.12)]" />
                <div className="relative hidden w-[148px] overflow-hidden md:block">
                  <OptimizedImage
                    src={BETRAYAL_COVER_ASSET}
                    locale={effectiveLocale}
                    alt=""
                    className="h-full w-full object-cover opacity-46"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,11,0.1),rgba(8,12,11,0.52))]" />
                </div>
                <div className="relative flex flex-col justify-center px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.26em] text-[#ddb774]">
                    {t("board.scenario.button")}
                  </div>
                  <div className="mt-1 text-[28px] font-semibold tracking-[0.08em] text-[#f3e1bd]">
                    {result?.hauntTitle ?? t(endgameDossier.titleKey)}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="grid min-h-0 flex-1 grid-cols-[318px_minmax(0,1.18fr)_286px] gap-0 px-4 pb-3 pt-3 xl:grid-cols-[336px_minmax(0,1.22fr)_304px]">
            <section className="relative flex min-h-0 flex-col gap-3 px-2 pb-1 pt-1 pr-4">
              <div className="pointer-events-none absolute right-0 top-2 bottom-2 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.2),rgba(214,191,129,0.2),transparent)]" />
              <div className="relative overflow-hidden px-3 py-3">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(179,239,116,0.45),transparent)]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.16),transparent)]" />
                <div className="text-center text-[19px] font-semibold uppercase tracking-[0.16em] text-[#b7ef74]">
                  {t("board.endgame.survivors")}
                </div>
                <div className="mt-1 text-center text-[13px] uppercase tracking-[0.18em] text-[#d6e3b5]">
                  {survivorsTitle}
                </div>
                <div className="mt-4 space-y-2">
                  {survivors.map((explorer) => (
                    <div
                      key={explorer.playerId}
                      className="relative grid grid-cols-[50px_1fr_38px] items-center gap-3 border-y border-[rgba(126,102,61,0.3)] bg-[linear-gradient(180deg,rgba(15,21,19,0.34),rgba(8,11,10,0.42))] px-2 py-2"
                    >
                      <div className="relative grid h-[50px] w-[50px] place-items-center overflow-hidden rounded-full border border-[rgba(177,151,92,0.3)] bg-[radial-gradient(circle_at_50%_38%,rgba(61,89,72,0.18),rgba(8,11,10,0.74)_72%)]">
                        <OptimizedImage
                          src={explorer.portraitAsset}
                          locale={effectiveLocale}
                          alt={explorer.displayName}
                          className="h-[48px] w-[48px] object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.32)]"
                          draggable={false}
                        />
                      </div>
                      <div className="min-w-0">
                        <div
                          className="min-h-[18px] whitespace-normal pr-2 text-[11px] font-semibold leading-[1.08] tracking-[0.03em] text-[#f4e6c7]"
                          style={{ wordBreak: "break-word" }}
                        >
                          {resolveEndgameExplorerName(explorer, matchData)}
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-1">
                          {endgameTraitOrder.map((key) => (
                            <span
                              key={key}
                              data-trait-value-shape="square"
                              className="inline-flex items-center gap-1 rounded-[4px] border border-[rgba(112,92,58,0.34)] bg-[rgba(17,15,12,0.42)] px-1 py-0.5 text-[9px] text-[#f3e6c9]"
                            >
                              <OptimizedImage
                                src={BETRAYAL_TRAIT_MARKER_ASSETS[key]}
                                locale={effectiveLocale}
                                alt={TRAIT_LABEL_LOCAL[key]}
                                className="h-3.5 w-3.5 object-contain opacity-90"
                                draggable={false}
                              />
                              <span className="font-semibold leading-none">
                                {explorer.traits[key]}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="grid place-items-center text-center">
                        <div
                          className="relative grid h-[42px] w-[38px] place-items-center border border-[rgba(132,171,82,0.44)] bg-[radial-gradient(circle_at_50%_24%,rgba(182,234,104,0.18),rgba(23,33,19,0.84)_72%)] text-[15px] font-semibold text-[#b7ef74] shadow-[0_8px_14px_rgba(0,0,0,0.18)]"
                          style={{ clipPath: ENDGAME_MEDALLION_CLIP_PATH }}
                        >
                          <span
                            className="pointer-events-none absolute inset-[3px] border border-[rgba(214,191,129,0.2)]"
                            style={{ clipPath: ENDGAME_MEDALLION_CLIP_PATH }}
                          />
                          {Object.values(explorer.traits).reduce(
                            (sum, value) => sum + value,
                            0,
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative overflow-hidden px-2 pb-2 pt-2">
                <div className="mb-2.5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(221,183,116,0.34))]" />
                  <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#ddb774]">
                    {outcomeSubtitle}
                  </div>
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(221,183,116,0.34),transparent)]" />
                </div>
                <div className="relative overflow-hidden border border-[rgba(108,84,53,0.64)] bg-[rgba(3,7,6,0.58)] shadow-[inset_0_0_0_1px_rgba(214,191,129,0.06)]">
                  <div className="pointer-events-none absolute inset-[3px] border border-[rgba(214,191,129,0.08)]" />
                  <OptimizedImage
                    src={BETRAYAL_COVER_ASSET}
                    locale={effectiveLocale}
                    alt={outcomeSubtitle}
                    className="h-[104px] w-full object-cover opacity-78"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,8,0.14),rgba(6,10,8,0.62))]" />
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-center">
                    {survivors.map((explorer, index) => (
                      <OptimizedImage
                        key={explorer.playerId}
                        src={explorer.portraitAsset}
                        locale={effectiveLocale}
                        alt={explorer.displayName}
                        className="h-[56px] w-[56px] object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                        style={{ marginLeft: index === 0 ? 0 : -20 }}
                        draggable={false}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="relative flex min-h-0 flex-col items-center justify-start gap-3 px-3">
              <div className="pointer-events-none absolute left-0 top-2 bottom-2 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.22),rgba(214,191,129,0.22),transparent)]" />
              <div className="pointer-events-none absolute right-0 top-2 bottom-2 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.22),rgba(214,191,129,0.22),transparent)]" />
              <div className="relative w-full max-w-[728px] border border-[#aa864b] bg-[linear-gradient(180deg,rgba(54,40,22,0.98),rgba(28,21,14,0.99))] p-[9px] shadow-[0_22px_48px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(226,185,102,0.12)]">
                <div className="pointer-events-none absolute inset-1 border border-[rgba(226,185,102,0.28)]" />
                <div className="pointer-events-none absolute inset-[5px] border border-[rgba(54,38,18,0.86)]" />
                <div className="pointer-events-none absolute inset-x-3 top-1 h-px bg-[linear-gradient(90deg,transparent,rgba(232,190,106,0.62),transparent)]" />
                <div className="pointer-events-none absolute inset-x-3 bottom-1 h-px bg-[linear-gradient(90deg,transparent,rgba(232,190,106,0.3),transparent)]" />
                <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center">
                  <span className="h-10 w-1 rounded-full bg-[linear-gradient(180deg,rgba(232,190,106,0),rgba(232,190,106,0.95),rgba(232,190,106,0))]" />
                </div>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                  <span className="h-10 w-1 rounded-full bg-[linear-gradient(180deg,rgba(232,190,106,0),rgba(232,190,106,0.95),rgba(232,190,106,0))]" />
                </div>

                <div
                  data-testid="betrayal-endgame-result-report"
                  className="relative overflow-hidden border border-[#6f5935] px-5 pb-4 pt-4 text-[#2c2419] shadow-[inset_0_0_0_1px_rgba(255,238,198,0.1)]"
                  style={{
                    backgroundImage: [
                      "radial-gradient(circle at 14% 18%, rgba(246,229,187,0.34), transparent 15%)",
                      "radial-gradient(circle at 86% 18%, rgba(92,65,35,0.3), transparent 18%)",
                      "radial-gradient(circle at 52% 62%, rgba(62,43,22,0.23), transparent 54%)",
                      "radial-gradient(circle at 26% 82%, rgba(134,104,66,0.18), transparent 17%)",
                      "radial-gradient(circle at 72% 80%, rgba(89,67,41,0.16), transparent 16%)",
                      "linear-gradient(180deg, rgba(52,35,17,0.42) 0%, rgba(0,0,0,0) 9%, rgba(0,0,0,0) 91%, rgba(52,35,17,0.46) 100%)",
                      "repeating-linear-gradient(0deg, rgba(78,60,35,0.06) 0 2px, rgba(0,0,0,0) 2px 8px)",
                      "repeating-linear-gradient(90deg, rgba(117,94,58,0.045) 0 1px, rgba(0,0,0,0) 1px 8px)",
                      "linear-gradient(180deg, #b7a27a 0%, #a79068 25%, #8f7956 66%, #a38c65 100%)",
                    ].join(","),
                    boxShadow:
                      "inset 0 0 0 1px rgba(98,72,40,0.26), inset 0 0 84px rgba(44,30,15,0.32), inset 0 0 22px rgba(255,236,198,0.1)",
                  }}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(69,52,29,0.22),rgba(0,0,0,0)_7%,rgba(0,0,0,0)_93%,rgba(69,52,29,0.24))]" />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(52,39,22,0.16),rgba(0,0,0,0)_8%,rgba(0,0,0,0)_92%,rgba(52,39,22,0.2))]" />
                  <div
                    className="pointer-events-none absolute inset-0 opacity-42 mix-blend-multiply"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at 18% 28%, rgba(120,88,54,0.24) 0 1px, transparent 1px), radial-gradient(circle at 72% 64%, rgba(102,74,45,0.2) 0 1px, transparent 1px), radial-gradient(circle at 42% 78%, rgba(134,102,63,0.16) 0 1px, transparent 1px)",
                      backgroundSize: "128px 96px, 156px 112px, 138px 124px",
                    }}
                  />
                  <div className="pointer-events-none absolute inset-2 border border-[rgba(74,52,27,0.48)]" />
                  <div className="pointer-events-none absolute inset-[18px] border border-[rgba(132,108,68,0.24)]" />
                  <div className="pointer-events-none absolute inset-x-[72px] top-[48px] h-px bg-[linear-gradient(90deg,transparent,rgba(74,52,27,0.42),transparent)]" />
                  <div className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l-2 border-t-2 border-[#6f5830]" />
                  <div className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r-2 border-t-2 border-[#6f5830]" />
                  <div className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 border-b-2 border-l-2 border-[#6f5830]" />
                  <div className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b-2 border-r-2 border-[#6f5830]" />

                  <div className="relative text-center">
                    <div className="pointer-events-none absolute left-[13%] top-1/2 h-px w-16 -translate-y-1/2 bg-[linear-gradient(90deg,transparent,rgba(73,49,24,0.9))]" />
                    <div className="pointer-events-none absolute right-[13%] top-1/2 h-px w-16 -translate-y-1/2 bg-[linear-gradient(90deg,rgba(73,49,24,0.9),transparent)]" />
                    <div className="text-[36px] font-bold tracking-[0.14em] text-[#302315] drop-shadow-[0_1px_0_rgba(229,207,159,0.32)]">
                      {result?.hauntTitle ?? t(endgameDossier.titleKey)}
                    </div>
                    <div className="pointer-events-none mt-2 flex items-center justify-center gap-2">
                      <span className="h-px w-20 bg-[linear-gradient(90deg,transparent,rgba(73,49,24,0.78))]" />
                      <span className="h-1.5 w-1.5 rotate-45 border border-[rgba(73,49,24,0.78)] bg-[rgba(133,108,68,0.24)]" />
                      <span className="h-px w-20 bg-[linear-gradient(90deg,rgba(73,49,24,0.78),transparent)]" />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-[1fr_1fr] gap-0">
                    <div className="relative border-r border-[#6f5d3d] pr-4 pt-4">
                      <div className="text-center text-[14px] font-bold tracking-[0.3em] text-[#3a2a19]">
                        {t("board.scenario.objectiveLabel")}
                      </div>
                      <div className="mt-4 flex h-14 items-center justify-center">
                        {survivors.slice(0, 2).map((explorer, index) => (
                          <OptimizedImage
                            key={explorer.playerId}
                            src={explorer.portraitAsset}
                            locale={effectiveLocale}
                            alt={explorer.displayName}
                            className="h-14 w-14 object-contain drop-shadow-[0_8px_18px_rgba(64,75,40,0.42)]"
                            style={{ marginLeft: index === 0 ? 0 : -20 }}
                            draggable={false}
                          />
                        ))}
                      </div>
                      <p className="mt-4 text-center text-[14px] font-semibold leading-[1.35] text-[#352a1e]">
                        {outcomeSubtitle}。
                      </p>
                      <div className="mt-4 flex justify-center">
                        <div className="relative grid h-[72px] w-[72px] rotate-[-11deg] place-items-center rounded-full border-[4px] border-[#476a31] text-[18px] font-bold tracking-[0.08em] text-[#476a31] opacity-90 shadow-[inset_0_0_0_2px_rgba(71,106,49,0.34)]">
                          <span className="pointer-events-none absolute inset-[11px] rounded-full border-2 border-[rgba(71,106,49,0.46)]" />
                          {t("board.endgame.completedStamp")}
                        </div>
                      </div>
                    </div>

                    <div className="pl-4 pt-4">
                      <div className="text-center text-[14px] font-bold tracking-[0.3em] text-[#3a2a19]">
                        {t("board.endgame.resultLabel")}
                      </div>
                      <div className="mt-4 flex h-14 items-center justify-center">
                        {survivors.slice(0, 2).map((explorer, index) => (
                          <OptimizedImage
                            key={explorer.playerId}
                            src={explorer.portraitAsset}
                            locale={effectiveLocale}
                            alt={explorer.displayName}
                            className="h-14 w-14 object-contain drop-shadow-[0_8px_18px_rgba(64,75,40,0.42)]"
                            style={{ marginLeft: index === 0 ? 0 : -20 }}
                            draggable={false}
                          />
                        ))}
                      </div>
                      <div
                        className={`mt-4 text-center text-[38px] font-bold tracking-[0.12em] drop-shadow-[0_1px_0_rgba(230,211,163,0.28)] ${survivorsWon ? "text-[#4d7330]" : "text-[#92493e]"}`}
                      >
                        {outcomeTitle}
                      </div>
                      <div className="mt-4 border-t border-[#6f5d3d] pt-3">
                        <div className="text-center text-[14px] font-bold tracking-[0.3em] text-[#3a2a19]">
                          {t("board.endgame.rewardsLabel")}
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <span className="grid h-14 w-14 place-items-center rounded-full border border-[rgba(132,108,68,0.38)] bg-[rgba(88,67,38,0.08)] text-[32px] leading-none text-[#bf9647] drop-shadow-[0_2px_0_rgba(86,58,22,0.45)]">
                              ★
                            </span>
                            <div className="text-[30px] font-semibold">
                              {result?.reward.stars ?? 4}
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            <span className="grid h-14 w-14 place-items-center rounded-full border border-[rgba(132,108,68,0.38)] bg-[rgba(88,67,38,0.08)]">
                              <OptimizedImage
                                src={BETRAYAL_OMEN_DECK_ASSET}
                                locale={effectiveLocale}
                                alt=""
                                className="h-10 w-7 object-cover"
                                draggable={false}
                              />
                            </span>
                            <div className="text-[30px] font-semibold">
                              {result?.reward.omens ?? 2}
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            <span className="grid h-14 w-14 place-items-center rounded-full border border-[rgba(132,108,68,0.38)] bg-[rgba(88,67,38,0.08)]">
                              <BookOpen size={28} className="text-[#5d7d8d]" />
                            </span>
                            <div className="text-[30px] font-semibold">
                              {result?.reward.logs ?? 1}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute left-1/2 top-[82px] bottom-5 w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgba(94,73,42,0),rgba(94,73,42,0.72),rgba(94,73,42,0.72),rgba(94,73,42,0))]" />
                </div>
              </div>

              <div className="flex shrink-0 gap-3 pb-1">
                <button className="relative inline-flex min-w-[138px] items-center justify-center gap-3 overflow-hidden border border-[#7d643a] bg-[linear-gradient(180deg,rgba(18,25,21,0.96),rgba(10,15,13,0.98))] px-4 py-2.5 text-[17px] font-semibold tracking-[0.12em] text-[#ddb774] shadow-[inset_0_0_0_1px_rgba(221,183,116,0.08)]">
                  <span className="pointer-events-none absolute inset-1 border border-[rgba(214,191,129,0.12)]" />
                  <span className="pointer-events-none absolute inset-x-4 top-1 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.34),transparent)]" />
                  <RotateCcw size={22} />
                  <span>{t("board.endgame.rematch")}</span>
                </button>
                <button className="relative inline-flex min-w-[138px] items-center justify-center gap-3 overflow-hidden border border-[#7d643a] bg-[linear-gradient(180deg,rgba(18,25,21,0.96),rgba(10,15,13,0.98))] px-4 py-2.5 text-[17px] font-semibold tracking-[0.12em] text-[#ddb774] shadow-[inset_0_0_0_1px_rgba(221,183,116,0.08)]">
                  <span className="pointer-events-none absolute inset-1 border border-[rgba(214,191,129,0.12)]" />
                  <span className="pointer-events-none absolute inset-x-4 top-1 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.34),transparent)]" />
                  <House size={22} />
                  <span>{t("board.endgame.lobby")}</span>
                </button>
                <button className="relative inline-flex min-w-[138px] items-center justify-center gap-3 overflow-hidden border border-[#7d643a] bg-[linear-gradient(180deg,rgba(18,25,21,0.96),rgba(10,15,13,0.98))] px-4 py-2.5 text-[17px] font-semibold tracking-[0.12em] text-[#ddb774] shadow-[inset_0_0_0_1px_rgba(221,183,116,0.08)]">
                  <span className="pointer-events-none absolute inset-1 border border-[rgba(214,191,129,0.12)]" />
                  <span className="pointer-events-none absolute inset-x-4 top-1 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.34),transparent)]" />
                  <BookOpen size={22} />
                  <span>{t("board.endgame.logs")}</span>
                </button>
              </div>
            </section>

            <section className="relative flex min-h-0 flex-col gap-3 px-2 pb-1 pt-1 pl-4">
              <div className="pointer-events-none absolute left-0 top-2 bottom-2 w-px bg-[linear-gradient(180deg,transparent,rgba(214,191,129,0.2),rgba(214,191,129,0.2),transparent)]" />
              <div className="relative overflow-hidden px-3 pb-2 pt-3">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(235,114,80,0.42),transparent)]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.14),transparent)]" />
                <div className="text-center text-[19px] font-semibold uppercase tracking-[0.16em] text-[#eb7250]">
                  {antagonistLabel}
                </div>
                <div className="mt-1 text-center text-[13px] uppercase tracking-[0.18em] text-[#f1b49d]">
                  {antagonistTitle}
                </div>
                {traitor ? (
                  <div className="relative mt-4 grid grid-cols-[50px_1fr_34px] items-center gap-3 border-y border-[rgba(151,92,74,0.34)] bg-[linear-gradient(180deg,rgba(11,14,12,0.34),rgba(17,10,9,0.48))] px-2 py-2">
                    <div className="relative grid h-[50px] w-[50px] place-items-center overflow-hidden rounded-full border border-[rgba(177,112,92,0.3)] bg-[radial-gradient(circle_at_50%_38%,rgba(119,50,51,0.16),rgba(11,12,12,0.76)_72%)]">
                      <OptimizedImage
                        src={traitor.portraitAsset}
                        locale={effectiveLocale}
                        alt={traitor.displayName}
                        className="h-[48px] w-[48px] object-contain"
                        draggable={false}
                      />
                    </div>
                    <div className="min-w-0">
                      <div
                        className="min-h-[18px] whitespace-normal pr-2 text-[11px] font-semibold leading-[1.08] tracking-[0.04em] text-[#f3e6c9]"
                        style={{ wordBreak: "break-word" }}
                      >
                        {resolveEndgameExplorerName(traitor, matchData)}
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#d9a27f]">
                        {result?.hauntTitle ?? t(endgameDossier.titleKey)}
                      </div>
                    </div>
                    <div className="grid place-items-center">
                      <div className="grid h-8 w-8 place-items-center rounded-full border border-[rgba(212,100,82,0.42)] bg-[radial-gradient(circle_at_35%_30%,rgba(214,112,87,0.14),rgba(36,12,11,0.8)_72%)] text-[16px] text-[#ea7659] shadow-[inset_0_0_0_1px_rgba(214,191,129,0.06)]">
                        ☠
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_38%,rgba(112,35,32,0.14),rgba(17,8,8,0.02)_64%,rgba(0,0,0,0)_72%)] px-4 py-2">
                  <div className="grid h-[76px] w-[76px] place-items-center rounded-full border border-[rgba(202,85,69,0.2)] text-[34px] font-bold text-[#d55c49] shadow-[inset_0_0_0_7px_rgba(213,92,73,0.05)]">
                    ☠
                  </div>
                  <div className="mt-3 text-[28px] font-bold tracking-[0.08em] text-[#eb7250]">
                    {antagonistTitle}
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden px-2 pb-2 pt-2">
                <div className="flex items-center gap-3 text-center">
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(221,183,116,0.34))]" />
                  <div className="text-[15px] font-semibold uppercase tracking-[0.22em] text-[#ddb774]">
                    {t("board.endgame.statsLabel")}
                  </div>
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(221,183,116,0.34),transparent)]" />
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                  <div className="border-r border-[rgba(76,60,39,0.44)] pr-2 last:border-r-0">
                    <Footprints size={28} className="mx-auto text-[#d0af6e]" />
                    <div className="mt-1 text-[34px] font-semibold text-[#f3e6c9]">
                      {roomsExploredCount}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#ddb774]">
                      {t("board.endgame.roomsStat")}
                    </div>
                  </div>
                  <div className="border-r border-[rgba(76,60,39,0.44)] px-2 last:border-r-0">
                    <BookOpen size={28} className="mx-auto text-[#c3a166]" />
                    <div className="mt-1 text-[34px] font-semibold text-[#f3e6c9]">
                      {omensDrawnCount}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#ddb774]">
                      {t("board.endgame.omensStat")}
                    </div>
                  </div>
                  <div className="px-2">
                    <Search size={28} className="mx-auto text-[#c3a166]" />
                    <div className="mt-1 text-[34px] font-semibold text-[#f3e6c9]">
                      {eventsDrawnCount}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#ddb774]">
                      {t("board.endgame.eventsStat")}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
      )}
    </div>
  );
}
