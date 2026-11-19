import type { ComponentProps, CSSProperties } from 'react';
import { HudPortal } from '../../../core/ui/portal';
import { UI_Z_INDEX } from '../../../core';
import { QidahenBattleRollSequence } from './QidahenBattleRollSequence';

type Props = Omit<ComponentProps<typeof QidahenBattleRollSequence>, 'fixedSides'>;

/** 交战进入独立投掷区；地图视角和滚动不决定物理骰能否播放。 */
export function QidahenBattleArena(props: Props) {
    return (
        <HudPortal>
            <div className="pointer-events-auto fixed inset-0 grid place-items-center overflow-auto bg-black/50 p-3 sm:p-6"
                data-testid="qidahen-battle-arena" style={{ zIndex: UI_Z_INDEX.modalContent }}>
                <div data-testid="qidahen-battle-roll-overlay"
                    className="w-full max-w-[920px] rounded-lg border border-[#9f7e56] bg-[#39291e] p-3 shadow-2xl sm:p-5"
                    style={{ '--qidahen-battle-panel-height': 'clamp(250px, 49dvh, 438px)' } as CSSProperties}>
                    <QidahenBattleRollSequence {...props} fixedSides />
                </div>
            </div>
        </HudPortal>
    );
}
