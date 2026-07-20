import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PlayerId, RandomFn } from '../../../engine/types';
import { initHeroState } from '../domain/characters';
import type { CharacterId, DiceThroneCore, PendingAttack, TurnPhase } from '../domain/types';
import { useAttackShowcase } from '../hooks/useAttackShowcase';

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: (max) => Math.min(max, 1),
    range: (min) => min,
    shuffle: (arr) => [...arr],
};

function buildCore(pendingAttack: PendingAttack): DiceThroneCore {
    const players = {
        '0': initHeroState('0', 'monk', fixedRandom),
        '1': initHeroState('1', 'barbarian', fixedRandom),
    };

    return {
        players,
        selectedCharacters: {
            '0': 'monk',
            '1': 'barbarian',
        },
        readyPlayers: {
            '0': true,
            '1': true,
        },
        hostPlayerId: '0',
        hostStarted: true,
        dice: [],
        rollCount: 1,
        rollLimit: 3,
        rollDiceCount: 5,
        rollConfirmed: true,
        activePlayerId: '1',
        startingPlayerId: '0',
        turnNumber: 7,
        pendingAttack,
        tokenDefinitions: [],
    } as unknown as DiceThroneCore;
}

function AttackShowcaseProbe({
    currentPhase,
    currentPlayerId,
    pendingAttack,
}: {
    currentPhase: TurnPhase;
    currentPlayerId: PlayerId;
    pendingAttack: PendingAttack;
}) {
    const selectedCharacters: Record<PlayerId, CharacterId> = {
        '0': 'monk',
        '1': 'barbarian',
    };
    const state = buildCore(pendingAttack);
    const result = useAttackShowcase({
        currentPhase,
        currentPlayerId,
        selectedCharacters,
        abilityLevels: {
            '0': state.players['0'].abilityLevels,
            '1': state.players['1'].abilityLevels,
        },
        pendingAttack,
        state,
    });

    return (
        <pre data-testid="attack-showcase-state">
            {JSON.stringify({
                isShowcaseVisible: result.isShowcaseVisible,
                mode: result.mode,
                autoDismissMs: result.autoDismissMs,
                sourceAbilityId: result.showcaseData?.sourceAbilityId ?? null,
            })}
        </pre>
    );
}

describe('useAttackShowcase', () => {
    it('其他玩家进攻技能特写在非防御入口模式也必须手动关闭', async () => {
        const pendingAttack: PendingAttack = {
            attackerId: '1',
            defenderId: '0',
            isDefendable: true,
            sourceAbilityId: 'slap',
        };

        render(
            <AttackShowcaseProbe
                currentPhase="main1"
                currentPlayerId="0"
                pendingAttack={pendingAttack}
            />,
        );

        await waitFor(() => {
            const state = JSON.parse(screen.getByTestId('attack-showcase-state').textContent ?? '{}');
            expect(state).toMatchObject({
                isShowcaseVisible: true,
                mode: 'offensive-preview',
                autoDismissMs: null,
                sourceAbilityId: 'slap',
            });
        });
    });
});
