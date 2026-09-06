import { useTranslation } from "react-i18next";

import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import type { BetrayalRoomNode } from "./game";
import type { BetrayalHauntTokenInstanceSummary } from "./hauntTokenModel";

const ROOM_MARKER_ASSETS = {
  blessing: "betrayal/markers/blessing",
  obstacle: "betrayal/markers/obstacle",
  portal: "betrayal/markers/portal",
} as const;

export function BetrayalRoomMarkerLayerSurface({
  roomId,
  markerTokens,
  hauntTokens,
  locale,
}: {
  roomId: string;
  markerTokens: BetrayalRoomNode["markerTokens"];
  hauntTokens: readonly BetrayalHauntTokenInstanceSummary[];
  locale: string;
}) {
  const { t } = useTranslation("game-betrayal");
  const hasMarker = (marker: NonNullable<typeof markerTokens>[number]) =>
    Boolean(markerTokens?.includes(marker));

  return (
    <>
      {hasMarker("obstacle") ? (
        <span
          data-testid={`betrayal-room-marker-${roomId}-obstacle`}
          className="pointer-events-none absolute bottom-2 left-2 z-20 grid h-6 w-6 place-items-center rounded-[5px] border border-[#b8914f] bg-[rgba(20,14,9,0.84)] shadow-[0_0_12px_rgba(184,145,79,0.42)]"
          title={t("board.rooms.obstacle")}
        >
          <OptimizedImage
            src={ROOM_MARKER_ASSETS.obstacle}
            locale={locale}
            alt={t("board.rooms.obstacle")}
            className="h-5 w-5 object-contain"
            draggable={false}
          />
        </span>
      ) : null}
      {hasMarker("secretPassage") ? (
        <span
          data-testid={`betrayal-room-marker-${roomId}-secret-passage`}
          className="pointer-events-none absolute bottom-2 left-9 z-20 grid h-6 w-6 place-items-center rounded-[5px] border border-[#71b7aa] bg-[rgba(7,22,20,0.84)] shadow-[0_0_12px_rgba(113,183,170,0.42)]"
          title={t("board.rooms.secretPassage")}
        >
          <OptimizedImage
            src={ROOM_MARKER_ASSETS.portal}
            locale={locale}
            alt={t("board.rooms.secretPassage")}
            className="h-5 w-5 object-contain"
            draggable={false}
          />
        </span>
      ) : null}
      {hasMarker("blessing") ? (
        <span
          data-testid={`betrayal-room-marker-${roomId}-blessing`}
          className="pointer-events-none absolute bottom-2 left-16 z-20 grid h-6 w-6 place-items-center rounded-[5px] border border-[#d8cf78] bg-[rgba(28,25,9,0.84)] shadow-[0_0_12px_rgba(216,207,120,0.42)]"
          title={t("board.rooms.blessing")}
        >
          <OptimizedImage
            src={ROOM_MARKER_ASSETS.blessing}
            locale={locale}
            alt={t("board.rooms.blessing")}
            className="h-5 w-5 object-contain"
            draggable={false}
          />
        </span>
      ) : null}
      {hauntTokens.length > 0 ? (
        <div
          data-testid={`betrayal-room-haunt-token-layer-${roomId}`}
          className="pointer-events-none absolute bottom-2 right-2 z-20 flex max-w-[84px] flex-wrap justify-end gap-1"
        >
          {hauntTokens.map((token) => {
            const isMummySarcophagusToken = token.id === "mummy-sarcophagus";
            return (
              <span
                key={token.id}
                data-testid={`betrayal-room-haunt-token-${roomId}-${token.id}`}
                data-token-kind={token.kind}
                data-token-status={token.status ?? undefined}
                data-token-owner-player-id={token.ownerPlayerId ?? undefined}
                title={token.label}
                className={`grid h-7 min-w-7 place-items-center rounded-full border px-1 text-[10px] font-black leading-none ${
                  isMummySarcophagusToken
                    ? "border-[#c3b293] bg-[radial-gradient(circle_at_35%_28%,rgba(232,221,196,0.94),rgba(139,119,82,0.90)_52%,rgba(44,34,22,0.94))] text-[#1f1710] shadow-[0_0_0_1px_rgba(20,12,5,0.88),0_0_14px_rgba(195,178,147,0.44)]"
                    : "border-[#d8c477] bg-[radial-gradient(circle_at_35%_28%,rgba(255,249,190,0.95),rgba(177,142,68,0.92)_52%,rgba(53,37,18,0.94))] text-[#211407] shadow-[0_0_0_1px_rgba(20,12,5,0.88),0_0_14px_rgba(238,220,126,0.48)]"
                }`}
              >
                {isMummySarcophagusToken
                  ? t("board.hauntTokens.sarcophagusShort")
                  : t("board.hauntTokens.researchTokenShort")}
              </span>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
