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
 * /play/example-game/test?p0=faction-a,faction-b&p1=faction-c,faction-d&seed=12345
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { loadGameImplementation, getGameImplementation, type GameImplementation } from '../games/registry';
import { GameModeProvider } from '../contexts/GameModeContext';
import { getGameById } from '../config/games.config';
import { GameHUD } from '../components/game/framework/widgets/GameHUD';
import { GameCursorProvider } from '../core/cursor/GameCursorProvider';
import { GamePageRuntimeProvider } from '../games/pageRuntimeAdapter';
import { shouldKeepBoardMountedOnPlayerViewChange } from '../games/pageShell';
import { LocalGameProvider, BoardBridge } from '../engine/transport/react';
import type { GameBoardProps } from '../engine/transport/protocol';
import { LoadingScreen } from '../components/system/LoadingScreen';
import { GameNamespaceLoadError } from '../components/system/GameNamespaceLoadError';
import { SEO } from '../components/common/SEO';
import { resolveGameDisplayName } from '../components/lobby/gameDetailsContent';
import { TestHarness } from '../engine/testing';
import { enableTestMode } from '../engine/testing/environment';
import { getGamePageDataAttributes, syncGamePageDocumentAttributes } from '../shared/mobileSupport';
import { MobileBoardShell } from '../components/game/framework';
import { useToast } from '../contexts/ToastContext';
import { isUiHintOnlyError, resolveCommandError } from '../engine/transport/errorI18n';
import { playDeniedSound } from '../lib/audio/useGameAudio';
import { useGameNamespaceReady } from '../hooks/useGameNamespaceReady';
import {
    resolveSeatControllersFromSearchParams,
} from '../engine/ai';
import { buildGameHudRuntimeProps } from './gameHudRuntimeProps';
import { resolveManifestLocalSetup, resolveRuntimeLocalSetupData } from './matchRoomLocalSetup';

// 闂備礁鎲￠崙褰掑垂閹惰棄鏋侀柕鍫濇偪閸︻厸鍋撻敐搴″箻婵℃彃鎲℃穱濠囶敍濡炶浜剧€规洖娲ㄩ、鍛存⒑閹稿海鈽夐柣妤€妫涢幑銏ゅ焵椤掆偓椤啴濡堕崼顐㈡濠电姭鍋撴い蹇撴绾惧ジ鏌涢弴銊ょ凹妞ゆ劘妫勯…鍧楁嚋閻㈤潧鈷岄梺绋块椤曨參骞忛锕€绀冩い蹇撴噺濞堛垽姊洪幐搴ｂ槈闁活剙銈搁崹鎯熼懡銈傛敵濠电娀娼уΛ娆撶叕椤掆偓闇夐柣妯硅閸炶櫣绱?Provider 婵犵數鍋為幐绋款嚕閸洘鍋傞悗锝庡枛缁€鍫⑩偓骞垮劚濞诧箓寮查幖浣圭厸濞达絽鎽滄晶宕囩磼?
if (typeof window !== 'undefined') {
    enableTestMode();
    TestHarness.init();
}

const TUTORIAL_SILENT_ERRORS = new Set(['tutorial_command_blocked', 'tutorial_step_locked']);

function resolveTestPlayerNames(searchParams: URLSearchParams, numPlayers: number): Record<string, string> {
    const names: Record<string, string> = {};
    for (let index = 0; index < numPlayers; index += 1) {
        const id = String(index);
        const explicitName = searchParams.get(`player${index}Name`)
            ?? searchParams.get(`playerName${index}`)
            ?? searchParams.get(`p${index}Name`);
        const trimmedName = explicitName?.trim();
        if (trimmedName) {
            names[id] = trimmedName;
        }
    }
    return names;
}

