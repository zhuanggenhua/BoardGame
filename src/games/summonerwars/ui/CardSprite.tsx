// @asset-pipeline-allow
// @asset-pipeline-allow
/**
 * 召唤师战争 - 卡牌精灵图组件
 * 使用真实 <img> + overflow hidden 裁切，避免 Android WebView 对 background-image 的不稳定行为。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getLocalizedImageCandidateUrls,
  getPreloadedImageElement,
  markImageLoaded,
  onImageReady,
} from '../../../core';
import { computeSpriteImgStyle } from '../../../engine/primitives/spriteAtlas';
import { getCardAtlasSource } from '../../../components/common/media/cardAtlasRegistry';
import { logMobileRuntimeCritical } from '../../../lib/mobile/mobileRuntimeDebug';
import { readInstalledGamePackageAssetBlobUrl } from '../../../features/mobile-packages/nativeGamePackagePlugin';
import { getSpriteAtlasSource } from './cardAtlas';

export interface CardSpriteProps {
  /** 精灵图源 ID */
  atlasId: string;
  /** 帧索引 */
  frameIndex: number;
  /** 额外 CSS 类名 */
  className?: string;
  /** 额外样式 */
  style?: CSSProperties;
}

/** 加载中 shimmer 背景样式 */
const SHIMMER_BG: CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.08)',
  backgroundImage: 'linear-gradient(100deg, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.08) 60%)',
  backgroundSize: '200% 100%',
  animation: 'img-shimmer 1.5s linear infinite',
};

const hasUsableImage = (img: HTMLImageElement | null | undefined): boolean =>
  img != null && img.naturalWidth > 0 && img.naturalHeight > 0;

const CAPACITOR_FILE_URL_RE = /^https?:\/\/[^/]+\/_capacitor_file_\//i;
const INSTALLED_ASSET_PATH_MARKER = '/current/assets/';
const capacitorBlobUrlCache = new Map<string, string>();

const normalizeComparableUrl = (url: string): string => {
  if (!url) return '';
  if (typeof window === 'undefined') return url;
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
};

const isCapacitorFileUrl = (url: string) => CAPACITOR_FILE_URL_RE.test(url);

