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
import {
    fixedRandom,
    createQueuedRandom,
    cmd,
    testSystems,
    assertState,
    type CommandInput,
} from './test-utils';
import { getAbilitySlotId } from '../ui/abilitySlotMapping';
import { GUNSLINGER_CARDS } from '../heroes/gunslinger/cards';
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
import { WAKIZASHI_3 } from '../heroes/samurai/abilities';

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
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('ADVANCE_PHASE', '1'),
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
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('ADVANCE_PHASE', '1'),
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
                random: createQueuedRandom([1, 2, 3, 4, 5, 6, 2]),
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk' }
                    );
                    state.core.players['0'].tokens.loaded = 1;
                    state.core.players['0'].resources.cp = 2;
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
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 1, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens.loaded).toBe(0);
            expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(result.finalState.core.pendingAttack?.sourceAbilityId).toBe('revolver-3');
            expect(result.finalState.core.pendingAttack?.bonusDamage).toBe(1);
            expect(result.finalState.core.pendingAttack?.attackModifierBonusDamage).toBe(1);
            expect(result.finalState.core.pendingAttack?.bonusDiceResolved).toBe(true);
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
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 1, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingBonusDiceSettlement?.displayOnly).toBe(true);
            expect(result.finalState.core.pendingBonusDiceSettlement?.dice).toHaveLength(5);
            expect(result.finalState.core.pendingAttack?.sourceAbilityId).toBe('revolver-3');
            expect(result.finalState.core.pendingAttack?.bonusDamage).toBe(5);
            expect(result.finalState.core.pendingAttack?.attackModifierBonusDamage).toBe(5);
            expect(result.finalState.core.players['1'].statusEffects.knockdown).toBe(1);
        });

        it('the law uses single-opponent fallback in 1v1', () => {
            const theLawCard = GUNSLINGER_CARDS.find(card => card.id === 'card-the-law');
            expect(theLawCard).toBeDefined();

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
                    state.core.players['0'].hand = [{ ...theLawCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger the-law 1v1 fallback',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-the-law' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens.evasive).toBe(1);
            expect(result.finalState.core.players['1'].tokens.bounty).toBe(1);
            expect(result.finalState.core.players['1'].statusEffects.knockdown).toBe(1);
        });

        it('the law can select up to two target players in multiplayer', () => {
            const theLawCard = GUNSLINGER_CARDS.find(card => card.id === 'card-the-law');
            expect(theLawCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1', '2'],
                random: fixedRandom,
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'monk', '2': 'paladin' }
                    );
                    state.core.players['0'].resources.cp = 2;
                    state.core.players['0'].hand = [{ ...theLawCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger the-law multiplayer',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-the-law' }),
                    cmd('RESOLVE_INTERACTION', '0', { selectedPlayerIds: ['1', '2'] }),
                ],
                expect: {
                    turnPhase: 'main1',
                    pendingInteraction: null,
                    players: {
                        '0': { cp: 0, discardSize: 1 },
                        '1': {},
                        '2': {},
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens.evasive).toBe(1);
            expect(result.finalState.core.players['1'].tokens.bounty).toBe(1);
            expect(result.finalState.core.players['2'].tokens.bounty).toBe(1);
            expect(result.finalState.core.players['1'].statusEffects.knockdown).toBe(1);
            expect(result.finalState.core.players['2'].statusEffects.knockdown).toBe(1);
        });

        it('the law should only target enemies in 4-player team mode', () => {
            const theLawCard = GUNSLINGER_CARDS.find(card => card.id === 'card-the-law');
            expect(theLawCard).toBeDefined();

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
            state.core.players['0'].hand = [{ ...theLawCard! }];
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
                    payload: { cardId: 'card-the-law' },
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
                data?: { targetPlayerIds?: PlayerId[] };
            } | undefined;

            expect(interaction?.data?.targetPlayerIds).toEqual(['1', '3']);
            expect(interaction?.data?.targetPlayerIds).not.toContain('2');

            const resolveResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'RESOLVE_INTERACTION',
                    playerId: '0',
                    payload: { selectedPlayerIds: ['1', '3'] },
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
            expect(finalState.sys.interaction.current).toBeFalsy();
            expect(finalState.core.players['0'].tokens.evasive).toBe(1);
            expect(finalState.core.players['1'].tokens.bounty).toBe(1);
            expect(finalState.core.players['1'].statusEffects.knockdown).toBe(1);
            expect(finalState.core.players['3'].tokens.bounty).toBe(1);
            expect(finalState.core.players['3'].statusEffects.knockdown).toBe(1);
            expect(finalState.core.players['2'].tokens.bounty ?? 0).toBe(0);
            expect(finalState.core.players['2'].statusEffects.knockdown ?? 0).toBe(0);
        });

        it('pistol whip undefendable damage should not trigger protect', () => {
            const pistolWhipCard = GUNSLINGER_CARDS.find(card => card.id === 'card-pistol-whip');
            expect(pistolWhipCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: fixedRandom,
                setup: (playerIds: PlayerId[], random: RandomFn) => {
                    const state = createInitializedStateWithCharacters(
                        playerIds,
                        random,
                        { '0': 'gunslinger', '1': 'paladin' }
                    );
                    state.core.players['0'].resources.cp = 1;
                    state.core.players['0'].hand = [{ ...pistolWhipCard! }];
                    state.core.players['0'].deck = [];
                    state.core.players['1'].tokens.protect = 1;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger pistol-whip skips protect',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-pistol-whip' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 49 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens.evasive).toBe(1);
            expect(result.finalState.core.players['1'].statusEffects.knockdown).toBe(1);
            expect(result.finalState.core.players['1'].tokens.protect).toBe(1);
            expect(result.finalState.sys.interaction.current).toBeFalsy();
        });

        it('mark the target grants 2 evasive and 1 bounty', () => {
            const markTheTargetCard = GUNSLINGER_CARDS.find(card => card.id === 'card-mark-the-target');
            expect(markTheTargetCard).toBeDefined();

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
                    state.core.players['0'].hand = [{ ...markTheTargetCard! }];
                    state.core.players['0'].deck = [];
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'gunslinger mark-the-target base effect',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-mark-the-target' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 2, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens.evasive).toBe(2);
            expect(result.finalState.core.players['1'].tokens.bounty).toBe(1);
        });

        it('spin the chamber grants 1 loaded', () => {
            const spinTheChamberCard = GUNSLINGER_CARDS.find(card => card.id === 'card-spin-the-chamber');
            expect(spinTheChamberCard).toBeDefined();

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
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens.loaded).toBe(1);
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
                    pendingInteraction: null,
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
                        '0': { hp: 50, cp: 0, discardSize: 1 },
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
                ],
                expect: {
                    turnPhase: 'main1',
                    pendingInteraction: null,
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

        it('high noon bullet branch deals 2 undefendable damage without protect', () => {
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

            const result = runner.run({
                name: 'gunslinger high-noon bullet branch',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-high-noon' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 48 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['1'].tokens.protect).toBe(1);
            expect(result.finalState.core.players['1'].statusEffects.knockdown ?? 0).toBe(0);
            expect(result.finalState.core.players['1'].tokens.bounty ?? 0).toBe(0);
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
                ],
                expect: {
                    turnPhase: 'main1',
                    pendingInteraction: null,
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
                        '0': { hp: 50, cp: 0, discardSize: 1 },
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
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingBonusDiceSettlement?.displayOnly).toBe(true);
            expect(result.finalState.core.pendingBonusDiceSettlement?.dice).toHaveLength(1);
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
                    state.core.players['0'].resources.cp = 2;
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
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingBonusDiceSettlement?.displayOnly).toBe(true);
            expect(result.finalState.core.pendingBonusDiceSettlement?.dice).toHaveLength(1);
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
                    state.core.players['0'].resources.cp = 2;
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
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    pendingInteraction: null,
                    players: {
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingBonusDiceSettlement?.displayOnly).toBe(true);
            expect(result.finalState.core.pendingBonusDiceSettlement?.dice).toHaveLength(5);
            expect(result.finalState.core.pendingAttack?.sourceAbilityId).toBe('katana-slice-3');
            expect(result.finalState.core.pendingAttack?.bonusDamage).toBe(2);
            expect(result.finalState.core.pendingAttack?.attackModifierBonusDamage).toBe(2);
            expect(result.finalState.core.players['1'].tokens[TOKEN_IDS.SHAME]).toBe(1);
            expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION]).toBe(2);
        });

        it('upgrade-masamune-2 large straight variant rolls 6 extra dice', () => {
            const upgradeCard = SAMURAI_CARDS.find(card => card.id === 'upgrade-masamune-2');
            expect(upgradeCard).toBeDefined();

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([2, 3, 4, 5, 6, 1, 4, 6, 2, 5, 3]),
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
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                    players: {
                        '0': { cp: 0, discardSize: 1 },
                        '1': {},
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingBonusDiceSettlement?.displayOnly).toBe(true);
            expect(result.finalState.core.pendingBonusDiceSettlement?.dice).toHaveLength(6);
            expect(result.finalState.core.pendingAttack).toBeNull();
            expect(result.finalState.core.players['1'].tokens[TOKEN_IDS.SHAME]).toBe(2);
            expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION]).toBe(1);
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
                        '0': { hp: 50, cp: 0, discardSize: 1 },
                        '1': { hp: 50 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].tokens[TOKEN_IDS.SAMURAI_RETRIBUTION]).toBe(1);
            expect(result.finalState.core.pendingAttack).toBeNull();
            expect(result.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
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
        expect(getAbilitySlotId('blazing-soul')).toBe('chi');
        expect(getAbilitySlotId('righteous-combat-3-main')).toBe('combo');
    });
});
