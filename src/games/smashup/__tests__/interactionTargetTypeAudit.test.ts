/**
 * SmashUp - Interaction targetType / autoRefresh 审计
 *
 * 审计目标：
 * 1. 确保 createSimpleChoice 不会被 Board.tsx 的 fallback 逻辑误判。
 * 2. 确保已知高风险的“通用牌库检索弹层”保留显式配置，避免回归成隐藏交互。
 */

import { describe, it, expect } from 'vitest';
import * as ts from 'typescript';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import {
    collectOptionObjectLiterals,
    extractSimpleChoiceConfig,
    getChoiceOptionsArg,
    inferDirectTargetTypeFromOptions,
    isCreateSimpleChoiceCall,
} from './helpers/simpleChoiceAst';

interface TargetTypeIssue {
    file: string;
    line: number;
    sourceId: string;
    issue: string;
    detail: string;
}

interface SimpleChoiceCallInfo {
    file: string;
    line: number;
    sourceId: string;
    targetType?: string;
    autoRefresh?: string;
    responseValidationMode?: string;
    revalidateOnRespond?: boolean;
    hasMulti?: boolean;
}

const REQUIRED_SOURCE_CONFIGS: Record<string, { targetType?: string; autoRefresh?: string; responseValidationMode?: string }> = {
    killer_plant_sprout_search: { targetType: 'generic', autoRefresh: 'deck', responseValidationMode: 'live' },
    killer_plant_venus_man_trap_search: { targetType: 'generic', autoRefresh: 'deck', responseValidationMode: 'live' },
    wizard_scry: { targetType: 'generic', autoRefresh: 'deck', responseValidationMode: 'live' },
    multi_base_scoring: { targetType: 'base' },
    base_castle_blood: { targetType: 'minion' },
    base_nine_lives_intercept: { targetType: 'minion' },
    base_the_pasture: { targetType: 'minion' },
    base_cat_fanciers_alley: { targetType: 'minion' },
    base_land_of_balance: { targetType: 'minion' },
    base_sheep_shrine: { targetType: 'minion' },
    base_the_asylum: { targetType: 'button' },
    base_innsmouth_base_choose_player: { targetType: 'player' },
    base_miskatonic_university_base: { targetType: 'button' },
    base_greenhouse: { targetType: 'generic' },
    base_inventors_salon: { targetType: 'generic' },
    alien_scout_return: { targetType: 'minion' },
    alien_supreme_overlord: { targetType: 'minion' },
    alien_collector: { targetType: 'minion' },
    alien_probe_choose_target: { targetType: 'player' },
    alien_probe: { targetType: 'generic' },
    alien_terraform_choose_replacement: { targetType: 'generic' },
    alien_terraform_play_minion: { targetType: 'hand' },
    bear_cavalry_commission_choose_minion: { targetType: 'hand' },
    cthulhu_recruit_by_force: { targetType: 'generic' },
    cthulhu_it_begins_again: { targetType: 'generic' },
    cthulhu_madness_unleashed: { targetType: 'hand' },
    cthulhu_chosen_confirm: { targetType: 'minion' },
    cthulhu_star_spawn: { targetType: 'generic' },
    cthulhu_servitor: { targetType: 'generic' },
    special_madness: { targetType: 'button' },
    elder_thing_begin_the_summoning: { targetType: 'generic' },
    elder_thing_elder_thing_choice: { targetType: 'button' },
    elder_thing_shoggoth_opponent: { targetType: 'button' },
    elder_thing_mi_go: { targetType: 'button' },
    pirate_broadside: { targetType: 'generic' },
    pirate_buccaneer_move: { targetType: 'base' },
    pirate_king_move: { targetType: 'minion' },
    pirate_sea_dogs_choose_faction: { targetType: 'generic' },
    giant_ant_drone_prevent_destroy: { targetType: 'minion' },
    giant_ant_we_are_the_champions_choose_source: { targetType: 'minion' },
    giant_ant_we_are_the_champions_choose_snapshot_source: { targetType: 'generic' },
    robot_microbot_reclaimer: { targetType: 'generic' },
    robot_hoverbot: { targetType: 'generic' },
    steampunk_scrap_diving: { targetType: 'generic' },
    steampunk_mechanic: { targetType: 'generic' },
    steampunk_change_of_venue_choose_minion: { targetType: 'minion' },
    steampunk_change_of_venue_choose_base: { targetType: 'base' },
    trickster_block_the_path: { targetType: 'generic' },
    trickster_mark_of_sleep: { targetType: 'player' },
    wizard_neophyte: { targetType: 'button' },
    wizard_mass_enchantment: { targetType: 'generic' },
    wizard_portal_order: { targetType: 'generic' },
    base_wizard_academy: { targetType: 'generic' },
    base_innsmouth_base_choose_card: { targetType: 'generic' },
    ghost_the_dead_rise_discard: { targetType: 'hand' },
    ghost_the_dead_rise_play: { targetType: 'discard_minion' },
    ghost_across_the_divide: { targetType: 'generic' },
    ghost_spirit_discard: { targetType: 'hand' },
    innsmouth_recruitment: { targetType: 'button' },
    innsmouth_mysteries_of_the_deep: { targetType: 'button' },
    innsmouth_spreading_the_word: { targetType: 'generic' },
    miskatonic_mandatory_reading_draw: { targetType: 'button' },
    miskatonic_psychologist: { targetType: 'button' },
    miskatonic_researcher: { targetType: 'button' },
    miskatonic_book_of_iter_the_unseen: { targetType: 'generic' },
    miskatonic_field_trip: { targetType: 'hand' },
    zombie_grave_digger: { targetType: 'generic' },
    zombie_walker: { targetType: 'button' },
    zombie_grave_robbing: { targetType: 'generic' },
    zombie_not_enough_bullets: { targetType: 'generic' },
    zombie_lend_a_hand: { targetType: 'generic' },
    zombie_lord_pick: { targetType: 'discard_minion' },
    zombie_mall_crawl: { targetType: 'generic' },
};

