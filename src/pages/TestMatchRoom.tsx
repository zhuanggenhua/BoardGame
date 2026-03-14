/**
 * 婵犵數鍋炲娆擃敄閸儲鍎婃い鏍嚤閻旂厧鐏崇€规洖娲ㄩ、鍛存煟鎼达絾鏆╅柟铏崌閹洭顢楁担鍏哥盎闂佹眹鍨归幉鈥愁浖? * 
 * 濠电偞鍨堕幐濠氬箲閸ヮ灛娑㈩敆閸曨剙浠洪梺闈涱焾閸婃鎳?E2E 婵犵數鍋炲娆擃敄閸儲鍎婃い鏍仦閸庡秹鏌涢弴銊ヤ航闁搞倗濞€閹﹢鎮欓埡浣峰濠碉紕鍋戦崐妤呭极鐠囧樊鐒藉ù鐓庣摠閺咁剟鎮橀悙鏉戝姢缂佽尙鎳撻妴鎺戭潩椤撶偛鏋欑紓?
 * 1. 闂佽崵濮撮幖顐︽偪閸モ晜宕查柛鎰电厑濞差亜绀堢憸鏃堝礂閸ヮ剚鈷戞い鎰╁焺濡插綊鎮?- 闂傚倷绶￠崑鍛┍閾忚宕?URL 闂備礁鎲￠悷銉╁磹瑜版帒姹查柣鏂垮悑閸庡酣鎮楀☉娅亝寰勫澶嬬厵缂佸瀵ч幖鎰版煟閿濆棗鍔ら悡銈夋煕閹炬娲ら崢?
 * 2. 缂備胶铏庨崣搴ㄥ窗閺嶎厽鍋╁Δ锝呭暙缁犳垹鎲搁弬搴撴灁闁靛繈鍊曠€?- 闂傚倷绶￠崑鍛┍閾忚宕?URL 闂備礁鎲￠悷銉╁磹瑜版帒姹查柣鏃傚劋婵ジ鏌涢幘妤€鎳忛悗顓㈡⒒閸屾碍鍣圭紒缁樺灥閳瑰啴鍩€椤掑倻纾煎璺猴功瀛濋梺?
 * 3. 闂傚鍋勫ù鍌炲磻婵犲洤鐒垫い鎺戝€搁弸搴㈢節瑜夐崑鎾绘⒑閸濆嫭濯奸柛銊╀憾閹顢涘鐓庢畼?- 闂傚倷绶￠崑鍛┍閾忚宕?TestHarness 婵犵數鍋涢ˇ顓㈠礉瀹€鍕煑闁糕剝绋掗崑鎰版煠閸濄儺鏆柛?
 * 
 * URL 闂備礁鎼粔鍫曞储瑜忓Σ鎰版晸閻樿櫕娅?
 * /play/:gameId/test?p0=faction1,faction2&p1=faction3,faction4&seed=12345
 * 
 * 缂傚倷璁查崑鎾诲级閻愭潙顥嬪ù鍏煎姍閺?
 * /play/smashup/test?p0=wizards,aliens&p1=zombies,pirates&seed=12345
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { loadGameImplementation, getGameImplementation } from '../games/registry';
import { GameModeProvider } from '../contexts/GameModeContext';
import { getGameById } from '../config/games.config';
import { GameHUD } from '../components/game/framework/widgets/GameHUD';
import { GameCursorProvider } from '../core/cursor/GameCursorProvider';
import { LocalGameProvider, BoardBridge } from '../engine/transport/react';
import { LoadingScreen } from '../components/system/LoadingScreen';
import { SEO } from '../components/common/SEO';
import { enableTestMode } from '../engine/testing/environment';
import { getGamePageDataAttributes } from '../games/mobileSupport';
import { MobileBoardShell } from '../components/game/framework';

// 闂備礁鎲￠崙褰掑垂閹惰棄鏋侀柕鍫濇偪閸︻厸鍋撻敐搴″箻婵℃彃鎲℃穱濠囶敍濡炶浜剧€规洖娲ㄩ、鍛存⒑閹稿海鈽夐柣妤€妫涢幑銏ゅ焵椤掆偓椤啴濡堕崼顐㈡濠电姭鍋撴い蹇撴绾惧ジ鏌涢弴銊ょ凹妞ゆ劘妫勯…鍧楁嚋閻㈤潧鈷岄梺绋块椤曨參骞忛锕€绀冩い蹇撴噺濞堛垽姊洪幐搴ｂ槈闁活剙銈搁崹鎯熼懡銈傛敵濠电娀娼уΛ娆撶叕椤掆偓闇夐柣妯硅閸炶櫣绱?Provider 婵犵數鍋為幐绋款嚕閸洘鍋傞悗锝庡枛缁€鍫⑩偓骞垮劚濞诧箓寮查幖浣圭厸濞达絽鎽滄晶宕囩磼?
if (typeof window !== 'undefined') {
    enableTestMode();
}

export const TestMatchRoom: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const [searchParams] = useSearchParams();
    const [engineConfig, setEngineConfig] = useState<any>(null);
    const [WrappedBoard, setWrappedBoard] = useState<React.ComponentType<any> | null>(null);
    const [loading, setLoading] = useState(true);

    const gameConfig = gameId ? getGameById(gameId) : null;
    const gamePageDataAttributes = getGamePageDataAttributes(gameId, gameConfig);

    // 闂佽崵鍠愰悷杈╁緤妤ｅ啯鍊?URL 闂備礁鎲￠悷銉╁磹瑜版帒姹?
    const testConfig = useMemo(() => {
        const p0Factions = searchParams.get('p0')?.split(',') || [];
        const p1Factions = searchParams.get('p1')?.split(',') || [];
        const seed = searchParams.get('seed') || '12345';
        const numPlayers = parseInt(searchParams.get('numPlayers') || '2', 10);
        const skipFactionSelect = searchParams.get('skipFactionSelect') === 'true';
        const skipInitialization = searchParams.get('skipInitialization') === 'true';
        
        return {
            player0Factions: p0Factions,
            player1Factions: p1Factions,
            randomSeed: seed,
            numPlayers,
            skipFactionSelect,
            skipInitialization,
        };
    }, [searchParams]);

    useEffect(() => {
        if (!gameId) return;

        const loadGame = async () => {
            console.log('[TestMatchRoom] 闁诲孩顔栭崰鎺楀磻閹炬枼鏀芥い鏃傗拡閸庡繐鈹戦鎯т沪婵炵⒈浜幊鐐哄Ψ瑜嶉悡鎴︽⒑?', gameId);
            try {
                setLoading(true);
                console.log('[TestMatchRoom] 闂佽崵濮撮鍛村疮娴兼潙鏋?loadGameImplementation');
                await loadGameImplementation(gameId);
                console.log('[TestMatchRoom] loadGameImplementation done');
                
                console.log('[TestMatchRoom] 闂佽崵濮撮鍛村疮娴兼潙鏋?getGameImplementation');
                const impl = getGameImplementation(gameId);
                console.log('[TestMatchRoom] getGameImplementation 缂傚倸鍊烽悞锕傚箰婵犳碍鍊?', {
                    hasImpl: !!impl,
                    hasEngineConfig: !!impl?.engineConfig,
                    hasBoard: !!impl?.board,
                });

                if (!impl) {
                    console.error(`[TestMatchRoom] 婵犵數鍋為幐鎼佸箟閿熺姴鍨傛繛鍡樺灍閸嬫捇宕烽鐐版埛濡ょ姷鍋涘ú顓烆嚕閻㈠壊鏁傞柛娑卞弾濡喖姊? ${gameId}`);
                    return;
                }

                console.log('[TestMatchRoom] 闂佽崵濮崇粈浣规櫠娴犲鍋?engineConfig 闂?board');
                setEngineConfig(impl.engineConfig);
                setWrappedBoard(() => impl.board);
                
                console.log('[TestMatchRoom] game implementation loaded');
            } catch (error) {
                console.error(`[TestMatchRoom] 闂備礁鎲″缁樻叏閹灐褰掑炊瑜嬮埀顒佸浮瀹曘劍绻濋崒婊€绨藉┑鐘灪閸庤偐鍒掗崜褎鍠?`, error);
                console.error(`[TestMatchRoom] 闂傚倷鐒︾€笛囨偡閵娾晩鏁嬮柕鍫濐槸闁卞洭鏌涢埄鍐剧劷闁?`, (error as Error).stack);
            } finally {
                console.log('[TestMatchRoom] 闂備礁鎲″缁樻叏閹灐褰掑炊閳规儳浜鹃柣鐔哄濠€浼存煕閵婏箑鍝洪柡浣哥Т閻ｆ繈宕橀幆褎娅楃紓?loading=false');
                setLoading(false);
            }
        };

        loadGame();
    }, [gameId, testConfig]);

    // 婵犵數鍋涢ˇ顓㈠礉瀹€鍕煑闁糕剝顦洪崷顓涘亾閿濆骸骞樻俊鍙夋倐濮婃椽寮剁捄銊愩倝鏌ｉ妶鍛棦鐎?window闂備焦瀵х粙鎴︽偋閸涱垱顐?TestHarness 濠电偠鎻紞鈧繛澶嬫礋瀵偊濡舵径瀣珫?
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const holder = window as Window & { __BG_TEST_CONFIG__?: typeof testConfig };
        holder.__BG_TEST_CONFIG__ = testConfig;
        
        console.log('[TestMatchRoom] 婵犵數鍋炲娆擃敄閸儲鍎婃い鏍仦閻撯偓閻庡箍鍎卞ú銊╁几閸屾壕鍋撻崷顓х劸鐎殿喖鐖煎顐︽倷閸濆嫮顦?', testConfig);
        
        return () => {
            holder.__BG_TEST_CONFIG__ = undefined;
        };
    }, [testConfig]);

    // 自动完成派系选择（URL 预设）
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!testConfig.player0Factions.length && !testConfig.player1Factions.length) return;
        if (testConfig.skipFactionSelect) {
            console.log('[TestMatchRoom] skipFactionSelect=true, bypass auto faction selection');
            return;
        }
        // 缂傚倷鐒︾粙鎴λ囬婊勵偨闁绘梹鐏氶埀顒佸浮瀹曘劍绻濋崒婊€绨介梻浣告啞濮婄粯鎱ㄩ幆顬″綊宕堕埞鎯т壕闁荤喓澧楀﹢浼存煕?
        if (loading || !engineConfig || !WrappedBoard) return;
        
        // 缂傚倷鐒︾粙鎴λ囬婊勵偨?TestHarness 闂佽绻愮换妤佺椤掑嫬纭€?
        const checkAndAutoSelect = async () => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            if (!harness || !harness.command.isRegistered()) {
                console.log('[TestMatchRoom] TestHarness 闂備礁鎼悧婊勭濠婂喚娼╅柕濞у懐锛滃銈呯箰濞撮绮堟径宀€纾兼繛鎴烇供濡插摜绱?..');
                return;
            }
            
            // 婵犵妲呴崑鈧柛瀣崌閺岋紕浠︾拠鎻掑缂傚倸绉撮澶婄暦濠婂喚鍚嬮柛銉仢閿曞倹鐓?
            const state = harness.state.get();
            if (!state || !state.core) {
                console.log('[TestMatchRoom] state not ready');
                return;
            }
            
            // 闂備礁鎲￠…鍥窗閹邦剨鑰垮〒姘ｅ亾闁诡垰鍟村畷鐔碱敊閸忕⒈鍞堕梻浣告啞閺岋綁宕濆鍚冲骸鐣烽崶褍顕ф繝鐢靛У閸╁啴宕戦幘鏉戠窞閻庯綆浜舵禒鎾⒒娓氬洤浜濇俊鍙夊笧濞嗐垽顢曢敂鑺ユ珫闂佸壊鍋侀崕顕€宕戦幘璇茬疀妞ゅ繐鐗嗗▓婵堢磽娴ｅ湱鈽夋い锔诲灣濞嗐垽鎮㈤崗鍏兼珫?
            if (!state.core.factionSelection) {
                console.log('[TestMatchRoom] state not ready or faction selection already completed');
                return;
            }
            
            if (state.sys.phase !== 'factionSelect') {
                console.log('[TestMatchRoom] not in factionSelect phase, skip auto select');
                return;
            }
            
            console.log('[TestMatchRoom] auto faction selection started');
            
            // 闂備胶鍋撻弻銊ッ洪妶澶嬪殝濞寸厧鐡ㄩ悞璇差熆鐠鸿櫣鐒炬繛鐓庯躬閺屻劌鈽夊▎鎴炴儥0 闂?P1 闂?P1 闂?P0
            const selectionOrder: Array<{ playerId: string; factionIndex: number }> = [];
            selectionOrder.push({ playerId: '0', factionIndex: 0 });
            selectionOrder.push({ playerId: '1', factionIndex: 0 });
            selectionOrder.push({ playerId: '1', factionIndex: 1 });
            selectionOrder.push({ playerId: '0', factionIndex: 1 });
            
            // 闂備礁婀遍…鍫ニ囬悽绋课ラ幖娣灪閸庣喖鐓崶銊︾叆闁抽攱妫冮幃璺衡槈濡偐鍔梺閫炲苯澧い锔藉閳?
            for (const { playerId, factionIndex } of selectionOrder) {
                const factions = playerId === '0' ? testConfig.player0Factions : testConfig.player1Factions;
                const factionId = factions[factionIndex];
                
                if (!factionId) {
                    console.warn(`[TestMatchRoom] player ${playerId} faction #${factionIndex + 1} missing, skip`);
                    continue;
                }
                
                console.log(`[TestMatchRoom] 闂備胶绮竟鏇㈠疾濞戙埄鏁?${playerId} 闂傚倷绶￠崑鍕囬幍顔瑰亾濮樸儱濡奸悡銈夋煕閹炬娲ら崢?${factionIndex + 1}: ${factionId}`);
                await harness.command.dispatch({
                    type: 'su:select_faction',
                    payload: { factionId }
                });
                
                // 缂傚倷鐒︾粙鎴λ囬婊勵偨闁绘柨鍚嬮崑鎰版煠閸濄儺鏆柛瀣尰閹峰懐鎲撮崟顓炲毐闂?
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log('[TestMatchRoom] faction selection finished');
        };
        
        // 闁诲海鍋ｉ崐鏍磿閼测晜宕叉繝濠傜墕缁犮儳鎲搁幋锔衡偓渚€骞嬮敂鑺ユ珫閻庡厜鍋撻柍褜鍓熼崹鎯熼懡銈傛敵?LocalGameProvider 闁诲氦顫夐悺鏇犱焊濞嗘垵鍨濋柍銉︽灱閺嬫牠鏌曟繛鍨姎闁哄倵鍋?TestHarness
        const timer = setTimeout(checkAndAutoSelect, 1000);
        
        return () => clearTimeout(timer);
    }, [testConfig, loading, engineConfig, WrappedBoard]);

    if (!gameId || !gameConfig) {
        return (
            <div className="w-full h-full flex items-center justify-center text-white/50">
                {'\u672a\u627e\u5230\u6e38\u620f\u914d\u7f6e'}
            </div>
        );
    }

    if (loading) {
        return <LoadingScreen title={gameConfig ? `\u6b63\u5728\u52a0\u8f7d ${gameConfig.title}...` : '\u6b63\u5728\u52a0\u8f7d...'} />;
    }

    if (!engineConfig || !WrappedBoard) {
        console.log('[TestMatchRoom] 婵犵數鍋為幐鎼佸箟閿熺姴鍨傛繛鍡樻尭缁€澶愭煟濡厧鍔嬬紒浣规緲椤潡骞嗛幍顔剧勘闁?', { engineConfig: !!engineConfig, WrappedBoard: !!WrappedBoard });
        return (
            <div className="w-full h-full flex items-center justify-center text-white/50">
                {'\u6e38\u620f\u52a0\u8f7d\u5931\u8d25'}
            </div>
        );
    }
    
    console.log('[TestMatchRoom] 闂備礁鎲￠崹闈浳涘Δ鍚藉洭顢楅埀顒勫Υ閹烘鐭楀璺鸿嫰鐢?', {
        engineConfig: !!engineConfig,
        WrappedBoard: !!WrappedBoard,
    });

    return (
        <>
            <SEO
                title={`${gameConfig.title} - \u6d4b\u8bd5\u6a21\u5f0f`}
                description={`${gameConfig.title} E2E \u6d4b\u8bd5\u6a21\u5f0f`}
            />
            <div
                className="relative w-full game-page-viewport overflow-hidden font-sans"
                {...gamePageDataAttributes}
                style={{
                    background: gameConfig.theme?.background || 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                } as React.CSSProperties}
            >
                <GameModeProvider mode="test">
                    <GameCursorProvider themeId={gameConfig?.cursorTheme} gameId={gameId}>
                        <MobileBoardShell>
                            {engineConfig && WrappedBoard ? (
                                <LocalGameProvider
                                    config={engineConfig}
                                    numPlayers={testConfig.numPlayers}
                                    seed={testConfig.randomSeed}
                                    playerId="0"
                                    followCurrentTurnPlayer
                                >
                                    <GameHUD gameId={gameId} mode="test" />
                                    <BoardBridge
                                        board={WrappedBoard}
                                        loading={<LoadingScreen title={gameConfig ? `\u6b63\u5728\u52a0\u8f7d ${gameConfig.title}...` : '\u6b63\u5728\u52a0\u8f7d...'} />}
                                    />
                                </LocalGameProvider>
                            ) : (
                                <LoadingScreen title={gameConfig ? `\u6b63\u5728\u52a0\u8f7d ${gameConfig.title}...` : '\u6b63\u5728\u52a0\u8f7d...'} />
                            )}
                        </MobileBoardShell>
                    </GameCursorProvider>
                </GameModeProvider>
            </div>
        </>
    );
};
