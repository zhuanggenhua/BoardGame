import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { BetrayalRoomNode } from "./game";
import { FLOOR_TONE } from "./roomMapModel";

type BetrayalRoomFloor = BetrayalRoomNode["floor"];

export interface BetrayalRoomFloorSwitcherSurfaceProps {
  selectedFloor: BetrayalRoomFloor;
  upperFloor: BetrayalRoomFloor | null;
  lowerFloor: BetrayalRoomFloor | null;
  upperFloorHasSelectionTarget: boolean;
  lowerFloorHasSelectionTarget: boolean;
  hasCrossFloorMoveTargets: boolean;
  hasCrossFloorRoomSelectionTargets: boolean;
  hidden: boolean;
  isPhoneLandscapeLayout: boolean;
  onSelectFloor: (floor: BetrayalRoomFloor) => void;
}

export function BetrayalRoomFloorSwitcherSurface({
  selectedFloor,
  upperFloor,
  lowerFloor,
  upperFloorHasSelectionTarget,
  lowerFloorHasSelectionTarget,
  hasCrossFloorMoveTargets,
  hasCrossFloorRoomSelectionTargets,
  hidden,
  isPhoneLandscapeLayout,
  onSelectFloor,
}: BetrayalRoomFloorSwitcherSurfaceProps) {
  const { t } = useTranslation("game-betrayal");
  const selectedFloorTone = FLOOR_TONE[selectedFloor];
  const highlightSwitcher =
    hasCrossFloorMoveTargets || hasCrossFloorRoomSelectionTargets;

  return (
    <div
      data-testid="betrayal-room-floor-switcher"
      className={`pointer-events-auto absolute top-1/2 z-[60] w-[54px] -translate-y-1/2 flex-col items-center overflow-hidden rounded-[10px] border bg-[rgba(8,10,8,0.76)] text-[11px] font-semibold text-[#d6c498] shadow-[0_10px_24px_rgba(0,0,0,0.36)] backdrop-blur-sm ${
        isPhoneLandscapeLayout ? "right-3" : "right-[228px]"
      } ${hidden ? "hidden" : "flex"} ${
        highlightSwitcher
          ? "border-[#d1b05f] shadow-[0_0_26px_rgba(209,176,95,0.34),0_10px_24px_rgba(0,0,0,0.36)] ring-2 ring-[#d1b05f] ring-offset-2 ring-offset-[rgba(8,10,8,0.78)]"
          : "border-[rgba(211,179,109,0.30)]"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          if (upperFloor) {
            onSelectFloor(upperFloor);
          }
        }}
        data-testid="betrayal-room-floor-up"
        aria-label={t("board.status.floorUp")}
        disabled={!upperFloor}
        className={`grid h-8 w-full place-items-center border-b border-[rgba(211,179,109,0.20)] transition disabled:text-[#5d5744] disabled:hover:bg-transparent ${
          upperFloorHasSelectionTarget
            ? "bg-[rgba(209,176,95,0.22)] text-[#fff1b8] shadow-[inset_0_0_16px_rgba(209,176,95,0.36)] hover:bg-[rgba(209,176,95,0.32)]"
            : hasCrossFloorMoveTargets && upperFloor
              ? "bg-[rgba(34,197,94,0.22)] text-[#c5ffd1] shadow-[inset_0_0_16px_rgba(34,197,94,0.38)] hover:bg-[rgba(34,197,94,0.34)]"
              : "text-[#ecd294] hover:bg-[rgba(211,179,109,0.14)]"
        }`}
      >
        <ChevronUp size={16} strokeWidth={2.4} />
      </button>
      <div
        data-testid={`betrayal-room-floor-${selectedFloor}`}
        aria-pressed="true"
        className="grid min-h-[44px] w-full place-items-center px-1 py-1 text-center leading-tight text-[#fff1b8]"
        style={{
          boxShadow: `inset 0 0 18px ${selectedFloorTone.glow}`,
        }}
      >
        <span>{selectedFloorTone.label}</span>
      </div>
      <button
        type="button"
        onClick={() => {
          if (lowerFloor) {
            onSelectFloor(lowerFloor);
          }
        }}
        data-testid="betrayal-room-floor-down"
        aria-label={t("board.status.floorDown")}
        disabled={!lowerFloor}
        className={`grid h-8 w-full place-items-center border-t border-[rgba(211,179,109,0.20)] transition disabled:text-[#5d5744] disabled:hover:bg-transparent ${
          lowerFloorHasSelectionTarget
            ? "bg-[rgba(209,176,95,0.22)] text-[#fff1b8] shadow-[inset_0_0_16px_rgba(209,176,95,0.36)] hover:bg-[rgba(209,176,95,0.32)]"
            : hasCrossFloorMoveTargets && lowerFloor
              ? "bg-[rgba(34,197,94,0.22)] text-[#c5ffd1] shadow-[inset_0_0_16px_rgba(34,197,94,0.38)] hover:bg-[rgba(34,197,94,0.34)]"
              : "text-[#ecd294] hover:bg-[rgba(211,179,109,0.14)]"
        }`}
      >
        <ChevronDown size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
}