const APPROVED_GENERIC_SOURCE_REASONS: Record<string, string> = {
    alien_probe: '目标同时包含对手玩家上下文与其手牌卡面，不能映射为当前玩家 hand 直选。',
    bear_cavalry_bear_necessities: '候选项混合了场上随从与持续行动卡，单一 base/minion/hand 语义不足以表达。',
    alien_terraform_choose_replacement: '候选目标来自替换基地池/基地牌面，不是当前场上的基地实体。',
    base_greenhouse: '从牌库候选随从卡面中选择打出目标，来源是 deck 卡牌而非手牌/棋盘实体。',
    base_innsmouth_base_choose_card: '先选玩家再选卡牌，交互同时携带玩家与卡牌上下文。',
    base_inventors_salon: '候选项是抽象奖励分支，不是单一棋盘实体直点。',
    base_wizard_academy: '牌库顶揭示后的处理分支，依赖展示卡牌上下文而不是棋盘实体。',
    cthulhu_it_begins_again: '多选弃牌堆行动卡，来源为 discard，不能映射为单选 hand/board 直选。',
    cthulhu_recruit_by_force: '多选弃牌堆随从卡，来源为 discard 卡面而不是棋盘实体。',
    cthulhu_servitor: '从弃牌堆行动卡中选回牌库的目标，来源为 discard 卡面。',
    cthulhu_star_spawn: '同时涉及目标玩家与疯狂卡转移，不能压缩成单一实体语义。',
    elder_thing_begin_the_summoning: '候选项来自非棋盘卡牌池，需保留通用卡面弹层选择。',
    ghost_across_the_divide: '候选项包含复合效果分支，不是单一基地/随从/手牌实体。',
    giant_ant_under_pressure_choose_amount: '这是纯数值选择，不对应任何棋盘或手牌实体。',
    giant_ant_we_are_the_champions_choose_amount: '这是纯数值选择，不对应任何棋盘或手牌实体。',
    giant_ant_we_are_the_champions_choose_snapshot_source: '来源随从已在计分后离场，只能用静态快照卡面选择。',
    innsmouth_spreading_the_word: '选择的是随从名(defId)而不是某张场上/手牌实体卡。',
    killer_plant_sprout_search: '牌库搜索结果卡面选择，需要 autoRefresh/live 重验而非棋盘直点。',
    killer_plant_venus_man_trap_search: '牌库搜索结果卡面选择，需要 autoRefresh/live 重验而非棋盘直点。',
    miskatonic_book_of_iter_the_unseen: '候选项来自特殊卡牌池/效果分支，不是棋盘实体直选。',
    pirate_broadside: '同时选择基地与玩家两个维度，单一 base/minion/hand 语义不足以表达。',
    pirate_sea_dogs_choose_faction: '选择的是派系标识，而不是棋盘或手牌实体。',
    robot_hoverbot: '牌库顶揭示后的处理分支，不对应棋盘实体。',
    robot_microbot_reclaimer: '多选弃牌堆 microbot 卡，来源为 discard 卡面。',
    steampunk_mechanic: '候选项是复合效果分支，不能压成单一实体语义。',
    steampunk_scrap_diving: '从弃牌堆行动卡中选择回收目标，来源为 discard 卡面。',
    vampire_crack_of_dusk: '候选项来自弃牌堆静态卡面，后续还要串联基地选择，不是当前 hand/board 直选。',
    trickster_block_the_path: '候选项是效果处理分支，不对应单一实体直选。',
    wizard_mass_enchantment: '候选行动卡来自对手牌库顶揭示结果，来源不是当前玩家手牌/棋盘。',
    wizard_portal_order: '这是剩余揭示牌的排序交互，不对应单一实体直选。',
    wizard_scry: '牌库搜索/排序结果卡面选择，需要 autoRefresh/live 重验。',
    zombie_grave_digger: '从弃牌堆选卡回手，来源为 discard 卡面。',
    zombie_grave_robbing: '从弃牌堆选任意卡回手，来源为 discard 卡面。',
    zombie_lend_a_hand: '多选弃牌堆卡牌，来源为 discard 且是多选交互。',
    zombie_mall_crawl: '从弃牌堆候选卡中决定额外打出目标，来源不是 hand/board 直选。',
    zombie_not_enough_bullets: '从弃牌堆同名卡组中选择恢复目标，来源为 discard 卡面。',
};

