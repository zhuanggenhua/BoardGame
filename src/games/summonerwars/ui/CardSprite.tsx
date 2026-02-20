/**
 * 召唤师战争 - 卡牌精灵图组件
 * 使用 CardAtlas 配置精确裁切精灵图
 */

import React, { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { getSpriteAtlasSource, getSpriteAtlasStyle, getFrameAspectRatio } from './cardAtlas';
import { isImagePreloaded } from '../../../core/AssetLoader';

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

/** 卡牌精灵图组件 */
export const CardSprite: React.FC<CardSpriteProps> = ({
  atlasId,
  frameIndex,
  className = '',
  style,
}) => {
  const source = getSpriteAtlasSource(atlasId);
  const [loaded, setLoaded] = useState(() => !!source && isImagePreloaded(source.image));
  const imageUrlRef = useRef<string>('');

  // 预加载图片并监听加载状态
  useEffect(() => {
    if (!source) {
      setLoaded(true);
      return;
    }

    const imageUrl = source.image;

    // 如果图片 URL 没变，不重新加载
    if (imageUrlRef.current === imageUrl && loaded) {
      return;
    }

    imageUrlRef.current = imageUrl;

    // 已预加载，直接标记完成
    if (isImagePreloaded(imageUrl)) {
      setLoaded(true);
      return;
    }

    setLoaded(false);

    const img = new Image();
    img.onload = () => setLoaded(true);
    img.onerror = () => setLoaded(true);
    img.src = imageUrl;

    if (img.complete) {
      setLoaded(true);
    }
  }, [source, loaded]);

  if (!source) {
    return <div className={`bg-slate-700 ${className}`} style={style} />;
  }

  const atlasStyle = getSpriteAtlasStyle(frameIndex, source.config);
  const aspectRatio = getFrameAspectRatio(frameIndex, source.config);

  return (
    <div
      className={className}
      style={{
        aspectRatio: `${aspectRatio}`,
        backgroundImage: loaded ? `url(${source.image})` : 'none',
        backgroundRepeat: 'no-repeat',
        ...atlasStyle,
        ...(loaded ? {} : SHIMMER_BG),
        transition: 'opacity 0.3s ease',
        opacity: loaded ? 1 : 0.6,
        ...style,
      }}
    />
  );
};

export default CardSprite;