export const TestMatchRoom: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const [searchParams] = useSearchParams();
    const [engineConfig, setEngineConfig] = useState<GameImplementation['engineConfig'] | null>(null);
    const [runtimeAdapter, setRuntimeAdapter] = useState<GameImplementation['runtimeAdapter'] | null>(null);
    const [WrappedBoard, setWrappedBoard] = useState<React.ComponentType<GameBoardProps<unknown>> | null>(null);
    const [loading, setLoading] = useState(true);
    const { t, i18n } = useTranslation('lobby');
    const toast = useToast();
    const {
        isGameNamespaceReady,
        gameNamespaceError,
        retryGameNamespaceLoad,
    } = useGameNamespaceReady(gameId, i18n);

    const gameConfig = gameId ? getGameById(gameId) : null;
    const gameDisplayName = resolveGameDisplayName(gameConfig, t, gameId ?? '');
    const fixedTestPlayerId = searchParams.get('playerID');
    const shouldFollowCurrentTurnPlayer = !fixedTestPlayerId;
    const shouldKeepBoardMountedOnTurnFollow = shouldKeepBoardMountedOnPlayerViewChange(gameConfig)
        && shouldFollowCurrentTurnPlayer;
    const gamePageDataAttributes = useMemo(
        () => getGamePageDataAttributes(gameId, gameConfig),
        [gameConfig, gameId],
    );
    const gameHudRuntimeProps = useMemo(
        () => buildGameHudRuntimeProps({ gameId, gameConfig }),
        [gameConfig, gameId],
    );

    useEffect(() => syncGamePageDocumentAttributes(gamePageDataAttributes), [gamePageDataAttributes]);

    const handleCommandRejected = useCallback((commandType: string, error: string) => {
        if (!gameId || TUTORIAL_SILENT_ERRORS.has(error)) return;
        if (isUiHintOnlyError(error, i18n, gameId)) return;

        playDeniedSound();
        if (typeof window !== 'undefined') {
            (window as Window & {
                __BG_LAST_COMMAND_REJECTED__?: { gameId: string; error: string; commandType: string };
            }).__BG_LAST_COMMAND_REJECTED__ = { gameId, error, commandType };
        }

        toast.warning(resolveCommandError(i18n, error, gameId), undefined, {
            dedupeKey: `test.rejected.${error}`,
        });
    }, [gameId, i18n, toast]);

    // 闂佽崵鍠愰悷杈╁緤妤ｅ啯鍊?URL 闂備礁鎲￠悷銉╁磹瑜版帒姹?
    const testConfig = useMemo(() => {
        const p0Factions = searchParams.get('p0')?.split(',') || [];
        const p1Factions = searchParams.get('p1')?.split(',') || [];
        const seed = searchParams.get('seed') || '12345';
        const requestedPlayers = searchParams.get('players') ?? searchParams.get('numPlayers');
        const manifestLocalSetup = resolveManifestLocalSetup({
            gameManifest: gameConfig ?? undefined,
            searchParams,
            requestedPlayers,
        });
        const skipFactionSelect = searchParams.get('skipFactionSelect') === 'true';
        const skipInitialization = searchParams.get('skipInitialization') === 'true';
        const playerId = searchParams.get('playerID') || '0';
        const disableLocalAiAutomation = searchParams.get('disableLocalAiAutomation') === 'true';
        const runtimeLocalSetup = runtimeAdapter?.resolveLocalSetup?.({
            searchParams,
            tutorialId: searchParams.get('tutorialSetup') ?? undefined,
        }) ?? null;
        const resolvedNumPlayers = runtimeLocalSetup?.numPlayers ?? manifestLocalSetup.numPlayers;
        const seatControllers = resolveSeatControllersFromSearchParams({
            numPlayers: resolvedNumPlayers,
            searchParams,
            aiSupport: gameConfig?.ai,
        });
        const playerNames = resolveTestPlayerNames(searchParams, resolvedNumPlayers);
        const setupData = resolveRuntimeLocalSetupData(runtimeLocalSetup)
            ?? manifestLocalSetup.setupData;
        
        return {
            player0Factions: p0Factions,
            player1Factions: p1Factions,
            randomSeed: seed,
            numPlayers: resolvedNumPlayers,
            skipFactionSelect,
            skipInitialization,
            playerId,
            seatControllers,
            playerNames,
            setupData,
            disableLocalAiAutomation,
        };
    }, [gameConfig, runtimeAdapter, searchParams]);

    useEffect(() => {
        if (!gameId) return;

        const loadGame = async () => {
            try {
                setLoading(true);
                setEngineConfig(null);
                setRuntimeAdapter(null);
                setWrappedBoard(null);
                await loadGameImplementation(gameId);
                const impl = getGameImplementation(gameId);

                if (!impl) {
                    console.error(`[TestMatchRoom] 婵犵數鍋為幐鎼佸箟閿熺姴鍨傛繛鍡樺灍閸嬫捇宕烽鐐版埛濡ょ姷鍋涘ú顓烆嚕閻㈠壊鏁傞柛娑卞弾濡喖姊? ${gameId}`);
                    return;
                }

                setEngineConfig(impl.engineConfig);
                setRuntimeAdapter(impl.runtimeAdapter ?? null);
                setWrappedBoard(() => impl.board as unknown as React.ComponentType<GameBoardProps<unknown>>);
            } catch (error) {
                console.error(`[TestMatchRoom] 闂備礁鎲″缁樻叏閹灐褰掑炊瑜嬮埀顒佸浮瀹曘劍绻濋崒婊€绨藉┑鐘灪閸庤偐鍒掗崜褎鍠?`, error);
                console.error(`[TestMatchRoom] 闂傚倷鐒︾€笛囨偡閵娾晩鏁嬮柕鍫濐槸闁卞洭鏌涢埄鍐剧劷闁?`, (error as Error).stack);
            } finally {
                setLoading(false);
            }
        };

        loadGame();
    }, [gameId]);

    // 婵犵數鍋涢ˇ顓㈠礉瀹€鍕煑闁糕剝顦洪崷顓涘亾閿濆骸骞樻俊鍙夋倐濮婃椽寮剁捄銊愩倝鏌ｉ妶鍛棦鐎?window闂備焦瀵х粙鎴︽偋閸涱垱顐?TestHarness 濠电偠鎻紞鈧繛澶嬫礋瀵偊濡舵径瀣珫?
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const holder = window as Window & { __BG_TEST_CONFIG__?: typeof testConfig };
        holder.__BG_TEST_CONFIG__ = testConfig;
        return () => {
            holder.__BG_TEST_CONFIG__ = undefined;
        };
    }, [testConfig]);

    // 自动执行游戏声明的本地测试 setup 命令（URL 预设）
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const createLocalTestSetupCommands = engineConfig?.createLocalTestSetupCommands;
        if (loading || !createLocalTestSetupCommands || !WrappedBoard) return;
        
        const runLocalTestSetupCommands = async () => {
            const harness = window.__BG_TEST_HARNESS__;
            if (!harness || !harness.command.isRegistered()) {
                return;
            }
            
            const state = harness.state.get();
            if (!state) {
                return;
            }

            const commands = createLocalTestSetupCommands({ testConfig, state });
            for (const command of commands) {
                await harness.command.dispatch(command);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        };
        
        // 闁诲海鍋ｉ崐鏍磿閼测晜宕叉繝濠傜墕缁犮儳鎲搁幋锔衡偓渚€骞嬮敂鑺ユ珫閻庡厜鍋撻柍褜鍓熼崹鎯熼懡銈傛敵?LocalGameProvider 闁诲氦顫夐悺鏇犱焊濞嗘垵鍨濋柍銉︽灱閺嬫牠鏌曟繛鍨姎闁哄倵鍋?TestHarness
        const timer = setTimeout(runLocalTestSetupCommands, 1000);
        
        return () => clearTimeout(timer);
    }, [testConfig, loading, engineConfig, WrappedBoard]);

    if (!gameId || !gameConfig) {
        return (
            <div className="w-full h-full flex items-center justify-center text-white/50">
                {t('testMatchRoom.gameConfigMissing', { defaultValue: '未找到游戏配置' })}
            </div>
        );
    }

    if (gameNamespaceError) {
        return (
            <GameNamespaceLoadError
                gameId={gameId}
                error={gameNamespaceError}
                onRetry={retryGameNamespaceLoad}
            />
        );
    }

    if (!isGameNamespaceReady) {
        return <LoadingScreen description={t('matchRoom.preparingMatch')} progressText={t('matchRoom.loadingProgress.loadingGameModule')} />;
    }

    if (loading) {
        return (
            <LoadingScreen
                title={gameConfig
                    ? t('testMatchRoom.loadingWithGame', { game: gameDisplayName, defaultValue: '正在加载 {{game}}...' })
                    : t('testMatchRoom.loadingFallback', { defaultValue: '正在加载...' })}
            />
        );
    }

    if (!engineConfig || !WrappedBoard) {
        return (
            <div className="w-full h-full flex items-center justify-center text-white/50">
                {t('testMatchRoom.gameLoadFailed', { defaultValue: '游戏加载失败' })}
            </div>
        );
    }

    return (
        <>
            <SEO
                title={`${gameDisplayName} - \u6d4b\u8bd5\u6a21\u5f0f`}
                description={`${gameDisplayName} E2E \u6d4b\u8bd5\u6a21\u5f0f`}
                noIndex
            />
            <div
                className="relative w-full game-page-viewport overflow-hidden font-sans"
                {...gamePageDataAttributes}
                style={{
                    background: gameConfig.theme?.background || 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                } as React.CSSProperties}
            >
                <GamePageRuntimeProvider gameId={gameId}>
                    <GameModeProvider mode="test">
                        <GameCursorProvider themeId={gameConfig?.cursorTheme} gameId={gameId}>
                            <MobileBoardShell>
                                {engineConfig && WrappedBoard ? (
                                    <LocalGameProvider
                                        config={engineConfig}
                                        numPlayers={testConfig.numPlayers}
                                        seed={testConfig.randomSeed}
                                        playerId={testConfig.playerId}
                                        setupData={testConfig.setupData}
                                        onCommandRejected={handleCommandRejected}
                                        seatControllers={testConfig.seatControllers}
                                        playerNames={testConfig.playerNames}
                                        followCurrentTurnPlayer={shouldFollowCurrentTurnPlayer}
                                        disableLocalAiAutomation={testConfig.disableLocalAiAutomation}
                                    >
                                        <GameHUD gameId={gameId} mode="test" {...gameHudRuntimeProps} />
                                        <BoardBridge
                                            board={WrappedBoard}
                                            remountKey={shouldKeepBoardMountedOnTurnFollow ? false : undefined}
                                            loading={(
                                                <LoadingScreen
                                                    anchor="container"
                                                    title={gameConfig
                                                        ? t('testMatchRoom.loadingWithGame', { game: gameDisplayName, defaultValue: '正在加载 {{game}}...' })
                                                        : t('testMatchRoom.loadingFallback', { defaultValue: '正在加载...' })}
                                                />
                                            )}
                                        />
                                    </LocalGameProvider>
                                ) : (
                                    <LoadingScreen
                                        anchor="container"
                                        title={gameConfig
                                            ? t('testMatchRoom.loadingWithGame', { game: gameDisplayName, defaultValue: '正在加载 {{game}}...' })
                                            : t('testMatchRoom.loadingFallback', { defaultValue: '正在加载...' })}
                                    />
                                )}
                            </MobileBoardShell>
                        </GameCursorProvider>
                    </GameModeProvider>
                </GamePageRuntimeProvider>
            </div>
        </>
    );
};