function extractValueProps(optionNode: ts.ObjectLiteralExpression): Set<string> {
    const props = new Set<string>();
    const valueProp = optionNode.properties.find(
        prop => ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'value'
    ) as ts.PropertyAssignment | undefined;

    if (!valueProp || !ts.isObjectLiteralExpression(valueProp.initializer)) return props;

    for (const prop of valueProp.initializer.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
            props.add(prop.name.text);
        } else if (ts.isShorthandPropertyAssignment(prop)) {
            props.add(prop.name.text);
        }
    }
    return props;
}

function extractTopLevelStringProp(optionNode: ts.ObjectLiteralExpression, propName: string): string | undefined {
    const prop = optionNode.properties.find(
        entry => ts.isPropertyAssignment(entry) && ts.isIdentifier(entry.name) && entry.name.text === propName
    ) as ts.PropertyAssignment | undefined;

    if (!prop) return undefined;
    if (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
        return prop.initializer.text;
    }
    if (prop.initializer.kind === ts.SyntaxKind.AsExpression) {
        const expr = (prop.initializer as ts.AsExpression).expression;
        if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
            return expr.text;
        }
    }
    return undefined;
}

function checkMinionSelectFallback(options: ts.ObjectLiteralExpression[]): boolean {
    if (options.length === 0) return false;
    const confirmFields = new Set(['accept', 'confirm', 'returnIt', 'skip', 'done']);
    return options.every(opt => {
        const props = extractValueProps(opt);
        const source = extractTopLevelStringProp(opt, '_source');
        if (!props.has('minionUid')) return false;
        if (source === 'static' || source === 'discard') return false;
        if (props.has('toBase') || props.has('toBaseIndex') || props.has('targetPlayerId') || props.has('baseDefId')) {
            return false;
        }
        for (const field of confirmFields) {
            if (props.has(field)) return false;
        }
        return true;
    });
}

