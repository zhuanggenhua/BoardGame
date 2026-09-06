import React from "react";
import { House, RotateCcw, RotateCw, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  BetrayalRoomEdge,
  BetrayalRoomPlacementPreview,
  BetrayalRoomTileAdjustmentOption,
} from "./game";
import { BetrayalConfirmButton } from "./confirmButtonSurface";
import {
  ROOM_ORIENTATION_DEGREES,
  resolveFloorLabel,
  resolveOppositeRoomEdge,
  roomTileAdjustmentSelectionsMatch,
  type RoomOrientationTurns,
} from "./roomMapModel";
import { resolveRoomEdgeMarkerClass } from "./roomPresentation";
import type { BetrayalRoomTileVisual } from "./roomAtlas";
import { RoomTileSprite } from "./roomTileSurface";

type RoomPlacementOrientationOption =
  BetrayalRoomPlacementPreview["orientationOptions"][number];

export function BetrayalRoomPlacementFailureBanner({
  text,
}: {
  text: string;
}) {
  return (
    <div
      data-testid="betrayal-room-placement-failure"
      className="pointer-events-auto absolute top-3 z-[70] flex min-h-[54px] items-center gap-2 rounded-[10px] border border-[rgba(238,204,126,0.42)] bg-[rgba(10,12,10,0.88)] px-3 py-2 text-[#ead7a5] shadow-[0_14px_34px_rgba(0,0,0,0.44),0_0_20px_rgba(238,204,126,0.16)] backdrop-blur-md"
      style={{
        left: "clamp(1rem, 20vw, 20rem)",
        width: "min(300px, 76vw)",
      }}
      aria-live="polite"
    >
      <Search size={15} className="shrink-0 text-[#f5d98d]" />
      <div className="min-w-0 text-[12px] font-black leading-snug text-[#f2dfaa]">
        {text}
      </div>
    </div>
  );
}

export interface BetrayalRoomPlacementSurfaceProps {
  preview: BetrayalRoomPlacementPreview;
  selectedOrientationOption: RoomPlacementOrientationOption;
  selectedOrientationTurns: RoomOrientationTurns;
  visual: BetrayalRoomTileVisual;
  adjustmentText: string | null;
  tileAdjustmentOptions: BetrayalRoomTileAdjustmentOption[];
  selectedTileAdjustmentOption: BetrayalRoomTileAdjustmentOption | null;
  locale: string;
  onRotate: (direction: 1 | -1) => void;
  onCancel: () => void;
  onConfirm: () => void;
  onSelectTileAdjustment: (option: BetrayalRoomTileAdjustmentOption) => void;
}

function resolveRoomEdgeLabel(
  edge: BetrayalRoomEdge,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  return t(`board.rooms.edges.${edge}`);
}

