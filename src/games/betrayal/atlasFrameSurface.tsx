import React from "react";

import { OptimizedImage } from "../../components/common/media/OptimizedImage";
import {
  buildDiscoveryAtlasImageStyle,
  type BetrayalDiscoveryAtlasVisual,
} from "./discoveryAtlas";
import {
  buildPossessionAtlasImageStyle,
  type BetrayalPossessionAtlasVisual,
} from "./possessionAtlas";

type PossessionAtlasFrameProps = {
  visual: BetrayalPossessionAtlasVisual;
  locale: string;
  alt: string;
  testId?: string;
};

export function PossessionAtlasFrame({
  visual,
  locale,
  alt,
  testId,
}: PossessionAtlasFrameProps) {
  const imgStyle = React.useMemo(
    () => buildPossessionAtlasImageStyle(visual),
    [visual],
  );

  return (
    <OptimizedImage
      src={visual.image}
      locale={locale}
      alt={alt}
      data-testid={testId}
      data-asset-src={visual.image}
      draggable={false}
      className="absolute left-0 top-0 max-w-none select-none"
      style={imgStyle}
    />
  );
}

type DiscoveryAtlasFrameProps = {
  visual: BetrayalDiscoveryAtlasVisual | BetrayalPossessionAtlasVisual;
  locale: string;
  alt: string;
  testId?: string;
  className?: string;
};

export function DiscoveryAtlasFrame({
  visual,
  locale,
  alt,
  testId,
  className = "",
}: DiscoveryAtlasFrameProps) {
  const imgStyle = React.useMemo(
    () => buildDiscoveryAtlasImageStyle(visual),
    [visual],
  );

  return (
    <div
      role="img"
      aria-label={alt}
      data-testid={testId}
      data-asset-src={visual.image}
      data-atlas-frame-index={visual.frameIndex}
      className={`relative overflow-hidden rounded-[10px] bg-[rgba(8,7,5,0.96)] shadow-[0_10px_24px_rgba(0,0,0,0.36)] ${className}`}
      style={{ aspectRatio: imgStyle.aspectRatio }}
    >
      <OptimizedImage
        src={visual.image}
        locale={locale}
        alt={alt}
        data-asset-src={visual.image}
        data-atlas-frame-index={visual.frameIndex}
        draggable={false}
        className="absolute left-0 top-0 max-w-none select-none"
        style={imgStyle}
      />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-[rgba(227,206,170,0.16)]" />
    </div>
  );
}
