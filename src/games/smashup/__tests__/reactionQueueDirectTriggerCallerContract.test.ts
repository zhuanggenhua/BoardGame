import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SMASHUP_ROOT = join(__dirname, '..');

function collectProductionSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'rule') return [];
      return collectProductionSourceFiles(fullPath);
    }
    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) return [];
    return [fullPath];
  });
}

describe('direct trigger caller contract', () => {
  it('生产代码不得新增未审计的 fireTriggerForSource 直执行入口', () => {
    const callers = collectProductionSourceFiles(SMASHUP_ROOT)
      .flatMap((file) => {
        const rel = relative(SMASHUP_ROOT, file).replace(/\\/g, '/');
        const text = readFileSync(file, 'utf8');
        return [...text.matchAll(/\bfireTriggerForSource\s*\(/g)].map((match) => ({
          rel,
          text,
          index: match.index ?? 0,
        }));
      })
      .filter(({ rel }) => rel !== 'domain/ongoingEffects.ts');

    expect(callers.map(({ rel }) => rel)).toEqual(['domain/index.ts']);
    expect(callers).toHaveLength(1);

    const [{ text, index }] = callers;
    const functionStart = text.lastIndexOf('function processImmediateStartTurnMinionTriggers', index);
    expect(functionStart).toBeGreaterThanOrEqual(0);
    const localContext = text.slice(Math.max(0, index - 1200), index + 1200);
    expect(localContext).toContain('playedEvent.payload.defId');
    expect(localContext).toContain("'onTurnStart'");
    expect(localContext).toContain('skipImmediateStartTurnMinionTriggers: true');
  });

  it('startTurn 即时触发链不得通过通用 reduce 预演整局状态', () => {
    const indexPath = join(SMASHUP_ROOT, 'domain', 'index.ts');
    const text = readFileSync(indexPath, 'utf8');
    const functionStart = text.indexOf('function processImmediateStartTurnMinionTriggers');
    expect(functionStart).toBeGreaterThanOrEqual(0);
    const nextFunctionStart = text.indexOf('\nfunction ', functionStart + 1);
    const functionBody = text.slice(functionStart, nextFunctionStart);

    expect(functionBody).not.toContain('applyEventsForStartTurnSimulation');
    expect(functionBody).not.toContain('reduce(');
  });

  it('startTurn/endTurn 生产 phase hook 解 reaction queue 必须只走提交屏障入口', () => {
    const indexPath = join(SMASHUP_ROOT, 'domain', 'index.ts');
    const text = readFileSync(indexPath, 'utf8');

    expect(text).toContain('const startTurnCore = reduceTurnStartedEvent(core, turnStarted)');
    expect(text).not.toContain('const startTurnCore = reduce(core, turnStarted)');
    expect(text).not.toContain('maybeResolveReactionQueue(currentMatchState, random, now, { suspendAfterDomainEvents: true })');
    expect([...text.matchAll(/maybeResolveReactionQueue\(currentMatchState, random, now\)/g)]).toHaveLength(2);

    const reactionQueuePath = join(SMASHUP_ROOT, 'domain', 'reactionQueue.ts');
    const reactionSessionPath = join(SMASHUP_ROOT, 'domain', 'reactionSession.ts');
    const reactionQueueText = readFileSync(reactionQueuePath, 'utf8');
    const reactionSessionText = readFileSync(reactionSessionPath, 'utf8');
    expect(reactionQueueText).toContain('export function maybeResolveReactionQueue');
    expect(reactionQueueText).not.toContain('maybeResolveReactionQueueSuspendingDomainEvents');
    expect(reactionQueueText).not.toContain('SUSPEND_SMASHUP_REACTION_DOMAIN_EVENTS');
    expect(reactionSessionText).not.toContain('SUSPEND_SMASHUP_REACTION_DOMAIN_EVENTS');
    expect(reactionSessionText).not.toContain('resolveSmashUpReactionChoiceSuspendingDomainEvents');
    expect(reactionSessionText).not.toContain('suspendAfterDomainEvents');

    const endTurnCallIndex = text.indexOf('processDestroyMoveCycle(rq.events, rq.state, pid, random, now, {');
    expect(endTurnCallIndex).toBeGreaterThanOrEqual(0);
    const endTurnContext = text.slice(endTurnCallIndex, endTurnCallIndex + 240);
    expect(endTurnContext).toContain('skipReactionQueueResolution: true');

    const immediateStartTurnContext = text.slice(
      text.indexOf('const processedImmediate = postProcessSystemEvents('),
      text.indexOf('const recursiveResult = processImmediateStartTurnMinionTriggers('),
    );
    expect(immediateStartTurnContext).toContain('skipReactionQueueResolution: true');
  });

  it('生产代码不得绕过 reactionQueue 正式入口手写挂起参数', () => {
    const offenders = collectProductionSourceFiles(SMASHUP_ROOT)
      .map((file) => {
        const rel = relative(SMASHUP_ROOT, file).replace(/\\/g, '/');
        const text = readFileSync(file, 'utf8');
        const matches = [
          ...text.matchAll(/maybeResolveReactionQueue\([\s\S]{0,240}?suspendAfterDomainEvents:\s*true/g),
          ...text.matchAll(/resolveSmashUpReactionChoice\([\s\S]{0,240}?suspendAfterDomainEvents:\s*true/g),
        ];
        return { rel, matches: matches.length };
      })
      .filter(({ matches }) => matches > 0);

    expect(offenders).toEqual([]);
  });

  it('生产代码不得恢复旧的 preview core / prompt merge 拼状态入口', () => {
    const forbidden = [
      'buildPreviewStateWithPendingDomainEvents',
      'mergePromptResultCoreWithPreEventState',
      'previewCore',
      'projectedCore',
      'preEventState',
    ];
    const offenders = collectProductionSourceFiles(SMASHUP_ROOT)
      .flatMap((file) => {
        const rel = relative(SMASHUP_ROOT, file).replace(/\\/g, '/');
        const text = readFileSync(file, 'utf8');
        return forbidden
          .filter((token) => text.includes(token))
          .map((token) => ({ rel, token }));
      });

    expect(offenders).toEqual([]);
  });

  it('计分 post-reduce 等待状态不得再用 sys flag 或 session step 表示', () => {
    const forbidden = [
      '_waitForPostScoringReduce',
      'awaiting-post-reduce',
    ];
    const offenders = collectProductionSourceFiles(SMASHUP_ROOT)
      .flatMap((file) => {
        const rel = relative(SMASHUP_ROOT, file).replace(/\\/g, '/');
        const text = readFileSync(file, 'utf8');
        return forbidden
          .filter((token) => text.includes(token))
          .map((token) => ({ rel, token }));
      });

    expect(offenders).toEqual([]);
  });

  it('startTurn/scoreBases 自动推进不得再使用 Smash Up 私有待归约 sys flag', () => {
    const forbidden = [
      '_waitForStartTurnInteractionReduce',
      '_waitForScoreBasesInteractionReduce',
    ];
    const offenders = collectProductionSourceFiles(SMASHUP_ROOT)
      .flatMap((file) => {
        const rel = relative(SMASHUP_ROOT, file).replace(/\\/g, '/');
        const text = readFileSync(file, 'utf8');
        return forbidden
          .filter((token) => text.includes(token))
          .map((token) => ({ rel, token }));
      });

    expect(offenders).toEqual([]);
  });

  it('生产 scoreBases phase hook 必须通过 session-first 入口计分', () => {
    const indexPath = join(SMASHUP_ROOT, 'domain', 'index.ts');
    const text = readFileSync(indexPath, 'utf8');
    const scoreBasesStart = text.indexOf("if (from === 'scoreBases')");
    expect(scoreBasesStart).toBeGreaterThanOrEqual(0);
    const drawStart = text.indexOf("if (phase === 'draw')", scoreBasesStart);
    expect(drawStart).toBeGreaterThan(scoreBasesStart);
    const scoreBasesBody = text.slice(scoreBasesStart, drawStart);

    expect(text).toContain('function scoreCurrentSessionBase');
    expect(scoreBasesBody).toContain('scoreCurrentSessionBase(currentState, activeBaseIndex, pid, now, random)');
    expect(scoreBasesBody).not.toContain('scoreOneBase(');
  });

  it('deferred cleanup 和 replacement 只能由 scoring frame 驱动器补发', () => {
    const indexPath = join(SMASHUP_ROOT, 'domain', 'index.ts');
    const scoringFinalizationPath = join(SMASHUP_ROOT, 'domain', 'scoringFinalization.ts');
    const systemsPath = join(SMASHUP_ROOT, 'domain', 'systems.ts');
    const interactionSystemPath = join(__dirname, '..', '..', '..', 'engine', 'systems', 'InteractionSystem.ts');
    const indexText = readFileSync(indexPath, 'utf8');
    const scoringFinalizationText = readFileSync(scoringFinalizationPath, 'utf8');
    const systemsText = readFileSync(systemsPath, 'utf8');
    const interactionText = readFileSync(interactionSystemPath, 'utf8');

    expect(scoringFinalizationText).toContain('function finalizeCurrentScoringBase');
    expect(scoringFinalizationText).toContain('consumeScoringFrameDeferredPayload(state)');
    expect(indexText).toContain("currentStep === 'awaiting-post-scoring-finalize'");

    expect(systemsText).not.toContain('getDeferredPostScoringEvents');
    expect(systemsText).not.toContain('isScoringSessionAwaitingDeferredResolution');
    expect(systemsText).not.toContain('SmashUp deferred post-scoring payload');
    expect(systemsText).not.toContain('补发延迟的 BASE_CLEARED/BASE_REPLACED 事件');

    expect(interactionText).not.toContain('_deferredPostScoringEvents');
    expect(interactionText).not.toContain('BASE_CLEARED');
    expect(interactionText).not.toContain('BASE_REPLACED');
    expect(interactionText).not.toMatch(/smashup/i);
  });

  it('计分清场换基地不得再把视觉 reveal delay 写入规则状态', () => {
    const forbidden = [
      '_smashupPostScoringBaseRevealDelayUntil',
      'awaiting-post-scoring-delay',
      'POST_SCORING_BASE_REVEAL_DELAY',
      'beginPostScoringBaseRevealDelay',
      'isPostScoringBaseRevealDelayActive',
      'clearPostScoringBaseRevealDelay',
    ];
    const offenders = collectProductionSourceFiles(SMASHUP_ROOT)
      .flatMap((file) => {
        const rel = relative(SMASHUP_ROOT, file).replace(/\\/g, '/');
        const text = readFileSync(file, 'utf8');
        return forbidden
          .filter((token) => text.includes(token))
          .map((token) => ({ rel, token }));
      });

    expect(offenders).toEqual([]);
  });

  it('Smash Up 响应内容判定必须复用 ReactionSession 真实选项生成入口', () => {
    const gameText = readFileSync(join(SMASHUP_ROOT, 'game.ts'), 'utf8');
    const overlayText = readFileSync(join(SMASHUP_ROOT, 'ui', 'MeFirstOverlay.tsx'), 'utf8');
    const reactionSessionText = readFileSync(join(SMASHUP_ROOT, 'domain', 'reactionSession.ts'), 'utf8');
    const forbidden = [
      'canCardBePlayedInResponseWindow',
      'getResponseWindowPlayableBaseIndicesForCard',
      'getResponseWindowPlayableBaseIndicesForMatchState',
      'isOperationRestricted',
      'getActionPlayRestrictionError',
      'getMinionPlayRestrictionError',
      'responseProbeState',
      'SmashUpDomain.validate(responseProbeState',
      'hasValidatedResponseOption',
    ];

    for (const text of [gameText, overlayText]) {
      for (const token of forbidden) {
        expect(text).not.toContain(token);
      }
    }
    expect(gameText).not.toContain('createResponseWindowSystem');
    expect(overlayText).toContain('getSmashUpReactionWindowPresentation');
    expect(overlayText).toContain('reactionWindow.showsPassWindow');
    expect(reactionSessionText).toContain('function buildPlayableCardOptions');
    expect(reactionSessionText).toContain('export function hasSmashUpResponderDrivenReactionOptions');
  });

  it('计分响应窗口不得再通过旧 helper 发通用 RESPONSE_WINDOW_OPENED', () => {
    const forbidden = [
      'openMeFirstWindow',
      'openAfterScoringWindow',
      'RESPONSE_WINDOW_EVENTS.OPENED',
    ];
    const offenders = collectProductionSourceFiles(SMASHUP_ROOT)
      .flatMap((file) => {
        const rel = relative(SMASHUP_ROOT, file).replace(/\\/g, '/');
        const text = readFileSync(file, 'utf8');
        return forbidden
          .filter((token) => text.includes(token))
          .map((token) => ({ rel, token }));
      });

    expect(offenders).toEqual([]);
  });

  it('真人 UI 与 Smash Up AI 的正常 reaction pass 不得再发通用 RESPONSE_PASS', () => {
    const overlayPath = join(SMASHUP_ROOT, 'ui', 'MeFirstOverlay.tsx');
    const aiPath = join(SMASHUP_ROOT, 'ai.ts');
    const overlayText = readFileSync(overlayPath, 'utf8');
    const aiText = readFileSync(aiPath, 'utf8');

    expect(overlayText).toContain('dispatch(SU_COMMANDS.REACTION_PASS)');
    expect(overlayText).not.toContain("dispatch('RESPONSE_PASS')");

    const liveWindowStart = aiText.indexOf('if (reactionWindow) {');
    expect(liveWindowStart).toBeGreaterThanOrEqual(0);
    const liveWindowBody = aiText.slice(liveWindowStart, aiText.indexOf('return actions;', liveWindowStart));

    expect(liveWindowBody).toContain('type: SU_COMMANDS.REACTION_PASS');
    expect(liveWindowBody).not.toContain("type: 'RESPONSE_PASS'");
    expect(aiText).not.toContain('const responseWindow = state.sys.responseWindow?.current');
    expect(aiText).not.toContain("type: 'RESPONSE_PASS'");
    expect(aiText).not.toContain('hasBlockingLegacyResponseWindow');
  });

  it('live ReactionSession 不得再写入通用 ResponseWindow 镜像窗口', () => {
    const reactionSessionPath = join(SMASHUP_ROOT, 'domain', 'reactionSession.ts');
    const text = readFileSync(reactionSessionPath, 'utf8');

    expect(text).not.toContain('function buildMirroredResponseWindow');

    const setterStart = text.indexOf('export function setSmashUpReactionSession(');
    expect(setterStart).toBeGreaterThanOrEqual(0);
    const nextExport = text.indexOf('\nexport function startSmashUpReactionSession', setterStart);
    expect(nextExport).toBeGreaterThan(setterStart);
    const setterBody = text.slice(setterStart, nextExport);

    expect(setterBody).not.toContain('smashup_reaction_window_');
    expect(setterBody).not.toContain('buildMirroredResponseWindow');
    expect(setterBody).not.toContain('responderQueue');
    expect(setterBody).not.toContain('passedPlayers');
    expect(setterBody).not.toContain('responseWindow');
  });

  it('ResponseWindow 事件不得再桥接 ReactionSession pass', () => {
    const systemsPath = join(SMASHUP_ROOT, 'domain', 'systems.ts');
    const text = readFileSync(systemsPath, 'utf8');

    expect(text).toContain('function resolveReactionSessionPass');
    expect(text).toContain('event.type === SU_EVENT_TYPES.REACTION_PASS_REQUESTED');
    expect(text).not.toContain('function getSmashUpMirroredReactionWindowId');
    expect(text).not.toContain('function bridgeMirroredResponseWindowPassToReactionSession');
    expect(text).not.toContain("smashup_reaction_window_");
    expect(text).not.toContain('RESPONSE_WINDOW_EVENTS.RESPONDER_CHANGED');
    expect(text).not.toContain('RESPONSE_WINDOW_EVENTS.CLOSED');
    expect(text).not.toContain('const bridgedReactionPass = bridgeMirroredResponseWindowPassToReactionSession({');
    expect(text).not.toContain('handledReactionWindowIds');

    expect([...text.matchAll(/resolveSmashUpReactionPassRequest\(/g)]).toHaveLength(1);

    const afterEventsStart = text.indexOf('afterEvents: ({ state, events, random })');
    expect(afterEventsStart).toBeGreaterThanOrEqual(0);
    const bodyShopStart = text.indexOf('const bodyShopReconcile = reconcilePendingBodyShopDistributions', afterEventsStart);
    expect(bodyShopStart).toBeGreaterThan(afterEventsStart);
    const afterEventsLoopBody = text.slice(afterEventsStart, bodyShopStart);

    expect(afterEventsLoopBody).not.toContain("windowId.startsWith('smashup_reaction_window_')");
    expect(afterEventsLoopBody).not.toContain("{ kind: 'pass' } as any");
  });

  it('AI 结束阶段判断必须直接尊重 live ReactionSession，而不是只看展示窗口镜像', () => {
    const aiPath = join(SMASHUP_ROOT, 'ai.ts');
    const text = readFileSync(aiPath, 'utf8');

    expect(text).toMatch(/import\s*\{[\s\S]*getSmashUpReactionSession[\s\S]*\}\s*from\s*['"]\.\/domain\/reactionSession['"]/);

    const canAdvanceStart = text.indexOf('const canAdvancePhase = (state: SmashUpState, playerId: PlayerId): boolean => {');
    expect(canAdvanceStart).toBeGreaterThanOrEqual(0);
    const canAdvanceEnd = text.indexOf('\n};', canAdvanceStart);
    expect(canAdvanceEnd).toBeGreaterThan(canAdvanceStart);
    const canAdvanceBody = text.slice(canAdvanceStart, canAdvanceEnd);
    expect(canAdvanceBody).toContain('if (getSmashUpReactionSession(state)) return false;');

    const relativeUtilityStart = text.indexOf('const shouldApplySmashUpRelativeUtility = (context: AiDecisionContext): boolean => {');
    expect(relativeUtilityStart).toBeGreaterThanOrEqual(0);
    const relativeUtilityEnd = text.indexOf('\n};', relativeUtilityStart);
    expect(relativeUtilityEnd).toBeGreaterThan(relativeUtilityStart);
    const relativeUtilityBody = text.slice(relativeUtilityStart, relativeUtilityEnd);
    expect(relativeUtilityBody).toContain('if (getSmashUpReactionSession(state)) return false;');
  });

  it('清场后弃牌触发入队不得通过通用 reduce 预演整局状态', () => {
    const indexPath = join(SMASHUP_ROOT, 'domain', 'index.ts');
    const text = readFileSync(indexPath, 'utf8');
    const functionStart = text.indexOf('function queueBaseClearedMinionDiscardTriggers');
    expect(functionStart).toBeGreaterThanOrEqual(0);
    const nextFunctionStart = text.indexOf('\nfunction ', functionStart + 1);
    const functionBody = text.slice(functionStart, nextFunctionStart);

    expect(functionBody).toContain('applyTriggerQueueFactEvent(core, queued)');
    expect(functionBody).not.toContain('reduce(');
  });

  it('destroy 后处理为 reaction queue 建队列视图时只允许应用 triggerQueue 事实', () => {
    const reducerPath = join(SMASHUP_ROOT, 'domain', 'reducer.ts');
    const triggerQueueFactsPath = join(SMASHUP_ROOT, 'domain', 'triggerQueueFacts.ts');
    const text = readFileSync(reducerPath, 'utf8');
    const triggerQueueFactsText = readFileSync(triggerQueueFactsPath, 'utf8');

    expect(triggerQueueFactsText).toContain('export function applyTriggerQueueFactEvent');
    expect(text).not.toContain('function applyTriggerQueueFactEvent');
    expect(text).toContain("import { applyTriggerQueueFactEvent } from './triggerQueueFacts'");

    const functionStart = text.indexOf('export function processDestroyTriggers');
    expect(functionStart).toBeGreaterThanOrEqual(0);
    const queueViewStart = text.indexOf('// Attempt to auto-resolve reaction queue', functionStart);
    expect(queueViewStart).toBeGreaterThanOrEqual(0);
    const queueViewEnd = text.indexOf('const baseMS = ms ?? state;', queueViewStart);
    expect(queueViewEnd).toBeGreaterThan(queueViewStart);
    const queueViewBody = text.slice(queueViewStart, queueViewEnd);

    expect(queueViewBody).toContain('applyTriggerQueueFactEvent(coreForQueue, e)');
    expect(queueViewBody).not.toContain('reduce(');
  });
  it('reaction session 消费 trigger 时不得通过通用 reduce 预演整局状态', () => {
    const reactionSessionPath = join(SMASHUP_ROOT, 'domain', 'reactionSession.ts');
    const text = readFileSync(reactionSessionPath, 'utf8');

    expect(text).not.toContain("import { applyTriggerQueueFactEvent } from './triggerQueueFacts'");
    expect(text).not.toContain('applyTriggerQueueFactEvent(state.core, consumed)');
    expect(text).not.toContain('applyTriggerQueueFactEvent(nextState.core, consumed)');
    expect(text).not.toContain('applyPostProcessPrefixEvent(reducedCore, event)');
    expect(text).not.toContain('reducedCore');
    expect(text).not.toContain('reduce(state.core, consumed as unknown as SmashUpEvent)');
    expect(text).not.toContain('reduce(nextState.core, consumed as unknown as SmashUpEvent)');
    expect(text).not.toContain('reduce(nextCore, consumed as unknown as SmashUpEvent)');
  });
  it('destroy 后处理判断弃牌触发时不得 reduce MINION_DESTROYED 预演去向', () => {
    const reducerPath = join(SMASHUP_ROOT, 'domain', 'reducer.ts');
    const reducePath = join(SMASHUP_ROOT, 'domain', 'reduce.ts');
    const destroyFactsPath = join(SMASHUP_ROOT, 'domain', 'destroyFacts.ts');
    const reducerText = readFileSync(reducerPath, 'utf8');
    const reduceText = readFileSync(reducePath, 'utf8');
    const destroyFactsText = readFileSync(destroyFactsPath, 'utf8');

    expect(destroyFactsText).toContain('export function shouldRedirectDestroyedMinionToDeckBottom');
    expect(destroyFactsText).toContain('export function doesDestroyedMinionEnterOwnerDiscard');
    expect(reduceText).toContain("import { shouldRedirectDestroyedMinionToDeckBottom } from './destroyFacts'");
    expect(reducerText).toContain("import { doesDestroyedMinionEnterOwnerDiscard } from './destroyFacts'");
    expect(reducerText).toContain('doesDestroyedMinionEnterOwnerDiscard(phase2Core, de)');
    expect(reducerText).not.toContain('const discardCore = reduce(phase2Core, de)');
  });
  it('scoreBases 入队 trigger 不得通过通用 reduce 预演', () => {
    const indexPath = join(SMASHUP_ROOT, 'domain', 'index.ts');
    const text = readFileSync(indexPath, 'utf8');

    expect(text).toContain("import { applyTriggerQueueFactEvent } from './triggerQueueFacts'");
    expect(text).not.toContain('reduce(updatedCore, queuedAfterBase as unknown as SmashUpEvent)');
    expect(text).not.toContain('reduce(updatedCore, queuedAfterOngoing as unknown as SmashUpEvent)');
    expect(text).not.toContain('reduce(core, queuedBefore as unknown as SmashUpEvent)');
    expect(text).not.toContain('reduce(core, queuedBeforeBase as unknown as SmashUpEvent)');
    expect(text).not.toContain('reduce(updatedCore, queuedWhenScoringBase as unknown as SmashUpEvent)');
    expect(text).not.toContain('reduce(currentMatchState.core, queuedBaseTurnEnd as unknown as SmashUpEvent)');
    expect(text).not.toContain('reduce(currentMatchState.core, queuedTurnEnd as unknown as SmashUpEvent)');
    expect(text).not.toContain('reduce(currentMatchState.core, queuedBase as unknown as SmashUpEvent)');
    expect(text).not.toContain('reduce(currentMatchState.core, queuedTurnStart as unknown as SmashUpEvent)');
  });
  it('scoreBases 不得保留非权威 marker/lock inline reduce 路径', () => {
    const indexPath = join(SMASHUP_ROOT, 'domain', 'index.ts');
    const reducePath = join(SMASHUP_ROOT, 'domain', 'reduce.ts');
    const indexText = readFileSync(indexPath, 'utf8');
    const reduceText = readFileSync(reducePath, 'utf8');

    expect(reduceText).toContain('export function reduceSpecialAfterScoringConsumedEvent');
    expect(reduceText).toContain('export function reduceScoringEligibleBasesLockedEvent');
    expect(reduceText).toContain('export function reduceBeforeScoringTriggeredEvent');
    expect(reduceText).toContain('export function reduceWhenScoringTriggeredEvent');
    expect(reduceText).toContain('export function reduceAfterScoringTriggeredEvent');
    expect(reduceText).toContain('return reduceSpecialAfterScoringConsumedEvent(state, event as SpecialAfterScoringConsumedEvent)');
    expect(reduceText).toContain('return reduceScoringEligibleBasesLockedEvent(state, event)');
    expect(reduceText).toContain('return reduceBeforeScoringTriggeredEvent(state, event)');
    expect(reduceText).toContain('return reduceWhenScoringTriggeredEvent(state, event)');
    expect(reduceText).toContain('return reduceAfterScoringTriggeredEvent(state, event)');

    expect(indexText).toContain('function scoreCurrentBaseInSession');
    expect(indexText).toContain('function scoreCurrentSessionBase');
    expect(indexText).toContain('SmashUp scoring executor requires an active scoring session');
    expect(indexText).not.toContain('function scoreOneBase');
    expect(indexText).not.toContain('export function scoreOneBase');
    expect(indexText).not.toContain('hasAuthoritativeScoringSession');
    expect(indexText).not.toContain('reduceSpecialAfterScoringConsumedEvent(updatedCore, consumedEvt)');
    expect(indexText).not.toContain('reduceScoringEligibleBasesLockedEvent(core, currentBaseLockEvent)');
    expect(indexText).not.toContain('reduceBeforeScoringTriggeredEvent(core, markEvent as unknown as SmashUpEvent)');
    expect(indexText).not.toContain('reduceWhenScoringTriggeredEvent(updatedCore, whenScoringTriggeredEvent as unknown as SmashUpEvent)');
    expect(indexText).not.toContain('reduceAfterScoringTriggeredEvent(updatedCore, markEvent as unknown as SmashUpEvent)');

    expect(indexText).not.toContain('reduce(updatedCore, consumedEvt)');
    expect(indexText).not.toContain('reduce(core, currentBaseLockEvent)');
    expect(indexText).not.toContain('reduce(core, markEvent as unknown as SmashUpEvent)');
    expect(indexText).not.toContain('reduce(updatedCore, whenScoringTriggeredEvent as unknown as SmashUpEvent)');
    expect(indexText).not.toContain('reduce(updatedCore, markEvent as unknown as SmashUpEvent)');
  });
  it('onVpAwarded 后处理不得通过当前 VP/BASE_SCORED 事件预演 VP 落地', () => {
    const indexPath = join(SMASHUP_ROOT, 'domain', 'index.ts');
    const text = readFileSync(indexPath, 'utf8');

    const vpAwardedStart = text.indexOf('if (event.type === SU_EVENTS.VP_AWARDED)');
    expect(vpAwardedStart).toBeGreaterThanOrEqual(0);
    const baseScoredStart = text.indexOf('} else if (event.type === SU_EVENTS.BASE_SCORED)', vpAwardedStart);
    expect(baseScoredStart).toBeGreaterThan(vpAwardedStart);
    const baseClearedStart = text.indexOf('} else if (event.type === SU_EVENTS.BASE_CLEARED)', baseScoredStart);
    expect(baseClearedStart).toBeGreaterThan(baseScoredStart);

    const vpAwardedBody = text.slice(vpAwardedStart, baseScoredStart);
    const baseScoredBody = text.slice(baseScoredStart, baseClearedStart);

    expect(vpAwardedBody).toContain("collectTriggers(tempCore, 'onVpAwarded'");
    expect(baseScoredBody).toContain("collectTriggers(tempCore, 'onVpAwarded'");
    expect(vpAwardedBody).not.toContain('reduce(tempCore, event)');
    expect(baseScoredBody).not.toContain('reduce(tempCore, event)');
  });
  it('清场和换基地后处理只能复用具体 reducer case，不得通过通用 reduce 预演整局状态', () => {
    const indexPath = join(SMASHUP_ROOT, 'domain', 'index.ts');
    const reducePath = join(SMASHUP_ROOT, 'domain', 'reduce.ts');
    const indexText = readFileSync(indexPath, 'utf8');
    const reduceText = readFileSync(reducePath, 'utf8');

    expect(indexText).toContain("} from './reduce'");
    expect(indexText).toContain('reduceBaseClearedEvent');
    expect(indexText).toContain('reduceBaseReplacedEvent');
    expect(reduceText).toContain('export function reduceBaseClearedEvent');
    expect(reduceText).toContain('export function reduceBaseReplacedEvent');
    expect(reduceText).toContain('return reduceBaseClearedEvent(state, event as BaseClearedEvent)');
    expect(reduceText).toContain('return reduceBaseReplacedEvent(state, event as BaseReplacedEvent)');

    expect(indexText).toContain('reduceBaseClearedEvent(preClearCore, clearEvt)');
    expect(indexText).toContain('reduceBaseReplacedEvent(preReplaceCore, replaceEvt)');

    expect(indexText).not.toContain('shouldInlineStandalonePostScoring');
    expect(indexText).not.toContain('standaloneCore');
    expect(indexText).not.toContain('reduceBaseClearedEvent(standaloneCore, postEvent as BaseClearedEvent)');
    expect(indexText).not.toContain('reduceBaseReplacedEvent(standaloneCore, postEvent as BaseReplacedEvent)');
    expect(indexText).not.toContain('standaloneCore = applyPostProcessPrefixEvent(standaloneCore, postEvent)');
    expect(indexText).not.toContain('reduce(preClearCore, event)');
    expect(indexText).not.toContain('reduce(preReplaceCore, event)');
    expect(indexText).not.toContain('standaloneCore = reduce(standaloneCore, postEvent)');
  });
  it('Munchkin 怪物后处理只能复用具体 reducer case，不得通过通用 reduce 预演整局状态', () => {
    const indexPath = join(SMASHUP_ROOT, 'domain', 'index.ts');
    const reducePath = join(SMASHUP_ROOT, 'domain', 'reduce.ts');
    const indexText = readFileSync(indexPath, 'utf8');
    const reduceText = readFileSync(reducePath, 'utf8');

    expect(reduceText).toContain('export function reduceMunchkinMonsterDefeatedEvent');
    expect(reduceText).toContain('export function reduceMunchkinMonsterPlayedEvent');
    expect(reduceText).toContain('return reduceMunchkinMonsterDefeatedEvent(state, event as MunchkinMonsterDefeatedEvent)');
    expect(reduceText).toContain('return reduceMunchkinMonsterPlayedEvent(state, event as MunchkinMonsterPlayedEvent)');
    expect(indexText).toContain('reduceMunchkinMonsterPlayedEvent(tempCore, playedEvt as MunchkinMonsterPlayedEvent)');
    expect(indexText).toContain('reduceMunchkinMonsterDefeatedEvent(tempCore, defeatedEvt as MunchkinMonsterDefeatedEvent)');

    const monsterPlayedStart = indexText.indexOf('} else if (event.type === SU_EVENTS.MUNCHKIN_MONSTER_PLAYED)');
    expect(monsterPlayedStart).toBeGreaterThanOrEqual(0);
    const monsterDefeatedStart = indexText.indexOf('} else if (event.type === SU_EVENTS.MUNCHKIN_MONSTER_DEFEATED)', monsterPlayedStart);
    expect(monsterDefeatedStart).toBeGreaterThan(monsterPlayedStart);
    const monsterDefeatedEnd = indexText.indexOf('\n    let finalDerived = derivedEvents;', monsterDefeatedStart);
    expect(monsterDefeatedEnd).toBeGreaterThan(monsterDefeatedStart);

    expect(indexText.slice(monsterPlayedStart, monsterDefeatedStart)).not.toContain('reduce(tempCore, event)');
    expect(indexText.slice(monsterDefeatedStart, monsterDefeatedEnd)).not.toContain('reduce(tempCore, event)');
  });
  it('Munchkin 计分宝藏 reveal 不得在计分执行器内预演归约', () => {
    const indexPath = join(SMASHUP_ROOT, 'domain', 'index.ts');
    const reducePath = join(SMASHUP_ROOT, 'domain', 'reduce.ts');
    const indexText = readFileSync(indexPath, 'utf8');
    const reduceText = readFileSync(reducePath, 'utf8');

    expect(reduceText).toContain('export function reduceMunchkinTreasureRewardRevealedEvent');
    expect(reduceText).toContain('return reduceMunchkinTreasureRewardRevealedEvent(state, event as MunchkinTreasureRewardRevealedEvent)');
    expect(indexText).toContain('events.push(revealEvent)');
    expect(indexText).toContain("currentStep: 'awaiting-score-award-reduce'");
    expect(indexText).not.toContain('reduceMunchkinTreasureRewardRevealedEvent(updatedCore, revealEvent)');
    expect(indexText).not.toContain('reduce(updatedCore, revealEvent)');
  });
  it('MINION_PLAYED 后处理只能复用具体 reducer case，不得通过通用 reduce 预演整局状态', () => {
    const indexPath = join(SMASHUP_ROOT, 'domain', 'index.ts');
    const reducePath = join(SMASHUP_ROOT, 'domain', 'reduce.ts');
    const indexText = readFileSync(indexPath, 'utf8');
    const reduceText = readFileSync(reducePath, 'utf8');

    expect(reduceText).toContain('export function reduceMinionPlayedEvent');
    expect(reduceText).toContain('return reduceMinionPlayedEvent(state, event as MinionPlayedEvent)');
    expect(indexText).toContain('reduceMinionPlayedEvent(tempCore, playedEvt)');

    const minionPlayedStart = indexText.indexOf('} else if (event.type === SU_EVENTS.MINION_PLAYED)');
    expect(minionPlayedStart).toBeGreaterThanOrEqual(0);
    const actionPlayedStart = indexText.indexOf('} else if (event.type === SU_EVENTS.ACTION_PLAYED)', minionPlayedStart);
    expect(actionPlayedStart).toBeGreaterThan(minionPlayedStart);

    expect(indexText.slice(minionPlayedStart, actionPlayedStart)).not.toContain('reduce(tempCore, event)');
  });
  it('postProcess 中 trigger 入队后的队列视图只能应用 triggerQueue 事实', () => {
    const indexPath = join(SMASHUP_ROOT, 'domain', 'index.ts');
    const text = readFileSync(indexPath, 'utf8');

    expect(text).toContain('applyTriggerQueueFactEvent(tempCore, queuedBase as unknown as SmashUpEvent)');
    expect(text).toContain('applyTriggerQueueFactEvent(tempCore, queuedExtendedBase as unknown as SmashUpEvent)');
    expect(text).toContain('applyTriggerQueueFactEvent(tempCore, queuedActionTriggers)');
    expect(text).toContain('applyTriggerQueueFactEvent(tempCore, queuedMonsterTriggers)');
    expect(text).toContain('applyTriggerQueueFactEvent(tempCore, queuedMonsterBaseTriggers)');
    expect(text).toContain('applyTriggerQueueFactEvent(talentCore, queuedTalentTriggers)');
    expect(text).toContain('applyTriggerQueueFactEvent(talentCore, queuedBaseTalent as unknown as SmashUpEvent)');
    expect(text).toContain('applyTriggerQueueFactEvent(titanCore, queuedTitanMove)');
    expect(text).toContain('applyTriggerQueueFactEvent(titanCore, queuedTitanRemoved)');

    expect(text).not.toContain('reduce(tempCore, queuedBase as unknown as SmashUpEvent)');
    expect(text).not.toContain('reduce(tempCore, queuedExtendedBase as unknown as SmashUpEvent)');
    expect(text).not.toContain('reduce(tempCore, queuedActionTriggers)');
    expect(text).not.toContain('reduce(tempCore, queuedMonsterTriggers)');
    expect(text).not.toContain('reduce(tempCore, queuedMonsterBaseTriggers)');
    expect(text).not.toContain('reduce(talentCore, queuedTalentTriggers)');
    expect(text).not.toContain('reduce(talentCore, queuedBaseTalent as unknown as SmashUpEvent)');
    expect(text).not.toContain('reduce(titanCore, queuedTitanMove)');
    expect(text).not.toContain('reduce(titanCore, queuedTitanRemoved)');
  });
  it('postProcess 批内前序事件视图只能复用具体 reducer case', () => {
    const indexPath = join(SMASHUP_ROOT, 'domain', 'index.ts');
    const prefixPath = join(SMASHUP_ROOT, 'domain', 'postProcessPrefixEvent.ts');
    const reducePath = join(SMASHUP_ROOT, 'domain', 'reduce.ts');
    const text = readFileSync(indexPath, 'utf8');
    const prefixBody = readFileSync(prefixPath, 'utf8');
    const reduceBody = readFileSync(reducePath, 'utf8');

    expect(text).toContain("import { applyPostProcessPrefixEvent } from './postProcessPrefixEvent'");
    expect(text).not.toContain('function applyPostProcessPrefixEvent');

    expect(prefixBody).toContain('reduceVpAwardedEvent(core, event as VpAwardedEvent)');
    expect(prefixBody).toContain('reduceBaseScoredEvent(core, event as BaseScoredEvent)');
    expect(prefixBody).toContain('reduceBaseClearedEvent(core, event as BaseClearedEvent)');
    expect(prefixBody).toContain('reduceBaseReplacedEvent(core, event as BaseReplacedEvent)');
    expect(prefixBody).toContain('reduceCardsDrawnEvent(core, event as CardsDrawnEvent)');
    expect(prefixBody).toContain('reduceCardsDiscardedEvent(core, event as CardsDiscardedEvent)');
    expect(prefixBody).toContain('reduceCardsMilledEvent(core, event as CardsMilledEvent)');
    expect(prefixBody).toContain('reduceMadnessDrawnEvent(core, event as MadnessDrawnEvent)');
    expect(prefixBody).toContain('reduceMadnessReturnedEvent(core, event as MadnessReturnedEvent)');
    expect(prefixBody).toContain('reduceMinionPlayedEvent(core, event as MinionPlayedEvent)');
    expect(prefixBody).toContain('reduceMinionDestroyedEvent(core, event as MinionDestroyedEvent)');
    expect(prefixBody).toContain('reduceMinionControlChangedEvent(core, event as MinionControlChangedEvent)');
    expect(prefixBody).toContain('reduceMinionMetadataUpdatedEvent(core, event as MinionMetadataUpdatedEvent)');
    expect(prefixBody).toContain('reduceMinionMovedEvent(core, event as MinionMovedEvent)');
    expect(prefixBody).toContain('reduceMinionReturnedEvent(core, event as MinionReturnedEvent)');
    expect(prefixBody).toContain('reduceCardTransferredEvent(core, event as CardTransferredEvent)');
    expect(prefixBody).toContain('reduceCardRecoveredFromDiscardEvent(core, event as CardRecoveredFromDiscardEvent)');
    expect(prefixBody).toContain('reduceCardRemovedFromGameEvent(core, event as CardRemovedFromGameEvent)');
    expect(prefixBody).toContain('reduceBuriedCardReturnedToHandEvent(core, event as BuriedCardReturnedToHandEvent)');
    expect(prefixBody).toContain('reduceCardToDeckTopEvent(core, event as CardToDeckTopEvent)');
    expect(prefixBody).toContain('reduceCardToDeckBottomEvent(core, event as CardToDeckBottomEvent)');
    expect(prefixBody).toContain('reduceHandShuffledIntoDeckEvent(core, event as HandShuffledIntoDeckEvent)');
    expect(prefixBody).toContain('reduceDeckReorderedEvent(core, event as DeckReorderedEvent)');
    expect(prefixBody).toContain('reduceDeckReshuffledEvent(core, event as DeckReshuffledEvent)');
    expect(prefixBody).toContain('reduceLimitModifiedEvent(core, event as LimitModifiedEvent)');
    expect(prefixBody).toContain('reduceOngoingAttachedEvent(core, event as OngoingAttachedEvent)');
    expect(prefixBody).toContain('reduceOngoingDetachedEvent(core, event as OngoingDetachedEvent)');
    expect(prefixBody).toContain('reduceActionPlayedEvent(core, event as ActionPlayedEvent)');
    expect(prefixBody).toContain('reduceActionCounteredEvent(core, event as ActionCounteredEvent)');
    expect(prefixBody).toContain('reduceMunchkinMonsterPlayedEvent(core, event as MunchkinMonsterPlayedEvent)');
    expect(prefixBody).toContain('reduceMunchkinMonsterDefeatedEvent(core, event as MunchkinMonsterDefeatedEvent)');
    expect(prefixBody).toContain('reduceMunchkinTreasureRewardDistributedEvent(core, event as MunchkinTreasureRewardDistributedEvent)');
    expect(prefixBody).toContain('reduceBaseDeckShuffledEvent(core, event as BaseDeckShuffledEvent)');
    expect(prefixBody).toContain('reduceTalentUsedEvent(core, event as TalentUsedEvent)');
    expect(prefixBody).toContain('reduceTitanPlayedEvent(core, event as TitanPlayedEvent)');
    expect(prefixBody).toContain('reduceTitanMovedEvent(core, event as TitanMovedEvent)');
    expect(prefixBody).toContain('reduceTitanRemovedFromPlayEvent(core, event as TitanRemovedFromPlayEvent)');
    expect(prefixBody).toContain('reduceTitanMetadataUpdatedEvent(core, event as TitanMetadataUpdatedEvent)');
    expect(prefixBody).toContain('reduceTitanPowerCounterAddedEvent(core, event as TitanPowerCounterAddedEvent)');
    expect(prefixBody).toContain('reduceTitanPowerCounterRemovedEvent(core, event as TitanPowerCounterRemovedEvent)');
    expect(prefixBody).toContain('reducePowerCounterAddedEvent(core, event as PowerCounterAddedEvent)');
    expect(prefixBody).toContain('reducePowerCounterRemovedEvent(core, event as PowerCounterRemovedEvent)');
    expect(prefixBody).toContain('reduceTempPowerAddedEvent(core, event as TempPowerAddedEvent)');
    expect(prefixBody).toContain('reducePermanentPowerAddedEvent(core, event as PermanentPowerAddedEvent)');
    expect(prefixBody).toContain('reduceTempBasePowerModifiedEvent(core, event as TempBasePowerModifiedEvent)');
    expect(prefixBody).toContain('reduceTurnStartedEvent(core, event)');
    expect(prefixBody).toContain('reduceTurnEndedEvent(core, event as TurnEndedEvent)');
    expect(prefixBody).toContain('reduceSpecialLimitUsedEvent(core, event as SpecialLimitUsedEvent)');
    expect(prefixBody).toContain('reduceBeforeScoringClearedEvent(core)');
    expect(prefixBody).toContain('reduceWhenScoringClearedEvent(core)');
    expect(prefixBody).toContain('reduceAfterScoringClearedEvent(core)');
    expect(prefixBody).toContain('applyTriggerQueueFactEvent(core, event)');
    expect(prefixBody).toContain('reduceDeckInspectionFactEvent(');
    expect(prefixBody).toContain('case SU_EVENTS.ABILITY_FEEDBACK:');
    expect(prefixBody).toContain('[smashup/postProcessPrefixEvent] unsupported prefix event:');
    expect(prefixBody).not.toMatch(/\breduce\s*\(/);

    expect(reduceBody).toContain('return reducePowerCounterAddedEvent(state, event as PowerCounterAddedEvent)');
    expect(reduceBody).toContain('return reducePowerCounterRemovedEvent(state, event as PowerCounterRemovedEvent)');
    expect(reduceBody).toContain('return reduceTempPowerAddedEvent(state, event as TempPowerAddedEvent)');
    expect(reduceBody).toContain('return reducePermanentPowerAddedEvent(state, event as PermanentPowerAddedEvent)');
    expect(reduceBody).toContain('return reduceTempBasePowerModifiedEvent(state, event as TempBasePowerModifiedEvent)');
    expect(reduceBody).toContain('return reduceActionCounteredEvent(state, event as ActionCounteredEvent)');
    expect(reduceBody).toContain('return reduceOngoingAttachedEvent(state, event as OngoingAttachedEvent)');
    expect(reduceBody).toContain('return reduceDeckReshuffledEvent(state, event as DeckReshuffledEvent)');
    expect(reduceBody).toContain('return reduceDeckReorderedEvent(state, event as DeckReorderedEvent)');
    expect(reduceBody).toContain('return reduceLimitModifiedEvent(state, event as LimitModifiedEvent)');
    expect(reduceBody).toContain('return reduceCardToDeckTopEvent(state, event as CardToDeckTopEvent)');
    expect(reduceBody).toContain('return reduceCardToDeckBottomEvent(state, event as CardToDeckBottomEvent)');
    expect(reduceBody).toContain('return reduceHandShuffledIntoDeckEvent(state, event as HandShuffledIntoDeckEvent)');

    const drawPhaseStart = text.indexOf("if (to === 'draw')");
    expect(drawPhaseStart).toBeGreaterThanOrEqual(0);
    const drawPhaseEnd = text.indexOf('const player = core.players[pid];', drawPhaseStart);
    expect(drawPhaseEnd).toBeGreaterThan(drawPhaseStart);
    const drawPhaseBody = text.slice(drawPhaseStart, drawPhaseEnd);
    expect(drawPhaseBody).toContain('applyPostProcessPrefixEvent(currentCore, event as SmashUpEvent)');
    expect(drawPhaseBody).not.toMatch(/=>\s*reduce\s*\(/);

    const postStart = text.indexOf('function postProcessSystemEvents');
    expect(postStart).toBeGreaterThanOrEqual(0);
    const postEnd = text.indexOf('\n    let finalDerived = derivedEvents;', postStart);
    expect(postEnd).toBeGreaterThan(postStart);
    const postPrefixPhase = text.slice(postStart, postEnd);

    expect(postPrefixPhase).toContain('let prePlayCore = state');
    expect(postPrefixPhase).toContain('prePlayCore = applyPostProcessPrefixEvent(prePlayCore, event)');
    expect(postPrefixPhase).not.toContain('for (const preEvt of prePlayEvents)');
    expect(postPrefixPhase).not.toContain('prePlayEvents.reduce((acc, preEvt) => reduce(acc, preEvt), state)');

    const postEndToImmediateExtra = text.indexOf('\n    let finalEvents = [...combinedWithTalent, ...titanDerived];', postStart);
    expect(postEndToImmediateExtra).toBeGreaterThan(postEnd);
    const postTalentTitanPhase = text.slice(postEnd, postEndToImmediateExtra);
    expect(postTalentTitanPhase).toContain('talentCore = applyPostProcessPrefixEvent(talentCore, event)');
    expect(postTalentTitanPhase).toContain('titanCore = applyPostProcessPrefixEvent(titanCore, event)');
    expect(postTalentTitanPhase).toContain('titanCore = applyPostProcessPrefixEvent(titanCore, clashEvent)');
    expect(postTalentTitanPhase).toContain('titanCore = applyPostProcessPrefixEvent(titanCore, deferredEvent)');
    expect(postTalentTitanPhase).not.toContain('talentCore = reduce(talentCore, event)');
    expect(postTalentTitanPhase).not.toContain('titanCore = reduce(titanCore, event)');
    expect(postTalentTitanPhase).not.toContain('titanCore = reduce(titanCore, clashEvent)');
    expect(postTalentTitanPhase).not.toContain('titanCore = reduce(titanCore, deferredEvent)');

    const reducerPath = join(SMASHUP_ROOT, 'domain', 'reducer.ts');
    const reducerText = readFileSync(reducerPath, 'utf8');
    expect(reducerText).toContain("import { applyPostProcessPrefixEvent } from './postProcessPrefixEvent'");
    expect(reducerText).not.toContain('=> reduce(');
    expect(reducerText).not.toContain('core: reduce(');
    expect(reducerText).not.toContain('= reduce(');
    expect(reducerText).not.toContain('reduce(matchState.core, event)');
    expect(reducerText).not.toContain('reduce(coreBeforeMove, event)');
    expect(reducerText).not.toContain('reduce(coreBeforeReturn, event)');
    expect(reducerText).not.toContain('reduce(coreBeforeAffect, event)');

    const reactionSessionPath = join(SMASHUP_ROOT, 'domain', 'reactionSession.ts');
    const reactionSessionText = readFileSync(reactionSessionPath, 'utf8');
    expect(reactionSessionText).not.toContain("import { applyPostProcessPrefixEvent } from './postProcessPrefixEvent'");
    expect(reactionSessionText).not.toContain('applyPostProcessPrefixEvent(');
    expect(reactionSessionText).not.toContain("from './reduce'");
    expect(reactionSessionText).not.toContain('reducedCore = reduce(reducedCore, event)');

    const effectSemanticsPath = join(SMASHUP_ROOT, 'domain', 'effectSemantics.ts');
    const effectSemanticsText = readFileSync(effectSemanticsPath, 'utf8');
    expect(effectSemanticsText).toContain("import { applyPostProcessPrefixEvent } from './postProcessPrefixEvent'");
    expect(effectSemanticsText).not.toContain("from './reduce'");
    expect(effectSemanticsText).not.toContain('workingCore = reduce(workingCore,');
  });
});