function checkBaseSelectFallback(options: ts.ObjectLiteralExpression[]): boolean {
    if (options.length === 0) return false;
    return options.every(opt => {
        const props = extractValueProps(opt);
        if (!props.has('baseIndex')) return false;
        if (props.has('minionUid') || props.has('cardUid') || props.has('ongoingUid')) return false;
        return true;
    });
}

function checkHandSelectFallback(options: ts.ObjectLiteralExpression[]): boolean {
    if (options.length === 0) return false;

    let hasOwnHandOption = false;
    for (const opt of options) {
        const props = extractValueProps(opt);
        const source = extractTopLevelStringProp(opt, '_source');
        const isOwnHandCardOption = source === 'hand' && props.has('cardUid') && !props.has('targetPlayerId');
        const isExtraActionOption = !props.has('cardUid');

        if (isOwnHandCardOption) {
            hasOwnHandOption = true;
            continue;
        }
        if (isExtraActionOption) {
            continue;
        }
        return false;
    }

    return hasOwnHandOption;
}

function checkPlayerSelectFallback(options: ts.ObjectLiteralExpression[]): boolean {
    if (options.length === 0) return false;

    const playerFields = new Set(['targetPlayerId', 'pid', 'playerId']);
    let hasPlayerOption = false;
    for (const opt of options) {
        const props = extractValueProps(opt);
        const hasPlayerField = Array.from(playerFields).some(field => props.has(field));
        const hasOnlyPlayerFields = Array.from(props).every(prop => playerFields.has(prop));

        if (hasPlayerField && hasOnlyPlayerFields) {
            hasPlayerOption = true;
            continue;
        }

        const isExtraActionOption = !hasPlayerField;
        if (isExtraActionOption) continue;

        return false;
    }

    return hasPlayerOption;
}

function checkButtonSelectFallback(options: ts.ObjectLiteralExpression[]): boolean {
    if (options.length === 0) return false;

    const abstractFields = new Set([
        'action',
        'choice',
        'count',
        'skip',
        'draw',
        'accept',
        'source',
        'handCount',
        'discardCount',
    ]);

    let hasAbstractOption = false;
    for (const opt of options) {
        const props = extractValueProps(opt);
        if (props.size === 0) return false;

        const hasOnlyAbstractFields = Array.from(props).every(prop => abstractFields.has(prop));
        if (!hasOnlyAbstractFields) return false;

        if (!props.has('skip')) {
            hasAbstractOption = true;
        }
    }

    return hasAbstractOption;
}

function findHandSourceMarkerIssue(
    options: ts.ObjectLiteralExpression[],
): { issue: 'missing' | 'wrong'; actual?: string } | undefined {
    for (const opt of options) {
        const props = extractValueProps(opt);
        if (!props.has('cardUid') || props.has('targetPlayerId')) continue;

        const source = extractTopLevelStringProp(opt, '_source');
        if (source === 'hand') continue;
        if (!source) return { issue: 'missing' };
        return { issue: 'wrong', actual: source };
    }
    return undefined;
}

function hasUnsafeBaseFields(options: ts.ObjectLiteralExpression[]): boolean {
    const safeFields = new Set(['baseIndex', 'baseDefId']);
    return options.some(opt => {
        const props = extractValueProps(opt);
        return Array.from(props).some(prop => !safeFields.has(prop));
    });
}

function hasUnsafeMinionFields(options: ts.ObjectLiteralExpression[]): boolean {
    const safeFields = new Set(['minionUid', 'baseIndex', 'defId', 'minionDefId', 'power', 'ownerId']);
    return options.some(opt => {
        const props = extractValueProps(opt);
        return Array.from(props).some(prop => !safeFields.has(prop));
    });
}

function isBoardLikeGenericOption(options: ts.ObjectLiteralExpression[]): boolean {
    return options.some(opt => {
        const props = extractValueProps(opt);
        return props.has('baseIndex') || props.has('minionUid');
    });
}

