/**
 * 召唤师战争 - 地图容器兼容包装。
 *
 * 真实缩放/拖拽能力已抽到通用 ZoomPanViewport，避免其它地图游戏重复实现。
 */

import React from 'react';
import {
  ZoomPanViewport,
  type ZoomPanViewportProps,
} from '../../../components/game/framework/ZoomPanViewport';

export type MapContainerProps = ZoomPanViewportProps;

export const MapContainer: React.FC<MapContainerProps> = (props) => (
  <ZoomPanViewport {...props} />
);

export default MapContainer;
