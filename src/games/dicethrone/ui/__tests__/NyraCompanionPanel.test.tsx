import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { initHeroState } from '../../domain/characters';
import { TOKEN_IDS } from '../../domain/ids';
import { createQueuedRandom } from '../../__tests__/test-utils';
import { NyraCompanionPanel } from '../NyraCompanionPanel';

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: () => undefined },
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { resolvedLanguage: 'zh-CN', language: 'zh-CN' },
    }),
}));

function makeLierenPlayer() {
    const player = initHeroState('0', 'lieren', createQueuedRandom([1]));
    player.companion = { id: 'nyra', hp: 5, maxHp: 7 };
    player.tokens[TOKEN_IDS.NYRAS_BOND] = 1;
    return player;
}

describe('NyraCompanionPanel', () => {
    it('妮拉伤害分配滑块不会把拖拽冒泡给玩家板图片层', () => {
        const parentPointerDown = vi.fn();

        render(
            <div onPointerDown={parentPointerDown}>
                <NyraCompanionPanel
                    player={makeLierenPlayer()}
                    locale="zh-CN"
                    damageResponse={{
                        currentDamage: 4,
                        maxAssignableDamage: 3,
                        canRedirectToNyra: true,
                        canAllocateWithBond: true,
                        onConfirmDamageAllocation: vi.fn(),
                    }}
                />
            </div>,
        );

        const dock = screen.getByTestId('nyra-damage-response-dock');
        const slider = screen.getByRole('slider', { name: 'companion.nyra.damageAllocationSlider' });

        fireEvent.pointerDown(slider);
        expect(parentPointerDown).not.toHaveBeenCalled();
        expect(slider).toHaveAttribute('draggable', 'false');

        const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
        slider.dispatchEvent(dragStart);
        expect(dragStart.defaultPrevented).toBe(true);
        expect(dock).toHaveAttribute('draggable', 'false');
    });
});
