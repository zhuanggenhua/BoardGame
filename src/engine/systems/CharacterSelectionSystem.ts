/**
 * 角色选择系统（引擎层）
 * 管理选角状态与流程控制
 */

import type { Command, GameEvent, PlayerId } from '../types';
import type { CharacterSelectionState } from '../../core/ui/CharacterSelection.types';

type CharacterSelectionHookState = {
    sys: {
        characterSelection?: CharacterSelectionState;
        phase?: string;
        flow?: { currentPhase?: string };
    };
};

type SystemValidationResult = { valid: boolean; error?: string };

interface SystemHooks {
    beforeCommand?: (state: CharacterSelectionHookState, command: Command) => SystemValidationResult;
    afterEvent?: (state: CharacterSelectionHookState, event: GameEvent) => void;
}

// ============================================================================
// 命令类型
// ============================================================================

export const CHARACTER_SELECTION_COMMANDS = {
    SELECT_CHARACTER: 'SELECT_CHARACTER',
    PLAYER_READY: 'PLAYER_READY',
    HOST_START_GAME: 'HOST_START_GAME',
} as const;

export interface SelectCharacterCommand extends Command<'SELECT_CHARACTER'> {
    payload: {
        characterId: string;
    };
}

export interface PlayerReadyCommand extends Command<'PLAYER_READY'> {
    payload: Record<string, never>;
}

export interface HostStartGameCommand extends Command<'HOST_START_GAME'> {
    payload: Record<string, never>;
}

export type CharacterSelectionCommand =
    | SelectCharacterCommand
    | PlayerReadyCommand
    | HostStartGameCommand;

// ============================================================================
// 事件类型
// ============================================================================

export interface CharacterSelectedEvent extends GameEvent<'CHARACTER_SELECTED'> {
    payload: {
        playerId: PlayerId;
        characterId: string;
        /** 初始数据（如牌库顺序，由游戏层提供） */
        initialData?: Record<string, unknown>;
    };
}

export interface PlayerReadyEvent extends GameEvent<'PLAYER_READY'> {
    payload: {
        playerId: PlayerId;
    };
}

export interface HostStartedEvent extends GameEvent<'HOST_STARTED'> {
    payload: {
        playerId: PlayerId;
    };
}

export type CharacterSelectionEvent =
    | CharacterSelectedEvent
    | PlayerReadyEvent
    | HostStartedEvent;

// ============================================================================
// 系统配置
// ============================================================================

export interface CharacterSelectionSystemConfig {
    /** 是否启用（默认 true） */
    enabled?: boolean;
    /** 初始房主 ID（默认为第一个玩家） */
    initialHostId?: PlayerId;
    /** 选角阶段名称（默认 'setup'） */
    setupPhaseName?: string;
}

// ============================================================================
// 系统实现
// ============================================================================

export class CharacterSelectionSystem {
    private config: Required<CharacterSelectionSystemConfig>;

