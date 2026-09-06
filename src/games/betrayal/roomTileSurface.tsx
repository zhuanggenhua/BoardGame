import React from "react";

import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import {
  buildRoomAtlasImageStyle,
  type BetrayalRoomTileVisual,
} from "./roomAtlas";

export interface RoomTileSpriteProps {
  visual: BetrayalRoomTileVisual;
  locale: string;
  alt: string;
  className?: string;
}

export function RoomTileSprite({
  visual,
  locale,
  alt,
  className,
}: RoomTileSpriteProps) {
  const imgStyle = React.useMemo(
    () => buildRoomAtlasImageStyle(visual),
    [visual],
  );

  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`.trim()}
      style={{ aspectRatio: imgStyle.aspectRatio }}
    >
      <OptimizedImage
        src={visual.image}
        locale={locale}
        alt={alt}
        draggable={false}
        className="absolute left-0 top-0 max-w-none select-none"
        style={imgStyle}
      />
    </div>
  );
}
