import React from "react";
import { useTranslation } from "react-i18next";

import { MagnifyOverlay } from "../../components/common/overlays/MagnifyOverlay";
import { useRuntimeViewport } from "../../hooks/ui/useRuntimeViewport";
import type { BetrayalInventoryCard, BetrayalRoomNode } from "./game";
import {
  BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO,
} from "./possessionAtlas";
import type { BetrayalRoomTileVisual } from "./roomAtlas";
import { RoomTileSprite } from "./roomTileSurface";
import { BetrayalInventoryCardSurface } from "./inventoryCardSurface";
import type {
  BetrayalTraitAssetMap,
  InventoryCardBackAssetMap,
} from "./inventoryPresentation";

const INVENTORY_PREVIEW_MAX_WIDTH = 360;
const INVENTORY_PREVIEW_VIEWPORT_WIDTH_RATIO = 0.84;
const INVENTORY_PREVIEW_VERTICAL_GUTTER = 80;

type BetrayalPreviewOverlaySurfaceProps = {
  previewRoom: BetrayalRoomNode | null;
  previewRoomVisual: BetrayalRoomTileVisual | null;
  previewInventoryCard: BetrayalInventoryCard | null;
  deckAssets: InventoryCardBackAssetMap;
  traitAssets: BetrayalTraitAssetMap;
  locale: string;
  onCloseRoomPreview: () => void;
  onCloseInventoryPreview: () => void;
};

function useInventoryPreviewFrameWidth() {
  const runtimeViewport = useRuntimeViewport({ syncCssVars: false });

  return React.useMemo(() => {
    if (runtimeViewport.width <= 0 || runtimeViewport.height <= 0) {
      return `min(84vw, ${INVENTORY_PREVIEW_MAX_WIDTH}px)`;
    }

    const availableWidth = Math.max(
      0,
      runtimeViewport.width -
        runtimeViewport.safeArea.left -
        runtimeViewport.safeArea.right,
    );
    const availableHeight = Math.max(
      0,
      runtimeViewport.height -
        runtimeViewport.safeArea.top -
        runtimeViewport.safeArea.bottom -
        INVENTORY_PREVIEW_VERTICAL_GUTTER,
    );
    const width = Math.min(
      INVENTORY_PREVIEW_MAX_WIDTH,
      availableWidth * INVENTORY_PREVIEW_VIEWPORT_WIDTH_RATIO,
      availableHeight * BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO,
    );

    return `${Math.max(96, width).toFixed(3)}px`;
  }, [
    runtimeViewport.height,
    runtimeViewport.safeArea.bottom,
    runtimeViewport.safeArea.left,
    runtimeViewport.safeArea.right,
    runtimeViewport.safeArea.top,
    runtimeViewport.width,
  ]);
}

export function BetrayalPreviewOverlaySurface({
  previewRoom,
  previewRoomVisual,
  previewInventoryCard,
  deckAssets,
  traitAssets,
  locale,
  onCloseRoomPreview,
  onCloseInventoryPreview,
}: BetrayalPreviewOverlaySurfaceProps) {
  const { t } = useTranslation("game-betrayal");
  const inventoryPreviewFrameWidth = useInventoryPreviewFrameWidth();
  const hasRoomPreview = Boolean(previewRoom && previewRoomVisual);

  return (
    <>
      <MagnifyOverlay
        isOpen={hasRoomPreview}
        onClose={onCloseRoomPreview}
        closeOnBackdrop={false}
        overlayTestId="betrayal-room-preview-overlay"
        overlayClassName="bg-[rgba(3,6,5,0.76)] p-4 md:p-6"
        containerClassName="rounded-none overflow-visible bg-transparent"
        closeLabel={t("board.reference.close")}
        closeButtonClassName="!top-2 !right-2 !min-h-11 !min-w-[72px] !border !border-[rgba(238,204,126,0.55)] !bg-[rgba(18,15,12,0.90)] !text-[#f3dfab] !opacity-100 shadow-[0_8px_18px_rgba(0,0,0,0.36)]"
      >
        {previewRoom && previewRoomVisual ? (
          <button
            type="button"
            data-testid="betrayal-room-preview-card"
            aria-label={t("board.reference.close")}
            className="pointer-events-auto block max-h-[92vh] max-w-[92vw] cursor-zoom-out border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[#f4cf77] focus-visible:ring-offset-2 focus-visible:ring-offset-[#030605]"
            onClick={onCloseRoomPreview}
          >
            <span className="sr-only">
              {t("board.rooms.preview")} {previewRoom.name}
            </span>
            <RoomTileSprite
              visual={previewRoomVisual}
              locale={locale}
              alt={previewRoom.name}
              className="aspect-square h-[min(92vh,92vw)] w-[min(92vh,92vw)] max-h-[92vh] max-w-[92vw] drop-shadow-[0_26px_70px_rgba(0,0,0,0.55)]"
            />
          </button>
        ) : null}
      </MagnifyOverlay>

      <MagnifyOverlay
        isOpen={Boolean(previewInventoryCard)}
        onClose={onCloseInventoryPreview}
        closeOnBackdrop={false}
        overlayTestId="betrayal-inventory-preview-overlay"
        overlayClassName="bg-[rgba(3,6,5,0.74)] p-4 md:p-6"
        containerClassName="rounded-none overflow-visible bg-transparent"
        closeLabel={t("board.reference.close")}
      >
        {previewInventoryCard ? (
          <div
            className="pointer-events-auto relative cursor-zoom-out"
            onClick={onCloseInventoryPreview}
            style={{
              width: inventoryPreviewFrameWidth,
              aspectRatio: `${BETRAYAL_POSSESSION_CARD_SHELL_ASPECT_RATIO} / 1`,
            }}
          >
            <div className="pointer-events-none">
              <BetrayalInventoryCardSurface
                item={previewInventoryCard}
                layout="preview"
                testId="betrayal-inventory-preview-card"
                deckAssets={deckAssets}
                traitAssets={traitAssets}
                locale={locale}
              />
            </div>
          </div>
        ) : null}
      </MagnifyOverlay>
    </>
  );
}
