import React from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HudPortal, UI_Z_INDEX } from "../../core";
import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import type {
  BetrayalExplorerSummary,
  BetrayalMonsterStatusSummary,
  BetrayalMonsterSummary,
  BetrayalTraitKey,
} from "./game";
import { ExplorerFigureToken } from "./entityTokenSurface";
import {
  ExplorerTraitTrackRail,
  TRAIT_LABEL_LOCAL,
  TRAIT_VALUE_TEXT_CLASS,
} from "./traitTrackSurface";

const MONSTER_DETAIL_TRAIT_ORDER: readonly BetrayalTraitKey[] = [
  "might",
  "speed",
  "sanity",
  "knowledge",
];

function resolveMonsterTraitValue(
  monster: BetrayalMonsterSummary,
  trait: BetrayalTraitKey,
): number | null {
  if (trait === "might") return monster.might;
  if (trait === "speed") return monster.speed;
  if (trait === "sanity") return monster.sanity ?? null;
  return monster.knowledge ?? null;
}

export function formatMonsterTraitSummary(monster: BetrayalMonsterSummary): string {
  return MONSTER_DETAIL_TRAIT_ORDER.map((trait) => {
    const value = resolveMonsterTraitValue(monster, trait);
    return value === null ? null : `${TRAIT_LABEL_LOCAL[trait]} ${value}`;
  })
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

function isMummyMonsterSummary(monster: BetrayalMonsterSummary): boolean {
  return monster.definitionId === "mummy" || monster.id === "mummy";
}

function resolveMonsterDetailRuleNotes(
  monster: BetrayalMonsterSummary,
  status: BetrayalMonsterStatusSummary | null,
  t: ReturnType<typeof useTranslation>["t"],
): string[] {
  if (isMummyMonsterSummary(monster)) {
    return [
      t("board.monster.mummyRules.traits"),
      t("board.monster.mummyRules.attack"),
      t("board.monster.mummyRules.movement"),
      t("board.monster.mummyRules.steal"),
      t("board.monster.mummyRules.victory"),
    ];
  }
  return status?.ruleNotes ?? [];
}

export function MonsterDetailsDialog({
  monster,
  status,
  locale,
  roomName,
  onClose,
}: {
  monster: BetrayalMonsterSummary;
  status: BetrayalMonsterStatusSummary | null;
  locale: string;
  roomName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("game-betrayal");
  const detailsLabel = t("board.monster.detailsAria", {
    monster: monster.name,
  });
  const ruleNotes = resolveMonsterDetailRuleNotes(monster, status, t);
  const defaultAttackTrait = status?.defaultAttackTrait ?? "might";
  const traitEntries = MONSTER_DETAIL_TRAIT_ORDER.map((trait) => ({
    trait,
    value: resolveMonsterTraitValue(monster, trait),
  })).filter((entry): entry is { trait: BetrayalTraitKey; value: number } =>
    entry.value !== null,
  );

  return (
    <HudPortal>
      <div
        data-testid="betrayal-monster-detail-overlay"
        className="fixed inset-0 flex items-center justify-center bg-[rgba(9,8,6,0.42)] px-4 py-6 text-[#f4ead4] backdrop-blur-[1.5px]"
        style={{ zIndex: UI_Z_INDEX.modalOverlay }}
        onClick={onClose}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label={detailsLabel}
          data-testid="betrayal-monster-detail-dialog"
          data-monster-id={monster.id}
          data-monster-definition-id={monster.definitionId ?? ""}
          data-portrait-asset={monster.portraitAsset}
          data-layout-variant="open-single-portrait"
          className="relative w-[min(92vw,640px)] max-h-[min(86vh,680px)] overflow-visible rounded-[20px] border border-[rgba(246,222,160,0.36)] bg-[linear-gradient(135deg,rgba(119,96,58,0.34),rgba(37,39,32,0.34))] p-0 shadow-[0_20px_48px_rgba(0,0,0,0.38)] backdrop-blur-md"
          style={{ zIndex: UI_Z_INDEX.modalContent }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            data-testid="betrayal-monster-detail-close"
            aria-label={t("board.monster.closeDetails")}
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-[9px] border border-[rgba(244,219,151,0.34)] bg-[rgba(37,29,20,0.68)] text-[#f6df9a] shadow-[0_8px_18px_rgba(0,0,0,0.28)] transition hover:border-[rgba(255,236,177,0.70)] hover:bg-[rgba(61,45,27,0.82)] hover:text-[#fff1bd]"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
          <div className="min-w-0 overflow-y-auto px-4 py-4 pr-5">
            <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-4 pr-10">
              <div className="relative h-[104px] w-[104px] overflow-hidden rounded-[16px] border border-[rgba(246,222,160,0.42)] bg-[radial-gradient(circle_at_50%_35%,rgba(248,221,143,0.28),rgba(60,48,29,0.20)_58%,rgba(16,16,12,0.32))] shadow-[inset_0_0_0_1px_rgba(255,247,220,0.12),0_12px_24px_rgba(0,0,0,0.30)]">
                <OptimizedImage
                  src={monster.portraitAsset}
                  locale={locale}
                  alt={t("board.monster.portraitAlt", { monster: monster.name })}
                  data-testid="betrayal-monster-detail-portrait"
                  className="h-full w-full -translate-y-[5px] scale-[1.42] object-cover object-center drop-shadow-[0_10px_16px_rgba(0,0,0,0.32)]"
                  draggable={false}
                />
              </div>
              <div className="min-w-0 self-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d5b779]">
                  {t("board.monster.detailsTitle")}
                </div>
                <h2
                  className="mt-1 truncate text-[25px] font-semibold tracking-[0.04em] text-[#fff2c2]"
                  data-testid="betrayal-monster-detail-name"
                >
                  {monster.name}
                </h2>
                <div
                  className="mt-1 truncate text-[13px] text-[#d6c397]"
                  data-testid="betrayal-monster-detail-room"
                >
                  {t("board.monster.location", { room: roomName })}
                </div>
              </div>
            </div>

            <div
              className="mt-4 flex flex-wrap gap-2 border-y border-[rgba(246,222,160,0.14)] py-3"
              data-testid="betrayal-monster-detail-traits"
            >
              {traitEntries.map(({ trait, value }) => (
                <div
                  key={`${monster.id}-detail-${trait}`}
                  data-testid={`betrayal-monster-detail-trait-${trait}`}
                  className="inline-flex min-w-[94px] items-center justify-between gap-3 rounded-full border border-[rgba(244,219,151,0.30)] bg-[rgba(255,242,201,0.13)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#bfae87]">
                    {TRAIT_LABEL_LOCAL[trait]}
                  </div>
                  <div
                    className={`text-[23px] font-black leading-none ${TRAIT_VALUE_TEXT_CLASS[trait]}`}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="mt-3 rounded-[12px] border border-[rgba(244,219,151,0.18)] border-l-[4px] border-l-[rgba(230,187,87,0.78)] bg-[rgba(255,247,220,0.07)] px-3 py-3"
              data-testid="betrayal-monster-detail-attack"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e3ca89]">
                {t("board.monster.attack")}
              </div>
              <div className="mt-1 text-[14px] leading-6 text-[#f0e8c9]">
                {t("board.monster.defaultAttack", {
                  trait: TRAIT_LABEL_LOCAL[defaultAttackTrait],
                })}
                <span className="mx-2 text-[#a68d58]">/</span>
                {t("board.monster.damage", { value: monster.damage })}
              </div>
            </div>

            <div
              className="mt-3 rounded-[12px] border border-[rgba(244,219,151,0.18)] bg-[rgba(255,247,220,0.06)] px-3 py-3"
              data-testid="betrayal-monster-detail-rules"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e3ca89]">
                {t("board.monster.rules")}
              </div>
              <ul className="mt-2 space-y-2 text-[13px] leading-5 text-[#f4e9cb]">
                {ruleNotes.map((note) => (
                  <li key={note} className="flex gap-2">
                    <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#e3ca89]" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </HudPortal>
  );
}

export function ExplorerDetailsDialog({
  explorer,
  locale,
  playerName,
  roomName,
  abilityName,
  abilityText,
  onClose,
}: {
  explorer: BetrayalExplorerSummary;
  locale: string;
  playerName: string;
  roomName: string;
  abilityName: string;
  abilityText: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("game-betrayal");
  const tokenAsset = explorer.tokenAsset;
  const detailsLabel = t("board.players.detailsAria", { player: playerName });

  return (
    <HudPortal>
      <div
        data-testid="betrayal-explorer-detail-overlay"
        className="fixed inset-0 flex items-center justify-center bg-[rgba(2,6,5,0.62)] px-4 py-6 text-[#f1e8d4] backdrop-blur-[2px]"
        style={{ zIndex: UI_Z_INDEX.modalOverlay }}
        onClick={onClose}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label={detailsLabel}
          data-testid={`betrayal-explorer-detail-dialog-${explorer.playerId}`}
          data-player-id={explorer.playerId}
          data-explorer-id={explorer.explorerId}
          data-token-asset={tokenAsset}
          className="relative grid w-[min(92vw,720px)] max-h-[min(86vh,680px)] grid-cols-[minmax(170px,230px)_minmax(0,1fr)] gap-4 overflow-hidden rounded-[14px] border border-[rgba(214,191,129,0.42)] bg-[linear-gradient(180deg,rgba(18,22,18,0.98),rgba(7,11,10,0.98))] p-4 shadow-[0_26px_70px_rgba(0,0,0,0.58)]"
          style={{ zIndex: UI_Z_INDEX.modalContent }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            data-testid="betrayal-explorer-detail-close"
            aria-label={t("board.players.closeDetails")}
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-[8px] border border-[rgba(214,191,129,0.30)] bg-[rgba(18,15,12,0.86)] text-[#e8d6a5] transition hover:border-[rgba(245,218,150,0.62)] hover:text-[#fff1bd]"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
          <div className="relative overflow-hidden rounded-[10px] border border-[rgba(110,91,57,0.48)] bg-[rgba(8,12,10,0.74)] px-3 pb-4 pt-5">
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,191,129,0.30),transparent)]" />
            <OptimizedImage
              src={explorer.portraitAsset}
              locale={locale}
              alt={explorer.displayName}
              className="mx-auto h-[220px] w-full object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.42)]"
              draggable={false}
            />
            <div className="-mt-2 flex justify-center">
              <ExplorerFigureToken
                explorer={explorer}
                locale={locale}
                label={playerName}
                tone="ally"
                size="panel"
                missingTokenLabel={t("board.hauntTokens.officialTokenMissing")}
                testIdPrefix="betrayal-explorer-detail-token"
              />
            </div>
          </div>
          <div className="min-w-0 overflow-y-auto pr-1">
            <div className="pr-10">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c4a265]">
                {t("board.players.detailsTitle")}
              </div>
              <h2 className="mt-1 truncate text-[24px] font-semibold tracking-[0.04em] text-[#fff1bf]">
                {playerName}
              </h2>
              <div className="mt-1 truncate text-[13px] text-[#c9b58b]">
                {explorer.displayName} · {roomName}
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {(
                ["might", "speed", "knowledge", "sanity"] as BetrayalTraitKey[]
              ).map((trait) => (
                <div
                  key={`${explorer.playerId}-detail-${trait}`}
                  className="rounded-[8px] border border-[rgba(111,89,51,0.46)] bg-[rgba(19,17,13,0.74)] px-2.5 py-2"
                >
                  <ExplorerTraitTrackRail
                    explorer={explorer}
                    trait={trait}
                    locale={locale}
                    density="detail"
                    testIdPrefix={`betrayal-explorer-detail-trait-track-${explorer.playerId}`}
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[10px] border border-[rgba(111,89,51,0.42)] bg-[rgba(11,15,13,0.72)] px-3 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d8bf81]">
                {t("board.players.ability")}
              </div>
              <div className="mt-1 text-[14px] leading-6 text-[#dbe6b7]">
                <span className="font-semibold text-[#fff1bf]">
                  {abilityName}
                </span>
                <span className="text-[#b7c99e]">
                  {t("board.players.detailSeparator")}
                  {abilityText}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-[10px] border border-[rgba(111,89,51,0.42)] bg-[rgba(11,15,13,0.72)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d8bf81]">
                  {t("board.players.inventory")}
                </div>
                <div className="rounded-[5px] border border-[rgba(214,191,129,0.22)] bg-[rgba(214,191,129,0.08)] px-2 py-0.5 text-[12px] font-semibold text-[#ead8a8]">
                  {explorer.inventory.length}
                </div>
              </div>
              {explorer.inventory.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {explorer.inventory.map((card) => (
                    <span
                      key={card.id}
                      className="rounded-[5px] border border-[rgba(214,191,129,0.18)] bg-[rgba(22,18,13,0.78)] px-2 py-1 text-[12px] text-[#efe2c4]"
                    >
                      {card.name}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-[12px] text-[#9e9174]">
                  {t("board.players.emptyInventory")}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </HudPortal>
  );
}