export function BetrayalRoomPlacementSurface({
  preview,
  selectedOrientationOption,
  selectedOrientationTurns,
  visual,
  adjustmentText,
  tileAdjustmentOptions,
  selectedTileAdjustmentOption,
  locale,
  onRotate,
  onCancel,
  onConfirm,
  onSelectTileAdjustment,
}: BetrayalRoomPlacementSurfaceProps) {
  const { t } = useTranslation("game-betrayal");
  const connectingEdge = resolveOppositeRoomEdge(preview.entryEdge);
  const orientationDegrees = ROOM_ORIENTATION_DEGREES[selectedOrientationTurns];
  const buriedRoomNames = preview.buriedRoomNames ?? [];
  const buriedRoomSeparator = locale.startsWith("zh") ? "、" : ", ";
  const requiresRoomTileAdjustment = preview.requiresTileAdjustment;
  const canRotate = preview.orientationOptions.length >= 2;

  return (
    <div
      data-testid="betrayal-room-placement-panel"
      data-room-placement-slot={preview.slotId}
      data-room-orientation-turns={selectedOrientationTurns}
      data-room-entry-edge={connectingEdge}
      className="pointer-events-auto absolute top-3 z-[70] rounded-[10px] border border-[rgba(238,204,126,0.50)] bg-[rgba(10,12,10,0.88)] p-3 text-[#ead7a5] shadow-[0_14px_34px_rgba(0,0,0,0.44),0_0_24px_rgba(238,204,126,0.20)] backdrop-blur-md"
      style={{
        left: "clamp(1rem, 20vw, 20rem)",
        width: "min(300px, 76vw)",
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#cdb16f]">
            <House size={12} aria-hidden="true" />
            {t("board.rooms.placementTitle")}
          </div>
          <h3 className="mt-0.5 truncate text-[15px] font-black leading-tight text-[#fff1b8]">
            {preview.room.name}
          </h3>
        </div>
        <span className="shrink-0 rounded-[4px] border border-[rgba(238,204,126,0.34)] bg-[rgba(238,204,126,0.12)] px-2 py-1 text-[10px] font-black text-[#f5d98d]">
          {t(`board.rooms.rewards.${preview.deckKind ?? "none"}`)}
        </span>
      </div>
      <div className="mt-3 flex gap-3">
        <div
          data-testid="betrayal-room-placement-preview"
          className="relative h-[104px] w-[104px] shrink-0 rounded-[8px] border border-[rgba(238,204,126,0.35)] bg-[rgba(0,0,0,0.28)] p-2 shadow-[inset_0_0_18px_rgba(0,0,0,0.36)]"
        >
          <div
            className="absolute inset-2 origin-center transition-transform duration-200 ease-out"
            style={{
              transform: `rotate(${orientationDegrees}deg)`,
            }}
          >
            <RoomTileSprite
              visual={visual}
              locale={locale}
              alt={preview.room.name}
              className="h-full w-full rounded-[5px] bg-[#15110d] opacity-95"
            />
          </div>
          {selectedOrientationOption.doorways.map((doorway, doorwayIndex) => {
            const isConnectingDoor = doorway.edge === connectingEdge;
            return (
              <span
                key={`${doorway.edge}-${doorwayIndex}`}
                data-testid={`betrayal-room-placement-door-${doorway.edge}-${doorwayIndex}`}
                data-connecting-door={isConnectingDoor ? "true" : undefined}
                aria-hidden="true"
                className={`pointer-events-none absolute z-20 grid h-4 w-4 place-items-center rounded-full border text-[8px] font-black leading-none ${
                  resolveRoomEdgeMarkerClass(doorway.edge)
                } ${
                  isConnectingDoor
                    ? "border-[#fff1b8] bg-[#f4cf77] text-[#1e1609] shadow-[0_0_14px_rgba(244,207,119,0.86)]"
                    : "border-[rgba(238,204,126,0.74)] bg-[rgba(21,15,8,0.86)] text-[#f4cf77]"
                }`}
              >
                {isConnectingDoor ? "•" : ""}
              </span>
            );
          })}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9f8d68]">
            {t("board.rooms.placementSubtitle")}
          </div>
          <div
            data-testid="betrayal-room-placement-entry-label"
            className="mt-1 text-[12px] font-bold leading-snug text-[#f2dfaa]"
          >
            {t("board.rooms.entryDoor")}: {resolveFloorLabel(preview.floor)}
            {" · "}
            {resolveRoomEdgeLabel(connectingEdge, t)}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-[#bda773]">
            {t("board.rooms.orientation", {
              degrees: orientationDegrees,
            })}
          </div>
          {buriedRoomNames.length > 0 ? (
            <div
              data-testid="betrayal-room-placement-buried-rooms"
              className="mt-2 rounded-[6px] border border-[rgba(177,128,76,0.34)] bg-[rgba(92,54,27,0.32)] px-2 py-1.5 text-[11px] font-bold leading-snug text-[#e7bd83]"
            >
              {t("board.rooms.buriedRooms", {
                rooms: buriedRoomNames.join(buriedRoomSeparator),
              })}
            </div>
          ) : null}
          {adjustmentText ? (
            <div
              data-testid="betrayal-room-placement-adjustment-required"
              className="mt-2 rounded-[6px] border border-[rgba(238,204,126,0.38)] bg-[rgba(96,78,34,0.34)] px-2 py-1.5 text-[11px] font-bold leading-snug text-[#f2dfaa]"
            >
              {adjustmentText}
            </div>
          ) : null}
          {requiresRoomTileAdjustment ? (
            <div
              data-testid="betrayal-room-tile-adjustment-options"
              className="mt-2 rounded-[7px] border border-[rgba(238,204,126,0.28)] bg-[rgba(14,12,8,0.42)] p-2"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#cdb16f]">
                {t("board.rooms.adjustmentOptionsTitle")}
              </div>
              {tileAdjustmentOptions.length > 0 ? (
                <div className="mt-1.5 grid gap-1.5">
                  {tileAdjustmentOptions.map((option) => {
                    const isSelected = selectedTileAdjustmentOption
                      ? roomTileAdjustmentSelectionsMatch(
                          option,
                          selectedTileAdjustmentOption,
                        )
                      : false;
                    const entryEdgeLabel = resolveRoomEdgeLabel(
                      option.entryEdge,
                      t,
                    );
                    return (
                      <button
                        key={`${option.roomId}-${option.x}-${option.y}-${option.entryRoomId}-${option.entryEdge}-${option.orientationTurns}`}
                        type="button"
                        data-testid="betrayal-room-tile-adjustment-option"
                        data-room-id={option.roomId}
                        data-entry-room-id={option.entryRoomId}
                        data-selected={isSelected ? "true" : "false"}
                        aria-pressed={isSelected}
                        onClick={() => onSelectTileAdjustment(option)}
                        className={`min-h-[42px] rounded-[6px] border px-2 py-1.5 text-left transition ${
                          isSelected
                            ? "border-[#f4cf77] bg-[rgba(244,207,119,0.24)] text-[#fff1b8] shadow-[0_0_14px_rgba(244,207,119,0.24)]"
                            : "border-[rgba(238,204,126,0.24)] bg-[rgba(255,255,255,0.045)] text-[#ead7a5] hover:border-[rgba(238,204,126,0.42)] hover:bg-[rgba(238,204,126,0.10)]"
                        }`}
                      >
                        <span className="block text-[11px] font-black leading-tight">
                          {t("board.rooms.adjustmentOption", {
                            room: option.roomName,
                            entryRoom: option.entryRoomName,
                            edge: entryEdgeLabel,
                          })}
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2 text-[10px] font-bold text-[#bda773]">
                          <span>
                            {t("board.rooms.adjustmentOpenDoorways", {
                              count: option.openDoorwayCount,
                            })}
                          </span>
                          {isSelected ? (
                            <span className="text-[#f4cf77]">
                              {t("board.rooms.adjustmentSelected")}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div
                  data-testid="betrayal-room-tile-adjustment-no-options"
                  className="mt-1.5 rounded-[6px] border border-[rgba(238,204,126,0.18)] bg-[rgba(0,0,0,0.18)] px-2 py-1.5 text-[11px] font-bold text-[#bda773]"
                >
                  {t("board.rooms.adjustmentNoOptions")}
                </div>
              )}
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="betrayal-room-placement-rotate-left"
              onClick={() => onRotate(-1)}
              disabled={!canRotate}
              className="grid min-h-[36px] place-items-center rounded-[6px] border border-[rgba(238,204,126,0.34)] bg-[rgba(238,204,126,0.10)] text-[#f5d98d] transition hover:bg-[rgba(238,204,126,0.18)] disabled:opacity-45 disabled:hover:bg-[rgba(238,204,126,0.10)]"
              aria-label={t("board.rooms.rotateLeft")}
              title={t("board.rooms.rotateLeft")}
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="betrayal-room-placement-rotate-right"
              data-tutorial-id="betrayal-room-placement-rotate-right"
              onClick={() => onRotate(1)}
              disabled={!canRotate}
              className="grid min-h-[36px] place-items-center rounded-[6px] border border-[rgba(238,204,126,0.34)] bg-[rgba(238,204,126,0.10)] text-[#f5d98d] transition hover:bg-[rgba(238,204,126,0.18)] disabled:opacity-45 disabled:hover:bg-[rgba(238,204,126,0.10)]"
              aria-label={t("board.rooms.rotateRight")}
              title={t("board.rooms.rotateRight")}
            >
              <RotateCw size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_1.4fr] gap-2">
        <button
          type="button"
          data-testid="betrayal-room-placement-cancel"
          onClick={onCancel}
          className="min-h-[38px] rounded-[7px] border border-[rgba(238,204,126,0.26)] bg-[rgba(255,255,255,0.04)] px-2 text-[12px] font-black text-[#d7c08b] transition hover:bg-[rgba(255,255,255,0.08)]"
        >
          {t("board.rooms.cancelPlacement")}
        </button>
        <BetrayalConfirmButton
          type="button"
          data-testid="betrayal-room-placement-confirm"
          data-tutorial-id="betrayal-room-placement-confirm"
          onClick={onConfirm}
          disabled={requiresRoomTileAdjustment && !selectedTileAdjustmentOption}
          title={
            requiresRoomTileAdjustment && !selectedTileAdjustmentOption
              ? adjustmentText ?? undefined
              : undefined
          }
          className="min-h-[38px] px-2 shadow-[0_6px_14px_rgba(0,0,0,0.28),inset_0_-2px_0_rgba(60,38,12,0.24)] disabled:shadow-none"
        >
          {t("board.rooms.confirmPlacement")}
        </BetrayalConfirmButton>
      </div>
    </div>
  );
}
