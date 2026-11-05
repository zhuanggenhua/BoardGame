import { render } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { FateTutorialUiBridge } from '../ui/FateTutorialUiBridge';

const tutorial = vi.hoisted(() => ({ currentStep: { id: 'ui-detail-1' } as {id:string;fateUiDetailTarget?:string;fateUiInspectionSource?:'hand'}, nextStep: vi.fn() }));
vi.mock('../../../contexts/TutorialContext', () => ({ useTutorial: () => tutorial }));
const initial = { detail: null as string | null, viewerId: '0', inspection: false, inspectionSource: null as import('../ui/FateTutorialUiBridge').FateInspectionSource | null, publicCards: false, pile: null as 'deck' | 'discard' | null, discardCount: 0, seal: false, movement: false, movementTarget: false, rollbackRevision: 0 };
beforeEach(() => { tutorial.currentStep = { id: 'ui-detail-1', fateUiDetailTarget: undefined }; tutorial.nextStep.mockClear(); });
it('首次读攻击卡须实际检视手牌来源，地图检视不能代做',()=>{
    tutorial.currentStep={id:'ui-inspection-1',fateUiInspectionSource:'hand'};
    const view=render(<FateTutorialUiBridge {...initial}/>);
    view.rerender(<FateTutorialUiBridge {...initial} inspection inspectionSource="map"/>);
    view.rerender(<FateTutorialUiBridge {...initial}/>);
    expect(tutorial.nextStep).not.toHaveBeenCalled();
    view.rerender(<FateTutorialUiBridge {...initial} inspection inspectionSource="hand"/>);
    view.rerender(<FateTutorialUiBridge {...initial}/>);
    expect(tutorial.nextStep).toHaveBeenCalledExactlyOnceWith('auto');
});
it('指定玩家课程可直接打开该席，不强迫先重复打开本人详情',()=>{
    tutorial.currentStep={id:'ui-detail-5',fateUiDetailTarget:'2'};
    const view=render(<FateTutorialUiBridge {...initial}/>);
    view.rerender(<FateTutorialUiBridge {...initial} detail="2" inspection inspectionSource="detail"/>);
    view.rerender(<FateTutorialUiBridge {...initial}/>);
    expect(tutorial.nextStep).toHaveBeenCalledOnce();
});

it('详情必须本人、对手切换与嵌套检视，单纯开关不能完成课程', () => {
    const view = render(<FateTutorialUiBridge {...initial}/>);
    view.rerender(<FateTutorialUiBridge {...initial} detail="0"/>);
    view.rerender(<FateTutorialUiBridge {...initial}/>);
    expect(tutorial.nextStep).not.toHaveBeenCalled();
    view.rerender(<FateTutorialUiBridge {...initial} detail="0" inspection inspectionSource="detail"/>);
    view.rerender(<FateTutorialUiBridge {...initial} detail="1"/>);
    view.rerender(<FateTutorialUiBridge {...initial}/>);
    expect(tutorial.nextStep).toHaveBeenCalledExactlyOnceWith('auto');
});

it('查看弃牌不强迫重做已学检视，牌堆不能代做；恢复后必须重新打开当前弃牌', () => {
    tutorial.currentStep = { id: 'ui-pile-2', fateUiDetailTarget: undefined };
    const props = { ...initial, discardCount: 3 };
    const view = render(<FateTutorialUiBridge {...props}/>);
    view.rerender(<FateTutorialUiBridge {...props} pile="deck"/>);
    view.rerender(<FateTutorialUiBridge {...props}/>);
    expect(tutorial.nextStep).not.toHaveBeenCalled();
    view.rerender(<FateTutorialUiBridge {...props} pile="discard"/>);
    view.rerender(<FateTutorialUiBridge {...props} rollbackRevision={1}/>);
    expect(tutorial.nextStep).not.toHaveBeenCalled();
    view.rerender(<FateTutorialUiBridge {...props} rollbackRevision={1} pile="discard"/>);
    view.rerender(<FateTutorialUiBridge {...props} rollbackRevision={1}/>);
    expect(tutorial.nextStep).toHaveBeenCalledOnce();
});

it('移动教学须先选目标再取消，只进入再退出不能越过中间选择', () => {
    tutorial.currentStep = { id: 'ui-movement-3', fateUiDetailTarget: undefined };
    const view = render(<FateTutorialUiBridge {...initial}/>);
    view.rerender(<FateTutorialUiBridge {...initial} movement/>);
    view.rerender(<FateTutorialUiBridge {...initial}/>);
    expect(tutorial.nextStep).not.toHaveBeenCalled();
    view.rerender(<FateTutorialUiBridge {...initial} movement movementTarget/>);
    view.rerender(<FateTutorialUiBridge {...initial}/>);
    expect(tutorial.nextStep).toHaveBeenCalledOnce();
});

it('公开牌教学要求真正展开牌排，读过卡后不再强迫重复放大', () => {
    tutorial.currentStep = { id: 'ui-public-cards-4', fateUiDetailTarget: undefined };
    const view = render(<FateTutorialUiBridge {...initial}/>);
    view.rerender(<FateTutorialUiBridge {...initial} inspection inspectionSource="map"/>);
    view.rerender(<FateTutorialUiBridge {...initial}/>);
    expect(tutorial.nextStep).not.toHaveBeenCalled();
    view.rerender(<FateTutorialUiBridge {...initial} publicCards/>);
    view.rerender(<FateTutorialUiBridge {...initial}/>);
    expect(tutorial.nextStep).toHaveBeenCalledOnce();
});

it('已揭示对手教学必须切到指定席并检视该席，其他对手与本人检视不能代替',()=>{
    tutorial.currentStep={id:'ui-detail-5',fateUiDetailTarget:'2'};
    const view=render(<FateTutorialUiBridge {...initial}/>);
    view.rerender(<FateTutorialUiBridge {...initial} detail="0" inspection inspectionSource="detail"/>);
    view.rerender(<FateTutorialUiBridge {...initial} detail="1" inspection inspectionSource="detail"/>);
    view.rerender(<FateTutorialUiBridge {...initial}/>);
    expect(tutorial.nextStep).not.toHaveBeenCalled();
    view.rerender(<FateTutorialUiBridge {...initial} detail="2"/>);
    view.rerender(<FateTutorialUiBridge {...initial}/>);
    expect(tutorial.nextStep).not.toHaveBeenCalled();
    view.rerender(<FateTutorialUiBridge {...initial} detail="2" inspection inspectionSource="detail"/>);
    view.rerender(<FateTutorialUiBridge {...initial}/>);
    expect(tutorial.nextStep).toHaveBeenCalledOnce();
});
