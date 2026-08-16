/**
 * DiceThrone 闂傚倷娴囧畷鍨叏閸偆顩插ù鐘差儏缁€澶愮叓閸ャ劍纾甸柛瀣尭椤繈顢橀悙鈺傜亞婵犳鍠栭敃銈咁焽閳ュ磭鏆﹂柣鏃傗拡閺佸啯銇勯幇鈺佺仾妞ゆ柨绻樺缁樻媴閻戞ê娈岄梺瀹︽澘濮€闁圭瓔鍋嗙槐鎾存媴妞嬪寒妲銈嗘处閸欏啴鐛?
 *
 * 闂傚倷娴囧畷鐢稿窗閹邦優娲冀椤剚绋戦埥澶娢熻箛鏇炲妺缂佺粯绻堝畷鍫曞Ω閵夛富鍚囬梻鍌欑閹诧繝宕濋幋锕€绀夌€广儱娲ㄥΛ顖涖亜閺嶎偄浠﹂柣?
 * 1. 濠电姷鏁搁崑鐐哄垂閸洖绠伴柛婵勫劤閻捇鏌熺紒銏犳灈缂佺姵鐗犻弻鐔煎礈瑜忕敮娑㈡煕閵堝棗濮嶆慨濠冩そ椤㈡鍩€椤掑倻鐭撻柣銏ゆ涧閺嬪牓鏌涘畝鈧崑鐐哄磹閻㈠憡鈷掗柛顐ゅ枔閳洟鎮归幇鍓佺？缂佽鲸甯￠、娆撴嚃閳诡儸鍛亾鐟欏嫭纾搁柛搴ㄦ涧閻ｉ攱绺界粙娆炬綂闂佹寧绋戠€氼厼鈻撻幖浣光拻闁稿本鐟х拹浼存煕鐎ｎ亜顏挊婵嬫煙閼稿灚鐏紓宥嗙墬娣囧﹪濡堕崟顔煎帯闂佸磭绮Λ鍐嵁閺嶎偄鍨濋柛蹇擃槸娴滃墽鈧娲栧ú锝吳庨灏栨斀闁绘ɑ鍓氶崯蹇涙煕閻樺磭澧垫い銏＄墵瀹曘劑顢涘Δ鈧禍?
 * 2. 濠电姷鏁搁崑鐐哄垂閸洖绠伴柛婵勫劤閻捇鏌熺紒銏犳灈缂佺姵鐗犻弻鐔煎礈瑜忕敮娑㈡煕閵堝棗濮嶆慨濠冩そ椤㈡鍩€椤掑倻鐭撻柣銏ゆ涧閺嬪牓鏌涘畝鈧崑鐐烘偂閻斿吋鐓忓┑鐐茬仢閸旀碍銇勮箛锝呭箺闁靛洤瀚幆鏃堟晬閸曨収鍞洪梻渚€鈧偛鑻晶顖滅磼鐎ｎ偄娴€规洘绻堝鎾閳ュ厖鎮ｉ梻浣虹帛閸旓箓宕滃☉銏犵厺闁哄洨鍎愰悢鍡涙偣鏉炴媽顒熼柛搴㈢洴閺屾盯寮崫鍕缂傚倸鍊烽懗鍫曟惞鎼淬劌鐭楅幖娣妼缁愭鏌″鍐ㄥ闁告瑥绻橀弻锝夊箛椤掑倹鎲兼繝?
 * 3. 濠电姷鏁搁崑鐐哄垂閸洖绠伴柛婵勫劤閻捇鏌熺紒銏犳灈缂佺姵鐗犻弻鐔煎礈瑜忕敮娑㈡煕閵堝棗濮嶆慨濠冩そ椤㈡鍩€椤掑倻鐭撻柣銏ゆ涧閺嬪牓鏌涘畝鈧崑鐐烘偂閻斿吋鐓忓┑鐐茬仢閸旀碍銇勮箛锝呭箺濞ｅ洤锕幊鐘筹紣濠靛棙顔勬俊鐐€栧ú蹇涘磿閻㈢鏄ラ柛鏇ㄥ灠缁€鍐煏婵犲倸顒㈡い銊ワ躬瀵濡堕崶锝呬壕闁革富鍘煎瓭閻炴碍鑹鹃—鍐Χ閸℃鐟茬紓渚囧枛妤犳悂鍩ユ径鎰仺闁告挸寮堕弲鈺呮⒑閸濄儱鏋庨柛鐕佸灠鐓ら柣鏃堫棑閺?
 */

