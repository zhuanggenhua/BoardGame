import React from 'react';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';

interface SpriteSurfaceProps {
    imagePath: string;
    locale: string;
    aspectRatio: number;
    spriteStyle: React.CSSProperties;
    className?: string;
    style?: React.CSSProperties;
    kind?: 'card' | 'noble';
}

const parsePercentPair = (value: React.CSSProperties['backgroundSize'] | React.CSSProperties['backgroundPosition']) => {
    if (typeof value !== 'string') return null;
    const matches = Array.from(value.matchAll(/-?\d+(?:\.\d+)?/g)).map((match) => Number(match[0]));
    if (matches.length < 2 || matches.some((item) => !Number.isFinite(item))) {
        return null;
    }
    return [matches[0], matches[1]] as const;
};

export function SpriteSurface({
    imagePath,
    locale,
    aspectRatio,
    spriteStyle,
    className = '',
    style,
    kind,
}: SpriteSurfaceProps) {
    const sizePair = parsePercentPair(spriteStyle.backgroundSize);
    const positionPair = parsePercentPair(spriteStyle.backgroundPosition);
    const fallbackPaddingTop = `${100 / aspectRatio}%`;

    if (!sizePair || !positionPair) {
        return (
            <div
                className={`w-full bg-white/5 ${className}`}
                data-splendor-sprite-preview={kind}
                style={{ height: 0, paddingTop: fallbackPaddingTop, aspectRatio: `${aspectRatio} / 1`, ...style }}
            />
        );
    }

    const [backgroundWidthPercent, backgroundHeightPercent] = sizePair;
    const [positionXPercent, positionYPercent] = positionPair;
    const left = `${(positionXPercent * (100 - backgroundWidthPercent)) / 100}%`;
    const top = `${(positionYPercent * (100 - backgroundHeightPercent)) / 100}%`;

    return (
        <div
            className={`relative w-full overflow-hidden ${className}`}
            data-splendor-sprite-preview={kind}
            data-splendor-sprite-url={imagePath}
            style={{
                height: 0,
                paddingTop: fallbackPaddingTop,
                aspectRatio: `${aspectRatio} / 1`,
                ...style,
            }}
        >
            <OptimizedImage
                src={imagePath}
                locale={locale}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{
                    width: `${backgroundWidthPercent}%`,
                    height: `${backgroundHeightPercent}%`,
                    left,
                    top,
                    objectFit: 'fill',
                }}
            />
        </div>
    );
}