const resolveInstalledAssetRelativePathFromUrl = (url: string) => {
  if (!url) return '';
  const normalizedUrl = normalizeComparableUrl(url);
  try {
    const parsedUrl = new URL(normalizedUrl, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    const markerIndex = parsedUrl.pathname.indexOf(INSTALLED_ASSET_PATH_MARKER);
    if (markerIndex < 0) {
      return '';
    }
    return decodeURIComponent(parsedUrl.pathname.slice(markerIndex + INSTALLED_ASSET_PATH_MARKER.length));
  } catch {
    const markerIndex = normalizedUrl.indexOf(INSTALLED_ASSET_PATH_MARKER);
    if (markerIndex < 0) {
      return '';
    }
    const relativePath = normalizedUrl
      .slice(markerIndex + INSTALLED_ASSET_PATH_MARKER.length)
      .split(/[?#]/, 1)[0];
    try {
      return decodeURIComponent(relativePath);
    } catch {
      return relativePath;
    }
  }
};

const classifyImageSourceKind = (url: string): 'none' | 'blob' | 'capacitor' | 'cdn' | 'builtin' | 'other' => {
  if (!url) return 'none';
  if (url.startsWith('blob:')) return 'blob';
  if (isCapacitorFileUrl(url)) return 'capacitor';
  if (url.startsWith('https://assets.easyboardgame.top/official/')) return 'cdn';
  if (url.startsWith('/assets/')) return 'builtin';
  return 'other';
};

const getCachedCapacitorBlobUrl = (url: string) => {
  if (!url) return '';
  return capacitorBlobUrlCache.get(normalizeComparableUrl(url)) ?? '';
};

const cacheCapacitorBlobUrl = (url: string, blobUrl: string) => {
  const normalizedUrl = normalizeComparableUrl(url);
  if (!normalizedUrl || !blobUrl) {
    return;
  }
  capacitorBlobUrlCache.set(normalizedUrl, blobUrl);
};

const logCompactSourceState = (
  stage: string,
  payload: {
    atlasId: string;
    frameIndex: number;
    candidateIndex: number;
    activeUrl?: string;
    renderedSrc?: string;
  },
) => {
  logMobileRuntimeCritical('SWCS', stage, {
    a: payload.atlasId,
    f: payload.frameIndex,
    i: payload.candidateIndex,
    ak: classifyImageSourceKind(payload.activeUrl || ''),
    rk: classifyImageSourceKind(payload.renderedSrc || ''),
    aurl: payload.activeUrl ? payload.activeUrl.slice(0, 160) : null,
    rurl: payload.renderedSrc ? payload.renderedSrc.slice(0, 160) : null,
  });
};

const resolveLoadedCandidateUrl = (candidateUrls: string[]) => {
  const normalizedCandidates = candidateUrls.map((candidateUrl) => ({
    candidateUrl,
    normalized: normalizeComparableUrl(candidateUrl),
  }));

  for (const candidateUrl of candidateUrls) {
    const img = getPreloadedImageElement(candidateUrl);
    if (img == null || !hasUsableImage(img)) {
      continue;
    }

    for (const src of [img.currentSrc, img.src, candidateUrl]) {
      const normalizedSrc = normalizeComparableUrl(src);
      if (!normalizedSrc) continue;
      const matched = normalizedCandidates.find((candidate) => candidate.normalized === normalizedSrc);
      if (matched) {
        return matched.candidateUrl;
      }
    }
  }

  return '';
};

const findCandidateIndex = (candidateUrls: string[], url: string) => {
  if (!url) return -1;
  const normalizedUrl = normalizeComparableUrl(url);
  return candidateUrls.findIndex((candidateUrl) => normalizeComparableUrl(candidateUrl) === normalizedUrl);
};

/** 卡牌精灵图组件 */
export const CardSprite: React.FC<CardSpriteProps> = ({
  atlasId,
  frameIndex,
  className = '',
  style,
}) => {
  const { i18n } = useTranslation();
  const effectiveLocale = i18n.language || 'zh-CN';
  const source = getSpriteAtlasSource(atlasId);
  const rawSource = getCardAtlasSource(atlasId, effectiveLocale);
  const baseImagePath = rawSource?.image?.trim() || '';

  const candidateUrls = useMemo(() => {
    const urls = [
      source?.image ?? '',
      ...(baseImagePath ? getLocalizedImageCandidateUrls(baseImagePath, effectiveLocale) : []),
    ].filter(Boolean);
    return urls.filter((url, index) => urls.indexOf(url) === index);
  }, [baseImagePath, effectiveLocale, source?.image]);

  const preloadedCandidateUrl = useMemo(
    () => resolveLoadedCandidateUrl(candidateUrls),
    [candidateUrls],
  );
  const initialCandidateIndex = useMemo(() => {
    if (candidateUrls.length === 0) return -1;
    const preloadedIndex = preloadedCandidateUrl
      ? findCandidateIndex(candidateUrls, preloadedCandidateUrl)
      : -1;
    return preloadedIndex >= 0 ? preloadedIndex : 0;
  }, [candidateUrls, preloadedCandidateUrl]);
  const [candidateIndex, setCandidateIndex] = useState(initialCandidateIndex);
  const [loaded, setLoaded] = useState(!source || Boolean(preloadedCandidateUrl));
  const [blobFallbackNonce, setBlobFallbackNonce] = useState(0);
  const activeUrl = candidateIndex >= 0 ? candidateUrls[candidateIndex] ?? '' : '';
  const renderedSrc = useMemo(() => {
    if (!activeUrl) {
      return '';
    }
    return getCachedCapacitorBlobUrl(activeUrl) || activeUrl;
  }, [activeUrl, blobFallbackNonce]);
  const activeUrlRef = useRef(activeUrl);
  const activeCandidateIndexRef = useRef(candidateIndex);
  const nativeBlobFallbackAttemptedRef = useRef(new Set<string>());
  const blobFallbackAttemptedRef = useRef(new Set<string>());

  activeUrlRef.current = activeUrl;
  activeCandidateIndexRef.current = candidateIndex;

  useEffect(() => {
    if (!source) {
      setCandidateIndex(-1);
      setLoaded(true);
      return;
    }

    setCandidateIndex(initialCandidateIndex);
    setLoaded(Boolean(preloadedCandidateUrl));
  }, [initialCandidateIndex, preloadedCandidateUrl, source]);

  useEffect(() => {
    logMobileRuntimeCritical('SummonerWarsCardSprite', 'candidate-state', {
      atlasId,
      frameIndex,
      sourceImage: source?.image ?? null,
      baseImagePath: baseImagePath || null,
      candidateUrls,
      preloadedCandidateUrl: preloadedCandidateUrl || null,
      candidateIndex,
      activeUrl: activeUrl || null,
      renderedSrc: renderedSrc || null,
      loaded,
    });
    if (activeUrl || renderedSrc) {
      logCompactSourceState('candidate', {
        atlasId,
        frameIndex,
        candidateIndex,
        activeUrl,
        renderedSrc,
      });
    }
  }, [
    activeUrl,
    atlasId,
    baseImagePath,
    candidateIndex,
    candidateUrls,
    frameIndex,
    loaded,
    preloadedCandidateUrl,
    renderedSrc,
    source?.image,
  ]);

  useEffect(() => {
    if (!source || candidateUrls.length === 0) {
      return;
    }

    return onImageReady((url) => {
      if (!candidateUrls.includes(url)) {
        return;
      }
      if (!hasUsableImage(getPreloadedImageElement(url))) {
        return;
      }
      const nextIndex = findCandidateIndex(candidateUrls, url);
      if (nextIndex >= 0) {
        setCandidateIndex(nextIndex);
      }
      setLoaded(true);
    });
  }, [candidateUrls, source]);

  if (!source) {
    return <div className={`bg-slate-700 ${className}`} style={style} />;
  }

  const spriteStyle = computeSpriteImgStyle(frameIndex, source.config);
  const ratioPaddingTop = `${100 / spriteStyle.aspectRatio}%`;
  const hasExplicitInlineHeight = style?.height != null
    || style?.minHeight != null
    || style?.maxHeight != null;
  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (!hasUsableImage(img)) {
      logMobileRuntimeCritical('SummonerWarsCardSprite', 'img-load-empty-dimensions', {
        atlasId,
        frameIndex,
        activeUrl: activeUrl || null,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        currentSrc: img.currentSrc || img.src || null,
      });
      return;
    }
    if (baseImagePath) {
      markImageLoaded(baseImagePath, effectiveLocale, img);
    }
    if (source.image) {
      markImageLoaded(source.image, undefined, img);
    }
    if (activeUrl) {
      markImageLoaded(activeUrl, undefined, img);
    }
    logMobileRuntimeCritical('SummonerWarsCardSprite', 'img-load-success', {
      atlasId,
      frameIndex,
      activeUrl: activeUrl || null,
      renderedSrc: renderedSrc || null,
      currentSrc: img.currentSrc || img.src || null,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    });
    logCompactSourceState('load-success', {
      atlasId,
      frameIndex,
      candidateIndex,
      activeUrl,
      renderedSrc: img.currentSrc || img.src || renderedSrc,
    });
    setLoaded(true);
  };

  const advanceToNextCandidate = (failedCandidateIndex: number) => {
    setLoaded(false);
    setCandidateIndex((currentIndex) => {
      if (currentIndex !== failedCandidateIndex) {
        return currentIndex;
      }
      const nextIndex = currentIndex + 1;
      return nextIndex < candidateUrls.length ? nextIndex : -1;
    });
  };

  const handleLocalCandidateFetchFallback = (failedUrl: string, failedCandidateIndex: number) => {
    const normalizedFailedUrl = normalizeComparableUrl(failedUrl);
    if (!failedUrl || !isCapacitorFileUrl(failedUrl) || blobFallbackAttemptedRef.current.has(normalizedFailedUrl)) {
      advanceToNextCandidate(failedCandidateIndex);
      return;
    }

    blobFallbackAttemptedRef.current.add(normalizedFailedUrl);

    void (async () => {
      try {
        const response = await fetch(failedUrl, {
          credentials: 'same-origin',
        });
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        if (!response.ok) {
          logMobileRuntimeCritical('SummonerWarsCardSprite', 'img-load-error-fetch-response', {
            atlasId,
            frameIndex,
            activeUrl: failedUrl,
            responseStatus: response.status,
            responseType: response.type,
            contentType: contentType || null,
            contentLength: contentLength || null,
          });
          advanceToNextCandidate(failedCandidateIndex);
          return;
        }

        const blob = await response.blob();
        logMobileRuntimeCritical('SummonerWarsCardSprite', 'img-load-error-fetch-success', {
          atlasId,
          frameIndex,
          activeUrl: failedUrl,
          responseStatus: response.status,
          responseType: response.type,
          contentType: contentType || blob.type || null,
          contentLength: contentLength || null,
          blobType: blob.type || null,
          blobSize: blob.size,
        });
        logCompactSourceState('fetch-blob-success', {
          atlasId,
          frameIndex,
          candidateIndex: failedCandidateIndex,
          activeUrl: failedUrl,
          renderedSrc: 'blob:',
        });

        if (blob.size <= 0) {
          advanceToNextCandidate(failedCandidateIndex);
          return;
        }

        cacheCapacitorBlobUrl(failedUrl, URL.createObjectURL(blob));

        if (
          normalizeComparableUrl(activeUrlRef.current) === normalizedFailedUrl
          && activeCandidateIndexRef.current === failedCandidateIndex
        ) {
          setBlobFallbackNonce((value) => value + 1);
        }
      } catch (error) {
        logMobileRuntimeCritical('SummonerWarsCardSprite', 'img-load-error-fetch-failed', {
          atlasId,
          frameIndex,
          activeUrl: failedUrl,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        advanceToNextCandidate(failedCandidateIndex);
      }
    })();
  };

  const handleLocalCandidateNativeFallback = (failedUrl: string, failedCandidateIndex: number) => {
    const normalizedFailedUrl = normalizeComparableUrl(failedUrl);
    const relativePath = resolveInstalledAssetRelativePathFromUrl(failedUrl);
    if (
      !failedUrl
      || !isCapacitorFileUrl(failedUrl)
      || !relativePath
      || nativeBlobFallbackAttemptedRef.current.has(normalizedFailedUrl)
    ) {
      handleLocalCandidateFetchFallback(failedUrl, failedCandidateIndex);
      return;
    }

    nativeBlobFallbackAttemptedRef.current.add(normalizedFailedUrl);

    void (async () => {
      const nativeAsset = await readInstalledGamePackageAssetBlobUrl('summonerwars', relativePath);
      if (!nativeAsset?.blobUrl) {
        logMobileRuntimeCritical('SummonerWarsCardSprite', 'img-load-error-native-read-miss', {
          atlasId,
          frameIndex,
          activeUrl: failedUrl,
          relativePath,
        });
        handleLocalCandidateFetchFallback(failedUrl, failedCandidateIndex);
        return;
      }

      cacheCapacitorBlobUrl(failedUrl, nativeAsset.blobUrl);
      logMobileRuntimeCritical('SummonerWarsCardSprite', 'img-load-error-native-read-success', {
        atlasId,
        frameIndex,
        activeUrl: failedUrl,
        relativePath,
        mimeType: nativeAsset.mimeType ?? null,
        blobSize: nativeAsset.size ?? null,
      });
      logCompactSourceState('native-read-success', {
        atlasId,
        frameIndex,
        candidateIndex: failedCandidateIndex,
        activeUrl: failedUrl,
        renderedSrc: nativeAsset.blobUrl,
      });

      if (
        normalizeComparableUrl(activeUrlRef.current) === normalizedFailedUrl
        && activeCandidateIndexRef.current === failedCandidateIndex
      ) {
        setBlobFallbackNonce((value) => value + 1);
      }
    })();
  };

  const handleError = () => {
    const nextIndex = candidateIndex + 1;
    logMobileRuntimeCritical('SummonerWarsCardSprite', 'img-load-error', {
      atlasId,
      frameIndex,
      activeUrl: activeUrl || null,
      renderedSrc: renderedSrc || null,
      candidateIndex,
      nextIndex: nextIndex < candidateUrls.length ? nextIndex : null,
      candidateUrls,
    });
    logCompactSourceState('load-error', {
      atlasId,
      frameIndex,
      candidateIndex,
      activeUrl,
      renderedSrc,
    });
    if (renderedSrc && renderedSrc !== activeUrl) {
      advanceToNextCandidate(candidateIndex);
      return;
    }
    handleLocalCandidateNativeFallback(activeUrl, candidateIndex);
  };

  return (
    <div
      data-card-sprite="true"
      data-image-loaded={loaded ? 'true' : 'false'}
      data-card-sprite-url={activeUrl}
      className={`relative overflow-hidden ${className}`}
      style={{
        ...(hasExplicitInlineHeight
          ? {
              aspectRatio: `${spriteStyle.aspectRatio}`,
            }
          : {
              height: 0,
              paddingTop: ratioPaddingTop,
              aspectRatio: `${spriteStyle.aspectRatio}`,
            }),
        transition: 'opacity 0.3s ease',
        opacity: loaded ? 1 : 0.6,
        ...(loaded ? {} : SHIMMER_BG),
        ...style,
      }}
    >
      {activeUrl ? (
        <div className="absolute inset-0">
          <img
            alt=""
            aria-hidden="true"
            draggable={false}
            src={renderedSrc}
            onLoad={handleLoad}
            onError={handleError}
            className="pointer-events-none select-none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: spriteStyle.imgWidth,
              height: spriteStyle.imgHeight,
              maxWidth: 'none',
              maxHeight: 'none',
              transform: `translate(${spriteStyle.translateX}, ${spriteStyle.translateY})`,
              opacity: loaded ? 1 : 0,
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

export default CardSprite;
