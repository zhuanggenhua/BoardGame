import { fateKireiForm, resolveFateAbilitySource, fateAbilityUsageKey } from './abilitySource';
import { fateLateClimax, fateNoblePhantasmsForbidden } from './environmentRules';
import type { MatchState, ValidationResult } from '../../../engine/types';
import { FATE_ATTACK_BY_ID, FATE_MASTERS, FATE_SERVANT_BY_ID } from '../data';
import { FATE_BATTLE_LOCATION_ORDER } from './types';
import type { FateDominationCommand, FateDominationCore, LocationId } from './types';
import { canPlayAttack, movementFailureToError, resolveFateMovement } from './movement';
import { canUseFateAbility } from './mechanics';
import { resolveFateAbilityDefinition, resolveFatePlayerAbility } from './abilityRegistry';
import {resolveFateAttack,resolveFateAttackConfirmation,selectedFateAttackCost,hasLegalFateNormalPlay,canSelectFateAttack,hasAffordableFateFaceUpAttack} from './attackSelection';

const ok = (): ValidationResult => ({ valid: true });
const fail = (error: string): ValidationResult => ({ valid: false, error });

const isCurrentPlayer = (core: FateDominationCore, command: FateDominationCommand) =>
    command.skipValidation === true || command.playerId === core.currentPlayerId;

const locationExists = (locationId: string): locationId is LocationId =>
    ['workshop', 'miyama', 'shinto', 'recon'].includes(locationId);

const abilityPhaseFor = (phase: FateDominationCore['phase']) =>
    phase === 'preparation' || phase === 'outpost' || phase === 'action' || phase === 'battle' ? phase : undefined;

