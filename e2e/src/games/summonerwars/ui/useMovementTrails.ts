/**
 * 召唤师战争 - 移动轨迹管理 Hook
 * 
 * 监听 UNIT_MOVED 事件并管理路径轨迹效果
 */

import { useState, useCallback, useEffect } from 'react';
import type { CellCoord } from '../domain/types';
import { SW_EVENTS } from '../domain/types';
import { useEventStreamCursor } from '../../../engine/hooks';
import type { EventStreamEntry } from '../../../engine/types';

interface MovementTrail {
  id: string;
  path: CellCoord[];
  unitId: string;
}

interface UseMovementTrailsParams {
  entries: EventStreamEntry[];
}

/**
 * 管理单位移动的路径轨迹效果
 */
export function useMovementTrails({ entries }: UseMovementTrailsParams) {
  const [trails, setTrails] = useState<MovementTrail[]>([]);
  const { consumeNew } = useEventStreamCursor({ entries });

  // 监听 UNIT_MOVED 事件
  useEffect(() => {
    const { entries: newEntries } = consumeNew();

    for (const entry of newEntries) {
      const event = entry.event;
      if (event.type === SW_EVENTS.UNIT_MOVED) {
        const payload = event.payload as {
          from: CellCoord;
          to: CellCoord;
          unitId: string;
          path?: CellCoord[];
        };

        // 只有路径长度 >= 3 才显示轨迹（跳过单格和两格移动）
        if (payload.path && payload.path.length >= 3) {
          const trailId = `trail-${payload.unitId}-${Date.now()}`;
          queueMicrotask(() => {
            setTrails((prev) => [
              ...prev,
              {
                id: trailId,
                path: payload.path!,
                unitId: payload.unitId,
              },
            ]);
          });
        }
      }
    }
  }, [entries, consumeNew]);

  // 移除完成的轨迹
  const removeTrail = useCallback((trailId: string) => {
    setTrails((prev) => prev.filter((t) => t.id !== trailId));
  }, []);

  return {
    trails,
    removeTrail,
  };
}