import { describe, it, expect } from 'vitest';
import { DiceThroneDomain } from '../domain';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';
import { TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { INITIAL_HEALTH, INITIAL_CP } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { GameTestRunner } from '../../../engine/testing';
import { getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import {
    fixedRandom,
    createQueuedRandom,
    cmd,
    testSystems,
    assertState,
    advanceTo,
    getCompareRollChoicePrompt,
    getCardById,
    respondToPrompt,
    type CommandInput,
} from './test-utils';
import { getAbilitySlotId } from '../ui/abilitySlotMapping';
import { getPendingAttackExpectedDamage } from '../domain/utils';
import { GUNSLINGER_CARDS } from '../heroes/gunslinger/cards';
import { PALADIN_CARDS } from '../heroes/paladin/cards';
import { SAMURAI_CARDS } from '../heroes/samurai/cards';
import {
    DEADEYE_2,
    DUEL_2,
    FAN_THE_HAMMER_2,
    QUICK_DRAW_UPGRADED,
    SHOWDOWN_2,
    SHOWDOWN_3,
    TAKE_COVER_2,
} from '../heroes/gunslinger/abilities';
import { WAKIZASHI_2, WAKIZASHI_3 } from '../heroes/samurai/abilities';

// ============================================================================
// 闂傚倷娴囧畷鍨叏閸偆顩插ù鐘差儏缁€澶愮叓閸ャ劍纾甸柛瀣尭椤繈顢橀悙鈺傜亞婵?setup 闂備浇顕у锕傦綖婢舵劕绠栭柛顐ｆ礀绾惧潡姊洪鈧粔鎾儗?
// ============================================================================

function createInitializedStateWithCharacters(
    playerIds: PlayerId[],
    random: RandomFn,
    characters: Record<PlayerId, string>
): MatchState<DiceThroneCore> {
    const pipelineConfig = {
        domain: DiceThroneDomain,
        systems: testSystems,
    };

    let state: MatchState<DiceThroneCore> = {
        core: DiceThroneDomain.setup(playerIds, random),
        sys: createInitialSystemState(playerIds, testSystems, undefined),
    };

    const hostPlayerId = playerIds[0] ?? '0';
    const commands: CommandInput[] = [
        ...playerIds.map(playerId => cmd('SELECT_CHARACTER', playerId, {
            characterId: characters[playerId] ?? 'monk',
        })),
        ...playerIds
            .filter(playerId => playerId !== hostPlayerId)
            .map(playerId => cmd('PLAYER_READY', playerId)),
        cmd('HOST_START_GAME', hostPlayerId),
    ];

    for (const input of commands) {
        const command = {
            type: input.type,
            playerId: input.playerId,
            payload: input.payload,
            timestamp: Date.now(),
        } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) {
            state = result.state as MatchState<DiceThroneCore>;
        }
    }

    return state;
}

function createCrossHeroRunner(
    random: RandomFn,
    characters: Record<PlayerId, string>,
    silent = true
) {
    return new GameTestRunner({
        domain: DiceThroneDomain,
        systems: testSystems,
        playerIds: ['0', '1'],
        random,
        setup: (playerIds: PlayerId[], r: RandomFn) => createInitializedStateWithCharacters(playerIds, r, characters),
        assertFn: assertState,
        silent,
    });
}

// ============================================================================
// 婵犵數濮烽弫鎼佸磻閻愬樊鐒芥繛鍡樻惄閺佸嫰鏌涢鐘插姕闁?
// ============================================================================

describe('cross hero battles', () => {
    describe('character selection and initialization', () => {
        const heroPairs: [string, string][] = [
            ['monk', 'barbarian'],
            ['monk', 'paladin'],
            ['gunslinger', 'monk'],
            ['samurai', 'monk'],
            ['barbarian', 'pyromancer'],
            ['shadow_thief', 'moon_elf'],
            ['paladin', 'pyromancer'],
        ];

        it.each(heroPairs)('%s vs %s initializes successfully', (hero0, hero1) => {
            const state = createInitializedStateWithCharacters(
                ['0', '1'],
                fixedRandom,
                { '0': hero0, '1': hero1 }
            );

            expect(state.core.players['0'].characterId).toBe(hero0);
            expect(state.core.players['1'].characterId).toBe(hero1);
            expect(state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
            expect(state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
            expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(INITIAL_CP);
            expect(state.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(INITIAL_CP);
            expect(state.core.players['0'].hand.length).toBe(4);
            expect(state.core.players['1'].hand.length).toBe(4);
            expect(state.sys.phase).toBe('main1');
        });
    });

    describe('paladin vs monk', () => {
        it('paladin initialization loads abilities and dice correctly', () => {
            const state = createInitializedStateWithCharacters(
                ['0', '1'],
                fixedRandom,
                { '0': 'paladin', '1': 'monk' }
            );

            // 闂傚倸鍊风欢姘焽閼姐倖濯奸柨婵嗘川缁€濠傘€掑锝呬壕闂佽鍠曢崡鎶藉箖濞嗘垟鍋撻棃娑欐喐鐟滅増鍎抽—鍐Χ閸℃顫囬梺鎼炲姀瀹曠敻鍩€椤掑倹鍤€妞わ妇鏁诲?8 濠电姷鏁搁崑鐐哄垂閸洖绠归柍鍝勫€婚々鍙夌節闂堟稒鐭楃紒璇叉閹叉悂寮崼婵堢枃?
            expect(state.core.players['0'].abilities).toHaveLength(8);

            // 闂傚倸鍊风欢姘焽閼姐倖濯奸柨婵嗘川缁€濠傘€掑锝呬壕闂佽鍠曢崡鎶藉箖濞嗘垟鍋撻棃娑欐喐鐟滅増鍎抽—鍐Χ閸℃衼缂備焦褰冮埀顒傚枔娴滐綁姊?ID 濠电姴鐥夐弶搴撳亾濡や焦鍙忛柟缁㈠枟閸庢銆掑锝呬壕闂?
            const paladinAbilityIds = state.core.players['0'].abilities.map(a => a.id);
            expect(paladinAbilityIds).toContain('righteous-combat');
            expect(paladinAbilityIds).toContain('blessing-of-might');
            expect(paladinAbilityIds).toContain('holy-strike');
            expect(paladinAbilityIds).toContain('holy-light');
            expect(paladinAbilityIds).toContain('vengeance');
            expect(paladinAbilityIds).toContain('righteous-prayer');
            expect(paladinAbilityIds).toContain('holy-defense');
            expect(paladinAbilityIds).toContain('unyielding-faith');
        });

        it('paladin can use holy-defense during defense', () => {
            // 闂傚倸鍊烽懗鍫曗€﹂崼銏″珰闁绘劕鎼壕鍏肩節闂堟稒顥犻柨娑欏灴濮婃椽宕崟鍨㈤梺鍝勬噺缁海鍒掑▎鎾崇婵°倐鍋撻柡瀣╃铻栭柨婵嗘噹閺嗙偤鏌￠崪浣稿⒋闁诡喗锕㈤幃娆戞崉閻╂帗鎹囬弻锟犲焵椤掑倹瀚氶柛娆忓€瑰Λ鍐箖閳哄懎绀冮柤纰卞厸濞ｎ噣姊绘担鐟邦嚋缂佸鍨块、鏍ㄥ緞婵犲孩缍庢繝闈涘€婚…鍫㈢不閻㈠憡鐓欓柣鎴灻悘锕傛煛?
            // 闂傚倸鍊烽懗鍫曗€﹂崼銏″珰闁绘劕鎼壕鍏肩節闂堟稒顥犻柨娑欏灥閳规垶骞婇柛濠冾殕閹便劑骞庨挊澶岊攨闂佸憡鍔曞Ο濠囨倿? 1,2=fist 闂?5 濠?fist(闂傚倸鍊烽懗鍫曗€﹂崼銉︽櫇闁挎洖鍊搁崒銊ф喐閺傝法鏆?) 闂傚倷娴囧畷鐢稿窗閹扮増鍋￠弶鍫氭櫇娑撳秹鏌熸潏鍓хシ濞?fist-technique-5
            const runner = createCrossHeroRunner(
                createQueuedRandom([1, 1, 1, 1, 1]),
                { '0': 'monk', '1': 'paladin' }
            );

            const result = runner.run({
                name: 'paladin defense',
                commands: [
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                ],
                expect: {
                    turnPhase: 'defensiveRoll',
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        isDefendable: true,
                        sourceAbilityId: 'fist-technique-5',
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingAttack?.defenseAbilityId).toBe('holy-defense');
        });

        it('paladin 使用 Accuracy 后应让原本可防御的攻击直接跳过防御窗口', () => {
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 2, 3, 4, 5]),
                setup: (playerIds: PlayerId[], r: RandomFn) => {
                    const state = createInitializedStateWithCharacters(playerIds, r, { '0': 'paladin', '1': 'monk' });
                    state.core.players['0'].tokens[TOKEN_IDS.ACCURACY] = 1;
                    state.core.players['0'].tokens[TOKEN_IDS.CRIT] = 0;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'paladin accuracy should skip defense on holy-strike-large',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'holy-strike-large' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }),
                    cmd('RESPONSE_PASS', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            hp: 52,
                            tokens: { [TOKEN_IDS.ACCURACY]: 0 },
                        },
                        '1': { hp: 42 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingAttack).toBeNull();
            expect(result.finalState.core.pendingDamage).toBeUndefined();
        });

        it('tithes II 在激活包含 pray 面的技能时额外获得 1 CP', () => {
            const random = createQueuedRandom([1, 1, 2, 6, 3]);
            const tithesUpgrade = PALADIN_CARDS.find((card) => card.id === 'card-tithes-2');
            expect(tithesUpgrade).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: (playerIds: PlayerId[], r: RandomFn) => {
                    const state = createInitializedStateWithCharacters(playerIds, r, { '0': 'paladin', '1': 'monk' });
                    const player = state.core.players['0'];
                    player.resources[RESOURCE_IDS.CP] = 6;
                    player.hand = [JSON.parse(JSON.stringify(tithesUpgrade!))];
                    player.deck = player.deck.filter((card) => card.id !== 'card-tithes-2');
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'paladin tithes II pray trigger',
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-tithes-2', targetAbilityId: 'tithes' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'blessing-of-might' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('RESPONSE_PASS', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            cp: 4,
                            abilityLevels: { tithes: 2 },
                        },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].passiveAbilities?.find((passive) => passive.id === 'tithes')?.trigger).toMatchObject({
                on: 'abilityActivatedWithFace',
                requiredFace: 'pray',
                grantCp: 1,
            });
        });

        it('righteous-combat II 升级后不应混入 III 级 tenacity 变体', () => {
            const righteousCombatUpgrade = PALADIN_CARDS.find((card) => card.id === 'card-righteous-combat-2');
            expect(righteousCombatUpgrade).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: fixedRandom,
                setup: (playerIds: PlayerId[], r: RandomFn) => {
                    const state = createInitializedStateWithCharacters(playerIds, r, { '0': 'paladin', '1': 'monk' });
                    const player = state.core.players['0'];
                    player.resources[RESOURCE_IDS.CP] = 2;
                    player.hand = [JSON.parse(JSON.stringify(righteousCombatUpgrade!))];
                    player.deck = player.deck.filter((card) => card.id !== 'card-righteous-combat-2');
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'paladin righteous-combat II runtime replacement',
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-righteous-combat-2', targetAbilityId: 'righteous-combat' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: 0,
                            abilityLevels: { 'righteous-combat': 2 },
                        },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            const righteousCombat = result.finalState.core.players['0'].abilities.find((ability) => ability.id === 'righteous-combat');
            expect(righteousCombat?.type).toBe('offensive');
            expect(righteousCombat?.description).toBe('abilities.righteous-combat-2.description');
            expect(righteousCombat?.variants).toBeUndefined();
            expect(righteousCombat?.trigger).toEqual({
                type: 'diceSet',
                faces: { sword: 3, helm: 2 },
            });
            expect(righteousCombat?.effects).toHaveLength(2);
            expect(righteousCombat?.effects?.[0].action).toMatchObject({
                type: 'damage',
                target: 'opponent',
                value: 5,
            });
            expect(righteousCombat?.effects?.[1].action).toMatchObject({
                type: 'rollDie',
                target: 'self',
                diceCount: 3,
            });
        });
    });

    describe('shadow thief vs moon elf', () => {
        it('both players initialize tokens correctly', () => {
            const state = createInitializedStateWithCharacters(
                ['0', '1'],
                fixedRandom,
                { '0': 'shadow_thief', '1': 'moon_elf' }
            );

            // 闂備浇宕甸崰鎰垝瀹ュ拋鐔嗘俊顖濇閺嗭附銇勯幒鎴濐仾闁稿鍊栫换娑㈠幢濡闉嶉梺绋块鐎涒晜绌辨繝鍥ч柛娑卞弾娴煎啴姊洪崫銉ヤ粶闁绘牕銈稿璇测槈閵忕姷顔婇梺瑙勫劤婢у酣鎮鹃棃娑辨富?Token 闂傚倸鍊烽懗鍫曗€﹂崼銏″床闁割偁鍎辩粈澶愭倵閿濆骸澧悗?0
            expect(state.core.players['0'].tokens.sneak).toBe(0);
            expect(state.core.players['0'].tokens.sneak_attack).toBe(0);

            // 闂傚倸鍊风粈渚€骞栭锔藉亱闁糕剝绋掗崑瀣叓閸ャ劍绀夊┑顔藉▕閺屾稖顦虫い銊ユ瀹曟劙宕奸弴鐔叉嫽闂佸壊鍋嗛崰鎾诲煡婢舵劖鐓熼煫鍥ь儏閸旀岸鏌嶇憴鍕伌妞ゃ垺鐟ч崰濠囧础閻愭彃顥愭繝鐢靛У椤旀牠宕板Δ鍛畺闁稿瞼鍋熷畵渚€鏌嶈閸撴瑩婀侀梺鎸庣箓閻楁粌顭囬幇顓犵闁告侗鍘剧粻濠氭煛瀹€瀣？闁逞屽墾缂嶅棝宕戦崱娑欏剹濠电姴娲﹂悡鏇熺箾閸℃绠崇紒鐘哄皺缁?0
            expect(state.core.players['1'].statusEffects.blinded ?? 0).toBe(0);
        });
    });

    describe('gunslinger vs monk', () => {
        it('gunslinger initializes with duel defense ability', () => {
            const state = createInitializedStateWithCharacters(
                ['0', '1'],
                fixedRandom,
                { '0': 'gunslinger', '1': 'monk' }
            );

            const gunslingerAbilityIds = state.core.players['0'].abilities.map(a => a.id);
            expect(gunslingerAbilityIds).toContain('duel');
            expect(gunslingerAbilityIds).toContain('fill-em-with-lead');
            expect(state.core.players['0'].abilityLevels.duel).toBe(1);
            expect(state.core.players['0'].tokens.loaded).toBe(1);
        });

        it('duel win creates choice and prevent-half branch works', () => {
            const runner = createCrossHeroRunner(
                createQueuedRandom([1, 1, 1, 1, 1, 6, 1]),
                { '0': 'monk', '1': 'gunslinger' }
            );

            const result = runner.run({
                name: 'gunslinger duel win prevent-half',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                    cmd('CONFIRM_COMPARE_ROLL', '1'),
                    cmd('SYS_INTERACTION_RESPOND', '1', { optionId: 'option-1' }),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50 },
                        '1': { hp: 46 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingAttack).toBeNull();
            const compareRollEntry = result.finalState.sys.actionLog?.entries.find(entry => entry.kind === 'COMPARE_ROLL');
            expect(compareRollEntry).toBeTruthy();
            expect(compareRollEntry?.segments.some(seg =>
                seg.type === 'i18n' && (seg as { key: string }).key === 'compareRoll.gunslingerDuel.win'
            )).toBe(true);
            expect(compareRollEntry?.segments.filter(seg => seg.type === 'diceResult')).toHaveLength(2);
        });

        it('duel compare-roll choice id must not depend on command timestamp', () => {
            const buildPromptId = (confirmTimestamp: number) => {
                const random = createQueuedRandom([1, 1, 1, 1, 1, 6, 1]);
                const playerIds: PlayerId[] = ['0', '1'];
                const pipelineConfig = {
                    domain: DiceThroneDomain,
                    systems: testSystems,
                };
                let state = createInitializedStateWithCharacters(
                    playerIds,
                    random,
                    { '0': 'monk', '1': 'gunslinger' }
                );

                const commands: CommandInput[] = [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                ];

                for (const input of commands) {
                    const result = executePipeline(
                        pipelineConfig,
                        state,
                        {
                            type: input.type,
                            playerId: input.playerId,
                            payload: input.payload,
                            timestamp: 100,
                        } as DiceThroneCommand,
                        random,
                        playerIds,
                    );
                    expect(result.success).toBe(true);
                    state = result.state as MatchState<DiceThroneCore>;
                }

                const confirmResult = executePipeline(
                    pipelineConfig,
                    state,
                    {
                        type: 'CONFIRM_COMPARE_ROLL',
                        playerId: '1',
                        payload: {},
                        timestamp: confirmTimestamp,
                    } as DiceThroneCommand,
                    random,
                    playerIds,
                );

                expect(confirmResult.success).toBe(true);
                const prompt = getCompareRollChoicePrompt(confirmResult.state as MatchState<DiceThroneCore>, 'duel');
                expect(prompt.options?.map(option => option.id)).toEqual(['option-0', 'option-1']);
                return prompt.id;
            };

            expect(buildPromptId(1)).toBe(buildPromptId(Date.now()));
        });

        it('duel defensiveRoll requires roll confirmation and opens a dice response window before roll-off', () => {
            const random = createQueuedRandom([1, 1, 1, 1, 1, 6, 1]);
            const playerIds: PlayerId[] = ['0', '1'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };

            let state = createInitializedStateWithCharacters(
                playerIds,
                random,
                { '0': 'monk', '1': 'gunslinger' }
            );

            const toDefensiveRoll: CommandInput[] = [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('RESPONSE_PASS', '0'),
                cmd('RESPONSE_PASS', '1'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of toDefensiveRoll) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, random, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.sys.phase).toBe('defensiveRoll');
            expect(state.core.pendingAttack?.defenseAbilityId).toBe('duel');
            expect(state.core.rollCount).toBe(0);
            state.core.players['0'].hand = [getCardById('card-give-hand')];
            state.core.players['0'].resources[RESOURCE_IDS.CP] = 1;

            const prematureAdvanceResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'ADVANCE_PHASE',
                    playerId: '1',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(prematureAdvanceResult.success).toBe(false);
            expect(prematureAdvanceResult.error).toBe('cannot_advance_phase');

            const manualRollResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'ROLL_DICE',
                    playerId: '1',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(manualRollResult.success).toBe(true);
            state = manualRollResult.state as MatchState<DiceThroneCore>;
            expect(state.core.rollCount).toBe(1);
            expect(state.core.rollConfirmed).toBe(false);

            const confirmResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'CONFIRM_ROLL',
                    playerId: '1',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(confirmResult.success).toBe(true);
            state = confirmResult.state as MatchState<DiceThroneCore>;
            expect(state.core.rollConfirmed).toBe(true);
            expect(state.sys.responseWindow.current).toMatchObject({
                windowType: 'afterRollConfirmed',
                responderQueue: ['0'],
            });
        });

        it('duel loss deals 1 undefendable damage without choice', () => {
            const runner = createCrossHeroRunner(
                createQueuedRandom([1, 1, 1, 1, 1, 1, 6]),
                { '0': 'monk', '1': 'gunslinger' }
            );

            const result = runner.run({
                name: 'gunslinger duel loss',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                    cmd('CONFIRM_COMPARE_ROLL', '1'),
                    cmd('SYS_INTERACTION_CONFIRM', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 49 },
                        '1': { hp: 42 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.interaction.current).toBeFalsy();
        });

        it('bounty-hunter 的不可防御攻击伤害会立即触发赏金加伤与 +1 CP', () => {
            let startingCp = 0;

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 2, 6, 6, 4]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].tokens.loaded = 0;
                    startingCp = state.core.players['0'].resources.cp;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger bounty-hunter triggers bounty on attack damage',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'bounty-hunter' }),
                    cmd('ADVANCE_PHASE', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: startingCp + 1 },
                        '1': { hp: 48 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['1'].tokens.bounty).toBe(1);
            expect(result.finalState.core.pendingAttack).toBeNull();
        });

        it('duel 的防御反击伤害不会触发目标身上的赏金', () => {
            let startingCp = 0;

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 1, 1, 1, 1, 1, 6]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'monk', '1': 'gunslinger' }
                    );
                    state.core.players['0'].tokens.bounty = 1;
                    startingCp = state.core.players['1'].resources.cp;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger duel counter damage ignores bounty',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                    cmd('CONFIRM_COMPARE_ROLL', '1'),
                    cmd('SYS_INTERACTION_CONFIRM', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 49 },
                        '1': { hp: 42, cp: startingCp },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens.bounty).toBe(1);
            expect(result.finalState.core.players['1'].resources.cp).toBe(startingCp);
        });

        it('已有赏金的可防御攻击应在防御结算前发放攻击者 CP', () => {
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 2, 3, 4, 5, 1, 1, 1, 1]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].tokens[TOKEN_IDS.LOADED] = 0;
                    state.core.players['1'].tokens[TOKEN_IDS.BOUNTY] = 1;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger bounty reward precedes defense',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'revolver-3' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'),
                ],
            });

            expect(result.assertionErrors).toEqual([]);
            const eventTypes = result.steps.flatMap(step => step.events);
            expect(eventTypes.indexOf('CP_CHANGED')).toBeLessThan(eventTypes.indexOf('ATTACK_DEFENSE_RESOLVED'));
        });

        it('showdown uses compare-roll-choice and confirms into bonus damage', () => {
            const playerIds: PlayerId[] = ['0', '1'];
            let state = createInitializedStateWithCharacters(
                playerIds,
                fixedRandom,
                { '0': 'gunslinger', '1': 'monk' }
            );
            const random = createQueuedRandom([6, 1]);

            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };

            state = {
                ...state,
                core: {
                    ...state.core,
                    players: {
                        ...state.core.players,
                        '0': {
                            ...state.core.players['0'],
                            tokens: {
                                ...state.core.players['0'].tokens,
                                [TOKEN_IDS.LOADED]: 0,
                            },
                        },
                    },
                    activePlayerId: '0',
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        isDefendable: true,
                        damage: 6,
                        bonusDamage: 0,
                        sourceAbilityId: 'showdown',
                    },
                },
                sys: {
                    ...state.sys,
                    phase: 'offensiveRoll',
                },
            };

            const advanceResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'ADVANCE_PHASE',
                    playerId: '0',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );

            expect(advanceResult.success).toBe(true);
            state = advanceResult.state as MatchState<DiceThroneCore>;
            expect(state.core.currentRollContext).toMatchObject({
                kind: 'compare',
                ownerPlayerId: '0',
                targetPlayerId: '1',
                dice: [
                    expect.objectContaining({ ownerId: '0', value: 6 }),
                    expect.objectContaining({ ownerId: '1', value: 1 }),
                ],
                settlement: {
                    metadata: {
                        contestants: [
                            expect.objectContaining({ playerId: '0', dieId: 0 }),
                            expect.objectContaining({ playerId: '1', dieId: 1 }),
                        ],
                    },
                },
            });

            const compareConfirmResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'CONFIRM_COMPARE_ROLL',
                    playerId: '0',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(compareConfirmResult.success).toBe(true);
            state = compareConfirmResult.state as MatchState<DiceThroneCore>;

            const compareRollPrompt = getCompareRollChoicePrompt(state, 'showdown');
            expect(compareRollPrompt).toMatchObject({
                contestants: [
                    expect.objectContaining({ playerId: '0', roll: 6 }),
                    expect.objectContaining({ playerId: '1', roll: 1 }),
                ],
                confirmValue: {
                    customId: 'gunslinger-showdown-apply-bonus',
                    value: 2,
                },
            });
            expect(state.core.pendingAttack?.bonusDamage).toBe(0);

            const compareRollInteractionId = compareRollPrompt.id;
            expect(compareRollInteractionId).toBeTruthy();

            const confirmResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'SYS_INTERACTION_CONFIRM',
                    playerId: '0',
                    payload: { interactionId: compareRollInteractionId },
                    timestamp: Date.now() + 1,
                } as DiceThroneCommand,
                random,
                playerIds,
            );

            expect(confirmResult.success).toBe(true);
            state = confirmResult.state as MatchState<DiceThroneCore>;

            expect(state.sys.interaction.current).toBeUndefined();
            expect(state.core.pendingAttack?.bonusDamage).toBe(2);
        });

        it('fill-em-with-lead can reroll loaded die and add damage', () => {
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([6, 6, 6, 6, 6, 1, 6]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].tokens.loaded = 1;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger ultimate loaded reroll',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fill-em-with-lead' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }),
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 3 },
                        '1': { hp: 36 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens.loaded).toBe(0);
            expect(result.finalState.core.players['0'].tokens.evasive).toBe(1);
            expect(result.finalState.core.players['1'].tokens.bounty).toBe(1);
            expect(result.finalState.core.players['1'].statusEffects.knockdown).toBe(1);
            expect(result.finalState.core.pendingAttack).toBeNull();
        });

        it('wild west keeps fixed +1 after loaded reroll', () => {
            const wildWestCard = GUNSLINGER_CARDS.find(card => card.id === 'card-wild-west');
            expect(wildWestCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 2, 3, 4, 5, 1, 6]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].tokens.loaded = 1;
                    state.core.players['0'].resources.cp = 1;
                    state.core.players['0'].hand = [{ ...wildWestCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger wild-west loaded reroll display',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'revolver-3' }),
                    cmd('PLAY_CARD', '0', { cardId: 'card-wild-west' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }),
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'defensiveRoll',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens.loaded).toBe(0);
            expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(result.finalState.core.pendingAttack?.sourceAbilityId).toBe('revolver-3');
            expect(result.finalState.core.pendingAttack?.bonusDamage).toBe(4);
            // Wild West 的 +1 属于攻击修正卡；Loaded 的半值加伤属于 token 效果，不应混入攻击修正汇总。
            expect(result.finalState.core.pendingAttack?.attackModifierBonusDamage).toBe(1);
            expect(result.finalState.core.pendingAttack?.bonusDiceResolved).toBeUndefined();
        });

        it('wild west should remain available for a second loaded use in the same attack', () => {
            const wildWestCard = GUNSLINGER_CARDS.find(card => card.id === 'card-wild-west');
            expect(wildWestCard).toBeDefined();
            const playerIds: PlayerId[] = ['0', '1'];
            const random = createQueuedRandom([1, 2, 3, 4, 5, 1, 6, 2, 5]);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds,
                random,
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].tokens.loaded = 2;
                    state.core.players['0'].resources.cp = 1;
                    state.core.players['0'].hand = [{ ...wildWestCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const dispatch = (type: string, playerId: PlayerId, payload: Record<string, unknown> = {}) => {
                expect(runner.dispatch(type, { playerId, ...payload }).success).toBe(true);
            };

            dispatch('ADVANCE_PHASE', '0');
            dispatch('ROLL_DICE', '0');
            dispatch('CONFIRM_ROLL', '0');
            dispatch('RESPONSE_PASS', '0');
            dispatch('RESPONSE_PASS', '1');
            dispatch('SELECT_ABILITY', '0', { abilityId: 'revolver-3' });
            dispatch('PLAY_CARD', '0', { cardId: 'card-wild-west' });
            dispatch('ADVANCE_PHASE', '0');

            let response = respondToPrompt(runner.getState(), 'option-0', '0', random, playerIds);
            expect(response.success).toBe(true);
            if (!response.success) return;
            runner.setState(response.state);
            dispatch('REROLL_BONUS_DIE', '0', { dieIndex: 0 });
            dispatch('SKIP_BONUS_DICE_REROLL', '0');

            response = respondToPrompt(runner.getState(), 'option-0', '0', random, playerIds);
            expect(response.success).toBe(true);
            if (!response.success) return;
            runner.setState(response.state);
            dispatch('REROLL_BONUS_DIE', '0', { dieIndex: 0 });
            dispatch('SKIP_BONUS_DICE_REROLL', '0');

            const finalState = runner.getState();
            expect(finalState.core.players['0'].tokens.loaded).toBe(0);
            expect(finalState.core.pendingAttack?.bonusDamage).toBe(8);
            expect(finalState.core.pendingAttack?.attackModifierBonusDamage).toBe(2);
            expect(finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(finalState.sys.phase).toBe('defensiveRoll');
            expect(getCurrentInteractionSummary(finalState).id).toBeUndefined();
        });

        it('base loaded choice should create single-die display settlement and add rounded damage', () => {
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 2, 3, 4, 5, 1]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].tokens.loaded = 1;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger base loaded single-die display settlement',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'revolver-3' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
            });

            expect(result.assertionErrors).toEqual([]);
            // Loaded 是攻击的一部分；奖励骰确认只收口临时骰，父攻击仍需进入防御投。
            expect(result.finalState.sys.phase).toBe('defensiveRoll');
            expect(result.finalState.core.players['0'].tokens.loaded).toBe(0);
            expect(result.finalState.core.pendingAttack).toMatchObject({
                sourceAbilityId: 'revolver-3',
                bonusDamage: 1,
                isDefendable: true,
                defenseAbilityId: 'meditation',
            });
            expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
        });

        it('eat my lead adds damage from 5 dice and applies knockdown over 4', () => {
            const eatMyLeadCard = GUNSLINGER_CARDS.find(card => card.id === 'card-eat-my-lead');
            expect(eatMyLeadCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 2, 3, 4, 5, 1, 1, 1, 2, 3]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 3;
                    state.core.players['0'].hand = [{ ...eatMyLeadCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger eat-my-lead 5 dice',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'revolver-3' }),
                    cmd('PLAY_CARD', '0', { cardId: 'card-eat-my-lead' }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    players: {
                        '0': { hp: 50, cp: 1, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(result.finalState.core.pendingAttack?.sourceAbilityId).toBe('revolver-3');
            expect(result.finalState.core.pendingAttack?.bonusDamage).toBe(5);
            expect(result.finalState.core.pendingAttack?.attackModifierBonusDamage).toBe(5);
            expect(result.finalState.core.players['1'].statusEffects.knockdown).toBe(1);
        });

        it('upgrade-deadeye-2 后选择执法者变体，在 1v1 中应自动对唯一对手结算', () => {
            const upgradeCard = GUNSLINGER_CARDS.find(card => card.id === 'upgrade-deadeye-2');
            expect(upgradeCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([6, 6, 6, 1, 1]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['0'].hand = [{ ...upgradeCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger upgraded deadeye the-law 1v1 fallback',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'upgrade-deadeye-2' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'the-law' }),
                    cmd('ADVANCE_PHASE', '0'),
                ],
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens.evasive).toBe(1);
            expect(result.finalState.core.players['1'].tokens.bounty).toBe(1);
            expect(result.finalState.core.players['1'].statusEffects.knockdown).toBe(1);
            expect(result.finalState.core.players['0'].upgradeCardByAbilityId.deadeye).toEqual({
                cardId: 'upgrade-deadeye-2',
                cpCost: 2,
            });
            expect(result.finalState.core.players['0'].discard).toHaveLength(0);
        });

        it('upgrade-deadeye-2 后选择执法者变体，在多人局可选择至多两名敌方玩家', () => {
            const upgradeCard = GUNSLINGER_CARDS.find(card => card.id === 'upgrade-deadeye-2');
            expect(upgradeCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1', '2'],
                random: createQueuedRandom([6, 6, 6, 1, 1]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk', '2': 'paladin' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['0'].hand = [{ ...upgradeCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger upgraded deadeye the-law multiplayer',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'upgrade-deadeye-2' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'the-law' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('RESOLVE_INTERACTION', '0', { selectedPlayerIds: ['1', '2'] }),
                ],
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens.evasive).toBe(1);
            expect(result.finalState.core.players['1'].tokens.bounty).toBe(1);
            expect(result.finalState.core.players['2'].tokens.bounty).toBe(1);
            expect(result.finalState.core.players['1'].statusEffects.knockdown).toBe(1);
            expect(result.finalState.core.players['2'].statusEffects.knockdown).toBe(1);
        });

        it('upgrade-deadeye-2 后选择执法者变体，在 4 人组队局中可选择任意目标玩家', () => {
            const upgradeCard = GUNSLINGER_CARDS.find(card => card.id === 'upgrade-deadeye-2');
            expect(upgradeCard).toBeDefined();

            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };

            let state = createInitializedStateWithCharacters(
                playerIds,
                fixedRandom,
                { '0': 'gunslinger', '1': 'monk', '2': 'samurai', '3': 'paladin' }
            );
            state.core.players['0'].resources.cp = 2;
            state.core.players['0'].hand = [{ ...upgradeCard! }];
            state.core.players['0'].deck = [];

            expect(state.core.teamIdByPlayerId).toEqual({
                '0': 'A',
                '1': 'B',
                '2': 'A',
                '3': 'B',
            });

            const playResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '0',
                    payload: { cardId: 'upgrade-deadeye-2' },
                    timestamp: 1,
                } as DiceThroneCommand,
                fixedRandom,
                playerIds
            );
            expect(playResult.success).toBe(true);
            if (!playResult.success) {
                return;
            }

            state = playResult.state as MatchState<DiceThroneCore>;
            const upgradeRollResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'ADVANCE_PHASE',
                    playerId: '0',
                    payload: {},
                    timestamp: 2,
                } as DiceThroneCommand,
                createQueuedRandom([6, 6, 6, 1, 1]),
                playerIds
            );
            expect(upgradeRollResult.success).toBe(true);
            if (!upgradeRollResult.success) {
                return;
            }
            state = upgradeRollResult.state as MatchState<DiceThroneCore>;

            state = executePipeline(
                pipelineConfig,
                state,
                { type: 'ROLL_DICE', playerId: '0', payload: {}, timestamp: 3 } as DiceThroneCommand,
                createQueuedRandom([6, 6, 6, 1, 1]),
                playerIds,
            ).state as MatchState<DiceThroneCore>;
            state = executePipeline(
                pipelineConfig,
                state,
                { type: 'CONFIRM_ROLL', playerId: '0', payload: {}, timestamp: 4 } as DiceThroneCommand,
                createQueuedRandom([6, 6, 6, 1, 1]),
                playerIds,
            ).state as MatchState<DiceThroneCore>;
            state = executePipeline(
                pipelineConfig,
                state,
                { type: 'RESPONSE_PASS', playerId: '0', payload: {}, timestamp: 5 } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            ).state as MatchState<DiceThroneCore>;
            state = executePipeline(
                pipelineConfig,
                state,
                { type: 'RESPONSE_PASS', playerId: '1', payload: {}, timestamp: 6 } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            ).state as MatchState<DiceThroneCore>;

            const abilityResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'SELECT_ABILITY',
                    playerId: '0',
                    payload: { abilityId: 'the-law' },
                    timestamp: 7,
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(abilityResult.success).toBe(true);
            if (!abilityResult.success) {
                return;
            }
            state = abilityResult.state as MatchState<DiceThroneCore>;

            const advanceResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'ADVANCE_PHASE',
                    playerId: '0',
                    payload: {},
                    timestamp: 8,
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(advanceResult.success).toBe(true);
            if (!advanceResult.success) {
                return;
            }
            state = advanceResult.state as MatchState<DiceThroneCore>;

            const interaction = state.sys.interaction.current as {
                data?: { targetPlayerIds?: PlayerId[] };
            } | undefined;

            expect(interaction?.data?.targetPlayerIds).toEqual(['0', '1', '2', '3']);

            const resolveResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'RESOLVE_INTERACTION',
                    playerId: '0',
                    payload: { selectedPlayerIds: ['1', '3'] },
                    timestamp: 9,
                } as DiceThroneCommand,
                fixedRandom,
                playerIds
            );
            expect(resolveResult.success).toBe(true);
            if (!resolveResult.success) {
                return;
            }

            const skipLoadedResult = executePipeline(
                pipelineConfig,
                resolveResult.state as MatchState<DiceThroneCore>,
                {
                    type: 'SYS_INTERACTION_RESPOND',
                    playerId: '0',
                    payload: { optionId: 'option-1' },
                    timestamp: 10,
                } as DiceThroneCommand,
                fixedRandom,
                playerIds
            );
            expect(skipLoadedResult.success).toBe(true);
            if (!skipLoadedResult.success) {
                return;
            }

            const finalState = skipLoadedResult.state as MatchState<DiceThroneCore>;
            expect(finalState.sys.interaction.current).toBeFalsy();
            expect(finalState.core.players['0'].tokens.evasive).toBe(1);
            expect(finalState.core.players['1'].tokens.bounty).toBe(1);
            expect(finalState.core.players['1'].statusEffects.knockdown).toBe(1);
            expect(finalState.core.players['3'].tokens.bounty).toBe(1);
            expect(finalState.core.players['3'].statusEffects.knockdown).toBe(1);
            expect(finalState.core.players['2'].tokens.bounty ?? 0).toBe(0);
            expect(finalState.core.players['2'].statusEffects.knockdown ?? 0).toBe(0);
        });

        it('wanted should allow selecting any player in 4-player team mode', () => {
            const wantedCard = GUNSLINGER_CARDS.find(card => card.id === 'card-wanted');
            expect(wantedCard).toBeDefined();

            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };

            let state = createInitializedStateWithCharacters(
                playerIds,
                fixedRandom,
                { '0': 'gunslinger', '1': 'monk', '2': 'samurai', '3': 'paladin' }
            );
            state.core.players['0'].resources.cp = 2;
            state.core.players['0'].hand = [{ ...wantedCard! }];
            state.core.players['0'].deck = [];

            const playResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '0',
                    payload: { cardId: 'card-wanted' },
                    timestamp: 1,
                } as DiceThroneCommand,
                fixedRandom,
                playerIds
            );
            expect(playResult.success).toBe(true);
            if (!playResult.success) {
                return;
            }

            state = playResult.state as MatchState<DiceThroneCore>;
            const interaction = state.sys.interaction.current as {
                data?: { targetPlayerIds?: PlayerId[]; resolveCustomActionId?: string };
            } | undefined;
            expect(interaction?.data?.targetPlayerIds).toEqual(['0', '1', '2', '3']);
            expect(interaction?.data?.resolveCustomActionId).toBe('gunslinger-card-wanted-resolve');

            const resolveResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'RESOLVE_INTERACTION',
                    playerId: '0',
                    payload: { selectedPlayerIds: ['3'] },
                    timestamp: 2,
                } as DiceThroneCommand,
                fixedRandom,
                playerIds
            );
            expect(resolveResult.success).toBe(true);
            if (!resolveResult.success) {
                return;
            }

            const finalState = resolveResult.state as MatchState<DiceThroneCore>;
            expect(finalState.core.players['3'].tokens.bounty).toBe(1);
            expect(finalState.core.players['1'].tokens.bounty ?? 0).toBe(0);
            expect(finalState.core.players['2'].tokens.bounty ?? 0).toBe(0);
        });

        it('high noon should resolve its die result on the selected target in 4-player team mode', () => {
            const highNoonCard = GUNSLINGER_CARDS.find(card => card.id === 'card-high-noon');
            expect(highNoonCard).toBeDefined();

            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };

            let state = createInitializedStateWithCharacters(
                playerIds,
                fixedRandom,
                { '0': 'gunslinger', '1': 'monk', '2': 'samurai', '3': 'paladin' }
            );
            state.core.players['0'].resources.cp = 1;
            state.core.players['0'].hand = [{ ...highNoonCard! }];
            state.core.players['0'].deck = [];

            const playResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '0',
                    payload: { cardId: 'card-high-noon' },
                    timestamp: 1,
                } as DiceThroneCommand,
                fixedRandom,
                playerIds
            );
            expect(playResult.success).toBe(true);
            if (!playResult.success) {
                return;
            }

            state = playResult.state as MatchState<DiceThroneCore>;
            const interaction = state.sys.interaction.current as {
                data?: { targetPlayerIds?: PlayerId[]; resolveCustomActionId?: string };
            } | undefined;
            expect(interaction?.data?.targetPlayerIds?.slice().sort()).toEqual(['0', '1', '2', '3']);
            expect(interaction?.data?.resolveCustomActionId).toBe('gunslinger-card-high-noon-resolve');

            const resolveResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'RESOLVE_INTERACTION',
                    playerId: '0',
                    payload: { selectedPlayerIds: ['3'] },
                    timestamp: 2,
                } as DiceThroneCommand,
                createQueuedRandom([6]),
                playerIds
            );
            expect(resolveResult.success).toBe(true);
            if (!resolveResult.success) {
                return;
            }

            const pendingState = resolveResult.state as MatchState<DiceThroneCore>;
            expect(pendingState.core.pendingBonusDiceSettlement?.displayOnly).toBe(true);
            const settledResult = executePipeline(
                pipelineConfig,
                pendingState,
                {
                    type: 'SKIP_BONUS_DICE_REROLL',
                    playerId: '0',
                    payload: {},
                    timestamp: 3,
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(settledResult.success).toBe(true);
            if (!settledResult.success) {
                return;
            }

            const finalState = settledResult.state as MatchState<DiceThroneCore>;
            expect(finalState.core.players['3'].tokens.bounty).toBe(1);
            expect(finalState.core.players['1'].tokens.bounty ?? 0).toBe(0);
            expect(finalState.core.players['2'].tokens.bounty ?? 0).toBe(0);
            expect(finalState.core.players['0'].tokens.bounty ?? 0).toBe(0);
        });

        it('you should be ashamed should only target enemies in 4-player team mode', () => {
            const ashamedCard = SAMURAI_CARDS.find(card => card.id === 'card-you-should-be-ashamed');
            expect(ashamedCard).toBeDefined();

            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };

            let state = createInitializedStateWithCharacters(
                playerIds,
                fixedRandom,
                { '0': 'samurai', '1': 'monk', '2': 'gunslinger', '3': 'paladin' }
            );
            state.core.players['0'].resources.cp = 1;
            state.core.players['0'].hand = [{ ...ashamedCard! }];
            state.core.players['0'].deck = [];

            const playResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '0',
                    payload: { cardId: 'card-you-should-be-ashamed' },
                    timestamp: 1,
                } as DiceThroneCommand,
                fixedRandom,
                playerIds
            );
            expect(playResult.success).toBe(true);
            if (!playResult.success) {
                return;
            }

            state = playResult.state as MatchState<DiceThroneCore>;
            const interaction = state.sys.interaction.current as {
                data?: { targetPlayerIds?: PlayerId[]; resolveCustomActionId?: string };
            } | undefined;
            expect(interaction?.data?.targetPlayerIds).toEqual(['1', '3']);
            expect(interaction?.data?.resolveCustomActionId).toBe('samurai-card-you-should-be-ashamed-resolve');

            const resolveResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'RESOLVE_INTERACTION',
                    playerId: '0',
                    payload: { selectedPlayerIds: ['1'] },
                    timestamp: 2,
                } as DiceThroneCommand,
                fixedRandom,
                playerIds
            );
            expect(resolveResult.success).toBe(true);
            if (!resolveResult.success) {
                return;
            }

            const finalState = resolveResult.state as MatchState<DiceThroneCore>;
            expect(finalState.core.players['1'].tokens.shame).toBe(2);
            expect(finalState.core.players['3'].tokens.shame ?? 0).toBe(0);
            expect(finalState.core.players['2'].tokens.shame ?? 0).toBe(0);
        });

        it('2026-07-18 普通不可防御枪托击打会打开守护响应，跳过后结算伤害', () => {
            const upgradeCard = GUNSLINGER_CARDS.find(card => card.id === 'upgrade-fan-the-hammer-2');
            expect(upgradeCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([4, 4, 6, 1, 1]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'paladin' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['0'].hand = [{ ...upgradeCard! }];
                    state.core.players['0'].deck = [];
                    state.core.players['1'].tokens.protect = 1;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const responseResult = runner.run({
                name: 'gunslinger upgraded fan-the-hammer pistol-whip opens protect response',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'upgrade-fan-the-hammer-2' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'pistol-whip' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-1' }),
                ],
            });

            expect(responseResult.assertionErrors).toEqual([]);
            expect(responseResult.finalState.core.players['0'].tokens.evasive).toBe(1);
            expect(responseResult.finalState.core.players['1'].statusEffects.knockdown).toBe(1);
            expect(responseResult.finalState.core.players['1'].tokens.protect).toBe(1);
            expect(responseResult.finalState.core.pendingDamage).toMatchObject({
                targetPlayerId: '1',
                responseType: 'beforeDamageReceived',
                currentDamage: 1,
                unblockable: true,
            });
            expect(getCurrentInteractionSummary(responseResult.finalState)).toMatchObject({
                kind: 'dt:token-response',
                playerId: '1',
            });
            expect(responseResult.finalState.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(50);

            const settledResult = runner.run({
                name: 'gunslinger upgraded fan-the-hammer pistol-whip skips protect response',
                setup: () => responseResult.finalState,
                commands: [
                    cmd('SKIP_TOKEN_RESPONSE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                    players: {
                        '1': { hp: 49 },
                    },
                },
            });

            expect(settledResult.assertionErrors).toEqual([]);
            expect(settledResult.finalState.core.players['1'].tokens.protect).toBe(1);
        });

        it('upgrade-take-cover-2 后选择标记目标变体，应获得 2 闪避并施加 1 赏金', () => {
            const upgradeCard = GUNSLINGER_CARDS.find(card => card.id === 'upgrade-take-cover-2');
            expect(upgradeCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([4, 4, 4, 1, 1]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['0'].hand = [{ ...upgradeCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger upgraded take-cover mark-the-target',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'upgrade-take-cover-2' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'mark-the-target' }),
                    cmd('ADVANCE_PHASE', '0'),
                ],
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens.evasive).toBe(2);
            expect(result.finalState.core.players['1'].tokens.bounty).toBe(1);
            expect(result.finalState.core.players['0'].resources.cp).toBe(1);
        });

        it('spin the chamber grants 1 loaded', () => {
            const spinTheChamberCard = GUNSLINGER_CARDS.find(card => card.id === 'card-spin-the-chamber');
            expect(spinTheChamberCard).toBeDefined();
            let startingLoaded = 0;

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: fixedRandom,
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 1;
                    state.core.players['0'].hand = [{ ...spinTheChamberCard! }];
                    state.core.players['0'].deck = [];
                    startingLoaded = state.core.players['0'].tokens.loaded ?? 0;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger spin-the-chamber grants loaded',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-spin-the-chamber' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens.loaded).toBe(startingLoaded + 1);
        });

        it('wanted applies 1 bounty to the target', () => {
            const wantedCard = GUNSLINGER_CARDS.find(card => card.id === 'card-wanted');
            expect(wantedCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: fixedRandom,
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['0'].hand = [{ ...wantedCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger wanted applies bounty',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-wanted' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['1'].tokens.bounty).toBe(1);
        });

        it('upgrade-bounty-hunter-2 replaces ability and level', () => {
            const bountyHunterUpgradeCard = GUNSLINGER_CARDS.find(card => card.id === 'upgrade-bounty-hunter-2');
            expect(bountyHunterUpgradeCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: fixedRandom,
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 1;
                    state.core.players['0'].hand = [{ ...bountyHunterUpgradeCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger upgrade-bounty-hunter-2 replace',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'upgrade-bounty-hunter-2' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 0 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].abilityLevels['bounty-hunter']).toBe(2);

            const bountyHunterAbility = result.finalState.core.players['0'].abilities.find(ability => ability.id === 'bounty-hunter');
            expect(bountyHunterAbility).toBeDefined();
            expect(bountyHunterAbility?.description).toBeTruthy();
        });

        it('high noon dash branch inflicts knockdown without damage', () => {
            const highNoonCard = GUNSLINGER_CARDS.find(card => card.id === 'card-high-noon');
            expect(highNoonCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([4]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 1;
                    state.core.players['0'].hand = [{ ...highNoonCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger high-noon dash branch',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-high-noon' }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['1'].statusEffects.knockdown).toBe(1);
            expect(result.finalState.core.players['1'].tokens.bounty ?? 0).toBe(0);
        });

        it('2026-07-18 普通不可防御 high noon bullet 会打开守护响应，跳过后结算伤害', () => {
            const highNoonCard = GUNSLINGER_CARDS.find(card => card.id === 'card-high-noon');
            expect(highNoonCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'paladin' }
                    );
                    state.core.players['0'].resources.cp = 1;
                    state.core.players['0'].hand = [{ ...highNoonCard! }];
                    state.core.players['0'].deck = [];
                    state.core.players['1'].tokens.protect = 1;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const responseResult = runner.run({
                name: 'gunslinger high-noon bullet branch opens protect response',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-high-noon' }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
            });

            expect(responseResult.assertionErrors).toEqual([]);
            expect(responseResult.finalState.core.players['0'].resources.cp).toBe(0);
            expect(responseResult.finalState.core.players['0'].discard).toHaveLength(1);
            expect(responseResult.finalState.core.players['1'].tokens.protect).toBe(1);
            expect(responseResult.finalState.core.pendingDamage).toMatchObject({
                targetPlayerId: '1',
                responseType: 'beforeDamageReceived',
                currentDamage: 2,
                unblockable: true,
            });
            expect(getCurrentInteractionSummary(responseResult.finalState)).toMatchObject({
                kind: 'dt:token-response',
                playerId: '1',
            });
            expect(responseResult.finalState.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(50);

            const settledResult = runner.run({
                name: 'gunslinger high-noon bullet branch skips protect response',
                setup: () => responseResult.finalState,
                commands: [
                    cmd('SKIP_TOKEN_RESPONSE', '1'),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 48 },
                    },
                },
            });

            expect(settledResult.assertionErrors).toEqual([]);
            expect(settledResult.finalState.core.players['1'].tokens.protect).toBe(1);
            expect(settledResult.finalState.core.players['1'].statusEffects.knockdown ?? 0).toBe(0);
            expect(settledResult.finalState.core.players['1'].tokens.bounty ?? 0).toBe(0);
        });

        it('pistol-whip 的非攻击伤害不会触发目标身上的赏金', () => {
            const upgradeCard = GUNSLINGER_CARDS.find(card => card.id === 'upgrade-fan-the-hammer-2');
            expect(upgradeCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([4, 4, 6, 1, 1]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['0'].hand = [{ ...upgradeCard! }];
                    state.core.players['0'].deck = [];
                    state.core.players['1'].tokens.bounty = 1;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger pistol-whip direct damage ignores bounty',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'upgrade-fan-the-hammer-2' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'pistol-whip' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-1' }),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 0 },
                        '1': { hp: 49 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['1'].statusEffects.knockdown).toBe(1);
            expect(result.finalState.core.players['1'].tokens.bounty).toBe(1);
            expect(result.finalState.core.players['0'].resources.cp).toBe(0);
        });

        it('high noon bullseye branch applies bounty', () => {
            const highNoonCard = GUNSLINGER_CARDS.find(card => card.id === 'card-high-noon');
            expect(highNoonCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([6]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 1;
                    state.core.players['0'].hand = [{ ...highNoonCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger high-noon bullseye branch',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-high-noon' }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['1'].tokens.bounty).toBe(1);
            expect(result.finalState.core.players['1'].statusEffects.knockdown ?? 0).toBe(0);
        });

        it('upgrade-revolver-2 replaces ability and level', () => {
            const revolverUpgradeCard = GUNSLINGER_CARDS.find(card => card.id === 'upgrade-revolver-2');
            expect(revolverUpgradeCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: fixedRandom,
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['0'].hand = [{ ...revolverUpgradeCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger upgrade-revolver-2 replace',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'upgrade-revolver-2' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 0 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].abilityLevels.revolver).toBe(2);

            const revolverAbility = result.finalState.core.players['0'].abilities.find(ability => ability.id === 'revolver');
            expect(revolverAbility).toBeDefined();
            expect(revolverAbility?.variants.map(variant => variant.id)).toEqual(['revolver-2-3', 'revolver-2-4', 'revolver-2-5']);
        });

        it.each([
            ['upgrade-showdown-2', 1, 'showdown', 2, SHOWDOWN_2],
            ['upgrade-showdown-3', 2, 'showdown', 3, SHOWDOWN_3],
            ['upgrade-fan-the-hammer-2', 2, 'fan-the-hammer', 2, FAN_THE_HAMMER_2],
            ['upgrade-take-cover-2', 2, 'take-cover', 2, TAKE_COVER_2],
            ['upgrade-deadeye-2', 2, 'deadeye', 2, DEADEYE_2],
            ['upgrade-duel-2', 3, 'duel', 2, DUEL_2],
            ['upgrade-quick-draw', 2, 'quick-draw', 2, QUICK_DRAW_UPGRADED],
        ])('%s replaces runtime ability definition correctly', (cardId, cpCost, abilityId, expectedLevel, expectedAbility) => {
            const upgradeCard = GUNSLINGER_CARDS.find(card => card.id === cardId);
            expect(upgradeCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: fixedRandom,
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = cpCost;
                    state.core.players['0'].hand = [{ ...upgradeCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: cardId + ' runtime replacement',
                commands: [cmd('PLAY_CARD', '0', { cardId })],
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].abilityLevels[abilityId]).toBe(expectedLevel);
            expect(result.finalState.core.players['0'].abilities.find(ability => ability.id === abilityId)).toMatchObject(expectedAbility);
        });

        it('upgrade-deadeye-2 从正常牌库抽到手后，打出仍应走升级而不是其他效果', () => {
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: fixedRandom,
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger draw upgrade-deadeye-2 from normal deck and play it',
                commands: [
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'upgrade-deadeye-2' }),
                ],
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].abilityLevels.deadeye).toBe(2);
            expect(result.finalState.core.players['0'].abilities.find(ability => ability.id === 'deadeye')).toMatchObject(DEADEYE_2);

            const handIds = result.finalState.core.players['0'].hand.map(card => card.id);
            expect(handIds).not.toContain('upgrade-deadeye-2');

            const discardIds = result.finalState.core.players['0'].discard.map(card => card.id);
            expect(discardIds).not.toContain('card-the-law');
            expect(discardIds).not.toContain('upgrade-deadeye-2');
            expect(result.finalState.core.players['0'].upgradeCardByAbilityId.deadeye).toEqual({
                cardId: 'upgrade-deadeye-2',
                cpCost: 2,
            });

            const playedEvents = result.finalState.sys.eventStream?.entries
                ?.map(entry => entry.event)
                .filter((event): event is { type: string; payload?: Record<string, unknown> } => event.type === 'CARD_PLAYED') ?? [];
            expect(playedEvents.some(event => event.payload?.cardId === 'upgrade-deadeye-2')).toBe(true);

            const replacedEvents = result.finalState.sys.eventStream?.entries
                ?.map(entry => entry.event)
                .filter((event): event is { type: string; payload?: Record<string, unknown> } => event.type === 'ABILITY_REPLACED') ?? [];
            expect(replacedEvents.some(event => event.payload?.cardId === 'upgrade-deadeye-2')).toBe(true);
        });

        it('upgrade-fan-the-hammer-2 从正常牌库抽到手后，打出仍应走升级而不是同槽位其他卡效果', () => {
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: fixedRandom,
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger draw upgrade-fan-the-hammer-2 from normal deck and play it',
                commands: [
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'upgrade-fan-the-hammer-2' }),
                ],
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].abilityLevels['fan-the-hammer']).toBe(2);
            expect(result.finalState.core.players['0'].abilities.find(ability => ability.id === 'fan-the-hammer')).toMatchObject(FAN_THE_HAMMER_2);

            const handIds = result.finalState.core.players['0'].hand.map(card => card.id);
            expect(handIds).not.toContain('upgrade-fan-the-hammer-2');

            const discardIds = result.finalState.core.players['0'].discard.map(card => card.id);
            expect(discardIds).not.toContain('upgrade-fan-the-hammer-2');
            expect(discardIds).not.toContain('card-pistol-whip');
            expect(result.finalState.core.players['0'].upgradeCardByAbilityId['fan-the-hammer']).toEqual({
                cardId: 'upgrade-fan-the-hammer-2',
                cpCost: 2,
            });

            const playedEvents = result.finalState.sys.eventStream?.entries
                ?.map(entry => entry.event)
                .filter((event): event is { type: string; payload?: Record<string, unknown> } => event.type === 'CARD_PLAYED') ?? [];
            expect(playedEvents.some(event => event.payload?.cardId === 'upgrade-fan-the-hammer-2')).toBe(true);

            const replacedEvents = result.finalState.sys.eventStream?.entries
                ?.map(entry => entry.event)
                .filter((event): event is { type: string; payload?: Record<string, unknown> } => event.type === 'ABILITY_REPLACED') ?? [];
            expect(replacedEvents.some(event => event.payload?.cardId === 'upgrade-fan-the-hammer-2')).toBe(true);
        });

        it('upgrade-fan-the-hammer-2 升级后，实际选择左轮速射应造成 8 点伤害', () => {
            const upgradeCard = GUNSLINGER_CARDS.find(card => card.id === 'upgrade-fan-the-hammer-2');
            expect(upgradeCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 2, 3, 4, 5]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['0'].hand = [{ ...upgradeCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger upgrade fan-the-hammer then select upgraded attack',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'upgrade-fan-the-hammer-2' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fan-the-hammer-2-main' }),
                ],
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.phase).toBe('offensiveRoll');
            expect(result.finalState.core.players['0'].abilityLevels['fan-the-hammer']).toBe(2);
            expect(result.finalState.core.players['0'].abilities.find(ability => ability.id === 'fan-the-hammer')).toMatchObject(FAN_THE_HAMMER_2);
            expect(result.finalState.core.pendingAttack).toMatchObject({
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'fan-the-hammer-2-main',
            });
            expect(result.finalState.core.pendingAttack).not.toBeNull();
            expect(getPendingAttackExpectedDamage(
                result.finalState.core,
                result.finalState.core.pendingAttack!,
            )).toBe(8);
        });

        it('upgrade quick-draw makes loaded enter rerollable bonus die settlement', () => {
            const upgradeCard = GUNSLINGER_CARDS.find(card => card.id === 'upgrade-quick-draw');
            expect(upgradeCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 2, 3, 4, 5, 6, 2]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['0'].tokens.loaded = 1;
                    state.core.players['0'].hand = [{ ...upgradeCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger upgrade-quick-draw loaded reroll',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'upgrade-quick-draw' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'revolver-3' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }),
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.phase).toBe('defensiveRoll');
            expect(result.finalState.core.players['0'].abilityLevels['quick-draw']).toBe(2);
            expect(result.finalState.core.players['0'].tokens.loaded).toBe(0);
            expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(result.finalState.core.pendingAttack?.sourceAbilityId).toBe('revolver-3');
            expect(result.finalState.core.pendingAttack?.bonusDamage).toBe(1);
            expect(result.finalState.core.pendingAttack?.offensiveRollEndTokenResolved).toBe(true);
        });

        it('base loaded choice should create single-die display settlement and add rounded damage', () => {
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 2, 3, 4, 5, 1]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].tokens.loaded = 1;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger base loaded display settlement',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'revolver-3' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.phase).toBe('defensiveRoll');
            expect(result.finalState.core.players['0'].tokens.loaded).toBe(0);
            expect(result.finalState.core.pendingAttack).toMatchObject({
                sourceAbilityId: 'revolver-3',
                bonusDamage: 1,
                isDefendable: true,
                defenseAbilityId: 'meditation',
            });
            expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
        });
    });

    describe('samurai vs monk', () => {
        it('samurai initializes core and ultimate abilities', () => {
            const state = createInitializedStateWithCharacters(
                ['0', '1'],
                fixedRandom,
                { '0': 'samurai', '1': 'monk' }
            );

            const samuraiAbilityIds = state.core.players['0'].abilities.map(a => a.id);
            expect(samuraiAbilityIds).toContain('katana-slice');
            expect(samuraiAbilityIds).toContain('wakizashi');
            expect(samuraiAbilityIds).toContain('stand-tall');
            expect(samuraiAbilityIds).toContain('samurai-ultimate');
            expect(state.core.players['0'].abilityLevels['katana-slice']).toBe(1);
            expect(state.core.players['0'].abilityLevels['stand-tall']).toBe(1);

            const bushido = state.core.players['0'].abilities.find(a => a.id === 'bushido');
            expect(bushido?.type).toBe('passive');
            expect(bushido?.variants?.map(variant => variant.trigger.type)).toEqual(['phaseStart', 'phaseEnd']);
            expect(bushido?.variants?.map(variant => variant.effects[0]?.action?.type)).toEqual(['custom', 'custom']);
        });

        it('bushido grants 1 honor to the starting samurai at game start', () => {
            const state = createInitializedStateWithCharacters(
                ['0', '1'],
                fixedRandom,
                { '0': 'samurai', '1': 'monk' }
            );

            expect(state.core.startingPlayerId).toBe('0');
            expect(state.core.players['0'].tokens[TOKEN_IDS.HONOR]).toBe(1);
        });

        it('bushido grants 1 honor at end of turn when offensive rolls are fewer than 3', () => {
            const runner = createCrossHeroRunner(
                createQueuedRandom([1, 1, 6, 6, 4]),
                { '0': 'samurai', '1': 'monk' }
            );

            const result = runner.run({
                name: 'samurai bushido grants end-turn honor below three rolls',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'wakizashi' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('SKIP_TOKEN_RESPONSE', '0'),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ADVANCE_PHASE', '0'),
                ],
                expect: {
                    turnPhase: 'main1',
                    activePlayerId: '1',
                    pendingInteraction: null,
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.turnNumber).toBe(2);
            expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.HONOR]).toBe(2);
        });

        it('bushido does not grant extra honor after exactly 3 offensive rolls', () => {
            const runner = createCrossHeroRunner(
                createQueuedRandom([
                    1, 1, 6, 6, 4,
                    1, 1, 6, 6, 4,
                    1, 1, 6, 6, 4,
                ]),
                { '0': 'samurai', '1': 'monk' }
            );

            const result = runner.run({
                name: 'samurai bushido skips end-turn honor at three rolls',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'wakizashi' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('SKIP_TOKEN_RESPONSE', '0'),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ADVANCE_PHASE', '0'),
                ],
                expect: {
                    turnPhase: 'main1',
                    activePlayerId: '1',
                    pendingInteraction: null,
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.turnNumber).toBe(2);
            expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.HONOR]).toBe(1);
        });

        it('wakizashi grants 1 back strike and 3 undefendable damage', () => {
            const runner = createCrossHeroRunner(
                createQueuedRandom([1, 1, 6, 6, 4]),
                { '0': 'samurai', '1': 'monk' }
            );

            const result = runner.run({
                name: 'samurai wakizashi resolve',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'wakizashi' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('SKIP_TOKEN_RESPONSE', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50 },
                        '1': { hp: 47 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION]).toBe(1);
            expect(result.finalState.core.pendingAttack).toBeNull();
        });

        it('wakizashi undefendable damage can be boosted by honor', () => {
            const runner = createCrossHeroRunner(
                createQueuedRandom([1, 1, 6, 6, 4]),
                { '0': 'samurai', '1': 'monk' }
            );

            const result = runner.run({
                name: 'samurai wakizashi honor boost',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'wakizashi' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('USE_TOKEN', '0', { tokenId: TOKEN_IDS.HONOR, amount: 1 }),
                    cmd('SKIP_TOKEN_RESPONSE', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50 },
                        '1': { hp: 46 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.HONOR]).toBe(0);
            expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION]).toBe(1);
            expect(result.finalState.core.pendingAttack).toBeNull();
        });

        it('stand-tall reflects 1 and prevents 3 on defense', () => {
            const runner = createCrossHeroRunner(
                createQueuedRandom([1, 1, 1, 1, 1, 1, 4, 6]),
                { '0': 'monk', '1': 'samurai' }
            );

            const result = runner.run({
                name: 'samurai stand-tall defense',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 49 },
                        '1': { hp: 45 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['1'].tokens[TOKEN_IDS.SHAME] ?? 0).toBe(0);
            expect(result.finalState.core.pendingAttack).toBeNull();
        });

        it('back strike can be spent on incoming attack damage and settles with stand-tall defense damage', () => {
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 1, 1, 1, 1, 1, 4, 6, 5]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'monk', '1': 'samurai' }
                    );
                    state.core.players['1'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION] = 1;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'samurai back strike settles with stand-tall defense damage',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                    cmd('USE_TOKEN', '1', { tokenId: TOKEN_IDS.SAMURAI_RETRIBUTION, amount: 1 }),
                    cmd('SKIP_BONUS_DICE_REROLL', '1'),
                    cmd('SKIP_TOKEN_RESPONSE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 46 },
                        '1': { hp: 45 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['1'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION] ?? 0).toBe(0);
            expect(result.finalState.core.pendingDamage ?? null).toBeNull();
            expect(result.finalState.core.pendingAttack).toBeNull();
        });

        it('stand-tall fully prevents the attack without opening back-strike mitigation window', () => {
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 1, 1, 1, 2, 6, 6, 6]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'monk', '1': 'samurai' }
                    );
                    state.core.players['1'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION] = 1;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'samurai stand-tall full prevent keeps back strike unused',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-4' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['1'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION]).toBe(1);
            expect(result.finalState.core.pendingDamage ?? null).toBeNull();
            expect(result.finalState.core.pendingAttack).toBeNull();
        });


        it('righteousness katana face adds 2 damage to current attack', () => {
            const righteousnessCard = SAMURAI_CARDS.find(card => card.id === 'card-righteousness');
            expect(righteousnessCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 1, 1, 4, 4, 1]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'samurai', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['0'].hand = [{ ...righteousnessCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'samurai righteousness katana branch',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'katana-slice-3' }),
                    cmd('PLAY_CARD', '0', { cardId: 'card-righteousness' }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    players: {
                        '0': { hp: 50, cp: 1, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(result.finalState.core.pendingAttack?.sourceAbilityId).toBe('katana-slice-3');
            expect(result.finalState.core.pendingAttack?.bonusDamage).toBe(2);
            expect(result.finalState.core.pendingAttack?.attackModifierBonusDamage).toBe(2);
            expect(result.finalState.core.players['1'].tokens[TOKEN_IDS.SHAME] ?? 0).toBe(0);
            expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION] ?? 0).toBe(0);
        });

        it('righteousness helm face inflicts 2 shame on opponent', () => {
            const righteousnessCard = SAMURAI_CARDS.find(card => card.id === 'card-righteousness');
            expect(righteousnessCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 1, 1, 4, 4, 4]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'samurai', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 1;
                    state.core.players['0'].hand = [{ ...righteousnessCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'samurai righteousness helm branch',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'katana-slice-3' }),
                    cmd('PLAY_CARD', '0', { cardId: 'card-righteousness' }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(result.finalState.core.pendingAttack?.sourceAbilityId).toBe('katana-slice-3');
            expect(result.finalState.core.pendingAttack?.bonusDamage ?? 0).toBe(0);
            expect(result.finalState.core.pendingAttack?.attackModifierBonusDamage ?? 0).toBe(0);
            expect(result.finalState.core.players['1'].tokens[TOKEN_IDS.SHAME]).toBe(2);
            expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION] ?? 0).toBe(0);
        });

        it('zanshin rolls 5 extra dice and resolves samurai faces', () => {
            const zanshinCard = SAMURAI_CARDS.find(card => card.id === 'card-zanshin');
            expect(zanshinCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 1, 1, 4, 4, 1, 4, 6, 6, 2]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'samurai', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 1;
                    state.core.players['0'].hand = [{ ...zanshinCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'samurai zanshin attack modifier',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'katana-slice-3' }),
                    cmd('PLAY_CARD', '0', { cardId: 'card-zanshin' }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(result.finalState.core.pendingAttack?.sourceAbilityId).toBe('katana-slice-3');
            expect(result.finalState.core.pendingAttack?.bonusDamage).toBe(2);
            expect(result.finalState.core.pendingAttack?.attackModifierBonusDamage).toBe(2);
            expect(result.finalState.core.players['1'].tokens[TOKEN_IDS.SHAME]).toBe(1);
            // 真相源（tip.webp）标注反击（samurai_retribution）堆叠上限为 1，授予时应被 clamp
            expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION]).toBe(1);
        });

        it('upgrade-masamune-2 large straight variant rolls 5 extra dice', () => {
            const upgradeCard = SAMURAI_CARDS.find(card => card.id === 'upgrade-masamune-2');
            expect(upgradeCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([2, 3, 4, 5, 6, 1, 4, 6, 2, 5, 3, 1, 1, 1, 1]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'samurai', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['0'].hand = [{ ...upgradeCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'samurai masamune ii large straight',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'upgrade-masamune-2' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'masamune-2-large-straight' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('ADVANCE_PHASE', '1'),
                    cmd('SKIP_TOKEN_RESPONSE', '0'),
                    cmd('SKIP_TOKEN_RESPONSE', '1'),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { cp: 0, discardSize: 0 },
                        '1': {},
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(result.finalState.core.pendingAttack).toBeNull();
            expect(result.finalState.core.players['1'].tokens[TOKEN_IDS.SHAME]).toBe(1);
            expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION] ?? 0).toBe(0);
        });

        it('upgrade-masamune-2 power-up variant grants 1 back strike on all symbols present', () => {
            const upgradeCard = SAMURAI_CARDS.find(card => card.id === 'upgrade-masamune-2');
            expect(upgradeCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([2, 3, 4, 5, 6]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'samurai', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['0'].hand = [{ ...upgradeCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'samurai masamune ii power up',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'upgrade-masamune-2' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'masamune-2-power-up' }),
                    cmd('ADVANCE_PHASE', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 0 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION]).toBe(1);
            expect(result.finalState.core.pendingAttack).toBeNull();
            expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
        });

        it('upgrade-wakizashi-2 costs 2 CP and replaces runtime definition with level II', () => {
            const upgradeCard = SAMURAI_CARDS.find(card => card.id === 'upgrade-wakizashi-2');
            expect(upgradeCard).toBeDefined();
            expect(upgradeCard!.cpCost).toBe(2);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: fixedRandom,
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'samurai', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['0'].hand = [{ ...upgradeCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'samurai upgrade-wakizashi-2 runtime replace',
                commands: [cmd('PLAY_CARD', '0', { cardId: 'upgrade-wakizashi-2' })],
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].resources.cp).toBe(0);
            expect(result.finalState.core.players['0'].abilityLevels['wakizashi']).toBe(2);
            expect(result.finalState.core.players['0'].abilities.find(ability => ability.id === 'wakizashi')).toMatchObject(WAKIZASHI_2);
        });

        it('upgrade-wakizashi-3 replaces runtime definition with level III', () => {
            const upgradeCard = SAMURAI_CARDS.find(card => card.id === 'upgrade-wakizashi-3');
            expect(upgradeCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: fixedRandom,
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'samurai', '1': 'monk' }
                    );
                    state.core.players['0'].resources.cp = 3;
                    state.core.players['0'].hand = [{ ...upgradeCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'samurai upgrade-wakizashi-3 runtime replace',
                commands: [cmd('PLAY_CARD', '0', { cardId: 'upgrade-wakizashi-3' })],
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].abilityLevels['wakizashi']).toBe(3);
            expect(result.finalState.core.players['0'].abilities.find(ability => ability.id === 'wakizashi')).toMatchObject(WAKIZASHI_3);
        });
    });

    describe('pyromancer vs barbarian', () => {
        it('pyromancer initialization loads abilities and dice correctly', () => {
            const state = createInitializedStateWithCharacters(
                ['0', '1'],
                fixedRandom,
                { '0': 'barbarian', '1': 'pyromancer' }
            );

            // 闂傚倸鍊烽懗鍓佸垝椤栫偞鍋￠柕澶嗘櫅绾惧湱鎲搁悧鍫濈瑨闁搞劌鍊归妵鍕箳瀹ュ牆鍘￠梺缁樼箚閸╂牠濡甸崟顖氱疀闁宠桨鑳舵导鍕煟鎼达絾鍤€妞わ妇鏁诲?9 濠电姷鏁搁崑鐐哄垂閸洖绠归柍鍝勫€婚々鍙夌節闂堟稒鐭楃紒璇叉閹叉悂寮崼婵堢枃?
            expect(state.core.players['0'].abilities).toHaveLength(9);
            const barbarianAbilityIds = state.core.players['0'].abilities.map(a => a.id);
            expect(barbarianAbilityIds).toContain('slap');
            expect(barbarianAbilityIds).toContain('thick-skin');

            // 闂傚倸鍊烽懗鍓佸垝椤栫偛绀夐柡鍥╁Л閸嬫挸鈽夐幒鎾寸彅闂佹寧娲忛崹浠嬪箹瑜版帩鏁冮柕鍫濇搐妤犲嫭淇婇悙顏勨偓鏍礉閹达箑鍨傞柤濮愬€愰崑鎾绘偡闁附鈻堥梺鍝勭焿缁绘繂鐣烽悡搴樻斀闁归偊鍘滆椤啴濡堕崱妤冪懖缂備緡鍠栨鎼佸煡婢舵劖鍋ㄩ柛鎾冲级閺呪晠姊洪崗闂磋埅闁稿孩鐓￠、娆忣吋婢跺鎷绘繛杈剧悼閹虫挾寰婇懡銈囩＜缂備焦锚缁楁帡鏌嶇紒妯诲磳妤犵偛顑夐弫鍐焵椤掑倻涓嶆い鏇楀亾闁哄苯绉烽¨渚€鏌涢幘璺烘灈妤?
            expect(state.core.players['1'].abilities.length).toBeGreaterThanOrEqual(8);
            // 闂傚倸鍊风粈渚€骞夐敓鐘冲仭闁靛鏅涚€氬銇勯幒鎴濐仼闁?HP/CP 婵犵數濮甸鏍窗濡ゅ啯宕查柟閭﹀枛缁躲倝鏌涜椤ㄥ懘鎮?
            expect(state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
            expect(state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH);
        });

        it('barbarian and pyromancer character ids are correct', () => {
            const state = createInitializedStateWithCharacters(
                ['0', '1'],
                fixedRandom,
                { '0': 'barbarian', '1': 'pyromancer' }
            );

            expect(state.core.players['0'].characterId).toBe('barbarian');
            expect(state.core.players['1'].characterId).toBe('pyromancer');
            // 闂傚倸鍊风粈渚€骞夐敓鐘冲仭闁靛鏅涚€氬銇勯幒鎴濐仼闁藉啰鍠栭弻锝夊籍閸屾艾浠樼紓浣哄О閸庣敻骞冨Δ鍛櫜閹肩补鈧剚娼绘俊鐐€戦崐鏇㈠磹閸ф钃?4 闂?
            expect(state.core.players['0'].hand).toHaveLength(4);
            expect(state.core.players['1'].hand).toHaveLength(4);
        });
    });
});

describe('variant slot ownership', () => {
    it('non-prefixed variant ids still map to the correct slot', () => {
        expect(getAbilitySlotId('deadeye-shot-2')).toBe('chi');
        expect(getAbilitySlotId('focus')).toBe('chi');
        expect(getAbilitySlotId('soul-burn-4')).toBe('chi');
        expect(getAbilitySlotId('righteous-combat-3-main')).toBe('combo');
    });
});
