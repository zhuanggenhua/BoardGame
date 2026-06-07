import type {
    StateValidatorRegistry,
    ValidationError,
} from '../engine/transport/stateValidator';

function validateSmashUpState(core: unknown, errors: ValidationError[]): void {
    const state = core as Record<string, unknown>;

    if (!state.phase || typeof state.phase !== 'string') {
        errors.push({ field: 'core.phase', message: 'Missing or invalid phase' });
    }

    if (!state.players || typeof state.players !== 'object') {
        errors.push({ field: 'core.players', message: 'Missing or invalid players' });
    }

    if (!state.bases || !Array.isArray(state.bases)) {
        errors.push({ field: 'core.bases', message: 'Missing or invalid bases' });
    }
}

function validateDiceThroneState(core: unknown, errors: ValidationError[]): void {
    const state = core as Record<string, unknown>;

    if (!state.phase || typeof state.phase !== 'string') {
        errors.push({ field: 'core.phase', message: 'Missing or invalid phase' });
    }

    if (!state.players || typeof state.players !== 'object') {
        errors.push({ field: 'core.players', message: 'Missing or invalid players' });
    }
}

function validateSummonerWarsState(core: unknown, errors: ValidationError[]): void {
    const state = core as Record<string, unknown>;

    if (!state.phase || typeof state.phase !== 'string') {
        errors.push({ field: 'core.phase', message: 'Missing or invalid phase' });
    }

    if (!state.players || typeof state.players !== 'object') {
        errors.push({ field: 'core.players', message: 'Missing or invalid players' });
    }

    if (!state.board || typeof state.board !== 'object') {
        errors.push({ field: 'core.board', message: 'Missing or invalid board' });
    }
}

export const GAME_STATE_VALIDATORS: StateValidatorRegistry = {
    smashup: validateSmashUpState,
    dicethrone: validateDiceThroneState,
    summonerwars: validateSummonerWarsState,
};
