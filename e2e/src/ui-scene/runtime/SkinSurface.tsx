import type { CSSProperties, PropsWithChildren } from 'react';
import type { UISceneCompiledSkin } from '../types';
import { resolveCompiledAssetUrl } from './assets';

export interface SkinSurfaceProps extends PropsWithChildren {
    skin?: UISceneCompiledSkin;
    className?: string;
    style?: CSSProperties;
    contentStyle?: CSSProperties;
}

export function SkinSurface({ skin, className, style, contentStyle, children }: SkinSurfaceProps) {
    if (!skin || skin.kind === 'textStyle') {
        return (
            <div className={className} style={style}>
                {children}
            </div>
        );
    }

    if (skin.kind === 'backgroundImage' || skin.kind === 'icon') {
        const url = resolveCompiledAssetUrl(skin.asset);
        return (
            <div
                className={className}
                style={{
                    backgroundImage: url ? `url("${url}")` : undefined,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: skin.kind === 'icon'
                        ? `${skin.width ?? 24}px ${skin.height ?? 24}px`
                        : skin.contentMode,
                    ...style,
                }}
            >
                {children}
            </div>
        );
    }

    const url = resolveCompiledAssetUrl(skin.asset);
    const borderWidth = `${skin.slice.top}px ${skin.slice.right}px ${skin.slice.bottom}px ${skin.slice.left}px`;

    return (
        <div
            className={className}
            style={{
                borderStyle: 'solid',
                borderWidth,
                borderImageSource: url ? `url("${url}")` : undefined,
                borderImageSlice: `${skin.slice.top} ${skin.slice.right} ${skin.slice.bottom} ${skin.slice.left} fill`,
                borderImageRepeat: skin.scaleMode,
                boxSizing: 'border-box',
                ...style,
            }}
        >
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    paddingTop: skin.contentPadding.top,
                    paddingRight: skin.contentPadding.right,
                    paddingBottom: skin.contentPadding.bottom,
                    paddingLeft: skin.contentPadding.left,
                    boxSizing: 'border-box',
                    ...contentStyle,
                }}
            >
                {children}
            </div>
        </div>
    );
}
