import { describe, expect, it } from 'vitest';
import {
    buildChoiceRequestDiagnosticSnapshot,
    diagnoseChoiceRequestForAi,
    filterChoiceRequestForPlayer,
    projectChoiceRequestToAiLegalActions,
    validateChoiceRequest,
    type ChoiceRequest,
} from '../ChoiceRequest';
import {
    createSimpleChoiceFromChoiceRequest,
    projectChoiceRequestToConfirmCurrentAction,
    projectChoiceRequestToDiceConfirmationSurface,
    projectChoiceRequestToDirectSelectionTargets,
} from '../systems';

const createTargetChoiceRequest = (): ChoiceRequest<{ targetId: string }> => ({
    requestId: 'choose-target',
    gameId: 'test-game',
    playerId: 'p1',
    ownerFrameId: 'frame-1',
    kind: 'select-object',
    sourceId: 'test-source',
    selection: { min: 1, max: 1 },
    skipPolicy: 'optional',
    recoveryAction: {
        id: 'skip',
        kind: 'choice-skip',
        label: '跳过',
        commands: [{
            type: 'TEST_SKIP',
            payload: { requestId: 'choose-target' },
        }],
    },
    resolution: {
        type: 'interaction-response',
    },
    ai: {
        status: 'game-policy',
        policyId: 'test-target-policy',
    },
    candidates: [
        {
            id: 'target-a',
            label: '目标 A',
            value: { targetId: 'a' },
            aiHints: [{ targetKind: 'minion', relationToActor: 'enemy' }],
        },
        {
            id: 'target-b',
            label: '目标 B',
            value: { targetId: 'b' },
            disabled: true,
            disabledReason: '距离不足',
        },
    ],
});