export function validate(state: MatchState<FateDominationCore>, command: FateDominationCommand): ValidationResult {
    const core = state.core;
    if (!core.playerIds.includes(command.playerId)) return fail('unknownPlayer');
    if (core.phase === 'complete') return fail('gameOver');
    if (core.players[command.playerId].eliminated) return fail('playerEliminated');

    switch (command.type) {
        case 'USE_COMMAND_SPELL': {
            if (core.phase !== 'action') return fail('wrongPhase');
            if (!isCurrentPlayer(core, command)) return fail('notYourTurn');
            const player = core.players[command.playerId];
            if (player.eliminated) return fail('playerEliminated');
            if (!canUseFateAbility(core, player.id, 'action').valid) return fail('abilitySuppressed');
            if (player.commandSpells < 1) return fail('noCommandSpells');
            if (!['mana', 'battle', 'move'].includes(command.payload.effect)) return fail('unknownCommandSpellEffect');
            if (command.payload.effect !== 'move') return ok();
            if (player.locationId !== 'miyama' && player.locationId !== 'shinto') return fail('commandSpellMoveOrigin');
            const target = command.payload.targetLocationId;
            if (!target || !locationExists(target)) return fail('unknownLocation');
            const resolution = resolveFateMovement(core, command.playerId, target, 'effect', { allowAnyDestination: true, ignoreEngagement: true, free: true });
            return resolution.valid ? ok() : fail(movementFailureToError(resolution) ?? 'moveNotAllowed');
        }
        case 'SELECT_MASTER':
            if (core.round !== 1 || core.phase !== 'preparation') return fail('identityLocked');
            if ((core.phaseCompletedPlayerIds ?? []).includes(command.playerId)
                || (core.initialAttackHandDealtPlayerIds ?? []).includes(command.playerId)
                || (core.players[command.playerId]?.hand?.length ?? 0) > 0) return fail('identityLocked');
            return FATE_MASTERS.some((master) => master.id === command.payload.masterId)
                ? ok() : fail('unknownMaster');
        case 'SELECT_SERVANT':
            if (core.round !== 1 || core.phase !== 'preparation') return fail('identityLocked');
            if ((core.phaseCompletedPlayerIds ?? []).includes(command.playerId)
                || (core.initialAttackHandDealtPlayerIds ?? []).includes(command.playerId)
                || (core.players[command.playerId]?.hand?.length ?? 0) > 0) return fail('identityLocked');
            return FATE_SERVANT_BY_ID[command.payload.servantId] ? ok() : fail('unknownServant');
        case 'DEPLOY_MASTER': {
            if (fateLateClimax(core.situation) && ['shinto','recon'].includes(command.payload.locationId)) return fail('cannotEnterLocation');
            if (command.payload.locationId === 'recon') return fail('cannotDeployToRecon');
            if (core.phase !== 'outpost') return fail('wrongPhase');
            if (!isCurrentPlayer(core, command)) return fail('notYourTurn');
            if (core.players[command.playerId].locationId) return fail('alreadyDeployed');
            if (!locationExists(command.payload.locationId)) return fail('unknownLocation');
            const location = core.battlefield[command.payload.locationId];
            const capacity=command.payload.locationId==='workshop'&&fateLateClimax(core.situation)?1:location.capacity;
            if (capacity !== null && location.playerIds.length >= capacity) return fail('locationFull');
            return ok();
        }
        case 'MOVE_PLAYER': {
            if (core.phase !== 'action') return fail('wrongPhase');
            if (!isCurrentPlayer(core, command)) return fail('notYourTurn');
            const player = core.players[command.playerId];
            if (!player.locationId) return fail('notDeployed');
            if (!locationExists(command.payload.locationId)) return fail('unknownLocation');
            const resolution = resolveFateMovement(core, command.playerId, command.payload.locationId, 'normal');
            return resolution.valid ? ok() : fail(movementFailureToError(resolution) ?? 'moveNotAllowed');
        }
        case 'PASS_ACTION': {
            if (core.phase !== 'action') return fail('wrongPhase');
            if (!isCurrentPlayer(core, command)) return fail('notYourTurn');
            const player=core.players[command.playerId];
            if(!player.normalAttackPlayed && hasLegalFateNormalPlay(core,player.id)) return fail('normalAttackRequired');
            return ok();
        }
        case 'PLAY_SKILL': {
            if (core.battleResolution) return fail('battleAlreadyResolving');
            if (core.phase !== 'outpost' && core.phase !== 'action' && core.phase !== 'battle') return fail('wrongPhase');
            if (!isCurrentPlayer(core, command)) return fail('notYourTurn');
            const player=core.players[command.playerId];
            const source=resolveFateAbilitySource(player,command.payload.skillId);
            if(!source)return fail('unknownSkill');
            const {skill}=source;
            if(fateNoblePhantasmsForbidden(core.situation)&&skill.type?.includes('宝具'))return fail('noblePhantasmForbidden');
            const definition=resolveFatePlayerAbility(core,player.id,skill.id);
            if(!definition)return fail('abilityNotImplemented');
            if(!source.active)return fail('skillNotActive');
            if(definition.masterForm && fateKireiForm(player)!==definition.masterForm)return fail('wrongMasterForm');
            if(player.mana < (definition.activationCost??0))return fail('notEnoughMana');
            if(player.usedAbilityIds.includes(skill.id)||player.usedAbilityIds.includes(fateAbilityUsageKey(skill.id,core.phase)))return fail('abilityAlreadyUsed');
            const abilityPhase = abilityPhaseFor(core.phase);
            if (definition?.trigger && abilityPhase && definition.trigger !== abilityPhase) return fail('wrongPhase');
            const movement = definition?.effects.find(effect => effect.type === 'movement');
            if (movement?.type === 'movement') {
                const target = command.payload.targetLocationId;
                if (!target || !locationExists(target)) return fail('movementTargetRequired');
                const resolution = resolveFateMovement(core, command.playerId, target, movement.mode, {
                    allowAnyDestination: movement.allowAnyDestination,
                    ignoreEngagement: movement.ignoreEngagement,
                    excludedLocations: movement.excludedLocations,
                });
                if (!resolution.valid) return fail(movementFailureToError(resolution) ?? 'moveNotAllowed');
                if (movement.nextOnly && resolution.path?.length !== 2) return fail('nextLocationRequired');
            }

            if (abilityPhase && !canUseFateAbility(core, command.playerId, abilityPhase).valid) return fail('abilitySuppressed');
            return ok();
        }
        case 'RESOLVE_LOCATION': {
            if (core.phase !== 'battle') return fail('wrongPhase');
            if (!isCurrentPlayer(core, command)) return fail('notYourTurn');
            if (!locationExists(command.payload.locationId)) return fail('unknownLocation');
            if (!core.battleResolution) return fail('battleResolutionNotStarted');
            if (core.battleResolution.step !== 'locations') return fail('battleResolutionComplete');
            if (core.resolvedLocations.includes(command.payload.locationId)) return fail('locationAlreadyResolved');
            const nextLocation = FATE_BATTLE_LOCATION_ORDER.find((locationId) => !core.resolvedLocations.includes(locationId));
            if (nextLocation !== command.payload.locationId) return fail('wrongResolutionOrder');
            return ok();
        }
        case 'SELECT_ATTACK_CARD': {
            if (core.phase !== 'action') return fail('wrongPhase');
            if (!isCurrentPlayer(core, command)) return fail('notYourTurn');
            const player = core.players[command.playerId];
            if (player.normalAttackPlayed) return fail('normalAttackAlreadyPlayed');
            const attack = resolveFateAttack(player, command.payload.cardId);
            if (!attack) return fail('staleCard');
            if (player.selectedAttackIds.includes(command.payload.cardId)) return ok();
            if (player.selectedAttackIds.length >= 2) return fail('tooManyAttackCards');
            const selection = canSelectFateAttack(core, command.playerId, command.payload.cardId, command.payload.faceDown);
            if (!selection.valid) return fail(selection.error ?? 'attackNotAllowed');
            if (selectedFateAttackCost(player) + (command.payload.faceDown ? 0 : attack.definition.manaCost) > player.mana) return fail('notEnoughMana');
            return ok();
        }
        case 'CONFIRM_ATTACK': {
            if (core.phase !== 'action') return fail('wrongPhase');
            if (!isCurrentPlayer(core, command)) return fail('notYourTurn');
            const attackCore=resolveFateAttackConfirmation(core,command.playerId,command.payload);
            if(!attackCore)return fail('invalidAttackSelection');
            const player = attackCore.players[command.playerId];
            if (player.selectedAttackIds.length !== 2) return fail('needExactlyTwoCards');
            if (player.normalAttackPlayed) return fail('normalAttackAlreadyPlayed');
            if (selectedFateAttackCost(player) > player.mana) return fail('notEnoughMana');
            for (const cardId of player.selectedAttackIds) {
                const check = canSelectFateAttack(attackCore, command.playerId, cardId, (player.selectedFaceDownIds ?? []).includes(cardId));
                if (!check.valid) return fail(check.error ?? 'attackNotAllowed');
            }
            if (['miyama', 'shinto'].includes(player.locationId ?? '') && player.selectedAttackIds.every(id => (player.selectedFaceDownIds ?? []).includes(id)) && hasAffordableFateFaceUpAttack(attackCore, player.id)) return fail('faceUpAttackRequired');
            return ok();
        }
        case 'INSPECT_CARD': {
            if (core.situation.id === command.payload.cardId || core.miyamaEvent.id === command.payload.cardId) return ok();
            const ownHand = core.players[command.playerId].hand.some((card) => card.id === command.payload.cardId);
            return ownHand ? ok() : fail('cardNotVisible');
        }
        case 'ADVANCE_PHASE':
            if (!isCurrentPlayer(core, command)) return fail('notYourTurn');
            if (core.phase === 'preparation') return ok();
            if (core.phase === 'outpost') {
                return core.players[command.playerId].locationId ? ok() : fail('deploymentRequired');
            }
            if (core.phase === 'battle') {
                if (core.battleResolution && core.battleResolution.step !== 'awards') return fail('battleResolutionIncomplete');
                return ok();
            }
            return fail('actionMustBeConfirmed');
        default:
            return fail('unknownCommand');
    }
}
