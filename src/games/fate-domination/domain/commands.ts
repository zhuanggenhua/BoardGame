import type { MatchState, ValidationResult } from '../../../engine/types';
import { FATE_ATTACK_BY_ID, FATE_MASTERS, FATE_SERVANT_BY_ID } from '../data';
import { FATE_BATTLE_LOCATION_ORDER } from './types';
import type { FateDominationCommand, FateDominationCore, LocationId } from './types';
import { canPlayAttack, movementFailureToError, resolveFateMovement } from './movement';
import { canUseFateAbility } from './mechanics';
import { resolveFateAbilityDefinition } from './abilityRegistry';

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

    switch (command.type) {
        case 'SELECT_MASTER':
            if (core.phase !== 'preparation') return fail('wrongPhase');
            return FATE_MASTERS.some((master) => master.id === command.payload.masterId)
                ? ok() : fail('unknownMaster');
        case 'SELECT_SERVANT':
            if (core.phase !== 'preparation') return fail('wrongPhase');
            return FATE_SERVANT_BY_ID[command.payload.servantId] ? ok() : fail('unknownServant');
        case 'DEPLOY_MASTER': {
            if (core.phase !== 'outpost') return fail('wrongPhase');
            if (!isCurrentPlayer(core, command)) return fail('notYourTurn');
            if (core.players[command.playerId].locationId) return fail('alreadyDeployed');
            if (!locationExists(command.payload.locationId)) return fail('unknownLocation');
            const location = core.battlefield[command.payload.locationId];
            if (location.capacity !== null && location.playerIds.length >= location.capacity) return fail('locationFull');
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
        case 'PASS_ACTION':
            if (core.phase !== 'action') return fail('wrongPhase');
            if (!isCurrentPlayer(core, command)) return fail('notYourTurn');
            return ok();
        case 'PLAY_SKILL': {
            if (core.phase !== 'outpost' && core.phase !== 'action' && core.phase !== 'battle') return fail('wrongPhase');
            if (!isCurrentPlayer(core, command)) return fail('notYourTurn');
            const skill = core.players[command.playerId].skills.find((item) => item.id === command.payload.skillId);
            if (!skill) return fail('unknownSkill');
            const cost = Number(skill.req ?? skill.cost ?? 0);
            if (core.players[command.playerId].mana < cost) return fail('notEnoughMana');
            if (core.players[command.playerId].activeSkills.includes(skill.id)) return fail('skillAlreadyActive');
            const definition = resolveFateAbilityDefinition(skill.id);
            const abilityPhase = abilityPhaseFor(core.phase);
            if (definition?.trigger && abilityPhase && definition.trigger !== abilityPhase) return fail('wrongPhase');
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
            const card = player.hand.find((item) => item.id === command.payload.cardId);
            if (!card) return fail('staleCard');
            if (player.selectedAttackIds.includes(card.id)) return ok();
            if (player.selectedAttackIds.length >= 2) return fail('tooManyAttackCards');
            const definition = FATE_ATTACK_BY_ID[card.definitionId];
            const selectedCost = player.selectedAttackIds.reduce((sum, id) => {
                const selected = player.hand.find((item) => item.id === id);
                return sum + (selected ? FATE_ATTACK_BY_ID[selected.definitionId].manaCost : 0);
            }, 0);
            if (!definition || selectedCost + definition.manaCost > player.mana) return fail('notEnoughMana');
            const attackCheck = canPlayAttack(core, command.playerId, definition);
            if (!attackCheck.valid) return fail(attackCheck.error ?? 'attackNotAllowed');
            return ok();
        }
        case 'CONFIRM_ATTACK': {
            if (core.phase !== 'action') return fail('wrongPhase');
            if (!isCurrentPlayer(core, command)) return fail('notYourTurn');
            const player = core.players[command.playerId];
            if (player.selectedAttackIds.length !== 2) return fail('needExactlyTwoCards');
            const selectedCost = player.selectedAttackIds.reduce((sum, id) => {
                const selected = player.hand.find((card) => card.id === id);
                return sum + (selected ? FATE_ATTACK_BY_ID[selected.definitionId]?.manaCost ?? 0 : 0);
            }, 0);
            if (selectedCost > player.mana) return fail('notEnoughMana');
            for (const cardId of player.selectedAttackIds) {
                const card = player.hand.find((item) => item.id === cardId);
                const definition = card ? FATE_ATTACK_BY_ID[card.definitionId] : undefined;
                if (!definition) return fail('staleCard');
                const attackCheck = canPlayAttack(core, command.playerId, definition);
                if (!attackCheck.valid) return fail(attackCheck.error ?? 'attackNotAllowed');
            }
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
                const allDeployed = core.playerIds.every((id) => core.players[id].eliminated || Boolean(core.players[id].locationId));
                return allDeployed ? ok() : fail('deploymentRequired');
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