function analyzeFile(filePath: string): { issues: TargetTypeIssue[]; calls: SimpleChoiceCallInfo[] } {
    const content = readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const issues: TargetTypeIssue[] = [];
    const calls: SimpleChoiceCallInfo[] = [];

    const visit = (node: ts.Node) => {
        if (isCreateSimpleChoiceCall(node)) {
            const config = extractSimpleChoiceConfig(node);
            const optionsArg = getChoiceOptionsArg(node);
            const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart()).line + 1;
            calls.push({
                file: filePath,
                line,
                sourceId: config.sourceId,
                targetType: config.targetType,
                    autoRefresh: config.autoRefresh,
                    responseValidationMode: config.responseValidationMode,
                    revalidateOnRespond: config.revalidateOnRespond,
                    hasMulti: config.hasMulti,
                });

            if (!config.hasTargetType) {
                const resolvedOptions = collectOptionObjectLiterals(sourceFile, optionsArg, node);
                const inferredDirectTargetType = inferDirectTargetTypeFromOptions(sourceFile, optionsArg, node);

                if (checkHandSelectFallback(resolvedOptions)) {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '直点手牌交互未显式声明 targetType',
                        detail: '这是当前玩家手牌直选交互，必须显式声明 targetType: "hand"，不能依赖 Board.tsx fallback 猜测。',
                    });
                }

                if (checkPlayerSelectFallback(resolvedOptions)) {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '选玩家交互未显式声明 targetType',
                        detail: '这是纯玩家维度选择，必须显式声明 targetType: "player"，避免继续混在 generic 语义里。',
                    });
                }

                if (checkButtonSelectFallback(resolvedOptions)) {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '按钮分支交互未显式声明 targetType',
                        detail: '这是纯按钮/分支选择，必须显式声明 targetType: "button"，避免继续混在 generic 语义里。',
                    });
                }

                if (checkMinionSelectFallback(resolvedOptions)) {
                    const hasMovementFields = resolvedOptions.some(opt => {
                        const props = extractValueProps(opt);
                        return props.has('fromBase')
                            || props.has('toBase')
                            || props.has('fromBaseIndex')
                            || props.has('toBaseIndex');
                    });

                    if (hasMovementFields) {
                        issues.push({
                            file: filePath,
                            line,
                            sourceId: config.sourceId,
                            issue: 'isMinionSelectPrompt 误判风险',
                            detail: '所有选项都有 minionUid 且携带额外上下文字段；必须显式声明 targetType，优先用 "minion"，只有同一随从对应多种语义时才用 "generic"。',
                        });
                    } else {
                        issues.push({
                            file: filePath,
                            line,
                            sourceId: config.sourceId,
                            issue: '直点随从交互未显式声明 targetType',
                            detail: '这是场上随从直点交互，必须显式声明 targetType: "minion"，不能依赖 Board.tsx fallback 猜测。',
                        });
                    }
                } else if (inferredDirectTargetType === 'minion') {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: 'helper 构造的直点随从交互未显式声明 targetType',
                        detail: '选项由 buildMinionTargetOptions 构造，必须显式声明 targetType: "minion"，不能依赖隐式推断。',
                    });
                }

                if (checkBaseSelectFallback(resolvedOptions)) {
                    if (hasUnsafeBaseFields(resolvedOptions)) {
                        issues.push({
                            file: filePath,
                            line,
                            sourceId: config.sourceId,
                            issue: '基地相关交互缺少显式 targetType',
                            detail: '所有选项都有 baseIndex 且携带额外字段；必须显式声明 targetType，优先用 "base"，只有同一基地对应多种语义时才用 "generic"。',
                        });
                    } else {
                        issues.push({
                            file: filePath,
                            line,
                            sourceId: config.sourceId,
                            issue: '直点基地交互未显式声明 targetType',
                            detail: '这是场上基地直点交互，必须显式声明 targetType: "base"，不能依赖 Board.tsx fallback 猜测。',
                        });
                    }
                } else if (inferredDirectTargetType === 'base') {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: 'helper 构造的直点基地交互未显式声明 targetType',
                        detail: '选项由 buildBaseTargetOptions 构造，必须显式声明 targetType: "base"，不能依赖隐式推断。',
                    });
                }
            }

            if (config.hasTargetType && config.targetType !== 'hand') {
                const resolvedOptions = collectOptionObjectLiterals(sourceFile, node.arguments[3], node);
                if (checkHandSelectFallback(resolvedOptions)) {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '直点手牌交互 targetType 声明错误',
                        detail: `这是当前玩家手牌直选交互，targetType 必须是 "hand"，当前为 "${config.targetType}"。`,
                    });
                }
            }

            if (config.hasTargetType && config.targetType !== 'minion') {
                const resolvedOptions = collectOptionObjectLiterals(sourceFile, optionsArg, node);
                const inferredDirectTargetType = inferDirectTargetTypeFromOptions(sourceFile, optionsArg, node);
                const looksLikePureMinionDirect = checkMinionSelectFallback(resolvedOptions) || inferredDirectTargetType === 'minion';
                if (looksLikePureMinionDirect) {
                    const hasUnsafeFields = hasUnsafeMinionFields(resolvedOptions);
                    if (!hasUnsafeFields) {
                        issues.push({
                            file: filePath,
                            line,
                            sourceId: config.sourceId,
                            issue: '直点随从交互 targetType 声明错误',
                            detail: `这是场上随从直点交互，targetType 必须是 "minion"，当前为 "${config.targetType}"。`,
                        });
                    }
                }
            }

            if (config.hasTargetType && config.targetType !== 'base') {
                const resolvedOptions = collectOptionObjectLiterals(sourceFile, optionsArg, node);
                const inferredDirectTargetType = inferDirectTargetTypeFromOptions(sourceFile, optionsArg, node);
                const looksLikePureBaseDirect = checkBaseSelectFallback(resolvedOptions) || inferredDirectTargetType === 'base';
                if (looksLikePureBaseDirect) {
                    const hasUnsafeFields = hasUnsafeBaseFields(resolvedOptions);
                    if (!hasUnsafeFields) {
                        issues.push({
                            file: filePath,
                            line,
                            sourceId: config.sourceId,
                            issue: '直点基地交互 targetType 声明错误',
                            detail: `这是场上基地直点交互，targetType 必须是 "base"，当前为 "${config.targetType}"。`,
                        });
                    }
                }
            }

            if (config.hasTargetType && config.targetType !== 'player') {
                const resolvedOptions = collectOptionObjectLiterals(sourceFile, optionsArg, node);
                if (checkPlayerSelectFallback(resolvedOptions)) {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '选玩家交互 targetType 声明错误',
                        detail: `这是纯玩家维度选择，targetType 必须是 "player"，当前为 "${config.targetType}"。`,
                    });
                }
            }

            if (config.hasTargetType && config.targetType !== 'button') {
                const resolvedOptions = collectOptionObjectLiterals(sourceFile, optionsArg, node);
                if (checkButtonSelectFallback(resolvedOptions)) {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '按钮分支交互 targetType 声明错误',
                        detail: `这是纯按钮/分支选择，targetType 必须是 "button"，当前为 "${config.targetType}"。`,
                    });
                }
            }

            if (config.targetType === 'hand' && !config.hasMulti) {
                const resolvedOptions = collectOptionObjectLiterals(sourceFile, optionsArg, node);
                const sourceMarkerIssue = findHandSourceMarkerIssue(resolvedOptions);
                if (sourceMarkerIssue?.issue === 'missing') {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '直点手牌交互缺少 _source 标记',
                        detail: 'targetType: "hand" 的卡牌选项必须显式声明 _source: "hand"，避免 PromptOverlay / 动态过滤误判来源。',
                    });
                } else if (sourceMarkerIssue?.issue === 'wrong') {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '直点手牌交互 _source 声明错误',
                        detail: `targetType: "hand" 的卡牌选项必须声明 _source: "hand"，当前为 "${sourceMarkerIssue.actual}"。`,
                    });
                }
            }
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return { issues, calls };
}

