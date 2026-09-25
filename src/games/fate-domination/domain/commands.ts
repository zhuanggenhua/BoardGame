import type { MatchState, ValidationResult } from '../../../engine/types';
import { FATE_ATTACK_BY_ID, FATE_MASTERS, FATE_SERVANT_BY_ID } from '../data';
import type { FateDominationCommand, FateDominationCore, LocationId } from './types';
import { movementCost, legalMoveTargets } from './rules';

const ok = (): ValidationResult => ({ valid: true });
const fail = (error: string): ValidationResult => ({ valid: false, error });

const isCurrentPlayer = (core: FateDominationCore, command: FateDominationCommand) =>
    command.skipValidation === true || command.playerId === core.currentPlayerId;

const locationExists = (locationId: string): locationId is LocationId =>
    ['workshop', 'miyama', 'shinto', 'recon'].includes(locationId);

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
            if (player.locationId === command.payload.locationId) return fail('alreadyThere');
            const target = core.battlefield[command.payload.locationId];
            if (target.capacity !== null && target.playerIds.length >= target.capacity) return fail('locationFull');
            const distance = movementCost(player.locationId, command.payload.locationId);
            if (distance === null) return fail('illegalRoute');
            if (player.mana < distance) return fail('notEnoughMana');
            if (!legalMoveTargets(core, player).includes(command.payload.locationId)) return fail('moveNotAllowed');
            return ok();
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
            return ok();
        }
        case 'RESOLVE_LOCATION': {
            if (core.phase !== 'battle') return fail('wrongPhase');
            if (!isCurrentPlayer(core, command)) return fail('notYourTurn');
            if (!locationExists(command.payload.locationId)) return fail('unknownLocation');
            if (core.resolvedLocations.includes(command.payload.locationId)) return fail('locationAlreadyResolved');
            const battleOrder: LocationId[] = ['workshop', 'miyama', 'shinto', 'recon'];
            const nextLocation = battleOrder.find((locationId) => !core.resolvedLocations.includes(locationId));
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
            if (core.phase === 'battle') return ok();
            return fail('actionMustBeConfirmed');
        default:
            return fail('unknownCommand');
    }
}
