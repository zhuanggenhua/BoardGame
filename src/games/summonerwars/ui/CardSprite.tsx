/**
 * 召唤师战争 - 卡牌精灵图组件
 * 使用 CardAtlas 配置精确裁切精灵图
 */

import React from 'react';
import type { CSSProperties } from 'react';
import { getSpriteAtlasSource, getSpriteAtlasStyle, getFrameAspectRatio } from './cardAtlas';

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

/** 卡牌精灵图组件 */
export const CardSprite: React.FC<CardSpriteProps> = ({
  atlasId,
  frameIndex,
  className = '',
  style,
}) => {
  const source = getSpriteAtlasSource(atlasId);
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
        backgroundImage: `url(${source.image})`,
        backgroundRepeat: 'no-repeat',
        ...atlasStyle,
        ...style,
      }}
    />
  );
};

export default CardSprite;