function getFilesToScan(): string[] {
    const abilitiesDir = resolve(__dirname, '../abilities');
    const baseAbilityFiles = [
        resolve(__dirname, '../domain/index.ts'),
        resolve(__dirname, '../domain/baseAbilities.ts'),
        resolve(__dirname, '../domain/baseAbilities_expansion.ts'),
    ];

    const abilityFiles = readdirSync(abilitiesDir)
        .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))
        .map(file => join(abilitiesDir, file));

    return [...abilityFiles, ...baseAbilityFiles];
}

describe('SmashUp Interaction targetType 审计', () => {
    it('所有 createSimpleChoice 的直点/通用交互都显式声明正确的 targetType', () => {
        const allIssues: TargetTypeIssue[] = [];

        for (const filePath of getFilesToScan()) {
            try {
                const { issues } = analyzeFile(filePath);
                allIssues.push(...issues);
            } catch {
                // 文件不存在或解析失败时跳过，避免阻塞整个审计
            }
        }

        if (allIssues.length > 0) {
            const report = allIssues.map(issue =>
                `${issue.file}:${issue.line} [${issue.sourceId}] ${issue.issue}\n  → ${issue.detail}`
            ).join('\n\n');
            expect.fail(`发现 ${allIssues.length} 个 targetType 显式声明/误判风险：\n\n${report}`);
        }

        expect(allIssues).toEqual([]);
    });

    it('已登记的通用牌库检索交互必须保留显式 targetType / autoRefresh 配置', () => {
        const allCalls: SimpleChoiceCallInfo[] = [];

        for (const filePath of getFilesToScan()) {
            try {
                const { calls } = analyzeFile(filePath);
                allCalls.push(...calls);
            } catch {
                // 文件不存在或解析失败时跳过，避免阻塞整个审计
            }
        }

        const violations: string[] = [];

        for (const [sourceId, expected] of Object.entries(REQUIRED_SOURCE_CONFIGS)) {
            const matches = allCalls.filter(call => call.sourceId === sourceId);
            if (matches.length === 0) {
                violations.push(`缺少 sourceId="${sourceId}" 的 createSimpleChoice 调用`);
                continue;
            }

            for (const match of matches) {
                if (expected.targetType !== undefined && match.targetType !== expected.targetType) {
                    violations.push(
                        `${match.file}:${match.line} [${sourceId}] targetType 期望 "${expected.targetType}"，实际 "${match.targetType ?? '未声明'}"`
                    );
                }
                if (expected.autoRefresh !== undefined && match.autoRefresh !== expected.autoRefresh) {
                    violations.push(
                        `${match.file}:${match.line} [${sourceId}] autoRefresh 期望 "${expected.autoRefresh}"，实际 "${match.autoRefresh ?? '未声明'}"`
                    );
                }
                if (expected.responseValidationMode !== undefined && match.responseValidationMode !== expected.responseValidationMode) {
                    violations.push(
                        `${match.file}:${match.line} [${sourceId}] responseValidationMode 期望 "${expected.responseValidationMode}"，实际 "${match.responseValidationMode ?? '未声明'}"`
                    );
                }
            }
        }

        expect(violations, `以下高风险通用交互缺少显式配置：\n${violations.join('\n')}`).toEqual([]);
    });

    it('同一 sourceId 不允许混用多种 targetType 语义', () => {
        const allCalls: SimpleChoiceCallInfo[] = [];

        for (const filePath of getFilesToScan()) {
            try {
                const { calls } = analyzeFile(filePath);
                allCalls.push(...calls);
            } catch {
                continue;
            }
        }

        const grouped = new Map<string, SimpleChoiceCallInfo[]>();
        for (const call of allCalls) {
            if (!grouped.has(call.sourceId)) grouped.set(call.sourceId, []);
            grouped.get(call.sourceId)?.push(call);
        }

        const violations: string[] = [];
        for (const [sourceId, calls] of grouped.entries()) {
            const targetTypes = Array.from(new Set(calls.map(call => call.targetType ?? '未声明')));
            if (targetTypes.length <= 1) continue;

            const locations = calls.map(call =>
                `${call.file}:${call.line} -> ${call.targetType ?? '未声明'}`
            ).join(' | ');

            violations.push(`[${sourceId}] 同时出现多种 targetType：${targetTypes.join(', ')}\n  ${locations}`);
        }

        expect(violations, `以下 sourceId 存在一号多义的 targetType 语义：\n${violations.join('\n')}`).toEqual([]);
    });

    it('带有场上实体标识的 generic 交互必须显式登记为例外', () => {
        const violations: string[] = [];

        for (const filePath of getFilesToScan()) {
            const content = readFileSync(filePath, 'utf-8');
            const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

            const visit = (node: ts.Node) => {
                if (!isCreateSimpleChoiceCall(node)) {
                    ts.forEachChild(node, visit);
                    return;
                }

                const config = extractSimpleChoiceConfig(node);
                if (config.targetType !== 'generic') {
                    ts.forEachChild(node, visit);
                    return;
                }

                const options = collectOptionObjectLiterals(sourceFile, node.arguments[3], node);
                if (!isBoardLikeGenericOption(options)) {
                    ts.forEachChild(node, visit);
                    return;
                }

                if (!APPROVED_GENERIC_SOURCE_REASONS[config.sourceId]) {
                    const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart()).line + 1;
                    violations.push(`${filePath}:${line} [${config.sourceId}] generic 交互包含 baseIndex/minionUid，必须审查后登记例外或改成直点 targetType`);
                }

                ts.forEachChild(node, visit);
            };

            visit(sourceFile);
        }

        expect(violations, `以下 generic 交互带有场上实体标识，但没有登记为例外：\n${violations.join('\n')}`).toEqual([]);
    });

    it('声明 autoRefresh 的通用弹窗交互必须显式声明 responseValidationMode', () => {
        const allCalls: SimpleChoiceCallInfo[] = [];

        for (const filePath of getFilesToScan()) {
            try {
                const { calls } = analyzeFile(filePath);
                allCalls.push(...calls);
            } catch {
                continue;
            }
        }

        const violations = allCalls
            .filter(call => !!call.autoRefresh)
            .filter(call => !call.targetType || call.targetType === 'generic')
            .filter(call => !call.responseValidationMode && call.revalidateOnRespond === undefined)
            .map(call =>
                `${call.file}:${call.line} [${call.sourceId}] 通用弹窗声明了 autoRefresh="${call.autoRefresh}"，但未显式声明 responseValidationMode`
            );

        expect(violations, `以下通用弹窗交互缺少显式响应语义：\n${violations.join('\n')}`).toEqual([]);
    });

    it('所有 generic targetType 都必须登记保留原因', () => {
        const allCalls: SimpleChoiceCallInfo[] = [];

        for (const filePath of getFilesToScan()) {
            try {
                const { calls } = analyzeFile(filePath);
                allCalls.push(...calls);
            } catch {
                continue;
            }
        }

        const genericSourceIds = Array.from(
            new Set(
                allCalls
                    .filter(call => call.targetType === 'generic')
                    .map(call => call.sourceId),
            ),
        ).sort();

        const approvedSourceIds = Object.keys(APPROVED_GENERIC_SOURCE_REASONS).sort();

        const missingReasons = genericSourceIds.filter(sourceId => {
            const reason = APPROVED_GENERIC_SOURCE_REASONS[sourceId];
            return typeof reason !== 'string' || reason.trim().length === 0;
        });

        const staleApprovals = approvedSourceIds.filter(sourceId => !genericSourceIds.includes(sourceId));

        const violations: string[] = [];
        if (missingReasons.length > 0) {
            violations.push(`缺少登记理由的 generic sourceId:\n${missingReasons.join('\n')}`);
        }
        if (staleApprovals.length > 0) {
            violations.push(`已不再使用 generic 的登记项:\n${staleApprovals.join('\n')}`);
        }

        expect(violations, violations.join('\n\n')).toEqual([]);
    });
});
