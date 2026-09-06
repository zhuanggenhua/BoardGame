import React from "react";
import { ImageOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import { getEntityRelationHighlightTone, type EntityRelation } from "../../engine/primitives";
import type {
  BetrayalExplorerSummary,
  BetrayalMonsterStatusKind,
  BetrayalMonsterSummary,
} from "./game";
import type { BetrayalHauntTokenInstanceSummary } from "./hauntTokenModel";
import { inferMonsterDefinitionId } from "./monsterReadModel";

export function ExplorerFigureToken({
  explorer,
  locale,
  label,
  tone,
  size = "board",
  missingTokenLabel,
  testIdPrefix = "betrayal-explorer-figure-token",
  targetHighlight = false,
  targetHighlightSelected = false,
  targetHighlightTestId,
}: {
  explorer: BetrayalExplorerSummary;
  locale: string;
  label: string;
  tone: "self" | "ally";
  size?: "board" | "panel";
  missingTokenLabel: string;
  testIdPrefix?: string;
  targetHighlight?: boolean;
  targetHighlightSelected?: boolean;
  targetHighlightTestId?: string;
}) {
  const tokenAsset = explorer.tokenAsset;
  const hasOfficialToken = Boolean(explorer.tokenAsset);
  const outlineColor = targetHighlight
    ? targetHighlightSelected
      ? "#86efac"
      : "#22c55e"
    : tone === "self"
      ? "rgba(138,240,95,0.98)"
      : "rgba(245,204,72,0.98)";
  const outlineShadow = targetHighlight
    ? "none"
    : "drop-shadow(0 4px 8px rgba(0,0,0,0.32))";
  const tokenShape = "polygon(50% 0%, 96% 30%, 82% 100%, 18% 100%, 4% 30%)";
  const sizeClass =
    size === "panel"
        ? {
            root: "h-[38px] w-[36px]",
            outline: "h-[38px] w-[36px]",
            frame: "h-[31px] w-[30px]",
            targetOutline: "h-[31px] w-[30px]",
            officialImage: "h-full w-full scale-[1.16] object-cover",
            fallbackImage: "h-full w-full scale-[1.08] object-cover",
          }
        : {
            root: "h-[54px] w-[50px]",
            outline: "h-[54px] w-[50px]",
            frame: "h-[44px] w-[42px]",
            targetOutline: "h-[44px] w-[42px]",
            officialImage: "h-full w-full scale-[1.16] object-cover",
            fallbackImage: "h-full w-full scale-[1.08] object-cover",
          };

  return (
    <span
      className={`pointer-events-none relative inline-flex ${sizeClass.root} items-center justify-center`}
      data-testid={`${testIdPrefix}-${explorer.playerId}`}
      data-player-id={explorer.playerId}
      data-explorer-id={explorer.explorerId}
      data-explorer-name={explorer.displayName}
      data-token-asset={tokenAsset ?? undefined}
      data-token-state={hasOfficialToken ? "official" : "missing-official-token"}
      data-token-tone={tone}
      data-target-highlight={targetHighlight ? "true" : undefined}
      aria-label={
        hasOfficialToken ? label : `${label}：${missingTokenLabel}`
      }
      title={hasOfficialToken ? label : `${label}：${missingTokenLabel}`}
    >
      {targetHighlight ? (
        <svg
          className={`pointer-events-none absolute left-1/2 top-1/2 z-20 ${sizeClass.targetOutline} -translate-x-1/2 -translate-y-1/2 overflow-visible`}
          data-testid={
            targetHighlightTestId ?? `${testIdPrefix}-outline-${explorer.playerId}`
          }
          data-highlight-shape="pentagon"
          data-highlight-color="green"
          data-highlight-layer-count="1"
          data-highlight-style="solid"
          data-highlight-anchor="token-surface"
          data-selected={targetHighlightSelected ? "true" : "false"}
          aria-hidden="true"
          viewBox="0 0 100 108"
        >
          <polygon
            points="50,0 100,30 82,108 18,108 0,30"
            fill="none"
            stroke={outlineColor}
            strokeWidth="6"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <span
          className={`pointer-events-none absolute left-1/2 top-1/2 z-0 ${sizeClass.outline} -translate-x-1/2 -translate-y-1/2`}
          data-testid={`${testIdPrefix}-outline-${explorer.playerId}`}
          style={{
            clipPath: tokenShape,
            backgroundColor: outlineColor,
            filter: outlineShadow,
          }}
        />
      )}
      <span
        className={`pointer-events-none relative z-10 flex ${sizeClass.frame} items-center justify-center overflow-hidden bg-transparent`}
        data-testid={`${testIdPrefix}-surface-${explorer.playerId}`}
        style={{
          clipPath: tokenShape,
        }}
      >
        {hasOfficialToken && tokenAsset ? (
          <OptimizedImage
            src={tokenAsset}
            locale={locale}
            alt={label}
            className={`pointer-events-none ${sizeClass.officialImage}`}
            draggable={false}
          />
        ) : (
          <span
            data-testid={`${testIdPrefix}-missing-${explorer.playerId}`}
            className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-[rgba(28,21,17,0.96)] px-0.5 text-center text-[7px] font-black leading-[8px] text-[#f0c97b]"
          >
            <ImageOff size={size === "panel" ? 12 : 15} aria-hidden="true" />
            <span>{missingTokenLabel}</span>
          </span>
        )}
      </span>
    </span>
  );
}

export function MonsterBoardToken({
  monster,
  locale,
  t,
  quietFrame = false,
  status = "active",
  testIdPrefix = "betrayal-monster-board-token",
  targetHighlight = false,
  targetHighlightRole = "target",
  targetHighlightRelation,
  targetHighlightTestId,
}: {
  monster: BetrayalMonsterSummary;
  locale: string;
  t: ReturnType<typeof useTranslation>["t"];
  quietFrame?: boolean;
  status?: BetrayalMonsterStatusKind;
  testIdPrefix?: string;
  targetHighlight?: boolean;
  targetHighlightRole?: "target" | "source";
  targetHighlightRelation?: EntityRelation;
  targetHighlightTestId?: string;
}) {
  const tokenAsset = monster.tokenAsset ?? monster.portraitAsset;
  const hasOfficialToken = Boolean(monster.tokenAsset);
  const isMummyToken = inferMonsterDefinitionId(monster) === "mummy";
  const isStunned = status === "stunned";
  const tokenFrameSize = isMummyToken ? 50 : 52;
  const tokenSurfaceSize = 42;
  const tokenBackingSize = 46;
  const tokenRadius = isMummyToken ? tokenSurfaceSize / 2 : 6;
  const tokenBackingRadius = isMummyToken ? tokenBackingSize / 2 : 7;
  const highlightTone = getEntityRelationHighlightTone(targetHighlightRelation);
  const isHostileHighlight =
    targetHighlight && highlightTone === "hostile";
  const outlineColor = targetHighlight
    ? isHostileHighlight
      ? "rgba(218,74,57,0.98)"
      : "rgba(34,197,94,0.98)"
    : quietFrame
    ? "rgba(217,255,151,0.16)"
    : isStunned
      ? "rgba(148,158,160,0.78)"
      : "rgba(218,74,57,0.98)";
  const outlineShadow = targetHighlight
    ? "none"
    : quietFrame
    ? "drop-shadow(0 0 8px rgba(217,255,151,0.22))"
    : isStunned
      ? "drop-shadow(0 3px 8px rgba(0,0,0,0.32))"
      : "drop-shadow(0 5px 10px rgba(0,0,0,0.36))";

  return (
    <span
      className={`pointer-events-none relative inline-flex items-center justify-center transition ${
        isStunned ? "-rotate-12 opacity-80 grayscale" : ""
      }`}
      style={{ width: tokenFrameSize, height: tokenFrameSize }}
      data-testid={`${testIdPrefix}-${monster.id}`}
      data-monster-status={status}
      data-target-highlight={targetHighlight ? "true" : undefined}
      data-token-role={isMummyToken ? "mummy-map-token" : "monster-map-token"}
    >
      {targetHighlight ? (
        <svg
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 overflow-visible"
          style={{ width: tokenSurfaceSize, height: tokenSurfaceSize }}
          data-testid={
            targetHighlightTestId ?? `${testIdPrefix}-outline-${monster.id}`
          }
          data-highlight-shape="token"
          data-highlight-color={isHostileHighlight ? "red" : "green"}
          data-highlight-role={targetHighlightRole}
          data-entity-relation={targetHighlightRelation ?? undefined}
          data-highlight-layer-count="1"
          data-highlight-style="solid"
          data-highlight-anchor="token-surface"
          aria-hidden="true"
          viewBox={`0 0 ${tokenSurfaceSize} ${tokenSurfaceSize}`}
        >
          <rect
            x="0"
            y="0"
            width={tokenSurfaceSize}
            height={tokenSurfaceSize}
            rx={tokenRadius}
            fill="none"
            stroke={outlineColor}
            strokeWidth="4"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          data-testid={`${testIdPrefix}-outline-${monster.id}`}
          style={{
            width: tokenBackingSize,
            height: tokenBackingSize,
            borderRadius: tokenBackingRadius,
            backgroundColor: outlineColor,
            filter: outlineShadow,
          }}
        />
      )}
      <span
        className="pointer-events-none relative z-10 flex items-center justify-center overflow-hidden bg-[rgba(16,11,8,0.28)]"
        style={{
          width: tokenSurfaceSize,
          height: tokenSurfaceSize,
          borderRadius: tokenRadius,
        }}
        data-testid={`${testIdPrefix}-surface-${monster.id}`}
        data-token-surface-size={String(tokenSurfaceSize)}
      >
        <OptimizedImage
          src={tokenAsset}
          locale={locale}
          alt={monster.name}
          className={
            hasOfficialToken
              ? isMummyToken
                ? "pointer-events-none h-full w-full scale-100 object-contain brightness-125 contrast-125 saturate-110"
                : "pointer-events-none h-full w-full scale-[1.18] object-cover brightness-110 saturate-110"
              : "pointer-events-none h-full w-full scale-[1.08] object-cover brightness-125 saturate-125"
          }
          draggable={false}
        />
      </span>
      {isStunned ? (
        <span
          className="pointer-events-none absolute -bottom-1 left-1/2 z-20 -translate-x-1/2 rounded-[4px] border border-[rgba(212,224,221,0.62)] bg-[rgba(9,14,14,0.94)] px-1.5 py-0.5 text-[8px] font-black leading-none tracking-[0.08em] text-[#dce7e2] shadow-[0_3px_8px_rgba(0,0,0,0.38)]"
          data-testid={`betrayal-monster-board-token-status-${monster.id}`}
        >
          {t("board.monster.status.stunned")}
        </span>
      ) : null}
    </span>
  );
}

export function GirlBoardToken({
  token,
  t,
  attachedTo,
  interactive = false,
  onClick,
  testIdPrefix = "betrayal-room-haunt-token",
}: {
  token: BetrayalHauntTokenInstanceSummary;
  t: ReturnType<typeof useTranslation>["t"];
  attachedTo: "room" | "explorer" | "mummy";
  interactive?: boolean;
  onClick?: () => void;
  testIdPrefix?: string;
}) {
  const { i18n } = useTranslation("game-betrayal");
  const status = token.status ?? "placed";
  const tokenAsset = token.asset;
  const effectiveLocale = i18n.language || "zh-CN";
  const ownerLabel =
    status === "held-by-mummy"
      ? t("board.hauntTokens.girlHeldByMummy")
      : status === "held-by-player" && token.ownerName
        ? t("board.hauntTokens.girlHeldByPlayer", {
            player: token.ownerName,
          })
        : t("board.hauntTokens.girlPlaced");
  const label = `${t("board.hauntTokens.girl")}，${ownerLabel}`;
  const unitTestId =
    testIdPrefix === "betrayal-room-haunt-token"
      ? `betrayal-girl-svg-token-${token.roomId ?? "unknown"}`
      : `${testIdPrefix}-girl-svg-${token.roomId ?? "unknown"}`;
  const isMummyAttachment = attachedTo === "mummy";
  const tokenSizePx = 54;
  const unit = (
    <span
      className={`pointer-events-none block overflow-hidden rounded-full border-[2px] border-[rgba(81,43,21,0.84)] bg-[radial-gradient(circle_at_38%_28%,rgba(255,250,225,0.98),rgba(235,202,150,0.96)_58%,rgba(137,81,46,0.96))] ${isMummyAttachment ? "p-[4px] shadow-[0_0_0_1px_rgba(255,238,196,0.82),0_0_10px_rgba(255,216,154,0.42)]" : "p-[4px] shadow-[0_0_0_1px_rgba(255,238,196,0.88),0_0_15px_rgba(255,216,154,0.54)]"}`}
      style={{ width: tokenSizePx, height: tokenSizePx }}
      data-testid={unitTestId}
      data-token-attachment={attachedTo}
      data-token-asset={tokenAsset ?? undefined}
      data-token-visual-size={String(tokenSizePx)}
      data-token-visual-tone="parchment-figure"
      aria-hidden="true"
    >
      {tokenAsset ? (
        <OptimizedImage
          src={tokenAsset}
          locale={effectiveLocale}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full scale-[1.34] object-contain brightness-0 contrast-150"
        />
      ) : (
        <svg
          viewBox="0 0 48 48"
          className="h-full w-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M14 18.5c0-6.2 4.3-10.5 10-10.5s10 4.3 10 10.5c0 2.4-.7 4.7-2.1 6.5H16.1A11.5 11.5 0 0 1 14 18.5Z"
            fill="#4a122f"
            stroke="#ffd8ef"
            strokeWidth="1.5"
          />
          <circle cx="24" cy="20" r="6.7" fill="#ffe1ef" stroke="#4a122f" strokeWidth="1.4" />
          <path
            d="M18.5 29.2c1.6-2.2 3.4-3.1 5.5-3.1s3.9.9 5.5 3.1l4.2 10.3H14.3l4.2-10.3Z"
            fill="#f5a6d4"
            stroke="#4a122f"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M17.8 30.2 13.5 35M30.2 30.2l4.3 4.8" stroke="#ffe1ef" strokeWidth="2" strokeLinecap="round" />
          <circle cx="21.8" cy="19.7" r="0.8" fill="#4a122f" />
          <circle cx="26.2" cy="19.7" r="0.8" fill="#4a122f" />
          <path d="M22 23.2c1.2.8 2.8.8 4 0" stroke="#a73570" strokeWidth="1" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );

  if (interactive) {
    return (
      <button
        type="button"
        data-testid={`${testIdPrefix}-${token.roomId ?? "unknown"}-${token.id}`}
        data-token-kind={token.kind}
        data-token-status={status}
        data-token-placement={attachedTo}
        data-token-owner-player-id={token.ownerPlayerId ?? undefined}
        data-token-owner-monster-id={
          attachedTo === "mummy" ? "mummy" : undefined
        }
        data-direct-target="true"
        aria-label={label}
        title={label}
        className="pointer-events-auto relative inline-flex min-h-[64px] min-w-[64px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 outline-none transition hover:drop-shadow-[0_0_18px_rgba(255,139,209,0.68)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe8f5]"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.();
        }}
      >
        {unit}
      </button>
    );
  }

  return (
    <span
      data-testid={`${testIdPrefix}-${token.roomId ?? "unknown"}-${token.id}`}
      data-token-kind={token.kind}
      data-token-status={status}
      data-token-placement={attachedTo}
      data-token-owner-player-id={token.ownerPlayerId ?? undefined}
      data-token-owner-monster-id={
        attachedTo === "mummy" ? "mummy" : undefined
      }
      aria-label={label}
      title={label}
      className="pointer-events-none relative inline-flex items-center justify-center"
    >
      {unit}
    </span>
  );
}