describe('ChoiceRequest', () => {
    it('从 Choice Request 生成 AI legalActions，并保留显式跳过动作', () => {
        const request = createTargetChoiceRequest();
        const result = projectChoiceRequestToAiLegalActions(request);

        expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(result.actions.map((action) => action.kind)).toEqual(['choice-select-object', 'choice-skip']);
        expect(result.actions[0]).toMatchObject({
            actionId: 'choice-request:choose-target:select-object:target-a',
            label: '目标 A',
            commands: [{
                type: 'SYS_INTERACTION_RESPOND',
                payload: {
                    interactionId: 'choose-target',
                    optionId: 'target-a',
                },
            }],
            metadata: {
                requestId: 'choose-target',
                choiceKind: 'select-object',
                sourceId: 'test-source',
            },
        });
        expect(result.actions[0].aiHints).toEqual([{ targetKind: 'minion', relationToActor: 'enemy' }]);
        expect(result.actions[1].commands[0].type).toBe('TEST_SKIP');
    });

    it('必选但没有启用候选且没有恢复动作时，校验直接报错', () => {
        const request: ChoiceRequest = {
            requestId: 'empty-required',
            playerId: 'p1',
            ownerFrameId: 'frame-1',
            kind: 'choose-option',
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'interaction-response' },
            ai: { status: 'shared-policy' },
            candidates: [],
        };

        expect(validateChoiceRequest(request)).toContainEqual(expect.objectContaining({
            severity: 'error',
            code: 'mandatory-choice-unsatisfied',
        }));
        expect(projectChoiceRequestToAiLegalActions(request).actions).toEqual([]);
    });

    it('可跳过的空候选请求生成显式恢复动作', () => {
        const request: ChoiceRequest = {
            requestId: 'optional-empty',
            playerId: 'p1',
            ownerFrameId: 'frame-1',
            kind: 'optional-skip',
            selection: { min: 1, max: 1 },
            skipPolicy: 'optional',
            recoveryAction: {
                label: '跳过',
                commands: [{ type: 'TEST_SKIP', payload: { ok: true } }],
            },
            resolution: { type: 'interaction-response' },
            ai: { status: 'shared-policy' },
            candidates: [],
        };

        const result = projectChoiceRequestToAiLegalActions(request);

        expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(result.actions).toHaveLength(1);
        expect(result.actions[0]).toMatchObject({
            kind: 'choice-request-recovery',
            commands: [{ type: 'TEST_SKIP', payload: { ok: true } }],
        });
    });

    it('有序多选必须保留 AI 枚举顺序并写入命令 payload', () => {
        const request: ChoiceRequest = {
            requestId: 'ordered-choice',
            playerId: 'p1',
            ownerFrameId: 'frame-1',
            kind: 'choose-option',
            selection: { min: 2, max: 2, ordered: true },
            skipPolicy: 'forbidden',
            resolution: { type: 'interaction-response' },
            ai: { status: 'shared-policy' },
            candidates: [
                { id: 'a', label: 'A' },
                { id: 'b', label: 'B' },
            ],
        };

        const actions = projectChoiceRequestToAiLegalActions(request).actions;

        expect(actions.map((action) => action.actionId)).toEqual([
            'choice-request:ordered-choice:choose-option:a:b',
            'choice-request:ordered-choice:choose-option:b:a',
        ]);
        expect(actions.map((action) => action.commands[0].payload)).toEqual([
            { interactionId: 'ordered-choice', optionIds: ['a', 'b'] },
            { interactionId: 'ordered-choice', optionIds: ['b', 'a'] },
        ]);
    });

    it('候选可按玩家可见性过滤，避免把私有选项投给错误座位', () => {
        const request: ChoiceRequest = {
            requestId: 'private-choice',
            playerId: 'p1',
            ownerFrameId: 'frame-1',
            kind: 'select-card',
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'interaction-response' },
            ai: { status: 'shared-policy' },
            candidates: [
                { id: 'public-card' },
                { id: 'private-card', visibleToPlayerIds: ['p1'] },
            ],
        };

        expect(filterChoiceRequestForPlayer(request, 'p1').candidates.map((candidate) => candidate.id))
            .toEqual(['public-card', 'private-card']);
        expect(filterChoiceRequestForPlayer(request, 'p2').candidates.map((candidate) => candidate.id))
            .toEqual(['public-card']);
    });

    it('重复候选 ID 会作为请求不变量错误暴露', () => {
        const request: ChoiceRequest = {
            requestId: 'duplicate-choice',
            playerId: 'p1',
            ownerFrameId: 'frame-1',
            kind: 'choose-option',
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'interaction-response' },
            ai: { status: 'shared-policy' },
            candidates: [{ id: 'same' }, { id: 'same' }],
        };

        expect(validateChoiceRequest(request)).toContainEqual(expect.objectContaining({
            severity: 'error',
            code: 'duplicate-candidate-id',
        }));
    });

    it('stale 候选会被诊断并排除出 AI 动作', () => {
        const request: ChoiceRequest = {
            requestId: 'stale-choice',
            playerId: 'p1',
            ownerFrameId: 'frame-1',
            kind: 'choose-option',
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'interaction-response' },
            ai: { status: 'shared-policy' },
            candidates: [
                { id: 'fresh', label: 'Fresh' },
                { id: 'stale', label: 'Stale', stale: true },
            ],
        };

        const result = projectChoiceRequestToAiLegalActions(request);

        expect(result.diagnostics).toContainEqual(expect.objectContaining({
            severity: 'warning',
            code: 'stale-candidate',
        }));
        expect(result.actions.map((action) => action.commands[0].payload)).toEqual([
            { interactionId: 'stale-choice', optionId: 'fresh' },
        ]);
    });

    it('AI 策略缺失时诊断为 missing-policy，而不是伪装成空闲', () => {
        const request = createTargetChoiceRequest();

        expect(diagnoseChoiceRequestForAi(request)).toMatchObject({
            status: 'missing-policy',
            requestId: 'choose-target',
            choiceKind: 'select-object',
            policyId: 'test-target-policy',
        });
        expect(diagnoseChoiceRequestForAi(request, {
            registeredGamePolicyIds: ['test-target-policy'],
        })).toMatchObject({
            status: 'ok',
            policyId: 'test-target-policy',
        });
    });

    it('共享 AI 策略必须来自注册表，未知 shared policy 不能静默放行', () => {
        const request = createTargetChoiceRequest();
        request.ai = {
            status: 'shared-policy',
            policyId: 'unknown-shared-policy',
        };

        expect(diagnoseChoiceRequestForAi(request)).toMatchObject({
            status: 'missing-policy',
            policyId: 'unknown-shared-policy',
        });
        expect(diagnoseChoiceRequestForAi(request, {
            registeredSharedPolicyIds: ['unknown-shared-policy'],
        })).toMatchObject({
            status: 'ok',
            policyId: 'unknown-shared-policy',
        });
    });

    it('未显式 policyId 的共享 AI 策略会解析到内置 generic policy', () => {
        const request = createTargetChoiceRequest();
        request.ai = { status: 'shared-policy' };

        expect(diagnoseChoiceRequestForAi(request)).toMatchObject({
            status: 'ok',
            policyId: 'choice-request:simple-target',
        });
    });

    it('明确 unsupported 的 AI 请求会诊断为 unsupported', () => {
        const request = createTargetChoiceRequest();
        request.ai = {
            status: 'unsupported',
            reason: '该选择需要真人判断',
        };

        expect(diagnoseChoiceRequestForAi(request)).toMatchObject({
            status: 'unsupported',
            requestId: 'choose-target',
            reason: '该选择需要真人判断',
        });
    });

    it('simple-choice adapter 只投影 Choice Request，不重新拥有候选语义', () => {
        const request = createTargetChoiceRequest();
        request.candidates[0].labelKey = 'test.targetA';
        request.candidates[0].description = '目标 A 的说明';

        const interaction = createSimpleChoiceFromChoiceRequest(request, {
            title: '选择目标',
            titleKey: 'test.chooseTarget',
            subtitle: '补充说明',
            targetType: 'minion',
            autoResolveIfSingle: true,
            allowedCommands: ['TEST_COMMAND'],
        });

        expect(interaction).toMatchObject({
            id: 'choose-target',
            kind: 'simple-choice',
            playerId: 'p1',
            ai: {
                status: 'semantic',
            },
        });
        expect((interaction.data.options ?? []).map((option) => option.id)).toEqual(['target-a', 'target-b']);
        expect(interaction.data).toMatchObject({
            title: 'test.chooseTarget',
            titleKey: 'test.chooseTarget',
            subtitle: '补充说明',
            targetType: 'minion',
            autoResolveIfSingle: true,
            allowedCommands: ['TEST_COMMAND'],
        });
        expect(interaction.data.options[0]).toMatchObject({
            label: 'test.targetA',
            labelKey: 'test.targetA',
            description: '目标 A 的说明',
            value: { targetId: 'a' },
        });
        expect(interaction.data.ai?.decisions?.[0]).toMatchObject({
            kind: 'select-object',
            interactionId: 'choose-target',
            actorPlayerId: 'p1',
            sourceId: 'test-source',
            selection: { min: 1, max: 1 },
            candidates: [
                expect.objectContaining({ id: 'target-a', value: { targetId: 'a' } }),
                expect.objectContaining({ id: 'target-b', disabled: true }),
            ],
        });
        expect(interaction.data.choiceRequest).toMatchObject({
            requestId: 'choose-target',
            choiceKind: 'select-object',
            sourceId: 'test-source',
            aiDiagnosticStatus: 'missing-policy',
            policyId: 'test-target-policy',
            candidateSummary: {
                total: 2,
                enabledCandidateIds: ['target-a'],
                disabledCandidateIds: ['target-b'],
            },
        });
    });

    it('diagnostic snapshot 只汇总请求与候选状态，不替 watchdog 选择业务目标', () => {
        const request = createTargetChoiceRequest();
        request.ai = { status: 'shared-policy' };
        request.skipPolicy = 'forbidden';
        request.recoveryAction = undefined;
        request.candidates[0].disabled = true;
        request.candidates[0].disabledReason = '目标已经离场';

        const snapshot = buildChoiceRequestDiagnosticSnapshot(request);

        expect(snapshot).toMatchObject({
            requestId: 'choose-target',
            choiceKind: 'select-object',
            aiDiagnosticStatus: 'invalid-request',
            diagnostics: [expect.objectContaining({ code: 'mandatory-choice-unsatisfied' })],
            candidateSummary: {
                total: 2,
                enabledCandidateIds: [],
                disabledCandidateIds: ['target-a', 'target-b'],
            },
            projectedLegalActionCount: 0,
        });
        expect(JSON.stringify(snapshot)).not.toContain('optionId');
    });

    it('direct adapter 把候选投给棋盘/场地 UI，但不重新拥有候选真相', () => {
        const request = createTargetChoiceRequest();
        request.ai = { status: 'shared-policy' };

        const surface = projectChoiceRequestToDirectSelectionTargets(request);

        expect(surface).toMatchObject({
            requestId: 'choose-target',
            playerId: 'p1',
            kind: 'select-object',
            sourceId: 'test-source',
            selection: { min: 1, max: 1 },
        });
        expect(surface.targets.map((target) => ({
            id: target.id,
            targetRef: target.targetRef,
            disabled: target.disabled,
            commandPreview: target.commandPreview,
        }))).toEqual([
            {
                id: 'target-a',
                targetRef: 'a',
                disabled: false,
                commandPreview: [{
                    type: 'SYS_INTERACTION_RESPOND',
                    payload: { interactionId: 'choose-target', optionId: 'target-a' },
                }],
            },
            {
                id: 'target-b',
                targetRef: 'b',
                disabled: true,
                commandPreview: [{
                    type: 'SYS_INTERACTION_RESPOND',
                    payload: { interactionId: 'choose-target', optionId: 'target-b' },
                }],
            },
        ]);
    });

    it('direct adapter 优先把目标字段投给棋盘，而不是误用来源对象', () => {
        const request: ChoiceRequest<{ objectId: string; targetObjectId: string }> = {
            ...createTargetChoiceRequest(),
            candidates: [{
                id: 'heal-target',
                label: '治疗目标',
                value: {
                    objectId: 'source-cleric',
                    targetObjectId: 'wounded-cat',
                },
                commands: [{
                    type: 'USE_OBJECT_ABILITY',
                    payload: {
                        objectId: 'source-cleric',
                        targetObjectId: 'wounded-cat',
                    },
                }],
            }],
            resolution: { type: 'candidate-commands' },
        };

        const surface = projectChoiceRequestToDirectSelectionTargets(request);

        expect(surface.targets).toHaveLength(1);
        expect(surface.targets[0]).toMatchObject({
            id: 'heal-target',
            targetRef: 'wounded-cat',
            commandPreview: [{
                type: 'USE_OBJECT_ABILITY',
                payload: {
                    objectId: 'source-cleric',
                    targetObjectId: 'wounded-cat',
                },
            }],
        });
    });

    it('select-zone 使用同一份 Choice Request 投给区域 UI 和 AI', () => {
        const request: ChoiceRequest<{ targetZoneId: string }> = {
            requestId: 'choose-zone',
            gameId: 'test-game',
            playerId: 'p1',
            ownerFrameId: 'frame-1',
            kind: 'select-zone',
            sourceId: 'test-zone-spell',
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'candidate-commands' },
            ai: { status: 'shared-policy' },
            candidates: [{
                id: 'target-zone-a1',
                label: 'A1',
                value: { targetZoneId: 'a1' },
                commands: [{
                    type: 'CAST_SPELL',
                    payload: { spellCardId: 1913, targetZoneId: 'a1' },
                }],
            }],
        };

        const surface = projectChoiceRequestToDirectSelectionTargets(request);
        expect(surface).toMatchObject({
            requestId: 'choose-zone',
            kind: 'select-zone',
            targets: [{
                id: 'target-zone-a1',
                targetRef: 'a1',
                commandPreview: [{
                    type: 'CAST_SPELL',
                    payload: { spellCardId: 1913, targetZoneId: 'a1' },
                }],
            }],
        });

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions).toHaveLength(1);
        expect(legalActions.actions[0]).toMatchObject({
            actionId: 'choice-request:choose-zone:select-zone:target-zone-a1',
            kind: 'choice-select-zone',
            commands: [{
                type: 'CAST_SPELL',
                payload: { spellCardId: 1913, targetZoneId: 'a1' },
            }],
            metadata: {
                requestId: 'choose-zone',
                choiceKind: 'select-zone',
                sourceId: 'test-zone-spell',
            },
        });
    });

    it('select-position 可以把边界或格点投给直接选择 UI', () => {
        const request: ChoiceRequest<{ targetWallEdgeId: string }> = {
            requestId: 'choose-wall-edge',
            gameId: 'test-game',
            playerId: 'p1',
            ownerFrameId: 'frame-1',
            kind: 'select-position',
            sourceId: 'test-wall-spell',
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'candidate-commands' },
            ai: { status: 'shared-policy' },
            candidates: [{
                id: 'target-wall-edge-a3-b3',
                label: 'A3-B3',
                value: { targetWallEdgeId: 'a3-b3' },
                commands: [{
                    type: 'CAST_SPELL',
                    payload: { spellCardId: 25700, targetWallEdgeId: 'a3-b3' },
                }],
            }],
        };

        const surface = projectChoiceRequestToDirectSelectionTargets(request);
        expect(surface.targets).toEqual([expect.objectContaining({
            id: 'target-wall-edge-a3-b3',
            targetRef: 'a3-b3',
            commandPreview: [{
                type: 'CAST_SPELL',
                payload: { spellCardId: 25700, targetWallEdgeId: 'a3-b3' },
            }],
        })]);

        const legalActions = projectChoiceRequestToAiLegalActions(request);
        expect(legalActions.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
        expect(legalActions.actions[0]).toMatchObject({
            actionId: 'choice-request:choose-wall-edge:select-position:target-wall-edge-a3-b3',
            kind: 'choice-select-position',
            commands: [{
                type: 'CAST_SPELL',
                payload: { spellCardId: 25700, targetWallEdgeId: 'a3-b3' },
            }],
        });
    });

    it('direct adapter 优先把绑定法术字段投给卡牌 UI，而不是误用来源装备', () => {
        const request: ChoiceRequest<{ objectId: string; boundSpellCardId: number }> = {
            ...createTargetChoiceRequest(),
            kind: 'select-card',
            candidates: [{
                id: 'bind-spell',
                label: '绑定法术',
                value: {
                    objectId: 'source-staff',
                    boundSpellCardId: 1705,
                },
                commands: [{
                    type: 'USE_OBJECT_ABILITY',
                    payload: {
                        objectId: 'source-staff',
                        boundSpellCardId: 1705,
                    },
                }],
            }],
            resolution: { type: 'candidate-commands' },
        };

        const surface = projectChoiceRequestToDirectSelectionTargets(request);

        expect(surface.targets).toHaveLength(1);
        expect(surface.targets[0]).toMatchObject({
            id: 'bind-spell',
            targetRef: 1705,
            commandPreview: [{
                type: 'USE_OBJECT_ABILITY',
                payload: {
                    objectId: 'source-staff',
                    boundSpellCardId: 1705,
                },
            }],
        });
    });

    it('confirm-current / dice surface 只暴露声明的确认命令和骰子候选', () => {
        const request: ChoiceRequest<{ dieId: number }> = {
            requestId: 'confirm-dice',
            playerId: 'p1',
            ownerFrameId: 'roll-frame',
            kind: 'select-dice',
            sourceId: 'dice-confirm',
            selection: { min: 0, max: 2 },
            skipPolicy: 'confirm-current',
            recoveryAction: {
                id: 'confirm',
                label: '确认当前骰面',
                commands: [{ type: 'CONFIRM_DICE', payload: { scope: 'current-roll' } }],
            },
            resolution: { type: 'interaction-response' },
            ai: { status: 'shared-policy' },
            candidates: [
                { id: 'die-1', label: '骰子 1', value: { dieId: 1 } },
                { id: 'die-2', label: '骰子 2', value: { dieId: 2 } },
            ],
        };

        const confirm = projectChoiceRequestToConfirmCurrentAction(request);
        const surface = projectChoiceRequestToDiceConfirmationSurface(request);

        expect(confirm.action).toMatchObject({
            requestId: 'confirm-dice',
            label: '确认当前骰面',
            commands: [{ type: 'CONFIRM_DICE', payload: { scope: 'current-roll' } }],
        });
        expect(surface.diceTargets.map((target) => target.targetRef)).toEqual([1, 2]);
        expect(surface.confirmAction?.commands).toEqual([
            { type: 'CONFIRM_DICE', payload: { scope: 'current-roll' } },
        ]);
    });
});
