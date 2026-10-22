import {render, screen, fireEvent} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {createReplayAdapter} from '../../../../engine/adapter';
import {FateDominationDomain} from '../../domain';
import {FateMapSurface} from '../FateMapSurface';
const cameraProps = vi.hoisted(() => vi.fn());
const resizeLifecycle = vi.hoisted(() => ({ created: 0, observed: 0, disconnected: 0 }));
vi.mock('../../../../engine/mapRenderer', () => ({PixiMapSceneHost: (props: unknown) => { cameraProps(props); return <div data-testid="pixi-camera"/>; }}));
vi.mock('../../../../core/AssetLoader', () => ({getRuntimeImageCandidateUrls: (asset: string) => [asset]}));
vi.mock('../../../../components/common/media/OptimizedImage', () => ({OptimizedImage: ({src,alt}: {src:string;alt:string}) => <img src={src} alt={alt}/>}));
vi.stubGlobal('ResizeObserver', class {constructor(){resizeLifecycle.created++;} observe(){resizeLifecycle.observed++;} disconnect(){resizeLifecycle.disconnected++;}});
it('按中文规则准备牌堆：事件牌库暗置于板面B1 Objectives，检视不泄露牌库正面', () => {
 const core=createReplayAdapter(FateDominationDomain,'map-slots').setup(['0','1','2']).core;
 const inspect=vi.fn();
 render(<FateMapSurface core={core} locale="zh-CN" legalLocations={[]} onLocation={vi.fn()} onInspect={inspect}/>);
 const deck=screen.getByRole('button',{name:/检视事件牌库/});
 // CHM 准备牌堆：事件暗置 B1；棋盘合同：B1 为左列第二行 Objectives。
 expect(deck.style.left).toBe('130px');expect(deck.style.top).toBe('430px');
 expect(document.querySelector<HTMLElement>('.fd-event-deck-count:not(.fd-situation-deck-count)')?.style.top).toBe('704px');
 fireEvent.click(deck);expect(inspect).toHaveBeenCalledWith('fate-domination/events/back',expect.stringContaining('事件牌库'));
 const situation=screen.getByRole('button',{name:`检视${core.situation.name}`});expect(situation.style.left).toBe('418px');expect(situation.style.top).toBe('50px');
 const situationDeck=screen.getByRole('button',{name:/检视局势牌库/});expect(situationDeck.style.left).toBe('130px');expect(situationDeck.style.top).toBe('50px');
});
it('本人棋子直接选择移动，合法地点按钮直接提交目的地', () => {
 const core=createReplayAdapter(FateDominationDomain,'map-pawn').setup(['0','1','2']).core;
 core.battlefield.miyama.playerIds=['0','1'];core.players['0'].locationId='miyama';core.players['1'].locationId='miyama';
 const onPawn=vi.fn(), onLocation=vi.fn();
 render(<FateMapSurface core={core} locale="zh-CN" movablePlayerId="0" moving legalLocations={['shinto']} onPawn={onPawn} onLocation={onLocation} onInspect={vi.fn()}/>);
 const pawn=screen.getByRole('button',{name:/玩家1位于/});fireEvent.click(pawn);expect(onPawn).toHaveBeenCalledOnce();expect(pawn.getAttribute('aria-pressed')).toBe('true');
 expect(screen.getByRole('button',{name:/玩家2位于/}).hasAttribute('disabled')).toBe(true);
 fireEvent.click(screen.getByTestId('fate-domination-location-shinto'));expect(onLocation).toHaveBeenCalledExactlyOnceWith('shinto');
});

it('地图上的可访问对象与画布共用一个输入面，拖动阈值由共享相机处理', () => {
 const core=createReplayAdapter(FateDominationDomain,'map-input-surface').setup(['0','1','2']).core;
 const {container}=render(<FateMapSurface core={core} locale="zh-CN" legalLocations={['miyama']} onLocation={vi.fn()} onInspect={vi.fn()}/>);
 const latest=cameraProps.mock.lastCall?.[0];
 expect(latest.inputElement).toBe(container.querySelector('.fd-runtime-map'));
 expect(latest.inputElement.contains(screen.getByTestId('fate-domination-location-miyama'))).toBe(true);
 expect(latest.regionSelectionEnabled).toBe(false);
});

it('未开始移动时常规入口覆盖印刷费用箭头，选目标时移除入口并显示目标选中态',()=>{
 const core=createReplayAdapter(FateDominationDomain,'movement-print-target').setup(['0','1','2']).core;
 const onPawn=vi.fn();const props={core,locale:'zh-CN',legalLocations:[] as const,onLocation:vi.fn(),onInspect:vi.fn(),onPawn,movementOrigin:'workshop' as const};
 const view=render(<FateMapSurface {...props}/>);
 const exit=screen.getByRole('button',{name:'从魔术工房开始常规移动'});
 expect([exit.style.left,exit.style.top,exit.style.width,exit.style.height]).toEqual(['1216px','318px','199px','51px']);
 fireEvent.click(exit);expect(onPawn).toHaveBeenCalledOnce();
 view.rerender(<FateMapSurface {...props} moving legalLocations={['miyama']} selectedLocation="miyama"/>);
 expect(screen.queryByRole('button',{name:'从魔术工房开始常规移动'})).toBeNull();
 expect(screen.getByTestId('fate-domination-location-miyama').getAttribute('aria-pressed')).toBe('true');
});

it('HUD交互状态变化不会重建地图观察或读取HUD安全边距',()=>{
 const core=createReplayAdapter(FateDominationDomain,'map-independent-camera').setup(['0','1','2']).core;
 resizeLifecycle.created=0;resizeLifecycle.observed=0;resizeLifecycle.disconnected=0;
 const props={core,locale:'zh-CN',legalLocations:[] as const,onLocation:vi.fn(),onInspect:vi.fn()};
 const view=render(<div data-riding-choice="false" style={{'--fd-map-safe-bottom':'380px'} as React.CSSProperties}><FateMapSurface {...props}/></div>);
 expect(resizeLifecycle.created).toBe(1);
 expect(resizeLifecycle.observed).toBe(1);
 view.rerender(<div data-riding-choice="true" style={{'--fd-map-safe-bottom':'420px'} as React.CSSProperties}><FateMapSurface {...props}/></div>);
 expect(resizeLifecycle.created).toBe(1);
 expect(resizeLifecycle.observed).toBe(1);
 expect(resizeLifecycle.disconnected).toBe(0);
});
