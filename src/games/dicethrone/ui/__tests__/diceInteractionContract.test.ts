import { describe, expect, it } from 'vitest';
import type { InteractionDescriptor } from '../../../../engine/systems/InteractionSystem';
import { diceModifyReducer, diceModifyToCommands } from '../../domain/diceInteraction';
import { createDiceInteractionContract, getDiceInteractionHint, getDiceInteractionMeta } from '../diceInteractionContract';
import { rebuildClientDiceMultistepInteraction } from '../clientDiceMultistepInteraction';

// 预期来源：公共固定6旧流程；索尔原卡27只允许4/5；原卡22及FAQ为任选子集一次。
describe('固定结果与批量重掷的共享操作合同', () => {
    const config = { mode: 'set' as const, allowedValues: [4, 5] as [number, ...number[]] };
    const interaction: InteractionDescriptor = { id: 'fixed-results', kind: 'multistep-choice', playerId: '0', data: {
        minSteps: 1, meta: { dtType: 'modifyDie', dieModifyConfig: config, selectCount: 1, diceOwnerId: '0', targetOpponentDice: false },
    } };
    it.each([4, 5])('固定结果%s先选值再点骰，只有点骰才产生正式命令，沿旧set自动提交', value => {
        const initial = { modifications: {}, modCount: 0, totalAdjustment: 0 };
        const rebuilt = rebuildClientDiceMultistepInteraction(interaction)!;
        expect(rebuilt.data.maxSteps).toBe(1);
        const meta = getDiceInteractionMeta(interaction)!;
        expect(getDiceInteractionHint({ meta, interaction, result: initial, rootPlayerId: '0' }).key).toBe('interaction.hint_choose_value');
        const before = diceModifyReducer(initial, { action: 'select', dieId: 0, dieValue: 1 }, config, 1);
        expect(diceModifyToCommands(before)).toEqual([]);
        const chosen = diceModifyReducer(initial, { action: 'chooseValue', value }, config, 1);
        expect(chosen.modCount).toBe(0);
        expect(diceModifyToCommands(chosen)).toEqual([]);
        expect(getDiceInteractionHint({ meta, interaction, result: chosen, rootPlayerId: '0' })).toEqual({ key: 'interaction.hint_set', params: { value } });
        const final = diceModifyReducer(chosen, { action: 'select', dieId: 0, dieValue: 1 }, config, 1);
        expect(diceModifyToCommands(final)).toEqual([{ type: 'MODIFY_DIE', payload: { dieId: 0, newValue: value } }]);
    });
    it('非候选值不能进入固定结果选择', () => {
        const initial = { modifications: {}, modCount: 0, totalAdjustment: 0 };
        expect(diceModifyReducer(initial, { action: 'chooseValue', value: 6 }, config, 1)).toEqual(initial);
    });
    it.each([{ selectedIds: [] }, { selectedIds: [0, 2] }])('组重掷选择$selectedIds从同一多步交互状态派生必需提示', ({ selectedIds }) => {
        const groupRerollInteraction: InteractionDescriptor = {
            id: 'bonus-dice:group-reroll',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                title: 'interaction.hint_group_reroll',
                initialResult: { selectedDiceIds: [] },
                minSteps: 0,
                allowedDieIds: [0, 1, 2, 3, 4],
                meta: {
                    dtType: 'selectDie',
                    selectionMode: 'bonusGroupReroll',
                    selectCount: 5,
                    diceOwnerId: '0',
                    targetOpponentDice: false,
                },
            },
        };
        const hint = getDiceInteractionHint({
            meta: getDiceInteractionMeta(groupRerollInteraction)!,
            rootPlayerId: '0',
            interaction: groupRerollInteraction,
            result: { selectedDiceIds: selectedIds },
        });
        expect(hint).toEqual({ key: selectedIds.length ? 'interaction.hint_group_reroll_selected' : 'interaction.hint_group_reroll', params: { count: selectedIds.length } });
    });

    it('普通多步选骰也必须由同一交互合同派生非空提示', () => {
        const selectInteraction: InteractionDescriptor = {
            id: 'reroll-select',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                title: 'interaction.selectDie',
                initialResult: { selectedDiceIds: [] },
                minSteps: 1,
                meta: {
                    dtType: 'selectDie',
                    selectionMode: 'reroll',
                    selectCount: 2,
                    diceOwnerId: '0',
                    targetOpponentDice: false,
                },
            },
        };
        expect(getDiceInteractionHint({
            meta: getDiceInteractionMeta(selectInteraction)!,
            rootPlayerId: '0',
            interaction: selectInteraction,
            result: { selectedDiceIds: [0] },
        })).toEqual({
            key: 'interaction.hint_select',
            params: { current: 1, max: 2 },
        });
    });

    it('单个UI合同同时给出候选、提示、提交与旧确认职责', () => {
        const controller = {
            result: { selectedDiceIds: [2] },
            stepCount: 1,
            canConfirm: true,
            step: () => undefined,
            confirm: () => undefined,
            cancel: () => undefined,
        };
        const interaction: InteractionDescriptor = {
            id: 'bonus-group-ui-contract',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                minSteps: 0,
                allowedDieIds: [1, 2, 3],
                completedDieIds: [],
                meta: {
                    dtType: 'selectDie',
                    selectionMode: 'bonusGroupReroll',
                    selectCount: 3,
                    diceOwnerId: '0',
                    targetOpponentDice: false,
                },
            },
        };

        const contract = createDiceInteractionContract({
            interaction,
            controller,
            rootPlayerId: '0',
            isBonusDiceSettlement: true,
        });

        expect(contract).toMatchObject({
            interactionId: 'bonus-group-ui-contract',
            allowedDieIds: [1, 2, 3],
            completedDieIds: [],
            completedCount: 0,
            hint: { key: 'interaction.hint_group_reroll_selected', params: { count: 1 } },
            actions: {
                left: {
                    kind: 'submitSelection',
                    labelKey: 'dice.reroll_action',
                    tutorialId: 'dice-reroll-selected-group',
                },
                right: {
                    kind: 'confirmSettlement',
                    labelKey: 'common.confirm',
                    buttonTestId: 'dice-bonus-settlement-confirm-button',
                    tutorialId: 'dice-confirm-button',
                },
            },
        });
    });

    it('奖励骰仍待结算时，普通多步选择保留自身右侧确认和GameHints提示', () => {
        const interaction: InteractionDescriptor = {
            id: 'ordinary-select-ui-contract',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                minSteps: 0,
                allowedDieIds: [4],
                meta: {
                    dtType: 'selectDie',
                    selectionMode: 'reroll',
                    selectCount: 2,
                    diceOwnerId: '0',
                    targetOpponentDice: false,
                },
            },
        };
        const controller = {
            result: { selectedDiceIds: [] },
            stepCount: 0,
            canConfirm: true,
            step: () => undefined,
            confirm: () => undefined,
            cancel: () => undefined,
        };

        const contract = createDiceInteractionContract({
            interaction,
            controller,
            rootPlayerId: '0',
            isBonusDiceSettlement: true,
        });
        expect(contract?.kind).toBe('multistep');
        expect(contract?.kind === 'multistep' ? contract.hint : undefined).toMatchObject({
            key: 'interaction.hint_select',
            params: { current: 0, max: 2 },
            surface: 'game-hints',
        });
        expect(contract?.actions).toEqual({
            left: { kind: 'cancel', labelKey: 'common.cancel' },
            right: {
                kind: 'confirmInteraction',
                labelKey: 'common.confirm',
                buttonTestId: 'dice-interaction-confirm-button',
            },
        });
    });

    it('不可取消的骰子交互隐藏取消动作，但仍提供提示与确认', () => {
        const interaction: InteractionDescriptor = {
            id: 'required-dice-selection',
            kind: 'multistep-choice',
            playerId: '0',
            cancelPolicy: 'forbidden',
            data: {
                minSteps: 1,
                meta: {
                    dtType: 'modifyDie',
                    dieModifyConfig: { mode: 'set', targetValue: 6 },
                    selectCount: 1,
                    diceOwnerId: '0',
                    targetOpponentDice: false,
                },
            },
        };
        const controller = {
            result: { modifications: {}, modCount: 0, totalAdjustment: 0 },
            stepCount: 0,
            canConfirm: false,
            step: () => undefined,
            confirm: () => undefined,
            cancel: () => undefined,
        };

        const contract = createDiceInteractionContract({ interaction, controller, rootPlayerId: '0' });

        expect(contract?.kind).toBe('multistep');
        expect(contract?.actions.left).toBeUndefined();
        expect(contract?.actions.right).toMatchObject({ kind: 'confirmInteraction', labelKey: 'common.confirm' });
        expect(contract?.hint).toMatchObject({ key: 'interaction.hint_set', params: { value: 6 } });
    });

    it('组选重掷没有对应待结算状态时拒绝生成冲突动作合同', () => {
        const groupInteraction: InteractionDescriptor = {
            id: 'orphan-group-reroll',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                minSteps: 0,
                allowedDieIds: [0],
                meta: {
                    dtType: 'selectDie',
                    selectionMode: 'bonusGroupReroll',
                    selectCount: 1,
                    diceOwnerId: '0',
                    targetOpponentDice: false,
                },
            },
        };
        const controller = {
            result: { selectedDiceIds: [0] },
            stepCount: 1,
            canConfirm: true,
            step: () => undefined,
            confirm: () => undefined,
            cancel: () => undefined,
        };

        expect(() => createDiceInteractionContract({ interaction: groupInteraction, controller, rootPlayerId: '0' }))
            .toThrow('Bonus group reroll requires its pending settlement');
    });

    it.each([
        [{ mode: 'adjust', adjustRange: { min: -1, max: 1 } }, { modifications: {}, modCount: 0, totalAdjustment: 0 }, 'interaction.hint_adjust'],
        [{ mode: 'any' }, { modifications: {}, modCount: 0, totalAdjustment: 0 }, 'interaction.hint_any'],
        [{ mode: 'copy' }, { modifications: {}, modCount: 0, totalAdjustment: 0 }, 'interaction.hint_copy_step1'],
        [{ mode: 'set', targetValue: 6 }, { modifications: {}, modCount: 0, totalAdjustment: 0 }, 'interaction.hint_set'],
    ] as const)('每种合法改骰操作语义都生成必需提示', (dieModifyConfig, result, expectedHint) => {
        const modifyInteraction: InteractionDescriptor = {
            id: `modify-${dieModifyConfig.mode}`,
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                minSteps: 1,
                meta: { dtType: 'modifyDie', dieModifyConfig, selectCount: dieModifyConfig.mode === 'copy' ? 2 : 1, targetOpponentDice: false },
            },
        };
        const meta = getDiceInteractionMeta(modifyInteraction);
        expect(meta).toBeDefined();
        expect(getDiceInteractionHint({ meta: meta!, interaction: modifyInteraction, result, rootPlayerId: '0' }).key)
            .toBe(expectedHint);
    });

    it('拒绝没有可生成提示的未知改骰模式', () => {
        const malformedInteraction: InteractionDescriptor = {
            id: 'modify-unknown',
            kind: 'multistep-choice',
            playerId: '0',
            data: { meta: { dtType: 'modifyDie', dieModifyConfig: { mode: 'unknown' }, selectCount: 1 } },
        };
        expect(getDiceInteractionMeta(malformedInteraction)).toBeUndefined();
    });

    it('普通奖励骰确认也是玩家输入，必须由骰盘合同提供继续提示', () => {
        const contract = createDiceInteractionContract({
            rootPlayerId: '0',
            isBonusDiceSettlement: true,
        });

        expect(contract).toMatchObject({
            kind: 'bonusSettlement',
            hint: { key: 'interaction.hint_bonus_settlement' },
            actions: {
                right: {
                    kind: 'confirmSettlement',
                    labelKey: 'common.confirm',
                },
            },
        });
    });

    it('闪避投掷结算由 token 响应合同携带提示与原确认动作', () => {
        const interaction = {
            id: 'dt-token-response-damage-1',
            kind: 'dt:token-response',
            playerId: '0',
            data: {},
        } as unknown as InteractionDescriptor;
        const contract = createDiceInteractionContract({
            interaction,
            rootPlayerId: '0',
            isTokenEvasionConfirmation: true,
        });

        expect(contract).toMatchObject({
            kind: 'tokenResponseSettlement',
            responseKind: 'token',
            hint: { key: 'response.yourTurn', surface: 'response-window' },
            actions: {
                right: { kind: 'confirmTokenResponse', labelKey: 'common.confirm' },
            },
        });
        expect(contract?.actions.left).toBeUndefined();
        expect(() => createDiceInteractionContract({
            interaction,
            rootPlayerId: '1',
            isTokenEvasionConfirmation: true,
        })).toThrow(/active player's token-response interaction/);
    });

    it('不为缺失骰子数量的多步交互臆造单骰提示', () => {
        const malformedInteraction: InteractionDescriptor = {
            id: 'select-dice-without-count',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                meta: {
                    dtType: 'selectDie',
                    selectionMode: 'reroll',
                    targetOpponentDice: false,
                },
            },
        };

        expect(getDiceInteractionMeta(malformedInteraction)).toBeUndefined();
    });

    it('不为缺失选择模式的多步交互臆造普通重掷语义', () => {
        const malformedInteraction: InteractionDescriptor = {
            id: 'select-dice-without-mode',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                meta: {
                    dtType: 'selectDie',
                    selectCount: 1,
                    targetOpponentDice: false,
                },
            },
        };

        expect(getDiceInteractionMeta(malformedInteraction)).toBeUndefined();
    });

    it('不让奖励骰确认态覆盖一个无效骰子交互合同', () => {
        const malformedInteraction: InteractionDescriptor = {
            id: 'malformed-dice-during-settlement',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                meta: {
                    dtType: 'selectDie',
                    selectionMode: 'reroll',
                    targetOpponentDice: false,
                },
            },
        };

        expect(() => createDiceInteractionContract({
            interaction: malformedInteraction,
            controller: {
                result: { selectedDiceIds: [] },
                stepCount: 0,
                canConfirm: false,
                step: () => undefined,
                confirm: () => undefined,
                cancel: () => undefined,
            },
            rootPlayerId: '0',
            isBonusDiceSettlement: true,
        })).toThrow(/Invalid dice interaction contract/);
    });

    it.each([
        { allowedDieIds: [0, 1], completedDieIds: [0], completedSteps: 2 },
        { allowedDieIds: [0, 1], completedDieIds: [0], completedSteps: 1, maxSteps: 0 },
        { allowedDieIds: [0, 1], completedDieIds: [2], completedSteps: 1 },
    ])('候选、已完成骰与累计步数不一致时拒绝合同：%j', progress => {
        const malformedInteraction: InteractionDescriptor = {
            id: 'inconsistent-dice-progress',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                ...progress,
                meta: {
                    dtType: 'selectDie',
                    selectionMode: 'reroll',
                    selectCount: 2,
                    targetOpponentDice: false,
                },
            },
        };

        expect(getDiceInteractionMeta(malformedInteraction)).toBeUndefined();
        expect(() => createDiceInteractionContract({ interaction: malformedInteraction, rootPlayerId: '0' }))
            .toThrow(/Invalid dice interaction contract/);
    });

    it('骰子多步合同缺少共同状态控制器时拒绝渲染只有提示的死交互', () => {
        const validInteraction: InteractionDescriptor = {
            id: 'dice-without-controller',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                meta: {
                    dtType: 'selectDie',
                    selectionMode: 'reroll',
                    selectCount: 1,
                    targetOpponentDice: false,
                },
            },
        };

        expect(() => createDiceInteractionContract({ interaction: validInteraction, rootPlayerId: '0' }))
            .toThrow(/requires its shared controller/);
    });

    it.each([
        { mode: 'set', targetValue: 4.5 },
        { mode: 'set', allowedValues: [4, 4] },
        { mode: 'set', allowedValues: [4, 7] },
        { mode: 'set', targetValue: 4, allowedValues: [4, 5] },
        { mode: 'adjust', adjustRange: { min: 2, max: -2 } },
    ])('骰面/调整范围无效时不生成可交互骰盘提示：%j', invalidConfig => {
        const malformedInteraction: InteractionDescriptor = {
            id: 'invalid-modify-config',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                meta: {
                    dtType: 'modifyDie',
                    dieModifyConfig: invalidConfig,
                    selectCount: 1,
                },
            },
        };

        expect(getDiceInteractionMeta(malformedInteraction)).toBeUndefined();
    });

    it('拒绝组重掷的重复骰语义，防止 UI 允许提交后服务端再丢弃', () => {
        const malformedInteraction: InteractionDescriptor = {
            id: 'bonus-group-repeat-is-invalid',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                allowedDieIds: [0, 1],
                meta: {
                    dtType: 'selectDie',
                    selectionMode: 'bonusGroupReroll',
                    allowRepeatedDieSelection: true,
                    selectCount: 2,
                },
            },
        };

        expect(getDiceInteractionMeta(malformedInteraction)).toBeUndefined();
    });

    it.each([
        {
            id: 'selection-outside-candidates',
            interaction: {
                id: 'selection-outside-candidates', kind: 'multistep-choice', playerId: '0',
                data: { allowedDieIds: [0], meta: { dtType: 'selectDie', selectionMode: 'reroll', selectCount: 1, targetOpponentDice: false } },
            } as InteractionDescriptor,
            result: { selectedDiceIds: [1] },
            message: 'Invalid current die selection',
        },
        {
            id: 'selection-reuses-completed-die',
            interaction: {
                id: 'selection-reuses-completed-die', kind: 'multistep-choice', playerId: '0',
                data: {
                    allowedDieIds: [0, 1], completedDieIds: [0], completedSteps: 1,
                    meta: { dtType: 'selectDie', selectionMode: 'reroll', selectCount: 2, targetOpponentDice: false },
                },
            } as InteractionDescriptor,
            result: { selectedDiceIds: [0] },
            message: 'Invalid current die selection',
        },
        {
            id: 'modify-count-mismatch',
            interaction: {
                id: 'modify-count-mismatch', kind: 'multistep-choice', playerId: '0',
                data: { allowedDieIds: [0], meta: { dtType: 'modifyDie', dieModifyConfig: { mode: 'any' }, selectCount: 1, targetOpponentDice: false } },
            } as InteractionDescriptor,
            result: { modifications: { 0: 4 }, modCount: 0, totalAdjustment: 0 },
            message: 'Invalid current die modification',
        },
        {
            id: 'modify-reuses-completed-die',
            interaction: {
                id: 'modify-reuses-completed-die', kind: 'multistep-choice', playerId: '0',
                data: {
                    allowedDieIds: [0, 1], completedDieIds: [0], completedSteps: 1,
                    meta: { dtType: 'modifyDie', dieModifyConfig: { mode: 'any' }, selectCount: 2, targetOpponentDice: false },
                },
            } as InteractionDescriptor,
            result: { modifications: { 0: 4 }, modCount: 1, totalAdjustment: 0 },
            message: 'Invalid current die modification',
        },
        {
            id: 'adjustment-outside-contract',
            interaction: {
                id: 'adjustment-outside-contract', kind: 'multistep-choice', playerId: '0',
                data: { allowedDieIds: [0], meta: { dtType: 'modifyDie', dieModifyConfig: { mode: 'adjust', adjustRange: { min: -1, max: 1 } }, selectCount: 1, targetOpponentDice: false } },
            } as InteractionDescriptor,
            result: { modifications: { 0: 4 }, modCount: 1, totalAdjustment: 2 },
            message: 'Invalid current die modification',
        },
    ])('拒绝超出规则候选或进度的当前控制器结果：$id', ({ interaction, result, message }) => {
        const controller = {
            result,
            stepCount: 0,
            canConfirm: true,
            step: () => undefined,
            confirm: () => undefined,
            cancel: () => undefined,
        } as never;

        expect(() => createDiceInteractionContract({ interaction, controller, rootPlayerId: '0' })).toThrow(message);
    });

    it('组重掷必须声明实际奖励骰候选，不把空候选扩成全骰盘', () => {
        const interaction: InteractionDescriptor = {
            id: 'bonus-group-without-candidates',
            kind: 'multistep-choice',
            playerId: '0',
            data: {
                meta: {
                    dtType: 'selectDie',
                    selectionMode: 'bonusGroupReroll',
                    selectCount: 2,
                    targetOpponentDice: false,
                },
            },
        };
        const controller = {
            result: { selectedDiceIds: [] },
            stepCount: 0,
            canConfirm: true,
            step: () => undefined,
            confirm: () => undefined,
            cancel: () => undefined,
        };

        expect(() => createDiceInteractionContract({
            interaction,
            controller,
            rootPlayerId: '0',
            isBonusDiceSettlement: true,
        })).toThrow(/requires explicit die candidates/);
    });
});
