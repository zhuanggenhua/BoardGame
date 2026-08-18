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
    expressionContainsCall,
    extractSimpleChoiceConfig,
    getChoiceOptionsArg,
    inferDirectTargetTypeFromOptions,
    isCreateSimpleChoiceCall,
} from './helpers/simpleChoiceAst';
import { getSmashUpDirectHandPromptCardState, getSmashUpDirectPromptExtraOptions, getSmashUpSelectableBaseIndices, hasSmashUpDirectHandPromptPlayableOptions, isSmashUpDirectPromptTargetOption, isSmashUpPromptOwnedByPlayer, resolveSmashUpHandInteractionMode, resolveSmashUpHandPromptUiMode, shouldForceSmashUpPromptOverlay, shouldRenderSmashUpHandArea } from '../ui/interactionMode';

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
    buttonIntent?: string;
    genericIntent?: string;
    inferredGenericIntent?: string;
    autoRefresh?: string;
    responseValidationMode?: string;
    revalidateOnRespond?: boolean;
    hasMulti?: boolean;
    usesFieldSourceTargetOptions?: boolean;
    usesFieldSourceActionOptions?: boolean;
    hasFieldSourceTargetLiteral?: boolean;
    hasFieldSourceActionLiteral?: boolean;
    hasImplicitFieldSourceTargetShape?: boolean;
    valueProps?: string[];
    optionValueProps?: string[];
    contextValueProps?: string[];
}