    constructor(config: CharacterSelectionSystemConfig = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            initialHostId: config.initialHostId ?? '0',
            setupPhaseName: config.setupPhaseName ?? 'setup',
        };
    }

    /**
     * 创建初始状态
     */
    createInitialState(playerIds: PlayerId[]): CharacterSelectionState {
        const selectedCharacters: Record<PlayerId, string> = {};
        const readyPlayers: Record<PlayerId, boolean> = {};

        for (const pid of playerIds) {
            selectedCharacters[pid] = 'unselected';
            readyPlayers[pid] = false;
        }

        return {
            selectedCharacters,
            readyPlayers,
            hostPlayerId: this.config.initialHostId,
            hostStarted: false,
        };
    }

    /**
     * 获取系统 hooks
     */
    getHooks(): SystemHooks {
        return {
            beforeCommand: (state: CharacterSelectionHookState, command: Command) => {
                if (!this.config.enabled) return { valid: true };

                // 验证选角命令
                if (command.type === CHARACTER_SELECTION_COMMANDS.SELECT_CHARACTER) {
                    return this.validateSelectCharacter(state, command as SelectCharacterCommand);
                }
                if (command.type === CHARACTER_SELECTION_COMMANDS.PLAYER_READY) {
                    return this.validatePlayerReady(state, command as PlayerReadyCommand);
                }
                if (command.type === CHARACTER_SELECTION_COMMANDS.HOST_START_GAME) {
                    return this.validateHostStartGame(state, command as HostStartGameCommand);
                }

                return { valid: true };
            },

            afterEvent: (state: CharacterSelectionHookState, event: GameEvent) => {
                if (!this.config.enabled) return;

                // 处理选角事件
                if (event.type === 'CHARACTER_SELECTED') {
                    this.handleCharacterSelected(state, event as CharacterSelectedEvent);
                }
                if (event.type === 'PLAYER_READY') {
                    this.handlePlayerReady(state, event as PlayerReadyEvent);
                }
                if (event.type === 'HOST_STARTED') {
                    this.handleHostStarted(state, event as HostStartedEvent);
                }
            },
        };
    }

    // ============================================================================
    // 验证逻辑
    // ============================================================================

    private validateSelectCharacter(
        state: { sys: { characterSelection?: CharacterSelectionState; phase?: string; flow?: { currentPhase?: string } } },
        command: SelectCharacterCommand
    ) {
        const selection = state.sys.characterSelection;
        if (!selection) {
            return { valid: false, error: 'character_selection_not_initialized' };
        }

        // 必须在 setup 阶段
        const currentPhase = state.sys.phase ?? state.sys.flow?.currentPhase;
        if (currentPhase !== this.config.setupPhaseName) {
            return { valid: false, error: 'invalid_phase' };
        }

        // 检查角色 ID 是否有效
        if (!command.payload.characterId) {
            return { valid: false, error: 'invalid_character' };
        }

        return { valid: true };
    }

    private validatePlayerReady(
        state: { sys: { characterSelection?: CharacterSelectionState; phase?: string; flow?: { currentPhase?: string } } },
        command: PlayerReadyCommand
    ) {
        const selection = state.sys.characterSelection;
        if (!selection) {
            return { valid: false, error: 'character_selection_not_initialized' };
        }

        // 必须在 setup 阶段
        const currentPhase = state.sys.phase ?? state.sys.flow?.currentPhase;
        if (currentPhase !== this.config.setupPhaseName) {
            return { valid: false, error: 'invalid_phase' };
        }

        // 必须已选角才能准备
        const char = selection.selectedCharacters[command.playerId];
        if (!char || char === 'unselected') {
            return { valid: false, error: 'character_not_selected' };
        }

        return { valid: true };
    }

    private validateHostStartGame(
        state: { sys: { characterSelection?: CharacterSelectionState; phase?: string; flow?: { currentPhase?: string } } },
        command: HostStartGameCommand
    ) {
        const selection = state.sys.characterSelection;
        if (!selection) {
            return { valid: false, error: 'character_selection_not_initialized' };
        }

        // 必须在 setup 阶段
        const currentPhase = state.sys.phase ?? state.sys.flow?.currentPhase;
        if (currentPhase !== this.config.setupPhaseName) {
            return { valid: false, error: 'invalid_phase' };
        }

        // 必须是房主
        if (command.playerId !== selection.hostPlayerId) {
            return { valid: false, error: 'player_mismatch' };
        }

        return { valid: true };
    }

    // ============================================================================
    // 事件处理
    // ============================================================================

    private handleCharacterSelected(
        state: { sys: { characterSelection?: CharacterSelectionState } },
        event: CharacterSelectedEvent
    ) {
        const selection = state.sys.characterSelection;
        if (!selection) return;

        selection.selectedCharacters[event.payload.playerId] = event.payload.characterId;
    }

    private handlePlayerReady(
        state: { sys: { characterSelection?: CharacterSelectionState } },
        event: PlayerReadyEvent
    ) {
        const selection = state.sys.characterSelection;
        if (!selection) return;

        selection.readyPlayers[event.payload.playerId] = true;
    }

    private handleHostStarted(
        state: { sys: { characterSelection?: CharacterSelectionState } },
        _event: HostStartedEvent
    ) {
        const selection = state.sys.characterSelection;
        if (!selection) return;

        selection.hostStarted = true;
    }

    // ============================================================================
    // 辅助方法
    // ============================================================================

    /**
     * 检查是否所有玩家都准备完毕
     */
    isEveryoneReady(state: CharacterSelectionState, playerIds: PlayerId[]): boolean {
        return playerIds.every(pid => {
            const char = state.selectedCharacters[pid];
            const hasSelected = char && char !== 'unselected';
            // 房主只需选好角色，不需要点击准备
            if (pid === state.hostPlayerId) {
                return hasSelected;
            }
            // 非房主需要选好角色且点击准备
            return hasSelected && state.readyPlayers[pid];
        });
    }
}
