import { describe, expect, it } from 'vitest';
import {
    diagnoseChoiceRequestForAi,
    filterChoiceRequestForPlayer,
    projectChoiceRequestToAiLegalActions,
    validateChoiceRequest,
    type ChoiceRequest,
} from '../ChoiceRequest';
import { createSimpleChoiceFromChoiceRequest } from '../systems';

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
        const interaction = createSimpleChoiceFromChoiceRequest(createTargetChoiceRequest(), {
            title: '选择目标',
            targetType: 'minion',
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
        expect(interaction.data.options[0].value).toEqual({ targetId: 'a' });
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
    });
});