// 只登记无法从 option 形状稳定推导的特殊/遗留交互。
// field-source-target / field-source-action 这类共享族由后面的类型守卫自动覆盖，
// 不要再按 sourceId 逐张牌维护，避免同一交互类型未来改口径时要逐项改白名单。
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
    base_the_asylum: { targetType: 'hand' },
    base_innsmouth_base_choose_player: { targetType: 'player' },
    base_miskatonic_university_base: { targetType: 'button' },
    base_greenhouse: { targetType: 'generic' },
    base_inventors_salon: { targetType: 'generic' },
    alien_supreme_overlord: { targetType: 'minion' },
    alien_collector: { targetType: 'minion' },
    alien_probe_choose_target: { targetType: 'player' },
    alien_probe: { targetType: 'generic' },
    alien_terraform_choose_replacement: { targetType: 'generic' },
    alien_terraform_play_minion: { targetType: 'hand' },
    bear_cavalry_bear_necessities: { targetType: 'board' },
    bear_cavalry_commission_choose_minion: { targetType: 'hand' },
    cthulhu_recruit_by_force: { targetType: 'generic' },
    cthulhu_it_begins_again: { targetType: 'generic' },
    cthulhu_corruption: { targetType: 'minion', autoRefresh: 'field', responseValidationMode: 'live' },
    cthulhu_madness_unleashed: { targetType: 'hand' },
    cthulhu_chosen_confirm: { targetType: 'generic' },
    cthulhu_star_spawn: { targetType: 'generic' },
    munchkin_treasure_crossbow_choose_faction: { targetType: 'button', responseValidationMode: 'live' },
    munchkin_treasure_dungeon_rulebook_destroy: { targetType: 'ongoing', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_treasure_potion_of_halitosis_choose_player: { targetType: 'player', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_treasure_potion_of_halitosis_move: { targetType: 'minion', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_treasure_potion_of_duplication_choose_talent: { targetType: 'minion', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_treasure_potion_of_straight_line_running_away_choose_treasure: { targetType: 'card', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_treasure_magic_missile_destroy: { targetType: 'minion', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_treasure_rocket_boots_move: { targetType: 'base', responseValidationMode: 'live' },
    munchkin_dwarves_anything_for_money_discard: { targetType: 'hand', autoRefresh: 'hand', responseValidationMode: 'live' },
    munchkin_dwarves_cash_out_choose_treasures: { targetType: 'hand', autoRefresh: 'hand', responseValidationMode: 'live' },
    munchkin_dwarves_gold_digger_choose_treasure: { targetType: 'card', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_dwarves_greed_is_good_choose_treasure: { targetType: 'card', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_dwarves_mine_choose_treasure: { targetType: 'generic', autoRefresh: 'deck', responseValidationMode: 'live' },
    munchkin_dwarves_no_my_precious_destroy: { targetType: 'ongoing', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_dwarves_salvage_choose_treasure: { targetType: 'generic', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_thieves_fence_choose_treasures: { targetType: 'hand', autoRefresh: 'hand', responseValidationMode: 'live' },
    munchkin_thieves_backstab_choose_treasure: { targetType: 'hand', autoRefresh: 'hand', responseValidationMode: 'live' },
    munchkin_thieves_backstab_choose_minion: { targetType: 'minion', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_thieves_potion_bandolier_choose_treasure: { targetType: 'hand', autoRefresh: 'hand', responseValidationMode: 'live' },
    munchkin_thieves_smuggling_choose_treasures: { targetType: 'hand', autoRefresh: 'hand', responseValidationMode: 'live' },
    munchkin_thieves_mugging_choose_action: { targetType: 'ongoing', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_thieves_mugging_choose_minion: { targetType: 'minion', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_thieves_strip_bare_choose_treasure: { targetType: 'board', autoRefresh: 'field', responseValidationMode: 'live' },
    cthulhu_servitor: { targetType: 'generic' },
    special_madness: { targetType: 'button' },
    elder_thing_begin_the_summoning: { targetType: 'generic' },
    elder_thing_elder_thing_choice: { targetType: 'button' },
    elder_thing_shoggoth_opponent: { targetType: 'button' },
    elder_thing_mi_go: { targetType: 'button' },
    pirate_broadside_choose_base: { targetType: 'base' },
    pirate_broadside_choose_player: { targetType: 'player' },
    dragons_burn_it_down: { targetType: 'button' },
    dragons_flank_attack_source: { targetType: 'button' },
    pirate_buccaneer_move: { targetType: 'base' },
    pirate_sea_dogs_choose_faction: { targetType: 'generic' },
    giant_ant_who_wants_to_live_forever: { targetType: 'minion', responseValidationMode: 'live' },
    giant_ant_drone_prevent_destroy: { targetType: 'minion' },
    giant_ant_we_are_the_champions_choose_snapshot_source: { targetType: 'generic' },
    robot_microbot_reclaimer: { targetType: 'generic' },
    robot_hoverbot: { targetType: 'generic' },
    steampunk_scrap_diving: { targetType: 'generic' },
    steampunk_captain_ahab: { targetType: 'base' },
    steampunk_zeppelin_choose_minion: { targetType: 'minion', responseValidationMode: 'live' },
    steampunk_zeppelin_choose_base: { targetType: 'base' },
    steampunk_mechanic: { targetType: 'generic' },
    steampunk_mechanic_target: { targetType: 'base', responseValidationMode: 'live' },
    steampunk_change_of_venue: { targetType: 'ongoing', responseValidationMode: 'live' },
    fairies_tinx: { targetType: 'ongoing' },
    geeks_rules_lawyer_action: { targetType: 'ongoing', responseValidationMode: 'live' },
    kaiju_johnny: { targetType: 'ongoing' },
    tornados_ripped_off: { targetType: 'ongoing' },
    steampunk_change_of_venue_choose_minion: { targetType: 'minion' },
    steampunk_change_of_venue_choose_base: { targetType: 'base' },
    frankenstein_lab_assistant: { targetType: 'minion', responseValidationMode: 'live' },
    frankenstein_herr_doktor: { targetType: 'minion', responseValidationMode: 'live' },
    frankenstein_igor: { targetType: 'minion', responseValidationMode: 'live' },
    frankenstein_angry_mob: { targetType: 'minion', responseValidationMode: 'live' },
    frankenstein_angry_mob_choose_card: { targetType: 'hand', responseValidationMode: 'live' },
    frankenstein_body_shop: { targetType: 'minion', responseValidationMode: 'live' },
    frankenstein_body_shop_distribute: { targetType: 'minion', responseValidationMode: 'live' },
    frankenstein_blitzed_remove: { targetType: 'minion', responseValidationMode: 'live' },
    frankenstein_blitzed_destroy: { targetType: 'minion', responseValidationMode: 'live' },
    trickster_block_the_path: { targetType: 'generic' },
    trickster_mark_of_sleep: { targetType: 'player' },
    wizard_neophyte: { targetType: 'button' },
    wizard_neophyte_choose_base: { targetType: 'base' },
    wizard_neophyte_choose_minion: { targetType: 'minion' },
    wizard_mass_enchantment: { targetType: 'generic' },
    wizard_mass_enchantment_choose_base: { targetType: 'base' },
    wizard_mass_enchantment_choose_minion: { targetType: 'minion' },
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
    itty_critters_leafaroo: { targetType: 'discard' },
    magical_girls_purge_the_demon: { targetType: 'board' },
    fairies_playful_tricks_destroy: { targetType: 'ongoing' },
    mega_troopers_lightning_crystal: { targetType: 'ongoing' },
    mega_troopers_plan_for_more_order: { targetType: 'generic', responseValidationMode: 'live' },
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
    zombie_they_keep_coming: { targetType: 'discard_minion' },
    zombie_lord_pick: { targetType: 'discard_minion' },
    zombie_mall_crawl: { targetType: 'generic' },
    time_travelers_into_the_time_slip_choose: { targetType: 'board' },
    time_travelers_time_raider_choose: { targetType: 'discard' },
    time_travelers_repeater_perfect_choose: { targetType: 'discard' },
    shapeshifters_cellular_bonding_choose: { targetType: 'ongoing' },
    base_q_point: { targetType: 'board' },
    base_primate_park_return: { targetType: 'ongoing', responseValidationMode: 'live' },
};

const BUTTON_INTENTS = [
    'control',
    'mode',
    'confirm-known-object',
    'known-card-action',
    'known-card-placement',
] as const;

const ALLOWED_BUTTON_INTENTS = new Set<string>(BUTTON_INTENTS);

const BUTTON_INTENTS_ALLOWING_OBJECT_CONTEXT = new Set<string>([
    'mode',
    'confirm-known-object',
    'known-card-action',
    'known-card-placement',
]);

const BUTTON_INTENTS_ALLOWING_OBJECT_OPTION_VALUES = new Set<string>([
    'known-card-action',
]);

const BUTTON_FIELD_OBJECT_VALUE_PROPS = [
    'actionUid',
    'baseIndex',
    'targetBaseIndex',
    'fromBaseIndex',
    'toBaseIndex',
    'minionUid',
    'targetMinionUid',
    'sourceUid',
    'ongoingUid',
    'targetUid',
    'targetPlayerId',
] as const;

const GENERIC_INTENTS = [
    'card-pool',
    'buried-card',
    'snapshot-field-object',
    'composite-context',
    'mode',
    'order',
    'mixed-card-and-control',
    'definition-choice',
] as const;

const ALLOWED_GENERIC_INTENTS = new Set<string>(GENERIC_INTENTS);

function collectObjectLiteralPropertyNames(objectNode: ts.ObjectLiteralExpression, props: Set<string>): void {
    for (const prop of objectNode.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
            props.add(prop.name.text);
        } else if (ts.isShorthandPropertyAssignment(prop)) {
            props.add(prop.name.text);
        }
    }
}

function findNearestVariableDeclarationForAudit(
    sourceFile: ts.SourceFile,
    referenceNode: ts.Node,
    name: string,
): ts.VariableDeclaration | undefined {
    let best: ts.VariableDeclaration | undefined;
    const referencePos = referenceNode.getStart(sourceFile);
    const visit = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
            const start = node.getStart(sourceFile);
            if (start < referencePos && (!best || start > best.getStart(sourceFile))) {
                best = node;
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return best;
}

function extractObjectLiteralFromMapCallback(expr: ts.Expression): ts.ObjectLiteralExpression | undefined {
    const unwrapped = unwrapAuditExpression(expr);
    if (
        !unwrapped
        || !ts.isCallExpression(unwrapped)
        || !ts.isPropertyAccessExpression(unwrapped.expression)
        || unwrapped.expression.name.text !== 'map'
    ) {
        return undefined;
    }

    const callback = unwrapped.arguments[0];
    if (!callback || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) {
        return undefined;
    }

    const body = callback.body;
    const bodyExpression = unwrapAuditExpression(body as ts.Expression);
    if (bodyExpression && ts.isObjectLiteralExpression(bodyExpression)) return bodyExpression;
    if (!ts.isBlock(body)) return undefined;

    for (const statement of body.statements) {
        if (!ts.isReturnStatement(statement)) continue;
        const returned = unwrapAuditExpression(statement.expression);
        if (returned && ts.isObjectLiteralExpression(returned)) return returned;
    }
    return undefined;
}

function collectValuePropsFromExpression(
    sourceFile: ts.SourceFile,
    referenceNode: ts.Node,
    expr: ts.Expression | undefined,
    props: Set<string>,
    seen: Set<number> = new Set(),
): void {
    const unwrapped = unwrapAuditExpression(expr);
    if (!unwrapped) return;

    if (ts.isObjectLiteralExpression(unwrapped)) {
        collectObjectLiteralPropertyNames(unwrapped, props);
        return;
    }

    if (ts.isArrayLiteralExpression(unwrapped)) {
        for (const element of unwrapped.elements) {
            if (ts.isSpreadElement(element)) {
                collectValuePropsFromExpression(sourceFile, referenceNode, element.expression, props, seen);
                continue;
            }
            collectValuePropsFromExpression(sourceFile, referenceNode, element, props, seen);
        }
        return;
    }

    const mappedObject = extractObjectLiteralFromMapCallback(unwrapped);
    if (mappedObject) {
        collectObjectLiteralPropertyNames(mappedObject, props);
        return;
    }

    const identifier = ts.isIdentifier(unwrapped)
        ? unwrapped
        : ts.isElementAccessExpression(unwrapped) && ts.isIdentifier(unwrapped.expression)
            ? unwrapped.expression
            : undefined;
    if (!identifier) return;

    const declaration = findNearestVariableDeclarationForAudit(sourceFile, referenceNode, identifier.text);
    if (!declaration?.initializer) return;
    const declarationStart = declaration.getStart(sourceFile);
    if (seen.has(declarationStart)) return;
    seen.add(declarationStart);
    collectValuePropsFromExpression(sourceFile, referenceNode, declaration.initializer, props, seen);
}

function extractValueProps(optionNode: ts.ObjectLiteralExpression): Set<string> {
    const props = new Set<string>();
    const valueProp = optionNode.properties.find(
        prop => ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'value'
    ) as ts.PropertyAssignment | undefined;

    if (!valueProp) return props;
    collectValuePropsFromExpression(optionNode.getSourceFile(), optionNode, valueProp.initializer, props);
    return props;
}

function extractChoiceValuePropNames(options: ts.ObjectLiteralExpression[]): string[] {
    return Array.from(
        options.reduce((props, optionNode) => {
            for (const prop of extractValueProps(optionNode)) {
                props.add(prop);
            }
            return props;
        }, new Set<string>()),
    ).sort();
}

function extractChoiceOptionSourceNames(options: ts.ObjectLiteralExpression[]): string[] {
    return Array.from(
        options.reduce((sources, optionNode) => {
            const source = extractTopLevelStringProp(optionNode, '_source');
            if (source) sources.add(source);
            return sources;
        }, new Set<string>()),
    ).sort();
}

function hasAnyProp(props: Set<string>, names: readonly string[]): boolean {
    return names.some(name => props.has(name));
}

function resolveGenericChoiceIntentForAudit(
    config: {
        targetType?: string;
        genericIntent?: string;
        autoRefresh?: string;
        hasMulti?: boolean;
    },
    options: ts.ObjectLiteralExpression[],
    optionValueProps: readonly string[],
    contextValueProps: readonly string[],
): string | undefined {
    if (config.targetType !== 'generic') return undefined;
    if (config.genericIntent) return config.genericIntent;

    const props = new Set([...optionValueProps, ...contextValueProps]);
    const optionProps = new Set(optionValueProps);
    const contextProps = new Set(contextValueProps);
    const sources = new Set(extractChoiceOptionSourceNames(options));
    const hasCardIdentity = hasAnyProp(props, ['cardUid', 'sourceCardUid', 'defId', 'minionDefId', 'baseDefId', 'topCardUid']);
    const hasFieldObjectContext = hasAnyProp(props, [
        'actionUid',
        'baseIndex',
        'fromBaseIndex',
        'sourceBaseIndex',
        'targetBaseIndex',
        'toBaseIndex',
        'minionUid',
        'targetMinionUid',
        'ongoingUid',
        'sourceUid',
        'targetUid',
    ]);
    const hasPlayerContext = hasAnyProp(props, ['playerId', 'pid', 'targetPlayerId', 'ownerId', 'controllerId']);
    const hasCardPoolSource = ['deck', 'discard', 'static', 'play'].some(source => sources.has(source))
        || ['deck', 'discard', 'hand_or_discard', 'buried'].includes(config.autoRefresh ?? '')
        || props.has('zone');

    if (
        checkHandSelectFallback(options)
        || (checkMinionSelectFallback(options) && !hasUnsafeMinionFields(options))
        || (checkBaseSelectFallback(options) && !hasUnsafeBaseFields(options))
        || checkPlayerSelectFallback(options)
    ) {
        return undefined;
    }

    if (props.has('buriedFrom') || (hasCardIdentity && hasFieldObjectContext && sources.has('static'))) {
        return 'buried-card';
    }

    if (sources.has('static') && hasFieldObjectContext) {
        return 'snapshot-field-object';
    }

    if (hasAnyProp(props, ['remainingCards', 'orderContext', 'trackedAll', 'ordered', 'topCardUid'])
        || (config.hasMulti && hasCardIdentity && contextProps.size > 0 && !hasFieldObjectContext)) {
        return 'order';
    }

    if (hasAnyProp(props, ['mode', 'choice', 'kind']) && (hasFieldObjectContext || hasCardIdentity || hasPlayerContext)) {
        return 'mixed-card-and-control';
    }

    if (hasCardIdentity && (hasFieldObjectContext || hasPlayerContext || contextProps.size > 0)) {
        return 'composite-context';
    }

    if (hasCardIdentity && hasCardPoolSource) {
        return 'card-pool';
    }

    if (props.has('factionId') || props.has('faction') || props.has('name') || (optionProps.has('defId') && !optionProps.has('cardUid'))) {
        return 'definition-choice';
    }

    if (checkButtonSelectFallback(options)) {
        return 'mode';
    }

    return undefined;
}

function describeGenericChoiceIntentForAudit(intent: string | undefined): string {
    return intent ?? '未声明且无法从选项形状推导';
}

function findEnclosingStatementForAudit(node: ts.Node): ts.Statement | undefined {
    let current: ts.Node | undefined = node;
    while (current) {
        if (ts.isStatement(current)) return current;
        current = current.parent;
    }
    return undefined;
}

function nodeContainsAuditNode(haystack: ts.Node | undefined, needle: ts.Node): boolean {
    if (!haystack) return false;
    if (haystack === needle) return true;
    let found = false;
    const visit = (node: ts.Node) => {
        if (found) return;
        if (node === needle) {
            found = true;
            return;
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(haystack, visit);
    return found;
}

function findInteractionVariableNameForAudit(sourceFile: ts.SourceFile, node: ts.Node): string | undefined {
    let current: ts.Node | undefined = node.parent;
    while (current) {
        if (
            ts.isVariableDeclaration(current)
            && ts.isIdentifier(current.name)
            && nodeContainsAuditNode(current.initializer, node)
        ) {
            return current.name.text;
        }
        current = current.parent;
    }
    return undefined;
}

function extractPromptContextPropsFromAssignment(
    sourceFile: ts.SourceFile,
    statement: ts.Statement,
    interactionVariableName: string,
    props: Set<string>,
): void {
    const visit = (node: ts.Node) => {
        if (ts.isFunctionLike(node)) return;
        if (
            ts.isBinaryExpression(node)
            && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
            && ts.isPropertyAccessExpression(node.left)
            && node.left.name.text === 'continuationContext'
        ) {
            const leftText = node.left.expression.getText(sourceFile);
            const right = unwrapAuditExpression(node.right);
            if (
                leftText.includes(interactionVariableName)
                && right
                && ts.isObjectLiteralExpression(right)
            ) {
                collectObjectLiteralPropertyNames(right, props);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(statement);
}

function extractNearbyPromptContextPropNames(sourceFile: ts.SourceFile, node: ts.Node): string[] {
    const props = new Set<string>();
    const interactionVariableName = findInteractionVariableNameForAudit(sourceFile, node);
    const choiceStatement = findEnclosingStatementForAudit(node);
    const block = choiceStatement?.parent;

    if (interactionVariableName && choiceStatement && block && (ts.isBlock(block) || ts.isSourceFile(block))) {
        const statements = block.statements;
        const choiceIndex = statements.indexOf(choiceStatement);
        if (choiceIndex >= 0) {
            for (let i = choiceIndex + 1; i < statements.length; i += 1) {
                const statement = statements[i];
                extractPromptContextPropsFromAssignment(sourceFile, statement, interactionVariableName, props);
                if (ts.isReturnStatement(statement)) break;
            }
        }
    }

    return Array.from(props).sort();
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

function getObjectPropertyName(name: ts.PropertyName): string | undefined {
    if (ts.isIdentifier(name)) return name.text;
    if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
    return undefined;
}

function getCallName(node: ts.CallExpression): string | undefined {
    const expr = node.expression;
    if (ts.isIdentifier(expr)) return expr.text;
    if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
    return undefined;
}

function extractStringLiteralValue(expr: ts.Expression): string | undefined {
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
    return undefined;
}

function unwrapAuditExpression(expr: ts.Expression | undefined): ts.Expression | undefined {
    let current = expr;
    while (current) {
        if (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
            current = current.expression;
            continue;
        }
        return current;
    }
    return current;
}

function resolveLocalStringLiteral(
    sourceFile: ts.SourceFile,
    referenceNode: ts.Node,
    expr: ts.Expression | undefined,
): string | undefined {
    const unwrapped = unwrapAuditExpression(expr);
    if (!unwrapped) return undefined;
    if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) return unwrapped.text;
    if (!ts.isIdentifier(unwrapped)) return undefined;

    let best: ts.VariableDeclaration | undefined;
    const referencePos = referenceNode.getStart(sourceFile);
    const visit = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === unwrapped.text) {
            const start = node.getStart(sourceFile);
            if (start < referencePos && (!best || start > best.getStart(sourceFile))) {
                best = node;
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    return resolveLocalStringLiteral(sourceFile, referenceNode, best?.initializer);
}

function extractChoiceConfigArgForAudit(node: ts.CallExpression): ts.Expression | undefined {
    const callName = getCallName(node);
    if (callName === 'resolveOrPrompt') return node.arguments[2] as ts.Expression | undefined;
    return node.arguments[4] as ts.Expression | undefined;
}

function extractChoiceSourceIdForAudit(sourceFile: ts.SourceFile, node: ts.CallExpression): string | undefined {
    const rawConfigArg = unwrapAuditExpression(extractChoiceConfigArgForAudit(node));
    const rawConfigCallName = rawConfigArg && ts.isCallExpression(rawConfigArg)
        ? getCallName(rawConfigArg)
        : undefined;
    const configArg = rawConfigCallName === 'buildFieldSourceTargetPromptConfig'
        || rawConfigCallName === 'buildFieldSourceActionPromptConfig'
        ? unwrapAuditExpression(rawConfigArg.arguments[0] as ts.Expression | undefined)
        : rawConfigArg;
    if (!configArg || !ts.isObjectLiteralExpression(configArg)) return undefined;

    const sourceIdProp = configArg.properties.find(entry =>
        ts.isPropertyAssignment(entry) && getObjectPropertyName(entry.name) === 'sourceId'
    ) as ts.PropertyAssignment | undefined;
    if (!sourceIdProp) return undefined;

    return resolveLocalStringLiteral(sourceFile, node, sourceIdProp.initializer);
}

function getEnclosingPromptProgramInteractionSourceIds(node: ts.Node): string[] {
    let current: ts.Node | undefined = node.parent;
    while (current) {
        if (ts.isCallExpression(current) && getCallName(current) === 'createPromptProgram') {
            const config = current.arguments[0];
            if (!config || !ts.isObjectLiteralExpression(config)) return [];
            const prop = config.properties.find(entry =>
                ts.isPropertyAssignment(entry)
                && getObjectPropertyName(entry.name) === 'interactionSourceIds'
            ) as ts.PropertyAssignment | undefined;
            if (!prop || !ts.isArrayLiteralExpression(prop.initializer)) return [];
            return prop.initializer.elements
                .map(element => extractStringLiteralValue(element))
                .filter((value): value is string => !!value);
        }
        current = current.parent;
    }
    return [];
}

function checkMinionSelectFallback(options: ts.ObjectLiteralExpression[]): boolean {
    if (options.length === 0) return false;
    const controlFields = new Set(['accept', 'confirm', 'returnIt', 'skip', 'done']);
    let hasMinionOption = false;
    return options.every(opt => {
        const props = extractValueProps(opt);
        const source = extractTopLevelStringProp(opt, '_source');

        if (props.has('minionUid')) {
            if (source === 'static' || source === 'discard') return false;
            if (props.has('toBase') || props.has('toBaseIndex') || props.has('targetPlayerId') || props.has('baseDefId')) {
                return false;
            }
            for (const field of controlFields) {
                if (props.has(field)) return false;
            }
            hasMinionOption = true;
            return true;
        }

        if (props.size === 0) return false;
        for (const field of props) {
            if (!controlFields.has(field)) return false;
        }
        return true;
    }) && hasMinionOption;
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

function hasSourceTargetObjectFields(props: Set<string>): boolean {
    return props.has('targetUid')
        || props.has('targetBaseIndex')
        || props.has('targetMinionUid');
}

function hasSourceActionShape(props: Set<string>): boolean {
    return props.has('fieldInteractionType')
        && props.has('fieldSourceType')
        && props.has('sourceUid')
        && !props.has('fieldTargetType')
        && !hasSourceTargetObjectFields(props);
}

function findFieldSourceInteractionIssue(options: ts.ObjectLiteralExpression[]): string | undefined {
    for (const opt of options) {
        const props = extractValueProps(opt);
        if (props.has('fieldSourceTargetType')) {
            return '旧 fieldSourceTargetType 已废弃；能力层必须使用 fieldInteractionType/source-target 或 source-action 的共享合同。';
        }

        if (!props.has('fieldInteractionType')) continue;

        const displayMode = extractTopLevelStringProp(opt, 'displayMode');
        if (displayMode === 'button') {
            return '场上来源对象效果不能用按钮作为主路径，必须点击来源对象本体。';
        }

        if (hasSourceActionShape(props)) {
            continue;
        }
        if (!props.has('fieldSourceType') || !props.has('fieldTargetType')) {
            return '场上来源对象到目标对象的效果必须显式声明 source-target/source/target 三段语义，不能让 UI 猜。';
        }
        if (!props.has('sourceUid')) {
            return '场上来源对象到目标对象的效果必须携带稳定来源对象，不能让 UI 反推。';
        }
        if (!hasSourceTargetObjectFields(props) && !props.has('baseIndex')) {
            return '场上来源对象到目标对象的效果必须携带稳定目标对象，不能让 UI 反推。';
        }
    }
    return undefined;
}

function hasFieldSourceTargetLiteral(options: ts.ObjectLiteralExpression[]): boolean {
    return options.some(opt => {
        const props = extractValueProps(opt);
        return props.has('fieldSourceTargetType')
            || (props.has('fieldInteractionType') && (props.has('fieldTargetType') || hasSourceTargetObjectFields(props)));
    });
}

function hasFieldSourceActionLiteral(options: ts.ObjectLiteralExpression[]): boolean {
    return options.some(opt => {
        const props = extractValueProps(opt);
        return hasSourceActionShape(props);
    });
}

function hasImplicitFieldSourceTargetShape(options: ts.ObjectLiteralExpression[]): boolean {
    return options.some(opt => {
        const props = extractValueProps(opt);
        if (props.has('fieldInteractionType') || props.has('fieldSourceTargetType')) return false;

        const hasExplicitSource = props.has('sourceUid');
        const hasLegacySourceMove = props.has('minionUid') && props.has('fromBaseIndex') && props.has('targetBaseIndex');
        const hasTargetObject =
            props.has('targetBaseIndex')
            || props.has('targetMinionUid')
            || props.has('targetUid');

        return (hasExplicitSource && hasTargetObject) || hasLegacySourceMove;
    });
}

function extractObjectStringProperty(objectNode: ts.ObjectLiteralExpression, propName: string): string | undefined {
    const prop = objectNode.properties.find(
        entry => ts.isPropertyAssignment(entry) && getObjectPropertyName(entry.name) === propName,
    ) as ts.PropertyAssignment | undefined;
    if (!prop) return undefined;
    return extractStringLiteralValue(prop.initializer);
}

function analyzeFile(filePath: string): { issues: TargetTypeIssue[]; calls: SimpleChoiceCallInfo[] } {
    const content = readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const issues: TargetTypeIssue[] = [];
    const calls: SimpleChoiceCallInfo[] = [];

    const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && getCallName(node) === 'buildScoringTitanMoveInteraction') {
            const config = node.arguments[0];
            const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart()).line + 1;
            const sourceId = config && ts.isObjectLiteralExpression(config)
                ? extractObjectStringProperty(config, 'sourceId') ?? 'unknown'
                : 'unknown';
            calls.push({
                file: filePath,
                line,
                sourceId,
                targetType: 'field-source-target',
                buttonIntent: undefined,
                usesFieldSourceTargetOptions: true,
                hasFieldSourceTargetLiteral: false,
            });
        }

        if (isCreateSimpleChoiceCall(node)) {
            const config = extractSimpleChoiceConfig(node);
            const resolvedSourceId = extractChoiceSourceIdForAudit(sourceFile, node);
            if (resolvedSourceId) config.sourceId = resolvedSourceId;
            const optionsArg = getChoiceOptionsArg(node);
            const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart()).line + 1;
            const usesFieldSourceTargetOptions = expressionContainsCall(
                sourceFile,
                optionsArg,
                node,
                [
                    'buildFieldSourceTargetOptions',
                    'buildFieldSourceToBaseTargetOptions',
                    'buildFieldSourceToMinionTargetOptions',
                ],
            );
            const usesFieldSourceActionOptions = expressionContainsCall(
                sourceFile,
                optionsArg,
                node,
                ['buildFieldSourceActionOptions'],
            );
            const resolvedOptionsForAudit = collectOptionObjectLiterals(sourceFile, optionsArg, node);
            const hasFieldSourceTargetOptionLiteral = hasFieldSourceTargetLiteral(resolvedOptionsForAudit);
            const hasFieldSourceActionOptionLiteral = hasFieldSourceActionLiteral(resolvedOptionsForAudit);
            const hasImplicitFieldSourceTargetOptionShape = hasImplicitFieldSourceTargetShape(resolvedOptionsForAudit);
            const optionValueProps = extractChoiceValuePropNames(resolvedOptionsForAudit);
            const contextValueProps = extractNearbyPromptContextPropNames(sourceFile, node);
            const choiceAndContextValueProps = Array.from(new Set([...optionValueProps, ...contextValueProps])).sort();
            const resolvedGenericIntent = resolveGenericChoiceIntentForAudit(
                config,
                resolvedOptionsForAudit,
                optionValueProps,
                contextValueProps,
            );
            const isAllowedGenericTarget = config.targetType === 'generic' && !!resolvedGenericIntent;
            calls.push({
                file: filePath,
                line,
                sourceId: config.sourceId,
                targetType: config.targetType,
                buttonIntent: config.buttonIntent,
                genericIntent: config.genericIntent,
                inferredGenericIntent: config.genericIntent ? undefined : resolvedGenericIntent,
                autoRefresh: config.autoRefresh,
                responseValidationMode: config.responseValidationMode,
                revalidateOnRespond: config.revalidateOnRespond,
                hasMulti: config.hasMulti,
                usesFieldSourceTargetOptions,
                usesFieldSourceActionOptions,
                hasFieldSourceTargetLiteral: hasFieldSourceTargetOptionLiteral,
                hasFieldSourceActionLiteral: hasFieldSourceActionOptionLiteral,
                hasImplicitFieldSourceTargetShape: hasImplicitFieldSourceTargetOptionShape,
                valueProps: choiceAndContextValueProps,
                optionValueProps,
                contextValueProps,
            });
            const shouldMirrorEnclosingInteractionSourceIds = config.sourceId === 'unknown' || config.sourceId === '[unknown]';
            for (const interactionSourceId of shouldMirrorEnclosingInteractionSourceIds ? getEnclosingPromptProgramInteractionSourceIds(node) : []) {
                calls.push({
                    file: filePath,
                    line,
                    sourceId: interactionSourceId,
                    targetType: config.targetType,
                    buttonIntent: config.buttonIntent,
                    genericIntent: config.genericIntent,
                    inferredGenericIntent: config.genericIntent ? undefined : resolvedGenericIntent,
                    autoRefresh: config.autoRefresh,
                    responseValidationMode: config.responseValidationMode,
                    revalidateOnRespond: config.revalidateOnRespond,
                    hasMulti: config.hasMulti,
                    usesFieldSourceTargetOptions,
                    usesFieldSourceActionOptions,
                    hasFieldSourceTargetLiteral: hasFieldSourceTargetOptionLiteral,
                    hasFieldSourceActionLiteral: hasFieldSourceActionOptionLiteral,
                    hasImplicitFieldSourceTargetShape: hasImplicitFieldSourceTargetOptionShape,
                    valueProps: choiceAndContextValueProps,
                    optionValueProps,
                    contextValueProps,
                });
            }

            const fieldSourceInteractionIssue = findFieldSourceInteractionIssue(resolvedOptionsForAudit);
            if (fieldSourceInteractionIssue) {
                issues.push({
                    file: filePath,
                    line,
                    sourceId: config.sourceId,
                    issue: '场上来源效果交互载体错误',
                    detail: fieldSourceInteractionIssue,
                });
            }
            if (hasFieldSourceTargetOptionLiteral && !usesFieldSourceTargetOptions) {
                issues.push({
                    file: filePath,
                    line,
                    sourceId: config.sourceId,
                    issue: '场上来源效果绕过共享入口',
                    detail: '同一种“场上来源对象 -> 目标对象”交互必须使用 buildFieldSourceTargetOptions / buildFieldSourceToBaseTargetOptions / buildFieldSourceToMinionTargetOptions，禁止每张牌手拼 option payload。',
                });
            }
            if (hasFieldSourceActionOptionLiteral && !usesFieldSourceActionOptions) {
                issues.push({
                    file: filePath,
                    line,
                    sourceId: config.sourceId,
                    issue: '场上来源本体确认绕过共享入口',
                    detail: '同一种“场上来源对象本体 -> 确认当前来源动作”交互必须使用 buildFieldSourceActionOptions，禁止每张牌手拼 option payload。',
                });
            }
            if (hasImplicitFieldSourceTargetOptionShape && !usesFieldSourceTargetOptions) {
                issues.push({
                    file: filePath,
                    line,
                    sourceId: config.sourceId,
                    issue: '场上来源效果疑似手拼来源/目标 payload',
                    detail: '选项同时携带稳定来源对象和目标对象字段时，必须走 field source-target 共享入口；不要为单张牌手写一套来源先点、目标后点逻辑。',
                });
            }
            if (usesFieldSourceTargetOptions && config.targetType !== 'field-source-target') {
                issues.push({
                    file: filePath,
                    line,
                    sourceId: config.sourceId,
                    issue: '场上来源效果 targetType 声明错误',
                    detail: `使用 field source-target 共享入口的交互必须通过 buildFieldSourceTargetPromptConfig 声明 targetType: "field-source-target"，当前为 "${config.targetType ?? '未声明'}"。`,
                });
            }
            if (usesFieldSourceActionOptions && config.targetType !== 'field-source-action') {
                issues.push({
                    file: filePath,
                    line,
                    sourceId: config.sourceId,
                    issue: '场上来源本体确认 targetType 声明错误',
                    detail: `使用 field source-action 共享入口的交互必须通过 buildFieldSourceActionPromptConfig 声明 targetType: "field-source-action"，当前为 "${config.targetType ?? '未声明'}"。`,
                });
            }

            if (!config.hasTargetType) {
                const resolvedOptions = resolvedOptionsForAudit;
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

            if (!isAllowedGenericTarget && config.hasTargetType && config.targetType !== 'hand') {
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

            if (!isAllowedGenericTarget && config.hasTargetType && config.targetType !== 'minion') {
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

            if (!isAllowedGenericTarget && config.hasTargetType && config.targetType !== 'base') {
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

            if (!isAllowedGenericTarget && config.hasTargetType && config.targetType !== 'player') {
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

            if (!isAllowedGenericTarget && config.hasTargetType && config.targetType !== 'button') {
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

let cachedAuditScan: { issues: TargetTypeIssue[]; calls: SimpleChoiceCallInfo[] } | undefined;

function getAuditScan(): { issues: TargetTypeIssue[]; calls: SimpleChoiceCallInfo[] } {
    if (cachedAuditScan) return cachedAuditScan;

    const issues: TargetTypeIssue[] = [];
    const calls: SimpleChoiceCallInfo[] = [];
    for (const filePath of getFilesToScan()) {
        try {
            const result = analyzeFile(filePath);
            issues.push(...result.issues);
            calls.push(...result.calls);
        } catch {
            // 文件不存在或解析失败时跳过，避免阻塞整个审计
        }
    }

    cachedAuditScan = { issues, calls };
    return cachedAuditScan;
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

function getSmashUpSourceAndTestFiles(): string[] {
    const root = resolve(__dirname, '..');
    const files: string[] = [];
    const visit = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                visit(fullPath);
                continue;
            }
            if (/\.(ts|tsx)$/.test(entry.name)) {
                files.push(fullPath);
            }
        }
    };
    visit(root);
    return files;
}

describe('SmashUp Interaction targetType 审计', () => {
    it('所有 createSimpleChoice 的直点/通用交互都显式声明正确的 targetType', () => {
        const allIssues = getAuditScan().issues;

        if (allIssues.length > 0) {
            const report = allIssues.map(issue =>
                `${issue.file}:${issue.line} [${issue.sourceId}] ${issue.issue}\n  → ${issue.detail}`
            ).join('\n\n');
            expect.fail(`发现 ${allIssues.length} 个 targetType 显式声明/误判风险：\n\n${report}`);
        }

        expect(allIssues).toEqual([]);
    });

    it('已登记的非共享特殊交互必须保留显式 targetType / autoRefresh 配置', () => {
        const allCalls = getAuditScan().calls;

        const violations: string[] = [];
        for (const [sourceId, expected] of Object.entries(REQUIRED_SOURCE_CONFIGS)) {
            if (expected.targetType === 'field-source-target' || expected.targetType === 'field-source-action') {
                violations.push(`[${sourceId}] field-source 共享族不得按 sourceId 逐牌登记；必须由共享类型守卫自动覆盖。`);
            }
        }

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

    it('场上来源对象到目标对象的交互必须统一走 field-source-target 共享合同', () => {
        const allCalls = getAuditScan().calls;

        const violations: string[] = [];
        const fieldSourceTargetCalls = allCalls.filter(call =>
            call.usesFieldSourceTargetOptions
            || call.hasFieldSourceTargetLiteral
            || call.hasImplicitFieldSourceTargetShape
        );
        if (fieldSourceTargetCalls.length === 0) {
            violations.push('未发现任何场上来源对象到目标对象的共享交互；如果本族被删除，必须先回写 evidence 降级。');
        }

        for (const match of fieldSourceTargetCalls) {
            if (match.targetType !== 'field-source-target') {
                violations.push(`${match.file}:${match.line} [${match.sourceId}] 使用场上来源-目标语义时 targetType 必须是 "field-source-target"，实际 "${match.targetType ?? '未声明'}"`);
            }
            if (!match.usesFieldSourceTargetOptions) {
                violations.push(`${match.file}:${match.line} [${match.sourceId}] 必须使用 field source-target 共享入口，不能手拼 payload 或把按钮/目标对象选项当作发动主路径`);
            }
        }

        const helperPath = resolve(__dirname, '../domain/abilityHelpers.ts');
        const fieldInteractionPath = resolve(__dirname, '../domain/fieldInteractionOptions.ts');
        const helperSource = readFileSync(helperPath, 'utf-8') + '\n' + readFileSync(fieldInteractionPath, 'utf-8');
        const requiredHelperSnippets = [
            'export const FIELD_SOURCE_TARGET_PROMPT_TARGET_TYPE',
            'export function buildFieldSourceTargetPromptConfig',
            'export function buildFieldSourceTargetOptions',
            'export function buildFieldSourceToBaseTargetOptions',
            'export function buildFieldSourceToMinionTargetOptions',
            'FieldObjectType',
            "targetType: FIELD_SOURCE_TARGET_PROMPT_TARGET_TYPE",
            'buildFieldSourceTargetOptions<TExtra>',
            "fieldInteractionType: 'source-target'",
            'fieldSourceType: source.type',
            'fieldTargetType: target.type',
            'sourceUid: source.uid',
            'cardUid: source.uid',
            'ongoingUid: source.uid',
            'targetBaseIndex: target.baseIndex',
            'targetMinionUid: target.uid',
            'targetMinionDefId: target.defId',
            'targetDefId: target.defId',
            'minionUid: source.uid',
            'baseIndex: target.baseIndex',
            "displayMode: 'card' as const",
        ];
        for (const snippet of requiredHelperSnippets) {
            if (!helperSource.includes(snippet)) {
                violations.push(`${helperPath} 缺少通用场上来源-目标合同片段：${snippet}`);
            }
        }

        for (const filePath of [...getFilesToScan(), helperPath, fieldInteractionPath]) {
            const content = readFileSync(filePath, 'utf-8');
            if (content.includes('fieldSourceTargetType')) {
                violations.push(`${filePath} 仍在能力/domain 层产出旧 fieldSourceTargetType，必须迁移到三段语义字段`);
            }
        }

        expect(violations, `以下计分来源对象交互仍可能退回按钮/旧字段主路径：\n${violations.join('\n')}`).toEqual([]);
    });

    it('场上来源对象本体确认必须统一走 field-source-action 共享合同', () => {
        const allCalls = getAuditScan().calls;

        const violations: string[] = [];
        const fieldSourceActionCalls = allCalls.filter(call =>
            call.usesFieldSourceActionOptions
            || call.hasFieldSourceActionLiteral
        );
        if (fieldSourceActionCalls.length === 0) {
            violations.push('未发现任何场上来源对象本体确认共享交互；如果本族被删除，必须先回写 evidence 降级。');
        }

        for (const match of fieldSourceActionCalls) {
            if (match.targetType !== 'field-source-action') {
                violations.push(`${match.file}:${match.line} [${match.sourceId}] 使用场上来源本体确认语义时 targetType 必须是 "field-source-action"，实际 "${match.targetType ?? '未声明'}"`);
            }
            if (!match.usesFieldSourceActionOptions) {
                violations.push(`${match.file}:${match.line} [${match.sourceId}] 必须使用 field source-action 共享入口，不能手拼 payload 或把按钮当作发动主路径`);
            }
        }

        const helperPath = resolve(__dirname, '../domain/abilityHelpers.ts');
        const fieldInteractionPath = resolve(__dirname, '../domain/fieldInteractionOptions.ts');
        const helperSource = readFileSync(helperPath, 'utf-8') + '\n' + readFileSync(fieldInteractionPath, 'utf-8');
        const requiredHelperSnippets = [
            'export const FIELD_SOURCE_ACTION_PROMPT_TARGET_TYPE',
            'export function buildFieldSourceActionPromptConfig',
            'export function buildFieldSourceActionOptions',
            "targetType: FIELD_SOURCE_ACTION_PROMPT_TARGET_TYPE",
            'buildFieldSourceActionOptions<TExtra extends',
            "fieldInteractionType: 'source-action'",
            'fieldSourceType: source.type',
            'sourceUid: source.uid',
            'minionUid: source.uid',
            'cardUid: source.uid',
            'ongoingUid: source.uid',
            'titanUid: source.uid',
            "displayMode: 'card' as const",
        ];
        for (const snippet of requiredHelperSnippets) {
            if (!helperSource.includes(snippet)) {
                violations.push(`${helperPath} 缺少通用场上来源本体确认合同片段：${snippet}`);
            }
        }

        expect(violations, `以下场上来源本体确认仍可能退回按钮/手拼主路径：\n${violations.join('\n')}`).toEqual([]);
    });

    it('button targetType 携带对象字段时必须声明通用按钮职责，不能靠 sourceId 例外', () => {
        const allCalls = getAuditScan().calls;

        const violations: string[] = [];
        const buttonObjectProps = (props: string[] | undefined) => (props ?? []).filter(prop =>
            (BUTTON_FIELD_OBJECT_VALUE_PROPS as readonly string[]).includes(prop)
        );

        for (const call of allCalls) {
            if (call.buttonIntent && !ALLOWED_BUTTON_INTENTS.has(call.buttonIntent)) {
                violations.push(`${call.file}:${call.line} [${call.sourceId}] buttonIntent="${call.buttonIntent}" 不是通用按钮职责：${BUTTON_INTENTS.join(', ')}`);
            }
            if (call.buttonIntent && call.targetType !== 'button') {
                violations.push(`${call.file}:${call.line} [${call.sourceId}] buttonIntent 只能用于 targetType: "button"，当前 targetType="${call.targetType ?? '未声明'}"`);
            }
            if (call.targetType !== 'button') continue;

            const optionObjectProps = buttonObjectProps(call.optionValueProps);
            const contextObjectProps = buttonObjectProps(call.contextValueProps);
            if (optionObjectProps.length === 0 && contextObjectProps.length === 0) continue;

            if (!call.buttonIntent) {
                violations.push(`${call.file}:${call.line} [${call.sourceId}] button 交互携带对象字段 ${[...optionObjectProps, ...contextObjectProps].join(', ')}；必须声明 buttonIntent，说明它是模式/已确定对象确认/已知卡牌处理，而不是 sourceId 例外。`);
                continue;
            }

            if (contextObjectProps.length > 0 && !BUTTON_INTENTS_ALLOWING_OBJECT_CONTEXT.has(call.buttonIntent)) {
                violations.push(`${call.file}:${call.line} [${call.sourceId}] buttonIntent="${call.buttonIntent}" 不能携带上下文字段 ${contextObjectProps.join(', ')}；已确定对象上下文必须使用 mode / confirm-known-object / known-card-action / known-card-placement。`);
            }
            if (optionObjectProps.length > 0 && !BUTTON_INTENTS_ALLOWING_OBJECT_OPTION_VALUES.has(call.buttonIntent)) {
                violations.push(`${call.file}:${call.line} [${call.sourceId}] buttonIntent="${call.buttonIntent}" 的按钮选项值携带对象字段 ${optionObjectProps.join(', ')}；除已知卡牌代打 known-card-action 外，真实目标必须走对象本体 targetType。`);
            }
        }

        expect(violations, `以下按钮仍可能代理对象直选或缺少通用职责声明：\n${violations.join('\n')}`).toEqual([]);
    });

    it('smashup_reaction_choose 中手牌响应走手牌，场上 special 走来源本体，跳过/触发才是按钮', () => {
        const reactionSessionSource = readFileSync(resolve(__dirname, '../domain/reactionSession.ts'), 'utf-8');
        const violations: string[] = [];

        const requiredCardModePatterns = [
            /id: `play_minion:[\s\S]*?value: \{[\s\S]*?kind: 'play_minion'[\s\S]*?displayMode: 'card'/,
            /id: `play_action:\$\{card\.uid\}:\$\{targetBaseIndex\}:\$\{targetMinion\.uid\}`[\s\S]*?value: \{[\s\S]*?kind: 'play_action'[\s\S]*?targetMinionUid:[\s\S]*?displayMode: 'card'/,
            /id: `play_action:\$\{card\.uid\}:\$\{targetBaseIndex\}`[\s\S]*?value: \{[\s\S]*?kind: 'play_action'[\s\S]*?targetBaseIndex[\s\S]*?displayMode: 'card'/,
            /id: `play_action:\$\{card\.uid\}:none`[\s\S]*?value: \{[\s\S]*?kind: 'play_action'[\s\S]*?displayMode: 'card'/,
        ];
        for (const pattern of requiredCardModePatterns) {
            if (!pattern.test(reactionSessionSource)) {
                violations.push(`缺少手牌响应 card displayMode 片段：${pattern}`);
            }
        }

        const requiredButtonModePatterns = [
            /id: `trigger:\$\{trigger\.id\}`[\s\S]*?value: \{ kind: 'trigger'[\s\S]*?displayMode: 'button'/,
            /id: 'pass'[\s\S]*?value: \{ kind: 'pass' \}[\s\S]*?displayMode: 'button'/,
        ];
        for (const pattern of requiredButtonModePatterns) {
            if (!pattern.test(reactionSessionSource)) {
                violations.push(`缺少非手牌响应 button displayMode 片段：${pattern}`);
            }
        }

        const requiredFieldSourceActionSnippets = [
            'FIELD_SOURCE_ACTION_PROMPT_TARGET_TYPE',
            'targetType: FIELD_SOURCE_ACTION_PROMPT_TARGET_TYPE',
            'function buildReactionActivateSpecialOption',
            "buildFieldSourceActionOptions<Extract<ReactionChoiceValue, { kind: 'activate_special' }>>",
            "displayMode: 'card'",
        ];
        for (const snippet of requiredFieldSourceActionSnippets) {
            if (!reactionSessionSource.includes(snippet)) {
                violations.push(`缺少场上 special 来源本体交互片段：${snippet}`);
            }
        }

        const forbiddenOldButtonSnippets = [
            'id: `activate_special:minion:',
            'id: `activate_special:titan:',
        ];
        for (const snippet of forbiddenOldButtonSnippets) {
            if (reactionSessionSource.includes(snippet)) {
                violations.push(`场上 special 仍保留旧按钮 id 入口：${snippet}`);
            }
        }

        expect(violations, `smashup_reaction_choose 选项显示职责异常：\n${violations.join('\n')}`).toEqual([]);
    });

    it('smashup_reaction_choose 的手写夹具不得继续声明 button targetType 或手牌按钮模式', () => {
        const violations: string[] = [];

        for (const filePath of getSmashUpSourceAndTestFiles()) {
            const source = readFileSync(filePath, 'utf-8');
            const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

            const visit = (node: ts.Node) => {
                if (ts.isObjectLiteralExpression(node)) {
                    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
                    if (
                        extractTopLevelStringProp(node, 'sourceId') === 'smashup_reaction_choose'
                        && extractTopLevelStringProp(node, 'targetType') === 'button'
                    ) {
                        violations.push(`${filePath}:${line} smashup_reaction_choose 仍声明 targetType: 'button'，响应窗口必须使用 field-source-action 以支持场上来源本体入口。`);
                    }

                    const valueProp = node.properties.find(
                        prop => ts.isPropertyAssignment(prop) && getObjectPropertyName(prop.name) === 'value'
                    ) as ts.PropertyAssignment | undefined;
                    const value = unwrapAuditExpression(valueProp?.initializer);
                    const kind = value && ts.isObjectLiteralExpression(value)
                        ? extractTopLevelStringProp(value, 'kind')
                        : undefined;
                    if (
                        (kind === 'play_action' || kind === 'play_minion')
                        && extractTopLevelStringProp(node, 'displayMode') === 'button'
                    ) {
                        violations.push(`${filePath}:${line} smashup_reaction_choose 的手牌响应仍以按钮模式渲染，必须改为卡牌本体入口 displayMode: 'card'。`);
                    }
                }

                ts.forEachChild(node, visit);
            };

            visit(sourceFile);
        }

        expect(violations, `以下手写响应窗口夹具仍保留旧按钮合同：\n${violations.join('\n')}`).toEqual([]);
    });

    it('同一 sourceId 不允许混用多种 targetType 语义', () => {
        const allCalls = getAuditScan().calls;

        const grouped = new Map<string, SimpleChoiceCallInfo[]>();
        for (const call of allCalls) {
            if (!grouped.has(call.sourceId)) grouped.set(call.sourceId, []);
            grouped.get(call.sourceId)?.push(call);
        }

        const violations: string[] = [];
        for (const [sourceId, calls] of grouped.entries()) {
            if (sourceId === '[unknown]' || sourceId === 'unknown') continue;
            const targetTypes = Array.from(new Set(calls.map(call => call.targetType ?? '未声明')));
            if (targetTypes.length <= 1) continue;

            const locations = calls.map(call =>
                `${call.file}:${call.line} -> ${call.targetType ?? '未声明'}`
            ).join(' | ');

            violations.push(`[${sourceId}] 同时出现多种 targetType：${targetTypes.join(', ')}\n  ${locations}`);
        }

        expect(violations, `以下 sourceId 存在一号多义的 targetType 语义：\n${violations.join('\n')}`).toEqual([]);
    });

    it('带有场上实体标识的 generic 交互必须能用通用语义解释，不能靠 sourceId 例外', () => {
        const violations: string[] = [];

        for (const call of getAuditScan().calls) {
            if (call.targetType !== 'generic') continue;
            const optionProps = new Set(call.optionValueProps ?? []);
            if (!optionProps.has('baseIndex') && !optionProps.has('minionUid')) continue;
            if (call.genericIntent || call.inferredGenericIntent) continue;
            violations.push(`${call.file}:${call.line} [${call.sourceId}] generic 交互包含 baseIndex/minionUid，但无法归入通用 genericIntent；必须改成直点 targetType，或声明 card-pool/buried-card/snapshot-field-object/composite-context/mode/order/mixed-card-and-control/definition-choice。`);
        }

        expect(violations, `以下 generic 交互带有场上实体标识，但没有通用语义解释：\n${violations.join('\n')}`).toEqual([]);
    });

    it('声明 autoRefresh 的通用弹窗交互必须显式声明 responseValidationMode', () => {
        const allCalls = getAuditScan().calls;

        const violations = allCalls
            .filter(call => !!call.autoRefresh)
            .filter(call => !call.targetType || call.targetType === 'generic')
            .filter(call => !call.responseValidationMode && call.revalidateOnRespond === undefined)
            .map(call =>
                `${call.file}:${call.line} [${call.sourceId}] 通用弹窗声明了 autoRefresh="${call.autoRefresh}"，但未显式声明 responseValidationMode`
            );

        expect(violations, `以下通用弹窗交互缺少显式响应语义：\n${violations.join('\n')}`).toEqual([]);
    });

    it('generic targetType 必须使用通用语义声明或形状推导，不能维护 sourceId 白名单', () => {
        const allCalls = getAuditScan().calls;

        const violations: string[] = [];
        for (const call of allCalls) {
            if (call.genericIntent && !ALLOWED_GENERIC_INTENTS.has(call.genericIntent)) {
                violations.push(`${call.file}:${call.line} [${call.sourceId}] genericIntent="${call.genericIntent}" 不是通用 generic 职责：${GENERIC_INTENTS.join(', ')}`);
            }
            if (call.genericIntent && call.targetType !== 'generic') {
                violations.push(`${call.file}:${call.line} [${call.sourceId}] genericIntent 只能用于 targetType: "generic"，当前 targetType="${call.targetType ?? '未声明'}"`);
            }

            if (call.targetType !== 'generic') continue;
            const valueProps = new Set(call.valueProps ?? []);
            const hasHighRiskContext = hasAnyProp(valueProps, [
                'actionUid',
                'baseIndex',
                'fromBaseIndex',
                'sourceBaseIndex',
                'targetBaseIndex',
                'toBaseIndex',
                'minionUid',
                'targetMinionUid',
                'ongoingUid',
                'sourceUid',
                'targetUid',
                'targetPlayerId',
            ]);
            if (hasHighRiskContext && !call.genericIntent && !call.inferredGenericIntent) {
                violations.push(`${call.file}:${call.line} [${call.sourceId}] generic 带高风险对象上下文字段 ${Array.from(valueProps).join(', ')}，但没有 genericIntent，也无法从选项形状推导职责。`);
            }
        }

        expect(violations, violations.join('\n\n')).toEqual([]);
    });

    it('hand targetType 的交互必须先按 direct / overlay 分流，再决定是否允许拖拽', () => {
        expect(shouldForceSmashUpPromptOverlay({
            playerId: '0',
            options: [
                { displayMode: 'button' },
                { displayMode: 'button' },
            ],
        })).toBe(true);
        expect(shouldForceSmashUpPromptOverlay({
            playerId: '0',
            sourceId: 'multi_base_scoring',
            options: [
                { displayMode: 'card' },
                { displayMode: 'card' },
            ],
        })).toBe(false);

        expect(resolveSmashUpHandPromptUiMode({
            currentPrompt: { playerId: '0', multi: undefined },
            playerID: '0',
            targetType: 'hand',
        })).toBe('direct');

        expect(resolveSmashUpHandPromptUiMode({
            currentPrompt: {
                playerId: '0',
                multi: undefined,
                options: [
                    { id: 'play-card', label: 'Going Bananas', value: { cardUid: 'mind-bananas-hand' }, displayMode: 'card' },
                ],
            },
            playerID: '0',
            targetType: 'hand',
            hand: [{ uid: 'mind-bananas-hand' }],
        })).toBe('direct');

        expect(resolveSmashUpHandPromptUiMode({
            currentPrompt: {
                playerId: '0',
                multi: undefined,
                sourceId: 'all_stars_prepare_for_battle',
                options: [
                    { id: 'deck-top-1', label: '狄俄尼索斯的青睐', value: { cardUid: 'deck-top-1', defId: 'all_stars_favor_of_dionysus' }, displayMode: 'card' },
                    { id: 'deck-top-2', label: '霸王龙国王', value: { cardUid: 'deck-top-2', defId: 'all_stars_king_rex' }, displayMode: 'card' },
                ],
            },
            playerID: '0',
            targetType: 'hand',
            hand: [{ uid: 'actual-hand-card' }],
        })).toBe('overlay');

        expect(isSmashUpPromptOwnedByPlayer({
            currentPrompt: { playerId: 0, multi: undefined } as any,
            playerID: '0',
        })).toBe(true);

        expect(resolveSmashUpHandPromptUiMode({
            currentPrompt: { playerId: 0, multi: undefined } as any,
            playerID: '0',
            targetType: 'hand',
        })).toBe('direct');

        expect(resolveSmashUpHandPromptUiMode({
            currentPrompt: { playerId: '0', multi: { min: 0, max: 2 } },
            playerID: '0',
            targetType: 'hand',
        })).toBe('overlay');

        expect(resolveSmashUpHandPromptUiMode({
            currentPrompt: { playerId: '0', multi: undefined },
            playerID: '0',
            targetType: 'minion',
        })).toBe('none');

        expect(hasSmashUpDirectHandPromptPlayableOptions({
            currentPrompt: {
                playerId: '0',
                options: [
                    { id: 'skip', label: '放弃这次额外战术', value: { skip: true } },
                ],
            },
            playerID: '0',
            targetType: 'hand',
        })).toBe(false);

        expect(hasSmashUpDirectHandPromptPlayableOptions({
            currentPrompt: {
                playerId: '0',
                options: [
                    { id: 'play-card', label: 'Going Bananas', value: { cardUid: 'mind-bananas-hand' } },
                    { id: 'skip', label: '放弃这次额外战术', value: { skip: true } },
                ],
            },
            playerID: '0',
            targetType: 'hand',
            hand: [{ uid: 'mind-bananas-hand' }],
        })).toBe(true);

        expect(hasSmashUpDirectHandPromptPlayableOptions({
            currentPrompt: {
                playerId: '0',
                sourceId: 'all_stars_prepare_for_battle',
                options: [
                    { id: 'deck-top-1', label: '狄俄尼索斯的青睐', value: { cardUid: 'deck-top-1', defId: 'all_stars_favor_of_dionysus' }, displayMode: 'card' },
                    { id: 'deck-top-2', label: '霸王龙国王', value: { cardUid: 'deck-top-2', defId: 'all_stars_king_rex' }, displayMode: 'card' },
                ],
            },
            playerID: '0',
            targetType: 'hand',
            hand: [{ uid: 'actual-hand-card' }],
        })).toBe(false);

        expect(shouldRenderSmashUpHandArea({
            currentPrompt: {
                playerId: '0',
                options: [
                    { id: 'mimic-trigger', label: '模仿者', value: { kind: 'trigger', triggerId: 'copycat-1' }, displayMode: 'button' },
                    { id: 'pass', label: '让过', value: { kind: 'pass' }, displayMode: 'button' },
                ],
            },
            playerID: '0',
            targetType: 'generic',
            activePromptSurface: 'overlay',
        })).toBe(false);

        expect(shouldRenderSmashUpHandArea({
            currentPrompt: {
                playerId: '0',
                options: [
                    { id: 'skip', label: '放弃这次额外战术', value: { skip: true } },
                ],
            },
            playerID: '0',
            targetType: 'hand',
            activePromptSurface: 'hand',
        })).toBe(false);

        expect(shouldRenderSmashUpHandArea({
            currentPrompt: {
                playerId: '0',
                options: [
                    { id: 'play-card', label: 'Going Bananas', value: { cardUid: 'mind-bananas-hand' } },
                    { id: 'skip', label: '放弃这次额外战术', value: { skip: true } },
                ],
            },
            playerID: '0',
            targetType: 'hand',
            activePromptSurface: 'hand',
        })).toBe(true);

        const directHandCardState = getSmashUpDirectHandPromptCardState({
            currentPrompt: {
                playerId: '0',
                options: [
                    { id: 'play-card', label: 'Going Bananas', value: { cardUid: 'mind-bananas-hand' } },
                    { id: 'disabled-card', label: 'Disabled', value: { cardUid: 'stale-hand' }, disabled: true },
                    { id: 'skip', label: '放弃这次额外战术', value: { skip: true } },
                ],
            },
            playerID: '0',
            targetType: 'hand',
            hand: [
                { uid: 'mind-bananas-hand' },
                { uid: 'stale-hand' },
                { uid: 'other-hand-card' },
            ],
        });
        expect(Array.from(directHandCardState.selectableCardUids)).toEqual(['mind-bananas-hand']);
        expect(Array.from(directHandCardState.disabledCardUids ?? []).sort()).toEqual(['other-hand-card', 'stale-hand']);

        expect(resolveSmashUpHandInteractionMode({
            preferredMode: 'drag',
            needDiscard: false,
            activePromptSurface: 'hand',
        })).toBe('click');

        expect(resolveSmashUpHandInteractionMode({
            preferredMode: 'drag',
            needDiscard: false,
            activePromptSurface: 'overlay',
        })).toBe('click');

        expect(resolveSmashUpHandInteractionMode({
            preferredMode: 'drag',
            needDiscard: true,
            activePromptSurface: 'none',
        })).toBe('click');

        expect(resolveSmashUpHandInteractionMode({
            preferredMode: 'drag',
            needDiscard: false,
            activePromptSurface: 'none',
        })).toBe('drag');

        expect(resolveSmashUpHandInteractionMode({
            preferredMode: 'click',
            needDiscard: false,
            activePromptSurface: 'none',
        })).toBe('click');
    });

    it('base targetType 的棋盘直选高亮必须只暴露真实候选基地', () => {
        expect(Array.from(getSmashUpSelectableBaseIndices([
            { value: { baseIndex: 1 } },
            { value: { baseIndex: 0 } },
            { id: 'skip', value: { skip: true } },
            { value: { baseIndex: -1 } },
            { value: {} },
            { disabled: true, value: { baseIndex: 2 } },
        ]))).toEqual([1, 0]);

        expect(getSmashUpSelectableBaseIndices([
            { id: 'done', value: { done: true } },
            { id: 'skip', value: { skip: true } },
        ]).size).toBe(0);
    });

    it('直选模式额外按钮分流必须统一使用目标类型判定', () => {
        const options = [
            { id: 'base', value: { baseIndex: 0 } },
            { id: 'minion', value: { minionUid: 'm1' } },
            { id: 'hand', value: { cardUid: 'h1' } },
            { id: 'source-target', value: { fieldInteractionType: 'source-target' } },
            { id: 'source-action', value: { fieldInteractionType: 'source-action' } },
            { id: 'skip', value: { skip: true } },
        ];

        expect(isSmashUpDirectPromptTargetOption(options[0], 'base')).toBe(true);
        expect(isSmashUpDirectPromptTargetOption(options[1], 'minion')).toBe(true);
        expect(isSmashUpDirectPromptTargetOption(options[2], 'hand')).toBe(true);
        expect(isSmashUpDirectPromptTargetOption(options[3], 'field-source-target')).toBe(true);
        expect(isSmashUpDirectPromptTargetOption(options[4], 'field-source-action')).toBe(true);
        expect(isSmashUpDirectPromptTargetOption(options[5], 'base')).toBe(false);

        expect(getSmashUpDirectPromptExtraOptions(options, 'base').map(option => option.id)).toEqual([
            'minion',
            'hand',
            'source-target',
            'source-action',
            'skip',
        ]);
        expect(getSmashUpDirectPromptExtraOptions(options, 'field-source-target').map(option => option.id)).toEqual([
            'base',
            'minion',
            'hand',
            'source-action',
            'skip',
        ]);
    });
});
