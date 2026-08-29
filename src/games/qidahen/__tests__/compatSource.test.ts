import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readBoardSource = () => readFileSync(resolve(TEST_DIR, '..', 'Board.tsx'), 'utf8');
const readBoardShellSource = () => readFileSync(resolve(TEST_DIR, '..', 'QidahenBoardShell.tsx'), 'utf8');
const readQidahenBasicFlowE2eSource = () => readFileSync(resolve(TEST_DIR, '..', '..', '..', '..', 'e2e', 'qidahen-basic-flow.e2e.ts'), 'utf8');
const readCommandsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'commands.ts'), 'utf8');
const readCharacterActionWindowSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'characterActionWindow.ts'), 'utf8');
const readCharacterActionWindowDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'characterActionWindowDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readArmamentCatalogStateSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'armamentCatalogState.ts'), 'utf8');
const readArmamentStateAccessorsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'armamentStateAccessors.ts'), 'utf8');
const readActionSourceRegionStateSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'actionSourceRegionState.ts'), 'utf8');
const readActionWindowEntryStateSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'actionWindowEntryState.ts'), 'utf8');
const readDefeatMarkerStateSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'defeatMarkerState.ts'), 'utf8');
const readDirectInputEventReducerBridgeSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'directInputEventReducerBridge.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readDirectInputEventReducersSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'directInputEventReducers.ts'), 'utf8');
const readDirectInputEventReducerRegistrySource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'directInputEventReducerRegistry.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readCharacterCatalogStateSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'characterCatalogState.ts'), 'utf8');
const readCharacterChronologyConfigSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'characterChronologyConfig.ts'), 'utf8');
const readCharacterChronologyStateSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'characterChronologyState.ts'), 'utf8');
const readCharacterConflictStateSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'characterConflictState.ts'), 'utf8');
const readCharacterAbilitySemanticsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'characterAbilitySemantics.ts'), 'utf8');
const readCharacterPresenceAccessorsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'characterPresenceAccessors.ts'), 'utf8');
const readCityInteriorTroopTransferSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'cityInteriorTroopTransfer.ts'), 'utf8');
const readCoreDerivedStateSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'coreDerivedState.ts'), 'utf8');
const readDomainIndexSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'index.ts'), 'utf8');
const readFactionActionWindowSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'factionActionWindow.ts'), 'utf8');
const readFactionLabelSemanticsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'factionLabelSemantics.ts'), 'utf8');
const readFactionTurnAccessorsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'factionTurnAccessors.ts'), 'utf8');
const readFactionTurnOrderSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'factionTurnOrder.ts'), 'utf8');
const readFortificationMaintenanceSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'fortificationMaintenance.ts'), 'utf8');
const readGrantPardonExecutionSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'grantPardonExecution.ts'), 'utf8');
const readGrantPardonExecutionDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'grantPardonExecutionDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readHandLimitDiscardSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'handLimitDiscard.ts'), 'utf8');
const readHandCardStateSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'handCardState.ts'), 'utf8');
const readInitialCoreSeedsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'initialCoreSeeds.ts'), 'utf8');
const readInitialCoreSetupSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'initialCoreSetup.ts'), 'utf8');
const readViewSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'view.ts'), 'utf8');
const readInteractionAccessorsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'interactionSelectionAccessors.ts'), 'utf8');
const readInteractionContractsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'interactionContracts.ts'), 'utf8');
const readInteractionBuildersSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'interactionBuilders.ts'), 'utf8');
const readRuntimeInteractionBuilderContractsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'runtimeInteractionBuilderContracts.ts'), 'utf8');
const readTurnActionInteractionBuildersSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'turnActionInteractionBuilders.ts'), 'utf8');
const readBattleInteractionBuildersSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'battleInteractionBuilders.ts'), 'utf8');
const readInteractionResolverRegistrySource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'interactionResolverRegistry.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readInteractionResolutionPayloadSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'interactionResolutionPayload.ts'), 'utf8');
const readTurnActionInteractionEventHandlersSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'turnActionInteractionEventHandlers.ts'), 'utf8');
const readPendingBattleInteractionEventHandlersSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingBattleInteractionEventHandlers.ts'), 'utf8');
const readInteractionSourcesSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'interactionSources.ts'), 'utf8');
const readInteractionSystemSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'interactionSystem.ts'), 'utf8');
const readKoreaTributeRulesSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'koreaTributeRules.ts'), 'utf8');
const readMapTokensSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'mapTokens.ts'), 'utf8');
const readMovementSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'movement.ts'), 'utf8');
const readRegionConfigSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'regionConfig.ts'), 'utf8');
const readPendingBattleInteractionBridgeSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingBattleInteractionBridge.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readPendingBattleFlowSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingBattleFlow.ts'), 'utf8');
const readPendingBattleFlowDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingBattleFlowDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readPendingBattleResolvedCommandDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingBattleResolvedCommandDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readPendingBattleResolvedEventDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingBattleResolvedEventDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readPendingBattleCommittedTroopsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingBattleCommittedTroops.ts'), 'utf8');
const readPendingBattleCombatSupportSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingBattleCombatSupport.ts'), 'utf8');
const readPendingBattleOrchestrationSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingBattleOrchestration.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readPendingTargetResolutionDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingTargetResolutionDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readPendingTargetActionBuilderSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingTargetActionBuilder.ts'), 'utf8');
const readPendingTargetChoiceOptionsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingTargetChoiceOptions.ts'), 'utf8');
const readPendingBattleStateTransitionSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingBattleStateTransition.ts'), 'utf8');
const readPreviewActionReducerSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'previewActionReducer.ts'), 'utf8');
const readRegionSelectionPreferencesSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'regionSelectionPreferences.ts'), 'utf8');
const readRegionSelectionReducerSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'regionSelectionReducer.ts'), 'utf8');
const readScenarioPresetsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'scenarioPresets.ts'), 'utf8');
const readScenarioRuntimeRegionPresetsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'scenarioRuntimeRegionPresets.ts'), 'utf8');
const readScenarioChoiceOrchestrationSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'scenarioChoiceOrchestration.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readScenarioChoiceResolvedEventDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'scenarioChoiceResolvedEventDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readScenarioChoiceStateDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'scenarioChoiceStateDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readScenarioChoiceStateSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'scenarioChoiceState.ts'), 'utf8');
const readSunYuanhuaTechResolvedEventDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'sunYuanhuaTechResolvedEventDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readResolvedEventReducerRegistrySource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'resolvedEventReducerRegistry.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readResolvedEventReducersSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'resolvedEventReducers.ts'), 'utf8');
const readResolvedEventReducerRegistryMapSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'resolvedEventReducerRegistryMap.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readSeasonResolutionDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'seasonResolutionDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readSelectionInputStateSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'selectionInputState.ts'), 'utf8');
const readSelectedActionExecutionSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'selectedActionExecution.ts'), 'utf8');
const readSelectedActionExecutionDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'selectedActionExecutionDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readSelectedActionOrchestrationSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'selectedActionOrchestration.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readSelectedActionExecutionResolutionSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'selectedActionExecutionResolution.ts'), 'utf8');
const readSelectedActionFollowUpSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'selectedActionFollowUp.ts'), 'utf8');
const readSelectedActionPreparationSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'selectedActionPreparation.ts'), 'utf8');
const readSelectedActionPreparationDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'selectedActionPreparationDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readSelectedActionStateCommitSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'selectedActionStateCommit.ts'), 'utf8');
const readSelectedActionStateCommitDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'selectedActionStateCommitDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readSeasonResolutionSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'seasonResolution.ts'), 'utf8');
const readSeasonSummaryBuilderSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'seasonSummaryBuilder.ts'), 'utf8');
const readSpecialRuleStateSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'specialRuleState.ts'), 'utf8');
const readVictoryResolutionSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'victoryResolution.ts'), 'utf8');
const readPendingTargetResolutionSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingTargetResolution.ts'), 'utf8');
const readPendingTargetChoicePayloadSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'pendingTargetChoicePayload.ts'), 'utf8');
const readPostBattleDecisionResolutionSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'postBattleDecisionResolution.ts'), 'utf8');
const readPostBattleContractsSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'postBattleContracts.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readPostBattleResolutionDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'postBattleResolutionDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readRuntimeInteractionsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'runtimeInteractions.ts'), 'utf8');
const readRegionRuleSemanticsSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'regionRuleSemantics.ts'), 'utf8');
const readRuntimeInteractionBuilderRegistrySource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'runtimeInteractionBuilderRegistry.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readCommandEventBuildersSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'commandEventBuilders.ts'), 'utf8');
const readCommandEventBuilderRegistrySource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'commandEventBuilderRegistry.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readResolvedCommandEventBuildersSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'resolvedCommandEventBuilders.ts'), 'utf8');
const readResolvedCommandEventBuilderRegistrySource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'resolvedCommandEventBuilderRegistry.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readResolvedCommandBridgeSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'resolvedCommandBridge.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readRuntimeRegionRulesSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'runtimeRegionRules.ts'), 'utf8');
const readDispatchSelectionBuildersSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'dispatchSelectionBuilders.ts'), 'utf8');
const readSelectionBuildersSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'selectionBuilders.ts'), 'utf8');
const readAttackRulesSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'attackRules.ts'), 'utf8');
const readActionWindowDispatchSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'actionWindowDispatch.ts'), 'utf8');
const readActionWindowChoicesSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'actionWindowChoices.ts'), 'utf8');
const readActionWindowResolvedEventBridgeSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'actionWindowResolvedEventBridge.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readActionWindowResolvedEventDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'actionWindowResolvedEventDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readActionWindowResolvedEventsSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'actionWindowResolvedEvents.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readActionWindowResolvedCommandDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'actionWindowResolvedCommandDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readArmamentLowFidelitySource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'armamentLowFidelity.ts'), 'utf8');
const readArmamentUpgradeResolutionSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'armamentUpgradeResolution.ts'), 'utf8');
const readArmamentUpgradeResolutionDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'armamentUpgradeResolutionDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readBattleRollMathSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'battleRollMath.ts'), 'utf8');
const readBattleStateSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'battleState.ts'), 'utf8');
const readTroopStacksSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'troopStacks.ts'), 'utf8');
const readTroopCompatSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'troopCompat.ts'), 'utf8');
const readTroopTrainingSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'troopTraining.ts'), 'utf8');
const readTurnAdvanceSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'turnAdvance.ts'), 'utf8');
const readTypesSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'types.ts'), 'utf8');
const readTurnActionDependenciesSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'turnActionDependencies.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readTurnActionChoiceOrchestrationSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'turnActionChoiceOrchestration.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readTurnActionInteractionBridgeSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'turnActionInteractionBridge.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readTurnFlowOrchestrationSource = () => {
    try {
        return readFileSync(resolve(TEST_DIR, '..', 'domain', 'turnFlowOrchestration.ts'), 'utf8');
    } catch {
        return '';
    }
};
const readWheelMoveExecutionSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'wheelMoveExecution.ts'), 'utf8');
const readWheelImmediateEffectSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'wheelImmediateEffect.ts'), 'utf8');
const readWheelMovesSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'wheelMoves.ts'), 'utf8');
const readWheelRulesSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'wheelRules.ts'), 'utf8');
const readTurnLabelStateSource = () => readFileSync(resolve(TEST_DIR, '..', 'domain', 'turnLabelState.ts'), 'utf8');

describe('Qidahen compatibility source guards', () => {
    it('七大恨教程 E2E 入口必须显式注入大明玩家视角，不能靠渲染兜底掩盖缺视角', () => {
        const e2eSource = readQidahenBasicFlowE2eSource();

        expect(e2eSource).toContain("const QIDAHEN_BASIC_OPENING_TEST_URL = '/play/qidahen?tutorialSetup=basic-opening&players=3&seat0=human&seat1=human&seat2=human&playerID=0';");
        expect(e2eSource).toContain("await expectMapArmyFace(page, { faction: 'ming', regionId: 'city-region-25', face: 'front' });");
        expect(e2eSource).toContain("await expectMapArmyFace(page, { faction: 'jin', regionId: 'city-region-13', face: 'hidden-back' });");
    });

    it('地图 Scene 与 HUD 应使用独立缩放，设计尺寸不能继续充当页面外框', () => {
        const board = readBoardSource();
        const shell = readBoardShellSource();

        expect(board).toContain('const STAGE_WIDTH = 1920;');
        expect(board).toContain('const STAGE_HEIGHT = 1080;');
        expect(shell).toContain('data-testid="qidahen-scene-stage"');
        expect(shell).toContain('data-testid="qidahen-desktop-stage"');
        expect(shell).toContain('const sceneScale = Math.max(width / layout.width, height / layout.height);');
        expect(shell).toContain(': Math.min(width / layout.width, height / layout.height);');
        expect(shell).toContain("transformOrigin: 'top left',");
    });

    it('地图 Scene 应铺满真实容器，HUD 应在独立层保持完整', () => {
        const shell = readBoardShellSource();

        expect(shell).toContain('className="relative h-full min-h-0 w-full overflow-hidden"');
        expect(shell).toContain('data-testid="qidahen-board"');
        expect(shell).toContain('data-testid="qidahen-scene-layer"');
        expect(shell).toContain('data-testid="qidahen-hud-layer"');
        expect(shell).toContain('left: metrics.scene.left,');
        expect(shell).toContain('top: metrics.scene.top,');
    });

    it('底部手牌坞应锚到底边，手机横屏使用真实视口 CSS px 并限制宽度避免牌堆挤出主视口', () => {
        const board = readBoardSource();
        const shell = readBoardShellSource();

        expect(board).toContain('data-testid="qidahen-bottom-dock"');
        expect(board).toContain('className="pointer-events-none absolute inset-x-0 bottom-0 z-[80]"');
        expect(shell).toContain('const hudScale = isMobileLandscape ? 1 : Math.min(width / layout.width, height / layout.height);');
        expect(shell).toContain('mobileBottomInset: isMobileLandscape ? layout.mobileLandscapeBottomDockInset : layout.bottomDockInset');
        expect(shell).toContain('width: metrics.isMobileLandscape ? metrics.viewportWidth : layout.width');
        expect(shell).toContain('height: metrics.isMobileLandscape ? metrics.viewportHeight : layout.height');
        expect(shell).toContain("'--qidahen-mobile-bottom-inset': `${metrics.mobileBottomInset}px`,");
        expect(board).toContain("const dockBottomInset = 'var(--qidahen-mobile-bottom-inset, 0px)';");
        expect(board).toContain('height: bottomDockHeight,');
        expect(board).toContain('bottom: dockBottomInset,');
        expect(board).toContain('data-testid="qidahen-hand-zone"');
        expect(board).toContain('data-ui-role="qidahen-hand-dock"');
        expect(board).toContain('const handDockMaxWidth: number | string = isMobileLandscapeViewport ? handDockWidth : \'calc(100vw - 320px)\';');
        expect(board).toContain('maxWidth: handDockMaxWidth,');
    });

    it('训练写链应由 troopTraining owner 承接，且训练 owner 不应继续内嵌 caller 专属 note 文案', () => {
        const characterActionWindowSource = readCharacterActionWindowSource();
        const indexSource = readDomainIndexSource();
        const trainingSource = readTroopTrainingSource();
        const wheelImmediateEffectSource = readWheelImmediateEffectSource();

        expect(indexSource).not.toContain("} from './troopTraining';");
        expect(indexSource).not.toContain('trainArtilleryStacksToLevel,');
        expect(indexSource).not.toContain('const trainArtilleryStacksToLevel = (');
        expect(indexSource).not.toContain('const trainSpecialTroopsOneStepForFaction = (');
        expect(indexSource).not.toContain('const trainTroopsOneStepForFactionWithLimit = (');
        expect(characterActionWindowSource).toContain("} from './troopTraining';");
        expect(characterActionWindowSource).toContain('trainSpecialTroopsOneStepForFaction,');
        expect(characterActionWindowSource).toContain('trainTroopsOneStepForFactionWithLimit,');
        expect(wheelImmediateEffectSource).toContain("} from './troopTraining';");
        expect(wheelImmediateEffectSource).toContain("import { trainArtilleryStacksToLevel } from './troopTraining';");
        expect(trainingSource).toContain('export const trainArtilleryStacksToLevel = (');
        expect(trainingSource).toContain('export const trainSpecialTroopsOneStepForFaction = (');
        expect(trainingSource).toContain('export const trainTroopsOneStepForFactionWithLimit = (');
        expect(trainingSource).not.toContain('export interface QidahenArtilleryTrainingResult {');
        expect(trainingSource).toContain('interface QidahenArtilleryTrainingResult {');
        expect(trainingSource).not.toContain('export interface QidahenTroopTrainingResult {');
        expect(trainingSource).toContain('interface QidahenTroopTrainingResult {');
        expect(trainingSource).not.toContain('export interface QidahenLimitedTroopTrainingOptions {');
        expect(trainingSource).toContain('interface QidahenLimitedTroopTrainingOptions {');
        expect(trainingSource).toContain('specialTroops: region.specialTroops, trainedCount: 0, targetLevel');
        expect(trainingSource).toContain('specialTroops: region.specialTroops, trainedCount: 0, trainedDetails: []');
        expect(trainingSource).not.toContain('轮盘征兵训练将');
        expect(trainingSource).not.toContain('熊廷弼免费训练');
        expect(trainingSource).not.toContain('xiong-tingbi');
        expect(wheelImmediateEffectSource).toContain('轮盘征兵训练将');
        expect(characterActionWindowSource).toContain('log-xiong-tingbi-training-');
        expect(characterActionWindowSource).toContain('const resolveQidahenXiongTingbiFreeTraining = (');
        expect(characterActionWindowSource).toContain('text: trainingResolution.logText,');
        expect(characterActionWindowSource).toContain('upgradedRegularTroopSourceId: `${actionTrainingRegion.id}-xiong-tingbi`');
        expect(characterActionWindowSource).toContain("logText: `熊廷弼在行动前免费训练 ${totalTrainedCount} 个部队：${summaryLines.join('；')}。`,");
        expect(characterActionWindowSource).toContain('trainTroopsOneStepForFactionWithLimit(');
        expect(indexSource).not.toContain('const resolveXiongTingbiFreeTraining = (');
        expect(indexSource).not.toContain('upgradedRegularTroopSourceId: `${actionTrainingRegion.id}-xiong-tingbi`');
        expect(indexSource).not.toContain('specialTroops: mergeSpecialTroopStacks(specialTroops),');
        expect(indexSource).not.toContain('specialTroops: mergeSpecialTroopStacks(nextSpecialTroops),');
    });

    it('pieceId 同步出口应经由 compat piece 回折，不能在 assignPieceIdsToStacks 里直接做 stack merge', () => {
        const source = readCoreDerivedStateSource();
        const compatSource = readTroopCompatSource();

        expect(source).toContain('syncRegionsPieceIds,');
        expect(source).not.toContain('const assignPieceIdsToStacks = (');
        expect(source).not.toContain('const syncRegionPieceIds = (');
        expect(source).not.toContain('const syncRegionsPieceIds = (');
        expect(compatSource).not.toContain('export const assignPieceIdsToStacks = (');
        expect(compatSource).toContain('const assignPieceIdsToStacks = (');
        expect(compatSource).not.toContain('const createQidahenPieceId = (');
        expect(compatSource).toContain('nextPieceIds.push(`qidahen-piece-${serial}`);');
        expect(compatSource).not.toContain('export const syncRegionPieceIds = (');
        expect(compatSource).toContain('const syncRegionPieceIds = (');
        expect(compatSource).toContain('export const syncRegionsPieceIds = (');
        expect(compatSource).toContain('stacks: cloneSpecialTroopStacksAsPieces(normalizedStacks),');
        expect(compatSource).not.toContain('stacks: mergeSpecialTroopStacks(normalizedStacks),');
    });

    it('compat piece 回折应直接在 collapse helper 收口，不能再绕回独立的 stack-first merge helper', () => {
        const compatSource = readTroopCompatSource();
        const indexSource = readDomainIndexSource();
        const seasonResolutionSource = readSeasonResolutionSource();

        expect(compatSource).toContain('export const collapseCompatPiecesToSpecialTroopStacks = (');
        expect(compatSource).toContain('return [...grouped.values()]');
        expect(compatSource).not.toContain('return mergeSpecialTroopStacks(Array.from(grouped.values()));');
        expect(compatSource).not.toContain('const mergeSpecialTroopStacks = (');
        expect(seasonResolutionSource).toContain("} from './troopCompat';");
        expect(seasonResolutionSource).toContain('collapseCompatPiecesToSpecialTroopStacks,');
        expect(indexSource).not.toContain('collapseCompatPiecesToSpecialTroopStacks,');
        expect(indexSource).not.toContain('const collapseCompatPiecesToSpecialTroopStacks = (');
    });

    it('调度摘要应直接消费 troopCompat owner，不再在 index 本地维护 compat 汇总 helper', () => {
        const indexSource = readDomainIndexSource();
        const actionWindowDispatchSource = readActionWindowDispatchSource();

        expect(indexSource).not.toContain('const formatTroopTransferDetails = (');
        expect(actionWindowDispatchSource).toContain("} from './troopCompat';");
        expect(actionWindowDispatchSource).toContain('formatTroopTransferDetails(choice.movedGenericTroops, choice.movedSpecialTroops)');
        expect(actionWindowDispatchSource).not.toContain('for (const stack of movedSpecialTroops)');
        expect(actionWindowDispatchSource).not.toContain('parts.push(`${stack.label} x${stack.count}（${stack.level}级）`);');
    });

    it('selection builder 的部队转移摘要应走 compat piece 汇总，不能继续直接按 movedSpecialTroops stack.count/level 拼接', () => {
        const source = readTroopCompatSource();

        expect(source).toContain('export const formatTroopTransferDetails = (');
        expect(source).toContain('for (const piece of expandSpecialTroopStacksToCompatPieces(movedSpecialTroops))');
        expect(source).not.toContain('for (const stack of movedSpecialTroops)');
        expect(source).not.toContain('parts.push(`${stack.label} x${stack.count}（${stack.level}级）`);');
    });

    it('内部调度 runtime builder 应走共享 getter，不得回退为直接读取 core.internalDispatchSelection', () => {
        const source = readTurnActionInteractionBuildersSource();

        expect(source).toContain('function buildQidahenInternalDispatchInteraction(');
        expect(source).toContain('const selection = getQidahenInternalDispatchSelectionForCore(state.core, state.sys.interaction?.current);');
        expect(source).not.toContain('state.core.internalDispatchSelection');
    });

    it('手牌上限弃牌 runtime builder 应走共享 getter，不得继续直接读取 core.handLimitDiscardSelection', () => {
        const source = readTurnActionInteractionBuildersSource();

        expect(source).toContain('function buildQidahenHandLimitDiscardInteraction(');
        expect(source).toContain('const selection = getQidahenHandLimitDiscardSelectionForCore(state.core, state.sys.interaction?.current);');
        expect(source).not.toContain('const selection = state.core.handLimitDiscardSelection;');
    });

    it('征召、马市贸易与大汗令箭 runtime builder 应统一经 accessor mirror 读取，不得继续只吃 core 当前态', () => {
        const source = readTurnActionInteractionBuildersSource();

        expect(source).toContain('const selection = getQidahenRecruitSelectionForCore(state.core, state.sys.interaction?.current);');
        expect(source).toContain('const selection = getQidahenMaShiTradeSelectionForCore(state.core, state.sys.interaction?.current);');
        expect(source).toContain('const selection = getQidahenKhanEdictSelectionForCore(state.core, state.sys.interaction?.current);');
        expect(source).not.toContain('const selection = getQidahenRecruitSelectionForCore(state.core);');
        expect(source).not.toContain('const selection = getQidahenMaShiTradeSelectionForCore(state.core);');
        expect(source).not.toContain('const selection = getQidahenKhanEdictSelectionForCore(state.core);');
    });

    it('Board 主 UI 也应通过 accessor mirror 读取行动选择；地图直选目标必须优先当前 core 选择', () => {
        const source = readBoardSource();

        expect(source).toContain('const handLimitDiscardSelection = getQidahenHandLimitDiscardSelectionForCore(core, activeInteraction);');
        expect(source).toContain('const diplomacySelection = getQidahenDiplomacySelectionForCore(core, activeInteraction);');
        expect(source).toContain('const internalDispatchSelection = getQidahenInternalDispatchSelectionForCore(core, activeInteraction);');
        expect(source).toContain('const khanEdictSelection = getQidahenKhanEdictSelectionForCore(core, activeInteraction);');
        expect(source).toContain('const recruitSelectionFromCore = getCoreQidahenRecruitSelectionForCore(core);');
        expect(source).toContain('const recruitSelectionFromMirror = getQidahenRecruitSelectionForCore(core, activeInteraction);');
        expect(source).toContain('const recruitSelection = core.explicitRegionId && recruitSelectionFromCore');
        expect(source).toContain('? recruitSelectionFromCore');
        expect(source).toContain(': recruitSelectionFromMirror;');
        expect(source).toContain('const maShiTradeSelectionFromCore = getCoreQidahenMaShiTradeSelectionForCore(core);');
        expect(source).toContain('const maShiTradeSelectionFromMirror = getQidahenMaShiTradeSelectionForCore(core, activeInteraction);');
        expect(source).toContain('const maShiTradeSelection = core.explicitRegionId && maShiTradeSelectionFromCore');
        expect(source).not.toContain('const handLimitDiscardSelection = handLimitDiscardSelectionFromInteraction ?? core.handLimitDiscardSelection;');
        expect(source).not.toContain('const recruitSelection = recruitSelectionFromInteraction');
        expect(source).not.toContain('diplomacySelectionFromInteraction,');
        expect(source).not.toContain('const internalDispatchSelection = internalDispatchSelectionFromInteraction;');
        expect(source).not.toContain('const maShiTradeSelection = maShiTradeSelectionFromInteraction');
        expect(source).not.toContain('const khanEdictSelection = khanEdictSelectionFromInteraction');
    });

    it('外交 runtime builder 应走共享 getter，不得继续在 runtime 文件内比较 interaction/core 两套 selection 真相', () => {
        const source = readTurnActionInteractionBuildersSource();

        expect(source).toContain('function buildQidahenDiplomacyInteraction(');
        expect(source).toContain('const selection = getQidahenDiplomacySelectionForCore(state.core, state.sys.interaction?.current);');
        expect(source).not.toContain('const interactionSelection = getQidahenDiplomacySelectionFromInteraction(state.sys.interaction?.current);');
        expect(source).not.toContain('const coreSelection = core.diplomacySelection;');
        expect(source).not.toContain('export function getQidahenDiplomacySelectionForCore(');
    });

    it('轮盘调度 runtime builder 应只在 dispatch-targeting 阶段优先吃当前 interaction 快照，再回退 current getter', () => {
        const source = readTurnActionInteractionBuildersSource();

        expect(source).toContain('function buildQidahenWheelDispatchInteraction(');
        expect(source).toContain("const selection = state.core.turnPhase === 'dispatch-targeting'");
        expect(source).toContain('getQidahenWheelDispatchSelectionForCore(state.core, state.sys.interaction?.current)');
        expect(source).toContain('?? getQidahenCurrentWheelDispatchSelectionForCore(state.core)');
    });

    it('轮盘进攻 runtime builder 的 subtitle 不再复述候选数量', () => {
        const source = readTurnActionInteractionBuildersSource();

        expect(source).toContain("subtitle: '进攻目标'");
        expect(source).not.toContain('可去 ${selection.candidates.length} 处');
        expect(source).not.toContain('选择进攻目标 · 可去');
    });

    it('骑兵避战与劫掠判定应共用 compat piece 计数口径，不能继续直接数 specialTroops 聚合栈', () => {
        const source = readPendingTargetChoiceOptionsSource();

        expect(source).toContain("import { countCompatTroopsByKind } from './troopCompat';");
        expect(source).toContain("countCompatTroopsByKind(targetRegion.specialTroops, 'cavalry') <= 0");
        expect(source).toContain("const cavalryCount = countCompatTroopsByKind(sourceRegion.specialTroops, 'cavalry');");
        expect(source).not.toContain("targetRegion.specialTroops.some((stack) => stack.troopKind === 'cavalry' && stack.count > 0)");
        expect(source).not.toContain(".filter((stack) => stack.troopKind === 'cavalry')");
        expect(source).not.toContain(".reduce((sum, stack) => sum + stack.count, 0)");
    });

    it('selection 与 interaction 不应继续各自内嵌 compat troop helper，而应共用中立 troopCompat owner', () => {
        const boardSource = readBoardSource();
        const battleBuilderSource = readBattleInteractionBuildersSource();
        const choiceOptionsSource = readPendingTargetChoiceOptionsSource();
        const selectionSource = readSelectionBuildersSource();
        const compatSource = readTroopCompatSource();

        expect(selectionSource).toContain("} from './troopCompat';");
        expect(choiceOptionsSource).toContain("import { countCompatTroopsByKind } from './troopCompat';");
        expect(choiceOptionsSource).toContain("} from './regionConfig';");
        expect(battleBuilderSource).toContain("} from './pendingTargetChoiceOptions';");
        expect(boardSource).toContain("} from './domain/pendingTargetChoiceOptions';");
        expect(battleBuilderSource).not.toContain("import { countCompatTroopsByKind } from './troopCompat';");
        expect(boardSource).not.toContain("import { getQidahenRuleRegionTags } from './domain/regionConfig';");
        expect(boardSource).not.toContain("const getDefenderCavalryEvasionRetreatChoices = (");
        expect(boardSource).not.toContain("const canUseAttackerCavalryPlunder = (");
        expect(boardSource).not.toContain("const canUseAttackerCavalryPlunderDefenderDeck = (");
        expect(choiceOptionsSource).toContain('const getDefenderCavalryEvasionRetreatChoices = (');
        expect(choiceOptionsSource).toContain('const canUseAttackerCavalryPlunder = (');
        expect(choiceOptionsSource).toContain('const canUseAttackerCavalryPlunderDefenderDeck = (');
        expect(selectionSource).not.toContain('const expandSpecialTroopStacksToCompatPieces = (');
        expect(selectionSource).not.toContain('const collapseCompatPiecesToSpecialTroopStacks = (');
        expect(selectionSource).not.toContain('const mergeSpecialTroopStackGroupsAsPieces = (');
        expect(selectionSource).not.toContain('const countCompatPieces = (');
        expect(selectionSource).not.toContain('const hasNonMercenaryTroops = (');
        expect(selectionSource).not.toContain('export const formatTroopTransferDetails = (');
        expect(compatSource).toContain('export const expandSpecialTroopStacksToCompatPieces = (');
        expect(compatSource).toContain('export const collapseCompatPiecesToSpecialTroopStacks = (');
        expect(compatSource).toContain('export const mergeSpecialTroopStackGroupsAsPieces = (');
        expect(compatSource).toContain('export const countCompatPieces = (');
        expect(compatSource).toContain('export const countCompatTroopsByKind = (');
        expect(compatSource).toContain('export const hasNonMercenaryTroops = (');
        expect(compatSource).toContain('export const formatTroopTransferDetails = (');
    });

    it('index 不应继续本地维护与 troopCompat 重复的 compat troop helper，而应直接消费中立 owner', () => {
        const actionWindowChoicesSource = readActionWindowChoicesSource();
        const characterActionWindowSource = readCharacterActionWindowSource();
        const coreDerivedStateSource = readCoreDerivedStateSource();
        const indexSource = readDomainIndexSource();
        const initialCoreSetupSource = readInitialCoreSetupSource();
        const pendingTargetResolutionDependenciesSource = readPendingTargetResolutionDependenciesSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();
        const compatSource = readTroopCompatSource();
        const mapTokensSource = readMapTokensSource();
        const runtimeRegionRulesSource = readRuntimeRegionRulesSource();
        const scenarioRuntimeRegionPresetsSource = readScenarioRuntimeRegionPresetsSource();
        const seasonResolutionSource = readSeasonResolutionSource();
        const wheelImmediateEffectSource = readWheelImmediateEffectSource();

        expect(pendingTargetResolutionDependenciesSource).toBe('');
        expect(pendingTargetResolutionSource).toContain("} from './troopCompat';");
        expect(pendingTargetResolutionSource).toContain('getSpecialTroopCount,');
        expect(indexSource).not.toContain('collapseCompatPiecesToSpecialTroopStacks,');
        expect(indexSource).not.toContain('cloneRuntimeRegionAsPieceSnapshot,');
        expect(indexSource).not.toContain('expandSpecialTroopStacksToCompatPieces,');
        expect(indexSource).not.toContain('getRegularTroopCount,');
        expect(indexSource).not.toContain('addSpecialTroopStackToRegion,');
        expect(characterActionWindowSource).toContain("} from './troopCompat';");
        expect(characterActionWindowSource).toContain('addSpecialTroopStackToRegion,');
        expect(characterActionWindowSource).toContain('cloneRuntimeRegionAsPieceSnapshot,');
        expect(characterActionWindowSource).toContain('hasNonMercenaryTroops,');
        expect(characterActionWindowSource).toContain('someCompatPieces,');
        expect(wheelImmediateEffectSource).toContain("import { addSpecialTroopStackToRegion } from './troopCompat';");
        expect(mapTokensSource).toContain("import { inferTroopKindForStack, syncPiecesFromRegions } from './troopCompat';");
        expect(initialCoreSetupSource).not.toContain("import { cloneSpecialTroopStacksAsPieces } from './troopCompat';");
        expect(scenarioRuntimeRegionPresetsSource).toContain("import { cloneSpecialTroopStacksAsPieces } from './troopCompat';");
        expect(pendingTargetResolutionSource).toContain('subtractSpecialTroopStacks,');
        expect(indexSource).not.toContain('sortCompatPiecesForRemoval,');
        expect(seasonResolutionSource).toContain("} from './troopCompat';");
        expect(seasonResolutionSource).toContain('collapseCompatPiecesToSpecialTroopStacks,');
        expect(seasonResolutionSource).toContain('cloneRuntimeRegionAsPieceSnapshot,');
        expect(seasonResolutionSource).toContain('expandSpecialTroopStacksToCompatPieces,');
        expect(seasonResolutionSource).toContain('getRegularTroopCount,');
        expect(seasonResolutionSource).toContain('getSpecialTroopCount,');
        expect(seasonResolutionSource).toContain('sortCompatPiecesForRemoval,');
        expect(runtimeRegionRulesSource).toContain('cloneCityStateAsPieceSnapshot,');
        expect(runtimeRegionRulesSource).toContain('cloneRuntimeRegionAsPieceSnapshot,');
        expect(runtimeRegionRulesSource).toContain('cloneSiegeStateAsPieceSnapshot,');
        expect(runtimeRegionRulesSource).toContain('mergeSpecialTroopStackGroupsAsPieces,');
        expect(coreDerivedStateSource).toContain('syncRegionsPieceIds,');
        expect(coreDerivedStateSource).toContain('syncPiecesFromRegions,');
        expect(coreDerivedStateSource).toContain('syncRegionsSpecialTroopsFromPieces,');
        expect(actionWindowChoicesSource).toContain('removeMercenarySpecialTroops,');
        expect(compatSource).not.toContain('export const normalizeSpecialTroopStack = (');
        expect(compatSource).toContain('const normalizeSpecialTroopStack = (');
        expect(indexSource).not.toContain('const inferTroopKindForStack = (');
        expect(indexSource).not.toContain('const normalizeStackPieceIds = (');
        expect(indexSource).not.toContain('const normalizeSpecialTroopStack = (');
        expect(indexSource).not.toContain('const addSpecialTroopStackToRegion = (');
        expect(indexSource).not.toContain('const addSpecialTroopStacksToRegion = (');
        expect(indexSource).not.toContain('const cloneCityStateAsPieceSnapshot = (');
        expect(indexSource).not.toContain('const cloneRuntimeRegionAsPieceSnapshot = (');
        expect(indexSource).not.toContain('const cloneSiegeStateAsPieceSnapshot = (');
        expect(indexSource).not.toContain('const syncRegionPieceIds = (');
        expect(indexSource).not.toContain('const syncRegionsPieceIds = (');
        expect(indexSource).not.toContain('const syncPiecesFromRegions = (');
        expect(indexSource).not.toContain('const syncRegionsSpecialTroopsFromPieces = (');
        expect(indexSource).not.toContain('const expandSpecialTroopStacksToCompatPieces = (');
        expect(indexSource).not.toContain('const expandSpecialTroopStacksToPieces = (');
        expect(indexSource).not.toContain('const collapseCompatPiecesToSpecialTroopStacks = (');
        expect(indexSource).not.toContain('const someCompatPieces = (');
        expect(indexSource).not.toContain('const filterCompatPiecesToSpecialTroopStacks = (');
        expect(indexSource).not.toContain('const collapsePiecesToSpecialTroopStacks = (');
        expect(indexSource).not.toContain('const cloneSpecialTroopStacksAsPieces = (');
        expect(indexSource).not.toContain('const sortCompatPiecesForRemoval = (');
        expect(indexSource).not.toContain('const sortCompatPiecesForSelection = (');
        expect(indexSource).not.toContain('const isMercenaryCompatPiece = (');
        expect(indexSource).not.toContain('const countCompatPieces = (');
        expect(indexSource).not.toContain('const mergeSpecialTroopStackGroupsAsPieces = (');
        expect(indexSource).not.toContain('const getArtilleryTroopCount = (');
        expect(indexSource).not.toContain('const getMercenaryTroopCount = (');
        expect(compatSource).toContain('const getMercenaryTroopCount = (');
        expect(compatSource).not.toContain('export const getMercenaryTroopCount = (');
        expect(compatSource).not.toContain("export type QidahenCompatPieceView = Pick<");
        expect(compatSource).toContain("type QidahenCompatPieceView = Pick<");
        expect(indexSource).not.toContain('const getRegularTroopCount = (');
        expect(indexSource).not.toContain('const getSpecialTroopCount = (');
        expect(indexSource).not.toContain('const hasNonMercenaryTroops = (');
        expect(indexSource).not.toContain('const removeMercenarySpecialTroops = (');
        expect(indexSource).not.toContain('const subtractSpecialTroopStacks = (');
        expect(compatSource).not.toContain('export const normalizeStackPieceIds = (');
        expect(compatSource).toContain('const normalizeStackPieceIds = (');
        expect(compatSource).toContain('export const someCompatPieces = (');
        expect(compatSource).toContain('export const filterCompatPiecesToSpecialTroopStacks = (');
        expect(compatSource).not.toContain('export const collapsePiecesToSpecialTroopStacks = (');
        expect(compatSource).toContain('const collapsePiecesToSpecialTroopStacks = (');
        expect(compatSource).toContain('export const addSpecialTroopStackToRegion = (');
        expect(compatSource).toContain('export const addSpecialTroopStacksToRegion = (');
        expect(compatSource).not.toContain('export const assignPieceIdsToStacks = (');
        expect(compatSource).toContain('const assignPieceIdsToStacks = (');
        expect(compatSource).toContain('export const cloneSpecialTroopStacksAsPieces = (');
        expect(compatSource).toContain('export const cloneCityStateAsPieceSnapshot = (');
        expect(compatSource).toContain('export const cloneRuntimeRegionAsPieceSnapshot = (');
        expect(compatSource).toContain('export const cloneSiegeStateAsPieceSnapshot = (');
        expect(compatSource).not.toContain('export const syncRegionPieceIds = (');
        expect(compatSource).toContain('const syncRegionPieceIds = (');
        expect(compatSource).toContain('export const syncRegionsPieceIds = (');
        expect(compatSource).toContain('export const syncPiecesFromRegions = (');
        expect(compatSource).toContain('export const syncRegionsSpecialTroopsFromPieces = (');
        expect(compatSource).not.toContain('export const expandSpecialTroopStacksToPieces = (');
        expect(compatSource).toContain('const expandSpecialTroopStacksToPieces = (');
        expect(compatSource).toContain('export const getArtilleryTroopCount = (');
        expect(compatSource).toContain('export const getRegularTroopCount = (');
        expect(compatSource).toContain('export const hasNonMercenaryTroops = (');
        expect(compatSource).not.toContain('export const isMercenaryCompatPiece = (');
        expect(compatSource).toContain('const isMercenaryCompatPiece = (');
        expect(compatSource).toContain('export const removeMercenarySpecialTroops = (');
        expect(compatSource).toContain('export const sortCompatPiecesForRemoval = (');
        expect(compatSource).toContain('export const sortCompatPiecesForSelection = (');
        expect(compatSource).toContain('export const subtractSpecialTroopStacks = (');
    });

    it('map token 同步应由独立 mapTokens owner 承接，index 不再本地维护 token 坐标与图标生成 helper', () => {
        const indexSource = readDomainIndexSource();
        const coreDerivedStateSource = readCoreDerivedStateSource();
        const mapTokensSource = readMapTokensSource();

        expect(indexSource).not.toContain("} from './coreDerivedState';");
        expect(indexSource).not.toContain('const clampMapTokenCoordinate = (');
        expect(indexSource).not.toContain('const getMapTokenBaseId = (');
        expect(indexSource).not.toContain('const getMapTokenPoint = (');
        expect(indexSource).not.toContain('const getMapArmyImageSrc = (');
        expect(indexSource).not.toContain('const getMapArmyImageSrcForPiece = (');
        expect(indexSource).not.toContain('const buildMapArmyTokensForRegion = (');
        expect(indexSource).not.toContain('const syncMapTokensFromRegions = (');
        expect(coreDerivedStateSource).toContain("import { syncQidahenMapTokensFromRegions } from './mapTokens';");
        expect(coreDerivedStateSource).toContain('mapTokens: syncQidahenMapTokensFromRegions(regions, pieces),');
        expect(mapTokensSource).toContain("import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_WIDTH } from '../ui/mapRegions';");
        expect(mapTokensSource).toContain("import { getRegularTroopKindForFaction } from './troopStacks';");
        expect(mapTokensSource).toContain("import { inferTroopKindForStack, syncPiecesFromRegions } from './troopCompat';");
        expect(mapTokensSource).toContain('const controlMarkerByFaction: Record<QidahenFactionId, string> = {');
        expect(mapTokensSource).toContain('const diplomacyMarkerImageByFaction: Record<QidahenFactionId, Record<\'friendly\' | \'vassal\', string>> = {');
        expect(mapTokensSource).not.toContain('const getMapTokenBaseId = (');
        expect(mapTokensSource).not.toContain('const getMapArmyImageSrcForPiece = (');
        expect(mapTokensSource).toContain('const baseId = legacyMapTokenBaseIdByRegion[region.id] ?? region.id;');
        expect(mapTokensSource).toContain("type: 'marker',");
        expect(mapTokensSource).toContain("imageSrc: marker.imageSrc,");
        expect(mapTokensSource).toContain('imageSrc: getMapArmyImageSrc(region.controller, {');
        expect(mapTokensSource).toContain('id: piece.sourceStackId,');
        expect(mapTokensSource).toContain('troopKind: piece.troopKind,');
        expect(mapTokensSource).toContain('export const syncQidahenMapTokensFromRegions = (');
    });

    it('core derived sync glue 应由独立 owner 承接，index 不再本地维护 piece collections 与 selection mirrors', () => {
        const indexSource = readDomainIndexSource();
        const coreDerivedStateSource = readCoreDerivedStateSource();
        const initialCoreSetupSource = readInitialCoreSetupSource();
        const specialRuleStateSource = readSpecialRuleStateSource();
        const turnFlowOrchestrationSource = readTurnFlowOrchestrationSource();
        const turnAdvanceSource = readTurnAdvanceSource();
        const turnLabelStateSource = readTurnLabelStateSource();

        expect(indexSource).not.toContain("} from './coreDerivedState';");
        expect(indexSource).not.toContain('syncQidahenCorePieceCollections,');
        expect(indexSource).not.toContain('function syncCurrentCoreSelections(state: QidahenCore): QidahenCore {');
        expect(indexSource).not.toContain('const syncCorePieceCollections = (state: QidahenCore): QidahenCore => {');
        expect(indexSource).not.toContain('syncCurrentCoreSelections: syncQidahenCurrentCoreSelections,');
        expect(initialCoreSetupSource).toContain('const syncedBaseCore = syncQidahenCorePieceCollections(baseCore);');
        expect(turnFlowOrchestrationSource).toBe('');
        expect(turnLabelStateSource).toContain("} from './coreDerivedState';");
        expect(turnLabelStateSource).toContain('syncQidahenCorePieceCollections,');
        expect(turnLabelStateSource).toContain('syncQidahenCurrentCoreSelections,');
        expect(turnLabelStateSource).toContain('syncCorePieceCollections: syncQidahenCorePieceCollections,');
        expect(turnLabelStateSource).toContain('syncCurrentCoreSelections: syncQidahenCurrentCoreSelections,');
        expect(specialRuleStateSource).toContain("import { syncQidahenCorePieceCollections } from './coreDerivedState';");
        expect(specialRuleStateSource).toContain('syncCorePieceCollections: syncQidahenCorePieceCollections,');
        expect(turnAdvanceSource).toContain("} from './coreDerivedState';");
        expect(turnAdvanceSource).toContain('syncCurrentCoreSelections: syncQidahenCurrentCoreSelections,');

        expect(coreDerivedStateSource).toContain("import { syncQidahenMapTokensFromRegions } from './mapTokens';");
        expect(coreDerivedStateSource).not.toContain("} from './selectionBuilders';");
        expect(coreDerivedStateSource).toContain("} from './troopCompat';");
        expect(coreDerivedStateSource).toContain('export const syncQidahenCurrentCoreSelections = (');
        expect(coreDerivedStateSource).not.toContain('const internalDispatchSelection = getQidahenInternalDispatchSelectionForCore(state);');
        expect(coreDerivedStateSource).not.toContain('getQidahenCurrentDiplomacySelectionForCore');
        expect(coreDerivedStateSource).toContain('const wheelDispatchSelection = getQidahenCurrentWheelDispatchSelectionForCore(state);');
        expect(coreDerivedStateSource).toContain('const shouldKeepWheelDispatchSelectionOffHost = state.wheelDispatchProgress == null');
        expect(coreDerivedStateSource).toContain("state.turnPhase === 'dispatch-targeting'");
        expect(coreDerivedStateSource).toContain("state.turnPhase === 'drive-tiger-consent'");
        expect(coreDerivedStateSource).toContain("wheelDispatchSelection?.sourceActionId === 'wheel-dispatch'");
        expect(coreDerivedStateSource).toContain("wheelDispatchSelection?.sourceActionId === 'drive-tiger'");
        expect(coreDerivedStateSource).toContain('wheelDispatchProgress: shouldKeepWheelDispatchSelectionOffHost ? null : wheelDispatchSelection,');
        expect(coreDerivedStateSource).toContain('export const syncQidahenCorePieceCollections = (');
        expect(coreDerivedStateSource).toContain('const syncedPieceIdState = syncRegionsPieceIds(state.regions, state.nextPieceSerial);');
        expect(coreDerivedStateSource).toContain('const pieces = syncPiecesFromRegions(syncedPieceIdState.regions);');
        expect(coreDerivedStateSource).toContain('const regions = syncRegionsSpecialTroopsFromPieces(syncedPieceIdState.regions, pieces);');
    });

    it('index 不应继续本地维护部队栈构造/等级钳制 helper，而应直接消费更窄的 troopStacks owner', () => {
        const battleRollMathSource = readBattleRollMathSource();
        const indexSource = readDomainIndexSource();
        const initialCoreSetupSource = readInitialCoreSetupSource();
        const mapTokensSource = readMapTokensSource();
        const scenarioRuntimeRegionPresetsSource = readScenarioRuntimeRegionPresetsSource();
        const troopStacksSource = readTroopStacksSource();
        const wheelImmediateEffectSource = readWheelImmediateEffectSource();

        expect(indexSource).not.toContain("import { buildRegularTroopStack } from './troopStacks';");
        expect(initialCoreSetupSource).not.toContain('buildArtilleryTroopStack,');
        expect(initialCoreSetupSource).not.toContain('buildFactionTroopStack,');
        expect(initialCoreSetupSource).not.toContain('buildMercenaryTroopStack,');
        expect(initialCoreSetupSource).not.toContain('buildRegularTroopStack,');
        expect(scenarioRuntimeRegionPresetsSource).toContain('buildArtilleryTroopStack,');
        expect(scenarioRuntimeRegionPresetsSource).toContain('buildFactionTroopStack,');
        expect(scenarioRuntimeRegionPresetsSource).toContain('buildMercenaryTroopStack,');
        expect(scenarioRuntimeRegionPresetsSource).toContain('buildRegularTroopStack,');
        expect(wheelImmediateEffectSource).toContain("import { buildRegularTroopStack } from './troopStacks';");
        expect(indexSource).not.toContain('getRegularTroopKindForFaction,');
        expect(indexSource).not.toContain('clampTroopLevel,');
        expect(indexSource).not.toContain('QIDAHEN_TROOP_KIND_LABELS,');
        expect(indexSource).not.toContain('const getRegularTroopKindForFaction = (');
        expect(indexSource).not.toContain('const troopKindLabelById: Record<QidahenTroopKind, string> = {');
        expect(indexSource).not.toContain('const normalizeScenarioTroopLevel = (');
        expect(indexSource).not.toContain('const buildRegularTroopStack = (');
        expect(indexSource).not.toContain('const buildFactionTroopStack = (');
        expect(indexSource).not.toContain('const buildArtilleryTroopStack = (');
        expect(indexSource).not.toContain('const buildMercenaryTroopStack = (');
        expect(indexSource).not.toContain('const clampTroopLevel = (');
        expect(troopStacksSource).not.toContain('export const QIDAHEN_TROOP_KIND_LABELS: Record<QidahenTroopKind, string> = {');
        expect(troopStacksSource).toContain('const QIDAHEN_TROOP_KIND_LABELS: Record<QidahenTroopKind, string> = {');
        expect(troopStacksSource).toContain('export const getQidahenTroopKindLabel = (troopKind: QidahenTroopKind): string => (');
        expect(troopStacksSource).not.toContain('const normalizeScenarioTroopLevel = (');
        expect(troopStacksSource).toContain('export const clampTroopLevel = (');
        expect(troopStacksSource).toContain('id: `${factionId}-${sourceId}-${troopKind}-lv${clampTroopLevel(level)}`');
        expect(troopStacksSource).toContain('level: clampTroopLevel(level),');
        expect(troopStacksSource).toContain('export const getRegularTroopKindForFaction = (');
        expect(battleRollMathSource).toContain('getQidahenTroopKindLabel,');
        expect(battleRollMathSource).toContain('额亦都指定${getQidahenTroopKindLabel(bestCandidate.phase)}先掷');
        expect(battleRollMathSource).not.toContain('QIDAHEN_TROOP_KIND_LABELS[bestCandidate.phase]');
        expect(mapTokensSource).toContain("import { getRegularTroopKindForFaction } from './troopStacks';");
        expect(troopStacksSource).toContain('export const buildRegularTroopStack = (');
        expect(troopStacksSource).toContain('export const buildFactionTroopStack = (');
        expect(troopStacksSource).toContain('export const buildArtilleryTroopStack = (');
        expect(troopStacksSource).toContain('export const buildMercenaryTroopStack = (');
    });

    it('训练 helper 应留在独立 troopTraining owner，caller note 文案不得再混回 helper 合同', () => {
        const characterActionWindowSource = readCharacterActionWindowSource();
        const indexSource = readDomainIndexSource();
        const compatSource = readTroopCompatSource();
        const troopTrainingSource = readTroopTrainingSource();
        const wheelImmediateEffectSource = readWheelImmediateEffectSource();

        expect(indexSource).not.toContain("} from './troopTraining';");
        expect(indexSource).not.toContain('trainArtilleryStacksToLevel,');
        expect(indexSource).not.toContain('const trainArtilleryStacksToLevel = (');
        expect(indexSource).not.toContain('const trainSpecialTroopsOneStepForFaction = (');
        expect(indexSource).not.toContain('const trainTroopsOneStepForFactionWithLimit = (');
        expect(characterActionWindowSource).toContain("} from './troopTraining';");
        expect(characterActionWindowSource).toContain('trainSpecialTroopsOneStepForFaction,');
        expect(characterActionWindowSource).toContain('trainTroopsOneStepForFactionWithLimit,');
        expect(wheelImmediateEffectSource).toContain("} from './troopTraining';");
        expect(wheelImmediateEffectSource).toContain("import { trainArtilleryStacksToLevel } from './troopTraining';");
        expect(troopTrainingSource).toContain('export const trainArtilleryStacksToLevel = (');
        expect(troopTrainingSource).toContain('export const trainSpecialTroopsOneStepForFaction = (');
        expect(troopTrainingSource).toContain('export const trainTroopsOneStepForFactionWithLimit = (');
        expect(troopTrainingSource).not.toContain('export interface QidahenArtilleryTrainingResult {');
        expect(troopTrainingSource).toContain('interface QidahenArtilleryTrainingResult {');
        expect(troopTrainingSource).not.toContain('export interface QidahenTroopTrainingResult {');
        expect(troopTrainingSource).toContain('interface QidahenTroopTrainingResult {');
        expect(troopTrainingSource).not.toContain('export interface QidahenLimitedTroopTrainingOptions {');
        expect(troopTrainingSource).toContain('interface QidahenLimitedTroopTrainingOptions {');
        expect(troopTrainingSource).not.toContain('type QidahenCompatPieceTrainingDetailEntry,');
        expect(troopTrainingSource).toContain('interface QidahenTroopTrainingDetailEntry {');
        expect(troopTrainingSource).toContain('buildCompatPieceTrainingDetails,');
        expect(troopTrainingSource).toContain('recordCompatPieceTrainingDetail,');
        expect(troopTrainingSource).toContain('recordSpecialTroopTrainingDetail,');
        expect(troopTrainingSource).toContain('upgradeCompatPieceToLevel,');
        expect(troopTrainingSource).not.toContain('轮盘征兵训练将');
        expect(troopTrainingSource).not.toContain('部队经免费训练后提升 1 级。');
        expect(troopTrainingSource).not.toContain('部队经熊廷弼免费训练后提升 1 级。');
        expect(wheelImmediateEffectSource).toContain('轮盘征兵训练将');
        expect(characterActionWindowSource).toContain('部队经熊廷弼免费训练后提升 1 级。');
        expect(characterActionWindowSource).toContain('因毛文龙免费训练东江部队 1 次。');
        expect(compatSource).not.toContain('export type QidahenCompatPieceTrainingDetailEntry = {');
        expect(compatSource).toContain('type QidahenCompatPieceTrainingDetailEntry = {');
        expect(compatSource).toContain('export const buildCompatPieceTrainingDetails = (');
        expect(compatSource).toContain('export const recordCompatPieceTrainingDetail = (');
        expect(compatSource).toContain('export const recordSpecialTroopTrainingDetail = (');
        expect(compatSource).toContain('export const upgradeCompatPieceToLevel = (');
    });

    it('高第、调度进攻 selection builder 与调度来源偏好 helper 应下沉到 dispatchSelectionBuilders owner，index 不再本地维护对应 selection seam', () => {
        const indexSource = readDomainIndexSource();
        const regionSelectionReducerSource = readRegionSelectionReducerSource();
        const selectedActionExecutionSource = readSelectedActionExecutionSource();
        const selectedActionFollowUpSource = readSelectedActionFollowUpSource();
        const dispatchSelectionSource = readDispatchSelectionBuildersSource();
        const selectionBuildersSource = readSelectionBuildersSource();
        const turnFlowOrchestrationSource = readTurnFlowOrchestrationSource();
        const turnAdvanceSource = readTurnAdvanceSource();
        const wheelMoveExecutionSource = readWheelMoveExecutionSource();
        const characterActionWindowSource = readCharacterActionWindowSource();

        expect(indexSource).not.toContain("} from './dispatchSelectionBuilders';");
        expect(indexSource).not.toContain('buildGaoDiDispatchSelection,');
        expect(indexSource).not.toContain('const buildGaoDiDispatchSelection = (');
        expect(indexSource).not.toContain('const buildDriveTigerDispatchSelection = (');
        expect(indexSource).not.toContain('const buildKhanEdictDispatchSelection = (');
        expect(indexSource).not.toContain('const buildWheelDispatchSelection = (');
        expect(indexSource).not.toContain('const buildWheelDispatchSelectionFromWheel = (');
        expect(indexSource).not.toContain('const getPreferredDispatchSelectedRegionIdForFaction = (');
        expect(indexSource).not.toContain('const getQidahenCurrentWheelDispatchSelectionForCore = (');
        expect(indexSource).not.toContain('const getActionRulePathLabel = (');
        expect(indexSource).not.toContain('const serializeWheelDispatchSelectionForPersistenceCheck = (');
        expect(indexSource).not.toContain('const shouldPersistExplicitWheelDispatchSelectionForWheelState = (');
        expect(indexSource).not.toContain('const compareWheelDispatchCandidate = (');
        expect(indexSource).not.toContain('const buildSiegeContinueDispatchSelection = (');
        expect(regionSelectionReducerSource).toContain("} from './dispatchSelectionBuilders';");
        expect(regionSelectionReducerSource).toContain('buildKhanEdictDispatchSelection,');
        expect(regionSelectionReducerSource).toContain('buildWheelDispatchSelectionFromRegionSemantics,');
        expect(regionSelectionReducerSource).toContain('getQidahenWheelDispatchSelectionRegionSemantics,');
        expect(regionSelectionReducerSource).toContain('getPreferredDispatchSourceRegionIdForSemantics,');
        expect(selectedActionExecutionSource).toContain("} from './selectedActionFollowUp';");
        expect(selectedActionFollowUpSource).toContain("import { buildDriveTigerDispatchSelectionFromRegionSemantics } from './dispatchSelectionBuilders';");
        expect(selectedActionFollowUpSource).toContain('buildDriveTigerDispatchSelectionFromRegionSemantics(state, currentFactionId, baseRegionSemantics)');
        expect(dispatchSelectionSource).not.toContain('export const buildGaoDiDispatchSelection = (');
        expect(dispatchSelectionSource).not.toContain('export const buildDriveTigerDispatchSelection = (');
        expect(dispatchSelectionSource).toContain('export const buildDriveTigerDispatchSelectionFromRegionSemantics = (');
        expect(dispatchSelectionSource).toContain('export const buildKhanEdictDispatchSelection = (');
        expect(dispatchSelectionSource).toContain('export const buildWheelDispatchSelectionFromRegionSemantics = (');
        expect(dispatchSelectionSource).not.toContain('export const buildWheelDispatchSelection = (');
        expect(dispatchSelectionSource).toContain('export interface QidahenWheelDispatchSelectionRegionSemantics {');
        expect(dispatchSelectionSource).toContain('preferredSourceRegionId: string;');
        expect(dispatchSelectionSource).toContain('export const buildWheelDispatchSelectionFromWheel = (');
        expect(dispatchSelectionSource).toContain('export const getPreferredDispatchSourceRegionIdForSemantics = (');
        expect(dispatchSelectionSource).toContain('export const getQidahenCurrentWheelDispatchSelectionForCore = (');
        expect(dispatchSelectionSource).not.toContain('export const getQidahenDriveTigerConsentDispatchSelectionForCore = (');
        expect(dispatchSelectionSource).toContain('if (state.wheelDispatchProgress) {');
        expect(dispatchSelectionSource).toContain('return state.wheelDispatchProgress;');
        expect(dispatchSelectionSource).toContain('buildDriveTigerDispatchSelectionFromRegionSemantics(');
        expect(dispatchSelectionSource).toContain('getQidahenLockedRegionSelectionSemantics(state)');
        expect(dispatchSelectionSource).not.toContain('export const getQidahenWheelPositionDispatchSelectionForCore = (');
        expect(selectionBuildersSource).not.toContain('export const getQidahenCurrentDiplomacyProgressForCore = (');
        expect(selectionBuildersSource).not.toContain('export const getQidahenWheelAttackDiplomacySelectionForCore = (');
        expect(selectionBuildersSource).not.toContain('export const getQidahenKhanEdictInitialDiplomacySelectionForCore = (');
        expect(selectionBuildersSource).not.toContain('export const getQidahenMaShiTradeSelectionFromCurrentAction = (');
        expect(selectionBuildersSource).not.toContain('export const getQidahenRecruitSelectionFromCurrentAction = (');
        expect(selectionBuildersSource).not.toContain('export const getQidahenKhanEdictSelectionFromCurrentAction = (');
        expect(selectionBuildersSource).toContain('export const buildRecruitSelectionFromRegionSemantics = (');
        expect(selectionBuildersSource).toContain('export const buildMaShiTradeSelectionFromRegionSemantics = (');
        expect(selectionBuildersSource).toContain('export const buildKhanEdictSelectionFromRegionSemantics = (');
        expect(selectionBuildersSource).toContain('export const buildDiplomacySelectionFromRegionSemantics = (');
        expect(selectionBuildersSource).not.toContain('export const buildRecruitSelection = (');
        expect(selectionBuildersSource).not.toContain('export const buildMaShiTradeSelection = (');
        expect(selectionBuildersSource).not.toContain('export const buildKhanEdictSelection = (');
        expect(selectionBuildersSource).not.toContain('export const buildDiplomacySelection = (');
        expect(regionSelectionReducerSource).toContain('buildDiplomacySelectionFromRegionSemantics(');
        expect(selectionBuildersSource).toContain('displayAnchorRegionId: resolvePreferredRegionDisplayAnchor(targetRegion, regionSemantics.displayAnchorRegionId)');
        expect(selectionBuildersSource).toContain('displayAnchorRegionName: targetRegionName');
        expect(selectionBuildersSource).toContain('displayAnchorRegionId: preferredSourceRegion');
        expect(selectionBuildersSource).toContain('displayAnchorRegionName: preferredSourceRegionName');
        expect(selectionBuildersSource).toContain('displayAnchorRegionId = preferredSourceDisplayRegionId;');
        expect(selectionBuildersSource).toContain('displayAnchorRegionName = sourceRegionName;');
        expect(selectionBuildersSource).toContain('export const getQidahenMaShiTradeSelectionForCore = (');
        expect(selectionBuildersSource).toContain('export const getQidahenRecruitSelectionForCore = (');
        expect(selectionBuildersSource).toContain('export const getQidahenKhanEdictSelectionForCore = (');
        expect(dispatchSelectionSource).toContain('export const shouldPersistExplicitWheelDispatchSelectionForWheelState = (');
        expect(wheelMoveExecutionSource).toContain("} from './dispatchSelectionBuilders';");
        expect(wheelMoveExecutionSource).toContain('buildWheelDispatchSelectionFromWheel,');
        expect(wheelMoveExecutionSource).toContain('shouldPersistExplicitWheelDispatchSelectionForWheelState,');
        expect(turnFlowOrchestrationSource).toBe('');
        expect(turnAdvanceSource).toContain("} from './dispatchSelectionBuilders';");
        expect(turnAdvanceSource).toContain('getCurrentWheelDispatchSelectionForCore: getQidahenCurrentWheelDispatchSelectionForCore,');
        expect(characterActionWindowSource).toContain("} from './dispatchSelectionBuilders';");
        expect(characterActionWindowSource).toContain('buildGaoDiDispatchSelectionFromRegionSemantics,');
        expect(dispatchSelectionSource).toContain('const serializeWheelDispatchSelectionForPersistenceCheck = (');
        expect(dispatchSelectionSource).toContain('const compareWheelDispatchCandidate = (');
        expect(dispatchSelectionSource).toContain('const buildSiegeContinueDispatchSelection = (');
        expect(dispatchSelectionSource).toContain('getRegionSiegeAttackerForceSnapshot(region, factionId)');
        expect(dispatchSelectionSource).toContain('getMovableTroopCountForProfile(sourceSnapshot, movementProfileId)');
        expect(dispatchSelectionSource).toContain('findQidahenReachableRuntimeRegions(');
        expect(dispatchSelectionSource).toContain('{ movementProfileId }');
        expect(dispatchSelectionSource).toContain('export const getQidahenInternalDispatchSelectionForCore = (');
        expect(selectionBuildersSource).not.toContain("} from './dispatchSelectionBuilders';");
        expect(selectionBuildersSource).not.toContain('buildDriveTigerDispatchSelection,');
        expect(selectionBuildersSource).not.toContain('buildGaoDiDispatchSelection,');
        expect(selectionBuildersSource).not.toContain('buildKhanEdictDispatchSelection,');
        expect(selectionBuildersSource).not.toContain('buildWangHuazhenInternalDispatchSelection,');
        expect(selectionBuildersSource).not.toContain('buildWheelDispatchSelection,');
        expect(selectionBuildersSource).not.toContain('buildWheelDispatchSelectionFromWheel,');
        expect(selectionBuildersSource).not.toContain('getPreferredDispatchSourceRegionIdForSemantics,');
        expect(selectionBuildersSource).not.toContain('getQidahenCurrentWheelDispatchSelectionForCore,');
        expect(selectionBuildersSource).not.toContain('getQidahenInternalDispatchSelectionForCore,');
        expect(selectionBuildersSource).not.toContain('shouldPersistExplicitWheelDispatchSelectionForWheelState,');
    });

    it('高第、王化贞与调度进攻目标锁定链应由 actionWindowDispatch owner 承接，index 只保留依赖装配与薄接线', () => {
        const indexSource = readDomainIndexSource();
        const actionWindowDispatchSource = readActionWindowDispatchSource();
        const dispatchSelectionSource = readDispatchSelectionBuildersSource();
        const turnActionChoiceOrchestrationSource = readTurnActionChoiceOrchestrationSource();
        const turnActionDependenciesSource = readTurnActionDependenciesSource();

        expect(indexSource).not.toContain("} from './actionWindowDispatch';");
        expect(indexSource).not.toContain('buildWangHuazhenInternalDispatchSelection,');
        expect(indexSource).not.toContain('getQidahenCurrentWheelDispatchSelectionForCore,');
        expect(indexSource).not.toContain('getQidahenInternalDispatchSelectionForCore,');
        expect(indexSource).not.toContain("} from './turnActionChoiceOrchestration';");
        expect(indexSource).not.toContain('resolveQidahenGaoDiDispatchChoice as resolveQidahenGaoDiDispatchChoiceWithDependencies,');
        expect(indexSource).not.toContain('resolveQidahenInternalDispatchInteractionChoice as resolveQidahenInternalDispatchInteractionChoiceWithDependencies,');
        expect(indexSource).not.toContain('resolveQidahenWheelDispatchInteractionChoice as resolveQidahenWheelDispatchInteractionChoiceWithDependencies,');
        expect(indexSource).not.toContain('resolveQidahenInternalDispatchInteractionChoice,');
        expect(indexSource).not.toContain('resolveQidahenWheelDispatchInteractionChoice,');
        expect(indexSource).not.toContain('const QIDAHEN_ACTION_WINDOW_DISPATCH_DEPENDENCIES: QidahenActionWindowDispatchDependencies = {');
        expect(indexSource).not.toContain('const resolveGaoDiDispatch = (');
        expect(indexSource).not.toContain('const resolveInternalDispatch = (');
        expect(indexSource).not.toContain('const selection = interactionSelection ?? getQidahenCurrentWheelDispatchSelectionForCore(state);');
        expect(indexSource).not.toContain('const buildPendingTargetActionFromWheelDispatchChoice = (');
        expect(indexSource).not.toContain('const formatGaoDiDispatchAmountLabel = (');
        expect(indexSource).not.toContain('resolveQidahenInternalDispatchInteractionChoiceWithDependencies(');
        expect(turnActionDependenciesSource).toBe('');
        expect(actionWindowDispatchSource).not.toContain('export interface QidahenActionWindowDispatchDependencies {');
        expect(actionWindowDispatchSource).toContain('interface QidahenActionWindowDispatchDependencies {');
        expect(actionWindowDispatchSource).not.toContain('export const QIDAHEN_ACTION_WINDOW_DISPATCH_DEPENDENCIES: QidahenActionWindowDispatchDependencies = {');
        expect(actionWindowDispatchSource).not.toContain('const QIDAHEN_ACTION_WINDOW_DISPATCH_DEPENDENCIES: QidahenActionWindowDispatchDependencies = {');
        expect(actionWindowDispatchSource).toContain('getCurrentWheelDispatchSelectionForCore: getQidahenCurrentWheelDispatchSelectionForCore,');
        expect(actionWindowDispatchSource).toContain('const resolveGaoDiDispatch = (');
        expect(actionWindowDispatchSource).toContain('const resolveInternalDispatch = (');
        expect(actionWindowDispatchSource).toContain('const buildPendingTargetActionFromWheelDispatchChoice = (');
        expect(actionWindowDispatchSource).toContain('export const resolveQidahenGaoDiDispatchChoice = (');
        expect(actionWindowDispatchSource).not.toContain('export const resolveQidahenGaoDiDispatchChoiceWithDependencies = (');
        expect(actionWindowDispatchSource).toContain('export const resolveQidahenInternalDispatchInteractionChoice = (');
        expect(actionWindowDispatchSource).not.toContain('export const resolveQidahenInternalDispatchInteractionChoiceWithDependencies = (');
        expect(actionWindowDispatchSource).toContain('export const resolveQidahenWheelDispatchInteractionChoice = (');
        expect(actionWindowDispatchSource).not.toContain('export const resolveQidahenWheelDispatchInteractionChoiceWithDependencies = (');
        expect(actionWindowDispatchSource).toContain('dependencies: QidahenActionWindowDispatchDependencies = {');
        expect(actionWindowDispatchSource).toContain("import { getQidahenInteractionSelectionStateForCore } from './interactionSelectionAccessors';");
        expect(actionWindowDispatchSource).not.toContain('const getQidahenActionWindowDispatchSelection = <TSelection>(');
        expect(dispatchSelectionSource).not.toContain('export const buildWangHuazhenInternalDispatchSelection = (');
        expect(dispatchSelectionSource).toContain('export const getQidahenInternalDispatchSelectionForCore = (');
        expect(dispatchSelectionSource).toContain('export const getQidahenCurrentWheelDispatchSelectionForCore = (');
        expect(actionWindowDispatchSource).toMatch(/resolveQidahenGaoDiDispatchChoice[\s\S]*const selection = getQidahenInteractionSelectionStateForCore\([\s\S]*interactionSelection,[\s\S]*state,[\s\S]*\(core\) => core\.gaoDiDispatchSelection,[\s\S]*\);/);
        expect(actionWindowDispatchSource).toMatch(/resolveQidahenInternalDispatchInteractionChoice[\s\S]*const selection = getQidahenInteractionSelectionStateForCore\([\s\S]*interactionSelection,[\s\S]*state,[\s\S]*getQidahenInternalDispatchSelectionForCore,[\s\S]*\);/);
        expect(actionWindowDispatchSource).toMatch(/resolveQidahenWheelDispatchInteractionChoice[\s\S]*const selection = getQidahenInteractionSelectionStateForCore\([\s\S]*interactionSelection,[\s\S]*state,[\s\S]*dependencies\.getCurrentWheelDispatchSelectionForCore,[\s\S]*\);/);
        expect(actionWindowDispatchSource).not.toContain('const formatGaoDiDispatchAmountLabel = (');
        expect(actionWindowDispatchSource).toContain("const dispatchAmountLabel = choice.mode === 'troops'");
        expect(actionWindowDispatchSource).toContain('dependencies.buildSeasonSummary(');
        expect(actionWindowDispatchSource).toContain('dependencies.updateTurnLabel({');
        expect(turnActionChoiceOrchestrationSource).toBe('');
    });

    it('征召军队、外交雇佣、马市贸易、大汗令箭与驱虎吞狼同意链应由 actionWindowChoices owner 承接，index 只保留依赖装配与薄接线', () => {
        const indexSource = readDomainIndexSource();
        const actionWindowChoicesSource = readActionWindowChoicesSource();
        const turnActionChoiceOrchestrationSource = readTurnActionChoiceOrchestrationSource();
        const turnActionDependenciesSource = readTurnActionDependenciesSource();

        expect(indexSource).not.toContain("} from './actionWindowChoices';");
        expect(indexSource).not.toContain("} from './turnActionChoiceOrchestration';");
        expect(indexSource).not.toContain('resolveQidahenDiplomacyInteractionChoice as resolveQidahenDiplomacyInteractionChoiceWithDependencies,');
        expect(indexSource).not.toContain('resolveQidahenRecruitInteractionChoice as resolveQidahenRecruitInteractionChoiceWithDependencies,');
        expect(indexSource).not.toContain('resolveQidahenDriveTigerConsentInteractionChoice as resolveQidahenDriveTigerConsentInteractionChoiceWithDependencies,');
        expect(indexSource).not.toContain('resolveQidahenKhanEdictInteractionChoice as resolveQidahenKhanEdictInteractionChoiceWithDependencies,');
        expect(indexSource).not.toContain('resolveQidahenMaShiTradeInteractionChoice as resolveQidahenMaShiTradeInteractionChoiceWithDependencies,');
        expect(indexSource).not.toContain('resolveQidahenDiplomacyInteractionChoice,');
        expect(indexSource).not.toContain('resolveQidahenRecruitInteractionChoice,');
        expect(indexSource).not.toContain('resolveQidahenDriveTigerConsentInteractionChoice,');
        expect(indexSource).not.toContain('resolveQidahenKhanEdictInteractionChoice,');
        expect(indexSource).not.toContain('resolveQidahenMaShiTradeInteractionChoice,');
        expect(indexSource).not.toContain('const QIDAHEN_ACTION_WINDOW_CHOICE_DEPENDENCIES: QidahenActionWindowChoiceDependencies = {');
        expect(indexSource).not.toContain('resolveQidahenDiplomacyInteractionChoiceWithDependencies(');
        expect(indexSource).not.toContain('resolveQidahenRecruitInteractionChoiceWithDependencies(');
        expect(indexSource).not.toContain('resolveQidahenDriveTigerConsentInteractionChoiceWithDependencies(');
        expect(indexSource).not.toContain('resolveQidahenMaShiTradeInteractionChoiceWithDependencies(');
        expect(indexSource).not.toContain('resolveQidahenKhanEdictInteractionChoiceWithDependencies(');
        expect(indexSource).not.toContain('const selection = interactionSelection ?? getQidahenCurrentDiplomacySelectionForCore(state);');
        expect(indexSource).not.toContain('const selection = interactionSelection ?? getQidahenRecruitSelectionForCore(state);');
        expect(indexSource).not.toContain('const selection = interactionSelection ?? getQidahenDriveTigerConsentSelectionForCore(state);');
        expect(indexSource).not.toContain('const selection = interactionSelection ?? getQidahenMaShiTradeSelectionForCore(state);');
        expect(indexSource).not.toContain('const selection = interactionSelection ?? getQidahenKhanEdictSelectionForCore(state);');
        expect(indexSource).not.toContain('id: `log-diplomacy-${timestamp}`');
        expect(indexSource).not.toContain('id: `log-recruit-${timestamp}`');
        expect(indexSource).not.toContain('id: `log-drive-tiger-consent-${timestamp}`');
        expect(indexSource).not.toContain('id: `log-ma-shi-trade-${timestamp}`');
        expect(indexSource).not.toContain('id: `log-khan-edict-${timestamp}`');
        expect(turnActionDependenciesSource).toBe('');

        expect(actionWindowChoicesSource).not.toContain('export interface QidahenActionWindowChoiceDependencies {');
        expect(actionWindowChoicesSource).toContain('interface QidahenActionWindowChoiceDependencies {');
        expect(actionWindowChoicesSource).not.toContain('export const QIDAHEN_ACTION_WINDOW_CHOICE_DEPENDENCIES: QidahenActionWindowChoiceDependencies = {');
        expect(actionWindowChoicesSource).not.toContain('const QIDAHEN_ACTION_WINDOW_CHOICE_DEPENDENCIES: QidahenActionWindowChoiceDependencies = {');
        expect(actionWindowChoicesSource).toContain('getFactionDrawPileCount,');
        expect(actionWindowChoicesSource).toContain('getActionRuleDisplayRegionName,');
        expect(actionWindowChoicesSource).toContain('getQidahenInteractionSelectionStateForCore,');
        expect(actionWindowChoicesSource).not.toContain('const getQidahenActionWindowInteractionSelection = <TSelection>(');
        expect(actionWindowChoicesSource).toMatch(/resolveQidahenRecruitInteractionChoice[\s\S]*const selection = getQidahenInteractionSelectionStateForCore\([\s\S]*interactionSelection,[\s\S]*state,[\s\S]*getQidahenRecruitSelectionForCore,[\s\S]*\);/);
        expect(actionWindowChoicesSource).toMatch(/resolveQidahenDriveTigerConsentInteractionChoice[\s\S]*const selection = getQidahenInteractionSelectionStateForCore\([\s\S]*interactionSelection,[\s\S]*state,[\s\S]*getQidahenDriveTigerConsentSelectionForCore,[\s\S]*\);/);
        expect(actionWindowChoicesSource).toMatch(/resolveQidahenMaShiTradeInteractionChoice[\s\S]*const selection = getQidahenInteractionSelectionStateForCore\([\s\S]*interactionSelection,[\s\S]*state,[\s\S]*getQidahenMaShiTradeSelectionForCore,[\s\S]*\);/);
        expect(actionWindowChoicesSource).toMatch(/resolveQidahenKhanEdictInteractionChoice[\s\S]*const selection = getQidahenInteractionSelectionStateForCore\([\s\S]*interactionSelection,[\s\S]*state,[\s\S]*getQidahenKhanEdictSelectionForCore,[\s\S]*\);/);
        expect(actionWindowChoicesSource).toMatch(/resolveQidahenDiplomacyInteractionChoice[\s\S]*const selection = getQidahenInteractionSelectionStateForCore\([\s\S]*interactionSelection,[\s\S]*state,[\s\S]*getQidahenCurrentDiplomacySelectionForCore,[\s\S]*\);/);
        expect(actionWindowChoicesSource).toContain('buildDiplomacySelectionFromRegionSemantics,');
        expect(actionWindowChoicesSource).not.toContain('buildDiplomacySelection,');
        expect(actionWindowChoicesSource).toContain('getQidahenExplicitRegionSelectionSemantics,');
        expect(actionWindowChoicesSource).toContain('getQidahenLockedRegionSelectionSemantics,');
        expect(actionWindowChoicesSource).toContain('const resolveDiplomacyChoice = (');
        expect(actionWindowChoicesSource).toContain('export const resolveQidahenDiplomacyInteractionChoice = (');
        expect(actionWindowChoicesSource).not.toContain('export const resolveQidahenDiplomacyInteractionChoiceWithDependencies = (');
        expect(actionWindowChoicesSource).toContain('export const resolveQidahenRecruitInteractionChoice = (');
        expect(actionWindowChoicesSource).not.toContain('export const resolveQidahenRecruitInteractionChoiceWithDependencies = (');
        expect(actionWindowChoicesSource).toContain('export const resolveQidahenDriveTigerConsentInteractionChoice = (');
        expect(actionWindowChoicesSource).not.toContain('export const resolveQidahenDriveTigerConsentInteractionChoiceWithDependencies = (');
        expect(actionWindowChoicesSource).toContain('export const resolveQidahenMaShiTradeInteractionChoice = (');
        expect(actionWindowChoicesSource).not.toContain('export const resolveQidahenMaShiTradeInteractionChoiceWithDependencies = (');
        expect(actionWindowChoicesSource).toContain('export const resolveQidahenKhanEdictInteractionChoice = (');
        expect(actionWindowChoicesSource).not.toContain('export const resolveQidahenKhanEdictInteractionChoiceWithDependencies = (');
        expect(actionWindowChoicesSource).toContain('id: `log-diplomacy-${timestamp}`');
        expect(actionWindowChoicesSource).toContain('id: `log-recruit-${timestamp}`');
        expect(actionWindowChoicesSource).toContain('id: `log-drive-tiger-consent-${timestamp}`');
        expect(actionWindowChoicesSource).toContain('id: `log-ma-shi-trade-${timestamp}`');
        expect(actionWindowChoicesSource).toContain('id: `log-khan-edict-${timestamp}`');
        expect(actionWindowChoicesSource).toContain('dependencies: QidahenActionWindowChoiceDependencies = {');
        expect(actionWindowChoicesSource).not.toContain('): QidahenCore => resolveDiplomacyInteractionChoice(');
        expect(actionWindowChoicesSource).not.toContain('): QidahenCore => resolveRecruitInteractionChoice(');
        expect(actionWindowChoicesSource).not.toContain('): QidahenCore => resolveDriveTigerConsentInteractionChoice(');
        expect(actionWindowChoicesSource).not.toContain('): QidahenCore => resolveMaShiTradeInteractionChoice(');
        expect(actionWindowChoicesSource).not.toContain('): QidahenCore => resolveKhanEdictInteractionChoice(');
        expect(turnActionChoiceOrchestrationSource).toBe('');
    });

    it('action-window resolved-event 入口应由独立 owner 承接，registry 只保留 route', () => {
        const indexSource = readDomainIndexSource();
        const bridgeSource = readActionWindowResolvedEventBridgeSource();
        const dependenciesSource = readActionWindowResolvedEventDependenciesSource();
        const eventsSource = readActionWindowResolvedEventsSource();
        const reducersSource = readResolvedEventReducersSource();
        const registryMapSource = readResolvedEventReducerRegistryMapSource();
        const registrySource = readResolvedEventReducerRegistrySource();

        expect(indexSource).toContain("} from './resolvedEventReducers';");
        expect(indexSource).toContain('const reducedCore = reduceQidahenResolvedEvent(state, event)');
        expect(indexSource).not.toContain("} from './actionWindowResolvedEventOrchestration';");
        expect(indexSource).not.toContain('resolveQidahenActionWindowResolvedEventForTurnFlow');
        expect(indexSource).not.toContain("} from './actionWindowResolvedEventBridge';");
        expect(indexSource).not.toContain('resolveQidahenActionWindowResolvedEvent,');
        expect(indexSource).not.toContain('type QidahenActionWindowResolvedEventDependencies,');
        expect(indexSource).not.toContain('const QIDAHEN_ACTION_WINDOW_RESOLVED_EVENT_DEPENDENCIES: QidahenActionWindowResolvedEventDependencies = {');
        expect(indexSource).not.toContain('resolveGaoDiDispatchChoice: (');
        expect(indexSource).not.toContain('resolveInternalDispatchInteractionChoice: (');
        expect(indexSource).not.toContain('resolveFortificationMaintenanceInteractionChoice: (');
        expect(indexSource).not.toContain('resolveDriveTigerConsentInteractionChoice: (');
        expect(indexSource).not.toContain('resolveRecruitInteractionChoice: (');
        expect(indexSource).not.toContain('resolveMaShiTradeInteractionChoice: (');
        expect(indexSource).not.toContain('resolveKhanEdictInteractionChoice: (');
        expect(indexSource).not.toContain('resolveDiplomacyInteractionChoice: (');
        expect(indexSource).not.toContain("case 'GAO_DI_DISPATCH_RESOLVED': {");
        expect(indexSource).not.toContain("case 'INTERNAL_DISPATCH_RESOLVED': {");
        expect(indexSource).not.toContain("case 'FORTIFICATION_MAINTENANCE_RESOLVED': {");
        expect(indexSource).not.toContain("case 'DRIVE_TIGER_CONSENT_RESOLVED': {");
        expect(indexSource).not.toContain("case 'RECRUIT_CHOICE_RESOLVED': {");
        expect(indexSource).not.toContain("case 'MA_SHI_TRADE_CHOICE_RESOLVED': {");
        expect(indexSource).not.toContain("case 'KHAN_EDICT_CHOICE_RESOLVED': {");
        expect(indexSource).not.toContain("case 'DIPLOMACY_CHOICE_RESOLVED': {");

        expect(registrySource).toBe('');

        expect(registryMapSource).toBe('');

        expect(reducersSource).toContain("} from './actionWindowDispatch';");
        expect(reducersSource).toContain("} from './actionWindowChoices';");
        expect(reducersSource).toContain("} from './factionTurnAccessors';");
        expect(reducersSource).toContain("} from './fortificationMaintenance';");
        expect(reducersSource).not.toContain('export const QIDAHEN_RESOLVED_EVENT_REDUCERS = [');
        expect(reducersSource).toContain('const QIDAHEN_RESOLVED_EVENT_REDUCERS = [');
        expect(reducersSource).toContain('const QIDAHEN_RESOLVED_EVENT_REDUCERS_BY_EVENT_TYPE = new Map<');
        expect(reducersSource).toContain('QIDAHEN_RESOLVED_EVENT_REDUCERS_BY_EVENT_TYPE.set(eventType, reducer);');
        expect(reducersSource).toContain('export const reduceQidahenResolvedEvent = (');
        expect(reducersSource).toContain('const reducer = QIDAHEN_RESOLVED_EVENT_REDUCERS_BY_EVENT_TYPE.get(event.type);');
        expect(reducersSource).toContain("'GAO_DI_DISPATCH_RESOLVED'");
        expect(reducersSource).toContain("'INTERNAL_DISPATCH_RESOLVED'");
        expect(reducersSource).toContain("'FORTIFICATION_MAINTENANCE_RESOLVED'");
        expect(reducersSource).toContain("'DRIVE_TIGER_CONSENT_RESOLVED'");
        expect(reducersSource).toContain("'RECRUIT_CHOICE_RESOLVED'");
        expect(reducersSource).toContain("'MA_SHI_TRADE_CHOICE_RESOLVED'");
        expect(reducersSource).toContain("'KHAN_EDICT_CHOICE_RESOLVED'");
        expect(reducersSource).toContain("'DIPLOMACY_CHOICE_RESOLVED'");
        expect(reducersSource).toContain('resolveQidahenGaoDiDispatchChoice(');
        expect(reducersSource).toContain('getFactionIdByPlayerId(');
        expect(reducersSource).toContain('resolveQidahenInternalDispatchInteractionChoice(');
        expect(reducersSource).toContain('resolveQidahenFortificationMaintenanceInteractionChoice(');
        expect(reducersSource).toContain('resolveQidahenDriveTigerConsentInteractionChoice(');
        expect(reducersSource).toContain('resolveQidahenRecruitInteractionChoice(');
        expect(reducersSource).toContain('resolveQidahenMaShiTradeInteractionChoice(');
        expect(reducersSource).toContain('resolveQidahenKhanEdictInteractionChoice(');
        expect(reducersSource).toContain('resolveQidahenDiplomacyInteractionChoice(');

        expect(dependenciesSource).toBe('');

        expect(eventsSource).toBe('');

        expect(bridgeSource).toBe('');
    });

    it('scenario choice state 与 resolved-event bridge 应分层，index 不再本地维护剧本预设/待决项/确认收口 helper', () => {
        const indexSource = readDomainIndexSource();
        const initialCoreSetupSource = readInitialCoreSetupSource();
        const orchestrationSource = readScenarioChoiceOrchestrationSource();
        const resolvedEventDependenciesSource = readScenarioChoiceResolvedEventDependenciesSource();
        const reducersSource = readResolvedEventReducersSource();
        const stateDependenciesSource = readScenarioChoiceStateDependenciesSource();
        const registrySource = readResolvedEventReducerRegistrySource();
        const stateSource = readScenarioChoiceStateSource();

        expect(indexSource).toContain("} from './resolvedEventReducers';");
        expect(indexSource).not.toContain("} from './scenarioChoiceOrchestration';");
        expect(indexSource).not.toContain('resolveQidahenScenarioChoiceResolvedEventForTurnFlow,');
        expect(indexSource).not.toContain("case 'SCENARIO_CHARACTER_CHOICE_RESOLVED':");
        expect(indexSource).not.toContain("case 'SCENARIO_ARMAMENT_CHOICE_RESOLVED':");
        expect(indexSource).not.toContain('return resolveQidahenScenarioChoiceResolvedEventForTurnFlow(state, event);');
        expect(indexSource).not.toContain('const applyScenarioPresetToFactionState = (');
        expect(indexSource).not.toContain('const getScenarioCharacterChoiceGroupId = (');
        expect(indexSource).not.toContain('const getScenarioArmamentChoiceGroupId = (');
        expect(indexSource).not.toContain('const getResolvedScenarioCharacterChoiceIds = (');
        expect(indexSource).not.toContain('const getResolvedScenarioArmamentChoiceIds = (');
        expect(indexSource).not.toContain('const buildPendingScenarioCharacterChoices = (');
        expect(indexSource).not.toContain('const buildPendingScenarioArmamentChoices = (');
        expect(indexSource).not.toContain('const resolveScenarioCharacterChoice = (');
        expect(indexSource).not.toContain('const resolveScenarioArmamentChoice = (');
        expect(indexSource).not.toContain('id: `log-scenario-character-${event.timestamp}`,');
        expect(indexSource).not.toContain('id: `log-scenario-armament-${event.timestamp}`,');
        expect(indexSource).not.toContain("} from './scenarioChoiceResolvedEventBridge';");
        expect(indexSource).not.toContain("} from './scenarioChoiceState';");
        expect(indexSource).not.toContain('resolveQidahenScenarioArmamentChoice,');
        expect(indexSource).not.toContain('resolveQidahenScenarioCharacterChoice,');
        expect(indexSource).not.toContain('type QidahenScenarioChoiceStateDependencies,');
        expect(indexSource).not.toContain('resolveQidahenScenarioChoiceResolvedEvent,');
        expect(indexSource).not.toContain('type QidahenScenarioChoiceResolvedEventDependencies,');
        expect(indexSource).not.toContain('const QIDAHEN_SCENARIO_CHOICE_STATE_DEPENDENCIES: QidahenScenarioChoiceStateDependencies = {');
        expect(indexSource).not.toContain('const QIDAHEN_SCENARIO_CHOICE_RESOLVED_EVENT_DEPENDENCIES: QidahenScenarioChoiceResolvedEventDependencies = {');
        expect(indexSource).not.toContain('resolveScenarioCharacterChoice: (');
        expect(indexSource).not.toContain('resolveScenarioArmamentChoice: (');
        expect(registrySource).toBe('');
        expect(initialCoreSetupSource).not.toContain("} from './scenarioChoiceSetupOrchestration';");
        expect(initialCoreSetupSource).not.toContain("} from './scenarioChoiceOrchestration';");
        expect(initialCoreSetupSource).toContain("} from './scenarioChoiceState';");
        expect(initialCoreSetupSource).not.toContain("} from './scenarioChoiceStateDependencies';");
        expect(initialCoreSetupSource).toContain('applyQidahenScenarioPresetToFactionState,');
        expect(initialCoreSetupSource).toContain('buildPendingQidahenScenarioArmamentChoices,');
        expect(initialCoreSetupSource).toContain('buildPendingQidahenScenarioCharacterChoices,');
        expect(initialCoreSetupSource).not.toContain('QIDAHEN_SCENARIO_CHOICE_STATE_DEPENDENCIES,');
        expect(initialCoreSetupSource).not.toContain('applyQidahenScenarioPresetToFactionStateForSetup,');
        expect(initialCoreSetupSource).not.toContain('buildPendingQidahenScenarioArmamentChoicesForSetup,');
        expect(initialCoreSetupSource).not.toContain('buildPendingQidahenScenarioCharacterChoicesForSetup,');

        expect(orchestrationSource).toBe('');

        expect(resolvedEventDependenciesSource).toBe('');

        expect(reducersSource).toContain("} from './scenarioChoiceState';");
        expect(reducersSource).toContain("'SCENARIO_CHARACTER_CHOICE_RESOLVED'");
        expect(reducersSource).toContain("'SCENARIO_ARMAMENT_CHOICE_RESOLVED'");
        expect(reducersSource).toContain('resolveQidahenScenarioChoiceResolvedEvent,');

        expect(stateDependenciesSource).toBe('');

        expect(stateSource).toContain("} from './armamentCatalogState';");
        expect(stateSource).toContain("} from './characterCatalogState';");
        expect(stateSource).toContain("} from './factionTurnAccessors';");
        expect(stateSource).toContain("import { updateQidahenTurnLabel } from './turnLabelState';");
        expect(stateSource).not.toContain('export interface QidahenScenarioChoiceStateDependencies {');
        expect(stateSource).toContain('interface QidahenScenarioChoiceStateDependencies {');
        expect(stateSource).not.toContain('export interface QidahenScenarioCharacterChoiceResolution {');
        expect(stateSource).toContain('interface QidahenScenarioCharacterChoiceResolution {');
        expect(stateSource).not.toContain('export interface QidahenScenarioArmamentChoiceResolution {');
        expect(stateSource).toContain('interface QidahenScenarioArmamentChoiceResolution {');
        expect(stateSource).not.toContain('const QIDAHEN_SCENARIO_CHOICE_STATE_DEPENDENCIES: QidahenScenarioChoiceStateDependencies = {');
        expect(stateSource).not.toContain('export const QIDAHEN_SCENARIO_CHOICE_STATE_DEPENDENCIES: QidahenScenarioChoiceStateDependencies = {');
        expect(stateSource).toContain('getCharacterNameById,');
        expect(stateSource).toContain('getArmamentNameById,');
        expect(stateSource).toContain('export const applyQidahenScenarioPresetToFactionState = (');
        expect(stateSource).toContain('const getQidahenScenarioCharacterChoiceGroupId = (');
        expect(stateSource).not.toContain('export const getQidahenScenarioCharacterChoiceGroupId = (');
        expect(stateSource).toContain('const getQidahenScenarioArmamentChoiceGroupId = (');
        expect(stateSource).not.toContain('export const getQidahenScenarioArmamentChoiceGroupId = (');
        expect(stateSource).toContain('const getResolvedQidahenScenarioCharacterChoiceIds = (');
        expect(stateSource).not.toContain('export const getResolvedQidahenScenarioCharacterChoiceIds = (');
        expect(stateSource).toContain('const getResolvedQidahenScenarioArmamentChoiceIds = (');
        expect(stateSource).not.toContain('export const getResolvedQidahenScenarioArmamentChoiceIds = (');
        expect(stateSource).toContain('export const buildPendingQidahenScenarioCharacterChoices = (');
        expect(stateSource).toContain('export const buildPendingQidahenScenarioArmamentChoices = (');
        expect(stateSource).not.toContain('export const resolveQidahenScenarioCharacterChoice = (');
        expect(stateSource).toContain('const resolveQidahenScenarioCharacterChoice = (');
        expect(stateSource).not.toContain('export const resolveQidahenScenarioArmamentChoice = (');
        expect(stateSource).toContain('const resolveQidahenScenarioArmamentChoice = (');
        expect(stateSource).toContain("type QidahenScenarioCharacterChoiceResolvedEvent = Extract<");
        expect(stateSource).toContain("type QidahenScenarioArmamentChoiceResolvedEvent = Extract<");
        expect(stateSource).toContain('type QidahenScenarioChoiceResolvedEvent =');
        expect(stateSource).not.toContain('export interface QidahenScenarioChoiceResolvedEventDependencies {');
        expect(stateSource).toContain('interface QidahenScenarioChoiceResolvedEventDependencies {');
        expect(stateSource).toContain('export const resolveQidahenScenarioChoiceResolvedEvent = (');
        expect(stateSource).not.toContain('const QIDAHEN_SCENARIO_CHOICE_RESOLVED_EVENT_DEPENDENCIES: QidahenScenarioChoiceResolvedEventDependencies = {');
        expect(stateSource).toContain('dependencies: QidahenScenarioChoiceResolvedEventDependencies = {');
        expect(stateSource).toContain('const currentFactionId = dependencies.getFactionIdByPlayerId(');
        expect(stateSource).toContain("case 'SCENARIO_CHARACTER_CHOICE_RESOLVED': {");
        expect(stateSource).toContain("case 'SCENARIO_ARMAMENT_CHOICE_RESOLVED': {");
        expect(stateSource).toContain('const resolution = dependencies.resolveScenarioCharacterChoice(');
        expect(stateSource).toContain('const resolution = dependencies.resolveScenarioArmamentChoice(');
        expect(stateSource).toContain('dependencies: QidahenScenarioChoiceStateDependencies = {');
        expect(stateSource).not.toContain('                QIDAHEN_SCENARIO_CHOICE_STATE_DEPENDENCIES,');
        expect(stateSource).toContain('resolveScenarioCharacterChoice: resolveQidahenScenarioCharacterChoice,');
        expect(stateSource).toContain('resolveScenarioArmamentChoice: resolveQidahenScenarioArmamentChoice,');
        expect(stateSource).not.toContain('applyQidahenScenarioPresetToFactionState(\r\n    faction: QidahenFactionState,\r\n    scenarioId: QidahenScenarioId,\r\n    preset: QidahenScenarioPreset[\'factions\'][QidahenFactionId],\r\n    resolveChoiceGroups: boolean,\r\n    dependencies: QidahenScenarioChoiceStateDependencies = QIDAHEN_SCENARIO_CHOICE_STATE_DEPENDENCIES,');
        expect(stateSource).toContain('return dependencies.updateTurnLabel({');
        expect(stateSource).toContain('pendingScenarioCharacterChoices: resolution.pendingScenarioCharacterChoices,');
        expect(stateSource).toContain('pendingScenarioArmamentChoices: resolution.pendingScenarioArmamentChoices,');
        expect(stateSource).toContain('id: `log-scenario-character-${event.timestamp}`,');
        expect(stateSource).toContain('id: `log-scenario-armament-${event.timestamp}`,');
    });

    it('纯输入选择事件应经由 directInputEventReducerBridge 委托到 selectionInputState owner，index 只保留单入口 reduce', () => {
        const directInputEventReducerBridgeSource = readDirectInputEventReducerBridgeSource();
        const directInputEventReducerRegistrySource = readDirectInputEventReducerRegistrySource();
        const directInputEventReducersSource = readDirectInputEventReducersSource();
        const indexSource = readDomainIndexSource();
        const characterActionWindowSource = readCharacterActionWindowSource();
        const selectionInputStateSource = readSelectionInputStateSource();

        expect(indexSource).not.toContain("import { reduceQidahenDirectInputEvent } from './directInputEventReducerBridge';");
        expect(indexSource).toContain("import { reduceQidahenDirectInputEvent } from './directInputEventReducers';");
        expect(indexSource).toContain('?? reduceQidahenDirectInputEvent(state, event)');
        expect(indexSource).not.toContain("} from './selectionInputState';");
        expect(indexSource).not.toContain('reduceQidahenSelectionInputEvent,');
        expect(indexSource).not.toContain('type QidahenSelectionInputStateDependencies,');
        expect(indexSource).not.toContain('const QIDAHEN_SELECTION_INPUT_STATE_DEPENDENCIES: QidahenSelectionInputStateDependencies = {');
        expect(indexSource).not.toContain('QIDAHEN_SELECTION_INPUT_STATE_DEPENDENCIES,');
        expect(indexSource).not.toContain("event.type === 'WHEEL_MOVE_SELECTED'");
        expect(indexSource).not.toContain("event.type === 'PAYMENT_CARD_SELECTED'");
        expect(indexSource).not.toContain("event.type === 'HAND_LIMIT_DISCARD_CARD_SELECTED'");
        expect(indexSource).not.toContain("event.type === 'SUN_YUANHUA_TECH_CARD_SELECTED'");
        expect(indexSource).not.toContain("event.type === 'GAO_DI_DISPATCH_CARD_SELECTED'");
        expect(indexSource).not.toContain("event.type === 'HAND_LIMIT_DISCARD_RESOLVED'");
        expect(indexSource).not.toContain('return isQidahenSelectionInputEvent(event)');
        expect(indexSource).not.toContain('reduceQidahenSelectionInputEvent(');
        expect(indexSource).not.toContain('const toggleHandLimitDiscardCard = (');
        expect(indexSource).not.toContain('const toggleGaoDiDispatchCard = (');
        expect(indexSource).not.toContain('const buildSunYuanhuaTechSelection = (');
        expect(indexSource).not.toContain('const toggleSunYuanhuaTechCard = (');
        expect(indexSource).not.toContain('const togglePaymentCard = (');
        expect(indexSource).not.toContain('const resolveHandLimitDiscard = (');

        expect(directInputEventReducerBridgeSource).toBe('');
        expect(directInputEventReducerRegistrySource).toBe('');
        expect(directInputEventReducersSource).toContain("} from './selectionInputState';");
        expect(directInputEventReducersSource).toContain('reduceQidahenSelectionInputEvent,');
        expect(directInputEventReducersSource).not.toContain('export interface QidahenDirectInputEventReducerSpec');
        expect(directInputEventReducersSource).toContain('interface QidahenDirectInputEventReducerSpec');
        expect(directInputEventReducersSource).not.toContain('export const QIDAHEN_DIRECT_INPUT_EVENT_REDUCERS = [');
        expect(directInputEventReducersSource).toContain('const QIDAHEN_DIRECT_INPUT_EVENT_REDUCERS = [');
        expect(directInputEventReducersSource).toContain('const QIDAHEN_DIRECT_INPUT_EVENT_REDUCERS_BY_EVENT_TYPE = new Map<');
        expect(directInputEventReducersSource).toContain('QIDAHEN_DIRECT_INPUT_EVENT_REDUCERS_BY_EVENT_TYPE.set(eventType, reducer);');
        expect(directInputEventReducersSource).toContain('export const reduceQidahenDirectInputEvent = (');
        expect(directInputEventReducersSource).toContain("'HAND_LIMIT_DISCARD_RESOLVED'");

        expect(characterActionWindowSource).toContain('buildSunYuanhuaTechSelection: (');
        expect(characterActionWindowSource).toContain("import { buildQidahenSunYuanhuaTechSelection } from './selectionInputState';");
        expect(characterActionWindowSource).toContain('buildSunYuanhuaTechSelection: buildQidahenSunYuanhuaTechSelection,');

        expect(selectionInputStateSource).not.toContain('export type QidahenSelectionInputStateDependencies = QidahenHandLimitDiscardDependencies;');
        expect(selectionInputStateSource).toContain('interface QidahenSelectionInputStateDependencies {');
        expect(selectionInputStateSource).toContain("import { isSunYuanhuaEnabled } from './characterAbilitySemantics';");
        expect(selectionInputStateSource).toContain("import { updateQidahenTurnLabel } from './turnLabelState';");
        expect(selectionInputStateSource).toContain('export type QidahenSelectionInputEvent =');
        expect(selectionInputStateSource).not.toContain('export const QIDAHEN_SELECTION_INPUT_STATE_DEPENDENCIES: QidahenSelectionInputStateDependencies = {');
        expect(selectionInputStateSource).not.toContain('const QIDAHEN_SELECTION_INPUT_STATE_DEPENDENCIES: QidahenSelectionInputStateDependencies = {');
        expect(selectionInputStateSource).toContain('export const buildQidahenSunYuanhuaTechSelection = (');
        expect(selectionInputStateSource).toContain('export const reduceQidahenSelectionInputEvent = (');
        expect(selectionInputStateSource).toContain('dependencies: QidahenSelectionInputStateDependencies = {');
        expect(selectionInputStateSource).toContain("case 'WHEEL_MOVE_SELECTED': {");
        expect(selectionInputStateSource).toContain("case 'PAYMENT_CARD_SELECTED': {");
        expect(selectionInputStateSource).toContain("case 'HAND_LIMIT_DISCARD_CARD_SELECTED':");
        expect(selectionInputStateSource).toContain("case 'SUN_YUANHUA_TECH_CARD_SELECTED':");
        expect(selectionInputStateSource).toContain("case 'GAO_DI_DISPATCH_CARD_SELECTED':");
        expect(selectionInputStateSource).toContain("case 'HAND_LIMIT_DISCARD_RESOLVED':");
        expect(selectionInputStateSource).toContain('const toggleQidahenHandLimitDiscardCard = (');
        expect(selectionInputStateSource).toContain('const toggleQidahenGaoDiDispatchCard = (');
        expect(selectionInputStateSource).toContain('const toggleQidahenPaymentCard = (');
        expect(selectionInputStateSource).toContain('const toggleQidahenSunYuanhuaTechCard = (');
        expect(selectionInputStateSource).toContain("if (!isSunYuanhuaEnabled(state) || !hasUpgradableArmament(state, 'ming')) {");
        expect(selectionInputStateSource).toContain('resolveQidahenHandLimitDiscard(state, event.timestamp, dependencies);');
    });

    it('REGION_SELECTED reducer orchestration 应经由 directInputEventReducerBridge 委托，index 只保留单入口 reduce', () => {
        const directInputEventReducerBridgeSource = readDirectInputEventReducerBridgeSource();
        const directInputEventReducersSource = readDirectInputEventReducersSource();
        const indexSource = readDomainIndexSource();
        const regionSelectionReducerSource = readRegionSelectionReducerSource();

        expect(indexSource).not.toContain("import { reduceQidahenDirectInputEvent } from './directInputEventReducerBridge';");
        expect(indexSource).toContain("import { reduceQidahenDirectInputEvent } from './directInputEventReducers';");
        expect(indexSource).toContain('?? reduceQidahenDirectInputEvent(state, event)');
        expect(indexSource).not.toContain("} from './regionSelectionReducer';");
        expect(indexSource).not.toContain('const QIDAHEN_REGION_SELECTED_DEPENDENCIES: QidahenRegionSelectedDependencies = {');
        expect(indexSource).not.toContain('return reduceQidahenRegionSelected(');
        expect(indexSource).not.toContain("case 'REGION_SELECTED': {\r\n                const actionWindowEffect = state.turnPhase === 'action-window'");
        expect(indexSource).not.toContain("case 'REGION_SELECTED': {\n                const actionWindowEffect = state.turnPhase === 'action-window'");
        expect(indexSource).not.toContain('const chosenTargetRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegionId);');
        expect(indexSource).not.toContain('const rebuiltInternalDispatchSelection = buildWangHuazhenInternalDispatchSelection(nextState, selectedRegionId);');
        expect(indexSource).not.toContain("case 'REGION_SELECTED':");
        expect(directInputEventReducerBridgeSource).toBe('');
        expect(directInputEventReducersSource).toContain("['REGION_SELECTED']");
        expect(directInputEventReducersSource).toContain('reduceQidahenRegionSelected(');
        expect(directInputEventReducersSource).toContain('event.payload.qidahenDiplomacySelection ?? null,');
        expect(directInputEventReducersSource).toContain('event.payload.qidahenWheelDispatchSelection ?? null,');
        expect(regionSelectionReducerSource).not.toContain('export interface QidahenRegionSelectedDependencies {');
        const selectionBuildersSource = readSelectionBuildersSource();

        expect(regionSelectionReducerSource).toContain('interface QidahenRegionSelectedDependencies {');
        expect(regionSelectionReducerSource).toContain('resolveQidahenWheelDispatchInteractionChoice,');
        expect(regionSelectionReducerSource).toContain("} from './actionWindowDispatch';");
        expect(regionSelectionReducerSource).toContain("import { applyQidahenCharacterActionWindowEffectsWithFocus } from './characterActionWindow';");
        expect(regionSelectionReducerSource).toContain("import { updateQidahenTurnLabel } from './turnLabelState';");
        expect(regionSelectionReducerSource).not.toContain('export const QIDAHEN_REGION_SELECTED_DEPENDENCIES: QidahenRegionSelectedDependencies = {');
        expect(regionSelectionReducerSource).not.toContain('const QIDAHEN_REGION_SELECTED_DEPENDENCIES: QidahenRegionSelectedDependencies = {');
        expect(regionSelectionReducerSource).toContain('export const reduceQidahenRegionSelected = (');
        expect(regionSelectionReducerSource).not.toContain('export const reduceQidahenRegionSelectedEvent = (');
        expect(regionSelectionReducerSource).toContain('dependencies: QidahenRegionSelectedDependencies = {');
        expect(regionSelectionReducerSource).toContain("state.turnPhase === 'action-window'");
        expect(regionSelectionReducerSource).toContain('const selectedRegionSemantics = getQidahenExplicitRegionSelectionSemantics(');
        expect(regionSelectionReducerSource).toContain('{ ...nextState, explicitRegionId },');
        expect(regionSelectionReducerSource).toContain('selectedRegionId,');
        expect(regionSelectionReducerSource).toContain('const internalDispatchSelection = internalDispatchSelectionCarry');
        expect(regionSelectionReducerSource).toContain('buildRecruitSelectionFromRegionSemantics(');
        expect(regionSelectionReducerSource).toContain('buildMaShiTradeSelectionFromRegionSemantics(');
        expect(regionSelectionReducerSource).toContain('buildKhanEdictSelectionFromRegionSemantics(');
        expect(regionSelectionReducerSource).toContain('const diplomacySelection = diplomacySelectionCarry ?? getQidahenCurrentDiplomacySelectionForCore(nextState);');
        expect(regionSelectionReducerSource).toContain('const carryRequiresDiplomacyProgressHost = !!diplomacySelectionCarry');
        expect(regionSelectionReducerSource).toContain('diplomacySelectionCarry.resolvedSteps.length > 0');
        expect(regionSelectionReducerSource).toContain('diplomacySelectionCarry.remainingTargetCount < diplomacySelectionCarry.maxTargetCount');
        expect(regionSelectionReducerSource).toContain('const rebuiltDiplomacyProgress = nextState.diplomacyProgress');
        expect(regionSelectionReducerSource).toContain('? buildQidahenDiplomacyProgress(diplomacySelectionCarry)');
        expect(regionSelectionReducerSource).toContain('diplomacyProgress: rebuiltDiplomacySelection ? rebuiltDiplomacyProgress : null,');
        expect(selectionBuildersSource).toContain('displayAnchorRegionId: selection.displayAnchorRegionId,');
        expect(regionSelectionReducerSource).toContain('const wheelDispatchSelection = wheelDispatchSelectionCarry ?? getQidahenCurrentWheelDispatchSelectionForCore(nextState);');
        expect(regionSelectionReducerSource).toContain('const chosenTargetRuntimeRegionId = resolveQidahenPrimaryRuntimeRegionId(selectedRegionId);');
        expect(regionSelectionReducerSource).toContain('return dependencies.resolveQidahenWheelDispatchInteractionChoice(');
        expect(regionSelectionReducerSource).toContain('buildWheelDispatchSelectionFromRegionSemantics(');
        expect(regionSelectionReducerSource).toContain('getQidahenWheelDispatchSelectionRegionSemantics(');
        expect(regionSelectionReducerSource).toContain('buildDriveTigerDispatchSelectionFromRegionSemantics(');
        expect(regionSelectionReducerSource).toContain('buildKhanEdictDispatchSelection(');
        expect(regionSelectionReducerSource).toContain('const shouldKeepRebuiltWheelDispatchSelectionOffHost = nextState.wheelDispatchProgress == null');
        expect(regionSelectionReducerSource).toContain("selectionSourceActionId === 'wheel-dispatch'");
        expect(regionSelectionReducerSource).toContain("|| selectionSourceActionId === 'drive-tiger'");
        expect(regionSelectionReducerSource).toContain('wheelDispatchProgress: shouldKeepRebuiltWheelDispatchSelectionOffHost ? null : rebuiltSelection,');
    });

    it('SELECTED_ACTION_EXECUTED 编排应由独立 owner 承接，index 不再内联动作执行主流程', () => {
        const armamentLowFidelitySource = readArmamentLowFidelitySource();
        const armamentUpgradeResolutionSource = readArmamentUpgradeResolutionSource();
        const indexSource = readDomainIndexSource();
        const grantPardonExecutionSource = readGrantPardonExecutionSource();
        const grantPardonExecutionDependenciesSource = readGrantPardonExecutionDependenciesSource();
        const registrySource = readResolvedEventReducerRegistrySource();
        const selectedActionExecutionSource = readSelectedActionExecutionSource();
        const selectedActionExecutionDependenciesSource = readSelectedActionExecutionDependenciesSource();
        const selectedActionExecutionResolutionSource = readSelectedActionExecutionResolutionSource();
        const selectedActionFollowUpSource = readSelectedActionFollowUpSource();
        const selectedActionOrchestrationSource = readSelectedActionOrchestrationSource();
        const armamentUpgradeResolutionDependenciesSource = readArmamentUpgradeResolutionDependenciesSource();
        const selectedActionPreparationSource = readSelectedActionPreparationSource();
        const selectedActionPreparationDependenciesSource = readSelectedActionPreparationDependenciesSource();
        const selectedActionStateCommitSource = readSelectedActionStateCommitSource();
        const selectedActionStateCommitDependenciesSource = readSelectedActionStateCommitDependenciesSource();
        const commandEventBuildersSource = readCommandEventBuildersSource();
        const commandEventBuilderRegistrySource = readCommandEventBuilderRegistrySource();
        const resolvedEventReducersSource = readResolvedEventReducersSource();
        const sunYuanhuaTechResolvedEventDependenciesSource = readSunYuanhuaTechResolvedEventDependenciesSource();
        const pendingTargetActionBuilderSource = readPendingTargetActionBuilderSource();

        expect(indexSource).toContain("import { validate } from './commands';");
        expect(indexSource).toContain("import { buildQidahenCommandEvents } from './commandEventBuilders';");
        expect(indexSource).not.toContain("import { QIDAHEN_COMMANDS, validate } from './commands';");
        expect(indexSource).toContain("} from './resolvedEventReducers';");
        expect(indexSource).not.toContain("} from './selectedActionOrchestration';");
        expect(indexSource).not.toContain('resolveQidahenSelectedActionExecutedEventForTurnFlow,');
        expect(indexSource).toContain('const commandEvents = buildQidahenCommandEvents(');
        expect(indexSource).toContain('return commandEvents ?? [];');
        expect(indexSource).not.toContain('return [buildQidahenSelectedActionExecutedEvent(_state.core, command, now())];');
        expect(indexSource).not.toContain('return resolveQidahenSelectedActionExecutedEventForTurnFlow(state, event);');
        expect(indexSource).not.toContain("} from './selectedActionExecution';");
        expect(indexSource).not.toContain("} from './selectedActionExecutedEventBridge';");
        expect(indexSource).not.toContain("} from './selectedActionPreparation';");
        expect(indexSource).not.toContain("} from './selectedActionStateCommit';");
        expect(indexSource).not.toContain("} from './grantPardonExecution';");
        expect(indexSource).not.toContain("} from './armamentLowFidelity';");
        expect(indexSource).not.toContain("} from './armamentUpgradeResolution';");
        expect(indexSource).not.toContain('prepareQidahenSelectedAction,');
        expect(indexSource).not.toContain('commitQidahenSelectedActionState,');
        expect(indexSource).not.toContain('resolveSelectedArmamentIdFromCards,');
        expect(indexSource).not.toContain('resolveQidahenSelectedArmamentUpgradeExecution,');
        expect(indexSource).not.toContain('resolveQidahenSunYuanhuaTech,');
        expect(indexSource).not.toContain('resolveQidahenGrantPardonExecution,');
        expect(indexSource).not.toContain('upgradeLowFidelityArmament,');
        expect(indexSource).not.toContain('type QidahenArmamentUpgradeResolutionDependencies,');
        expect(indexSource).not.toContain('type QidahenGrantPardonExecutionDependencies,');
        expect(indexSource).not.toContain('type QidahenSelectedActionExecutionDependencies,');
        expect(indexSource).not.toContain('type QidahenSelectedActionPreparationDependencies,');
        expect(indexSource).not.toContain('type QidahenSelectedActionStateCommitDependencies,');
        expect(indexSource).not.toContain('type QidahenSelectedActionExecuteCommand =');
        expect(indexSource).not.toContain("import { getActionChoiceById } from './factionActionWindow';");
        expect(indexSource).not.toContain("import { getCurrentFactionId } from './factionTurnAccessors';");
        expect(indexSource).not.toContain('const buildSelectedActionCommandEvents: QidahenCommandEventBuilder = (');
        expect(indexSource).not.toContain('const getAutoPaymentCardIds = (');
        expect(indexSource).not.toContain('export const buildQidahenSelectedActionExecutedEvent = (');
        expect(indexSource).not.toContain("type: 'SELECTED_ACTION_EXECUTED',");
        expect(indexSource).not.toContain("actionId: state.selectedActionId,");
        expect(indexSource).not.toContain('cardIds: state.selectedPaymentCardIds,');
        expect(indexSource).not.toContain('cardIds: getAutoPaymentCardIds(state, command.payload.actionId),');
        expect(indexSource).not.toContain('sourceCommandType: command.type,');
        expect(indexSource).not.toContain('return [buildQidahenSelectedActionExecutedEvent(');
        expect(indexSource).not.toContain('export function buildQidahenCommandEvents(');
        expect(commandEventBuildersSource).toContain("import { QIDAHEN_COMMANDS } from './commands';");
        expect(commandEventBuildersSource).toContain('getActionChoiceById,');
        expect(commandEventBuildersSource).toContain('getQidahenHandCardPaymentValue,');
        expect(commandEventBuildersSource).toContain("import { getCurrentFactionId } from './factionTurnAccessors';");
        expect(commandEventBuildersSource).not.toContain('export type QidahenCommandEventBuilder = (');
        expect(commandEventBuildersSource).not.toContain('export interface QidahenCommandEventBuilderSpec {');
        expect(commandEventBuildersSource).toContain('type QidahenSelectedActionExecuteCommand =');
        expect(commandEventBuildersSource).toContain('const getAutoPaymentCardIds = (');
        expect(commandEventBuildersSource).toContain('let paymentValue = 0;');
        expect(commandEventBuildersSource).toContain('paymentValue += getQidahenHandCardPaymentValue(card);');
        expect(commandEventBuildersSource).not.toContain('export const buildQidahenSelectedActionExecutedEvent = (');
        expect(commandEventBuildersSource).toContain("type: 'SELECTED_ACTION_EXECUTED',");
        expect(commandEventBuildersSource).toContain("actionId: state.confirmedActionId ?? state.selectedActionId,");
        expect(commandEventBuildersSource).toContain('cardIds: state.selectedPaymentCardIds,');
        expect(commandEventBuildersSource).toContain('cardIds: getAutoPaymentCardIds(state, command.payload.actionId),');
        expect(commandEventBuildersSource).toContain('sourceCommandType: command.type,');
        expect(commandEventBuildersSource).toContain('buildQidahenSelectedActionExecutedEvent(');
        expect(commandEventBuildersSource).toContain('commandTypes: [');
        expect(commandEventBuildersSource).toContain('QIDAHEN_COMMANDS.RESOLVE_HAND_LIMIT_DISCARD,');
        expect(commandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.SELECT_REGION],');
        expect(commandEventBuildersSource).toContain('QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,');
        expect(commandEventBuildersSource).toContain('buildEvents: buildQidahenResolvedCommandEvents,');
        expect(commandEventBuildersSource).not.toContain('const buildDirectInputCommandEvents: QidahenCommandEventBuilder = (');
        expect(commandEventBuildersSource).not.toContain('const buildSelectedActionCommandEvents: QidahenCommandEventBuilder = (');
        expect(commandEventBuildersSource).toContain('const buildSingleCommandEvents = <TCommand>(');
        expect(commandEventBuildersSource).not.toContain('const buildCoreStatefulCommandEvents = <TCommand>(');
        expect(commandEventBuildersSource).toContain('buildEvents: (');
        expect(commandEventBuildersSource).toContain('buildQidahenRegionSelectedEvent(state, command as SelectRegionCommand, timestamp)');
        expect(commandEventBuildersSource).toContain('buildEvents: buildSingleCommandEvents<ConfirmPreviewActionCommand>(');
        expect(commandEventBuildersSource).toContain('buildQidahenPreviewActionConfirmedEvent,');
        expect(commandEventBuildersSource).toContain('buildEvents: buildSingleCommandEvents<SelectWheelMoveCommand>(');
        expect(commandEventBuildersSource).toContain('buildQidahenWheelMoveSelectedEvent,');
        expect(commandEventBuildersSource).toContain('buildEvents: buildSingleCommandEvents<ExecuteWheelMoveCommand>(');
        expect(commandEventBuildersSource).toContain('buildQidahenWheelMoveExecutedEvent,');
        expect(commandEventBuildersSource).toContain('buildEvents: buildSingleCommandEvents<SelectPaymentCardCommand>(');
        expect(commandEventBuildersSource).toContain('buildQidahenPaymentCardSelectedEvent,');
        expect(commandEventBuildersSource).toContain('buildEvents: buildSingleCommandEvents<SelectHandLimitDiscardCardCommand>(');
        expect(commandEventBuildersSource).toContain('buildQidahenHandLimitDiscardCardSelectedEvent,');
        expect(commandEventBuildersSource).toContain('buildEvents: buildSingleCommandEvents<SelectSunYuanhuaTechCardCommand>(');
        expect(commandEventBuildersSource).toContain('buildQidahenSunYuanhuaTechCardSelectedEvent,');
        expect(commandEventBuildersSource).toContain('buildEvents: buildSingleCommandEvents<SelectGaoDiDispatchCardCommand>(');
        expect(commandEventBuildersSource).toContain('buildQidahenGaoDiDispatchCardSelectedEvent,');
        expect(commandEventBuildersSource).toContain('buildEvents: (state, command, _random, timestamp) => [');
        expect(commandEventBuildersSource).toContain('command as QidahenSelectedActionExecuteCommand,');
        expect(commandEventBuildersSource).toContain('buildQidahenSelectedActionExecutedEvent(');
        expect(commandEventBuildersSource).toContain('const QIDAHEN_COMMAND_EVENT_BUILDERS_BY_COMMAND_TYPE = new Map<');
        expect(commandEventBuildersSource).toContain('QIDAHEN_COMMAND_EVENT_BUILDERS.flatMap(({ commandTypes, buildEvents }) => (');
        expect(commandEventBuildersSource).toContain('commandTypes.map((commandType) => [commandType, buildEvents] as const)');
        expect(commandEventBuildersSource).toContain('export function buildQidahenCommandEvents(');
        expect(commandEventBuildersSource).toContain('return QIDAHEN_COMMAND_EVENT_BUILDERS_BY_COMMAND_TYPE.get(command.type)?.(');
        expect(commandEventBuildersSource).toContain(') ?? null;');
        expect(commandEventBuildersSource).not.toContain("} from './commandEventBuilderContracts';");
        expect(commandEventBuildersSource).toContain('type QidahenCommandEventBuilder = (');
        expect(commandEventBuildersSource).toContain('interface QidahenCommandEventBuilderSpec {');
        expect(commandEventBuildersSource).toContain('commandTypes: readonly QidahenCommand[\'type\'][];');
        expect(commandEventBuildersSource).toContain('buildEvents: QidahenCommandEventBuilder;');
        expect(commandEventBuilderRegistrySource).toBe('');
        expect(indexSource).not.toContain('const QIDAHEN_ARMAMENT_UPGRADE_RESOLUTION_DEPENDENCIES: QidahenArmamentUpgradeResolutionDependencies = {');
        expect(indexSource).not.toContain('const QIDAHEN_GRANT_PARDON_EXECUTION_DEPENDENCIES: QidahenGrantPardonExecutionDependencies = {');
        expect(indexSource).not.toContain('const QIDAHEN_SELECTED_ACTION_PREPARATION_DEPENDENCIES: QidahenSelectedActionPreparationDependencies = {');
        expect(indexSource).not.toContain('const QIDAHEN_SELECTED_ACTION_STATE_COMMIT_DEPENDENCIES: QidahenSelectedActionStateCommitDependencies = {');
        expect(indexSource).not.toContain('const QIDAHEN_SELECTED_ACTION_EXECUTION_DEPENDENCIES: QidahenSelectedActionExecutionDependencies = {');
        expect(indexSource).not.toContain('const QIDAHEN_ARMAMENT_LOW_FIDELITY_MAX_LEVEL = 2;');
        expect(indexSource).not.toContain('const isLowFidelityUpgradeableArmament = (');
        expect(indexSource).not.toContain('const buildUpgradedArmamentResult = (');
        expect(indexSource).not.toContain('const upgradeLowFidelityArmament = (');
        expect(indexSource).not.toContain('const hasUpgradableArmament = (');
        expect(indexSource).not.toContain('const resolveSelectedArmamentIdFromCards = (');
        expect(indexSource).not.toContain('const computeMarriageSubjugationPayCost = (');
        expect(indexSource).not.toContain('const getMarriageSubjugationBlockedReason = (');
        expect(indexSource).not.toContain('const buildPendingTargetAction = (');
        expect(indexSource).not.toContain('const currentFactionCardIds = new Set(');
        expect(indexSource).not.toContain("const grantPardonSourceRegion = event.payload.actionId === 'grant-pardon'");
        expect(indexSource).not.toContain("const finalActionLogText = khanEdictSelection");
        expect(indexSource).not.toContain('const resolveSunYuanhuaTech = (');
        expect(registrySource).not.toContain("} from './selectedActionExecutionDependencies';");
        expect(registrySource).not.toContain("} from './sunYuanhuaTechResolvedEventDependencies';");
        expect(registrySource).not.toContain("} from './armamentUpgradeResolution';");
        expect(registrySource).not.toContain("} from './armamentUpgradeResolutionDependencies';");
        expect(registrySource).not.toContain("import { buildSeasonSummary } from './seasonSummaryBuilder';");
        expect(registrySource).not.toContain("} from './factionActionWindow';");
        expect(registrySource).not.toContain("} from './actionWindowResolvedEventDependencies';");
        expect(registrySource).not.toContain("} from './turnFlowOrchestration';");
        expect(registrySource).not.toContain("case 'SELECTED_ACTION_EXECUTED':");
        expect(registrySource).toBe('');

        expect(selectedActionOrchestrationSource).toBe('');

        expect(selectedActionPreparationDependenciesSource).toBe('');
        expect(selectedActionPreparationSource).toContain("} from './armamentLowFidelity';");
        expect(selectedActionPreparationSource).toContain("import { buildSeasonSummary } from './seasonSummaryBuilder';");
        expect(selectedActionPreparationSource).toContain("import { updateQidahenTurnLabel } from './turnLabelState';");
        expect(selectedActionPreparationSource).not.toContain('export const QIDAHEN_SELECTED_ACTION_PREPARATION_DEPENDENCIES: QidahenSelectedActionPreparationDependencies = {');
        expect(selectedActionPreparationSource).not.toContain('const QIDAHEN_SELECTED_ACTION_PREPARATION_DEPENDENCIES: QidahenSelectedActionPreparationDependencies = {');
        expect(selectedActionPreparationSource).toContain('updateTurnLabel: updateQidahenTurnLabel,');
        expect(selectedActionPreparationSource).toContain('resolveSelectedArmamentIdFromCards,');
        expect(selectedActionPreparationSource).toContain('buildSeasonSummary,');
        expect(selectedActionPreparationSource).not.toContain('export const prepareQidahenSelectedActionForExecution = (');
        expect(selectedActionPreparationSource).toContain('export function prepareQidahenSelectedAction(');
        expect(selectedActionPreparationSource).toContain('dependencies: QidahenSelectedActionPreparationDependencies = {');

        expect(selectedActionStateCommitDependenciesSource).toBe('');
        expect(selectedActionStateCommitSource).toContain("} from './turnAdvance';");
        expect(selectedActionStateCommitSource).toContain("} from './victoryResolution';");
        expect(selectedActionStateCommitSource).not.toContain('export const QIDAHEN_SELECTED_ACTION_STATE_COMMIT_DEPENDENCIES: QidahenSelectedActionStateCommitDependencies = {');
        expect(selectedActionStateCommitSource).not.toContain('const QIDAHEN_SELECTED_ACTION_STATE_COMMIT_DEPENDENCIES: QidahenSelectedActionStateCommitDependencies = {');
        expect(selectedActionStateCommitSource).toContain('applyVictoryStatus: applyQidahenVictoryStatus,');
        expect(selectedActionStateCommitSource).toContain('advanceTurnIfReady: advanceQidahenTurnIfReady,');
        expect(selectedActionStateCommitSource).not.toContain('export const commitQidahenSelectedActionStateForExecution = (');
        expect(selectedActionStateCommitSource).toContain('export function commitQidahenSelectedActionState(');
        expect(selectedActionStateCommitSource).toContain('dependencies: QidahenSelectedActionStateCommitDependencies = {');

        expect(selectedActionExecutionDependenciesSource).toBe('');
        expect(selectedActionExecutionSource).toContain("} from './armamentUpgradeResolution';");
        expect(selectedActionExecutionSource).toContain("} from './grantPardonExecution';");
        expect(selectedActionExecutionSource).toContain("import { buildSeasonSummary } from './seasonSummaryBuilder';");
        expect(selectedActionExecutionSource).toContain("} from './selectedActionPreparation';");
        expect(selectedActionExecutionSource).toContain("} from './selectedActionStateCommit';");
        expect(selectedActionExecutionSource).not.toContain('export const QIDAHEN_SELECTED_ACTION_EXECUTION_DEPENDENCIES: QidahenSelectedActionExecutionDependencies = {');
        expect(selectedActionExecutionSource).not.toContain('const QIDAHEN_SELECTED_ACTION_EXECUTION_DEPENDENCIES: QidahenSelectedActionExecutionDependencies = {');
        expect(selectedActionExecutionSource).toContain('prepareSelectedAction: prepareQidahenSelectedAction,');
        expect(selectedActionExecutionSource).toContain('buildSeasonSummary,');
        expect(selectedActionExecutionSource).toContain('resolveGrantPardonExecution: resolveQidahenGrantPardonExecution,');
        expect(selectedActionExecutionSource).toContain('resolveSelectedArmamentUpgradeExecution: resolveQidahenSelectedArmamentUpgradeExecution,');
        expect(selectedActionExecutionSource).toContain('commitSelectedActionState: commitQidahenSelectedActionState,');
        expect(selectedActionExecutionSource).toContain('export const executeQidahenSelectedAction = (');
        expect(selectedActionExecutionSource).toContain('dependencies: QidahenSelectedActionExecutionDependencies = {');
        expect(selectedActionExecutionSource).not.toContain('export const resolveQidahenSelectedActionExecutedEvent = (');
        expect(selectedActionExecutionSource).not.toContain('event.payload.playerId,');
        expect(selectedActionExecutionSource).not.toContain('event.payload.actionId,');
        expect(selectedActionExecutionSource).not.toContain('event.payload.cardIds,');
        expect(selectedActionExecutionSource).not.toContain("} from './armamentUpgradeResolutionDependencies';");
        expect(selectedActionExecutionSource).not.toContain("} from './grantPardonExecutionDependencies';");

        expect(registrySource).toBe('');

        expect(resolvedEventReducersSource).toContain("} from './selectedActionExecution';");
        expect(resolvedEventReducersSource).toContain("} from './armamentUpgradeResolution';");
        expect(resolvedEventReducersSource).toContain("'SELECTED_ACTION_EXECUTED'");
        expect(resolvedEventReducersSource).toContain("'SUN_YUANHUA_TECH_RESOLVED'");
        expect(resolvedEventReducersSource).toContain('executeQidahenSelectedAction,');
        expect(resolvedEventReducersSource).toContain('event.payload.playerId,');
        expect(resolvedEventReducersSource).toContain('event.payload.actionId,');
        expect(resolvedEventReducersSource).toContain('event.payload.cardIds,');
        expect(resolvedEventReducersSource).toContain('resolveQidahenSunYuanhuaTechResolvedEvent,');

        expect(sunYuanhuaTechResolvedEventDependenciesSource).toBe('');

        expect(armamentUpgradeResolutionDependenciesSource).toBe('');

        expect(selectedActionExecutionSource).not.toContain('export interface QidahenSelectedActionExecutionDependencies');
        expect(selectedActionExecutionSource).toContain('interface QidahenSelectedActionExecutionDependencies');
        expect(selectedActionExecutionSource).not.toContain('extends QidahenSelectedActionFollowUpDependencies, QidahenSelectedActionExecutionResolutionDependencies');
        expect(selectedActionExecutionSource).toContain('buildSeasonSummary: (');
        expect(selectedActionExecutionSource).toContain('resolveGrantPardonExecution: (');
        expect(selectedActionExecutionSource).toContain('resolveSelectedArmamentUpgradeExecution: (');
        expect(selectedActionExecutionSource).toContain('export const executeQidahenSelectedAction = (');
        expect(selectedActionExecutionSource).toContain("} from './selectedActionFollowUp';");
        expect(selectedActionExecutionSource).toContain("} from './selectedActionExecutionResolution';");
        expect(selectedActionExecutionSource).not.toContain("type QidahenSelectedActionPreparationResult,");
        expect(selectedActionExecutionSource).toContain("type QidahenPreparedSelectedActionResult =");
        expect(selectedActionExecutionSource).toContain("} from './selectedActionStateCommit';");
        expect(selectedActionExecutionSource).toContain('const preparation = dependencies.prepareSelectedAction(');
        expect(selectedActionExecutionSource).toContain("if (preparation.kind === 'blocked') {");
        expect(selectedActionExecutionSource).toContain('const executionResolution = resolveQidahenSelectedActionExecutionResolution(');
        expect(selectedActionExecutionSource).toContain('const followUp = resolveQidahenSelectedActionFollowUp(');
        expect(selectedActionExecutionSource).toContain('commitSelectedActionState: (');
        expect(selectedActionExecutionSource).toContain('return dependencies.commitSelectedActionState(state, {');
        expect(selectedActionExecutionSource).not.toContain('const followUpDependencies = dependencies as ');
        expect(selectedActionExecutionSource).not.toContain('const buildPendingTargetAction = (');
        expect(selectedActionExecutionSource).not.toContain('const upgradeLowFidelityArmament = (');
        expect(selectedActionExecutionSource).not.toContain('const removeTroopsFromNonSiegedCityStateRegion = (');
        expect(selectedActionExecutionSource).not.toContain('const currentFactionCardIds = new Set(');
        expect(selectedActionExecutionSource).not.toContain('const spentCardIds = cardIds.filter(');
        expect(selectedActionExecutionSource).not.toContain('const selectedCardIds = new Set(spentCardIds);');
        expect(selectedActionExecutionSource).not.toContain('const selectedArmamentId = dependencies.resolveSelectedArmamentIdFromCards');
        expect(selectedActionExecutionSource).not.toContain("const marriageSubjugationBlockedReason = actionId === 'marriage-subjugation'");
        expect(selectedActionExecutionSource).not.toContain("const grantPardonSourceRegion = actionId === 'grant-pardon'");
        expect(selectedActionExecutionSource).not.toContain("const recruitSelection = actionId === 'recruit'");
        expect(selectedActionExecutionSource).not.toContain("const driveTigerDispatchSelection = actionId === 'drive-tiger'");
        expect(selectedActionExecutionSource).not.toContain("const pendingTargetAction = (actionId === 'raid' || actionId === 'marriage-subjugation')");
        expect(selectedActionExecutionSource).not.toContain('const actionLogText = recruitSelection');
        expect(selectedActionExecutionSource).not.toContain("turnPhase: khanEdictSelection");
        expect(selectedActionExecutionSource).not.toContain('const upgradedArmamentLine = upgradeResult.upgradedArmament');
        expect(selectedActionExecutionSource).not.toContain("if (actionId === 'grant-pardon') {");
        expect(selectedActionExecutionSource).not.toContain("if (actionId === 'upgrade-armament') {");
        expect(selectedActionExecutionSource).not.toContain('const hasHuangtaijiBonus = currentFactionId === ');
        expect(selectedActionExecutionSource).not.toContain('const usedBonusFactionAction = state.factionActionUsed');
        expect(selectedActionExecutionSource).not.toContain('const executedState = dependencies.applyVictoryStatus({');
        expect(selectedActionExecutionSource).not.toContain('syncFactionActionWindow(executedState, currentFactionId)');

        expect(armamentLowFidelitySource).toContain('export const hasUpgradableArmament = (');
        expect(grantPardonExecutionSource).not.toContain('export interface QidahenGrantPardonExecutionDependencies {');
        expect(grantPardonExecutionSource).toContain('interface QidahenGrantPardonExecutionDependencies {');
        expect(grantPardonExecutionSource).not.toContain('export interface QidahenGrantPardonExecutionResult {');
        expect(grantPardonExecutionSource).toContain('interface QidahenGrantPardonExecutionResult {');
        expect(grantPardonExecutionSource).not.toContain('export const QIDAHEN_GRANT_PARDON_EXECUTION_DEPENDENCIES: QidahenGrantPardonExecutionDependencies = {');
        expect(grantPardonExecutionSource).toContain('export const resolveQidahenGrantPardonExecution = (');
        expect(grantPardonExecutionSource).not.toContain('export const resolveQidahenGrantPardonExecutionForSelectedAction = (');
        expect(grantPardonExecutionSource).not.toContain('const QIDAHEN_GRANT_PARDON_EXECUTION_DEPENDENCIES: QidahenGrantPardonExecutionDependencies = {');
        expect(grantPardonExecutionSource).toContain('dependencies: QidahenGrantPardonExecutionDependencies = {');
        expect(grantPardonExecutionSource).toContain("const grantPardonSourceRegion = runtimeRegions.find((region) => (");
        expect(grantPardonExecutionSource).toContain("const grantPardonDestinationRegion = grantPardonSourceRegion");
        expect(grantPardonExecutionSource).toContain("} from './actionSourceRegionState';");
        expect(grantPardonExecutionSource).toContain("} from './cityInteriorTroopTransfer';");
        expect(grantPardonExecutionSource).toContain("import { refreshRuntimeRegionRules } from './runtimeRegionRules';");
        expect(grantPardonExecutionSource).toContain("import { buildSeasonSummary } from './seasonSummaryBuilder';");
        expect(grantPardonExecutionSource).toContain('materializeNonSiegedCityActionSourceRegion,');
        expect(grantPardonExecutionSource).toContain('addTroopsToFriendlyBesiegedCityInterior,');
        expect(grantPardonExecutionSource).toContain('removeTroopsFromNonSiegedCityStateRegion,');
        expect(grantPardonExecutionSource).toContain('refreshRuntimeRegionRules,');
        expect(grantPardonExecutionDependenciesSource).toBe('');
        expect(grantPardonExecutionSource).toContain("lastSeasonSummary: dependencies.buildSeasonSummary('赐印招安', timestamp, [");
        expect(grantPardonExecutionSource).toContain('regions: nextRegions,');

        expect(armamentLowFidelitySource).toContain('const QIDAHEN_ARMAMENT_LOW_FIDELITY_MAX_LEVEL = 2;');
        expect(armamentLowFidelitySource).not.toContain('export const isLowFidelityUpgradeableArmament = (');
        expect(armamentLowFidelitySource).toContain('const isLowFidelityUpgradeableArmament = (');
        expect(armamentLowFidelitySource).not.toContain('const buildUpgradedArmamentResult = (');
        expect(armamentLowFidelitySource).toContain('export const upgradeLowFidelityArmament = (');
        expect(armamentLowFidelitySource).toContain('export const hasUpgradableArmament = (');
        expect(armamentLowFidelitySource).toContain('export const resolveSelectedArmamentIdFromCards = (');
        expect(armamentLowFidelitySource).toContain('const targetIndex = (() => {');
        expect(armamentLowFidelitySource).toContain('return preferredTargetIndex >= 0');
        expect(armamentLowFidelitySource).toContain('const upgradedArmament = {');
        expect(armamentLowFidelitySource).toContain('index === targetIndex ? upgradedArmament : { ...armament }');

        expect(armamentUpgradeResolutionSource).not.toContain('export interface QidahenArmamentUpgradeResolutionDependencies {');
        expect(armamentUpgradeResolutionSource).toContain('interface QidahenArmamentUpgradeResolutionDependencies {');
        expect(armamentUpgradeResolutionSource).not.toContain('export interface QidahenSelectedArmamentUpgradeExecutionResult {');
        expect(armamentUpgradeResolutionSource).toContain('interface QidahenSelectedArmamentUpgradeExecutionResult {');
        expect(armamentUpgradeResolutionSource).not.toContain('export interface QidahenSunYuanhuaTechResolutionResult extends Pick<QidahenCore');
        expect(armamentUpgradeResolutionSource).toContain('interface QidahenSunYuanhuaTechResolutionResult extends Pick<QidahenCore');
        expect(armamentUpgradeResolutionSource).not.toContain('export const QIDAHEN_ARMAMENT_UPGRADE_RESOLUTION_DEPENDENCIES: QidahenArmamentUpgradeResolutionDependencies = {');
        expect(armamentUpgradeResolutionSource).not.toContain('const QIDAHEN_ARMAMENT_UPGRADE_RESOLUTION_DEPENDENCIES: QidahenArmamentUpgradeResolutionDependencies = {');
        expect(armamentUpgradeResolutionSource).toContain("} from './armamentLowFidelity';");
        expect(armamentUpgradeResolutionSource).toContain("} from './factionActionWindow';");
        expect(armamentUpgradeResolutionSource).toContain("} from './factionTurnAccessors';");
        expect(armamentUpgradeResolutionSource).toContain("import { buildSeasonSummary } from './seasonSummaryBuilder';");
        expect(armamentUpgradeResolutionSource).toContain("} from './turnAdvance';");
        expect(armamentUpgradeResolutionSource).toContain("} from './victoryResolution';");
        expect(armamentUpgradeResolutionSource).toContain('buildSeasonSummary,');
        expect(armamentUpgradeResolutionSource).toContain('upgradeLowFidelityArmament,');
        expect(armamentUpgradeResolutionSource).toContain("type QidahenSunYuanhuaTechResolvedEvent = Extract<");
        expect(armamentUpgradeResolutionSource).toContain('export const resolveQidahenSelectedArmamentUpgradeExecution = (');
        expect(armamentUpgradeResolutionSource).not.toContain('export const resolveQidahenSelectedArmamentUpgradeExecutionForSelectedAction = (');
        expect(armamentUpgradeResolutionSource).toContain('dependencies: QidahenArmamentUpgradeResolutionDependencies = {');
        expect(armamentUpgradeResolutionSource).not.toContain('export const resolveQidahenSunYuanhuaTech = (');
        expect(armamentUpgradeResolutionSource).toContain('const resolveQidahenSunYuanhuaTech = (');
        expect(armamentUpgradeResolutionSource).not.toContain('export interface QidahenSunYuanhuaTechResolvedEventDependencies {');
        expect(armamentUpgradeResolutionSource).toContain('interface QidahenSunYuanhuaTechResolvedEventDependencies {');
        expect(armamentUpgradeResolutionSource).toContain('export const resolveQidahenSunYuanhuaTechResolvedEvent = (');
        expect(armamentUpgradeResolutionSource).not.toContain('const QIDAHEN_SUN_YUANHUA_TECH_RESOLVED_EVENT_DEPENDENCIES: QidahenSunYuanhuaTechResolvedEventDependencies = {');
        expect(armamentUpgradeResolutionSource).toContain('dependencies: QidahenSunYuanhuaTechResolvedEventDependencies = {');
        expect(armamentUpgradeResolutionSource).toContain('const currentFactionId = dependencies.getFactionIdByPlayerId(state, event.payload.playerId);');
        expect(armamentUpgradeResolutionSource).toContain('const resolution = dependencies.resolveSunYuanhuaTech(');
        expect(armamentUpgradeResolutionSource).not.toContain('        QIDAHEN_ARMAMENT_UPGRADE_RESOLUTION_DEPENDENCIES,');
        expect(armamentUpgradeResolutionSource).toContain('resolveSunYuanhuaTech: resolveQidahenSunYuanhuaTech,');
        expect(armamentUpgradeResolutionSource).toContain("lastSeasonSummary: dependencies.buildSeasonSummary(");
        expect(armamentUpgradeResolutionSource).toContain('id: `log-sun-yuanhua-tech-${event.timestamp}`,');
        expect(armamentUpgradeResolutionSource).toContain('const resolvedState = dependencies.applyVictoryStatus({');
        expect(armamentUpgradeResolutionSource).toContain('return dependencies.advanceTurnIfReady(');
        expect(armamentUpgradeResolutionSource).toContain('dependencies.syncFactionActionWindow(resolvedState, currentFactionId),');
        expect(armamentUpgradeResolutionSource).toContain('const sourceCardLine = selectedHandActionCardLabel');
        expect(armamentUpgradeResolutionSource).toContain('`打出军备牌：${selectedHandActionCardLabel}。`');
        expect(armamentUpgradeResolutionSource).toContain("lastSeasonSummary: dependencies.buildSeasonSummary(");
        expect(armamentUpgradeResolutionSource).toContain("'升级军备',");
        expect(armamentUpgradeResolutionSource).toContain("summaryLines: ['孙元化本次放弃弃牌打科技。'],");
        expect(armamentUpgradeResolutionSource).toContain('const removedCardIds = new Set(selection.selectedCardIds.slice(0, selection.requiredCardCount));');

        expect(selectedActionExecutionResolutionSource).not.toContain('export interface QidahenSelectedActionExecutionResolutionDependencies {');
        expect(selectedActionExecutionResolutionSource).toContain('interface QidahenSelectedActionExecutionResolutionDependencies {');
        expect(selectedActionExecutionResolutionSource).not.toContain('export interface QidahenSelectedActionExecutionResolutionResult {');
        expect(selectedActionExecutionResolutionSource).toContain('interface QidahenSelectedActionExecutionResolutionResult {');
        expect(selectedActionExecutionResolutionSource).toContain('export const resolveQidahenSelectedActionExecutionResolution = (');
        expect(selectedActionExecutionResolutionSource).toContain("if (actionId === 'upgrade-armament') {");
        expect(selectedActionExecutionResolutionSource).not.toContain("if (actionId === 'grant-pardon') {");
        expect(selectedActionExecutionResolutionSource).not.toContain('const grantPardonResolution = dependencies.resolveGrantPardonExecution(');
        expect(selectedActionExecutionResolutionSource).toContain('const upgradeResolution = dependencies.resolveSelectedArmamentUpgradeExecution(');

        expect(selectedActionFollowUpSource).not.toContain("} from './selectedActionPendingFollowUpResolution';");
        expect(selectedActionFollowUpSource).not.toContain("} from './selectedActionSelectionFollowUpResolution';");
        expect(selectedActionFollowUpSource).toContain("import { buildPendingTargetAction } from './pendingTargetActionBuilder';");
        expect(selectedActionFollowUpSource).toContain("} from './selectionBuilders';");
        expect(selectedActionFollowUpSource).toContain('buildGrantPardonSelectionFromRegionSemantics');
        expect(selectedActionFollowUpSource).toContain("resolution.grantPardonSelection");
        expect(selectedActionFollowUpSource).toContain("? 'grant-pardon-choice'");
        expect(selectedActionFollowUpSource).toContain("import { buildDriveTigerDispatchSelectionFromRegionSemantics } from './dispatchSelectionBuilders';");
        expect(selectedActionFollowUpSource).not.toContain("} from './selectedActionFollowUpLogText';");
        expect(selectedActionFollowUpSource).not.toContain("} from './selectedActionFollowUpStateTransition';");
        expect(selectedActionFollowUpSource).not.toContain('export interface QidahenSelectedActionFollowUpDependencies');
        expect(selectedActionFollowUpSource).toContain('interface QidahenSelectedActionFollowUpDependencies');
        expect(selectedActionFollowUpSource).not.toContain('export interface QidahenSelectedActionFollowUpResolutionResult {');
        expect(selectedActionFollowUpSource).toContain('interface QidahenSelectedActionFollowUpResolutionResult {');
        expect(selectedActionFollowUpSource).toContain('interface QidahenSelectedActionSelectionFollowUpResolutionResult {');
        expect(selectedActionFollowUpSource).toContain('interface QidahenSelectedActionPendingFollowUpResolutionResult {');
        expect(selectedActionFollowUpSource).not.toContain('export interface QidahenSelectedActionFollowUpResult {');
        expect(selectedActionFollowUpSource).toContain('interface QidahenSelectedActionFollowUpResult {');
        expect(selectedActionFollowUpSource).toContain('interface QidahenSelectedActionFollowUpStateTransition {');
        expect(selectedActionFollowUpSource).toContain('buildSeasonSummary: (');
        expect(selectedActionFollowUpSource).toContain('export const resolveQidahenSelectedActionFollowUp = (');
        expect(selectedActionFollowUpSource).toContain('const buildQidahenSelectedActionFollowUpLogText = (');
        expect(selectedActionFollowUpSource).toContain('const buildQidahenSelectedActionFollowUpStateTransition = (');
        expect(selectedActionFollowUpSource).toContain('const resolveQidahenSelectedActionSelectionFollowUpResolution = (');
        expect(selectedActionFollowUpSource).toContain('const resolveQidahenSelectedActionPendingFollowUpResolution = (');
        expect(selectedActionFollowUpSource).toContain('const selectionResolution = resolveQidahenSelectedActionSelectionFollowUpResolution(');
        expect(selectedActionFollowUpSource).toContain('const pendingResolution = resolveQidahenSelectedActionPendingFollowUpResolution(');
        expect(selectedActionFollowUpSource).toContain('const resolution: QidahenSelectedActionFollowUpResolutionResult = {');
        expect(selectedActionFollowUpSource).toContain("pendingTargetAction: pendingResolution.pendingTargetAction,");
        expect(selectedActionFollowUpSource).toContain('selectedRegionId: pendingResolution.selectedRegionId,');
        expect(selectedActionFollowUpSource).not.toContain('selectedRegionId: pendingResolution.pendingTargetAction?.targetRuntimeRegionId');
        expect(selectedActionFollowUpSource).toContain('const actionLogText = buildQidahenSelectedActionFollowUpLogText(');
        expect(selectedActionFollowUpSource).toContain('const stateTransition = buildQidahenSelectedActionFollowUpStateTransition(resolution);');
        expect(selectedActionFollowUpSource).toContain('if (resolution.recruitSelection) {');
        expect(selectedActionFollowUpSource).toContain('if (resolution.driveTigerDispatchSelection) {');
        expect(selectedActionFollowUpSource).toContain('if (resolution.pendingTargetAction) {');
        expect(selectedActionFollowUpSource).toContain("turnPhase: resolution.khanEdictSelection");
        expect(selectedActionFollowUpSource).toContain('wheelDispatchProgress: resolution.driveTigerDispatchSelection,');
        expect(selectedActionFollowUpSource).toContain('return {');
        expect(selectedActionFollowUpSource).not.toContain('const resolutionDependencies = dependencies as ');
        expect(selectedActionFollowUpSource).not.toContain('buildPendingTargetAction: (');
        expect(selectedActionFollowUpSource).not.toContain("} from './selectedActionFollowUpResolution';");
        expect(selectedActionFollowUpSource).toContain("const recruitSelection = actionId === 'recruit'");
        expect(selectedActionFollowUpSource).toContain("const driveTigerDispatchSelection = actionId === 'drive-tiger'");
        expect(selectedActionFollowUpSource).toContain('const baseRegionSemantics = getQidahenExplicitRegionSelectionSemantics(state, baseSelectedRegionId);');
        expect(selectedActionFollowUpSource).toContain('buildRecruitSelectionFromRegionSemantics(state, baseRegionSemantics, currentFactionId)');
        expect(selectedActionFollowUpSource).toContain('buildMaShiTradeSelectionFromRegionSemantics(state, baseRegionSemantics)');
        expect(selectedActionFollowUpSource).toContain('buildKhanEdictSelectionFromRegionSemantics(state, currentFactionId, baseRegionSemantics)');
        expect(selectedActionFollowUpSource).toContain('const selectedRegion = state.regions.find((region) => region.id === baseSelectedRegionId);');
        expect(selectedActionFollowUpSource).toContain("if (actionId === 'recruit' && !recruitSelection) {");
        expect(selectedActionFollowUpSource).toContain("if (actionId === 'ma-shi-trade' && !maShiTradeSelection) {");
        expect(selectedActionFollowUpSource).toContain("const CROSS_MOUNTAINS_CARD_DEF_ID = 'qidahen-atlas05-1614-cross-mountains';");
        expect(selectedActionFollowUpSource).toContain("const pendingActionId = actionId === 'play-event-card' && selectedEventActionCardDefId === CROSS_MOUNTAINS_CARD_DEF_ID");
        expect(selectedActionFollowUpSource).toContain("const pendingTargetAction = (pendingActionId === 'raid' || pendingActionId === 'marriage-subjugation')");
        expect(selectedActionFollowUpSource).toContain("pendingActionId,");
        expect(selectedActionFollowUpSource).toContain("applyCrossMountainsBoundaryEffect(pendingTargetAction)");

        expect(selectedActionPreparationSource).toContain("import { getActionChoiceById } from './factionActionWindow';");
        expect(selectedActionPreparationSource).toContain("import { getFactionIdByPlayerId } from './factionTurnAccessors';");
        expect(selectedActionPreparationSource).toContain("import { getMarriageSubjugationBlockedReason } from './pendingTargetActionBuilder';");
        expect(selectedActionPreparationSource).not.toContain('export interface QidahenSelectedActionPreparationDependencies {');
        expect(selectedActionPreparationSource).toContain('interface QidahenSelectedActionPreparationDependencies {');
        expect(selectedActionPreparationSource).not.toContain('export interface QidahenSelectedActionPreparedState {');
        expect(selectedActionPreparationSource).toContain('interface QidahenSelectedActionPreparedState {');
        expect(selectedActionPreparationSource).not.toContain('export type QidahenSelectedActionPreparationResult =');
        expect(selectedActionPreparationSource).toContain('type QidahenSelectedActionPreparationResult =');
        expect(selectedActionPreparationSource).toContain('export function prepareQidahenSelectedAction(');
        expect(selectedActionPreparationSource).toContain('dependencies: QidahenSelectedActionPreparationDependencies = {');
        expect(selectedActionPreparationSource).toContain('const currentFactionCardIds = new Set(');
        expect(selectedActionPreparationSource).toContain('const spentCardIds = cardIds.filter((cardId) => currentFactionCardIds.has(cardId));');
        expect(selectedActionPreparationSource).toContain('const selectedArmamentId = dependencies.resolveSelectedArmamentIdFromCards(state.handCards, spentCardIds);');
        expect(selectedActionPreparationSource).toContain("const marriageSubjugationBlockedReason = actionId === 'marriage-subjugation'");
        expect(selectedActionPreparationSource).toContain("lastSeasonSummary: dependencies.buildSeasonSummary('联姻诱降', timestamp, [");
        expect(selectedActionPreparationSource).not.toContain('getMarriageSubjugationBlockedReason: (');
        expect(selectedActionPreparationSource).not.toContain('const grantPardonResolution = dependencies.resolveGrantPardonExecution(');
        expect(selectedActionPreparationSource).not.toContain('const recruitSelection = actionId === ');

        expect(pendingTargetActionBuilderSource).toContain("import { getQidahenBoundaryTypeMeta } from '../ui/mapGraph';");
        expect(pendingTargetActionBuilderSource).toContain("} from './regionConfig';");
        expect(pendingTargetActionBuilderSource).toContain("} from './battleState';");
        expect(pendingTargetActionBuilderSource).toContain("} from './actionSourceRegionState';");
        expect(pendingTargetActionBuilderSource).toContain("} from './regionRuleSemantics';");
        expect(pendingTargetActionBuilderSource).toContain("} from './regionSelectionPreferences';");
        expect(pendingTargetActionBuilderSource).toContain("} from './movement';");
        expect(pendingTargetActionBuilderSource).toContain("} from './pendingBattleCommittedTroops';");
        expect(pendingTargetActionBuilderSource).toContain("} from './attackRules';");
        expect(pendingTargetActionBuilderSource).toContain('const computeMarriageSubjugationPayCost = (');
        expect(pendingTargetActionBuilderSource).toContain('export const getMarriageSubjugationBlockedReason = (');
        expect(pendingTargetActionBuilderSource).toContain('export const buildPendingTargetAction = (');
        expect(pendingTargetActionBuilderSource).toContain("if (actionId === 'marriage-subjugation' && getMarriageSubjugationBlockedReason(state, selectedRegion)) {");
        expect(pendingTargetActionBuilderSource).toContain("const targetKind = isFriendlySiegeTarget ? 'siege-attacker' as const : 'region' as const;");
        expect(pendingTargetActionBuilderSource).toContain("title: actionId === 'raid' ? '突袭待结算' : '联姻待结算',");

        expect(selectedActionStateCommitSource).toContain("} from './factionActionWindow';");
        expect(selectedActionStateCommitSource).not.toContain('export interface QidahenSelectedActionStateCommitDependencies {');
        expect(selectedActionStateCommitSource).toContain('interface QidahenSelectedActionStateCommitDependencies {');
        expect(selectedActionStateCommitSource).toContain('interface QidahenSelectedActionStateCommitFollowUp {');
        expect(selectedActionStateCommitSource).not.toContain('export interface QidahenSelectedActionStateCommitInput {');
        expect(selectedActionStateCommitSource).toContain('interface QidahenSelectedActionStateCommitInput {');
        expect(selectedActionStateCommitSource).toContain('export function commitQidahenSelectedActionState(');
        expect(selectedActionStateCommitSource).toContain('dependencies: QidahenSelectedActionStateCommitDependencies = {');
        expect(selectedActionStateCommitSource).toContain("const hasHuangtaijiBonus = currentFactionId === 'jin' && hasActiveCharacter(state, 'jin', 'jin-huangtaiji');");
        expect(selectedActionStateCommitSource).toContain('const usedBonusFactionAction = state.factionActionUsed && hasRemainingFactionAction(state, currentFactionId);');
        expect(selectedActionStateCommitSource).toContain("const shouldKeepDriveTigerDispatchSelectionOffHost = followUp.turnPhase === 'drive-tiger-consent';");
        expect(selectedActionStateCommitSource).toContain('wheelDispatchProgress: shouldKeepDriveTigerDispatchSelectionOffHost ? null : followUp.wheelDispatchProgress,');
        expect(selectedActionStateCommitSource).toContain('payment: buildPaymentState(actionId, 0),');
        expect(selectedActionStateCommitSource).toContain('return dependencies.advanceTurnIfReady(syncFactionActionWindow(executedState, currentFactionId), timestamp);');
        expect(selectedActionStateCommitSource).not.toContain("const recruitSelection = actionId === 'recruit'");
        expect(selectedActionStateCommitSource).not.toContain('const grantPardonResolution = dependencies.resolveGrantPardonExecution(');
    });

    it('execute 命令事件组装应收成 registry 与 owner 分层，commandEventBridge.ts 退休后不再回退', () => {
        const indexSource = readDomainIndexSource();
        const commandEventBuildersSource = readCommandEventBuildersSource();
        const commandEventBuilderRegistrySource = readCommandEventBuilderRegistrySource();
        const resolvedCommandBridgeSource = readResolvedCommandBridgeSource();
        const resolvedCommandEventBuildersSource = readResolvedCommandEventBuildersSource();
        const resolvedCommandEventBuilderRegistrySource = readResolvedCommandEventBuilderRegistrySource();
        const actionWindowResolvedCommandDependenciesSource = readActionWindowResolvedCommandDependenciesSource();
        const pendingBattleResolvedCommandDependenciesSource = readPendingBattleResolvedCommandDependenciesSource();
        expect(indexSource).not.toContain("import { buildQidahenCommandEvents } from './commandEventBridge';");
        expect(indexSource).toContain("import { buildQidahenCommandEvents } from './commandEventBuilders';");
        expect(indexSource).toContain('const commandEvents = buildQidahenCommandEvents(');
        expect(indexSource).toContain('return commandEvents ?? [];');
        expect(indexSource).not.toContain('return [buildQidahenInternalDispatchResolvedEvent(_state, command, now())];');
        expect(indexSource).not.toContain('return [buildQidahenPendingActionResolvedEvent(_state, command, _random, now())];');
        expect(indexSource).not.toContain('return [buildQidahenPostBattleDecisionResolvedEvent(_state, command, now())];');
        expect(indexSource).not.toContain("type: 'REGION_SELECTED',");
        expect(indexSource).not.toContain("type: 'PREVIEW_ACTION_CONFIRMED',");
        expect(indexSource).not.toContain("type: 'WHEEL_MOVE_SELECTED',");
        expect(indexSource).not.toContain("type: 'WHEEL_MOVE_EXECUTED',");
        expect(indexSource).not.toContain("type: 'PAYMENT_CARD_SELECTED',");
        expect(indexSource).not.toContain("type: 'HAND_LIMIT_DISCARD_CARD_SELECTED',");
        expect(indexSource).not.toContain("type: 'SUN_YUANHUA_TECH_CARD_SELECTED',");
        expect(indexSource).not.toContain("type: 'GAO_DI_DISPATCH_CARD_SELECTED',");
        expect(indexSource).not.toContain('selection: getQidahenInternalDispatchSelectionFromInteraction(_state.sys.interaction?.current),');
        expect(indexSource).not.toContain('selection: getQidahenPostBattleSelectionFromInteraction(_state.sys.interaction?.current),');
        expect(indexSource).not.toContain('selection: getQidahenKhanEdictSelectionFromInteraction(_state.sys.interaction?.current),');
        expect(indexSource).not.toContain('selection: getQidahenDiplomacySelectionFromInteraction(_state.sys.interaction?.current),');
        expect(indexSource).not.toContain('selection: getQidahenMaShiTradeSelectionFromInteraction(_state.sys.interaction?.current),');
        expect(indexSource).not.toContain('selection: getQidahenDriveTigerConsentSelectionFromInteraction(_state.sys.interaction?.current),');
        expect(indexSource).not.toContain('selection: getQidahenRecruitSelectionFromInteraction(_state.sys.interaction?.current),');
        expect(indexSource).not.toContain('selection: getQidahenFortificationMaintenanceSelectionFromInteraction(_state.sys.interaction?.current),');
        expect(indexSource).not.toContain('const interactionPendingTargetAction = getQidahenPendingTargetActionFromInteraction(_state.sys.interaction?.current);');
        expect(indexSource).not.toContain('QIDAHEN_PENDING_BATTLE_FLOW_DEPENDENCIES.applyRequestedCommittedTroops(');
        expect(indexSource).not.toContain('QIDAHEN_PENDING_BATTLE_FLOW_DEPENDENCIES.createStructuredBattleRolls(_state.core, pendingTargetAction, _random, {');
        expect(indexSource).not.toContain("import { getActionChoiceById } from './factionActionWindow';");
        expect(indexSource).not.toContain("import { getCurrentFactionId } from './factionTurnAccessors';");
        expect(indexSource).not.toContain('type QidahenCommandEventBuilder = (');
        expect(indexSource).not.toContain('const QIDAHEN_COMMAND_EVENT_BUILDERS: readonly QidahenCommandEventBuilder[] = [');
        expect(indexSource).not.toContain('const buildResolvedCommandEvents: QidahenCommandEventBuilder = (');
        expect(indexSource).not.toContain('const buildDirectInputCommandEvents: QidahenCommandEventBuilder = (');
        expect(indexSource).not.toContain(') => buildQidahenResolvedCommandEvents(state, command, random, timestamp);');
        expect(indexSource).not.toContain("case 'SELECT_REGION':");
        expect(indexSource).not.toContain('return [buildQidahenRegionSelectedEvent(command, timestamp)];');
        expect(indexSource).not.toContain('const buildQidahenRegionSelectedEvent = (');
        expect(indexSource).not.toContain('const buildQidahenPreviewActionConfirmedEvent = (');
        expect(indexSource).not.toContain('const buildQidahenGaoDiDispatchCardSelectedEvent = (');
        expect(indexSource).not.toContain("} from './selectedActionCommandBridge';");
        expect(indexSource).not.toContain("} from './directInputEventBridge';");
        expect(indexSource).not.toContain('export function buildQidahenCommandEvents(');

        expect(commandEventBuildersSource).toContain("import { QIDAHEN_COMMANDS } from './commands';");
        expect(commandEventBuildersSource).toContain('getActionChoiceById,');
        expect(commandEventBuildersSource).toContain('getQidahenHandCardPaymentValue,');
        expect(commandEventBuildersSource).toContain("import { getCurrentFactionId } from './factionTurnAccessors';");
        expect(commandEventBuildersSource).not.toContain("} from './commandEventBuilderContracts';");
        expect(commandEventBuildersSource).not.toContain('export type QidahenCommandEventBuilder = (');
        expect(commandEventBuildersSource).not.toContain('export interface QidahenCommandEventBuilderSpec {');
        expect(commandEventBuildersSource).not.toContain('export const QIDAHEN_COMMAND_EVENT_BUILDERS: readonly QidahenCommandEventBuilderSpec[] = [');
        expect(commandEventBuildersSource).toContain('const QIDAHEN_COMMAND_EVENT_BUILDERS: readonly QidahenCommandEventBuilderSpec[] = [');
        expect(commandEventBuildersSource).not.toContain('const buildResolvedCommandEvents: QidahenCommandEventBuilder = (');
        expect(commandEventBuildersSource).not.toContain('const buildDirectInputCommandEvents: QidahenCommandEventBuilder = (');
        expect(commandEventBuildersSource).toContain('type QidahenCommandEventBuilder = (');
        expect(commandEventBuildersSource).toContain('interface QidahenCommandEventBuilderSpec {');
        expect(commandEventBuildersSource).toContain('commandTypes: readonly QidahenCommand[\'type\'][];');
        expect(commandEventBuildersSource).toContain('buildEvents: QidahenCommandEventBuilder;');
        expect(commandEventBuildersSource).not.toContain(') => buildQidahenResolvedCommandEvents(state, command, random, timestamp);');
        expect(commandEventBuildersSource).not.toContain('case QIDAHEN_COMMANDS.SELECT_REGION:');
        expect(commandEventBuildersSource).not.toContain('return [buildQidahenRegionSelectedEvent(command, timestamp)];');
        expect(commandEventBuildersSource).toContain('const buildQidahenRegionSelectedEvent = (');
        expect(commandEventBuildersSource).toContain('getQidahenDiplomacySelectionFromInteraction,');
        expect(commandEventBuildersSource).toContain('getQidahenDriveTigerConsentSelectionFromInteraction,');
        expect(commandEventBuildersSource).toContain('getQidahenWheelDispatchSelectionFromInteraction,');
        expect(commandEventBuildersSource).toContain('const currentInteraction = state.sys.interaction?.current;');
        expect(commandEventBuildersSource).toContain('const driveTigerConsentSelection = getQidahenDriveTigerConsentSelectionFromInteraction(currentInteraction);');
        expect(commandEventBuildersSource).toContain('qidahenDiplomacySelection: getQidahenDiplomacySelectionFromInteraction(currentInteraction),');
        expect(commandEventBuildersSource).toContain('qidahenWheelDispatchSelection: getQidahenWheelDispatchSelectionFromInteraction(currentInteraction)');
        expect(commandEventBuildersSource).toContain('?? driveTigerConsentSelection?.dispatchSelection');
        expect(commandEventBuildersSource).toContain('const buildQidahenPreviewActionConfirmedEvent = (');
        expect(commandEventBuildersSource).toContain('const buildQidahenGaoDiDispatchCardSelectedEvent = (');
        expect(commandEventBuildersSource).toContain("type: 'PREVIEW_ACTION_CONFIRMED',");
        expect(commandEventBuildersSource).toContain("type: 'WHEEL_MOVE_EXECUTED',");
        expect(commandEventBuildersSource).toContain('commandTypes: [');
        expect(commandEventBuildersSource).toContain('QIDAHEN_COMMANDS.RESOLVE_SCENARIO_ARMAMENT_CHOICE,');
        expect(commandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD],');
        expect(commandEventBuildersSource).toContain('QIDAHEN_COMMANDS.EXECUTE_ACTION,');
        expect(commandEventBuildersSource).not.toContain('ExecuteActionCommand,');
        expect(commandEventBuildersSource).not.toContain('ExecuteSelectedActionCommand,');
        expect(commandEventBuildersSource).toContain('type QidahenSelectedActionExecuteCommand =');
        expect(commandEventBuildersSource).toContain("Extract<QidahenCommand, { type: 'EXECUTE_SELECTED_ACTION' }>");
        expect(commandEventBuildersSource).toContain("Extract<QidahenCommand, { type: 'EXECUTE_ACTION' }>");
        expect(commandEventBuildersSource).toContain('buildEvents: buildQidahenResolvedCommandEvents,');
        expect(commandEventBuildersSource).toContain(') => [buildQidahenRegionSelectedEvent(state, command as SelectRegionCommand, timestamp)],');
        expect(commandEventBuildersSource).toContain('command as QidahenSelectedActionExecuteCommand,');
        expect(commandEventBuilderRegistrySource).toBe('');

        expect(resolvedCommandBridgeSource).toBe('');

        expect(resolvedCommandEventBuildersSource).toContain("import { QIDAHEN_COMMANDS } from './commands';");
        expect(resolvedCommandEventBuildersSource).not.toContain("} from './actionWindowResolvedCommandDependencies';");
        expect(resolvedCommandEventBuildersSource).not.toContain("} from './pendingBattleResolvedCommandDependencies';");
        expect(resolvedCommandEventBuildersSource).not.toContain("} from './resolvedCommandEventBuilderContracts';");
        expect(resolvedCommandEventBuildersSource).not.toContain('export type QidahenResolvedCommandEventBuilder = (');
        expect(resolvedCommandEventBuildersSource).not.toContain('export interface QidahenResolvedCommandEventBuilderSpec {');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const QIDAHEN_RESOLVED_COMMAND_EVENT_BUILDERS: readonly QidahenResolvedCommandEventBuilderSpec[] = [');
        expect(resolvedCommandEventBuildersSource).toContain('const QIDAHEN_RESOLVED_COMMAND_EVENT_BUILDERS: readonly QidahenResolvedCommandEventBuilderSpec[] = [');
        expect(resolvedCommandEventBuildersSource).toContain('type QidahenResolvedCommandEventBuilder = (');
        expect(resolvedCommandEventBuildersSource).toContain('interface QidahenResolvedCommandEventBuilderSpec {');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: readonly QidahenCommand[\'type\'][];');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: QidahenResolvedCommandEventBuilder;');
        expect(actionWindowResolvedCommandDependenciesSource).toBe('');
        expect(pendingBattleResolvedCommandDependenciesSource).toBe('');
        expect(resolvedCommandEventBuildersSource).toContain("} from './interactionSelectionAccessors';");
        expect(resolvedCommandEventBuildersSource).toContain("} from './pendingBattleCommittedTroops';");
        expect(resolvedCommandEventBuildersSource).toContain("} from './battleRollMath';");
        expect(resolvedCommandEventBuildersSource).not.toContain('export interface QidahenActionWindowResolvedCommandDependencies {');
        expect(resolvedCommandEventBuildersSource).toContain('interface QidahenActionWindowResolvedCommandDependencies {');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const QIDAHEN_ACTION_WINDOW_RESOLVED_COMMAND_DEPENDENCIES: QidahenActionWindowResolvedCommandDependencies = {');
        expect(resolvedCommandEventBuildersSource).not.toContain('const QIDAHEN_ACTION_WINDOW_RESOLVED_COMMAND_DEPENDENCIES: QidahenActionWindowResolvedCommandDependencies = {');
        expect(resolvedCommandEventBuildersSource).not.toContain('export interface QidahenPendingBattleResolvedCommandDependencies {');
        expect(resolvedCommandEventBuildersSource).toContain('interface QidahenPendingBattleResolvedCommandDependencies {');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const QIDAHEN_PENDING_BATTLE_RESOLVED_COMMAND_DEPENDENCIES: QidahenPendingBattleResolvedCommandDependencies = {');
        expect(resolvedCommandEventBuildersSource).not.toContain('const QIDAHEN_PENDING_BATTLE_RESOLVED_COMMAND_DEPENDENCIES: QidahenPendingBattleResolvedCommandDependencies = {');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const buildQidahenHandLimitDiscardResolvedEvent = (');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const buildQidahenSunYuanhuaTechResolvedEvent = (');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildHandLimitDiscardResolvedCommandEvents: QidahenResolvedCommandEventBuilder = (');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildSunYuanhuaTechResolvedCommandEvents: QidahenResolvedCommandEventBuilder = (');
        expect(resolvedCommandEventBuildersSource).toContain('const buildSingleResolvedCommandEvents = <TCommand>(');
        expect(resolvedCommandEventBuildersSource).toContain('): QidahenResolvedCommandEventBuilder => (');
        expect(resolvedCommandEventBuildersSource).toContain(') => [buildEvent(command as TCommand, timestamp)];');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const buildQidahenGaoDiDispatchResolvedEvent = (');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const buildQidahenInternalDispatchResolvedEvent = (');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const buildQidahenFortificationMaintenanceResolvedEvent = (');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const buildQidahenDriveTigerConsentResolvedEvent = (');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const buildQidahenRecruitChoiceResolvedEvent = (');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const buildQidahenMaShiTradeChoiceResolvedEvent = (');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const buildQidahenKhanEdictChoiceResolvedEvent = (');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const buildQidahenDiplomacyChoiceResolvedEvent = (');
        expect(resolvedCommandEventBuildersSource).toContain('const DEFAULT_QIDAHEN_ACTION_WINDOW_RESOLVED_COMMAND_DEPENDENCIES: QidahenActionWindowResolvedCommandDependencies = {');
        expect(resolvedCommandEventBuildersSource).toContain('dependencies: QidahenActionWindowResolvedCommandDependencies = DEFAULT_QIDAHEN_ACTION_WINDOW_RESOLVED_COMMAND_DEPENDENCIES');
        expect(resolvedCommandEventBuildersSource).toContain('const buildStatefulResolvedCommandEvents = <TCommand>(');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvent: (state: MatchState<QidahenCore>, command: TCommand, timestamp: number) => QidahenEvent,');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildGaoDiDispatchResolvedCommandEvents = buildSingleResolvedCommandEvents<ResolveGaoDiDispatchCommand>(');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildInternalDispatchResolvedCommandEvents = buildStatefulResolvedCommandEvents<ResolveInternalDispatchCommand>(');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildFortificationMaintenanceResolvedCommandEvents = buildStatefulResolvedCommandEvents<ResolveFortificationMaintenanceCommand>(');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildDriveTigerConsentResolvedCommandEvents = buildStatefulResolvedCommandEvents<ResolveDriveTigerConsentCommand>(');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildRecruitResolvedCommandEvents = buildStatefulResolvedCommandEvents<ResolveRecruitChoiceCommand>(');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildMaShiTradeResolvedCommandEvents = buildStatefulResolvedCommandEvents<ResolveMaShiTradeChoiceCommand>(');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildKhanEdictResolvedCommandEvents = buildStatefulResolvedCommandEvents<ResolveKhanEdictChoiceCommand>(');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildDiplomacyResolvedCommandEvents = buildStatefulResolvedCommandEvents<ResolveDiplomacyChoiceCommand>(');
        expect(resolvedCommandEventBuildersSource).toContain('selection: dependencies.getQidahenInternalDispatchSelectionForCore(state.core, state.sys.interaction?.current),');
        expect(resolvedCommandEventBuildersSource).toContain('selection: dependencies.getQidahenFortificationMaintenanceSelectionForCore(state.core, state.sys.interaction?.current),');
        expect(resolvedCommandEventBuildersSource).toContain('selection: dependencies.getQidahenDriveTigerConsentSelectionForCore(state.core, state.sys.interaction?.current),');
        expect(resolvedCommandEventBuildersSource).toContain('selection: dependencies.getQidahenRecruitSelectionForCore(state.core, state.sys.interaction?.current),');
        expect(resolvedCommandEventBuildersSource).toContain('selection: dependencies.getQidahenMaShiTradeSelectionForCore(state.core, state.sys.interaction?.current),');
        expect(resolvedCommandEventBuildersSource).toContain('selection: dependencies.getQidahenKhanEdictSelectionForCore(state.core, state.sys.interaction?.current),');
        expect(resolvedCommandEventBuildersSource).toContain('selection: dependencies.getQidahenDiplomacySelectionForCore(state.core, state.sys.interaction?.current),');
        expect(resolvedCommandEventBuildersSource).not.toContain('        QIDAHEN_ACTION_WINDOW_RESOLVED_COMMAND_DEPENDENCIES,');
        expect(resolvedCommandEventBuildersSource).toContain(') => [buildEvent(');
        expect(resolvedCommandEventBuildersSource).toContain('command as TCommand,');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const buildQidahenPendingActionResolvedEvent = (');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const buildQidahenPostBattleDecisionResolvedEvent = (');
        expect(resolvedCommandEventBuildersSource).toContain('dependencies: QidahenPendingBattleResolvedCommandDependencies = {');
        expect(resolvedCommandEventBuildersSource).toContain('const currentPendingTargetAction = dependencies.getQidahenPendingTargetActionForCore(');
        expect(resolvedCommandEventBuildersSource).not.toContain('const interactionPendingTargetAction = dependencies.getQidahenPendingTargetActionFromInteraction(state.sys.interaction?.current);');
        expect(resolvedCommandEventBuildersSource).toContain('dependencies.applyRequestedCommittedTroops(');
        expect(resolvedCommandEventBuildersSource).toContain('dependencies.createStructuredBattleRolls(state.core, pendingTargetAction, random, {');
        expect(resolvedCommandEventBuildersSource).toContain('selection: dependencies.getQidahenPostBattleSelectionForCore(state.core, state.sys.interaction?.current),');
        expect(resolvedCommandEventBuildersSource).not.toContain('            QIDAHEN_PENDING_BATTLE_RESOLVED_COMMAND_DEPENDENCIES,');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildRandomStatefulResolvedCommandEvents = <TCommand>(');
        expect(resolvedCommandEventBuildersSource).not.toContain('buildEvent: (state: MatchState<QidahenCore>, command: TCommand, random: RandomFn, timestamp: number) => QidahenEvent,');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildPendingActionResolvedCommandEvents = buildRandomStatefulResolvedCommandEvents<ResolvePendingActionCommand>(');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildPostBattleDecisionResolvedCommandEvents = buildStatefulResolvedCommandEvents<ResolvePostBattleDecisionCommand>(');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const buildQidahenScenarioCharacterChoiceResolvedEvent = (');
        expect(resolvedCommandEventBuildersSource).not.toContain('export const buildQidahenScenarioArmamentChoiceResolvedEvent = (');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildScenarioCharacterChoiceResolvedCommandEvents = buildSingleResolvedCommandEvents<');
        expect(resolvedCommandEventBuildersSource).toContain("Extract<QidahenEvent, { type: 'RESOLVE_SCENARIO_CHARACTER_CHOICE' }>");
        expect(resolvedCommandEventBuildersSource).toContain('buildQidahenScenarioCharacterChoiceResolvedEvent,');
        expect(resolvedCommandEventBuildersSource).not.toContain('const buildScenarioArmamentChoiceResolvedCommandEvents = buildSingleResolvedCommandEvents<');
        expect(resolvedCommandEventBuildersSource).toContain("Extract<QidahenEvent, { type: 'RESOLVE_SCENARIO_ARMAMENT_CHOICE' }>");
        expect(resolvedCommandEventBuildersSource).toContain('buildQidahenScenarioArmamentChoiceResolvedEvent,');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_HAND_LIMIT_DISCARD],');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: buildSingleResolvedCommandEvents<ResolveHandLimitDiscardCommand>(');
        expect(resolvedCommandEventBuildersSource).toContain('buildQidahenHandLimitDiscardResolvedEvent,');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH],');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: buildSingleResolvedCommandEvents<ResolveSunYuanhuaTechCommand>(');
        expect(resolvedCommandEventBuildersSource).toContain('buildQidahenSunYuanhuaTechResolvedEvent,');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH],');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: buildSingleResolvedCommandEvents<ResolveGaoDiDispatchCommand>(');
        expect(resolvedCommandEventBuildersSource).toContain('buildQidahenGaoDiDispatchResolvedEvent,');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH],');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: buildStatefulResolvedCommandEvents<ResolveInternalDispatchCommand>(');
        expect(resolvedCommandEventBuildersSource).toContain('buildQidahenInternalDispatchResolvedEvent,');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE],');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: buildStatefulResolvedCommandEvents<ResolveFortificationMaintenanceCommand>(');
        expect(resolvedCommandEventBuildersSource).toContain('buildQidahenFortificationMaintenanceResolvedEvent,');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT],');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: buildStatefulResolvedCommandEvents<ResolveDriveTigerConsentCommand>(');
        expect(resolvedCommandEventBuildersSource).toContain('buildQidahenDriveTigerConsentResolvedEvent,');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE],');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: buildStatefulResolvedCommandEvents<ResolveRecruitChoiceCommand>(');
        expect(resolvedCommandEventBuildersSource).toContain('buildQidahenRecruitChoiceResolvedEvent,');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE],');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: buildStatefulResolvedCommandEvents<ResolveMaShiTradeChoiceCommand>(');
        expect(resolvedCommandEventBuildersSource).toContain('buildQidahenMaShiTradeChoiceResolvedEvent,');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE],');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: buildStatefulResolvedCommandEvents<ResolveKhanEdictChoiceCommand>(');
        expect(resolvedCommandEventBuildersSource).toContain('buildQidahenKhanEdictChoiceResolvedEvent,');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE],');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: buildStatefulResolvedCommandEvents<ResolveDiplomacyChoiceCommand>(');
        expect(resolvedCommandEventBuildersSource).toContain('buildQidahenDiplomacyChoiceResolvedEvent,');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION],');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION],');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: (');
        expect(resolvedCommandEventBuildersSource).toContain(') => [buildQidahenPendingActionResolvedEvent(');
        expect(resolvedCommandEventBuildersSource).toContain('command as ResolvePendingActionCommand,');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION],');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: buildStatefulResolvedCommandEvents<ResolvePostBattleDecisionCommand>(');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE],');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: buildSingleResolvedCommandEvents<');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes: [QIDAHEN_COMMANDS.RESOLVE_SCENARIO_ARMAMENT_CHOICE],');
        expect(resolvedCommandEventBuildersSource).toContain('buildEvents: buildSingleResolvedCommandEvents<');
        expect(resolvedCommandEventBuildersSource).toContain('const QIDAHEN_RESOLVED_COMMAND_EVENT_BUILDERS_BY_COMMAND_TYPE = new Map<');
        expect(resolvedCommandEventBuildersSource).toContain('QIDAHEN_RESOLVED_COMMAND_EVENT_BUILDERS.flatMap(({ commandTypes, buildEvents }) => (');
        expect(resolvedCommandEventBuildersSource).toContain('commandTypes.map((commandType) => [commandType, buildEvents] as const)');
        expect(resolvedCommandEventBuildersSource).toContain('export function buildQidahenResolvedCommandEvents(');
        expect(resolvedCommandEventBuildersSource).toContain('return QIDAHEN_RESOLVED_COMMAND_EVENT_BUILDERS_BY_COMMAND_TYPE.get(command.type)?.(');
        expect(resolvedCommandEventBuildersSource).toContain(') ?? null;');
        expect(resolvedCommandEventBuilderRegistrySource).toBe('');
        expect(resolvedCommandBridgeSource).toBe('');

    });

    it('PREVIEW_ACTION_CONFIRMED 应保持预览确认薄层，directInputEventReducerBridge 只负责委托到确认 owner', () => {
        const directInputEventReducerBridgeSource = readDirectInputEventReducerBridgeSource();
        const directInputEventReducersSource = readDirectInputEventReducersSource();
        const indexSource = readDomainIndexSource();
        const previewActionReducerSource = readPreviewActionReducerSource();

        expect(indexSource).not.toContain("import { reduceQidahenDirectInputEvent } from './directInputEventReducerBridge';");
        expect(indexSource).toContain("import { reduceQidahenDirectInputEvent } from './directInputEventReducers';");
        expect(indexSource).toContain('?? reduceQidahenDirectInputEvent(state, event)');
        expect(indexSource).not.toContain("} from './previewActionReducer';");
        expect(indexSource).not.toContain("} from './previewActionConfirmedEventBridge';");
        expect(indexSource).not.toContain('type QidahenPreviewActionConfirmedDependencies,');
        expect(indexSource).not.toContain('const QIDAHEN_PREVIEW_ACTION_CONFIRMED_DEPENDENCIES: QidahenPreviewActionConfirmedDependencies = {');
        expect(indexSource).not.toContain("case 'PREVIEW_ACTION_CONFIRMED':");
        expect(indexSource).not.toContain('return resolveQidahenPreviewActionConfirmedEvent(');
        expect(indexSource).not.toContain('QIDAHEN_PREVIEW_ACTION_CONFIRMED_DEPENDENCIES,');

        expect(directInputEventReducerBridgeSource).toBe('');
        expect(directInputEventReducersSource).toContain("['PREVIEW_ACTION_CONFIRMED']");
        expect(directInputEventReducersSource).toContain('resolveQidahenPreviewActionConfirmedEvent,');

        expect(previewActionReducerSource).toContain("getActionChoiceById,");
        expect(previewActionReducerSource).toContain("import { updateQidahenTurnLabel } from './turnLabelState';");
        expect(previewActionReducerSource).toContain("type QidahenPreviewActionConfirmedEvent = Extract<");
        expect(previewActionReducerSource).toContain("{ type: 'PREVIEW_ACTION_CONFIRMED' }");
        expect(previewActionReducerSource).not.toContain('export interface QidahenPreviewActionConfirmedDependencies {');
        expect(previewActionReducerSource).toContain('interface QidahenPreviewActionConfirmedDependencies {');
        expect(previewActionReducerSource).not.toContain('export const QIDAHEN_PREVIEW_ACTION_CONFIRMED_DEPENDENCIES: QidahenPreviewActionConfirmedDependencies = {');
        expect(previewActionReducerSource).not.toContain('const QIDAHEN_PREVIEW_ACTION_CONFIRMED_DEPENDENCIES: QidahenPreviewActionConfirmedDependencies = {');
        expect(previewActionReducerSource).not.toContain('export const reduceQidahenPreviewActionConfirmed = (');
        expect(previewActionReducerSource).toContain('export const resolveQidahenPreviewActionConfirmedEvent = (');
        expect(previewActionReducerSource).toContain('dependencies: QidahenPreviewActionConfirmedDependencies = {');
        expect(previewActionReducerSource).toContain('): QidahenCore => getActionChoiceById(event.payload.actionId)');
        expect(previewActionReducerSource).toContain('reduceQidahenPreviewActionConfirmed(');
        expect(previewActionReducerSource).toContain('actionWheelPosition: event.payload.actionId,');
        expect(previewActionReducerSource).toContain('selectedActionId: actionId,');
        expect(previewActionReducerSource).toContain('confirmedActionId: actionId,');
        expect(previewActionReducerSource).toContain('selectedPaymentCardIds,');
        expect(previewActionReducerSource).toContain('const nextState: QidahenCore = {');
        expect(previewActionReducerSource).toContain('payment: state.payment,');
        expect(previewActionReducerSource).toContain('payment: buildPaymentState(');
        expect(previewActionReducerSource).toContain('getQidahenSelectedActionCost(nextState, actionId),');
        expect(previewActionReducerSource).toContain("export const resolveQidahenPreviewActionCancelledEvent = (");
        expect(previewActionReducerSource).not.toContain("const grantPardonSourceRegion = actionId === 'grant-pardon'");
        expect(previewActionReducerSource).not.toContain("const pendingTargetAction = (actionId === 'raid' || actionId === 'marriage-subjugation')");
        expect(previewActionReducerSource).not.toContain('applyVictoryStatus');
        expect(previewActionReducerSource).not.toContain('advanceTurnIfReady');
    });

    it('SUN_YUANHUA_TECH_RESOLVED 应由独立 event owner 承接，index 不再本地维护科技确认收口', () => {
        const indexSource = readDomainIndexSource();
        const reducersSource = readResolvedEventReducersSource();
        const registrySource = readResolvedEventReducerRegistrySource();
        const dependenciesSource = readSunYuanhuaTechResolvedEventDependenciesSource();

        expect(indexSource).toContain("} from './resolvedEventReducers';");
        expect(indexSource).not.toContain("} from './selectedActionOrchestration';");
        expect(indexSource).not.toContain("} from './sunYuanhuaTechResolvedEventBridge';");
        expect(indexSource).not.toContain('resolveQidahenSunYuanhuaTechResolvedEvent,');
        expect(indexSource).not.toContain("case 'SUN_YUANHUA_TECH_RESOLVED': {");
        expect(indexSource).not.toContain('return resolveQidahenSunYuanhuaTechResolvedEvent(state, event,');
        expect(indexSource).not.toContain('type QidahenSunYuanhuaTechResolvedEventDependencies,');
        expect(indexSource).not.toContain('const QIDAHEN_SUN_YUANHUA_TECH_RESOLVED_DEPENDENCIES: QidahenSunYuanhuaTechResolvedEventDependencies = {');
        expect(indexSource).not.toContain("lastSeasonSummary: buildSeasonSummary('孙元化弃牌科技', event.timestamp, resolution.summaryLines),");
        expect(indexSource).not.toContain('id: `log-sun-yuanhua-tech-${event.timestamp}`,');
        expect(registrySource).toBe('');

        expect(reducersSource).toContain("} from './armamentUpgradeResolution';");
        expect(reducersSource).toContain("'SUN_YUANHUA_TECH_RESOLVED'");
        expect(reducersSource).toContain('resolveQidahenSunYuanhuaTechResolvedEvent,');

        expect(dependenciesSource).toBe('');
    });

    it('承诺兵力 cap 计算应下沉到 attackRules owner，index 只保留角色特化上限读取', () => {
        const indexSource = readDomainIndexSource();
        const attackRulesSource = readAttackRulesSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();
        const pendingTargetResolutionDependenciesSource = readPendingTargetResolutionDependenciesSource();
        const pendingTargetActionBuilderSource = readPendingTargetActionBuilderSource();
        const pendingBattleCommittedTroopsSource = readPendingBattleCommittedTroopsSource();

        expect(pendingTargetResolutionDependenciesSource).toBe('');
        expect(pendingTargetResolutionSource).toContain("} from './attackRules';");
        expect(indexSource).not.toContain('const computeEffectiveCommittedTroops = (');
        expect(indexSource).not.toContain('const getQidahenCharacterCommittedTroopLimit = (');
        expect(attackRulesSource).not.toContain('export interface QidahenAttackCommitmentInput {');
        expect(attackRulesSource).toContain('interface QidahenAttackCommitmentInput {');
        expect(attackRulesSource).not.toContain('export interface QidahenEffectiveAttackCommitmentInput extends QidahenAttackCommitmentInput {');
        expect(attackRulesSource).toContain('interface QidahenEffectiveAttackCommitmentInput extends QidahenAttackCommitmentInput {');
        expect(attackRulesSource).not.toContain('export const computeQidahenCommittedTroops = ({');
        expect(attackRulesSource).toContain('const computeQidahenCommittedTroops = ({');
        expect(attackRulesSource).toContain('export const computeQidahenEffectiveCommittedTroops = ({');
        expect(attackRulesSource).toContain('characterCommittedTroopLimit = null,');
        expect(pendingTargetActionBuilderSource).toContain("} from './attackRules';");
        expect(pendingTargetActionBuilderSource).toContain('computeQidahenEffectiveCommittedTroops,');
        expect(pendingBattleCommittedTroopsSource).toContain('export const getQidahenCharacterCommittedTroopLimit = (');
        expect(pendingBattleCommittedTroopsSource).not.toContain('const getQidahenCommandingFactionId = (');
        expect(pendingBattleCommittedTroopsSource).toContain("const commandingFactionId = actionId === 'drive-tiger' ? 'ming' : attackerFactionId;");
        expect(pendingBattleCommittedTroopsSource).toContain("if (commandingFactionId === 'ming' && hasActiveCharacter(state, 'ming', 'ming-yang-gao')) {");
        expect(pendingBattleCommittedTroopsSource).toContain('characterCommittedTroopLimit: getQidahenCharacterCommittedTroopLimit(');
    });

    it('纯战斗 math helper 应下沉到 attackRules owner，index 不再本地维护骰面和 battle-resolution troop count', () => {
        const indexSource = readDomainIndexSource();
        const attackRulesSource = readAttackRulesSource();
        const battleRollMathSource = readBattleRollMathSource();
        const battleStateSource = readBattleStateSource();
        const pendingTargetResolutionDependenciesSource = readPendingTargetResolutionDependenciesSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(pendingTargetResolutionDependenciesSource).toBe('');
        expect(pendingTargetResolutionSource).toContain('computeQidahenStructuredBattleCasualties,');
        expect(indexSource).not.toContain('getQidahenTroopDieSides,');
        expect(indexSource).not.toContain('const dieSidesByTroopLevel: Record<number, number> = {');
        expect(indexSource).not.toContain('const getTroopDieSides = (');
        expect(indexSource).not.toContain('const getBattleResolutionTroopCount = (');
        expect(indexSource).not.toContain('const computeStructuredBattleCasualties = (');
        expect(indexSource).not.toContain('const computeCombatPower = (');
        expect(indexSource).not.toContain('getQidahenBattleResolutionTroopCount,');
        expect(attackRulesSource).toContain('const QIDAHEN_TROOP_DIE_SIDES_BY_LEVEL: Record<number, number> = {');
        expect(attackRulesSource).not.toContain("export type QidahenAttackActionId = 'raid' | 'wheel-dispatch' | 'drive-tiger';");
        expect(attackRulesSource).not.toContain('export const QIDAHEN_ATTACK_RULE_CONFIGS: QidahenAttackRuleConfig[] = [');
        expect(attackRulesSource).toContain('const QIDAHEN_ATTACK_RULE_CONFIGS: QidahenAttackRuleConfig[] = [');
        expect(attackRulesSource).toContain("id: 'raid' | 'wheel-dispatch' | 'drive-tiger';");
        expect(attackRulesSource).toContain("actionId: 'raid' | 'wheel-dispatch' | 'drive-tiger';");
        expect(attackRulesSource).toContain('export const getQidahenTroopDieSides = (level: number): number => (');
        expect(attackRulesSource).toContain("export const getQidahenBattleResolutionTroopCount = (");
        expect(attackRulesSource).not.toContain('export const computeQidahenCombatPower = (');
        expect(attackRulesSource).toContain('const computeQidahenCombatPower = (');
        expect(attackRulesSource).not.toContain('export interface QidahenStructuredBattleCasualtyResult {');
        expect(attackRulesSource).toContain('interface QidahenStructuredBattleCasualtyResult {');
        expect(attackRulesSource).not.toContain('export interface QidahenStructuredBattleCasualtyInput {');
        expect(attackRulesSource).toContain('interface QidahenStructuredBattleCasualtyInput {');
        expect(attackRulesSource).toContain('export const computeQidahenStructuredBattleCasualties = ({');
        expect(attackRulesSource).toContain('summary: `等级损伤估算：攻方战力 ${attackPower} 造成 ${defenderLoss} 损伤，守方战力 ${defenderPower} 造成 ${attackerLoss} 损伤。`,');
        expect(battleRollMathSource).toContain("import { getQidahenTroopDieSides } from './attackRules';");
        expect(battleStateSource).toContain("import { getQidahenBattleResolutionTroopCount, QIDAHEN_NEUTRAL_GARRISON_MAX_TROOPS } from './attackRules';");
    });

    it('initialCoreSeeds 应直接承接初始特种兵克隆，而不是继续通过 regionConfig getter 转手', () => {
        const initialCoreSeedsSource = readInitialCoreSeedsSource();
        const regionConfigSource = readRegionConfigSource();

        expect(regionConfigSource).not.toContain('const cloneRegionConfigSpecialTroops = (');
        expect(regionConfigSource).not.toContain('export const getQidahenInitialSpecialTroops = (regionId: string): QidahenSpecialTroopStack[] => (');
        expect(initialCoreSeedsSource).not.toContain('getQidahenInitialSpecialTroops,');
        expect(initialCoreSeedsSource).toContain('specialTroops: regionConfig.initialSpecialTroops.map((stack) => ({');
        expect(initialCoreSeedsSource).toContain('pieceIds: stack.pieceIds ? [...stack.pieceIds] : undefined,');
    });

    it('battle roll helper 应由 battleRollMath owner 承接，index 不再本地维护掷骰与骑兵劫掠反击 math', () => {
        const indexSource = readDomainIndexSource();
        const battleRollMathSource = readBattleRollMathSource();
        const pendingBattleFlowSource = readPendingBattleFlowSource();
        const pendingBattleFlowDependenciesSource = readPendingBattleFlowDependenciesSource();
        const pendingTargetResolutionDependenciesSource = readPendingTargetResolutionDependenciesSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(pendingBattleFlowDependenciesSource).toBe('');
        expect(indexSource).not.toContain('createQidahenStructuredBattleRolls(');
        expect(pendingBattleFlowSource).toContain("} from './battleRollMath';");
        expect(pendingBattleFlowSource).toContain('createStructuredBattleRolls: createQidahenStructuredBattleRolls,');
        expect(pendingTargetResolutionDependenciesSource).toBe('');
        expect(pendingTargetResolutionSource).toContain('computeQidahenCavalryPlunderCounterPower,');
        expect(pendingTargetResolutionSource).toContain('getCavalryPlunderCounterPower: computeQidahenCavalryPlunderCounterPower,');
        expect(indexSource).not.toContain('const createStructuredBattleRolls = (');
        expect(indexSource).not.toContain('const getCavalryPlunderCounterPower = (');
        expect(indexSource).not.toContain('const buildCombatUnits = (');
        expect(indexSource).not.toContain('const rollBattleStage = (');
        expect(indexSource).not.toContain('const getEiduPriorityPhase = (');
        expect(battleRollMathSource).not.toContain('export const buildStructuredCombatUnitsFromStacks = (');
        expect(battleRollMathSource).toContain('export const computeQidahenCavalryPlunderCounterPower = (');
        expect(battleRollMathSource).toContain('export const createQidahenStructuredBattleRolls = (');
        expect(battleRollMathSource).toContain('const buildStructuredCombatUnitsFromStacks = (');
        expect(battleRollMathSource).toContain('const buildCombatUnits = (');
        expect(battleRollMathSource).toContain('const rollBattleStage = (');
        expect(battleRollMathSource).toContain('const getEiduPriorityPhase = (');
    });

    it('pending-action/post-battle flow state transition 应由独立 owner 承接，pendingBattleFlow 不再本地维护 summary/reset glue', () => {
        const indexSource = readDomainIndexSource();
        const initialCoreSetupSource = readInitialCoreSetupSource();
        const factionTurnOrderSource = readFactionTurnOrderSource();
        const factionTurnAccessorsSource = readFactionTurnAccessorsSource();
        const pendingBattleFlowSource = readPendingBattleFlowSource();
        const pendingBattleFlowDependenciesSource = readPendingBattleFlowDependenciesSource();
        const pendingBattleCommittedTroopsSource = readPendingBattleCommittedTroopsSource();
        const pendingBattleOrchestrationSource = readPendingBattleOrchestrationSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();
        const postBattleDecisionResolutionSource = readPostBattleDecisionResolutionSource();
        const resolvedEventReducersSource = readResolvedEventReducersSource();
        const registrySource = readResolvedEventReducerRegistrySource();
        const pendingBattleStateTransitionSource = readPendingBattleStateTransitionSource();
        const seasonResolutionSource = readSeasonResolutionSource();
        const specialRuleStateSource = readSpecialRuleStateSource();
        const seasonResolutionDependenciesSource = readSeasonResolutionDependenciesSource();
        const turnActionDependenciesSource = readTurnActionDependenciesSource();
        const turnFlowOrchestrationSource = readTurnFlowOrchestrationSource();
        const victoryResolutionSource = readVictoryResolutionSource();

        expect(indexSource).not.toContain('resolveQidahenPendingActionFromPayload,');
        expect(indexSource).not.toContain("} from './pendingBattleCommittedTroops';");
        expect(indexSource).not.toContain("} from './pendingBattleResolutionBridge';");
        expect(indexSource).toContain("} from './resolvedEventReducers';");
        expect(indexSource).not.toContain("} from './pendingBattleResolvedEventBridge';");
        expect(indexSource).not.toContain("} from './pendingActionResolvedEventOrchestration';");
        expect(indexSource).not.toContain("} from './postBattleDecisionResolvedEventOrchestration';");
        expect(indexSource).not.toContain("} from './pendingBattleFlow';");
        expect(initialCoreSetupSource).toContain("import { getScenarioPlayableFactionIds } from './factionTurnOrder';");
        expect(indexSource).not.toContain("} from './turnFlowOrchestration';");
        expect(indexSource).toContain("} from './specialRuleState';");
        expect(indexSource).toContain("} from './victoryResolution';");
        expect(indexSource).not.toContain('resolveQidahenGameOverForTurnFlow,');
        expect(indexSource).toContain('isGameOver: (state) => {');
        expect(indexSource).toContain('const winnerFactionId = state.victoryStatus?.winnerFactionId;');
        expect(indexSource).toContain('winner: state.factions[winnerFactionId].playerId,');
        expect(indexSource).not.toContain('resolveQidahenPendingBattleResolvedEvent,');
        expect(indexSource).not.toContain('resolveQidahenPendingActionResolvedEventForTurnFlow,');
        expect(indexSource).not.toContain('resolveQidahenPostBattleDecisionResolvedEventForTurnFlow,');
        expect(indexSource).not.toContain('QIDAHEN_PENDING_BATTLE_FLOW_DEPENDENCIES,');
        expect(indexSource).not.toContain('QIDAHEN_PENDING_TARGET_RESOLUTION_DEPENDENCIES,');
        expect(indexSource).not.toContain("} from './pendingBattleFlow';");
        expect(indexSource).not.toContain("} from './pendingTargetResolution';");
        expect(indexSource).not.toContain('QIDAHEN_POST_BATTLE_RESOLUTION_DEPENDENCIES,');
        expect(indexSource).not.toContain("} from './postBattleDecisionResolution';");
        expect(indexSource).not.toContain("return resolveQidahenPendingBattleResolvedEvent(state, event);");
        expect(registrySource).toBe('');
        const pendingBattleResolvedEventDependenciesSource = readPendingBattleResolvedEventDependenciesSource();
        expect(pendingBattleResolvedEventDependenciesSource).toBe('');
        expect(pendingBattleFlowDependenciesSource).toBe('');
        expect(pendingBattleFlowSource).not.toContain('type QidahenPendingBattleResolvedEvent =');
        expect(pendingBattleFlowSource).not.toContain('export const resolveQidahenPendingBattleResolvedEvent = (');
        expect(pendingBattleFlowSource).toContain('dependencies: QidahenPendingBattleFlowDependencies = {');
        expect(resolvedEventReducersSource).toContain("} from './pendingBattleFlow';");
        expect(resolvedEventReducersSource).toContain("'PENDING_ACTION_RESOLVED'");
        expect(resolvedEventReducersSource).toContain("'POST_BATTLE_DECISION_RESOLVED'");
        expect(resolvedEventReducersSource).not.toContain('export interface QidahenResolvedEventReducerSpec');
        expect(resolvedEventReducersSource).toContain('interface QidahenResolvedEventReducerSpec');
        expect(resolvedEventReducersSource).toContain('resolveQidahenPendingActionFromPayload,');
        expect(resolvedEventReducersSource).toContain('resolveQidahenPostBattleInteractionChoice,');
        expect(resolvedEventReducersSource).toContain('event.payload,');
        expect(resolvedEventReducersSource).toContain('event.payload.choiceId,');
        expect(resolvedEventReducersSource).toContain('event.payload.selection,');
        expect(resolvedEventReducersSource).toContain('event.timestamp,');
        expect(indexSource).not.toContain('const applyRequestedCommittedTroops = (');
        expect(indexSource).not.toContain('const getFactionIdByPlayerId = (');
        expect(indexSource).not.toContain('const getCurrentFactionId = (');
        expect(indexSource).not.toContain('getScenarioPlayableFactionIds,');
        expect(indexSource).not.toContain('const getScenarioPlayableFactionIds = (');
        expect(indexSource).not.toContain('const filterFactionOrderForScenario = (');
        expect(indexSource).not.toContain('const getActiveFactionTurnOrder = (');
        expect(indexSource).not.toContain('const countControlledRuntimeRegions = (');
        expect(indexSource).not.toContain('const canApplyPrestigeCardBonus = (');
        expect(indexSource).not.toContain('const findPrestigeWinner = (');
        expect(indexSource).not.toContain('const findMilitaryWinner = (');
        expect(indexSource).not.toContain('const findHegemonyWinner = (');
        expect(indexSource).not.toContain('const getHanseongController = (');
        expect(indexSource).not.toContain('const resolvePendingTargetAction = (');
        expect(indexSource).not.toContain('const buildPendingActionResolutionSummary = (');
        expect(indexSource).not.toContain('const buildPostBattleDecisionSummary = (');
        expect(indexSource).not.toContain('return resolveQidahenPendingActionFromPayload(');
        expect(indexSource).not.toContain('export const resolveQidahenPostBattleInteractionChoice = (');
        expect(indexSource).not.toContain('return resolveQidahenPostBattleInteractionChoice(');
        expect(indexSource).not.toContain('const payload = normalizePendingTargetInteractionPayload(value);');
        expect(indexSource).not.toContain('export const resolveQidahenPendingTargetInteractionChoice = (');
        expect(indexSource).not.toContain('resolveQidahenPendingTargetInteractionChoiceFromPendingBattleFlow(');
        expect(indexSource).toContain("} from './specialRuleState';");
        expect(indexSource).not.toContain("} from './seasonResolution';");
        expect(indexSource).not.toContain('resolveQidahenMidyear,');
        expect(indexSource).not.toContain('resolveQidahenNewYear,');
        expect(turnActionDependenciesSource).toBe('');
        expect(seasonResolutionSource).toContain('export const resolveQidahenMidyear = (');
        expect(seasonResolutionSource).toContain('export const resolveQidahenNewYear = (');
        expect(seasonResolutionSource).not.toContain("export type QidahenMidyearResolution = Pick<QidahenCore, 'factions' | 'lastSeasonSummary'>;");
        expect(seasonResolutionSource).toContain("type QidahenMidyearResolution = Pick<QidahenCore, 'factions' | 'lastSeasonSummary'>;");
        expect(seasonResolutionSource).not.toContain("export type QidahenNewYearResolution = Pick<");
        expect(seasonResolutionSource).toContain("type QidahenNewYearResolution = Pick<");
        expect(seasonResolutionSource).not.toContain('export interface QidahenSeasonResolutionDependencies {');
        expect(seasonResolutionSource).toContain('interface QidahenSeasonResolutionDependencies {');
        expect(seasonResolutionSource).toContain('dependencies: QidahenSeasonResolutionDependencies = {');
        expect(seasonResolutionSource).not.toContain('export const resolveQidahenMidyearWithSeasonDependencies = (');
        expect(seasonResolutionSource).not.toContain('export const resolveQidahenNewYearWithSeasonDependencies = (');
        expect(seasonResolutionSource).not.toContain('const QIDAHEN_SEASON_RESOLUTION_DEPENDENCIES: QidahenSeasonResolutionDependencies = {');
        expect(seasonResolutionSource).not.toContain('export const QIDAHEN_SEASON_RESOLUTION_DEPENDENCIES: QidahenSeasonResolutionDependencies = {');
        expect(seasonResolutionDependenciesSource).toBe('');
        expect(indexSource).toContain("export { getQidahenEffectiveVpByFaction, getQidahenPrestigeBonusByFaction } from './victoryResolution';");
        expect(indexSource).not.toContain('const QIDAHEN_SPECIAL_RULE_STATE_DEPENDENCIES: QidahenSpecialRuleStateDependencies = {');
        expect(indexSource).not.toContain('const QIDAHEN_VICTORY_RESOLUTION_DEPENDENCIES: QidahenVictoryResolutionDependencies = {');
        expect(indexSource).not.toContain('const syncSpecialRuleState = (state: QidahenCore): QidahenCore => (');
        expect(indexSource).not.toContain('const applyVictoryStatus = (');
        expect(indexSource).not.toContain('const resolveQidahenGameOver = (');
        expect(indexSource).not.toContain('syncQidahenSpecialRuleState(state, QIDAHEN_SPECIAL_RULE_STATE_DEPENDENCIES)');
        expect(indexSource).not.toContain('applyQidahenVictoryStatus(state, options, QIDAHEN_VICTORY_RESOLUTION_DEPENDENCIES)');
        expect(indexSource).not.toContain('const getQidahenRuleRegionController = (');
        expect(turnFlowOrchestrationSource).toBe('');
        expect(specialRuleStateSource).not.toContain('export const QIDAHEN_SPECIAL_RULE_STATE_DEPENDENCIES: QidahenSpecialRuleStateDependencies = {');
        expect(specialRuleStateSource).not.toContain('const QIDAHEN_SPECIAL_RULE_STATE_DEPENDENCIES: QidahenSpecialRuleStateDependencies = {');
        expect(specialRuleStateSource).not.toContain('export function syncQidahenSpecialRuleStateForTurnFlow(state: QidahenCore): QidahenCore {');
        expect(specialRuleStateSource).toContain('dependencies: QidahenSpecialRuleStateDependencies = {');
        expect(victoryResolutionSource).toContain("import { syncQidahenSpecialRuleState } from './specialRuleState';");
        expect(victoryResolutionSource).not.toContain('export const QIDAHEN_VICTORY_RESOLUTION_DEPENDENCIES: QidahenVictoryResolutionDependencies = {');
        expect(victoryResolutionSource).not.toContain('const QIDAHEN_VICTORY_RESOLUTION_DEPENDENCIES: QidahenVictoryResolutionDependencies = {');
        expect(victoryResolutionSource).toContain('syncSpecialRuleState: syncQidahenSpecialRuleState,');
        expect(victoryResolutionSource).not.toContain('export function applyQidahenVictoryStatusForTurnFlow(');
        expect(victoryResolutionSource).not.toContain('export function resolveQidahenGameOverForTurnFlow(state: QidahenCore): GameOverResult | undefined {');
        expect(victoryResolutionSource).toContain('dependencies: QidahenVictoryResolutionDependencies = {');
        expect(pendingBattleFlowSource).toContain("} from './pendingBattleCommittedTroops';");
        expect(pendingBattleFlowSource).toContain("} from './battleRollMath';");
        expect(pendingBattleFlowSource).toContain("import { syncFactionActionWindow } from './factionActionWindow';");
        expect(pendingBattleFlowSource).toContain("} from './factionTurnAccessors';");
        expect(pendingBattleOrchestrationSource).toBe('');
        expect(pendingBattleFlowSource).toContain("} from './pendingTargetResolution';");
        expect(pendingBattleFlowSource).not.toContain("} from './pendingTargetResolutionDependencies';");
        const postBattleResolutionDependenciesSource = readPostBattleResolutionDependenciesSource();
        const pendingTargetResolutionDependenciesSource = readPendingTargetResolutionDependenciesSource();
        expect(pendingBattleFlowSource).toContain("from './postBattleDecisionResolution';");
        expect(pendingBattleFlowSource).not.toContain("} from './postBattleResolutionDependencies';");
        expect(pendingBattleFlowSource).toContain("} from './pendingBattleCommittedTroops';");
        expect(pendingBattleFlowSource).toContain('applyRequestedCommittedTroops,');
        expect(pendingBattleFlowSource).not.toContain('QIDAHEN_PENDING_BATTLE_COMMITTED_TROOPS_DEPENDENCIES,');
        expect(pendingBattleFlowSource).toContain('applyRequestedCommittedTroops,');
        expect(pendingBattleFlowSource).not.toContain('const QIDAHEN_PENDING_BATTLE_FLOW_DEPENDENCIES: QidahenPendingBattleFlowDependencies = {');
        expect(pendingBattleFlowSource).not.toContain('export const QIDAHEN_PENDING_BATTLE_FLOW_DEPENDENCIES: QidahenPendingBattleFlowDependencies = {');
        expect(pendingBattleFlowSource).toContain('resolvePendingTargetAction: resolvePendingTargetActionByActionType,');
        expect(pendingBattleFlowSource).toContain('resolvePostBattleDecision: resolveQidahenPostBattleDecisionByChoice,');
        expect(pendingBattleFlowSource).toContain('resolvePendingTargetAction: resolvePendingTargetActionByActionType,');
        expect(pendingBattleFlowSource).not.toContain('QIDAHEN_PENDING_TARGET_RESOLUTION_DEPENDENCIES,');
        expect(pendingBattleFlowSource).not.toContain('QIDAHEN_POST_BATTLE_RESOLUTION_DEPENDENCIES,');
        expect(postBattleResolutionDependenciesSource).toBe('');
        expect(pendingTargetResolutionDependenciesSource).toBe('');
        expect(postBattleDecisionResolutionSource).not.toContain('const QIDAHEN_POST_BATTLE_RESOLUTION_DEPENDENCIES: QidahenPostBattleResolutionDependencies = {');
        expect(postBattleDecisionResolutionSource).toContain('dependencies: QidahenPostBattleResolutionDependencies = {');
        expect(pendingTargetResolutionSource).not.toContain('const QIDAHEN_PENDING_TARGET_RESOLUTION_DEPENDENCIES: QidahenPendingTargetResolutionDependencies = {');
        expect(pendingTargetResolutionSource).not.toContain('export const QIDAHEN_PENDING_TARGET_RESOLUTION_DEPENDENCIES: QidahenPendingTargetResolutionDependencies = {');
        expect(pendingTargetResolutionSource).toContain('dependencies: QidahenPendingTargetResolutionDependencies = {');
        expect(pendingBattleFlowSource).toContain("applyPendingActionResolutionToBattleFlowState,");
        expect(pendingBattleFlowSource).toContain("applyPostBattleDecisionResolutionToBattleFlowState,");
        expect(pendingBattleFlowSource).toContain("} from './pendingBattleStateTransition';");
        expect(pendingBattleFlowSource).not.toContain('type QidahenPendingActionResolution,');
        expect(pendingBattleFlowSource).not.toContain('type QidahenPendingBattleStateTransitionDependencies,');
        expect(pendingBattleFlowSource).not.toContain('export interface QidahenPendingBattleFlowDependencies extends QidahenPendingBattleStateTransitionDependencies {');
        expect(pendingBattleFlowSource).toContain("type QidahenPendingBattleFlowResolution = Pick<");
        expect(pendingBattleFlowSource).toContain('interface QidahenPendingBattleFlowStateTransitionDependencies {');
        expect(pendingBattleFlowSource).toContain('interface QidahenPendingBattleFlowDependencies extends QidahenPendingBattleFlowStateTransitionDependencies {');
        expect(pendingBattleFlowSource).toContain('getQidahenInteractionSelectionStateForCore,');
        expect(pendingBattleFlowSource).not.toContain('const getQidahenPendingBattleInteractionState = <TState>(');
        expect(pendingBattleFlowSource).toContain('createStructuredBattleRolls: (');
        expect(pendingBattleFlowSource).toContain('attackerCavalryPlunderSource?: QidahenPlunderSource,');
        expect(pendingBattleFlowSource).toContain('attackerCasualtyPriority?: QidahenCasualtyPriority,');
        expect(pendingBattleFlowSource).toContain('defenderCasualtyPriority?: QidahenCasualtyPriority,');
        expect(pendingBattleFlowSource).toContain('battleRolls?: QidahenBattleRolls | null,');
        expect(pendingBattleFlowSource).not.toContain("export type PendingActionResolvedPayload = Extract<QidahenEvent, { type: 'PENDING_ACTION_RESOLVED' }>['payload'];");
        expect(pendingBattleFlowSource).toContain("type PendingActionResolvedPayload = Extract<QidahenEvent, { type: 'PENDING_ACTION_RESOLVED' }>['payload'];");
        expect(pendingBattleFlowSource).toContain('export const resolveQidahenPendingActionFromPayload = (');
        expect(pendingBattleFlowSource).toMatch(/resolveQidahenPendingActionFromPayload[\s\S]*const currentPendingTargetAction = getQidahenInteractionSelectionStateForCore\([\s\S]*payload\.pendingTargetAction,[\s\S]*state,[\s\S]*getQidahenPendingTargetActionForCore,[\s\S]*\);/);
        expect(pendingBattleFlowSource).toContain('return applyPendingActionResolutionToBattleFlowState(');
        expect(pendingBattleFlowSource).toContain('export const resolveQidahenPendingTargetInteractionChoice = (');
        expect(pendingBattleFlowSource).toContain('const payload = normalizePendingTargetInteractionPayload(value);');
        expect(pendingBattleFlowSource).toMatch(/resolveQidahenPendingTargetInteractionChoice[\s\S]*const currentPendingTargetAction = getQidahenInteractionSelectionStateForCore\([\s\S]*interactionPendingTargetAction,[\s\S]*state,[\s\S]*getQidahenPendingTargetActionForCore,[\s\S]*\);/);
        expect(pendingBattleFlowSource).toContain('dependencies.createStructuredBattleRolls(state, pendingTargetAction, random, {');
        expect(pendingBattleFlowSource).toContain('export const resolveQidahenPostBattleInteractionChoice = (');
        expect(pendingBattleFlowSource).toMatch(/resolveQidahenPostBattleInteractionChoice[\s\S]*const selection = getQidahenInteractionSelectionStateForCore\([\s\S]*interactionSelection,[\s\S]*state,[\s\S]*getQidahenPostBattleSelectionForCore,[\s\S]*\);/);
        expect(pendingBattleFlowSource).toContain('return applyPostBattleDecisionResolutionToBattleFlowState(');
        expect(pendingBattleFlowSource).not.toContain('const buildSeasonSummary = (');
        expect(pendingBattleFlowSource).not.toContain('const buildPendingActionResolutionSummary = (');
        expect(pendingBattleFlowSource).not.toContain('const buildPostBattleDecisionSummary = (');
        expect(pendingBattleFlowSource).not.toContain('dependencies.applyVictoryStatus({');
        expect(pendingBattleFlowSource).not.toContain('actionLog: [');
        expect(pendingBattleFlowSource).not.toContain('const resolvePendingTargetAction = (');
        expect(pendingBattleFlowSource).not.toContain('const resolvePostBattleDecision = (');
        expect(pendingBattleFlowSource).not.toContain('const buildPostBattleSelection = (');
        expect(factionTurnAccessorsSource).toContain("const QIDAHEN_FACTION_ORDER: readonly QidahenFactionId[] = ['ming', 'mongol', 'jin'];");
        expect(factionTurnAccessorsSource).toContain('export const getFactionIdByPlayerId = (');
        expect(factionTurnAccessorsSource).toContain('QIDAHEN_FACTION_ORDER.find((factionId) => state.factions[factionId].playerId === playerId) ?? \'ming\'');
        expect(factionTurnAccessorsSource).toContain('export const getCurrentFactionId = (');
        expect(factionTurnAccessorsSource).toContain('getFactionIdByPlayerId(state, state.currentPlayer)');
        expect(factionTurnOrderSource).toContain("} from '../roomSetup';");
        expect(factionTurnOrderSource).toContain('export const getScenarioPlayableFactionIds = (');
        expect(factionTurnOrderSource).toContain('export const filterFactionOrderForScenario = (');
        expect(factionTurnOrderSource).toContain('export const getActiveFactionTurnOrder = (');
        expect(factionTurnOrderSource).toContain('[...getQidahenPlayableFactions(scenarioId)]');
        expect(factionTurnOrderSource).toContain('const playableFactionIds = new Set(getScenarioPlayableFactionIds(scenarioId));');
        expect(factionTurnOrderSource).toContain('openingFactionOrder.includes(factionId)');
        expect(factionTurnOrderSource).toContain('return hasValidChronologyOrder && state.currentYearIndex > 0');
        expect(victoryResolutionSource).toContain("} from './regionConfig';");
        expect(victoryResolutionSource).not.toContain('getQidahenCapitalOwner,');
        expect(victoryResolutionSource).not.toContain('getQidahenPrestigeCardBonus,');
        expect(victoryResolutionSource).not.toContain('getQidahenPrestigeCardBonusUnlock,');
        expect(victoryResolutionSource).toContain('const QIDAHEN_VICTORY_FACTION_ORDER: readonly QidahenFactionId[] = [\'ming\', \'mongol\', \'jin\'];');
        expect(victoryResolutionSource).toContain('export const countQidahenControlledRuntimeRegions = (');
        expect(victoryResolutionSource).toContain('export const getQidahenPrestigeBonusByFaction = (');
        expect(victoryResolutionSource).toContain('export const getQidahenEffectiveVpByFaction = (');
        expect(victoryResolutionSource).not.toContain('export interface QidahenVictoryResolutionDependencies {');
        expect(victoryResolutionSource).toContain('interface QidahenVictoryResolutionDependencies {');
        expect(victoryResolutionSource).toContain('export function applyQidahenVictoryStatus(');
        expect(victoryResolutionSource).toContain('const unlockMode = resolveQidahenRuleRegionConfig(regionId).prestigeCardBonusUnlock;');
        expect(victoryResolutionSource).toContain('const bonus = resolveQidahenRuleRegionConfig(region.id).prestigeCardBonus;');
        expect(victoryResolutionSource).toContain('const capitalOwner = resolveQidahenRuleRegionConfig(region.id).capitalOf;');
        expect(victoryResolutionSource).toContain('const victoryStatus = findMilitaryWinner(nextState)');
        expect(victoryResolutionSource).toContain('?? findPrestigeWinner(nextState)');
        expect(victoryResolutionSource).toContain('?? (options.allowHegemony ? findHegemonyWinner(nextState) : null);');
        expect(seasonResolutionSource).toContain("} from './victoryResolution';");
        expect(seasonResolutionSource).toContain('countQidahenControlledRuntimeRegions,');
        expect(seasonResolutionSource).toContain('getQidahenEffectiveVpByFaction,');
        expect(specialRuleStateSource).toContain("} from './regionConfig';");
        expect(specialRuleStateSource).not.toContain('export interface QidahenSpecialRuleStateDependencies {');
        expect(specialRuleStateSource).toContain('interface QidahenSpecialRuleStateDependencies {');
        expect(specialRuleStateSource).toContain('export const getQidahenRuleRegionController = (');
        expect(specialRuleStateSource).toContain('export const syncQidahenSpecialRuleState = (');
        expect(specialRuleStateSource).toContain("const hanseongController = getQidahenRuleRegionController(syncedState, 'shou-cheng');");
        expect(specialRuleStateSource).toContain("const hanseongInitialController = getQidahenInitialController('shou-cheng');");
        expect(specialRuleStateSource).toContain('const hanseongPrestigeUnlocked = syncedState.hanseongPrestigeUnlocked');
        expect(pendingBattleCommittedTroopsSource).toContain("} from './attackRules';");
        expect(pendingBattleCommittedTroopsSource).toContain("} from './battleState';");
        expect(pendingBattleCommittedTroopsSource).toContain("} from './troopCompat';");
        expect(pendingBattleCommittedTroopsSource).not.toContain('export interface QidahenPendingBattleCommittedTroopsDependencies {');
        expect(pendingBattleCommittedTroopsSource).toContain('interface QidahenPendingBattleCommittedTroopsDependencies {');
        expect(pendingBattleCommittedTroopsSource).toContain('getPendingActionSourceForceSnapshot: typeof getPendingActionSourceForceSnapshot;');
        expect(pendingBattleCommittedTroopsSource).not.toContain('getMovableTroopCountForProfile: (');
        expect(pendingBattleCommittedTroopsSource).not.toContain('getCharacterCommittedTroopLimit: (');
        expect(pendingBattleCommittedTroopsSource).toContain('export const getMovableTroopCountForProfile = (');
        expect(pendingBattleCommittedTroopsSource).toContain('export const getQidahenCharacterCommittedTroopLimit = (');
        expect(pendingBattleCommittedTroopsSource).not.toContain('const getQidahenCommandingFactionId = (');
        expect(pendingBattleCommittedTroopsSource).toContain("const commandingFactionId = actionId === 'drive-tiger' ? 'ming' : attackerFactionId;");
        expect(pendingBattleCommittedTroopsSource).not.toContain('export const QIDAHEN_PENDING_BATTLE_COMMITTED_TROOPS_DEPENDENCIES: QidahenPendingBattleCommittedTroopsDependencies = {');
        expect(pendingBattleCommittedTroopsSource).not.toContain('const QIDAHEN_PENDING_BATTLE_COMMITTED_TROOPS_DEPENDENCIES: QidahenPendingBattleCommittedTroopsDependencies = {');
        expect(pendingBattleCommittedTroopsSource).toContain('getPendingActionSourceForceSnapshot,');
        expect(pendingBattleCommittedTroopsSource).toContain('export const applyRequestedCommittedTroops = (');
        expect(pendingBattleCommittedTroopsSource).not.toContain('export const applyQidahenRequestedCommittedTroops = (');
        expect(pendingBattleCommittedTroopsSource).toContain('const sourceRegion = dependencies.getPendingActionSourceForceSnapshot(state, pendingTargetAction);');
        expect(pendingBattleCommittedTroopsSource).toContain('dependencies: QidahenPendingBattleCommittedTroopsDependencies = {');
        expect(pendingBattleCommittedTroopsSource).toContain('const cavalryCount = countCompatPieces(region.specialTroops, (piece) => piece.troopKind === \'cavalry\');');
        expect(pendingBattleCommittedTroopsSource).toContain('characterCommittedTroopLimit: getQidahenCharacterCommittedTroopLimit(');
        expect(pendingBattleCommittedTroopsSource).toContain('const attackPressure = computeQidahenAttackPressure(committedTroops, pendingTargetAction.battleWidth);');
        expect(pendingBattleOrchestrationSource).toBe('');
        expect(pendingBattleFlowDependenciesSource).toBe('');
        expect(pendingBattleFlowSource).toContain("} from './pendingTargetResolution';");
        expect(pendingBattleFlowSource).toContain("from './postBattleDecisionResolution';");
        expect(pendingBattleFlowSource).not.toContain("} from './pendingBattleOrchestration';");
        expect(pendingBattleFlowSource).toContain("} from './pendingBattleCommittedTroops';");
        expect(pendingBattleFlowSource).toContain('resolvePendingTargetAction: resolvePendingTargetActionByActionType,');
        expect(pendingBattleFlowSource).toContain('resolvePendingTargetAction: resolvePendingTargetActionByActionType,');
        expect(pendingBattleFlowSource).not.toContain('QIDAHEN_PENDING_TARGET_RESOLUTION_DEPENDENCIES,');
        expect(pendingBattleFlowSource).toContain('resolvePostBattleDecision: resolveQidahenPostBattleDecisionByChoice,');
        expect(pendingBattleFlowSource).not.toContain('QIDAHEN_POST_BATTLE_RESOLUTION_DEPENDENCIES,');
        expect(registrySource).toBe('');
        expect(pendingBattleFlowSource).not.toContain('event.payload.choiceId,');
        expect(pendingBattleFlowSource).not.toContain('event.payload.selection,');
        expect(pendingBattleStateTransitionSource).not.toContain('export interface QidahenPendingBattleStateTransitionDependencies {');
        expect(pendingBattleStateTransitionSource).toContain('interface QidahenPendingBattleStateTransitionDependencies {');
        expect(pendingBattleStateTransitionSource).not.toContain("export type QidahenPendingActionResolution = Pick<");
        expect(pendingBattleStateTransitionSource).toContain("type QidahenPendingActionResolution = Pick<");
        expect(pendingBattleStateTransitionSource).toContain("import { buildSeasonSummary } from './seasonSummaryBuilder';");
        expect(pendingBattleStateTransitionSource).not.toContain('const buildSeasonSummary = (');
        expect(pendingBattleStateTransitionSource).toContain('const buildPendingActionResolutionSummary = (');
        expect(pendingBattleStateTransitionSource).toContain('const buildPostBattleDecisionSummary = (');
        expect(pendingBattleStateTransitionSource).toContain('export const applyPendingActionResolutionToBattleFlowState = (');
        expect(pendingBattleStateTransitionSource).toContain('export const applyPostBattleDecisionResolutionToBattleFlowState = (');
        expect(pendingBattleStateTransitionSource).toContain("turnPhase: resolution.pendingTargetAction");
        expect(pendingBattleStateTransitionSource).toContain('actionLog: [');
    });

    it('势力行动窗口 helper 应由 factionActionWindow owner 承接，commands、Board、selectionBuilders 不再各自复制 turn/action-window 规则', () => {
        const actionWindowEntryStateSource = readActionWindowEntryStateSource();
        const boardSource = readBoardSource();
        const commandsSource = readCommandsSource();
        const indexSource = readDomainIndexSource();
        const factionActionWindowSource = readFactionActionWindowSource();
        const initialCoreSetupSource = readInitialCoreSetupSource();
        const selectedActionExecutionSource = readSelectedActionExecutionSource();
        const selectedActionStateCommitSource = readSelectedActionStateCommitSource();
        const selectionBuildersSource = readSelectionBuildersSource();
        const commandEventBuildersSource = readCommandEventBuildersSource();
        const pendingBattleFlowSource = readPendingBattleFlowSource();
        const pendingBattleFlowDependenciesSource = readPendingBattleFlowDependenciesSource();

        expect(indexSource).not.toContain('getActionChoiceById,');
        expect(indexSource).not.toContain("import { syncFactionActionWindow } from './factionActionWindow';");
        expect(indexSource).not.toContain("export { getActionChoicesForFaction } from './factionActionWindow';");
        expect(pendingBattleFlowDependenciesSource).toBe('');
        expect(pendingBattleFlowSource).toContain("import { syncFactionActionWindow } from './factionActionWindow';");
        expect(pendingBattleFlowSource).toContain('syncFactionActionWindow,');
        expect(initialCoreSetupSource).toContain("import { buildQidahenActionWindowEntryState } from './actionWindowEntryState';");
        expect(initialCoreSetupSource).toContain('buildTurnLabel,');
        expect(initialCoreSetupSource).toContain('getActionChoiceById,');
        expect(initialCoreSetupSource).not.toContain('buildPaymentState,');
        expect(initialCoreSetupSource).not.toContain('getActionChoicesForFaction,');
        expect(initialCoreSetupSource).not.toContain('getDefaultActionIdForFaction,');
        expect(indexSource).not.toContain('const defaultActionIdByFaction: Record<QidahenFactionId, string> = {');
        expect(indexSource).not.toContain('const upgradeArmamentActionChoice: QidahenActionChoice = {');
        expect(indexSource).not.toContain('const actionChoiceCatalog: Record<QidahenFactionId, QidahenActionChoice[]> = {');
        expect(indexSource).not.toContain("import { getActionChoiceById } from './factionActionWindow';");
        expect(commandEventBuildersSource).toContain('getActionChoiceById,');
        expect(commandEventBuildersSource).toContain('getQidahenHandCardPaymentValue,');
        expect(indexSource).not.toContain('const buildPaymentState = (selectedActionId: string, selectedCardCount = 0): QidahenPaymentState => {');
        expect(indexSource).not.toContain('const buildTurnLabel = (');
        expect(indexSource).not.toContain('const hasRemainingFactionAction = (');
        expect(indexSource).not.toContain('const isFactionActionTurnComplete = (');
        expect(indexSource).not.toContain('const isFactionActionSelectable = (');
        expect(indexSource).not.toContain('const syncFactionActionWindow = (');

        expect(factionActionWindowSource).toContain("} from './factionTurnAccessors';");
        expect(factionActionWindowSource).toContain('const defaultActionIdByFaction: Record<QidahenFactionId, string> = {');
        expect(factionActionWindowSource).toContain('const upgradeArmamentActionChoice: QidahenActionChoice = {');
        expect(factionActionWindowSource).toContain('const actionChoiceCatalog: Record<QidahenFactionId, QidahenActionChoice[]> = {');
        expect(factionActionWindowSource).toContain('export const getActionChoicesForFaction = (');
        expect(factionActionWindowSource).toContain('export const getActionChoiceById = (');
        expect(factionActionWindowSource).toContain('export const getDefaultActionIdForFaction = (');
        expect(factionActionWindowSource).toContain('export const buildPaymentState = (');
        expect(factionActionWindowSource).toContain('export const getQidahenHandCardPaymentValue = (');
        expect(factionActionWindowSource).toContain('export const computeQidahenSelectedPaymentValue = (');
        expect(factionActionWindowSource).toContain('export const buildTurnLabel = (');
        expect(factionActionWindowSource).toContain('export const hasRemainingFactionAction = (');
        expect(factionActionWindowSource).toContain('export const isFactionActionTurnComplete = (');
        expect(factionActionWindowSource).toContain('export const syncFactionActionWindow = (');

        expect(commandsSource).toContain("} from './factionActionWindow';");
        expect(commandsSource).toContain("import { hasUpgradableArmament } from './armamentLowFidelity';");
        expect(commandsSource).toContain("import { getCurrentFactionId } from './factionTurnAccessors';");
        expect(commandsSource).not.toContain('const getCurrentFactionId = (core: QidahenCore): QidahenFactionId => (');
        expect(commandsSource).not.toContain('const QIDAHEN_ARMAMENT_LOW_FIDELITY_MAX_LEVEL = 2;');
        expect(commandsSource).not.toContain('const hasActiveCharacter = (');
        expect(commandsSource).not.toContain('const hasUpgradableArmament = (');
        expect(commandsSource).not.toContain('const hasRemainingFactionAction = (');

        expect(boardSource).toContain("import { getCurrentFactionId } from './domain/factionTurnAccessors';");
        expect(boardSource).not.toContain('const getCurrentFactionId = (core: QidahenCore): QidahenFactionId => (');

        expect(selectedActionStateCommitSource).toContain("} from './factionActionWindow';");
        expect(selectedActionStateCommitSource).toContain('hasRemainingFactionAction,');
        expect(selectedActionExecutionSource).not.toContain('hasRemainingFactionAction,');
        expect(selectionBuildersSource).toContain("import { getCurrentFactionId } from './factionTurnAccessors';");
        expect(selectionBuildersSource).not.toContain('const getFactionIdByPlayerId = (state: QidahenCore, playerId: string): QidahenFactionId => (');
        expect(selectionBuildersSource).not.toContain('const getCurrentFactionId = (state: QidahenCore): QidahenFactionId => (');

        expect(actionWindowEntryStateSource).toContain("} from './factionActionWindow';");
        expect(actionWindowEntryStateSource).toContain('getActionChoicesForFaction,');
        expect(actionWindowEntryStateSource).toContain('getDefaultActionIdForFaction,');
        expect(actionWindowEntryStateSource).toContain('buildPaymentState,');
    });

    it('换人主流程应由 turnAdvance owner 承接，index 不再本地维护 advanceTurnIfReady 编排本体', () => {
        const indexSource = readDomainIndexSource();
        const initialCoreSetupSource = readInitialCoreSetupSource();
        const regionSelectionPreferencesSource = readRegionSelectionPreferencesSource();
        const scenarioPresetsSource = readScenarioPresetsSource();
        const turnAdvanceSource = readTurnAdvanceSource();
        const turnFlowOrchestrationSource = readTurnFlowOrchestrationSource();
        const wheelMovesSource = readWheelMovesSource();

        expect(indexSource).not.toContain("} from './turnFlowOrchestration';");
        expect(indexSource).toContain("} from './specialRuleState';");
        expect(indexSource).not.toContain("} from './turnAdvance';");
        expect(indexSource).not.toContain('advanceQidahenTurnIfReady,');
        expect(indexSource).not.toContain('type QidahenTurnAdvanceDependencies,');
        expect(indexSource).not.toContain('const QIDAHEN_TURN_ADVANCE_DEPENDENCIES: QidahenTurnAdvanceDependencies = {');
        expect(indexSource).not.toContain('const advanceTurnIfReady = (state: QidahenCore, timestamp: number): QidahenCore => (');
        expect(indexSource).not.toContain('advanceQidahenTurnIfReady(');
        expect(initialCoreSetupSource).toContain("import { getQidahenScenarioPreset } from './scenarioPresets';");
        expect(initialCoreSetupSource).toContain("} from './wheelMoves';");
        expect(initialCoreSetupSource).toContain('getQidahenWheelMoveChoices,');
        expect(initialCoreSetupSource).toContain('wheelMoveChoices: getQidahenWheelMoveChoices(),');
        expect(initialCoreSetupSource).not.toContain('wheelMoveChoices: QIDAHEN_WHEEL_MOVE_CHOICES,');
        expect(indexSource).not.toContain('getScenarioOpeningFactionOrder,');
        expect(indexSource).not.toContain('buildWheelMoveSummary,');
        expect(indexSource).not.toContain('const factionTurnOrder = getActiveFactionTurnOrder(');
        expect(indexSource).not.toContain('const nextFactionId = isImmediatePostNewYear');
        expect(indexSource).not.toContain("selectedWheelMoveId: 'move-1-free',");
        expect(indexSource).not.toContain("text: `轮到 ${nextState.factions[nextFactionId].name} 行动。`,");
        expect(indexSource).not.toContain('export const QIDAHEN_SCENARIO_PRESETS: Record<QidahenScenarioId, QidahenScenarioPreset> = {');
        expect(indexSource).not.toContain("export { QIDAHEN_SCENARIO_PRESETS, getQidahenScenarioPreset } from './scenarioPresets';");
        expect(indexSource).not.toContain("const wheelMoveChoices: QidahenWheelMoveChoice[] = [");
        expect(indexSource).not.toContain('const getPreferredActionWindowSelectedRegionIdForFaction = (');

        expect(turnAdvanceSource).toContain("} from './interactionSelectionAccessors';");
        expect(turnAdvanceSource).toContain("} from './factionActionWindow';");
        expect(turnAdvanceSource).toContain("} from './factionTurnAccessors';");
        expect(turnAdvanceSource).toContain("} from './factionTurnOrder';");
        expect(turnAdvanceSource).toContain("} from './regionSelectionPreferences';");
        expect(turnAdvanceSource).toContain("} from './scenarioPresets';");
        expect(turnAdvanceSource).toContain("} from './selectionBuilders';");
        expect(turnAdvanceSource).toContain('getQidahenGrantPardonSelectionForCore');
        expect(turnAdvanceSource).toContain('const grantPardonSelection = getQidahenGrantPardonSelectionForCore(nextState);');
        expect(turnAdvanceSource).toContain('|| grantPardonSelection');
        expect(turnAdvanceSource).toContain("import { buildQidahenActionWindowEntryState } from './actionWindowEntryState';");
        expect(turnAdvanceSource).not.toContain('export interface QidahenTurnAdvanceDependencies {');
        expect(turnAdvanceSource).toContain('interface QidahenTurnAdvanceDependencies {');
        expect(turnAdvanceSource).toContain('getCurrentWheelDispatchSelectionForCore: (');
        expect(turnAdvanceSource).toContain('export function advanceQidahenTurnIfReady(');
        expect(turnAdvanceSource).toContain('const beginHandLimitDiscardIfNeeded = (');
        expect(turnAdvanceSource).toContain('const scenarioOpeningFactionOrder = filterFactionOrderForScenario(');
        expect(turnAdvanceSource).toContain('const factionTurnOrder = getActiveFactionTurnOrder(');
        expect(turnAdvanceSource).toContain("selectedWheelMoveId: 'move-1-free',");
        expect(turnAdvanceSource).toContain("text: `轮到 ${nextState.factions[nextFactionId].name} 行动。`,");
        expect(turnAdvanceSource).toContain('return dependencies.updateTurnLabel(');
        expect(turnAdvanceSource).toContain('return dependencies.updateTurnLabel({');
        expect(turnAdvanceSource).toContain('selectedRegionId: getPreferredActionWindowSelectedRegionIdForFaction(nextState, nextFactionId),');
        expect(turnAdvanceSource).toContain('beginHandLimitDiscardIfNeeded(advancedState, nextFactionId, timestamp, dependencies)');
        expect(turnAdvanceSource).not.toContain('const updateTurnLabel = (');
        expect(turnAdvanceSource).not.toContain('const getPreferredActionWindowSelectedRegionIdForFaction = (');
        expect(turnAdvanceSource).not.toContain('beginHandLimitDiscardIfNeeded: (');
        expect(turnAdvanceSource).not.toContain('getPreferredActionWindowSelectedRegionIdForFaction: (');
        expect(turnAdvanceSource).not.toContain('getScenarioOpeningFactionOrder: (');
        expect(turnAdvanceSource).not.toContain('buildWheelMoveSummary: (');
        expect(turnAdvanceSource).not.toContain('export const QIDAHEN_TURN_ADVANCE_DEPENDENCIES: QidahenTurnAdvanceDependencies = {');
        expect(turnAdvanceSource).not.toContain('const QIDAHEN_TURN_ADVANCE_DEPENDENCIES: QidahenTurnAdvanceDependencies = {');
        expect(turnAdvanceSource).toContain('getCurrentWheelDispatchSelectionForCore: getQidahenCurrentWheelDispatchSelectionForCore,');
        expect(turnAdvanceSource).not.toContain('export function advanceQidahenTurnIfReadyForTurnFlow(');
        expect(turnAdvanceSource).toContain('dependencies: QidahenTurnAdvanceDependencies = {');
        expect(turnFlowOrchestrationSource).toBe('');

        expect(regionSelectionPreferencesSource).toContain('export const canPlaceRegularTroopsInRegion = (');
        expect(regionSelectionPreferencesSource).toContain('export const getPreferredSelectedRegionIdForFaction = (');
        expect(regionSelectionPreferencesSource).toContain('export const getPreferredActionWindowSelectedRegionIdForFaction = (');
        expect(regionSelectionPreferencesSource).not.toContain('export const getPreferredNonSiegedControlledRuntimeRegion = (');
        expect(regionSelectionPreferencesSource).not.toContain('export const getPreferredControlledRuntimeRegion = (');
        expect(regionSelectionPreferencesSource).toContain('const getPreferredNonSiegedControlledRuntimeRegion = (');
        expect(regionSelectionPreferencesSource).toContain('const getPreferredControlledRuntimeRegion = (');
        expect(scenarioPresetsSource).not.toContain('export const QIDAHEN_SCENARIO_PRESETS: Record<QidahenScenarioId, QidahenScenarioPreset> = {');
        expect(scenarioPresetsSource).toContain('const QIDAHEN_SCENARIO_PRESETS: Record<QidahenScenarioId, QidahenScenarioPreset> = {');
        expect(scenarioPresetsSource).toContain('export const getQidahenScenarioPreset = (scenarioId: QidahenScenarioId): QidahenScenarioPreset => {');
        expect(wheelMovesSource).not.toContain('export const QIDAHEN_WHEEL_MOVE_CHOICES: QidahenWheelMoveChoice[] = [');
        expect(wheelMovesSource).toContain('const QIDAHEN_WHEEL_MOVE_CHOICES: QidahenWheelMoveChoice[] = [');
        expect(wheelMovesSource).toContain('export const getQidahenWheelMoveChoices = (): QidahenWheelMoveChoice[] => (');
        expect(wheelMovesSource).toContain('export const buildQidahenWheelMoveSummary = (moveId: string): string => {');
    });

    it('region selection 偏好与调度目标规则应由 regionSelectionPreferences / battleState owner 承接，selectionBuilders 不再本地复制区位判定 helper', () => {
        const battleStateSource = readBattleStateSource();
        const dispatchSelectionBuildersSource = readDispatchSelectionBuildersSource();
        const regionSelectionPreferencesSource = readRegionSelectionPreferencesSource();
        const selectionBuildersSource = readSelectionBuildersSource();

        expect(dispatchSelectionBuildersSource).toContain("} from './battleState';");
        expect(dispatchSelectionBuildersSource).toContain('isRegionControlledByFaction,');
        expect(dispatchSelectionBuildersSource).toContain('isRegionFriendlyToFaction,');
        expect(dispatchSelectionBuildersSource).toContain("} from './regionSelectionPreferences';");
        expect(dispatchSelectionBuildersSource).toContain('isFriendlyDispatchSupportTarget,');
        expect(dispatchSelectionBuildersSource).toContain('isOwnSiegedCityReinforcementTarget,');
        expect(dispatchSelectionBuildersSource).toContain('isRegionAvailableForNonDispatchAction,');
        expect(dispatchSelectionBuildersSource).not.toContain('const isRegionControlledByFaction = (');
        expect(dispatchSelectionBuildersSource).not.toContain('const isOwnSiegedCityReinforcementTarget = (');
        expect(dispatchSelectionBuildersSource).not.toContain('const isRegionFriendlyToFaction = (');
        expect(dispatchSelectionBuildersSource).not.toContain('const isFriendlyDispatchSupportTarget = (');
        expect(selectionBuildersSource).toContain("} from './regionSelectionPreferences';");
        expect(selectionBuildersSource).toContain('canPlaceRegularTroopsInRegion,');
        expect(selectionBuildersSource).toContain('getPreferredRegularTroopPlacementRegion,');
        expect(selectionBuildersSource).toContain('isRegionAvailableForNonDispatchAction,');
        expect(selectionBuildersSource).toContain('isRegionUnderSiege,');
        expect(selectionBuildersSource).not.toContain('const isRegionUnderSiege = (');
        expect(selectionBuildersSource).not.toContain('const canPlaceRegularTroopsInRegion = (');
        expect(selectionBuildersSource).not.toContain('const isRegionAvailableForNonDispatchAction = (');
        expect(selectionBuildersSource).not.toContain('const getRegularTroopPlacementSnapshot = (');
        expect(selectionBuildersSource).not.toContain('const getPreferredRegularTroopPlacementRegion = (');

        expect(regionSelectionPreferencesSource).toContain('export const canPlaceRegularTroopsInRegion = (');
        expect(regionSelectionPreferencesSource).toContain('export const isRegionAvailableForNonDispatchAction = (');
        expect(regionSelectionPreferencesSource).toContain('export const isOwnSiegedCityReinforcementTarget = (');
        expect(regionSelectionPreferencesSource).toContain('export const isFriendlyDispatchSupportTarget = (');
        expect(regionSelectionPreferencesSource).toContain('export const getPreferredRegularTroopPlacementRegion = (');
        expect(regionSelectionPreferencesSource).toContain("import { getNonSiegedCityActionSourceSnapshot } from './actionSourceRegionState';");

        expect(battleStateSource).toContain('export const isRegionControlledByFaction = (');
        expect(battleStateSource).toContain('export const isRegionFriendlyToFaction = (');
    });

    it('势力中文名与控制标签语义应由 factionLabelSemantics owner 承接，index、selectionBuilders 与 troopStacks 不再各自复制标签 helper', () => {
        const factionLabelSemanticsSource = readFactionLabelSemanticsSource();
        const initialCoreSetupSource = readInitialCoreSetupSource();
        const indexSource = readDomainIndexSource();
        const pendingTargetResolutionDependenciesSource = readPendingTargetResolutionDependenciesSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();
        const scenarioChoiceStateSource = readScenarioChoiceStateSource();
        const seasonResolutionSource = readSeasonResolutionSource();
        const selectionBuildersSource = readSelectionBuildersSource();
        const actionWindowChoicesSource = readActionWindowChoicesSource();
        const troopStacksSource = readTroopStacksSource();

        expect(indexSource).not.toContain("} from './factionLabelSemantics';");
        expect(indexSource).not.toContain('toFactionLabel,');
        expect(indexSource).not.toContain('factionDisplayNameById,');
        expect(indexSource).not.toContain('const factionDisplayNameById: Record<QidahenFactionId, string> = {');
        expect(indexSource).not.toContain("const toFactionLabel = (controller: QidahenFactionId | 'neutral') => (");
        expect(indexSource).not.toContain('const getRegionControlLabel = (');
        expect(actionWindowChoicesSource).toContain("import { toFactionLabel } from './factionLabelSemantics';");
        expect(actionWindowChoicesSource).toContain('toFactionLabel,');
        expect(pendingTargetResolutionDependenciesSource).toBe('');
        expect(pendingTargetResolutionSource).toContain("import { getRegionControlLabel, toFactionLabel } from './factionLabelSemantics';");
        expect(pendingTargetResolutionSource).toContain('getRegionControlLabel,');
        expect(seasonResolutionSource).toContain("} from './factionLabelSemantics';");
        expect(seasonResolutionSource).toContain("import { getFactionDisplayName, toFactionLabel } from './factionLabelSemantics';");
        expect(seasonResolutionSource).not.toContain("import { factionDisplayNameById, toFactionLabel } from './factionLabelSemantics';");
        expect(seasonResolutionSource).toContain('getFactionDisplayName(character.faction)');
        expect(seasonResolutionSource).toContain('getFactionDisplayName(occupiedDongjiangController)');

        expect(initialCoreSetupSource).not.toContain("import { factionDisplayNameById } from './factionLabelSemantics';");
        expect(initialCoreSetupSource).not.toContain('factionDisplayNameById,');

        expect(scenarioChoiceStateSource).toContain("import {");
        expect(scenarioChoiceStateSource).toContain("getFactionDisplayName,");
        expect(scenarioChoiceStateSource).not.toContain('factionDisplayNameById: Record<QidahenFactionId, string>,');
        expect(scenarioChoiceStateSource).toContain('factionName: getFactionDisplayName(factionId),');

        expect(selectionBuildersSource).toContain("import { toFactionLabel } from './factionLabelSemantics';");
        expect(selectionBuildersSource).not.toContain("const toFactionLabel = (controller: QidahenFactionId | 'neutral') => (");

        expect(troopStacksSource).toContain("import { getFactionDisplayName } from './factionLabelSemantics';");
        expect(troopStacksSource).not.toContain('const factionDisplayNameById: Record<QidahenFactionId, string> = {');

        expect(factionLabelSemanticsSource).not.toContain('export const factionDisplayNameById: Record<QidahenFactionId, string> = {');
        expect(factionLabelSemanticsSource).toContain('const factionDisplayNameById: Record<QidahenFactionId, string> = {');
        expect(factionLabelSemanticsSource).toContain('export const getFactionDisplayName = (');
        expect(factionLabelSemanticsSource).toContain("export const toFactionLabel = (controller: QidahenFactionId | 'neutral') => (");
        expect(factionLabelSemanticsSource).toContain('export const getRegionControlLabel = (');
    });

    it('season summary builder 应由独立 owner 承接，index 不再本地维护共享 summary helper', () => {
        const directInputEventReducerBridgeSource = readDirectInputEventReducerBridgeSource();
        const indexSource = readDomainIndexSource();
        const seasonSummaryBuilderSource = readSeasonSummaryBuilderSource();
        const wheelMoveExecutionSource = readWheelMoveExecutionSource();
        const pendingBattleStateTransitionSource = readPendingBattleStateTransitionSource();

        expect(indexSource).not.toContain("import { buildSeasonSummary } from './seasonSummaryBuilder';");
        expect(indexSource).not.toContain('const buildSeasonSummary = (title: string, timestamp: number, lines: string[]): QidahenSeasonSummary => ({');
        expect(directInputEventReducerBridgeSource).toBe('');

        expect(seasonSummaryBuilderSource).toContain("import type { QidahenSeasonSummary } from './types';");
        expect(seasonSummaryBuilderSource).toContain('export const buildSeasonSummary = (');
        expect(seasonSummaryBuilderSource).toContain("id: `season-${timestamp}`,");
        expect(wheelMoveExecutionSource).toContain("import { buildSeasonSummary } from './seasonSummaryBuilder';");
        expect(pendingBattleStateTransitionSource).toContain("import { buildSeasonSummary } from './seasonSummaryBuilder';");
        expect(pendingBattleStateTransitionSource).not.toContain('const buildSeasonSummary = (');
    });

    it('运行时区域规则刷新应由 runtimeRegionRules owner 承接，index 不再本地维护 logical region 回补与关隘边界刷新 helper', () => {
        const indexSource = readDomainIndexSource();
        const runtimeRegionRulesSource = readRuntimeRegionRulesSource();
        const actionWindowChoicesSource = readActionWindowChoicesSource();
        const actionWindowDispatchSource = readActionWindowDispatchSource();

        expect(indexSource).not.toContain("} from './runtimeRegionRules';");
        expect(indexSource).not.toContain('refreshRuntimeRegionRules,');
        expect(indexSource).not.toContain('getQidahenStatefulRegionDisplayName,');
        expect(indexSource).not.toContain('const STATEFUL_REGION_NAME_OVERRIDES: Partial<Record<string, string>> = {');
        expect(indexSource).not.toContain('const appendLogicalRuleRegions = (');
        expect(indexSource).not.toContain('const cloneRuntimeRegionsForRuleRefresh = (');
        expect(indexSource).not.toContain('const setDirectedBoundary = (');
        expect(indexSource).not.toContain('const setBidirectionalBoundary = (');
        expect(indexSource).not.toContain('const refreshRuntimeRegionRules = (');
        expect(actionWindowChoicesSource).toContain("import { refreshRuntimeRegionRules } from './runtimeRegionRules';");
        expect(actionWindowChoicesSource).toContain('refreshRuntimeRegionRules,');
        expect(actionWindowDispatchSource).toContain("import { refreshRuntimeRegionRules } from './runtimeRegionRules';");
        expect(actionWindowDispatchSource).toContain('refreshRuntimeRegionRules,');

        expect(runtimeRegionRulesSource).toContain('export const getQidahenStatefulRegionDisplayName = (regionId: string): string => (');
        expect(runtimeRegionRulesSource).toContain("const STATEFUL_REGION_NAME_OVERRIDES: Partial<Record<string, string>> = {");
        expect(runtimeRegionRulesSource).toContain('const appendLogicalRuleRegions = (runtimeRegions: QidahenCore[\'regions\']): QidahenCore[\'regions\'] => {');
        expect(runtimeRegionRulesSource).toContain('const cloneRuntimeRegionsForRuleRefresh = (regions: QidahenCore[\'regions\']) => (');
        expect(runtimeRegionRulesSource).toContain('const setDirectedBoundary = (');
        expect(runtimeRegionRulesSource).toContain('const setBidirectionalBoundary = (');
        expect(runtimeRegionRulesSource).toContain('export const refreshRuntimeRegionRules = (');
        expect(runtimeRegionRulesSource).toContain("import {");
        expect(runtimeRegionRulesSource).toContain("getQidahenLogicalRuleRegionConfigs,");
        expect(runtimeRegionRulesSource).not.toContain("QIDAHEN_RULE_REGION_CONFIGS,");
        expect(runtimeRegionRulesSource).not.toContain("QIDAHEN_LOGICAL_RULE_REGION_IDS,");
        expect(runtimeRegionRulesSource).toContain("STATEFUL_REGION_NAME_OVERRIDES[regionId] ?? resolveQidahenRuleRegionConfig(regionId).name");
        expect(runtimeRegionRulesSource).toContain("runtimeRegions = setBidirectionalBoundary(runtimeRegions, 'city-region-25', 'city-region-28-jizhen', 'plain');");
        expect(runtimeRegionRulesSource).toContain('return appendLogicalRuleRegions(runtimeRegions);');
    });

    it('movement profile 下的兵种过滤与 committed stack 截取应由独立 owner 承接，selection/battle/support 不再各自复制 helper，index 也不再保留本地副本', () => {
        const battleRollMathSource = readBattleRollMathSource();
        const dispatchSelectionBuildersSource = readDispatchSelectionBuildersSource();
        const indexSource = readDomainIndexSource();
        const pendingBattleCombatSupportSource = readPendingBattleCombatSupportSource();
        const selectionBuildersSource = readSelectionBuildersSource();
        const movementProfileTroopSelectionSource = readFileSync(
            resolve(TEST_DIR, '..', 'domain', 'movementProfileTroopSelection.ts'),
            'utf8',
        );

        expect(selectionBuildersSource).not.toContain("} from './movementProfileTroopSelection';");
        expect(selectionBuildersSource).not.toContain('takeCommittedSpecialTroopStacks,');
        expect(dispatchSelectionBuildersSource).toContain("import { takeCommittedSpecialTroopStacks } from './movementProfileTroopSelection';");
        expect(dispatchSelectionBuildersSource).toContain('takeCommittedSpecialTroopStacks(actionSourceRegion, maxTroops)');
        expect(dispatchSelectionBuildersSource).not.toContain('const isTroopKindAllowedForMovementProfile = (');
        expect(dispatchSelectionBuildersSource).not.toContain('const takeCommittedSpecialTroopStacks = (');

        expect(battleRollMathSource).toContain("} from './movementProfileTroopSelection';");
        expect(battleRollMathSource).toContain('takeCommittedSpecialTroopStacks,');
        expect(battleRollMathSource).not.toContain('const isTroopKindAllowedForMovementProfile = (');
        expect(battleRollMathSource).not.toContain('const takeCommittedSpecialTroopStacks = (');

        expect(pendingBattleCombatSupportSource).toContain("} from './movementProfileTroopSelection';");
        expect(pendingBattleCombatSupportSource).toContain('takeCommittedSpecialTroopStacks,');
        expect(pendingBattleCombatSupportSource).not.toContain('const isTroopKindAllowedForMovementProfile = (');
        expect(pendingBattleCombatSupportSource).not.toContain('const takeCommittedSpecialTroopStacks = (');

        expect(indexSource).not.toContain("import { isTroopKindAllowedForMovementProfile } from './movementProfileTroopSelection';");
        expect(indexSource).not.toContain('const isTroopKindAllowedForMovementProfile = (');

        expect(movementProfileTroopSelectionSource).toContain("} from './troopCompat';");
        expect(movementProfileTroopSelectionSource).toContain('export const isTroopKindAllowedForMovementProfile = (');
        expect(movementProfileTroopSelectionSource).toContain('export const takeCommittedSpecialTroopStacks = (');
        expect(movementProfileTroopSelectionSource).toContain("movementProfileId === 'dispatch-cavalry'");
        expect(movementProfileTroopSelectionSource).toContain('sortCompatPiecesForSelection(');
    });

    it('轮盘执行编排应由 wheelMoveExecution owner 承接，directInputEventReducerBridge 只负责事件委托与依赖装配', () => {
        const directInputEventReducerBridgeSource = readDirectInputEventReducerBridgeSource();
        const directInputEventReducersSource = readDirectInputEventReducersSource();
        const indexSource = readDomainIndexSource();
        const seasonResolutionSource = readSeasonResolutionSource();
        const seasonResolutionDependenciesSource = readSeasonResolutionDependenciesSource();
        const turnActionDependenciesSource = readTurnActionDependenciesSource();
        const wheelImmediateEffectSource = readWheelImmediateEffectSource();
        const wheelMoveExecutionSource = readWheelMoveExecutionSource();
        const wheelRulesSource = readWheelRulesSource();
        const fortificationMaintenanceSource = readFortificationMaintenanceSource();

        expect(indexSource).not.toContain("import { reduceQidahenDirectInputEvent } from './directInputEventReducerBridge';");
        expect(indexSource).toContain("import { reduceQidahenDirectInputEvent } from './directInputEventReducers';");
        expect(indexSource).toContain('?? reduceQidahenDirectInputEvent(state, event)');
        expect(indexSource).not.toContain("} from './wheelMoveExecution';");
        expect(indexSource).not.toContain('resolveQidahenWheelMoveExecuted,');
        expect(indexSource).not.toContain('type QidahenWheelMoveExecutionDependencies,');
        expect(indexSource).not.toContain('const QIDAHEN_WHEEL_MOVE_EXECUTION_DEPENDENCIES: QidahenWheelMoveExecutionDependencies = {');
        expect(indexSource).not.toContain('return resolveQidahenWheelMoveExecuted(');
        expect(indexSource).not.toContain('const wheelSectorOrder = [');
        expect(indexSource).not.toContain('const advanceWheelPosition = (');
        expect(indexSource).not.toContain('const applyWheelImmediateEffect = (');
        expect(indexSource).not.toContain("text: '轮盘停在年中，已执行土地税赋与人物判定摘要。',");
        expect(indexSource).not.toContain("text: '轮盘停在新年，等待大明选择防线维护方式。',");
        expect(indexSource).not.toContain('const wheelDispatchSelection = buildWheelDispatchSelectionFromWheel(');

        expect(indexSource).not.toContain("case 'WHEEL_MOVE_EXECUTED':");
        expect(directInputEventReducerBridgeSource).toBe('');

        expect(wheelMoveExecutionSource).toContain("import { applyQidahenWheelImmediateEffect } from './wheelImmediateEffect';");
        expect(wheelMoveExecutionSource).toContain("import { buildSeasonSummary } from './seasonSummaryBuilder';");
        expect(wheelMoveExecutionSource).not.toContain('export interface QidahenWheelMoveExecutionDependencies {');
        expect(wheelMoveExecutionSource).toContain('interface QidahenWheelMoveExecutionDependencies {');
        expect(wheelMoveExecutionSource).not.toContain('export const QIDAHEN_WHEEL_MOVE_EXECUTION_DEPENDENCIES: QidahenWheelMoveExecutionDependencies = {');
        expect(wheelMoveExecutionSource).not.toContain('const QIDAHEN_WHEEL_MOVE_EXECUTION_DEPENDENCIES: QidahenWheelMoveExecutionDependencies = {');
        expect(wheelMoveExecutionSource).toContain('export const resolveQidahenWheelMoveExecuted = (');
        expect(wheelMoveExecutionSource).not.toContain('export const resolveQidahenWheelMoveExecutedEvent = (');
        expect(wheelMoveExecutionSource).toContain('dependencies: QidahenWheelMoveExecutionDependencies = {');
        expect(wheelMoveExecutionSource).toContain('const wheelSectorOrder = [');
        expect(wheelMoveExecutionSource).not.toContain('const advanceWheelPosition = (');
        expect(wheelMoveExecutionSource).toContain('const currentWheelPositionIndex = Math.max(0, wheelSectorOrder.indexOf(state.actionWheelPosition));');
        expect(wheelRulesSource).not.toContain('export type QidahenWheelPositionId =');
        expect(wheelRulesSource).toContain('type QidahenWheelPositionId =');
        expect(wheelMoveExecutionSource).toContain('const nextWheelPosition = wheelSectorOrder[');
        expect(wheelMoveExecutionSource).toContain('const midyearResolution = dependencies.resolveMidyear(nextState, timestamp);');
        expect(wheelMoveExecutionSource).toContain("lastSeasonSummary: dependencies.buildSeasonSummary('新年结算', timestamp, [");
        expect(wheelMoveExecutionSource).toContain('const diplomacySelection = buildDiplomacySelectionFromRegionSemantics(');
        expect(wheelMoveExecutionSource).toContain("getQidahenLockedRegionSelectionSemantics,");
        expect(wheelMoveExecutionSource).toContain('getQidahenLockedRegionSelectionSemantics(nextState)');
        expect(wheelMoveExecutionSource).toContain('const wheelDispatchSelection = buildWheelDispatchSelectionFromWheel(');
        expect(wheelMoveExecutionSource).toContain('const shouldPersistExplicitWheelDispatchSelection = shouldPersistExplicitWheelDispatchSelectionForWheelState(');
        expect(directInputEventReducersSource).toContain('resolveQidahenWheelMoveExecuted,');
        expect(directInputEventReducersSource).toContain('event.payload.moveId,');
        expect(directInputEventReducersSource).toContain('event.timestamp,');
        expect(wheelMoveExecutionSource).toContain('nextState = applyQidahenWheelImmediateEffect(');
        expect(wheelMoveExecutionSource).toContain('return dependencies.advanceTurnIfReady(');
        expect(wheelMoveExecutionSource).not.toContain('const resolveMidyear = (');
        expect(wheelMoveExecutionSource).not.toContain('const applyWheelImmediateEffect = (');
        expect(wheelMoveExecutionSource).not.toContain('applyWheelImmediateEffect: (');
        expect(wheelMoveExecutionSource).not.toContain('const advanceTurnIfReady = (');
        expect(turnActionDependenciesSource).toBe('');
        expect(seasonResolutionSource).not.toContain('const QIDAHEN_SEASON_RESOLUTION_DEPENDENCIES: QidahenSeasonResolutionDependencies = {');
        expect(seasonResolutionSource).not.toContain('export const QIDAHEN_SEASON_RESOLUTION_DEPENDENCIES: QidahenSeasonResolutionDependencies = {');
        expect(seasonResolutionSource).toContain('export const resolveQidahenMidyear = (');
        expect(seasonResolutionSource).not.toContain('export const resolveQidahenMidyearWithSeasonDependencies = (');
        expect(seasonResolutionDependenciesSource).toBe('');
        expect(wheelMoveExecutionSource).toContain("import { resolveQidahenMidyear } from './seasonResolution';");
        expect(wheelMoveExecutionSource).toContain('resolveMidyear: resolveQidahenMidyear,');
        expect(wheelMoveExecutionSource).not.toContain("import { resolveQidahenMidyearWithSeasonDependencies } from './seasonResolution';");
        expect(fortificationMaintenanceSource).toContain("import {");
        expect(fortificationMaintenanceSource).toContain('    resolveQidahenNewYear,');
        expect(fortificationMaintenanceSource).toContain('resolveNewYear: resolveQidahenNewYear,');
        expect(fortificationMaintenanceSource).not.toContain('resolveQidahenNewYearWithSeasonDependencies');

        expect(wheelImmediateEffectSource).toContain("} from './handCardState';");
        expect(wheelImmediateEffectSource).toContain("} from './regionSelectionPreferences';");
        expect(wheelImmediateEffectSource).toContain("import { refreshRuntimeRegionRules } from './runtimeRegionRules';");
        expect(wheelImmediateEffectSource).toContain("import { buildSeasonSummary } from './seasonSummaryBuilder';");
        expect(wheelImmediateEffectSource).toContain("import { getQidahenWheelImmediateEffectConfig } from './wheelRules';");
        expect(wheelRulesSource).not.toContain('export const QIDAHEN_WHEEL_IMMEDIATE_EFFECT_CONFIGS: QidahenWheelImmediateEffectConfig[] = [');
        expect(wheelRulesSource).toContain('const QIDAHEN_WHEEL_IMMEDIATE_EFFECT_CONFIGS: QidahenWheelImmediateEffectConfig[] = [');
        expect(wheelRulesSource).toContain('export const getQidahenWheelImmediateEffectConfig = (');
        expect(wheelImmediateEffectSource).toContain('export const applyQidahenWheelImmediateEffect = (');
        expect(wheelImmediateEffectSource).toContain('const drawCards = Math.max(0, Math.min(config.drawCards, getFactionDrawPileCount(state, factionId)));');
        expect(wheelImmediateEffectSource).toContain("const artilleryTraining = config.id === 'wheel-recruit-train'");
        expect(wheelImmediateEffectSource).toContain('lastSeasonSummary: buildSeasonSummary(config.summaryTitle, timestamp, summaryLines),');
    });

    it('回合标签收口应由 turnLabelState owner 承接，directInputEventReducerBridge 不应把 turn label 本体回退进 index', () => {
        const directInputEventReducerBridgeSource = readDirectInputEventReducerBridgeSource();
        const directInputEventReducersSource = readDirectInputEventReducersSource();
        const indexSource = readDomainIndexSource();
        const fortificationMaintenanceSource = readFortificationMaintenanceSource();
        const handLimitDiscardSource = readHandLimitDiscardSource();
        const selectionInputStateSource = readSelectionInputStateSource();
        const turnActionChoiceOrchestrationSource = readTurnActionChoiceOrchestrationSource();
        const turnActionDependenciesSource = readTurnActionDependenciesSource();
        const characterActionWindowSource = readCharacterActionWindowSource();
        const turnFlowOrchestrationSource = readTurnFlowOrchestrationSource();
        const turnLabelStateSource = readTurnLabelStateSource();

        expect(indexSource).not.toContain("} from './turnFlowOrchestration';");
        expect(indexSource).toContain("} from './specialRuleState';");
        expect(indexSource).not.toContain("import { reduceQidahenDirectInputEvent } from './directInputEventReducerBridge';");
        expect(indexSource).not.toContain("} from './selectionInputState';");
        expect(indexSource).not.toContain("} from './seasonResolutionDependencies';");
        expect(indexSource).not.toContain("} from './handLimitDiscard';");
        expect(indexSource).not.toContain("} from './fortificationMaintenance';");
        expect(indexSource).not.toContain('resolveQidahenFortificationMaintenanceInteractionChoice as resolveQidahenFortificationMaintenanceInteractionChoiceWithDependencies,');
        expect(indexSource).not.toContain('resolveQidahenHandLimitDiscardInteractionChoice as resolveQidahenHandLimitDiscardInteractionChoiceWithDependencies,');
        expect(indexSource).not.toContain('resolveQidahenFortificationMaintenanceInteractionChoice');
        expect(indexSource).not.toContain('resolveQidahenHandLimitDiscardInteractionChoice');
        expect(indexSource).not.toContain('type QidahenSelectionInputStateDependencies,');
        expect(indexSource).not.toContain('export type { QidahenCasualtyPriority, QidahenCommand,');
        expect(indexSource).not.toContain('export type { QidahenCommand,');
        expect(indexSource).not.toContain('export type { QidahenEvent');
        expect(indexSource).not.toContain('type QidahenFortificationMaintenanceDependencies,');
        expect(indexSource).not.toContain('type QidahenHandLimitDiscardDependencies,');
        expect(indexSource).not.toContain('const QIDAHEN_FORTIFICATION_MAINTENANCE_DEPENDENCIES: QidahenFortificationMaintenanceDependencies = {');
        expect(indexSource).not.toContain('const QIDAHEN_HAND_LIMIT_DISCARD_DEPENDENCIES: QidahenHandLimitDiscardDependencies = {');
        expect(indexSource).not.toContain('const QIDAHEN_SELECTION_INPUT_STATE_DEPENDENCIES: QidahenSelectionInputStateDependencies = {');
        expect(indexSource).not.toContain('resolveQidahenFortificationMaintenanceInteractionChoiceWithDependencies(');
        expect(indexSource).not.toContain('resolveQidahenHandLimitDiscardInteractionChoiceWithDependencies(');
        expect(indexSource).not.toContain("event.type === 'HAND_LIMIT_DISCARD_RESOLVED'");
        expect(indexSource).not.toContain('reduceQidahenSelectionInputEvent(');
        expect(indexSource).not.toContain('QIDAHEN_SELECTION_INPUT_STATE_DEPENDENCIES,');
        expect(indexSource).not.toContain("} from './turnLabelState';");
        expect(indexSource).not.toContain('updateQidahenTurnLabel,');
        expect(indexSource).not.toContain('type QidahenTurnLabelDependencies,');
        expect(indexSource).not.toContain('const QIDAHEN_TURN_LABEL_DEPENDENCIES: QidahenTurnLabelDependencies = {');
        expect(indexSource).not.toContain('const QIDAHEN_CHARACTER_ACTION_WINDOW_DEPENDENCIES: QidahenCharacterActionWindowDependencies = {');
        expect(indexSource).not.toContain('const updateTurnLabel = (state: QidahenCore): QidahenCore => (');
        expect(indexSource).not.toContain('updateQidahenTurnLabel(state, QIDAHEN_TURN_LABEL_DEPENDENCIES)');
        expect(indexSource).not.toContain('applyQidahenCharacterActionWindowEffectsWithFocus(state, QIDAHEN_CHARACTER_ACTION_WINDOW_DEPENDENCIES)');
        expect(indexSource).not.toContain('const selection = state.handLimitDiscardSelection;');
        expect(indexSource).not.toContain('id: `log-hand-limit-resolved-${timestamp}`');
        expect(indexSource).not.toContain('const newYearResolution = resolveNewYear(');
        expect(indexSource).not.toContain('id: `log-new-year-${timestamp}`');
        expect(indexSource).not.toContain('syncCorePieceCollections(applyCharacterActionWindowEffects(state))');
        expect(indexSource).not.toContain('!isFactionActionTurnComplete(nextState, currentFactionId) && nextState.factionActionUsed,');

        expect(indexSource).not.toContain("} from './turnActionChoiceOrchestration';");
        expect(directInputEventReducerBridgeSource).toBe('');
        expect(directInputEventReducersSource).toContain("'HAND_LIMIT_DISCARD_RESOLVED'");
        expect(turnActionDependenciesSource).toBe('');
        expect(turnActionChoiceOrchestrationSource).toBe('');

        expect(fortificationMaintenanceSource).not.toContain('export interface QidahenFortificationMaintenanceDependencies {');
        expect(fortificationMaintenanceSource).toContain('interface QidahenFortificationMaintenanceDependencies {');
        expect(fortificationMaintenanceSource).not.toContain('export const QIDAHEN_FORTIFICATION_MAINTENANCE_DEPENDENCIES: QidahenFortificationMaintenanceDependencies = {');
        expect(fortificationMaintenanceSource).toContain('resolveNewYear: (');
        expect(fortificationMaintenanceSource).toContain('syncCorePieceCollections: (');
        expect(fortificationMaintenanceSource).toContain('applyVictoryStatus: (');
        expect(fortificationMaintenanceSource).toContain('advanceTurnIfReady: (');
        expect(fortificationMaintenanceSource).toContain('resolveQidahenFortificationMaintenanceInteractionChoice');
        expect(fortificationMaintenanceSource).not.toContain('resolveQidahenFortificationMaintenanceInteractionChoiceWithDependencies');
        expect(fortificationMaintenanceSource).not.toContain('const QIDAHEN_FORTIFICATION_MAINTENANCE_DEPENDENCIES: QidahenFortificationMaintenanceDependencies = {');
        expect(fortificationMaintenanceSource).toContain('dependencies: QidahenFortificationMaintenanceDependencies = {');
        expect(fortificationMaintenanceSource).toContain('getQidahenInteractionSelectionStateForCore,');
        expect(fortificationMaintenanceSource).toContain('const selection = getQidahenInteractionSelectionStateForCore(');
        expect(fortificationMaintenanceSource).toContain('const newYearResolution = dependencies.resolveNewYear(');
        expect(fortificationMaintenanceSource).not.toContain("QIDAHEN_SEASON_RESOLUTION_DEPENDENCIES,");
        expect(fortificationMaintenanceSource).toContain('id: `log-new-year-${timestamp}`');
        expect(fortificationMaintenanceSource).toContain('return dependencies.advanceTurnIfReady(');

        expect(handLimitDiscardSource).not.toContain('export interface QidahenHandLimitDiscardDependencies {');
        expect(handLimitDiscardSource).toContain('interface QidahenHandLimitDiscardDependencies {');
        expect(handLimitDiscardSource).not.toContain('export const QIDAHEN_HAND_LIMIT_DISCARD_DEPENDENCIES: QidahenHandLimitDiscardDependencies = {');
        expect(handLimitDiscardSource).toContain('updateTurnLabel: (');
        expect(handLimitDiscardSource).toContain('export const resolveQidahenHandLimitDiscard = (');
        expect(handLimitDiscardSource).toContain('export const resolveQidahenHandLimitDiscardInteractionChoice = (');
        expect(handLimitDiscardSource).not.toContain('export const resolveQidahenHandLimitDiscardInteractionChoiceWithDependencies = (');
        expect(handLimitDiscardSource).not.toContain('const QIDAHEN_HAND_LIMIT_DISCARD_DEPENDENCIES: QidahenHandLimitDiscardDependencies = {');
        expect(handLimitDiscardSource).toContain('dependencies: QidahenHandLimitDiscardDependencies = {');
        expect(handLimitDiscardSource).toContain('const selection = state.handLimitDiscardSelection;');
        expect(handLimitDiscardSource).toContain('id: `log-hand-limit-resolved-${timestamp}`');
        expect(handLimitDiscardSource).toContain('return dependencies.updateTurnLabel({');
        expect(handLimitDiscardSource).toContain('}, timestamp, dependencies);');

        expect(selectionInputStateSource).not.toContain('export type QidahenSelectionInputStateDependencies = QidahenHandLimitDiscardDependencies;');
        expect(selectionInputStateSource).toContain('interface QidahenSelectionInputStateDependencies {');
        expect(selectionInputStateSource).not.toContain('const QIDAHEN_SELECTION_INPUT_STATE_DEPENDENCIES: QidahenSelectionInputStateDependencies = {');
        expect(selectionInputStateSource).toContain('export const reduceQidahenSelectionInputEvent = (');
        expect(selectionInputStateSource).toContain('dependencies: QidahenSelectionInputStateDependencies = {');
        expect(selectionInputStateSource).toContain("case 'HAND_LIMIT_DISCARD_RESOLVED':");
        expect(selectionInputStateSource).toContain('return resolveQidahenHandLimitDiscard(state, event.timestamp, dependencies);');

        const characterActionWindowDependenciesSource = readCharacterActionWindowDependenciesSource();

        expect(turnFlowOrchestrationSource).toBe('');
        expect(characterActionWindowDependenciesSource).toBe('');
        expect(characterActionWindowSource).not.toContain('function applyQidahenCharacterActionWindowEffectsForTurnFlow(state: QidahenCore): QidahenCore {');
        expect(characterActionWindowSource).not.toContain('export function applyQidahenCharacterActionWindowEffectsWithFocusForTurnFlow(');
        expect(characterActionWindowSource).toContain('applyQidahenCharacterActionWindowEffectsWithFocus(state, dependencies).state');
        expect(characterActionWindowSource).toContain('dependencies: QidahenCharacterActionWindowDependencies = {');
        expect(characterActionWindowSource).not.toContain('export const QIDAHEN_CHARACTER_ACTION_WINDOW_DEPENDENCIES: QidahenCharacterActionWindowDependencies = {');
        expect(characterActionWindowSource).not.toContain('const QIDAHEN_CHARACTER_ACTION_WINDOW_DEPENDENCIES: QidahenCharacterActionWindowDependencies = {');
        expect(turnLabelStateSource).not.toContain('export const QIDAHEN_TURN_LABEL_DEPENDENCIES: QidahenTurnLabelDependencies = {');
        expect(turnLabelStateSource).not.toContain('const QIDAHEN_TURN_LABEL_DEPENDENCIES: QidahenTurnLabelDependencies = {');
        expect(turnLabelStateSource).not.toContain("import { applyQidahenCharacterActionWindowEffectsForTurnFlow } from './characterActionWindow';");
        expect(turnLabelStateSource).toContain("import { applyQidahenCharacterActionWindowEffects } from './characterActionWindow';");
        expect(turnLabelStateSource).not.toContain("import { applyQidahenCharacterActionWindowEffectsWithFocus } from './characterActionWindow';");
        expect(turnLabelStateSource).not.toContain('export function updateQidahenTurnLabelForTurnFlow(state: QidahenCore): QidahenCore {');
        expect(turnLabelStateSource).toContain('dependencies: QidahenTurnLabelDependencies = {');
        expect(turnLabelStateSource).toContain("} from './factionActionWindow';");
        expect(turnLabelStateSource).toContain("} from './factionTurnAccessors';");
        expect(turnLabelStateSource).not.toContain('export interface QidahenTurnLabelDependencies {');
        expect(turnLabelStateSource).toContain('interface QidahenTurnLabelDependencies {');
        expect(turnLabelStateSource).toContain('applyCharacterActionWindowEffects: (');
        expect(turnLabelStateSource).toContain('syncCorePieceCollections: (');
        expect(turnLabelStateSource).toContain('syncCurrentCoreSelections: (');
        expect(turnLabelStateSource).toContain('export function updateQidahenTurnLabel(');
        expect(turnLabelStateSource).toContain('applyCharacterActionWindowEffects: applyQidahenCharacterActionWindowEffects,');
        expect(turnLabelStateSource).toContain('const nextState = dependencies.syncCurrentCoreSelections(');
        expect(turnLabelStateSource).toContain('const currentFactionId = getCurrentFactionId(nextState);');
        expect(turnLabelStateSource).toContain('turnLabel: buildTurnLabel(');
        expect(turnLabelStateSource).toContain('!isFactionActionTurnComplete(nextState, currentFactionId) && nextState.factionActionUsed,');
    });

    it('character action window 收口应由 characterActionWindow owner 承接，index 不再本地维护自动人物效果状态机', () => {
        const indexSource = readDomainIndexSource();
        const characterActionWindowSource = readCharacterActionWindowSource();
        const characterActionWindowDependenciesSource = readCharacterActionWindowDependenciesSource();
        const turnFlowOrchestrationSource = readTurnFlowOrchestrationSource();

        expect(indexSource).not.toContain("} from './characterActionWindow';");
        expect(indexSource).not.toContain('applyQidahenCharacterActionWindowEffects,');
        expect(indexSource).not.toContain('applyQidahenCharacterActionWindowEffectsWithFocus,');
        expect(indexSource).not.toContain('type QidahenCharacterActionWindowDependencies,');
        expect(indexSource).not.toContain('const QIDAHEN_CHARACTER_ACTION_WINDOW_DEPENDENCIES: QidahenCharacterActionWindowDependencies = {');
        expect(indexSource).not.toContain('applyQidahenCharacterActionWindowEffectsWithFocus(state, QIDAHEN_CHARACTER_ACTION_WINDOW_DEPENDENCIES)');
        expect(indexSource).not.toContain('applyQidahenCharacterActionWindowEffects(state, QIDAHEN_CHARACTER_ACTION_WINDOW_DEPENDENCIES)');
        expect(indexSource).not.toContain('const buildCharacterActionWindowTriggerKey = (');
        expect(indexSource).not.toContain('const parseCharacterActionWindowHandledEffectIds = (');
        expect(indexSource).not.toContain('const findLindanHutuktuInfluenceTarget = (');
        expect(turnFlowOrchestrationSource).toBe('');
        expect(characterActionWindowDependenciesSource).toBe('');
        expect(characterActionWindowSource).not.toContain('function applyQidahenCharacterActionWindowEffectsForTurnFlow(state: QidahenCore): QidahenCore {');
        expect(characterActionWindowSource).toContain('export const applyQidahenCharacterActionWindowEffectsWithFocus = (');
        expect(characterActionWindowSource).toContain('export function applyQidahenCharacterActionWindowEffects(');
        expect(characterActionWindowSource).not.toContain('export function applyQidahenCharacterActionWindowEffectsWithFocusForTurnFlow(');
        expect(characterActionWindowSource).not.toContain('export const QIDAHEN_CHARACTER_ACTION_WINDOW_DEPENDENCIES: QidahenCharacterActionWindowDependencies = {');
        expect(characterActionWindowSource).not.toContain('const QIDAHEN_CHARACTER_ACTION_WINDOW_DEPENDENCIES: QidahenCharacterActionWindowDependencies = {');

        expect(characterActionWindowSource).toContain("import { getNonSiegedCityActionSourceSnapshot } from './actionSourceRegionState';");
        expect(characterActionWindowSource).toContain("import { getCurrentFactionId } from './factionTurnAccessors';");
        expect(characterActionWindowSource).toContain("import { resolveQidahenPrimaryRuntimeRegionId } from './regionConfig';");
        expect(characterActionWindowSource).toContain("import { canPlaceRegularTroopsInRegion } from './regionSelectionPreferences';");
        expect(characterActionWindowSource).toContain("} from './dispatchSelectionBuilders';");
        expect(characterActionWindowSource).toContain('buildWangHuazhenInternalDispatchSelectionFromRegionSemantics,');
        expect(characterActionWindowSource).toContain("} from './troopCompat';");
        expect(characterActionWindowSource).toContain("} from './troopTraining';");
        expect(characterActionWindowSource).not.toContain('export interface QidahenCharacterActionWindowDependencies {');
        expect(characterActionWindowSource).toContain('interface QidahenCharacterActionWindowDependencies {');
        expect(characterActionWindowSource).not.toContain('const buildCharacterActionWindowTriggerKey = (');
        expect(characterActionWindowSource).not.toContain('const buildCharacterActionWindowProgressKey = (');
        expect(characterActionWindowSource).not.toContain('const parseCharacterActionWindowHandledEffectIds = (');
        expect(characterActionWindowSource).toContain('const findLindanHutuktuInfluenceTarget = (');
        expect(characterActionWindowSource).toContain('export const applyQidahenCharacterActionWindowEffectsWithFocus = (');
        expect(characterActionWindowSource).toContain('export function applyQidahenCharacterActionWindowEffects(');
        expect(characterActionWindowSource).toContain("const DONGJIANG_RUNTIME_REGION_ID = 'city-region-22';");
        expect(characterActionWindowSource).toContain('const triggerKey = `${state.currentPlayer}:${state.roundNumber}:${Number(state.wheelActionUsed)}:${Number(state.factionActionUsed)}`;');
        expect(characterActionWindowSource).toContain("const handledEffectIds = !progressKey?.startsWith(`${triggerKey}|`)");
        expect(characterActionWindowSource).toContain("lastCharacterActionWindowTriggerKey: `${triggerKey}|${[...handledEffectIds].sort().join(',')}`,");
    });

    it('人物年代冲突 helper 应由 characterConflictState owner 承接，index 与 characterActionWindow 只保留消费接线', () => {
        const characterActionWindowSource = readCharacterActionWindowSource();
        const characterActionWindowDependenciesSource = readCharacterActionWindowDependenciesSource();
        const conflictSource = readCharacterConflictStateSource();
        const indexSource = readDomainIndexSource();

        expect(indexSource).not.toContain("} from './characterConflictState';");
        expect(indexSource).not.toContain('const JIN_BEILE_CHARACTER_IDS = new Set([');
        expect(indexSource).not.toContain('const resolveMingCharacterConflict = (');
        expect(indexSource).not.toContain('const resolveNurhaciRemovedByYuanChonghuan = (');
        expect(indexSource).not.toContain('const resolveJinHuangtaijiConflict = (');
        expect(indexSource).not.toContain('const resolveJinDaisanConflict = (');
        expect(characterActionWindowDependenciesSource).toBe('');
        expect(characterActionWindowSource).toContain("} from './characterConflictState';");
        expect(characterActionWindowSource).toContain('resolveMingCharacterConflict,');
        expect(characterActionWindowSource).toContain('resolveNurhaciRemovedByYuanChonghuan,');
        expect(characterActionWindowSource).toContain('resolveJinHuangtaijiConflict,');
        expect(characterActionWindowSource).toContain('resolveJinDaisanConflict,');

        expect(characterActionWindowSource).toContain("from './characterConflictState';");
        expect(characterActionWindowSource).toContain('resolveMingCharacterConflict: typeof resolveMingCharacterConflict;');
        expect(characterActionWindowSource).toContain('resolveNurhaciRemovedByYuanChonghuan: typeof resolveNurhaciRemovedByYuanChonghuan;');
        expect(characterActionWindowSource).toContain('resolveJinHuangtaijiConflict: typeof resolveJinHuangtaijiConflict;');
        expect(characterActionWindowSource).toContain('resolveJinDaisanConflict: typeof resolveJinDaisanConflict;');

        expect(conflictSource).toContain("const JIN_BEILE_CHARACTER_IDS = new Set([");
        expect(conflictSource).toContain('export const resolveMingCharacterConflict = (');
        expect(conflictSource).toContain('export const resolveNurhaciRemovedByYuanChonghuan = (');
        expect(conflictSource).toContain('export const resolveJinHuangtaijiConflict = (');
        expect(conflictSource).toContain('export const resolveJinDaisanConflict = (');
    });

    it('纪年人物启用主流程应由 characterChronologyState owner 承接，index 只保留配置与种子依赖装配', () => {
        const chronologySource = readCharacterChronologyStateSource();
        const conflictSource = readCharacterConflictStateSource();
        const indexSource = readDomainIndexSource();
        const seasonResolutionSource = readSeasonResolutionSource();
        const seasonResolutionDependenciesSource = readSeasonResolutionDependenciesSource();
        const turnActionDependenciesSource = readTurnActionDependenciesSource();

        expect(indexSource).not.toContain("} from './characterChronologyState';");
        expect(indexSource).not.toContain('applyChronologyCharactersForYear,');
        expect(indexSource).not.toContain('type QidahenCharacterChronologyStateDependencies,');
        expect(indexSource).not.toContain('const QIDAHEN_CHARACTER_CHRONOLOGY_STATE_DEPENDENCIES: QidahenCharacterChronologyStateDependencies = {');
        expect(turnActionDependenciesSource).toBe('');
        expect(seasonResolutionSource).toContain("} from './characterChronologyState';");
        expect(seasonResolutionSource).toContain('applyChronologyCharactersForYear,');
        expect(seasonResolutionSource).not.toContain('type QidahenCharacterChronologyStateDependencies,');
        expect(seasonResolutionSource).not.toContain('const QIDAHEN_CHARACTER_CHRONOLOGY_STATE_DEPENDENCIES: QidahenCharacterChronologyStateDependencies = {');
        expect(seasonResolutionSource).not.toContain('getChronologyCharacterAvailabilityForYear,');
        expect(seasonResolutionSource).not.toContain('createInitialCharacterStates,');
        expect(seasonResolutionSource).not.toContain('QIDAHEN_CHARACTER_CHRONOLOGY_STATE_DEPENDENCIES,');
        expect(seasonResolutionDependenciesSource).toBe('');
        expect(indexSource).not.toContain('const selectChronologyRepresentativeCharacterIds = (');
        expect(indexSource).not.toContain('const applyChronologyCharactersForYear = (');

        expect(chronologySource).toContain("from './characterConflictState';");
        expect(chronologySource).not.toContain('export interface QidahenCharacterChronologyStateDependencies {');
        expect(chronologySource).toContain('interface QidahenCharacterChronologyStateDependencies {');
        expect(chronologySource).toContain("from './characterCatalogState';");
        expect(chronologySource).toContain("from './characterChronologyConfig';");
        expect(chronologySource).not.toContain('const QIDAHEN_CHARACTER_CHRONOLOGY_STATE_DEPENDENCIES: QidahenCharacterChronologyStateDependencies = {');
        expect(chronologySource).toContain('getChronologyCharacterAvailabilityForYear: (');
        expect(chronologySource).toContain('createInitialCharacterStates: (');
        expect(chronologySource).toContain('getCharacterNameById: (');
        expect(chronologySource).toContain('const selectChronologyRepresentativeCharacterIds = (');
        expect(chronologySource).toContain('export const applyChronologyCharactersForYear = (');
        expect(chronologySource).toContain('dependencies: QidahenCharacterChronologyStateDependencies = {');
        expect(chronologySource).toContain('resolveMingCharacterConflict(nextFactions);');
        expect(chronologySource).toContain('resolveNurhaciRemovedByYuanChonghuan(nextFactions);');
        expect(chronologySource).toContain('resolveJinHuangtaijiConflict(nextFactions);');
        expect(chronologySource).toContain('resolveJinDaisanConflict(nextFactions);');
        expect(chronologySource).not.toContain('resolveMingCharacterConflict: typeof resolveMingCharacterConflict;');
        expect(chronologySource).not.toContain('resolveNurhaciRemovedByYuanChonghuan: typeof resolveNurhaciRemovedByYuanChonghuan;');
        expect(chronologySource).not.toContain('resolveJinHuangtaijiConflict: typeof resolveJinHuangtaijiConflict;');
        expect(chronologySource).not.toContain('resolveJinDaisanConflict: typeof resolveJinDaisanConflict;');

        expect(conflictSource).toContain('export const resolveMingCharacterConflict = (');
        expect(conflictSource).toContain('export const resolveNurhaciRemovedByYuanChonghuan = (');
    });

    it('纪年配置 truth 应由 characterChronologyConfig owner 承接，index 与 chronology state 只保留消费接线', () => {
        const chronologyConfigSource = readCharacterChronologyConfigSource();
        const chronologySource = readCharacterChronologyStateSource();
        const indexSource = readDomainIndexSource();
        const seasonResolutionSource = readSeasonResolutionSource();
        const seasonResolutionDependenciesSource = readSeasonResolutionDependenciesSource();
        const turnActionDependenciesSource = readTurnActionDependenciesSource();

        expect(indexSource).not.toContain("} from './characterChronologyConfig';");
        expect(indexSource).not.toContain('getChronologyCharacterAvailabilityForYear,');
        expect(turnActionDependenciesSource).toBe('');
        expect(seasonResolutionSource).toContain("} from './characterChronologyConfig';");
        expect(seasonResolutionSource).not.toContain('getChronologyCharacterAvailabilityForYear,');
        expect(seasonResolutionDependenciesSource).toBe('');
        expect(indexSource).not.toContain('type QidahenChronologyYearConfig = {');
        expect(indexSource).not.toContain('type QidahenChronologyCharacterAvailability =');
        expect(indexSource).not.toContain('const YEAR_SEQUENCE = [');
        expect(indexSource).not.toContain('const QIDAHEN_CHRONOLOGY_YEAR_CONFIGS: QidahenChronologyYearConfig[] = [');
        expect(indexSource).not.toContain('const getChronologyYearConfig = (');
        expect(indexSource).not.toContain('const buildYearCardSlots = (');
        expect(indexSource).not.toContain('const getChronologyPreviewIndex = (');
        expect(indexSource).not.toContain('const getFactionOrderForYearIndex = (');
        expect(indexSource).not.toContain('const getChronologyCharacterAvailabilityForYear = (');
        expect(indexSource).not.toContain('const getYearLabelByIndex = (');
        expect(seasonResolutionSource).toContain("} from './characterChronologyConfig';");
        expect(seasonResolutionSource).toContain('buildYearCardSlots,');
        expect(seasonResolutionSource).toContain('getFactionOrderForYearIndex,');
        expect(seasonResolutionSource).toContain('getQidahenMaxChronologyYearIndex,');
        expect(seasonResolutionSource).toContain('getYearLabelByIndex,');
        expect(seasonResolutionSource).not.toContain('QIDAHEN_YEAR_SEQUENCE,');
        expect(seasonResolutionSource).toContain('getQidahenMaxChronologyYearIndex()');

        expect(chronologyConfigSource).toContain("import { filterFactionOrderForScenario } from './factionTurnOrder';");
        expect(chronologyConfigSource).toContain("import type { QidahenCore, QidahenFactionId, QidahenScenarioId } from './types';");
        expect(chronologyConfigSource).not.toContain('export interface QidahenChronologyYearConfig {');
        expect(chronologyConfigSource).toContain('interface QidahenChronologyYearConfig {');
        expect(chronologyConfigSource).not.toContain('export type QidahenChronologyCharacterAvailability =');
        expect(chronologyConfigSource).toContain('type QidahenChronologyCharacterAvailability =');
        expect(chronologyConfigSource).not.toContain('export const QIDAHEN_YEAR_SEQUENCE = [');
        expect(chronologyConfigSource).toContain('const QIDAHEN_YEAR_SEQUENCE = [');
        expect(chronologyConfigSource).not.toContain('export const QIDAHEN_CHRONOLOGY_YEAR_CONFIGS: QidahenChronologyYearConfig[] = [');
        expect(chronologyConfigSource).toContain('const QIDAHEN_CHRONOLOGY_YEAR_CONFIGS: QidahenChronologyYearConfig[] = [');
        expect(chronologyConfigSource).toContain('const getChronologyYearConfig = (yearIndex: number): QidahenChronologyYearConfig => (');
        expect(chronologyConfigSource).toContain('export const getQidahenMaxChronologyYearIndex = (): number => (');
        expect(chronologyConfigSource).toContain('export const getYearLabelByIndex = (yearIndex: number): string => (');
        expect(chronologyConfigSource).toContain('export const buildYearCardSlots = (yearIndex: number): QidahenCore[\'yearCards\'] => [');
        expect(chronologyConfigSource).not.toContain('export const getChronologyPreviewIndex = (');
        expect(chronologyConfigSource).toContain("previewRef: qidahenChronologyPreview(getChronologyYearConfig(yearIndex).previewIndex)");
        expect(chronologyConfigSource).toContain("previewRef: qidahenChronologyPreview(getChronologyYearConfig(yearIndex + 1).previewIndex)");
        expect(chronologyConfigSource).toContain('export const getFactionOrderForYearIndex = (');
        expect(chronologyConfigSource).toContain('filterFactionOrderForScenario(scenarioId, getChronologyYearConfig(yearIndex).factionOrder)');
        expect(chronologyConfigSource).toContain('export const getChronologyCharacterAvailabilityForYear = (');

        expect(chronologySource).not.toContain("import type { QidahenChronologyCharacterAvailability } from './characterChronologyConfig';");
        expect(chronologySource).toContain('type QidahenChronologyCharacterAvailability = ReturnType<typeof getChronologyCharacterAvailabilityForYear>;');
    });

    it('人物种子与名字读取应由 characterCatalogState owner 承接，index 与 chronology/scenario 只保留消费接线', () => {
        const catalogSource = readCharacterCatalogStateSource();
        const chronologySource = readCharacterChronologyStateSource();
        const indexSource = readDomainIndexSource();
        const scenarioChoiceStateSource = readScenarioChoiceStateSource();
        const seasonResolutionSource = readSeasonResolutionSource();
        const seasonResolutionDependenciesSource = readSeasonResolutionDependenciesSource();
        const turnActionDependenciesSource = readTurnActionDependenciesSource();

        expect(indexSource).not.toContain("} from './characterCatalogState';");
        expect(indexSource).not.toContain('createInitialCharacterStates,');
        expect(indexSource).not.toContain('getCharacterNameById,');
        expect(turnActionDependenciesSource).toBe('');
        expect(seasonResolutionSource).not.toContain("} from './characterCatalogState';");
        expect(seasonResolutionSource).not.toContain('createInitialCharacterStates,');
        expect(seasonResolutionSource).not.toContain('getCharacterNameById,');
        expect(seasonResolutionDependenciesSource).toBe('');
        expect(indexSource).not.toContain('type InitialCharacterSeed = {');
        expect(indexSource).not.toContain('const initialCharacterSeedsByFaction: Record<QidahenFactionId, InitialCharacterSeed[]> = {');
        expect(indexSource).not.toContain('const createInitialCharacterStates = (');
        expect(indexSource).not.toContain('const getCharacterNameById = (');

        expect(catalogSource).toContain("import type { QidahenCharacterState, QidahenFactionId } from './types';");
        expect(catalogSource).toContain('type InitialCharacterSeed = {');
        expect(catalogSource).toContain("const factionOrder: QidahenFactionId[] = ['ming', 'mongol', 'jin'];");
        expect(catalogSource).toContain('const initialCharacterSeedsByFaction: Record<QidahenFactionId, InitialCharacterSeed[]> = {');
        expect(catalogSource).toContain('export const createInitialCharacterStates = (');
        expect(catalogSource).toContain('export const getCharacterNameById = (');

        expect(chronologySource).toContain('createInitialCharacterStates: (');
        expect(chronologySource).toContain('getCharacterNameById: (');
        expect(scenarioChoiceStateSource).toContain('getCharacterNameById: (');
    });

    it('军备目录与初始军备 truth 应由 armamentCatalogState owner 承接，index 与 scenario 只保留消费接线', () => {
        const armamentCatalogSource = readArmamentCatalogStateSource();
        const initialCoreSeedsSource = readInitialCoreSeedsSource();
        const indexSource = readDomainIndexSource();
        const scenarioChoiceOrchestrationSource = readScenarioChoiceOrchestrationSource();
        const scenarioChoiceStateDependenciesSource = readScenarioChoiceStateDependenciesSource();
        const scenarioChoiceStateSource = readScenarioChoiceStateSource();

        expect(indexSource).not.toContain("} from './armamentCatalogState';");
        expect(indexSource).not.toContain("const qidahenArmamentCatalog: readonly Pick<QidahenArmamentState, 'id' | 'name'>[] = [");
        expect(indexSource).not.toContain('const initialArmamentLevelsByFaction: Record<QidahenFactionId, Partial<Record<QidahenArmamentId, number>>> = {');
        expect(indexSource).not.toContain('const createInitialArmamentStates = (');
        expect(indexSource).not.toContain('const getArmamentNameById = (');
        expect(scenarioChoiceOrchestrationSource).not.toContain("} from './armamentCatalogState';");
        expect(scenarioChoiceStateDependenciesSource).toBe('');

        expect(armamentCatalogSource).toContain("import type { QidahenArmamentId, QidahenArmamentState, QidahenFactionId } from './types';");
        expect(armamentCatalogSource).toContain("const qidahenArmamentCatalog: readonly Pick<QidahenArmamentState, 'id' | 'name'>[] = [");
        expect(armamentCatalogSource).toContain('const initialArmamentLevelsByFaction: Record<QidahenFactionId, Partial<Record<QidahenArmamentId, number>>> = {');
        expect(armamentCatalogSource).toContain('export const createInitialArmamentStates = (');
        expect(armamentCatalogSource).toContain('export const getArmamentNameById = (');

        expect(initialCoreSeedsSource).toContain('armaments: createInitialArmamentStates(id),');
        expect(scenarioChoiceStateSource).toContain('getArmamentNameById: (');
    });

    it('初始核心 setup 装配应由 initialCoreSetup owner 承接，initialCoreSeeds 与 chronology config 只保留各自真相', () => {
        const actionWindowEntryStateSource = readActionWindowEntryStateSource();
        const chronologyConfigSource = readCharacterChronologyConfigSource();
        const indexSource = readDomainIndexSource();
        const initialCoreSeedsSource = readInitialCoreSeedsSource();
        const initialCoreSetupSource = readInitialCoreSetupSource();
        const scenarioRuntimeRegionPresetsSource = readScenarioRuntimeRegionPresetsSource();

        expect(indexSource).toContain('createInitialCore,');
        expect(indexSource).toContain("} from './initialCoreSetup';");
        expect(indexSource).not.toContain('createQidahenCoreForScenario,');
        expect(indexSource).not.toContain('createQidahenCoreForScenarioWithSelections,');
        expect(indexSource).not.toContain('const getScenarioPlayerIdsByFaction = (');
        expect(indexSource).not.toContain('const createFactionState = (');
        expect(indexSource).not.toContain('const createInitialFortifications = (): QidahenFortificationState[] => (');
        expect(indexSource).not.toContain('const createRuntimeRegionSummaries = () => (');
        expect(indexSource).not.toContain('const buildInitialHandCards = (');
        expect(indexSource).not.toContain('const createInitialCore = (');
        expect(indexSource).not.toContain('const QIDAHEN_SCENARIO_RUNTIME_REGION_PRESETS:');
        expect(indexSource).not.toContain('const applyScenarioRuntimeRegionPreset = (');
        expect(indexSource).toContain('const initialCore = createInitialCore(');
        expect(indexSource).toContain('return tutorialCoreTransform ? tutorialCoreTransform(initialCore) : initialCore;');

        expect(initialCoreSetupSource).toContain("import { getScenarioPlayableFactionIds } from './factionTurnOrder';");
        expect(initialCoreSetupSource).toContain("import { getQidahenScenarioPreset } from './scenarioPresets';");
        expect(initialCoreSetupSource).toContain("import { buildQidahenActionWindowEntryState } from './actionWindowEntryState';");
        expect(initialCoreSetupSource).toContain("import { applyQidahenScenarioRuntimeRegionPreset } from './scenarioRuntimeRegionPresets';");
        expect(initialCoreSetupSource).toContain("} from './scenarioChoiceState';");
        expect(initialCoreSetupSource).not.toContain("} from './scenarioChoiceStateDependencies';");
        expect(initialCoreSetupSource).toContain("} from './initialCoreSeeds';");
        expect(initialCoreSetupSource).toContain("import { buildInitialHandCards } from './handCardState';");
        expect(initialCoreSetupSource).toContain("import { refreshRuntimeRegionRules } from './runtimeRegionRules';");
        expect(initialCoreSetupSource).toContain("import { syncQidahenCorePieceCollections } from './coreDerivedState';");
        expect(initialCoreSetupSource).toContain("} from './characterChronologyConfig';");
        expect(initialCoreSetupSource).not.toContain('type QidahenScenarioRuntimeRegionPreset =');
        expect(initialCoreSetupSource).not.toContain('const QIDAHEN_SCENARIO_RUNTIME_REGION_PRESETS: Partial<Record<QidahenScenarioId, Partial<Record<string, QidahenScenarioRuntimeRegionPreset>>>> = {');
        expect(initialCoreSetupSource).not.toContain('const applyScenarioRuntimeRegionPreset = (');
        expect(initialCoreSetupSource).not.toContain('const selectedActionId = getDefaultActionIdForFaction(openingFactionId);');
        expect(initialCoreSetupSource).not.toContain('const buildInitialHandCards = (');
        expect(initialCoreSetupSource).not.toContain("} from './scenarioChoiceOrchestration';");
        expect(initialCoreSetupSource).toContain('export const createInitialCore = (');
        expect(initialCoreSetupSource).not.toContain('export const createQidahenCoreForScenario = (');
        expect(initialCoreSetupSource).not.toContain('export const createQidahenCoreForScenarioWithSelections = (');
        expect(initialCoreSetupSource).not.toContain('const createQidahenCoreForScenario = (');
        expect(initialCoreSetupSource).not.toContain('const createQidahenCoreForScenarioWithSelections = (');
        expect(initialCoreSetupSource).toContain('const actionWindowEntryState = buildQidahenActionWindowEntryState(openingFactionId, {');
        expect(initialCoreSetupSource).toContain('const fortifications = createInitialFortifications();');
        expect(initialCoreSetupSource).toContain('applyQidahenScenarioRuntimeRegionPreset(createInitialRuntimeRegionSummaries(), scenarioId)');
        expect(initialCoreSetupSource).toContain("createInitialFactionState('ming', playerIdsByFaction.ming)");
        expect(initialCoreSetupSource).toContain("createInitialFactionState('mongol', playerIdsByFaction.mongol)");
        expect(initialCoreSetupSource).toContain("createInitialFactionState('jin', playerIdsByFaction.jin)");
        expect(initialCoreSetupSource).toContain('const syncedBaseCore = syncQidahenCorePieceCollections(baseCore);');
        expect(initialCoreSetupSource).toContain('const openingSelectedRegionId = getPreferredOpeningActionWindowSelectedRegionId(syncedBaseCore, openingFactionId);');
        expect(initialCoreSetupSource).toContain('selectedRegionId: openingSelectedRegionId,');
        expect(initialCoreSetupSource).toContain('regionFocusState: {');
        expect(initialCoreSetupSource).toContain('defaultFocusRegionId: openingSelectedRegionId,');
        expect(initialCoreSetupSource).toContain('...actionWindowEntryState,');
        expect(initialCoreSetupSource).not.toContain('actionChoices: getActionChoicesForFaction(openingFactionId),');
        expect(initialCoreSetupSource).not.toContain('payment: buildPaymentState(selectedActionId),');

        expect(initialCoreSeedsSource).toContain("import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_WIDTH } from '../ui/mapRegions';");
        expect(initialCoreSeedsSource).toContain("import { QIDAHEN_RUNTIME_REGION_DEFINITIONS } from '../ui/mapGraph';");
        expect(initialCoreSeedsSource).toContain('const initialFactionSeedsById: Record<QidahenFactionId, Pick<QidahenFactionState, \'name\' | \'colorClass\' | \'vp\' | \'troops\' | \'grain\' | \'landTax\'>> = {');
        expect(initialCoreSeedsSource).toContain('export const getScenarioPlayerIdsByFaction = (');
        expect(initialCoreSeedsSource).toContain('export const createInitialFactionState = (');
        expect(initialCoreSeedsSource).toContain('export const createInitialFortifications = (): QidahenFortificationState[] => (');
        expect(initialCoreSeedsSource).toContain('export const createInitialRuntimeRegionSummaries = (): QidahenCore[\'regions\'] => (');
        expect(initialCoreSeedsSource).toContain('getQidahenFortificationConfigs,');
        expect(initialCoreSeedsSource).toContain('getQidahenFortificationConfigs()');
        expect(initialCoreSeedsSource).not.toContain('QIDAHEN_FORTIFICATION_CONFIGS');
        expect(initialCoreSeedsSource).toContain("name: getQidahenStatefulRegionDisplayName(region.id),");
        expect(initialCoreSeedsSource).not.toContain('getQidahenInitialTroops,');
        expect(initialCoreSeedsSource).not.toContain('getQidahenInitialPopulation,');
        expect(initialCoreSeedsSource).not.toContain('getQidahenInitialNote,');
        expect(initialCoreSeedsSource).toContain('const initialNote = regionConfig.initialNote;');
        expect(initialCoreSeedsSource).toContain('troops: regionConfig.initialTroops,');
        expect(initialCoreSeedsSource).toContain('population: isQidahenKoreaRuntimeRegionId(region.id) ? 0 : regionConfig.initialPopulation,');
        expect(initialCoreSeedsSource).toContain('armaments: createInitialArmamentStates(id),');
        expect(initialCoreSeedsSource).toContain('characters: createInitialCharacterStates(id),');

        expect(chronologyConfigSource).not.toContain('export const QIDAHEN_YEAR_SEQUENCE = [');
        expect(chronologyConfigSource).toContain('const QIDAHEN_YEAR_SEQUENCE = [');
        expect(chronologyConfigSource).toContain('export const getQidahenMaxChronologyYearIndex = (): number => (');
        expect(chronologyConfigSource).toContain('export const getYearLabelByIndex = (');
        expect(chronologyConfigSource).toContain('export const buildYearCardSlots = (yearIndex: number): QidahenCore[\'yearCards\'] => [');

        expect(actionWindowEntryStateSource).toContain("} from './factionActionWindow';");
        expect(actionWindowEntryStateSource).toContain("import type {");
        expect(actionWindowEntryStateSource).not.toContain('export interface QidahenActionWindowEntryStateOptions {');
        expect(actionWindowEntryStateSource).toContain('interface QidahenActionWindowEntryStateOptions {');
        expect(actionWindowEntryStateSource).toContain('export const buildQidahenActionWindowEntryState = (');
        expect(actionWindowEntryStateSource).toContain("selectedWheelMoveId = options.selectedWheelMoveId ?? 'move-1-free';");
        expect(actionWindowEntryStateSource).toContain('selectedActionId,');
        expect(actionWindowEntryStateSource).toContain('selectedPaymentCardIds: [],');
        expect(actionWindowEntryStateSource).toContain('actionChoices: getActionChoicesForFaction(factionId),');
        expect(actionWindowEntryStateSource).toContain('payment: buildPaymentState(selectedActionId, 0),');

        expect(scenarioRuntimeRegionPresetsSource).toContain("import {");
        expect(scenarioRuntimeRegionPresetsSource).toContain("buildArtilleryTroopStack,");
        expect(scenarioRuntimeRegionPresetsSource).toContain("buildFactionTroopStack,");
        expect(scenarioRuntimeRegionPresetsSource).toContain("buildMercenaryTroopStack,");
        expect(scenarioRuntimeRegionPresetsSource).toContain("buildRegularTroopStack,");
        expect(scenarioRuntimeRegionPresetsSource).toContain("import { cloneSpecialTroopStacksAsPieces } from './troopCompat';");
        expect(scenarioRuntimeRegionPresetsSource).toContain("import type { QidahenCore, QidahenScenarioId, QidahenSpecialTroopStack } from './types';");
        expect(scenarioRuntimeRegionPresetsSource).toContain('type QidahenScenarioRuntimeRegionPreset =');
        expect(scenarioRuntimeRegionPresetsSource).not.toContain('export const QIDAHEN_SCENARIO_RUNTIME_REGION_PRESETS: Partial<Record<QidahenScenarioId, Partial<Record<string, QidahenScenarioRuntimeRegionPreset>>>> = {');
        expect(scenarioRuntimeRegionPresetsSource).toContain('const QIDAHEN_SCENARIO_RUNTIME_REGION_PRESETS: Partial<Record<QidahenScenarioId, Partial<Record<string, QidahenScenarioRuntimeRegionPreset>>>> = {');
        expect(scenarioRuntimeRegionPresetsSource).toContain('export const applyQidahenScenarioRuntimeRegionPreset = (');
        expect(scenarioRuntimeRegionPresetsSource).toContain('const preset = QIDAHEN_SCENARIO_RUNTIME_REGION_PRESETS[scenarioId];');
        expect(scenarioRuntimeRegionPresetsSource).toContain('specialTroops: override.specialTroops');
        expect(scenarioRuntimeRegionPresetsSource).toContain('cloneSpecialTroopStacksAsPieces(override.specialTroops)');
    });

    it('手牌构造与抽牌/牌堆更新应由 handCardState owner 承接，initialCoreSetup 与 index 只保留消费接线', () => {
        const actionWindowChoicesSource = readActionWindowChoicesSource();
        const directInputEventReducerBridgeSource = readDirectInputEventReducerBridgeSource();
        const handCardStateSource = readHandCardStateSource();
        const indexSource = readDomainIndexSource();
        const initialCoreSetupSource = readInitialCoreSetupSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();
        const postBattleContractsSource = readPostBattleContractsSource();
        const wheelMoveExecutionSource = readWheelMoveExecutionSource();

        expect(indexSource).not.toContain("} from './handCardState';");
        expect(indexSource).not.toContain('addFactionHandCards,');
        expect(indexSource).not.toContain('buildDrawnHandCards,');
        expect(indexSource).not.toContain('drawFromFactionPile,');
        expect(indexSource).not.toContain('getFactionDrawPileCount,');
        expect(directInputEventReducerBridgeSource).toBe('');
        expect(actionWindowChoicesSource).toContain('getFactionDrawPileCount,');
        expect(indexSource).not.toContain('const QIDAHEN_FACTION_HAND_PREVIEW_COUNT = 16;');
        expect(indexSource).not.toContain('const factionHandPreviewById: Record<QidahenFactionId, (index: number) => QidahenHandCard[\'previewRef\']> = {');
        expect(indexSource).not.toContain('const buildDrawnHandCards = (');
        expect(indexSource).not.toContain('const getFactionDrawPileCount = (');
        expect(indexSource).not.toContain('const drawFromFactionPile = (');
        expect(indexSource).not.toContain('const addFactionHandCards = (');
        expect(indexSource).not.toContain('const drawKoreaCardsForFaction = (');
        const postBattleResolutionDependenciesSource = readPostBattleResolutionDependenciesSource();
        const postBattleDecisionResolutionSource = readPostBattleDecisionResolutionSource();
        expect(postBattleResolutionDependenciesSource).toBe('');
        expect(postBattleDecisionResolutionSource).toContain('drawKoreaCardsForFaction,');

        expect(initialCoreSetupSource).toContain("import { buildInitialHandCards } from './handCardState';");
        expect(initialCoreSetupSource).not.toContain('const QIDAHEN_FACTION_HAND_PREVIEW_COUNT = 16;');
        expect(initialCoreSetupSource).not.toContain('const factionHandPreviewById: Record<QidahenFactionId, (index: number) => QidahenHandCard[\'previewRef\']> = {');
        expect(initialCoreSetupSource).not.toContain('const buildInitialHandCards = (');

        expect(handCardStateSource).toContain('qidahenAtlas05OrdinaryHandPreview,');
        expect(handCardStateSource).toContain("import { QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_IDENTITIES } from './ordinaryHandCardIdentities';");
        expect(handCardStateSource).toContain("import { resolveQidahenAtlas05OrdinaryHandCardIdentity } from './handCardIdentity';");
        expect(handCardStateSource).toContain("import type { QidahenCore, QidahenFactionId, QidahenHandCard } from './types';");
        expect(handCardStateSource).toContain("const factionOrder: QidahenFactionId[] = ['ming', 'mongol', 'jin'];");
        expect(handCardStateSource).toContain('export const QIDAHEN_ATLAS05_TTS_DECK_SEQUENCE_BY_FACTION: Record<QidahenFactionId, number[]> = {');
        expect(handCardStateSource).toContain('const getFactionAtlas05DeckIndex = (');
        expect(handCardStateSource).toContain('Missing confirmed qidahen atlas05 ordinary hand card identity');
        expect(handCardStateSource).not.toContain('atlasIndex %');
        expect(handCardStateSource).not.toContain('identity!');
        expect(handCardStateSource).not.toContain('const QIDAHEN_FACTION_HAND_PREVIEW_COUNT = 16;');
        expect(handCardStateSource).not.toContain('const factionHandPreviewById: Record<QidahenFactionId, (index: number) => QidahenHandCard[\'previewRef\']> = {');
        expect(handCardStateSource).toContain('export const buildInitialHandCards = (');
        expect(handCardStateSource).toContain('export const buildDrawnHandCards = (');
        expect(handCardStateSource).toContain('export const getFactionDrawPileCount = (');
        expect(handCardStateSource).toContain('export const drawFromFactionPile = (');
        expect(handCardStateSource).toContain('export const addFactionHandCards = (');
        expect(handCardStateSource).toContain('export const drawKoreaCardsForFaction = (');

        expect(actionWindowChoicesSource).toContain('buildDrawnHandCards: (');
        expect(actionWindowChoicesSource).toContain('getFactionDrawPileCount: (');
        expect(actionWindowChoicesSource).toContain('drawFromFactionPile: (');
        expect(actionWindowChoicesSource).toContain('addFactionHandCards: (');
        expect(pendingTargetResolutionSource).toContain('buildDrawnHandCards: (');
        expect(pendingTargetResolutionSource).toContain('getFactionDrawPileCount: (');
        expect(pendingTargetResolutionSource).toContain('drawFromFactionPile: (');
        expect(pendingTargetResolutionSource).toContain('addFactionHandCards: (');
        expect(postBattleContractsSource).toBe('');
        expect(postBattleDecisionResolutionSource).toContain('buildDrawnHandCards: (');
        expect(postBattleDecisionResolutionSource).toContain('getFactionDrawPileCount: (');
        expect(postBattleDecisionResolutionSource).toContain('drawFromFactionPile: (');
        expect(postBattleDecisionResolutionSource).toContain('addFactionHandCards: (');
        expect(postBattleDecisionResolutionSource).toContain('drawKoreaCardsForFaction: (');
        expect(wheelMoveExecutionSource).toContain('buildDrawnHandCards: (');
        expect(wheelMoveExecutionSource).toContain('drawFromFactionPile: (');
        expect(wheelMoveExecutionSource).toContain('addFactionHandCards: (');
    });

    it('行动窗口入口默认状态应由 actionWindowEntryState owner 承接，initialCoreSetup 与 turnAdvance 不再各自手写同一批开局字段', () => {
        const actionWindowEntryStateSource = readActionWindowEntryStateSource();
        const initialCoreSetupSource = readInitialCoreSetupSource();
        const turnAdvanceSource = readTurnAdvanceSource();

        expect(initialCoreSetupSource).toContain("import { buildQidahenActionWindowEntryState } from './actionWindowEntryState';");
        expect(turnAdvanceSource).toContain("import { buildQidahenActionWindowEntryState } from './actionWindowEntryState';");
        expect(initialCoreSetupSource).toContain('const actionWindowEntryState = buildQidahenActionWindowEntryState(openingFactionId, {');
        expect(turnAdvanceSource).toContain('const actionWindowEntryState = buildQidahenActionWindowEntryState(nextFactionId, {');
        expect(initialCoreSetupSource).not.toContain('wheelActionUsed: false,');
        expect(initialCoreSetupSource).not.toContain('bonusFactionActionAvailable: false,');
        expect(initialCoreSetupSource).not.toContain('recruitSelection: null,');
        expect(turnAdvanceSource).not.toContain('wheelActionUsed: false,');
        expect(turnAdvanceSource).not.toContain('bonusFactionActionAvailable: false,');
        expect(turnAdvanceSource).not.toContain('recruitSelection: null,');
        expect(actionWindowEntryStateSource).toContain('turnPhase: \'action-window\',');
        expect(actionWindowEntryStateSource).toContain('wheelActionUsed: false,');
        expect(actionWindowEntryStateSource).toContain('bonusFactionActionAvailable: false,');
        expect(actionWindowEntryStateSource).toContain('recruitSelection: null,');
        expect(actionWindowEntryStateSource).not.toContain('driveTigerConsentSelection: null,');
        expect(actionWindowEntryStateSource).not.toContain('fortificationMaintenanceSelection: null,');
        expect(actionWindowEntryStateSource).toContain('handLimitDiscardSelection: null,');
        expect(actionWindowEntryStateSource).toContain('sunYuanhuaTechSelection: null,');
        expect(actionWindowEntryStateSource).not.toContain('internalDispatchSelection: null,');
        expect(actionWindowEntryStateSource).toContain('pendingTargetAction: null,');
        expect(actionWindowEntryStateSource).toContain('postBattleSelection: null,');
    });

    it('朝鲜贡牌增益与败北标记应用应由 koreaTributeRules / defeatMarkerState owner 承接，seasonResolution 与 index 只保留消费接线', () => {
        const defeatMarkerStateSource = readDefeatMarkerStateSource();
        const handCardStateSource = readHandCardStateSource();
        const indexSource = readDomainIndexSource();
        const koreaTributeRulesSource = readKoreaTributeRulesSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();
        const postBattleDecisionResolutionSource = readPostBattleDecisionResolutionSource();
        const postBattleContractsSource = readPostBattleContractsSource();
        const seasonResolutionSource = readSeasonResolutionSource();

        expect(koreaTributeRulesSource).toContain("import { hasActiveCharacter } from './characterPresenceAccessors';");
        expect(koreaTributeRulesSource).toContain("import { resolveQidahenRuleRegionConfig } from './regionConfig';");
        expect(koreaTributeRulesSource).toContain('export const getEffectiveKoreaTributeCardsForFaction = (');
        expect(koreaTributeRulesSource).toContain('const baseTributeCards = resolveQidahenRuleRegionConfig(regionId).tributeCards;');

        expect(handCardStateSource).toContain('export const drawKoreaCardsForFaction = (');

        expect(seasonResolutionSource).toContain("} from './handCardState';");
        expect(seasonResolutionSource).toContain('drawKoreaCardsForFaction,');
        expect(seasonResolutionSource).toContain("import { getEffectiveKoreaTributeCardsForFaction } from './koreaTributeRules';");
        expect(seasonResolutionSource).toContain("} from './defeatMarkerState';");
        expect(seasonResolutionSource).toContain('getMidyearDefeatMarkerRoll,');
        expect(seasonResolutionSource).toContain('listMarkedCharacters,');
        expect(seasonResolutionSource).toContain('syncFactionCharactersToDefeatMarkerCount,');
        expect(seasonResolutionSource).not.toContain('const drawKoreaCardsForFaction = (');
        expect(seasonResolutionSource).not.toContain('const getEffectiveKoreaTributeCardsForFaction = (');
        expect(seasonResolutionSource).not.toContain('const syncFactionCharactersToDefeatMarkerCount = (');
        expect(seasonResolutionSource).not.toContain('const listMarkedCharacters = (');
        expect(seasonResolutionSource).not.toContain('const getMidyearDefeatMarkerRoll = (');
        expect(seasonResolutionSource).not.toContain('export const addDefeatMarkerToCharacters = (');

        expect(indexSource).not.toContain("import { getEffectiveKoreaTributeCardsForFaction } from './koreaTributeRules';");
        expect(indexSource).not.toContain("} from './defeatMarkerState';");
        expect(indexSource).not.toContain("getQidahenKoreaTributeCards,");
        expect(indexSource).not.toContain('const getEffectiveKoreaTributeCardsForFaction = (');
        expect(indexSource).not.toContain('const addDefeatMarkerToFaction = (');
        expect(indexSource).not.toContain("addDefeatMarkerToCharacters,");
        const postBattleResolutionDependenciesSource = readPostBattleResolutionDependenciesSource();
        const pendingTargetResolutionDependenciesSource = readPendingTargetResolutionDependenciesSource();
        expect(postBattleResolutionDependenciesSource).toBe('');
        expect(pendingTargetResolutionDependenciesSource).toBe('');
        expect(postBattleDecisionResolutionSource).toContain("import { getEffectiveKoreaTributeCardsForFaction } from './koreaTributeRules';");
        expect(pendingTargetResolutionSource).toContain("} from './defeatMarkerState';");
        expect(pendingTargetResolutionSource).toContain('addDefeatMarkerToFaction,');

        expect(defeatMarkerStateSource).not.toContain('export const addDefeatMarkerToCharacters = (');
        expect(defeatMarkerStateSource).toContain('const addDefeatMarkerToCharacters = (');
        expect(defeatMarkerStateSource).toContain('export const syncFactionCharactersToDefeatMarkerCount = (');
        expect(defeatMarkerStateSource).not.toContain('const getCharacterDefeatMarkerCount = (');
        expect(defeatMarkerStateSource).toContain('const characterMarkerCount = nextFaction.characters.reduce(');
        expect(defeatMarkerStateSource).toContain('export const listMarkedCharacters = (');
        expect(defeatMarkerStateSource).toContain('export const getMidyearDefeatMarkerRoll = (');
        expect(defeatMarkerStateSource).toContain('export const addDefeatMarkerToFaction = (');

        expect(postBattleDecisionResolutionSource).toContain('drawKoreaCardsForFaction(');
        expect(postBattleDecisionResolutionSource).toContain('getEffectiveKoreaTributeCardsForFaction(state, selection.attackerFactionId, selection.targetRuntimeRegionId)');
        expect(postBattleContractsSource).toBe('');
        expect(postBattleDecisionResolutionSource).toContain('drawKoreaCardsForFaction: (');
        expect(postBattleDecisionResolutionSource).toContain('getEffectiveKoreaTributeCardsForFaction: (');
        expect(pendingTargetResolutionSource).toContain('addDefeatMarkerToFaction: (');
    });

    it('行动规则区名与蒙古本土归属判定应由 regionRuleSemantics owner 承接，index 与 selection builder 只保留消费接线', () => {
        const indexSource = readDomainIndexSource();
        const pendingTargetActionBuilderSource = readPendingTargetActionBuilderSource();
        const regionConfigSource = readRegionConfigSource();
        const regionRuleSemanticsSource = readRegionRuleSemanticsSource();
        const selectionBuildersSource = readSelectionBuildersSource();
        const actionWindowChoicesSource = readActionWindowChoicesSource();

        expect(indexSource).not.toContain("} from './regionRuleSemantics';");
        expect(indexSource).not.toContain('getActionRuleDisplayRegionName,');
        expect(indexSource).not.toContain('getEffectiveHomelandController,');
        expect(actionWindowChoicesSource).toContain("from './regionRuleSemantics';");
        expect(actionWindowChoicesSource).toContain('getActionRuleDisplayRegionName,');
        expect(actionWindowChoicesSource).toContain('getEffectiveHomelandController,');
        expect(indexSource).not.toContain("const ACTION_RULE_REGION_NAME_OVERRIDES: Partial<Record<string, string>> = {");
        expect(indexSource).not.toContain("const QISAI_NOYAN_HOMELAND_REGION_IDS = new Set([");
        expect(indexSource).not.toContain("const GUNCHU_KETUJI_HOMELAND_REGION_IDS = new Set([");
        expect(indexSource).not.toContain("const OBA_TAIJI_HOMELAND_REGION_IDS = new Set([");
        expect(indexSource).not.toContain("const CHOGHTU_TAIJI_HOMELAND_REGION_IDS = new Set([");
        expect(indexSource).not.toContain("const LINDAN_HUTUKTU_HOMELAND_REGION_IDS = new Set([");
        expect(indexSource).not.toContain('const getEffectiveHomelandController = (');
        expect(indexSource).not.toContain('const getActionRuleRegionNameById = (');
        expect(indexSource).not.toContain('const getActionRuleDisplayRegionName = (');
        expect(indexSource).not.toContain('const getPreferredLogicalRegionDisplayName = (');
        expect(pendingTargetActionBuilderSource).toContain("import { getPreferredLogicalRegionDisplayName } from './regionRuleSemantics';");

        expect(selectionBuildersSource).toContain("} from './regionRuleSemantics';");
        expect(selectionBuildersSource).toContain('getEffectiveHomelandController,');
        expect(selectionBuildersSource).toContain('getPreferredLogicalRegionDisplayName,');
        expect(selectionBuildersSource).not.toContain("const ACTION_RULE_REGION_NAME_OVERRIDES: Partial<Record<string, string>> = {");
        expect(selectionBuildersSource).not.toContain("const QISAI_NOYAN_HOMELAND_REGION_IDS = new Set([");
        expect(selectionBuildersSource).not.toContain("const GUNCHU_KETUJI_HOMELAND_REGION_IDS = new Set([");
        expect(selectionBuildersSource).not.toContain("const OBA_TAIJI_HOMELAND_REGION_IDS = new Set([");
        expect(selectionBuildersSource).not.toContain("const CHOGHTU_TAIJI_HOMELAND_REGION_IDS = new Set([");
        expect(selectionBuildersSource).not.toContain("const LINDAN_HUTUKTU_HOMELAND_REGION_IDS = new Set([");
        expect(selectionBuildersSource).not.toContain('const getActionRuleRegionNameById = (');
        expect(selectionBuildersSource).not.toContain('const getActionRuleDisplayRegionName = (');
        expect(selectionBuildersSource).not.toContain('const getPreferredLogicalRegionDisplayName = (');
        expect(selectionBuildersSource).not.toContain('const getEffectiveHomelandController = (');

        expect(regionRuleSemanticsSource).toContain("import {");
        expect(regionRuleSemanticsSource).toContain("getQidahenInitialController,");
        expect(regionRuleSemanticsSource).toContain("isQidahenLogicalRuleRegionId,");
        expect(regionRuleSemanticsSource).not.toContain("QIDAHEN_LOGICAL_RULE_REGION_IDS,");
        expect(regionRuleSemanticsSource).toContain("resolveQidahenPrimaryRuntimeRegionId,");
        expect(regionRuleSemanticsSource).toContain("resolveQidahenRuleRegionConfig,");
        expect(regionRuleSemanticsSource).toContain("import type { QidahenCore, QidahenFactionId } from './types';");
        expect(regionRuleSemanticsSource).toContain("const ACTION_RULE_REGION_NAME_OVERRIDES: Partial<Record<string, string>> = {");
        expect(regionRuleSemanticsSource).toContain("const QISAI_NOYAN_HOMELAND_REGION_IDS = new Set([");
        expect(regionRuleSemanticsSource).toContain('export const getActionRuleRegionNameById = (');
        expect(regionRuleSemanticsSource).toContain('export const getActionRuleDisplayRegionName = (');
        expect(regionRuleSemanticsSource).toContain('export const getPreferredLogicalRegionDisplayName = (');
        expect(regionRuleSemanticsSource).toContain('export const getEffectiveHomelandController = (');
        expect(regionConfigSource).toContain('export const getQidahenLogicalRuleRegionConfigs = (): QidahenRuleRegionConfig[] => (');
        expect(regionConfigSource).toContain('export const isQidahenLogicalRuleRegionId = (regionId: string): boolean => (');
        expect(regionConfigSource).not.toContain('export const QIDAHEN_RULE_REGION_CONFIGS: QidahenRuleRegionConfig[] = [');
        expect(regionConfigSource).not.toContain('export const QIDAHEN_LOGICAL_RULE_REGION_IDS = new Set(');
    });

    it('人物在场判定应由 characterPresenceAccessors owner 承接，规则模块只保留消费接线', () => {
        const battleRollMathSource = readBattleRollMathSource();
        const characterAbilitySemanticsSource = readCharacterAbilitySemanticsSource();
        const characterPresenceAccessorsSource = readCharacterPresenceAccessorsSource();
        const factionActionWindowSource = readFactionActionWindowSource();
        const indexSource = readDomainIndexSource();
        const movementSource = readMovementSource();
        const pendingBattleCommittedTroopsSource = readPendingBattleCommittedTroopsSource();
        const regionRuleSemanticsSource = readRegionRuleSemanticsSource();
        const selectedActionStateCommitSource = readSelectedActionStateCommitSource();
        const dispatchSelectionBuildersSource = readDispatchSelectionBuildersSource();
        const characterActionWindowSource = readCharacterActionWindowSource();
        expect(characterPresenceAccessorsSource).toContain("import type { QidahenCore, QidahenFactionId } from './types';");
        expect(characterPresenceAccessorsSource).toContain('export const hasActiveCharacter = (');
        expect(characterPresenceAccessorsSource).toContain("character.id === characterId && character.inPlay");
        expect(characterAbilitySemanticsSource).toContain("import { hasActiveCharacter } from './characterPresenceAccessors';");

        expect(indexSource).not.toContain("import { hasActiveCharacter } from './characterPresenceAccessors';");
        expect(indexSource).not.toContain('const hasActiveCharacter = (');
        expect(battleRollMathSource).toContain("import { hasActiveCharacter } from './characterPresenceAccessors';");
        expect(battleRollMathSource).not.toContain('const hasActiveCharacter = (');
        expect(factionActionWindowSource).toContain("import { hasActiveCharacter } from './characterPresenceAccessors';");
        expect(factionActionWindowSource).not.toContain('const hasActiveCharacter = (');
        expect(movementSource).toContain("import { hasActiveCharacter } from './characterPresenceAccessors';");
        expect(movementSource).not.toContain('const hasActiveCharacter = (');
        expect(pendingBattleCommittedTroopsSource).toContain("import { hasActiveCharacter } from './characterPresenceAccessors';");
        expect(pendingBattleCommittedTroopsSource).not.toContain('const hasActiveCharacter = (');
        expect(regionRuleSemanticsSource).toContain("import { hasActiveCharacter } from './characterPresenceAccessors';");
        expect(regionRuleSemanticsSource).not.toContain('const hasActiveCharacter = (');
        expect(selectedActionStateCommitSource).toContain("import { hasActiveCharacter } from './characterPresenceAccessors';");
        expect(selectedActionStateCommitSource).not.toContain('const hasActiveCharacter = (');
        expect(dispatchSelectionBuildersSource).toContain("import { hasActiveCharacter } from './characterPresenceAccessors';");
        expect(dispatchSelectionBuildersSource).not.toContain('const hasActiveCharacter = (');
        expect(characterActionWindowSource).toContain("import { hasActiveCharacter } from './characterPresenceAccessors';");
    });

    it('movement 的 runtime-region 主键映射应直接消费 regionConfig owner，不再保留文件内私有转手壳', () => {
        const movementSource = readMovementSource();
        const indexSource = readDomainIndexSource();

        expect(movementSource).toContain("resolveQidahenPrimaryRuntimeRegionId,");
        expect(movementSource).not.toContain('const toRuntimeRegionId = (');
        expect(movementSource).toContain('const runtimeRegionId = resolveQidahenPrimaryRuntimeRegionId(regionId);');
        expect(movementSource).toContain('const toRuntimeId = resolveQidahenPrimaryRuntimeRegionId(toId);');
        expect(movementSource).not.toContain('export const getQidahenDirectedTravelCost = (');
        expect(movementSource).not.toContain('export interface QidahenAdjacentRuntimeRegion {');
        expect(movementSource).toContain('interface QidahenAdjacentRuntimeRegion {');
        expect(movementSource).not.toContain('export const getQidahenAdjacentRuntimeRegions = (');
        expect(movementSource).toContain('const getQidahenAdjacentRuntimeRegions = (');
        expect(movementSource).not.toContain('export const QIDAHEN_MOVEMENT_PROFILES: QidahenMovementProfile[] = [');
        expect(movementSource).toContain('const QIDAHEN_MOVEMENT_PROFILES: QidahenMovementProfile[] = [');
        expect(indexSource).not.toContain('getQidahenAdjacentRuntimeRegions,');
        expect(indexSource).not.toContain('getQidahenDirectedPassageRule,');
        expect(indexSource).not.toContain('getQidahenDirectedTravelCost,');
        expect(indexSource).not.toContain('QIDAHEN_MOVEMENT_PROFILES,');
    });

    it('人物能力启用/豁免/收益语义应由 characterAbilitySemantics owner 承接，index 与 battle/selection owner 不再经高层转手注入', () => {
        const characterAbilitySemanticsSource = readCharacterAbilitySemanticsSource();
        const indexSource = readDomainIndexSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();
        const postBattleDecisionResolutionSource = readPostBattleDecisionResolutionSource();
        const selectionInputStateSource = readSelectionInputStateSource();

        expect(indexSource).not.toContain("} from './characterAbilitySemantics';");
        expect(indexSource).not.toContain('const getAttackerDeckPlunderHandBonus = (');
        expect(indexSource).not.toContain('const isSunYuanhuaEnabled = (');
        expect(indexSource).not.toContain('const hasJinDefeatLossImmunity = (');
        expect(characterAbilitySemanticsSource).toContain('export const getAttackerDeckPlunderHandBonus = (');
        expect(characterAbilitySemanticsSource).toContain("factionId === 'mongol' && hasActiveCharacter(state, 'mongol', 'mongol-gunchu-ketuji')");
        expect(characterAbilitySemanticsSource).toContain('export const isSunYuanhuaEnabled = (state: QidahenCore): boolean => (');
        expect(characterAbilitySemanticsSource).toContain("hasActiveCharacter(state, 'ming', 'ming-sun-yuanhua')");
        expect(characterAbilitySemanticsSource).toContain('export const hasJinDefeatLossImmunity = (');
        expect(characterAbilitySemanticsSource).toContain("factionId === 'jin' && hasActiveCharacter(state, 'jin', 'jin-daisan')");

        expect(selectionInputStateSource).toContain("import { isSunYuanhuaEnabled } from './characterAbilitySemantics';");
        expect(selectionInputStateSource).not.toContain('isSunYuanhuaEnabled: (');
        expect(selectionInputStateSource).not.toContain('dependencies.isSunYuanhuaEnabled(state)');

        expect(postBattleDecisionResolutionSource).toContain("import { getAttackerDeckPlunderHandBonus } from './characterAbilitySemantics';");
        expect(postBattleDecisionResolutionSource).not.toContain('getAttackerDeckPlunderHandBonus: (');
        expect(postBattleDecisionResolutionSource).not.toContain('dependencies.getAttackerDeckPlunderHandBonus(');

        expect(pendingTargetResolutionSource).toContain("} from './characterAbilitySemantics';");
        expect(pendingTargetResolutionSource).not.toContain('getAttackerDeckPlunderHandBonus: (');
        expect(pendingTargetResolutionSource).not.toContain('hasJinDefeatLossImmunity: (');
        expect(pendingTargetResolutionSource).not.toContain('dependencies.getAttackerDeckPlunderHandBonus(');
        expect(pendingTargetResolutionSource).not.toContain('dependencies.hasJinDefeatLossImmunity(');
    });

    it('军备等级读取应由 armamentStateAccessors owner 承接，战斗与选择链只保留消费接线', () => {
        const armamentStateAccessorsSource = readArmamentStateAccessorsSource();
        const battleRollMathSource = readBattleRollMathSource();
        const indexSource = readDomainIndexSource();
        const selectionBuildersSource = readSelectionBuildersSource();
        const characterActionWindowSource = readCharacterActionWindowSource();
        expect(armamentStateAccessorsSource).toContain("import type { QidahenArmamentId, QidahenCore, QidahenFactionId } from './types';");
        expect(armamentStateAccessorsSource).toContain('export const getArmamentLevel = (');
        expect(armamentStateAccessorsSource).toContain("armament.id === armamentId)?.level ?? 0");

        expect(indexSource).not.toContain("import { getArmamentLevel } from './armamentStateAccessors';");
        expect(indexSource).not.toContain('const getArmamentLevel = (');
        expect(selectionBuildersSource).toContain("import { getArmamentLevel } from './armamentStateAccessors';");
        expect(selectionBuildersSource).not.toContain('const getArmamentLevel = (');
        expect(battleRollMathSource).toContain("import { getArmamentLevel } from './armamentStateAccessors';");
        expect(battleRollMathSource).not.toContain('const getArmamentLevel = (');
        expect(characterActionWindowSource).toContain("import { getArmamentLevel } from './armamentStateAccessors';");
    });

    it('pending target 非战斗围城增援分支应由 pendingTargetResolution owner 承接，index 不再本地内联 siege-reinforce resolve', () => {
        const indexSource = readDomainIndexSource();
        const pendingBattleOrchestrationSource = readPendingBattleOrchestrationSource();
        const pendingBattleFlowSource = readPendingBattleFlowSource();
        const pendingBattleFlowDependenciesSource = readPendingBattleFlowDependenciesSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(indexSource).not.toContain("} from './pendingBattleResolutionBridge';");
        expect(indexSource).not.toContain('QIDAHEN_PENDING_TARGET_RESOLUTION_DEPENDENCIES,');
        expect(indexSource).not.toContain("} from './pendingTargetResolution';");
        expect(indexSource).not.toContain('resolvePendingTargetActionByActionType,');
        expect(indexSource).not.toContain('resolvePendingTargetActionByActionType(');
        expect(indexSource).not.toContain('const siegeReinforcementResolution = resolvePendingSiegeReinforcementAction(');
        expect(indexSource).not.toContain("if (pendingTargetAction.targetKind === 'siege-reinforce') {");
        expect(pendingBattleOrchestrationSource).toBe('');
        expect(pendingBattleFlowDependenciesSource).toBe('');
        expect(pendingBattleFlowSource).toContain('resolvePendingTargetAction: resolvePendingTargetActionByActionType,');
        expect(pendingBattleFlowSource).not.toContain('QIDAHEN_PENDING_TARGET_RESOLUTION_DEPENDENCIES,');
        expect(pendingTargetResolutionSource).not.toContain('export interface QidahenPendingTargetResolutionDependencies {');
        expect(pendingTargetResolutionSource).toContain('interface QidahenPendingTargetResolutionDependencies {');
        expect(pendingTargetResolutionSource).toContain('const siegeReinforcementResolution = resolvePendingSiegeReinforcementAction(');
        expect(pendingTargetResolutionSource).not.toContain('export const resolvePendingSiegeReinforcementAction = (');
        expect(pendingTargetResolutionSource).toContain('const resolvePendingSiegeReinforcementAction = (');
        expect(pendingTargetResolutionSource).toContain("if (pendingTargetAction.targetKind !== 'siege-reinforce') {");
        expect(pendingTargetResolutionSource).toContain('mergeSpecialTroopStackGroupsAsPieces(');
    });

    it('pending battle target coordinator 应由 pendingTargetResolution owner 承接，index 不再本地展开 battle prelude 与子分支编排', () => {
        const indexSource = readDomainIndexSource();
        const pendingBattleOrchestrationSource = readPendingBattleOrchestrationSource();
        const pendingBattleFlowSource = readPendingBattleFlowSource();
        const pendingBattleFlowDependenciesSource = readPendingBattleFlowDependenciesSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(indexSource).not.toContain('resolvePendingTargetActionByActionType(');
        expect(indexSource).not.toContain('const battleResolution = resolvePendingBattleTargetAction(');
        expect(indexSource).not.toContain('const verb = pendingTargetAction.actionId === \'raid\'');
        expect(indexSource).not.toContain('const battleRegionSnapshot = getPendingActionDefenderForceSnapshot(');
        expect(pendingBattleOrchestrationSource).toBe('');
        expect(pendingBattleFlowDependenciesSource).toBe('');
        expect(pendingBattleFlowSource).toContain('resolvePendingTargetAction: resolvePendingTargetActionByActionType,');
        expect(pendingTargetResolutionSource).toContain('const battleResolution = resolvePendingBattleTargetAction(');
        expect(pendingTargetResolutionSource).not.toContain('export const resolvePendingBattleTargetAction = (');
        expect(pendingTargetResolutionSource).toContain('const resolvePendingBattleTargetAction = (');
        expect(pendingTargetResolutionSource).toContain('const noDefenderResolution = resolvePendingBattleWithoutDefenders(');
        expect(pendingTargetResolutionSource).toContain('const battleRegionSnapshot = dependencies.getPendingActionDefenderForceSnapshot(');
        expect(pendingTargetResolutionSource).toContain('const aftermathAdjustments = applyPendingTargetAftermathAdjustments(');
    });

    it('pending battle 守军已空的快速收口分支应由 pendingTargetResolution owner 承接，index 不再本地内联 no-defender resolve', () => {
        const indexSource = readDomainIndexSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(indexSource).not.toContain('resolvePendingBattleWithoutDefenders,');
        expect(indexSource).not.toContain('const noDefenderResolution = resolvePendingBattleWithoutDefenders(');
        expect(indexSource).not.toContain('if (effectiveDefenderTroops <= 0 && battleRegionSnapshot.troops <= 0) {');
        expect(pendingTargetResolutionSource).not.toContain('export const resolvePendingBattleWithoutDefenders = (');
        expect(pendingTargetResolutionSource).toContain('const resolvePendingBattleWithoutDefenders = (');
        expect(pendingTargetResolutionSource).toContain('const noDefenderResolution = resolvePendingBattleWithoutDefenders(');
        expect(pendingTargetResolutionSource).toContain('if (effectiveDefenderTroops > 0 || battleRegionSnapshotTroops > 0) {');
        expect(pendingTargetResolutionSource).toContain("if (pendingTargetAction.targetKind === 'siege-attacker') {");
        expect(pendingTargetResolutionSource).toContain("battleMode: 'city',");
        expect(pendingTargetResolutionSource).toContain('buildPostBattleSelection(');
    });

    it('联姻诱降分支应由 pendingTargetResolution owner 承接，index 不再本地内联 marriage-subjugation resolve', () => {
        const indexSource = readDomainIndexSource();
        const pendingBattleOrchestrationSource = readPendingBattleOrchestrationSource();
        const pendingBattleFlowSource = readPendingBattleFlowSource();
        const pendingBattleFlowDependenciesSource = readPendingBattleFlowDependenciesSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(indexSource).not.toContain('resolvePendingTargetActionByActionType(');
        expect(indexSource).not.toContain('const marriageSubjugationResolution = resolvePendingMarriageSubjugationTargetAction(');
        expect(indexSource).not.toContain('const marriageSubjugationResolution = resolvePendingMarriageSubjugationAction(');
        expect(pendingBattleOrchestrationSource).toBe('');
        expect(pendingBattleFlowDependenciesSource).toBe('');
        expect(pendingBattleFlowSource).toContain('resolvePendingTargetAction: resolvePendingTargetActionByActionType,');
        expect(pendingTargetResolutionSource).not.toContain('export const resolvePendingMarriageSubjugationAction = (');
        expect(pendingTargetResolutionSource).toContain('const resolvePendingMarriageSubjugationAction = (');
        expect(pendingTargetResolutionSource).not.toContain('export const resolvePendingMarriageSubjugationTargetAction = (');
        expect(pendingTargetResolutionSource).toContain('const resolvePendingMarriageSubjugationTargetAction = (');
        expect(pendingTargetResolutionSource).toContain('const marriageSubjugationResolution = resolvePendingMarriageSubjugationAction(');
        expect(pendingTargetResolutionSource).toContain("if (pendingTargetAction.actionId !== 'marriage-subjugation') {");
        expect(pendingTargetResolutionSource).toContain('const defenderPays = defenderFactionId !== \'neutral\'');
        expect(pendingTargetResolutionSource).toContain('const convertedTroops = actionTargetRegion.troops > 0 ? 1 : 0;');
        expect(pendingTargetResolutionSource).toContain('controlLabel: dependencies.getRegionControlLabel(convertedRegion),');
    });

    it('pending target 顶层路由应由 pendingTargetResolution owner 承接，index 只保留薄 wrapper', () => {
        const indexSource = readDomainIndexSource();
        const pendingBattleOrchestrationSource = readPendingBattleOrchestrationSource();
        const pendingBattleFlowSource = readPendingBattleFlowSource();
        const pendingBattleFlowDependenciesSource = readPendingBattleFlowDependenciesSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(indexSource).not.toContain('QIDAHEN_PENDING_TARGET_RESOLUTION_DEPENDENCIES,');
        expect(indexSource).not.toContain("} from './pendingTargetResolution';");
        expect(indexSource).not.toContain('resolvePendingTargetActionByActionType,');
        expect(indexSource).not.toContain('resolvePendingTargetActionByActionType(');
        expect(indexSource).not.toContain('const sourceRemovalRegionId = getPendingActionAttackerPositionRegionId(pendingTargetAction);');
        expect(indexSource).not.toContain('const siegeReinforcementResolution = resolvePendingSiegeReinforcementAction(');
        expect(indexSource).not.toContain('const battleResolution = resolvePendingBattleTargetAction(');
        expect(indexSource).not.toContain('const marriageSubjugationResolution = resolvePendingMarriageSubjugationTargetAction(');
        expect(pendingBattleOrchestrationSource).toBe('');
        expect(pendingBattleFlowDependenciesSource).toBe('');
        expect(pendingBattleFlowSource).toContain('resolvePendingTargetAction: resolvePendingTargetActionByActionType,');
        expect(pendingBattleFlowSource).toContain('resolvePendingTargetAction: resolvePendingTargetActionByActionType,');
        expect(pendingBattleFlowSource).not.toContain('QIDAHEN_PENDING_TARGET_RESOLUTION_DEPENDENCIES,');
        expect(pendingTargetResolutionSource).toContain('export const resolvePendingTargetActionByActionType = (');
        expect(pendingTargetResolutionSource).not.toContain('getPendingActionAttackerPositionRegionId,');
        expect(pendingTargetResolutionSource).toContain('const sourceRemovalRegionId = pendingTargetAction.attackerPositionRegionId ?? pendingTargetAction.sourceRegionId;');
        expect(pendingTargetResolutionSource).not.toContain('getNeutralGarrisonTroops,');
        expect(pendingTargetResolutionSource).toContain('QIDAHEN_NEUTRAL_GARRISON_MAX_TROOPS,');
        expect(pendingTargetResolutionSource).toContain("const neutralGarrisonTroops = pendingTargetAction.targetKind === 'siege-attacker'");
        expect(pendingTargetResolutionSource).toContain('getQidahenEffectivePopulation(battleRegion)');
        expect(pendingTargetResolutionSource).not.toContain('? Math.max(0, Math.min(battleRegion.population, QIDAHEN_NEUTRAL_GARRISON_MAX_TROOPS))');
        expect(pendingTargetResolutionSource).toContain('const siegeReinforcementResolution = resolvePendingSiegeReinforcementAction(');
        expect(pendingTargetResolutionSource).toContain('const battleResolution = resolvePendingBattleTargetAction(');
        expect(pendingTargetResolutionSource).toContain('const marriageSubjugationResolution = resolvePendingMarriageSubjugationTargetAction(');
    });

    it('pending battle 骑兵劫掠快速收口分支应由 pendingTargetResolution owner 承接，index 不再本地内联 cavalry-plunder resolve', () => {
        const indexSource = readDomainIndexSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(indexSource).not.toContain('resolvePendingCavalryPlunderAction,');
        expect(indexSource).not.toContain('const cavalryPlunderResolution = resolvePendingCavalryPlunderAction(');
        expect(indexSource).not.toContain('const committedCavalryStacks = getCommittedCavalryTroopStacks(');
        expect(indexSource).not.toContain('const plunderDeckText = canPlunderDefenderDeck');
        expect(pendingTargetResolutionSource).not.toContain('export const resolvePendingCavalryPlunderAction = (');
        expect(pendingTargetResolutionSource).toContain('const resolvePendingCavalryPlunderAction = (');
        expect(pendingTargetResolutionSource).toContain('const cavalryPlunderResolution = resolvePendingCavalryPlunderAction(');
        expect(pendingTargetResolutionSource).toContain('!attackerCavalryPlunder');
        expect(pendingTargetResolutionSource).toContain('dependencies.isQidahenKoreaRuntimeRegionId(battleRegion.id)');
        expect(pendingTargetResolutionSource).toContain('const committedCavalryStacks = dependencies.getCommittedCavalryTroopStacks(');
        expect(pendingTargetResolutionSource).toContain('const plunderDeckText = canPlunderDefenderDeck');
        expect(pendingTargetResolutionSource).toContain('sourceTroopLoss: cavalryLoss,');
    });

    it('pending target 战后写回链应由 pendingTargetResolution owner 承接，index 不再本地内联 aftermath adjustments', () => {
        const indexSource = readDomainIndexSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(indexSource).not.toContain('applyPendingTargetAftermathAdjustments,');
        expect(indexSource).not.toContain('const aftermathAdjustments = applyPendingTargetAftermathAdjustments(');
        expect(indexSource).not.toContain('const adjustedRuntimeRegions = nextRuntimeRegions.map((region) => {');
        expect(indexSource).not.toContain("if ((sourceTroopLoss > 0 || attackerRetreatSpecialTroops) && sourceRemovalRegionId && region.id === sourceRemovalRegionId) {");
        expect(pendingTargetResolutionSource).not.toContain('export const applyPendingTargetAftermathAdjustments = (');
        expect(pendingTargetResolutionSource).toContain('const applyPendingTargetAftermathAdjustments = (');
        expect(pendingTargetResolutionSource).toContain('const aftermathAdjustments = applyPendingTargetAftermathAdjustments(');
        expect(pendingTargetResolutionSource).toContain('sourceTroopLoss: number;');
        expect(pendingTargetResolutionSource).toContain('addTroopsToFriendlyBesiegedCityInterior(');
        expect(pendingTargetResolutionSource).toContain('pruneUnsupportedRetreatArtillery(');
    });

    it('攻方战败撤退损失共享链应内聚在 pendingTargetResolution，index 不再直接编排 attacker retreat resolve', () => {
        const indexSource = readDomainIndexSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(indexSource).not.toContain('resolvePendingAttackerRetreatLoss,');
        expect(indexSource).not.toContain('const attackerRetreatResolution = resolvePendingAttackerRetreatLoss(');
        expect(indexSource).not.toContain('const attackerSkipsDefeatLoss = hasJinDefeatLossImmunity(state, pendingTargetAction.attackerFactionId);');
        expect(indexSource).not.toContain("const structuredAttackerRout = retreatLossMode === 'rout' && !attackerSkipsDefeatLoss");
        expect(pendingTargetResolutionSource).not.toContain('export const resolvePendingAttackerRetreatLoss = (');
        expect(pendingTargetResolutionSource).toContain('const resolvePendingAttackerRetreatLoss = (');
        expect(pendingTargetResolutionSource).not.toContain('export type QidahenPendingAttackerRetreatResolution = {');
        expect(pendingTargetResolutionSource).toContain('type QidahenPendingAttackerRetreatResolution = {');
        expect(pendingTargetResolutionSource).toContain('const attackerRetreatResolution = resolvePendingAttackerRetreatLoss(');
        expect(pendingTargetResolutionSource).toContain("retreatLossMode === 'rout' && !attackerSkipsDefeatLoss");
        expect(pendingTargetResolutionSource).toContain('computeStructuredAttackerRout(');
        expect(pendingTargetResolutionSource).toContain('computeRetreatLoss(survivingAttackers, retreatLossMode)');
    });

    it('守军败退撤退损失共享链应内聚在 pendingTargetResolution，index 不再直接编排 defender retreat resolve', () => {
        const indexSource = readDomainIndexSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(indexSource).not.toContain('resolvePendingDefenderRetreatLoss,');
        expect(indexSource).not.toContain('const defenderRetreatResolution = resolvePendingDefenderRetreatLoss(');
        expect(indexSource).not.toContain('const defenderCanRetreat = captured');
        expect(indexSource).not.toContain('const structuredDefenderRout = defenderRetreatRegion');
        expect(indexSource).not.toContain('const defenderRetreatLoss = defenderSkipsDefeatLoss');
        expect(pendingTargetResolutionSource).not.toContain('export const resolvePendingDefenderRetreatLoss = (');
        expect(pendingTargetResolutionSource).toContain('const resolvePendingDefenderRetreatLoss = (');
        expect(pendingTargetResolutionSource).not.toContain('export type QidahenPendingDefenderRetreatResolution = {');
        expect(pendingTargetResolutionSource).toContain('type QidahenPendingDefenderRetreatResolution = {');
        expect(pendingTargetResolutionSource).toContain('const defenderRetreatResolution = resolvePendingDefenderRetreatLoss(');
        expect(pendingTargetResolutionSource).toContain('dependencies.findAutoDefenderRetreatRegion(state, battleRegion, defenderRetreatFactionId)');
        expect(pendingTargetResolutionSource).toContain("retreatLossMode === 'rout'");
        expect(pendingTargetResolutionSource).toContain('getSurvivingDefenderRetreatSpecialTroops(');
        expect(pendingTargetResolutionSource).toContain('pruneUnsupportedRetreatArtillery(');
    });

    it('攻方获胜后的继续攻城与战后分流应内聚在 pendingTargetResolution，index 不再本地内联 captured follow-up', () => {
        const indexSource = readDomainIndexSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(indexSource).not.toContain('resolvePendingCapturedBattleFollowup,');
        expect(indexSource).not.toContain('const capturedBattleFollowup = resolvePendingCapturedBattleFollowup(');
        expect(indexSource).not.toContain('const cityDefenderTroops = cityHoldDefense.shelteredTroops + remainingTroops;');
        expect(indexSource).not.toContain("restriction: `${pendingTargetAction.restriction} · 守城避战后继续攻城`");
        expect(indexSource).not.toContain("restriction: `${pendingTargetAction.restriction} · 守军出城野战后继续攻城`");
        expect(pendingTargetResolutionSource).not.toContain('export const resolvePendingCapturedBattleFollowup = (');
        expect(pendingTargetResolutionSource).toContain('const resolvePendingCapturedBattleFollowup = (');
        expect(pendingTargetResolutionSource).toContain('const capturedBattleFollowup = resolvePendingCapturedBattleFollowup(');
        expect(pendingTargetResolutionSource).toContain("computeQidahenAttackPressure(survivingAttackers, pendingTargetAction.battleWidth)");
        expect(pendingTargetResolutionSource).toContain('mergeSpecialTroopStackGroupsAsPieces(');
        expect(pendingTargetResolutionSource).toContain('dependencies.buildPostBattleSelection(');
    });

    it('battle outcome 的最终日志与 region state synthesis 应内聚在 pendingTargetResolution，index 不再本地内联 finalize block', () => {
        const indexSource = readDomainIndexSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(indexSource).not.toContain('finalizePendingBattleOutcome,');
        expect(indexSource).not.toContain('const finalizedBattleOutcome = finalizePendingBattleOutcome({');
        expect(indexSource).not.toContain("if (cityHoldDefense && !captured) {");
        expect(indexSource).not.toContain("if (currentBattleMode === 'city') {");
        expect(indexSource).not.toContain("neutralGarrisonTroops > 0 && battleRegion.troops <= 0");
        expect(pendingTargetResolutionSource).not.toContain('export const finalizePendingBattleOutcome = (');
        expect(pendingTargetResolutionSource).toContain('const finalizePendingBattleOutcome = (');
        expect(pendingTargetResolutionSource).toContain('const finalizedBattleOutcome = finalizePendingBattleOutcome({');
        expect(pendingTargetResolutionSource).toContain('regionCasualtyLoss: number;');
        expect(pendingTargetResolutionSource).toContain("currentBattleMode === 'city'");
        expect(pendingTargetResolutionSource).toContain('dependencies.applyCasualtyPriorityToRegion({');
    });

    it('siege-attacker outcome 应由 pendingTargetResolution owner 承接，index 不再本地内联解围成败收口', () => {
        const indexSource = readDomainIndexSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(indexSource).not.toContain('resolvePendingSiegeAttackerBattleOutcome,');
        expect(indexSource).not.toContain('const siegeAttackerResolution = resolvePendingSiegeAttackerBattleOutcome(');
        expect(indexSource).not.toContain('const attackerWinsBattle = survivingAttackersForBattle > remainingDefenderTroops;');
        expect(indexSource).not.toContain('围城军被击溃，等待友军进驻解围。');
        expect(indexSource).not.toContain('解围失败，围城军减员');
        expect(pendingTargetResolutionSource).not.toContain('export const resolvePendingSiegeAttackerBattleOutcome = (');
        expect(pendingTargetResolutionSource).toContain('const resolvePendingSiegeAttackerBattleOutcome = (');
        expect(pendingTargetResolutionSource).not.toContain('export type QidahenPendingSiegeAttackerBattleResolution = {');
        expect(pendingTargetResolutionSource).toContain('type QidahenPendingSiegeAttackerBattleResolution = {');
        expect(pendingTargetResolutionSource).toContain('const siegeAttackerResolution = resolvePendingSiegeAttackerBattleOutcome(');
        expect(pendingTargetResolutionSource).toContain('resolvePendingAttackerRetreatLoss(');
        expect(pendingTargetResolutionSource).toContain('defeatMarkerFactionId: pendingTargetAction.attackerFactionId');
        expect(pendingTargetResolutionSource).toContain('dependencies.buildPostBattleSelection(');
    });

    it('普通 battle outcome coordinator 应由 pendingTargetResolution owner 承接，index 不再本地内联 captured/retreat/finalize glue', () => {
        const indexSource = readDomainIndexSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(indexSource).not.toContain('resolvePendingGenericBattleOutcome,');
        expect(indexSource).not.toContain('const genericBattleOutcome = resolvePendingGenericBattleOutcome(');
        expect(indexSource).not.toContain('const attackerWinsBattle = survivingAttackersForBattle > remainingBattleTroops;');
        expect(indexSource).not.toContain('const battleOutcomeText = `以 ${survivingAttackersForBattle} 比 ${remainingBattleTroops} 压倒守军`;');
        expect(indexSource).not.toContain('const defeatMarkerFactionId: QidahenFactionId | null = isCityBattle');
        expect(indexSource).not.toContain('const defenderRetreatResolution = resolvePendingDefenderRetreatLoss(');
        expect(pendingTargetResolutionSource).not.toContain('export const resolvePendingGenericBattleOutcome = (');
        expect(pendingTargetResolutionSource).toContain('const resolvePendingGenericBattleOutcome = (');
        expect(pendingTargetResolutionSource).not.toContain('export type QidahenPendingGenericBattleOutcomeResolution = {');
        expect(pendingTargetResolutionSource).toContain('type QidahenPendingGenericBattleOutcomeResolution = {');
        expect(pendingTargetResolutionSource).not.toContain("export type QidahenPendingActionResolution = Pick<");
        expect(pendingTargetResolutionSource).toContain("type QidahenPendingActionResolution = Pick<");
        expect(pendingTargetResolutionSource).toContain('const genericBattleOutcome = resolvePendingGenericBattleOutcome(');
        expect(pendingTargetResolutionSource).toContain('const defenderRetreatResolution = resolvePendingDefenderRetreatLoss(');
        expect(pendingTargetResolutionSource).toContain('const capturedBattleFollowup = resolvePendingCapturedBattleFollowup(');
        expect(pendingTargetResolutionSource).toContain('const finalizedBattleOutcome = finalizePendingBattleOutcome({');
    });

    it('pending battle committed/rout helper 应由独立 support owner 承接，index 不再本地维护撤退与骑兵避战 helper', () => {
        const indexSource = readDomainIndexSource();
        const movementProfileTroopSelectionSource = readFileSync(
            resolve(TEST_DIR, '..', 'domain', 'movementProfileTroopSelection.ts'),
            'utf8',
        );
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();
        const supportSource = readPendingBattleCombatSupportSource();

        expect(pendingTargetResolutionSource).toContain("} from './pendingBattleCombatSupport';");
        expect(pendingTargetResolutionSource).toContain('applyCasualtyPriorityToRegion,');
        expect(pendingTargetResolutionSource).toContain('applyCasualtiesToSpecialStacks,');
        expect(pendingTargetResolutionSource).toContain('applyCommittedTroopRemovalToRegion,');
        expect(pendingTargetResolutionSource).toContain('computeRetreatLoss,');
        expect(pendingTargetResolutionSource).toContain('computeStructuredAttackerRout,');
        expect(pendingTargetResolutionSource).toContain('computeStructuredDefenderRout,');
        expect(pendingTargetResolutionSource).toContain('findAutoDefenderRetreatRegion,');
        expect(pendingTargetResolutionSource).toContain('getCommittedArtilleryTroopCount,');
        expect(pendingTargetResolutionSource).toContain('getCommittedCavalryTroopStacks,');
        expect(pendingTargetResolutionSource).toContain('getDefenderCavalryEvasion,');
        expect(pendingTargetResolutionSource).toContain('pruneUnsupportedRetreatArtillery,');
        expect(pendingTargetResolutionSource).toContain('takePreferredCityGarrison,');
        expect(pendingTargetResolutionSource).toContain('getSurvivingCommittedSpecialTroops,');
        expect(pendingTargetResolutionSource).toContain('getSurvivingDefenderRetreatSpecialTroops,');
        expect(indexSource).not.toContain('const applyCasualtyPriorityToRegion = (');
        expect(indexSource).not.toContain('const applyCasualtiesToSpecialStacks = (');
        expect(indexSource).not.toContain('const applyCommittedTroopRemovalToRegion = (');
        expect(indexSource).not.toContain('const computeRetreatLoss = (');
        expect(indexSource).not.toContain('const computeStructuredAttackerRout = (');
        expect(indexSource).not.toContain('const computeStructuredDefenderRout = (');
        expect(indexSource).not.toContain('const findDefenderRetreatRegions = (');
        expect(indexSource).not.toContain('const findAutoDefenderRetreatRegion = (');
        expect(indexSource).not.toContain('const getCommittedArtilleryTroopCount = (');
        expect(indexSource).not.toContain('const getCommittedCavalryTroopStacks = (');
        expect(indexSource).not.toContain('const getDefenderCavalryEvasion = (');
        expect(indexSource).not.toContain('const getSurvivingCommittedSpecialTroops = (');
        expect(indexSource).not.toContain('const getSurvivingDefenderRetreatSpecialTroops = (');
        expect(indexSource).not.toContain('const pruneUnsupportedRetreatArtillery = (');
        expect(indexSource).not.toContain('const takePreferredCityGarrison = (');

        expect(supportSource).toContain("import { isQidahenCityRuntimeRegion } from './regionConfig';");
        expect(supportSource).toContain('export const applyCasualtyPriorityToRegion = (');
        expect(supportSource).toContain('export const applyCasualtiesToSpecialStacks = (');
        expect(supportSource).toContain('export const applyCommittedTroopRemovalToRegion = <TRegion extends');
        expect(supportSource).toContain('export const computeRetreatLoss = (');
        expect(supportSource).toContain('export const computeStructuredAttackerRout = (');
        expect(supportSource).toContain('export const computeStructuredDefenderRout = (');
        expect(supportSource).toContain('export const findAutoDefenderRetreatRegion = (');
        expect(supportSource).toContain('export const getCommittedArtilleryTroopCount = (');
        expect(supportSource).toContain('export const getCommittedCavalryTroopStacks = (');
        expect(supportSource).toContain('export const getDefenderCavalryEvasion = (');
        expect(supportSource).toContain('export const pruneUnsupportedRetreatArtillery = (');
        expect(supportSource).toContain('export const takePreferredCityGarrison = (');
        expect(supportSource).toContain('export const getSurvivingCommittedSpecialTroops = (');
        expect(supportSource).toContain('export const getSurvivingDefenderRetreatSpecialTroops = (');
        expect(supportSource).toContain("} from './movementProfileTroopSelection';");
        expect(supportSource).toContain('takeCommittedSpecialTroopStacks,');
        expect(supportSource).not.toContain('const takeCommittedSpecialTroopStacks = (');
        expect(supportSource).toContain('const findDefenderRetreatRegions = (');
        expect(movementProfileTroopSelectionSource).toContain('export const takeCommittedSpecialTroopStacks = (');
    });

    it('围城城市内外转兵 helper 应由独立 owner 承接，index 不再本地维护 cityState 转移实现', () => {
        const cityInteriorTroopTransferSource = readCityInteriorTroopTransferSource();
        const grantPardonExecutionDependenciesSource = readGrantPardonExecutionDependenciesSource();
        const grantPardonExecutionSource = readGrantPardonExecutionSource();
        const indexSource = readDomainIndexSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();
        const selectedActionOrchestrationSource = readSelectedActionOrchestrationSource();

        expect(indexSource).not.toContain("} from './cityInteriorTroopTransfer';");
        expect(indexSource).not.toContain('const addTroopsToFriendlyBesiegedCityInterior = (');
        expect(indexSource).not.toContain('const removeTroopsFromNonSiegedCityStateRegion = (');
        expect(selectedActionOrchestrationSource).not.toContain("} from './cityInteriorTroopTransfer';");
        expect(grantPardonExecutionDependenciesSource).toBe('');
        expect(grantPardonExecutionSource).toContain("} from './cityInteriorTroopTransfer';");
        expect(grantPardonExecutionSource).toContain('addTroopsToFriendlyBesiegedCityInterior,');
        expect(grantPardonExecutionSource).toContain('removeTroopsFromNonSiegedCityStateRegion,');
        expect(pendingTargetResolutionSource).toContain("} from './cityInteriorTroopTransfer';");
        expect(pendingTargetResolutionSource).toContain('addTroopsToFriendlyBesiegedCityInterior,');

        expect(cityInteriorTroopTransferSource).toContain("import { isQidahenCityRuntimeRegion } from './regionConfig';");
        expect(cityInteriorTroopTransferSource).toContain("import { applyCommittedTroopRemovalToRegion } from './pendingBattleCombatSupport';");
        expect(cityInteriorTroopTransferSource).toContain('export const addTroopsToFriendlyBesiegedCityInterior = (');
        expect(cityInteriorTroopTransferSource).toContain('export const removeTroopsFromNonSiegedCityStateRegion = (');
        expect(cityInteriorTroopTransferSource).toContain('mergeSpecialTroopStackGroupsAsPieces(');
        expect(cityInteriorTroopTransferSource).toContain('applyCommittedTroopRemovalToRegion({');

        expect(grantPardonExecutionSource).toContain('addTroopsToFriendlyBesiegedCityInterior: (');
        expect(grantPardonExecutionSource).toContain('removeTroopsFromNonSiegedCityStateRegion: (');
        expect(grantPardonExecutionSource).toContain('dependencies.removeTroopsFromNonSiegedCityStateRegion(');
        expect(grantPardonExecutionSource).toContain('dependencies.addTroopsToFriendlyBesiegedCityInterior(');

        expect(pendingTargetResolutionSource).toContain('addTroopsToFriendlyBesiegedCityInterior: (');
        expect(pendingTargetResolutionSource).toContain('dependencies.addTroopsToFriendlyBesiegedCityInterior(');
    });

    it('非围城城市行动源 snapshot/materialize helper 应由 actionSourceRegionState owner 承接，battleState、index 与 selectionBuilders 只保留消费接线', () => {
        const actionSourceRegionStateSource = readActionSourceRegionStateSource();
        const actionWindowChoicesSource = readActionWindowChoicesSource();
        const actionWindowDispatchSource = readActionWindowDispatchSource();
        const battleStateSource = readBattleStateSource();
        const characterActionWindowSource = readCharacterActionWindowSource();
        const dispatchSelectionSource = readDispatchSelectionBuildersSource();
        const grantPardonExecutionSource = readGrantPardonExecutionSource();
        const indexSource = readDomainIndexSource();
        const pendingTargetActionBuilderSource = readPendingTargetActionBuilderSource();
        const regionSelectionPreferencesSource = readRegionSelectionPreferencesSource();
        const selectionSource = readSelectionBuildersSource();

        expect(indexSource).not.toContain("} from './actionSourceRegionState';");
        expect(indexSource).not.toContain('materializeNonSiegedCityActionSourceRegion,');
        expect(actionWindowChoicesSource).toContain("} from './actionSourceRegionState';");
        expect(actionWindowChoicesSource).toContain('materializeNonSiegedCityActionSourceRegion,');
        expect(actionWindowDispatchSource).toContain("} from './actionSourceRegionState';");
        expect(actionWindowDispatchSource).toContain('materializeNonSiegedCityActionSourceRegion,');
        expect(indexSource).not.toContain('const withActionRuleRegionName = (');
        expect(indexSource).not.toContain('const materializeNonSiegedCityActionSourceRegion = (');
        expect(pendingTargetActionBuilderSource).toContain("} from './actionSourceRegionState';");
        expect(pendingTargetActionBuilderSource).toContain('getNonSiegedCityActionSourceSnapshot,');
        expect(pendingTargetActionBuilderSource).toContain('materializeNonSiegedCityActionSourceRegion,');

        expect(selectionSource).toContain("} from './actionSourceRegionState';");
        expect(selectionSource).toContain('getNonSiegedCityActionSourceSnapshot,');
        expect(selectionSource).not.toContain('materializeNonSiegedCityActionSourceRegion,');
        expect(selectionSource).not.toContain('const withActionRuleRegionName = (');
        expect(selectionSource).not.toContain('const getNonSiegedCityActionSourceSnapshot = (');
        expect(selectionSource).not.toContain('const materializeNonSiegedCityActionSourceRegion = (');
        expect(dispatchSelectionSource).toContain("} from './actionSourceRegionState';");
        expect(dispatchSelectionSource).toContain('getNonSiegedCityActionSourceSnapshot,');
        expect(dispatchSelectionSource).toContain('materializeNonSiegedCityActionSourceRegion,');
        expect(dispatchSelectionSource).not.toContain('const withActionRuleRegionName = (');
        expect(dispatchSelectionSource).not.toContain('const getNonSiegedCityActionSourceSnapshot = (');
        expect(dispatchSelectionSource).not.toContain('const materializeNonSiegedCityActionSourceRegion = (');

        expect(characterActionWindowSource).toContain("import { getNonSiegedCityActionSourceSnapshot } from './actionSourceRegionState';");
        expect(grantPardonExecutionSource).toContain("} from './actionSourceRegionState';");
        expect(grantPardonExecutionSource).toContain('materializeNonSiegedCityActionSourceRegion,');
        expect(regionSelectionPreferencesSource).toContain("import { getNonSiegedCityActionSourceSnapshot } from './actionSourceRegionState';");

        expect(battleStateSource).toContain("import { getNonSiegedCityActionSourceSnapshot } from './actionSourceRegionState';");
        expect(battleStateSource).not.toContain('export const getNonSiegedCityActionSourceSnapshot = (');

        expect(actionSourceRegionStateSource).toContain("import { getActionRuleRegionNameById } from './regionRuleSemantics';");
        expect(actionSourceRegionStateSource).toContain("import { isQidahenCityRuntimeRegion } from './regionConfig';");
        expect(actionSourceRegionStateSource).not.toContain('const isQidahenCityRuntimeRegion = (');
        expect(actionSourceRegionStateSource).not.toContain('const getActionRuleRegionName = (');
        expect(actionSourceRegionStateSource).not.toContain('const withActionRuleRegionName = (');
        expect(actionSourceRegionStateSource).toContain('name: getActionRuleRegionNameById(region.id, region.name),');
        expect(actionSourceRegionStateSource).toContain('export const getNonSiegedCityActionSourceSnapshot = (');
        expect(actionSourceRegionStateSource).toContain('export const materializeNonSiegedCityActionSourceRegion = (');
    });

    it('battle state helper 应下沉到 battleState owner，index 不再硬绑 siege attacker snapshot 以外的 battle rule state', () => {
        const indexSource = readDomainIndexSource();
        const battleStateSource = readBattleStateSource();
        const dispatchSelectionSource = readDispatchSelectionBuildersSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();
        const pendingTargetActionBuilderSource = readPendingTargetActionBuilderSource();
        const postBattleDecisionResolutionSource = readPostBattleDecisionResolutionSource();
        const postBattleContractsSource = readPostBattleContractsSource();
        expect(pendingTargetResolutionSource).toContain("} from './battleState';");
        expect(pendingTargetResolutionSource).toContain('resolvePendingBattleMode,');
        expect(pendingTargetResolutionSource).toContain('getPendingActionSourceForceSnapshot,');
        expect(pendingTargetResolutionSource).toContain('getPendingActionDefenderForceSnapshot,');
        expect(pendingTargetResolutionSource).toContain('getEffectivePendingDefenderTroops,');
        expect(pendingTargetResolutionSource).toContain('getPostBattlePlunderPopulationCap,');
        expect(pendingTargetResolutionSource).toContain('isRegionFriendlyToFaction,');
        expect(indexSource).not.toContain('const resolvePendingBattleMode = (');
        expect(indexSource).not.toContain('const getBattleRegionSnapshot = (');
        expect(indexSource).not.toContain('const getFriendlyReceivingRegionSnapshot = (');
        expect(indexSource).not.toContain('const getPendingActionSourceForceSnapshot = (');
        expect(indexSource).not.toContain('const getPendingActionDefenderForceSnapshot = (');
        expect(indexSource).not.toContain('const getRegionSiegeAttackerForceSnapshot = (');
        expect(indexSource).not.toContain('const getEffectivePendingDefenderTroops = (');
        expect(indexSource).not.toContain('const getCityPopulationState = (');
        expect(indexSource).not.toContain('const getPostBattlePlunderPopulationCap = (');
        expect(indexSource).not.toContain('const getNeutralGarrisonTroops = (');
        expect(indexSource).not.toContain('const getEffectiveDefenderTroops = (');
        expect(battleStateSource).toContain('export const resolvePendingBattleMode = (');
        expect(battleStateSource).toContain('export const getBattleRegionSnapshot = (');
        expect(pendingTargetActionBuilderSource).toContain("} from './battleState';");
        expect(pendingTargetActionBuilderSource).toContain('getBattleRegionSnapshot,');
        expect(battleStateSource).toContain('export const getFriendlyReceivingRegionSnapshot = (');
        expect(battleStateSource).toContain("import { isQidahenCityRuntimeRegion, isQidahenKoreaRuntimeRegionId } from './regionConfig';");
        expect(battleStateSource).not.toContain('export const isQidahenCityRuntimeRegion = (');
        expect(battleStateSource).not.toContain('export const getPendingActionAttackerPositionRegionId = (');
        expect(battleStateSource).toContain('const getPendingActionAttackerPositionRegionId = (');
        expect(battleStateSource).toContain('export const getPendingActionSourceForceSnapshot = (');
        expect(battleStateSource).toContain('export const getPendingActionDefenderForceSnapshot = (');
        expect(battleStateSource).toContain('export const getRegionSiegeAttackerForceSnapshot = (');
        expect(battleStateSource).not.toContain('const isRegionSiegeAttackerSource = (');
        expect(battleStateSource).toContain('region.siegeState?.attackerFactionId === factionId');
        expect(battleStateSource).toContain('export const getEffectivePendingDefenderTroops = (');
        expect(battleStateSource).toContain('export const getCityPopulationState = (');
        expect(battleStateSource).toContain('export const getPostBattlePlunderPopulationCap = (');
        expect(battleStateSource).not.toContain('export const getNeutralGarrisonTroops = (');
        expect(battleStateSource).toContain('const getNeutralGarrisonTroops = (');
        expect(battleStateSource).toContain('export const getEffectiveDefenderTroops = (');
        expect(dispatchSelectionSource).toContain('getRegionSiegeAttackerForceSnapshot(region, factionId)');
        expect(postBattleDecisionResolutionSource).toContain('getCityPopulationState,');
        expect(postBattleDecisionResolutionSource).toContain('getPostBattlePlunderPopulationCap,');
        expect(pendingTargetResolutionSource).toContain("isQidahenCityRuntimeRegion,");
        expect(pendingTargetResolutionSource).not.toContain("import { resolveQidahenRuleRegionConfig } from './regionConfig';");
        expect(postBattleContractsSource).toBe('');
        expect(postBattleDecisionResolutionSource).toContain('interface QidahenPostBattleResolutionDependencies {');
        expect(postBattleDecisionResolutionSource).toContain('export type QidahenPostBattleDecisionResolution = Pick<');
        expect(postBattleDecisionResolutionSource).toContain('export const resolvePostBattleDecision = (');
    });

    it('post-battle contracts 壳应并回 postBattleDecisionResolution owner，descriptor / resolution 直接由双 owner 承接，index 只保留依赖注入与调用位点', () => {
        const indexSource = readDomainIndexSource();
        const postBattleDecisionResolutionSource = readPostBattleDecisionResolutionSource();
        const pendingBattleOrchestrationSource = readPendingBattleOrchestrationSource();
        const pendingBattleFlowSource = readPendingBattleFlowSource();
        const pendingBattleFlowDependenciesSource = readPendingBattleFlowDependenciesSource();
        const postBattleContractsSource = readPostBattleContractsSource();
        const postBattleResolutionDependenciesSource = readPostBattleResolutionDependenciesSource();
        const pendingTargetResolutionSource = readPendingTargetResolutionSource();

        expect(indexSource).not.toContain('QIDAHEN_POST_BATTLE_RESOLUTION_DEPENDENCIES,');
        expect(indexSource).not.toContain("} from './postBattleDecisionResolution';");
        expect(pendingBattleOrchestrationSource).toBe('');
        expect(pendingBattleFlowDependenciesSource).toBe('');
        expect(pendingBattleFlowSource).toContain("} from './postBattleDecisionResolution';");
        expect(pendingBattleFlowSource).toContain("from './postBattleDecisionResolution';");
        expect(pendingTargetResolutionSource).not.toContain("from './postBattleSelectionBuilder';");
        expect(pendingTargetResolutionSource).toContain('const buildPostBattleSelection = (');
        expect(indexSource).not.toContain('const buildPostBattleSelection = (');
        expect(indexSource).not.toContain('const resolvePostBattleDecision = (');
        expect(pendingBattleFlowSource).toContain('resolvePostBattleDecision: resolveQidahenPostBattleDecisionByChoice,');
        expect(pendingBattleFlowSource).not.toContain('QIDAHEN_POST_BATTLE_RESOLUTION_DEPENDENCIES,');
        expect(postBattleResolutionDependenciesSource).toBe('');
        expect(postBattleDecisionResolutionSource).not.toContain('const QIDAHEN_POST_BATTLE_RESOLUTION_DEPENDENCIES: QidahenPostBattleResolutionDependencies = {');
        expect(postBattleDecisionResolutionSource).toContain('dependencies: QidahenPostBattleResolutionDependencies = {');
        expect(postBattleContractsSource).toBe('');
        expect(postBattleDecisionResolutionSource).toContain('interface QidahenPostBattleResolutionDependencies {');
        expect(postBattleDecisionResolutionSource).toContain('export type QidahenPostBattleDecisionResolution = Pick<');
        expect(postBattleDecisionResolutionSource).toContain('export const resolvePostBattleDecision = (');
        expect(pendingTargetResolutionSource).toContain('dependencies: Pick<');
        expect(pendingTargetResolutionSource).toContain("'toFactionLabel' | 'getActionRuleDisplayRegionName'");
        expect(pendingTargetResolutionSource).not.toContain('const getPlunderPopulationCap = (');
        expect(pendingTargetResolutionSource).toContain('const plunderPopulationCap = getPostBattlePlunderPopulationCap(');
        expect(postBattleDecisionResolutionSource).toContain('export const resolvePostBattleDecision = (');
    });

    it('runtime sync seam 不应继续把 builder 实现混放在 runtimeInteractions 文件里', () => {
        const runtimeSource = readRuntimeInteractionsSource();
        const turnActionBuilderSource = readTurnActionInteractionBuildersSource();
        const battleBuilderSource = readBattleInteractionBuildersSource();

        expect(runtimeSource).not.toContain('export function buildQidahenHandLimitDiscardInteraction(');
        expect(runtimeSource).not.toContain('export function buildQidahenDiplomacyInteraction(');
        expect(runtimeSource).not.toContain('export function buildQidahenPostBattleInteraction(');
        expect(turnActionBuilderSource).toContain('function buildQidahenHandLimitDiscardInteraction(');
        expect(turnActionBuilderSource).toContain('function buildQidahenDiplomacyInteraction(');
        expect(battleBuilderSource).toContain('function buildQidahenPostBattleInteraction(');
    });

    it('runtime sync seam 应通过 builder registry 编排，不再手写一长串 sourceId 与 builder 对位', () => {
        const runtimeSource = readRuntimeInteractionsSource();
        const builderSource = readInteractionBuildersSource();
        const builderContractsSource = readRuntimeInteractionBuilderContractsSource();
        const turnActionBuilderSource = readTurnActionInteractionBuildersSource();
        const battleBuilderSource = readBattleInteractionBuildersSource();
        const builderRegistrySource = readRuntimeInteractionBuilderRegistrySource();

        expect(runtimeSource).toContain('getRegisteredQidahenRuntimeInteractionSourceIds().reduce(');
        expect(runtimeSource).toContain('buildQidahenRuntimeInteractionFromBuilders(state, sourceId)');
        expect(runtimeSource).not.toContain('const afterHandLimit = syncQidahenSpecificInteraction(');
        expect(runtimeSource).not.toContain('const QIDAHEN_RUNTIME_INTERACTION_SOURCE_IDS: readonly QidahenInteractionSourceId[] = Object.freeze([');
        expect(builderSource).not.toContain('export const QIDAHEN_RUNTIME_INTERACTION_BUILDERS: readonly QidahenRuntimeInteractionBuilderSpec[] = [');
        expect(builderSource).toContain('const QIDAHEN_RUNTIME_INTERACTION_BUILDERS: readonly QidahenRuntimeInteractionBuilderSpec[] = [');
        expect(builderSource).toContain("import type { QidahenRuntimeInteractionBuilderSpec } from './runtimeInteractionBuilderContracts';");
        expect(builderSource).toContain("import { QIDAHEN_BATTLE_RUNTIME_INTERACTION_BUILDERS } from './battleInteractionBuilders';");
        expect(builderSource).toContain("import { QIDAHEN_TURN_ACTION_RUNTIME_INTERACTION_BUILDERS } from './turnActionInteractionBuilders';");
        expect(builderSource).toContain('...QIDAHEN_TURN_ACTION_RUNTIME_INTERACTION_BUILDERS,');
        expect(builderSource).toContain('...QIDAHEN_BATTLE_RUNTIME_INTERACTION_BUILDERS,');
        expect(builderSource).not.toContain('registerQidahenRuntimeInteractionBuilder(sourceId, buildInteraction);');
        expect(builderContractsSource).toContain('export type QidahenRuntimeInteractionBuilder = (');
        expect(builderContractsSource).toContain('export interface QidahenRuntimeInteractionBuilderSpec {');
        expect(turnActionBuilderSource).toContain('sourceId: QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID,');
        expect(turnActionBuilderSource).toContain("import type { QidahenRuntimeInteractionBuilderSpec } from './runtimeInteractionBuilderContracts';");
        expect(battleBuilderSource).toContain('sourceId: QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID,');
        expect(battleBuilderSource).toContain("import type { QidahenRuntimeInteractionBuilderSpec } from './runtimeInteractionBuilderContracts';");
        expect(runtimeSource).not.toContain("import './interactionBuilders';");
        expect(builderRegistrySource).toBe('');
        expect(builderSource).toContain("import type { QidahenRuntimeInteractionBuilder } from './runtimeInteractionBuilderContracts';");
        expect(builderSource).toContain('const QIDAHEN_RUNTIME_INTERACTION_SOURCE_IDS = QIDAHEN_RUNTIME_INTERACTION_BUILDERS.map(');
        expect(builderSource).not.toContain("type QidahenRuntimeInteractionBuilder = (typeof QIDAHEN_RUNTIME_INTERACTION_BUILDERS)[number]['buildInteraction'];");
        expect(builderSource).toContain('QIDAHEN_RUNTIME_INTERACTION_BUILDERS.map(({ sourceId, buildInteraction }) => [sourceId, buildInteraction] as const),');
        expect(builderSource).toContain('export function getRegisteredQidahenRuntimeInteractionSourceIds():');
        expect(builderSource).toContain('export function buildQidahenRuntimeInteractionFromBuilders(');
        expect(builderSource).toContain('QIDAHEN_RUNTIME_INTERACTION_BUILDERS_BY_SOURCE_ID.get(sourceId)?.(state) ?? null;');
    });

    it('wheel/pending/postBattle accessor owner 应迁出 runtime 文件，避免 builder 与 snapshot getter 混在一处', () => {
        const runtimeSource = readRuntimeInteractionsSource();
        const accessorSource = readInteractionAccessorsSource();

        expect(runtimeSource).not.toContain('export function getQidahenWheelDispatchSelectionForCore(');
        expect(runtimeSource).not.toContain('export function getQidahenPendingTargetActionForCore(');
        expect(runtimeSource).not.toContain('export function getQidahenPostBattleSelectionForCore(');
        expect(runtimeSource).not.toContain('export function getQidahenDriveTigerConsentSelectionForCore(');
        expect(runtimeSource).not.toContain('export function getQidahenFortificationMaintenanceSelectionForCore(');
        expect(accessorSource).toContain('export function getQidahenWheelDispatchSelectionForCore(');
        expect(accessorSource).toContain('export function getQidahenPendingTargetActionForCore(');
        expect(accessorSource).toContain('export function getQidahenPostBattleSelectionForCore(');
        expect(accessorSource).toContain('export function getQidahenDriveTigerConsentSelectionForCore(');
        expect(accessorSource).toContain('export function getQidahenFortificationMaintenanceSelectionForCore(');
        expect(accessorSource).toContain('export const getQidahenInteractionSelectionStateForCore = <TSelection>(');
        expect(accessorSource).toContain('const getQidahenHandLimitDiscardSelectionFromInteractionData = (');
        expect(accessorSource).not.toContain('export function getQidahenHandLimitDiscardSelectionFromInteractionData(');
        expect(accessorSource).toContain('const getQidahenInteractionSelectionMirrorForCore = <TSelection>({');
        expect(accessorSource).toContain('isActive: (core: QidahenCore) => boolean;');
        expect(accessorSource).toContain('preferInteraction?: boolean;');
        expect(accessorSource).toContain('return preferInteraction');
        expect(accessorSource).toMatch(/export function getQidahenWheelDispatchSelectionForCore\([\s\S]*return getQidahenInteractionSelectionMirrorForCore\(\{[\s\S]*isActive: \(currentCore\) => currentCore\.turnPhase === 'dispatch-targeting',[\s\S]*readInteraction: getQidahenWheelDispatchSelectionFromInteraction,[\s\S]*readCore: \(currentCore\) => currentCore\.wheelDispatchProgress,[\s\S]*\}\);/);
        expect(accessorSource).toMatch(/export function getQidahenPendingTargetActionForCore\([\s\S]*return getQidahenInteractionSelectionMirrorForCore\(\{[\s\S]*isActive: \(currentCore\) => currentCore\.turnPhase === 'resolve-pending',[\s\S]*readInteraction: getQidahenPendingTargetActionFromInteraction,[\s\S]*readCore: \(currentCore\) => currentCore\.pendingTargetAction,[\s\S]*\}\);/);
        expect(accessorSource).toMatch(/export function getQidahenPostBattleSelectionForCore\([\s\S]*return getQidahenInteractionSelectionMirrorForCore\(\{[\s\S]*isActive: \(currentCore\) => currentCore\.turnPhase === 'post-battle-decision',[\s\S]*readInteraction: getQidahenPostBattleSelectionFromInteraction,[\s\S]*readCore: \(currentCore\) => currentCore\.postBattleSelection,[\s\S]*\}\);/);
        expect(accessorSource).toContain('buildDriveTigerDispatchSelectionFromRegionSemantics,');
        expect(accessorSource).toContain("import { getQidahenLockedRegionSelectionSemantics } from './regionFocusSemantics';");
        expect(accessorSource).toContain('getQidahenInternalDispatchSelectionForCore as getCoreQidahenInternalDispatchSelectionForCore,');
        expect(accessorSource).toContain('getQidahenRecruitSelectionForCore as getCoreQidahenRecruitSelectionForCore,');
        expect(accessorSource).toContain('getQidahenMaShiTradeSelectionForCore as getCoreQidahenMaShiTradeSelectionForCore,');
        expect(accessorSource).toContain('getQidahenKhanEdictSelectionForCore as getCoreQidahenKhanEdictSelectionForCore,');
        expect(accessorSource).not.toContain('getQidahenCurrentWheelDispatchSelectionForCore,');
        expect(accessorSource).toContain('const getQidahenDriveTigerConsentDispatchSelectionForCore = (');
        expect(accessorSource).toContain("if (core.turnPhase !== 'drive-tiger-consent') {");
        expect(accessorSource).toContain("const shouldRebuildDriveTigerDispatchSelection = core.lastFactionActionId === 'drive-tiger'");
        expect(accessorSource).toContain('&& !core.wheelActionUsed;');
        expect(accessorSource).toContain("? buildDriveTigerDispatchSelectionFromRegionSemantics(");
        expect(accessorSource).toContain('getQidahenLockedRegionSelectionSemantics(core)');
        expect(accessorSource).toContain('const interactionSelection = getQidahenDriveTigerConsentSelectionFromInteraction(interaction);');
        expect(accessorSource).toContain("isActive: (currentCore) => currentCore.turnPhase === 'drive-tiger-consent'");
        expect(accessorSource).toContain('readInteraction: getQidahenWheelDispatchSelectionFromInteraction,');
        expect(accessorSource).toContain('readCore: (currentCore) => currentCore.wheelDispatchProgress,');
        expect(accessorSource).toContain('}) ?? getQidahenDriveTigerConsentDispatchSelectionForCore(core);');
        expect(accessorSource).not.toContain('readCore: (currentCore) => currentCore.driveTigerConsentSelection');
        expect(accessorSource).toContain('const interactionSelection = getQidahenFortificationMaintenanceSelectionFromInteraction(interaction);');
        expect(accessorSource).not.toContain('readCore: (currentCore) => currentCore.fortificationMaintenanceSelection');
    });

    it('runtimeInteractions 不应继续充当 moved accessor 的 compat re-export 出口', () => {
        const runtimeSource = readRuntimeInteractionsSource();

        expect(runtimeSource).not.toMatch(/export\s*\{[\s\S]*getQidahenDiplomacySelectionFromInteraction,[\s\S]*\}\s*from '\.\/interactionSelectionAccessors';/);
        expect(runtimeSource).not.toMatch(/export\s*\{[\s\S]*getQidahenPendingTargetActionForCore,[\s\S]*\}\s*from '\.\/interactionSelectionAccessors';/);
        expect(runtimeSource).not.toMatch(/export\s*\{[\s\S]*getQidahenPostBattleSelectionForCore,[\s\S]*\}\s*from '\.\/interactionSelectionAccessors';/);
        expect(runtimeSource).not.toMatch(/export\s*\{[\s\S]*getQidahenWheelDispatchSelectionForCore,[\s\S]*\}\s*from '\.\/interactionSelectionAccessors';/);
        expect(runtimeSource).not.toMatch(/export\s*\{[\s\S]*QIDAHEN_WHEEL_DISPATCH_INTERACTION_SOURCE_ID,[\s\S]*\}\s*from '\.\/interactionSelectionAccessors';/);
    });

    it('runtimeInteractions 不应继续承担纯 interaction source type guard 导出', () => {
        const runtimeSource = readRuntimeInteractionsSource();

        expect(runtimeSource).not.toContain('export function isQidahenHandLimitDiscardInteraction(');
        expect(runtimeSource).not.toContain('export function isQidahenRecruitInteraction(');
        expect(runtimeSource).not.toContain('export function isQidahenDiplomacyInteraction(');
        expect(runtimeSource).not.toContain('export function isQidahenWheelDispatchInteraction(');
        expect(runtimeSource).not.toContain('export function isQidahenInternalDispatchInteraction(');
        expect(runtimeSource).not.toContain('export function isQidahenMaShiTradeInteraction(');
        expect(runtimeSource).not.toContain('export function isQidahenKhanEdictInteraction(');
        expect(runtimeSource).not.toContain('export function isQidahenDriveTigerConsentInteraction(');
        expect(runtimeSource).not.toContain('export function isQidahenFortificationMaintenanceInteraction(');
        expect(runtimeSource).not.toContain('export function isQidahenPendingTargetInteraction(');
        expect(runtimeSource).not.toContain('export function isQidahenPostBattleInteraction(');
    });

    it('interaction builder 契约类型应独立成 contract 文件，避免 builder 文件继续混放协议层定义', () => {
        const turnActionBuilderSource = readTurnActionInteractionBuildersSource();
        const battleBuilderSource = readBattleInteractionBuildersSource();
        const contractsSource = readInteractionContractsSource();

        expect(turnActionBuilderSource).not.toContain('export interface QidahenHandLimitDiscardChoiceValue {');
        expect(battleBuilderSource).not.toContain('export type QidahenPostBattleInteraction = InteractionDescriptor<');
        expect(turnActionBuilderSource).toContain("} from './interactionContracts';");
        expect(battleBuilderSource).toContain("} from './interactionContracts';");
        expect(contractsSource).not.toContain('export interface QidahenHandLimitDiscardChoiceValue {');
        expect(contractsSource).toContain('interface QidahenHandLimitDiscardChoiceValue {');
        expect(contractsSource).toContain('export type QidahenPostBattleInteraction = InteractionDescriptor<');
    });

    it('interactionBuilders 应只公开组合后的 builder list，不再承担 registry side-effect', () => {
        const builderSource = readInteractionBuildersSource();
        const builderContractsSource = readRuntimeInteractionBuilderContractsSource();
        const turnActionBuilderSource = readTurnActionInteractionBuildersSource();
        const battleBuilderSource = readBattleInteractionBuildersSource();
        const builderRegistrySource = readRuntimeInteractionBuilderRegistrySource();

        expect(builderSource).not.toContain('export type QidahenRuntimeInteractionBuilder = (');
        expect(builderSource).not.toContain('export interface QidahenRuntimeInteractionBuilderSpec {');
        expect(builderSource).not.toContain('function buildQidahenHandLimitDiscardInteraction(');
        expect(builderSource).not.toContain('function buildQidahenPostBattleInteraction(');
        expect(builderSource).not.toContain('export const QIDAHEN_RUNTIME_INTERACTION_BUILDERS');
        expect(builderSource).toContain('const QIDAHEN_RUNTIME_INTERACTION_BUILDERS');
        expect(builderSource).not.toContain('export function buildQidahenRuntimeInteractionForSource(');
        expect(builderSource).not.toContain('registerQidahenRuntimeInteractionBuilder(sourceId, buildInteraction);');
        expect(builderSource).toContain("import type { QidahenRuntimeInteractionBuilderSpec } from './runtimeInteractionBuilderContracts';");
        expect(builderContractsSource).toContain('export type QidahenRuntimeInteractionBuilder = (');
        expect(builderContractsSource).toContain('export interface QidahenRuntimeInteractionBuilderSpec {');
        expect(builderContractsSource).toContain('sourceId: QidahenInteractionSourceId;');
        expect(turnActionBuilderSource).toContain('function buildQidahenHandLimitDiscardInteraction(');
        expect(battleBuilderSource).toContain('function buildQidahenPostBattleInteraction(');
        expect(builderRegistrySource).toBe('');
        expect(builderSource).toContain("import type { QidahenRuntimeInteractionBuilder } from './runtimeInteractionBuilderContracts';");
        expect(builderSource).not.toContain("type QidahenRuntimeInteractionBuilder = (typeof QIDAHEN_RUNTIME_INTERACTION_BUILDERS)[number]['buildInteraction'];");
        expect(builderSource).not.toContain('export function registerQidahenRuntimeInteractionBuilder(');
        expect(builderSource).toContain('export function buildQidahenRuntimeInteractionFromBuilders(');
    });

    it('runtime interaction source 顺序应由 registry owner 持有，避免 runtime 文件继续复制 builder 排序真相', () => {
        const runtimeSource = readRuntimeInteractionsSource();
        const builderSource = readInteractionBuildersSource();
        const builderRegistrySource = readRuntimeInteractionBuilderRegistrySource();

        expect(runtimeSource).not.toContain('const QIDAHEN_RUNTIME_INTERACTION_SOURCE_IDS: readonly QidahenInteractionSourceId[] = Object.freeze([');
        expect(runtimeSource).toContain('getRegisteredQidahenRuntimeInteractionSourceIds().reduce(');
        expect(builderRegistrySource).toBe('');
        expect(builderSource).toContain('const QIDAHEN_RUNTIME_INTERACTION_SOURCE_IDS = QIDAHEN_RUNTIME_INTERACTION_BUILDERS.map(');
        expect(builderSource).toContain('export function getRegisteredQidahenRuntimeInteractionSourceIds():');
    });

    it('interaction sourceId 常量与读取 helper 应迁到中立 owner，避免 accessor 文件继续混挂身份常量', () => {
        const accessorSource = readInteractionAccessorsSource();
        const sourceOwner = readInteractionSourcesSource();
        const runtimeSource = readRuntimeInteractionsSource();

        expect(accessorSource).toContain("} from './interactionSources';");
        expect(accessorSource).not.toContain("export const QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID = 'qidahen:hand-limit-discard';");
        expect(accessorSource).not.toContain('const getInteractionSourceId = (interaction?: InteractionDescriptor | null): string | null => {');
        expect(accessorSource).not.toContain('export {\n    getInteractionSourceId,\n};');
        expect(sourceOwner).toContain("export const QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID = 'qidahen:hand-limit-discard';");
        expect(sourceOwner).toContain('const QIDAHEN_INTERACTION_SOURCE_IDS = [');
        expect(sourceOwner).toContain('export function isQidahenInteractionSourceId(value: unknown): value is QidahenInteractionSourceId {');
        expect(sourceOwner).toContain('export function getInteractionSourceId(');
        expect(sourceOwner).toContain('return isQidahenInteractionSourceId(sourceId) ? sourceId : null;');
        expect(runtimeSource).toContain("} from './interactionSources';");
        expect(runtimeSource).not.toContain("} from './interactionSelectionAccessors';");
        expect(runtimeSource).not.toContain('const QIDAHEN_RUNTIME_INTERACTION_SOURCE_IDS: readonly QidahenInteractionSourceId[] = Object.freeze([');
        expect(accessorSource).toContain("type QidahenInteractionSelectionCarrier = Pick<InteractionDescriptor, 'data'>;");
        expect(accessorSource).not.toContain('export function getQidahenDiplomacySelectionFromInteractionData(');
        expect(accessorSource).toContain('const getQidahenDiplomacySelectionFromInteractionData = (');
        expect(accessorSource).not.toContain('export function getQidahenRecruitSelectionFromInteractionData(');
        expect(accessorSource).toContain('const getQidahenRecruitSelectionFromInteractionData = (');
        expect(accessorSource).not.toContain('export function getQidahenWheelDispatchSelectionFromInteractionData(');
        expect(accessorSource).toContain('const getQidahenWheelDispatchSelectionFromInteractionData = (');
        expect(accessorSource).not.toContain('export function getQidahenMaShiTradeSelectionFromInteractionData(');
        expect(accessorSource).toContain('const getQidahenMaShiTradeSelectionFromInteractionData = (');
        expect(accessorSource).not.toContain('export function getQidahenKhanEdictSelectionFromInteractionData(');
        expect(accessorSource).toContain('const getQidahenKhanEdictSelectionFromInteractionData = (');
        expect(accessorSource).not.toContain('export function getQidahenDriveTigerConsentSelectionFromInteractionData(');
        expect(accessorSource).toContain('const getQidahenDriveTigerConsentSelectionFromInteractionData = (');
        expect(accessorSource).not.toContain('export function getQidahenFortificationMaintenanceSelectionFromInteractionData(');
        expect(accessorSource).toContain('const getQidahenFortificationMaintenanceSelectionFromInteractionData = (');
        expect(accessorSource).not.toContain('export function getQidahenPendingTargetActionFromInteractionData(');
        expect(accessorSource).toContain('const getQidahenPendingTargetActionFromInteractionData = (');
        expect(accessorSource).not.toContain('export function getQidahenPostBattleSelectionFromInteractionData(');
        expect(accessorSource).toContain('const getQidahenPostBattleSelectionFromInteractionData = (');
        expect(accessorSource).not.toContain('export function getQidahenInternalDispatchSelectionFromInteractionData(');
        expect(accessorSource).toContain('const getQidahenInternalDispatchSelectionFromInteractionData = (');
    });

    it('interaction bridge 应走内部 resolver registry，不再手写一长串 sourceId 分支', () => {
        const interactionSystemSource = readInteractionSystemSource();
        const interactionResolverRegistrySource = readInteractionResolverRegistrySource();
        const interactionResolutionPayloadSource = readInteractionResolutionPayloadSource();
        const pendingBattleInteractionBridgeSource = readPendingBattleInteractionBridgeSource();
        const pendingBattleInteractionEventHandlersSource = readPendingBattleInteractionEventHandlersSource();
        const turnActionChoiceOrchestrationSource = readTurnActionChoiceOrchestrationSource();
        const turnActionInteractionEventHandlersSource = readTurnActionInteractionEventHandlersSource();
        const turnActionInteractionBridgeSource = readTurnActionInteractionBridgeSource();
        const turnActionDependenciesSource = readTurnActionDependenciesSource();
        const actionWindowDispatchSource = readActionWindowDispatchSource();
        const actionWindowChoicesSource = readActionWindowChoicesSource();
        const fortificationMaintenanceSource = readFortificationMaintenanceSource();
        const handLimitDiscardSource = readHandLimitDiscardSource();

        expect(interactionResolverRegistrySource).toBe('');
        expect(interactionSystemSource).toContain("} from './interactionResolutionPayload';");
        expect(interactionSystemSource).toContain("} from './pendingBattleInteractionEventHandlers';");
        expect(interactionSystemSource).toContain("} from './turnActionInteractionEventHandlers';");
        expect(interactionSystemSource).toContain('const resolvedCore = resolveQidahenInteractionEvent(nextState, event, random);');
        expect(interactionSystemSource).not.toContain('const QIDAHEN_INTERACTION_RESOLUTION_HANDLERS: readonly QidahenInteractionResolutionHandler[] = [');
        expect(interactionSystemSource).not.toContain('if (resolvedPayload.sourceId === QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID) {');
        expect(interactionSystemSource).not.toContain('if (resolvedPayload.sourceId === QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID) {');
        expect(interactionSystemSource).toContain('type QidahenInteractionEventResolver = (');
        expect(interactionSystemSource).toContain('const QIDAHEN_INTERACTION_EVENT_RESOLVERS: readonly QidahenInteractionEventResolver[] = [');
        expect(interactionSystemSource).toContain('const resolveQidahenInteractionEvent = (');
        expect(interactionSystemSource).toContain('payload: readQidahenResolvedPayload(event),');
        expect(interactionSystemSource).toContain('for (const resolver of QIDAHEN_INTERACTION_EVENT_RESOLVERS) {');
        expect(interactionSystemSource).toContain('const resolvedCore = resolver(context);');

        expect(interactionResolutionPayloadSource).toContain("isQidahenInteractionSourceId,");
        expect(interactionResolutionPayloadSource).toContain("type QidahenInteractionSourceId,");
        expect(interactionResolutionPayloadSource).toContain('export type QidahenResolvedPayload = {');
        expect(interactionResolutionPayloadSource).toContain('export type QidahenInteractionResolutionContext = {');
        expect(interactionResolutionPayloadSource).toContain('export const readQidahenResolvedPayload = (event: GameEvent): QidahenResolvedPayload => {');
        expect(interactionResolutionPayloadSource).toContain('export const getQidahenResolvedChoiceId = (');

        expect(turnActionInteractionEventHandlersSource).toContain("} from './interactionSources';");
        expect(turnActionInteractionEventHandlersSource).toContain("} from './interactionSelectionAccessors';");
        expect(turnActionInteractionEventHandlersSource).toContain("} from './interactionResolutionPayload';");
        expect(turnActionInteractionEventHandlersSource).toContain("} from './actionWindowDispatch';");
        expect(turnActionInteractionEventHandlersSource).toContain("} from './actionWindowChoices';");
        expect(turnActionInteractionEventHandlersSource).toContain("} from './fortificationMaintenance';");
        expect(turnActionInteractionEventHandlersSource).toContain("} from './handLimitDiscard';");
        expect(turnActionInteractionEventHandlersSource).toContain('const asQidahenResolvedSelectionCarrier = (');
        expect(turnActionInteractionEventHandlersSource).toContain('...interactionData,');
        expect(turnActionInteractionEventHandlersSource).toContain('...selectionValueData,');
        expect(turnActionInteractionEventHandlersSource).toContain('const asQidahenInteractionSelectionCarrier = (interactionData?: unknown) => ({ data: interactionData });');
        expect(turnActionInteractionEventHandlersSource).toContain('const resolveQidahenHandLimitDiscardInteractionEvent = (');
        expect(turnActionInteractionEventHandlersSource).toContain('const resolveQidahenRecruitInteractionEvent = (');
        expect(turnActionInteractionEventHandlersSource).toContain('const resolveQidahenFortificationMaintenanceInteractionEvent = (');
        expect(turnActionInteractionEventHandlersSource).toContain('asQidahenResolvedSelectionCarrier(payload)');
        expect(turnActionInteractionEventHandlersSource).not.toMatch(/getQidahenRecruitSelectionFromInteraction\(\s*asQidahenInteractionSelectionCarrier\(payload\.interactionData\)/);
        expect(turnActionInteractionEventHandlersSource).not.toMatch(/getQidahenGrantPardonSelectionFromInteraction\(\s*asQidahenInteractionSelectionCarrier\(payload\.interactionData\)/);
        expect(turnActionInteractionEventHandlersSource).not.toMatch(/getQidahenDiplomacySelectionFromInteraction\(\s*asQidahenInteractionSelectionCarrier\(payload\.interactionData\)/);
        expect(turnActionInteractionEventHandlersSource).not.toMatch(/getQidahenWheelDispatchSelectionFromInteraction\(\s*asQidahenInteractionSelectionCarrier\(payload\.interactionData\)/);
        expect(turnActionInteractionEventHandlersSource).not.toMatch(/getQidahenInternalDispatchSelectionFromInteraction\(\s*asQidahenInteractionSelectionCarrier\(payload\.interactionData\)/);
        expect(turnActionInteractionEventHandlersSource).not.toMatch(/getQidahenMaShiTradeSelectionFromInteraction\(\s*asQidahenInteractionSelectionCarrier\(payload\.interactionData\)/);
        expect(turnActionInteractionEventHandlersSource).not.toMatch(/getQidahenKhanEdictSelectionFromInteraction\(\s*asQidahenInteractionSelectionCarrier\(payload\.interactionData\)/);
        expect(turnActionInteractionEventHandlersSource).not.toMatch(/getQidahenDriveTigerConsentSelectionFromInteraction\(\s*asQidahenInteractionSelectionCarrier\(payload\.interactionData\)/);
        expect(turnActionInteractionEventHandlersSource).not.toMatch(/getQidahenEventCharacterTargetSelectionFromInteraction\(\s*asQidahenInteractionSelectionCarrier\(payload\.interactionData\)/);
        expect(turnActionInteractionEventHandlersSource).not.toMatch(/getQidahenEventOpponentHandChoiceSelectionFromInteraction\(\s*asQidahenInteractionSelectionCarrier\(payload\.interactionData\)/);
        expect(turnActionInteractionEventHandlersSource).toContain('getQidahenRecruitSelectionFromInteraction(');
        expect(turnActionInteractionEventHandlersSource).toContain('getQidahenDiplomacySelectionFromInteraction(');
        expect(turnActionInteractionEventHandlersSource).toContain('getQidahenWheelDispatchSelectionFromInteraction(');
        expect(turnActionInteractionEventHandlersSource).toContain('getQidahenInternalDispatchSelectionFromInteraction(');
        expect(turnActionInteractionEventHandlersSource).toContain('getQidahenMaShiTradeSelectionFromInteraction(');
        expect(turnActionInteractionEventHandlersSource).toContain('getQidahenKhanEdictSelectionFromInteraction(');
        expect(turnActionInteractionEventHandlersSource).toContain('getQidahenDriveTigerConsentSelectionFromInteraction(');
        expect(turnActionInteractionEventHandlersSource).toContain('getQidahenFortificationMaintenanceSelectionFromInteraction(');
        expect(turnActionInteractionEventHandlersSource).not.toContain('getQidahenRecruitSelectionFromInteractionData(');
        expect(turnActionInteractionEventHandlersSource).not.toContain('getQidahenDiplomacySelectionFromInteractionData(');
        expect(turnActionInteractionEventHandlersSource).not.toContain('getQidahenWheelDispatchSelectionFromInteractionData(');
        expect(turnActionInteractionEventHandlersSource).not.toContain('getQidahenInternalDispatchSelectionFromInteractionData(');
        expect(turnActionInteractionEventHandlersSource).not.toContain('getQidahenMaShiTradeSelectionFromInteractionData(');
        expect(turnActionInteractionEventHandlersSource).not.toContain('getQidahenKhanEdictSelectionFromInteractionData(');
        expect(turnActionInteractionEventHandlersSource).not.toContain('getQidahenDriveTigerConsentSelectionFromInteractionData(');
        expect(turnActionInteractionEventHandlersSource).not.toContain('getQidahenFortificationMaintenanceSelectionFromInteractionData(');
        expect(turnActionInteractionEventHandlersSource).toContain('export const resolveQidahenTurnActionInteractionEvent = (');

        expect(pendingBattleInteractionEventHandlersSource).toContain("} from './interactionSources';");
        expect(pendingBattleInteractionEventHandlersSource).toContain("} from './interactionSelectionAccessors';");
        expect(pendingBattleInteractionEventHandlersSource).toContain("} from './interactionResolutionPayload';");
        expect(pendingBattleInteractionEventHandlersSource).toContain("} from './pendingBattleFlow';");
        expect(pendingBattleInteractionEventHandlersSource).not.toContain("} from './pendingBattleFlowDependencies';");
        expect(pendingBattleInteractionEventHandlersSource).toContain('const asQidahenInteractionSelectionCarrier = (interactionData?: unknown) => ({ data: interactionData });');
        expect(pendingBattleInteractionEventHandlersSource).toContain('const resolveQidahenPendingTargetInteractionEvent = (');
        expect(pendingBattleInteractionEventHandlersSource).toContain('const resolveQidahenPostBattleInteractionEvent = (');
        expect(pendingBattleInteractionEventHandlersSource).toContain('getQidahenPendingTargetActionFromInteraction(');
        expect(pendingBattleInteractionEventHandlersSource).toContain('getQidahenPostBattleSelectionFromInteraction(');
        expect(pendingBattleInteractionEventHandlersSource).not.toContain('getQidahenPendingTargetActionFromInteractionData(');
        expect(pendingBattleInteractionEventHandlersSource).not.toContain('getQidahenPostBattleSelectionFromInteractionData(');
        expect(pendingBattleInteractionEventHandlersSource).toContain('resolveQidahenPendingTargetInteractionChoice(');
        expect(pendingBattleInteractionEventHandlersSource).toContain('resolveQidahenPostBattleInteractionChoice(');
        expect(pendingBattleInteractionEventHandlersSource).not.toContain('QIDAHEN_PENDING_BATTLE_FLOW_DEPENDENCIES,');
        expect(pendingBattleInteractionEventHandlersSource).toContain('export const resolveQidahenPendingBattleInteractionEvent = (');

        expect(turnActionInteractionBridgeSource).toBe('');
        expect(turnActionChoiceOrchestrationSource).toBe('');
        expect(turnActionDependenciesSource).toBe('');
        expect(actionWindowChoicesSource).not.toContain('export const QIDAHEN_ACTION_WINDOW_CHOICE_DEPENDENCIES: QidahenActionWindowChoiceDependencies = {');
        expect(actionWindowChoicesSource).not.toContain('const QIDAHEN_ACTION_WINDOW_CHOICE_DEPENDENCIES: QidahenActionWindowChoiceDependencies = {');
        expect(actionWindowDispatchSource).not.toContain('export const QIDAHEN_ACTION_WINDOW_DISPATCH_DEPENDENCIES: QidahenActionWindowDispatchDependencies = {');
        expect(actionWindowDispatchSource).not.toContain('const QIDAHEN_ACTION_WINDOW_DISPATCH_DEPENDENCIES: QidahenActionWindowDispatchDependencies = {');
        expect(fortificationMaintenanceSource).not.toContain('export const QIDAHEN_FORTIFICATION_MAINTENANCE_DEPENDENCIES: QidahenFortificationMaintenanceDependencies = {');
        expect(fortificationMaintenanceSource).not.toContain('const QIDAHEN_FORTIFICATION_MAINTENANCE_DEPENDENCIES: QidahenFortificationMaintenanceDependencies = {');
        expect(handLimitDiscardSource).not.toContain('export const QIDAHEN_HAND_LIMIT_DISCARD_DEPENDENCIES: QidahenHandLimitDiscardDependencies = {');
        expect(handLimitDiscardSource).not.toContain('const QIDAHEN_HAND_LIMIT_DISCARD_DEPENDENCIES: QidahenHandLimitDiscardDependencies = {');

        expect(pendingBattleInteractionBridgeSource).toBe('');
    });

    it('internal-dispatch interaction builder 也应走正式 interaction seam，避免继续直读 raw interactionData 桥', () => {
        const turnActionBuilderSource = readTurnActionInteractionBuildersSource();

        expect(turnActionBuilderSource).toContain('getQidahenInternalDispatchSelectionForCore(state.core, state.sys.interaction?.current);');
        expect(turnActionBuilderSource).not.toContain('getQidahenInternalDispatchSelectionFromInteraction(');
        expect(turnActionBuilderSource).not.toContain('getQidahenInternalDispatchSelectionFromInteractionData(');
    });

    it('pendingTarget choice payload 应由共享 helper owner 承接，避免 builder 与 resolver 各自手写同一套字段语义', () => {
        const builderSource = readBattleInteractionBuildersSource();
        const indexSource = readDomainIndexSource();
        const pendingBattleFlowSource = readPendingBattleFlowSource();
        const payloadSource = readPendingTargetChoicePayloadSource();
        const optionsSource = readPendingTargetChoiceOptionsSource();
        const boardSource = readBoardSource();

        expect(builderSource).toContain("} from './pendingTargetChoiceOptions';");
        expect(optionsSource).not.toContain('export interface QidahenPendingTargetChoiceOption {');
        expect(optionsSource).toContain('interface QidahenPendingTargetChoiceOption {');
        expect(builderSource).not.toContain("} from './pendingTargetChoicePayload';");
        expect(builderSource).not.toContain('value: buildPendingTargetRearGuardChoiceValue(),');
        expect(builderSource).not.toContain('value: buildPendingTargetRoutChoiceValue(),');
        expect(builderSource).not.toContain('value: buildPendingTargetAttackerCavalryPlunderChoiceValue(source),');
        expect(builderSource).not.toContain('value: buildPendingTargetDefenderCavalryEvasionChoiceValue(choice.id),');
        expect(boardSource).toContain("} from './domain/pendingTargetChoiceOptions';");
        expect(boardSource).not.toContain('骑兵劫掠己方牌堆');
        expect(boardSource).not.toContain('骑兵劫掠守方牌堆');
        expect(boardSource).not.toContain('骑兵避战至{choice.name}');
        expect(boardSource).not.toContain("onResolvePendingAction('rear-guard'");
        expect(boardSource).not.toContain("onResolvePendingAction('rout'");
        expect(pendingBattleFlowSource).toContain("import { normalizePendingTargetInteractionPayload } from './pendingTargetChoicePayload';");
        expect(indexSource).not.toContain("import { normalizePendingTargetInteractionPayload } from './pendingTargetChoicePayload';");
        expect(pendingBattleFlowSource).not.toContain('function normalizePendingTargetInteractionPayload(');
        expect(optionsSource).toContain("} from './pendingTargetChoicePayload';");
        expect(optionsSource).toContain('value: buildPendingTargetRearGuardChoiceValue(),');
        expect(optionsSource).toContain('value: buildPendingTargetRoutChoiceValue(),');
        expect(optionsSource).toContain("'cavalry-plunder-attacker',");
        expect(optionsSource).toContain("'骑兵劫掠己方牌堆',");
        expect(optionsSource).toContain("'battle.pendingTargetChoice.cavalryPlunderAttacker',");
        expect(optionsSource).toContain("value: buildPendingTargetAttackerCavalryPlunderChoiceValue(source),");
        expect(optionsSource).toContain("'cavalry-plunder-defender',");
        expect(optionsSource).toContain("'骑兵劫掠守方牌堆',");
        expect(optionsSource).toContain("'battle.pendingTargetChoice.cavalryPlunderDefender',");
        expect(optionsSource).toContain("'defender',");
        expect(optionsSource).toContain('value: buildPendingTargetDefenderCavalryEvasionChoiceValue(choice.id),');
        expect(payloadSource).toContain('export const buildPendingTargetRearGuardChoiceValue = (): QidahenPendingTargetChoiceValue => ({');
        expect(payloadSource).toContain('export const buildPendingTargetAttackerCavalryPlunderChoiceValue = (');
        expect(payloadSource).toContain('export const normalizePendingTargetInteractionPayload = (');
    });

    it('region tag 语义应继续收口到 regionConfig owner，battle 与 pending-target consumer 不再直接拆 tag', () => {
        const boardSource = readBoardSource();
        const battleBuilderSource = readBattleInteractionBuildersSource();
        const choiceAvailabilitySource = readPendingTargetChoiceOptionsSource();
        const pendingTargetActionBuilderSource = readPendingTargetActionBuilderSource();
        const regionConfigSource = readRegionConfigSource();

        expect(regionConfigSource).not.toContain('export const isQidahenCapitalRuntimeRegion = (regionId: string): boolean => (');
        expect(regionConfigSource).not.toContain('export const isQidahenSouthOfWallRuntimeRegion = (regionId: string): boolean => (');
        expect(regionConfigSource).not.toContain('export const getQidahenRuleRegionTags = (');
        expect(regionConfigSource).not.toContain('export const getQidahenCapitalOwner = (regionId: string): QidahenFactionId | null => (');
        expect(regionConfigSource).not.toContain('export const getQidahenPrestigeCardBonus = (regionId: string): number => (');
        expect(regionConfigSource).not.toContain("export const getQidahenPrestigeCardBonusUnlock = (");
        expect(regionConfigSource).not.toContain('export const getQidahenKoreaTributeCards = (regionId: string): number => (');
        expect(regionConfigSource).not.toContain('export const getQidahenInitialTroops = (regionId: string): number => (');
        expect(regionConfigSource).not.toContain('export const getQidahenInitialPopulation = (regionId: string): number => (');
        expect(regionConfigSource).not.toContain('export const getQidahenInitialNote = (regionId: string): string | null => (');
        expect(regionConfigSource).not.toContain('export const QIDAHEN_RULE_REGION_CONFIG_BY_ID = new Map(');
        expect(regionConfigSource).not.toContain('export const QIDAHEN_KOREA_RUNTIME_REGION_IDS = runtimeRegionConfigs');
        expect(regionConfigSource).not.toContain('export const QIDAHEN_MAINTENANCE_TARGET_REGION_IDS = runtimeRegionConfigs');
        expect(regionConfigSource).not.toContain('export const QIDAHEN_FORTIFICATION_CONFIG_BY_ID = new Map(');
        expect(regionConfigSource).not.toContain('export type QidahenRegionTag =');
        expect(regionConfigSource).not.toContain('export type QidahenFortificationId =');
        expect(regionConfigSource).not.toContain('export interface QidahenRuleRegionConfig {');
        expect(regionConfigSource).not.toContain('export interface QidahenFortificationConfig {');
        expect(regionConfigSource).toContain('type QidahenRegionTag =');
        expect(regionConfigSource).toContain('type QidahenFortificationId =');
        expect(regionConfigSource).toContain('interface QidahenRuleRegionConfig {');
        expect(regionConfigSource).toContain('const QIDAHEN_RULE_REGION_CONFIG_BY_ID = new Map(');
        expect(regionConfigSource).toContain('const QIDAHEN_KOREA_RUNTIME_REGION_IDS = runtimeRegionConfigs');
        expect(regionConfigSource).not.toContain('const QIDAHEN_MAINTENANCE_TARGET_REGION_IDS = runtimeRegionConfigs');
        expect(regionConfigSource).not.toContain('const QIDAHEN_FORTIFICATION_CONFIG_BY_ID = new Map(');
        expect(regionConfigSource).toContain('interface QidahenFortificationConfig {');
        expect(regionConfigSource).not.toContain('export const QIDAHEN_FORTIFICATION_CONFIGS: QidahenFortificationConfig[] = [');
        expect(regionConfigSource).toContain('const QIDAHEN_FORTIFICATION_CONFIGS: QidahenFortificationConfig[] = [');
        expect(regionConfigSource).toContain('export const getQidahenFortificationConfigs = () => (');

        expect(choiceAvailabilitySource).toContain('isQidahenCityRuntimeRegion,');
        expect(choiceAvailabilitySource).toContain('isQidahenKoreaRuntimeRegionId,');
        expect(choiceAvailabilitySource).not.toContain("import { getQidahenRuleRegionTags } from './regionConfig';");
        expect(choiceAvailabilitySource).not.toContain("getQidahenRuleRegionTags(pending.targetRuntimeRegionId).includes('city')");
        expect(choiceAvailabilitySource).not.toContain("targetTags.includes('city') || targetTags.includes('korea')");
        expect(choiceAvailabilitySource).toContain("if (isQidahenCityRuntimeRegion(pending.targetRuntimeRegionId)) {");
        expect(choiceAvailabilitySource).toContain("|| isQidahenKoreaRuntimeRegionId(pending.targetRuntimeRegionId)");

        expect(battleBuilderSource).not.toContain('isQidahenCityRuntimeRegion,');
        expect(battleBuilderSource).not.toContain('isQidahenKoreaRuntimeRegionId,');
        expect(battleBuilderSource).not.toContain("import { getQidahenRuleRegionTags } from './regionConfig';");
        expect(battleBuilderSource).not.toContain("getQidahenRuleRegionTags(pending.targetRuntimeRegionId).includes('city')");
        expect(battleBuilderSource).not.toContain("targetTags.includes('city') || targetTags.includes('korea')");
        expect(boardSource).not.toContain("import { getQidahenRuleRegionTags } from './domain/regionConfig';");
        expect(boardSource).not.toContain("getQidahenRuleRegionTags(pending.targetRuntimeRegionId).includes('city')");
        expect(boardSource).not.toContain("targetTags.includes('city') || targetTags.includes('korea')");

        expect(pendingTargetActionBuilderSource).not.toContain('isQidahenCapitalRuntimeRegion,');
        expect(pendingTargetActionBuilderSource).toContain('isQidahenKoreaRuntimeRegionId,');
        expect(pendingTargetActionBuilderSource).not.toContain('isQidahenSouthOfWallRuntimeRegion,');
        expect(pendingTargetActionBuilderSource).toContain('resolveQidahenRuleRegionConfig,');
        expect(pendingTargetActionBuilderSource).not.toContain("targetConfig.tags.includes('capital')");
        expect(pendingTargetActionBuilderSource).not.toContain("targetConfig.tags.includes('korea')");
        expect(pendingTargetActionBuilderSource).not.toContain("targetConfig.tags.includes('south-of-wall')");
        expect(pendingTargetActionBuilderSource).toContain('const targetRuleRegionConfig = resolveQidahenRuleRegionConfig(targetRuntimeRegionId);');
        expect(pendingTargetActionBuilderSource).toContain('if (targetRuleRegionConfig.capitalOf != null) {');
        expect(pendingTargetActionBuilderSource).toContain('if (isQidahenKoreaRuntimeRegionId(targetRuntimeRegionId)) {');
        expect(pendingTargetActionBuilderSource).toContain("if (targetRuleRegionConfig.tags.includes('south-of-wall')) {");
    });

    it('wheelDispatchProgress 应直接指向真实选择形状，避免 types owner 继续保留零外部 caller 的导出别名桥', () => {
        const typesSource = readTypesSource();

        expect(typesSource).not.toContain('export type QidahenWheelDispatchProgress = QidahenWheelDispatchSelection;');
        expect(typesSource).not.toContain('type QidahenWheelDispatchProgress = QidahenWheelDispatchSelection;');
        expect(typesSource).toContain('wheelDispatchProgress: QidahenWheelDispatchSelection | null;');
    });

    it('types owner 下零外部 caller 的标量别名应直接内联到真实字段，避免继续保留导出壳', () => {
        const typesSource = readTypesSource();

        expect(typesSource).not.toContain("export type QidahenDiplomacyMarkerSide = 'friendly' | 'vassal';");
        expect(typesSource).toContain("diplomacyMarkerSide: 'friendly' | 'vassal' | null;");
        expect(typesSource).not.toContain("export type QidahenGaoDiDispatchMode = 'troops' | 'population';");
        expect(typesSource).toContain("mode: 'troops' | 'population';");
        expect(typesSource).not.toContain("export type QidahenHandCardKind = 'unknown' | 'event' | 'armament' | 'tactic' | 'silver';");
        expect(typesSource).toContain("cardKind?: 'unknown' | 'event' | 'armament' | 'tactic' | 'silver' | 'character' | 'scenario' | 'chronology' | 'card-back';");
    });

    it('pending-battle targetKind 与 turnPhase 应直接收口到真实字段，避免 types owner 继续保留零外部 caller 的导出联合别名', () => {
        const typesSource = readTypesSource();

        expect(typesSource).not.toContain("export type QidahenPendingBattleTargetKind = 'region' | 'siege-attacker' | 'siege-reinforce';");
        expect(typesSource).toContain("targetKind?: 'region' | 'siege-attacker' | 'siege-reinforce';");
        expect(typesSource).not.toContain('export type QidahenTurnPhase =');
        expect(typesSource).toContain('turnPhase:');
        expect(typesSource).toContain("| 'season-resolution';");
    });

    it('types owner 下零外部 caller 的嵌套子形状应退回本地 interface，避免继续暴露假公共状态壳', () => {
        const typesSource = readTypesSource();

        expect(typesSource).not.toContain('export interface QidahenSiegeState {');
        expect(typesSource).toContain('interface QidahenSiegeState {');
        expect(typesSource).not.toContain('export interface QidahenCityState {');
        expect(typesSource).toContain('interface QidahenCityState {');
        expect(typesSource).not.toContain('export interface QidahenBattleRollStage {');
        expect(typesSource).toContain('interface QidahenBattleRollStage {');
        expect(typesSource).not.toContain('export interface QidahenRouteLine {');
        expect(typesSource).toContain('interface QidahenRouteLine {');
        expect(typesSource).not.toContain('export interface QidahenLogEntry {');
        expect(typesSource).toContain('interface QidahenLogEntry {');
    });

    it('types owner 下零外部 caller 的选择与剧本子形状也应退回本地 interface，避免继续暴露假公共契约', () => {
        const typesSource = readTypesSource();

        expect(typesSource).not.toContain('export interface QidahenScenarioFactionPreset {');
        expect(typesSource).toContain('interface QidahenScenarioFactionPreset {');
        expect(typesSource).not.toContain('export interface QidahenInternalDispatchCandidate {');
        expect(typesSource).toContain('interface QidahenInternalDispatchCandidate {');
        expect(typesSource).not.toContain('export interface QidahenGaoDiDispatchCandidate {');
        expect(typesSource).toContain('interface QidahenGaoDiDispatchCandidate {');
    });

    it('types owner 下零外部 caller 的场景命令与场景 resolved-event 接口也应退回本地 interface', () => {
        const typesSource = readTypesSource();

        expect(typesSource).not.toContain("export interface ResolveScenarioCharacterChoiceCommand extends Command<'RESOLVE_SCENARIO_CHARACTER_CHOICE'> {");
        expect(typesSource).toContain("interface ResolveScenarioCharacterChoiceCommand extends Command<'RESOLVE_SCENARIO_CHARACTER_CHOICE'> {");
        expect(typesSource).not.toContain("export interface ResolveScenarioArmamentChoiceCommand extends Command<'RESOLVE_SCENARIO_ARMAMENT_CHOICE'> {");
        expect(typesSource).toContain("interface ResolveScenarioArmamentChoiceCommand extends Command<'RESOLVE_SCENARIO_ARMAMENT_CHOICE'> {");
        expect(typesSource).not.toContain("export interface ScenarioCharacterChoiceResolvedEvent extends GameEvent<'SCENARIO_CHARACTER_CHOICE_RESOLVED'> {");
        expect(typesSource).toContain("interface ScenarioCharacterChoiceResolvedEvent extends GameEvent<'SCENARIO_CHARACTER_CHOICE_RESOLVED'> {");
        expect(typesSource).not.toContain("export interface ScenarioArmamentChoiceResolvedEvent extends GameEvent<'SCENARIO_ARMAMENT_CHOICE_RESOLVED'> {");
        expect(typesSource).toContain("interface ScenarioArmamentChoiceResolvedEvent extends GameEvent<'SCENARIO_ARMAMENT_CHOICE_RESOLVED'> {");
        expect(typesSource).not.toContain("export interface ExecuteSelectedActionCommand extends Command<'EXECUTE_SELECTED_ACTION'> {");
        expect(typesSource).toContain("interface ExecuteSelectedActionCommand extends Command<'EXECUTE_SELECTED_ACTION'> {");
        expect(typesSource).not.toContain("export interface ExecuteActionCommand extends Command<'EXECUTE_ACTION'> {");
        expect(typesSource).toContain("interface ExecuteActionCommand extends Command<'EXECUTE_ACTION'> {");
    });

    it('已识别手牌直点必须把手牌来源带进预览事件，不能只退化成抽象动作预览', () => {
        const boardSource = readBoardSource();
        const commandEventBuildersSource = readCommandEventBuildersSource();
        const previewActionReducerSource = readPreviewActionReducerSource();
        const selectionInputStateSource = readSelectionInputStateSource();
        const commandsSource = readCommandsSource();
        const stateCommitSource = readSelectedActionStateCommitSource();
        const viewSource = readViewSource();
        const typesSource = readTypesSource();

        expect(typesSource).toContain('selectedHandActionCardId: string | null;');
        expect(typesSource).toContain('sourceHandCardId?: string;');
        expect(typesSource).toContain('sourceHandCardId?: string | null;');
        expect(boardSource).toContain('previewAction(actionId, getQidahenHandCardTutorialTargetId(card), card.id);');
        expect(commandEventBuildersSource).toContain('sourceHandCardId: command.payload.sourceHandCardId ?? null,');
        expect(previewActionReducerSource).toContain('selectedHandActionCardId: sourceCard?.id ?? null,');
        expect(previewActionReducerSource).toContain('const nextState: QidahenCore = {');
        expect(previewActionReducerSource).toContain('payment: state.payment,');
        expect(previewActionReducerSource).toContain('payment: buildPaymentState(');
        expect(previewActionReducerSource).toContain('getQidahenSelectedActionCost(nextState, actionId),');
        expect(selectionInputStateSource).toContain('if (state.selectedHandActionCardId === cardId) {');
        expect(commandsSource).toContain('getQidahenDirectActionIdForHandCard(sourceCard) === actionId');
        expect(stateCommitSource).toContain('selectedHandActionCardId: null,');
        expect(viewSource).toContain('selectedHandActionCardId: state.selectedHandActionCardId && visibleHandCardIdSet.has(state.selectedHandActionCardId)');
    });

    it('types owner 下零外部 caller 的场景待决子形状也应退回本地 interface，scenarioChoiceState 只按 QidahenCore 子字段取型', () => {
        const typesSource = readTypesSource();
        const stateSource = readScenarioChoiceStateSource();

        expect(typesSource).not.toContain('export interface QidahenPendingScenarioCharacterChoice {');
        expect(typesSource).toContain('interface QidahenPendingScenarioCharacterChoice {');
        expect(typesSource).not.toContain('export interface QidahenPendingScenarioArmamentChoice {');
        expect(typesSource).toContain('interface QidahenPendingScenarioArmamentChoice {');
        expect(stateSource).not.toContain('QidahenPendingScenarioCharacterChoice,');
        expect(stateSource).not.toContain('QidahenPendingScenarioArmamentChoice,');
        expect(stateSource).toContain("type QidahenPendingScenarioCharacterChoice = QidahenCore['pendingScenarioCharacterChoices'][number];");
        expect(stateSource).toContain("type QidahenPendingScenarioArmamentChoice = QidahenCore['pendingScenarioArmamentChoices'][number];");
    });

    it('types owner 下单一外部 type caller 的 region/year/piece 子形状也应退回本地，consumer 只按核心字段取型', () => {
        const typesSource = readTypesSource();
        const movementSource = readMovementSource();
        const boardSource = readBoardSource();
        const troopCompatSource = readTroopCompatSource();

        expect(typesSource).not.toContain('export interface QidahenRegionSummary {');
        expect(typesSource).toContain('interface QidahenRegionSummary {');
        expect(typesSource).not.toContain("export type QidahenPieceLocation = 'field' | 'city' | 'siege-attacker';");
        expect(typesSource).toContain("type QidahenPieceLocation = 'field' | 'city' | 'siege-attacker';");
        expect(typesSource).not.toContain('export interface QidahenYearCardSlot {');
        expect(typesSource).toContain('interface QidahenYearCardSlot {');
        expect(movementSource).not.toContain("import type { QidahenCore, QidahenFactionId, QidahenRegionSummary } from './types';");
        expect(movementSource).toContain("type QidahenRegionSummary = QidahenCore['regions'][number];");
        expect(boardSource).not.toContain('QidahenYearCardSlot,');
        expect(boardSource).toContain("type QidahenYearCardSlot = QidahenCore['yearCards'][number];");
        expect(troopCompatSource).not.toContain("    QidahenPieceLocation,\n");
        expect(troopCompatSource).toContain("type QidahenPieceLocation = QidahenPiece['location'];");
    });
});
