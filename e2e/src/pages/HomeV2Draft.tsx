import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOptimizedImageUrls } from '../core/AssetLoader';
import { HomeSceneRenderer, type HomeV2SceneState } from '../ugc/runtime';
import { getAllGames, getGameById } from '../config/games.config';
import { LobbyDirectory } from '../components/home-v2/LobbyDirectory';
import { GameDetails } from '../components/home-v2/GameDetails';
import { useAuth } from '../contexts/AuthContext';
import compiledHomeV2Scene from '../ui-scenes/home-v2/home-v2.compiled.json';
import assetRegistryYamlRaw from '../ui-scenes/home-v2/asset-registry.yaml?raw';
import homeV2SceneYamlRaw from '../ui-scenes/home-v2/home-v2.ui.yaml?raw';
import homeV2SkinYamlRaw from '../ui-scenes/home-v2/home-v2.skin.yaml?raw';
import homeV2AuthoringMetaYamlRaw from '../ui-scenes/home-v2/home-v2.authoring.yaml?raw';
import {
    AssetLibraryPanel,
    ComponentLibraryPanel,
    CompiledSceneRenderer,
    createNodeTemplate,
    EditorHeaderBar,
    findCompiledNodeById,
    findNodeById,
    getAuthoringNodeName,
    HierarchyPanel,
    InspectorPanel,
    InPageAuthoringOverlay,
    isContainerNode,
    isFlowContainerNode,
    moveSceneNode,
    removeSceneNodes,
    parseAuthoringMetaYaml,
    UISceneCompileError,
    appendChildNode,
    createAuthoringDocument,
    saveUiSceneAuthoring,
    serializeAssetRegistryYaml,
    serializeSceneYaml,
    serializeSkinYaml,
    updateNineSliceSkin,
    updateSceneImageAssetRef,
    updateSceneGridProps,
    updateSceneNodeLayout,
    updateSceneNodeRect,
    updateSceneStackProps,
    YamlSyncPanel,
    type UISceneAuthoringDocument,
    type UISceneCompiledArtifact,
    type UISceneRect,
    type YamlSyncDocumentId,
    type UISceneInsets,
    type UISceneFlowAlign,
    type UISceneNodeMovePosition,
} from '../ui-scene';

const HOME_V2_BOOK_DESK = getOptimizedImageUrls('/assets/common/images/home-v2/book-desk/1.png').webp;
const HOME_V2_COMPILED_SCENE = compiledHomeV2Scene as UISceneCompiledArtifact;
const HOME_V2_SCENE_ID = 'home-v2';
type HomeV2TabId = 'lobby' | 'rooms' | 'leaderboard' | 'changelog' | 'about';
const HOME_V2_OVERVIEW_LEFT_PAGE_CAPACITY = 9;
const LEFT_DRAWER_MIN_WIDTH = 300;
const LEFT_DRAWER_MAX_WIDTH = 520;
const RIGHT_DRAWER_MIN_WIDTH = 320;
const RIGHT_DRAWER_MAX_WIDTH = 560;
const SOURCE_DRAWER_MIN_HEIGHT = 260;
const SOURCE_DRAWER_MAX_HEIGHT = 560;
const AUTHOR_HEADER_HEIGHT = 84;
const AUTHOR_EDGE_GAP = 16;
const AUTHOR_PANEL_GAP = 12;

type DrawerResizeTarget = 'left' | 'right' | 'bottom';
type AuthoringDrafts = {
    assetRegistryYaml: string;
    skinYaml: string;
    sceneYaml: string;
};

type DrawerResizeSession = {
    target: DrawerResizeTarget;
    startClientX: number;
    startClientY: number;
    startSize: number;
};

function HomeV2TabPlaceholder({ title, description }: { title: string; description: string }) {
    return (
        <div className="pointer-events-auto flex h-full w-full flex-col items-center justify-center px-[12%] text-center text-[#6a4a33]">
            <div className="mb-[4%] text-[clamp(18px,1.8vw,24px)] font-bold tracking-[0.08em] text-[#5b3822]">
                {title}
            </div>
            <div className="max-w-[82%] text-[clamp(11px,0.95vw,14px)] leading-[1.7] text-[#7a5d46]">
                {description}
            </div>
        </div>
    );
}

function formatAuthoringError(error: unknown): string {
    if (error instanceof UISceneCompileError) {
        const [firstIssue] = error.issues;
        if (!firstIssue) {
            return error.message;
        }

        return `${firstIssue.file} · ${firstIssue.path} · ${firstIssue.message}`;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'YAML 编译失败';
}

function clampNodeRect(scene: UISceneCompiledArtifact, rect: UISceneRect): UISceneRect {
    const width = Math.max(24, rect.width);
    const height = Math.max(24, rect.height);
    const x = Math.min(Math.max(0, rect.x), scene.artboard.width - width);
    const y = Math.min(Math.max(0, rect.y), scene.artboard.height - height);

    return {
        x,
        y,
        width: Math.min(width, scene.artboard.width - x),
        height: Math.min(height, scene.artboard.height - y),
    };
}

function clampValue(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function normalizeSelection(nodeIds: string[], primaryNodeId?: string | null) {
    const uniqueIds = Array.from(new Set(nodeIds.filter(Boolean)));
    if (!uniqueIds.length) {
        return [];
    }
    if (!primaryNodeId || !uniqueIds.includes(primaryNodeId)) {
        return uniqueIds;
    }
    return [
        primaryNodeId,
        ...uniqueIds.filter((nodeId) => nodeId !== primaryNodeId),
    ];
}

function areDraftsEqual(left: AuthoringDrafts, right: AuthoringDrafts) {
    return left.assetRegistryYaml === right.assetRegistryYaml
        && left.skinYaml === right.skinYaml
        && left.sceneYaml === right.sceneYaml;
}

function buildRectEntriesFromSelection(
    nodeIds: string[],
    sceneDocument: UISceneAuthoringDocument['sceneDocument'],
    compiledScene: UISceneCompiledArtifact,
    previewRects: Record<string, UISceneRect>,
) {
    return nodeIds
        .map((nodeId) => {
            const sourceNode = findNodeById(sceneDocument.scene.root, nodeId);
            const compiledNode = findCompiledNodeById(compiledScene.root, nodeId);
            const rect = previewRects[nodeId] ?? sourceNode?.rect ?? compiledNode?.rect;
            if (!rect) {
                return null;
            }
            return [nodeId, rect] as const;
        })
        .filter((entry): entry is readonly [string, UISceneRect] => Boolean(entry));
}

type SelectionArrangeMode =
    | 'left'
    | 'horizontalCenter'
    | 'right'
    | 'top'
    | 'verticalCenter'
    | 'bottom'
    | 'distributeHorizontal'
    | 'distributeVertical'
    | 'sameWidth'
    | 'sameHeight'
    | 'sameSize';

export interface HomeV2DraftProps {
    authoringMode?: boolean;
}

export const HomeV2Draft = ({ authoringMode = true }: HomeV2DraftProps) => {
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const [sceneState, setSceneState] = React.useState<HomeV2SceneState>('open');
    const [activeTab, setActiveTab] = React.useState<HomeV2TabId>('lobby');
    const [selectedGameId, setSelectedGameId] = React.useState<string | null>(null);
    const pendingGameIdRef = React.useRef<string | null>(null);
    const debugRegions = searchParams.get('homeV2Debug') === '1';
    const isAuthorAllowed = import.meta.env.DEV || user?.role === 'admin' || user?.role === 'developer';
    const isAuthorMode = authoringMode && isAuthorAllowed;
    const [compiledContentScene, setCompiledContentScene] = React.useState<UISceneCompiledArtifact>(HOME_V2_COMPILED_SCENE);
    const [authoringDocument, setAuthoringDocument] = React.useState<UISceneAuthoringDocument | null>(null);
    const [assetRegistryYamlDraft, setAssetRegistryYamlDraft] = React.useState(assetRegistryYamlRaw);
    const [skinYamlDraft, setSkinYamlDraft] = React.useState(homeV2SkinYamlRaw);
    const [sceneYamlDraft, setSceneYamlDraft] = React.useState(homeV2SceneYamlRaw);
    const [undoStack, setUndoStack] = React.useState<AuthoringDrafts[]>([]);
    const [redoStack, setRedoStack] = React.useState<AuthoringDrafts[]>([]);
    const [authoringError, setAuthoringError] = React.useState<string | null>(null);
    const [selectedNodeIds, setSelectedNodeIds] = React.useState<string[]>(['overview_left_page']);
    const [overlayVisible, setOverlayVisible] = React.useState(true);
    const [leftDrawerOpen, setLeftDrawerOpen] = React.useState(false);
    const [inspectorOpen, setInspectorOpen] = React.useState(false);
    const [sourcePanelOpen, setSourcePanelOpen] = React.useState(false);
    const [activeSourceDocument, setActiveSourceDocument] = React.useState<YamlSyncDocumentId>('scene');
    const [isSaving, setIsSaving] = React.useState(false);
    const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
    const [leftTab, setLeftTab] = React.useState<'图层' | '组件' | '资源'>('图层');
    const [previewRects, setPreviewRects] = React.useState<Record<string, UISceneRect>>({});
    const [leftDrawerWidth, setLeftDrawerWidth] = React.useState(320);
    const [inspectorWidth, setInspectorWidth] = React.useState(360);
    const [sourcePanelHeight, setSourcePanelHeight] = React.useState(320);
    const drawerResizeSessionRef = React.useRef<DrawerResizeSession | null>(null);
    const currentDraftsRef = React.useRef<AuthoringDrafts>({
        assetRegistryYaml: assetRegistryYamlRaw,
        skinYaml: homeV2SkinYamlRaw,
        sceneYaml: homeV2SceneYamlRaw,
    });

    const selectedNodeId = selectedNodeIds[0] ?? null;
    const workspacePaddingTop = isAuthorMode ? AUTHOR_HEADER_HEIGHT + AUTHOR_EDGE_GAP : 0;
    const workspacePaddingLeft = isAuthorMode && leftDrawerOpen ? leftDrawerWidth + AUTHOR_EDGE_GAP + AUTHOR_PANEL_GAP : 0;
    const workspacePaddingRight = isAuthorMode && inspectorOpen ? inspectorWidth + AUTHOR_EDGE_GAP + AUTHOR_PANEL_GAP : 0;
    const workspacePaddingBottom = isAuthorMode && sourcePanelOpen ? sourcePanelHeight + AUTHOR_EDGE_GAP + AUTHOR_PANEL_GAP : 0;
    const sourceDrawerLeftInset = AUTHOR_EDGE_GAP + (leftDrawerOpen ? leftDrawerWidth + AUTHOR_PANEL_GAP : 0);
    const sourceDrawerRightInset = AUTHOR_EDGE_GAP + (inspectorOpen ? inspectorWidth + AUTHOR_PANEL_GAP : 0);

    const overviewGames = React.useMemo(
        () => getAllGames().filter((game) => game.enabled && game.type === 'game'),
        [],
    );
    const authoringMeta = React.useMemo(() => parseAuthoringMetaYaml(homeV2AuthoringMetaYamlRaw), []);
    const selectedGame = selectedGameId ? getGameById(selectedGameId) ?? null : null;
    const isPageFlipping = sceneState === 'flippingToDetail' || sceneState === 'flippingToOverview';
    const selectedSourceNode = React.useMemo(
        () => (authoringDocument && selectedNodeId ? findNodeById(authoringDocument.sceneDocument.scene.root, selectedNodeId) : null),
        [authoringDocument, selectedNodeId],
    );
    const selectedParentId = React.useMemo(() => {
        if (!authoringDocument) {
            return 'root';
        }
        if (selectedSourceNode && isContainerNode(selectedSourceNode)) {
            return selectedSourceNode.id;
        }
        return authoringDocument.sceneDocument.scene.root.id;
    }, [authoringDocument, selectedSourceNode]);
    const selectedParentLabel = React.useMemo(
        () => getAuthoringNodeName(authoringMeta, selectedParentId),
        [authoringMeta, selectedParentId],
    );
    const toggleLeftDrawer = React.useCallback((tab: '图层' | '组件' | '资源') => {
        if (leftDrawerOpen && leftTab === tab) {
            setLeftDrawerOpen(false);
            return;
        }
        setLeftTab(tab);
        setLeftDrawerOpen(true);
    }, [leftDrawerOpen, leftTab]);
    const handleSelectNode = React.useCallback((nodeId: string, options?: { additive?: boolean; toggle?: boolean }) => {
        setSelectedNodeIds((current) => {
            if (options?.additive) {
                const exists = current.includes(nodeId);
                if (options.toggle && exists) {
                    return current.filter((id) => id !== nodeId);
                }
                return normalizeSelection([...current, nodeId], nodeId);
            }
            return [nodeId];
        });
        setInspectorOpen(true);
    }, []);
    const handleSelectNodes = React.useCallback((nodeIds: string[], options?: { additive?: boolean; primaryNodeId?: string | null }) => {
        setSelectedNodeIds((current) => {
            if (options?.additive) {
                return normalizeSelection([...current, ...nodeIds], options.primaryNodeId ?? current[0] ?? nodeIds[0] ?? null);
            }
            return normalizeSelection(nodeIds, options?.primaryNodeId ?? nodeIds[0] ?? null);
        });
        if (nodeIds.length > 0 || options?.additive) {
            setInspectorOpen(true);
        }
    }, []);
    const handlePromoteSelectionPrimary = React.useCallback((nodeId: string) => {
        setSelectedNodeIds((current) => {
            if (!current.includes(nodeId)) {
                return current;
            }
            return normalizeSelection(current, nodeId);
        });
        setInspectorOpen(true);
    }, []);

    const handleGameOpen = React.useCallback((gameId: string) => {
        if (sceneState !== 'overview' || isPageFlipping) {
            return;
        }

        pendingGameIdRef.current = gameId;
        setSceneState('flippingToDetail');
    }, [isPageFlipping, sceneState]);

    const handleBackToOverview = React.useCallback(() => {
        if (sceneState !== 'detail' || isPageFlipping || !selectedGameId) {
            return;
        }

        pendingGameIdRef.current = null;
        setSceneState('flippingToOverview');
    }, [isPageFlipping, sceneState, selectedGameId]);

    const handleSceneEvent = React.useCallback((event: { eventId: string }) => {
        if (event.eventId === 'page.flip.to-detail.complete') {
            setSelectedGameId(pendingGameIdRef.current);
            setSceneState('detail');
            return;
        }

        if (event.eventId === 'page.flip.to-overview.complete') {
            setSelectedGameId(null);
            setSceneState('overview');
        }
    }, []);

    const handleTabChange = React.useCallback((tabId: HomeV2TabId) => {
        setActiveTab(tabId);
        if (sceneState === 'detail') {
            setSelectedGameId(null);
            setSceneState('overview');
        }
    }, [sceneState]);

    const buildAuthoringDocument = React.useCallback((drafts: {
        assetRegistryYaml: string;
        skinYaml: string;
        sceneYaml: string;
    }) => createAuthoringDocument({
        sceneId: HOME_V2_SCENE_ID,
        assetRegistryFile: 'src/ui-scenes/home-v2/asset-registry.yaml',
        assetRegistryYaml: drafts.assetRegistryYaml,
        skinFile: 'src/ui-scenes/home-v2/home-v2.skin.yaml',
        skinYaml: drafts.skinYaml,
        sceneFile: 'src/ui-scenes/home-v2/home-v2.ui.yaml',
        sceneYaml: drafts.sceneYaml,
    }), []);

    const applyAuthoringDrafts = React.useCallback((drafts: AuthoringDrafts, options?: {
        recordHistory?: boolean;
        clearRedo?: boolean;
    }) => {
        const previousDrafts = currentDraftsRef.current;
        const changed = !areDraftsEqual(previousDrafts, drafts);
        if (changed && options?.recordHistory !== false) {
            setUndoStack((current) => [...current.slice(-39), previousDrafts]);
        }
        if (changed && options?.clearRedo !== false) {
            setRedoStack([]);
        }

        currentDraftsRef.current = drafts;
        setAssetRegistryYamlDraft(drafts.assetRegistryYaml);
        setSkinYamlDraft(drafts.skinYaml);
        setSceneYamlDraft(drafts.sceneYaml);
        setSaveMessage(null);
        try {
            const nextDocument = buildAuthoringDocument(drafts);
            setAuthoringDocument(nextDocument);
            setCompiledContentScene(nextDocument.compiled);
            setAuthoringError(null);
            setPreviewRects({});
        } catch (error) {
            setAuthoringError(formatAuthoringError(error));
        }
    }, [buildAuthoringDocument]);

    React.useEffect(() => {
        if (!isAuthorMode) {
            setCompiledContentScene(HOME_V2_COMPILED_SCENE);
            setAuthoringDocument(null);
            setAuthoringError(null);
            return;
        }

        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlRaw,
            skinYaml: homeV2SkinYamlRaw,
            sceneYaml: homeV2SceneYamlRaw,
        }, {
            recordHistory: false,
        });
        setUndoStack([]);
        setRedoStack([]);
    }, [applyAuthoringDrafts, isAuthorMode]);

    React.useEffect(() => {
        if (!isAuthorMode || !authoringDocument) {
            return;
        }

        setSelectedNodeIds((current) => current.filter((nodeId) => Boolean(findNodeById(authoringDocument.sceneDocument.scene.root, nodeId))));
    }, [authoringDocument, isAuthorMode]);

    React.useEffect(() => {
        const handleResizeMove = (clientX: number, clientY: number) => {
            const session = drawerResizeSessionRef.current;
            if (!session) {
                return;
            }

            if (session.target === 'left') {
                setLeftDrawerWidth(clampValue(
                    session.startSize + (clientX - session.startClientX),
                    LEFT_DRAWER_MIN_WIDTH,
                    LEFT_DRAWER_MAX_WIDTH,
                ));
                return;
            }

            if (session.target === 'right') {
                setInspectorWidth(clampValue(
                    session.startSize + (session.startClientX - clientX),
                    RIGHT_DRAWER_MIN_WIDTH,
                    RIGHT_DRAWER_MAX_WIDTH,
                ));
                return;
            }

            setSourcePanelHeight(clampValue(
                session.startSize + (session.startClientY - clientY),
                SOURCE_DRAWER_MIN_HEIGHT,
                SOURCE_DRAWER_MAX_HEIGHT,
            ));
        };

        const handlePointerMove = (event: PointerEvent) => {
            handleResizeMove(event.clientX, event.clientY);
        };

        const handleMouseMove = (event: MouseEvent) => {
            handleResizeMove(event.clientX, event.clientY);
        };

        const handlePointerUp = () => {
            drawerResizeSessionRef.current = null;
        };

        const handleMouseUp = () => {
            drawerResizeSessionRef.current = null;
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleNodeRectChange = React.useCallback((nodeId: string, rect: UISceneRect) => {
        if (!authoringDocument) {
            return;
        }

        const nextSceneDocument = updateSceneNodeRect(
            authoringDocument.sceneDocument,
            compiledContentScene,
            nodeId,
            () => clampNodeRect(compiledContentScene, rect),
        );
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, compiledContentScene, skinYamlDraft]);

    const handlePreviewRectsChange = React.useCallback((nextPreviewRects: Record<string, UISceneRect>) => {
        setPreviewRects(nextPreviewRects);
    }, []);

    const handleNodeRectsCommit = React.useCallback((rects: Record<string, UISceneRect>) => {
        if (!authoringDocument) {
            return;
        }

        let nextSceneDocument = authoringDocument.sceneDocument;
        Object.entries(rects).forEach(([nodeId, rect]) => {
            nextSceneDocument = updateSceneNodeRect(
                nextSceneDocument,
                compiledContentScene,
                nodeId,
                () => clampNodeRect(compiledContentScene, rect),
            );
        });

        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, compiledContentScene, skinYamlDraft]);

    const handleNodeLayoutChange = React.useCallback((nodeId: string, layout: {
        width?: number;
        height?: number;
        grow?: number;
        shrink?: number;
        alignSelf?: UISceneFlowAlign;
        justifySelf?: UISceneFlowAlign;
    }) => {
        if (!authoringDocument) {
            return;
        }

        const nextSceneDocument = updateSceneNodeLayout(authoringDocument.sceneDocument, nodeId, () => ({
            width: layout.width,
            height: layout.height,
            grow: layout.grow,
            shrink: layout.shrink,
            alignSelf: layout.alignSelf,
            justifySelf: layout.justifySelf,
        }));
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, skinYamlDraft]);

    const handleStackDirectionChange = React.useCallback((nodeId: string, direction: 'absolute' | 'horizontal' | 'vertical') => {
        if (!authoringDocument) {
            return;
        }

        const nextSceneDocument = updateSceneStackProps(authoringDocument.sceneDocument, nodeId, (node) => ({
            ...node,
            direction,
        }));
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, skinYamlDraft]);

    const handleStackGapChange = React.useCallback((nodeId: string, gap: number) => {
        if (!authoringDocument) {
            return;
        }

        const nextSceneDocument = updateSceneStackProps(authoringDocument.sceneDocument, nodeId, (node) => ({
            ...node,
            gap,
        }));
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, skinYamlDraft]);

    const handleGridGapChange = React.useCallback((nodeId: string, gap: number) => {
        if (!authoringDocument) {
            return;
        }

        const nextSceneDocument = updateSceneGridProps(authoringDocument.sceneDocument, nodeId, (node) => ({
            ...node,
            gap,
        }));
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, skinYamlDraft]);

    const handleGridColumnsChange = React.useCallback((nodeId: string, columns: number) => {
        if (!authoringDocument) {
            return;
        }

        const nextSceneDocument = updateSceneGridProps(authoringDocument.sceneDocument, nodeId, (node) => ({
            ...node,
            columns: Math.max(1, Math.round(columns)),
        }));
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, skinYamlDraft]);

    const handleGridRowsChange = React.useCallback((nodeId: string, rows: number) => {
        if (!authoringDocument) {
            return;
        }

        const nextSceneDocument = updateSceneGridProps(authoringDocument.sceneDocument, nodeId, (node) => ({
            ...node,
            rows: rows <= 0 ? undefined : Math.max(1, Math.round(rows)),
        }));
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, skinYamlDraft]);

    const handleContainerAlignChange = React.useCallback((nodeId: string, align?: string) => {
        if (!authoringDocument) {
            return;
        }

        const nextSceneDocument = updateSceneStackProps(
            updateSceneGridProps(authoringDocument.sceneDocument, nodeId, (node) => ({ ...node, align })),
            nodeId,
            (node) => ({ ...node, align }),
        );
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, skinYamlDraft]);

    const handleContainerJustifyChange = React.useCallback((nodeId: string, justify?: string) => {
        if (!authoringDocument) {
            return;
        }

        const nextSceneDocument = updateSceneStackProps(
            updateSceneGridProps(authoringDocument.sceneDocument, nodeId, (node) => ({ ...node, justify })),
            nodeId,
            (node) => ({ ...node, justify }),
        );
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, skinYamlDraft]);

    const handleContainerPaddingChange = React.useCallback((nodeId: string, padding: UISceneInsets) => {
        if (!authoringDocument) {
            return;
        }

        const nextSceneDocument = updateSceneStackProps(
            updateSceneGridProps(authoringDocument.sceneDocument, nodeId, (node) => ({ ...node, padding })),
            nodeId,
            (node) => ({ ...node, padding }),
        );
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, skinYamlDraft]);

    const handleContainerClipChange = React.useCallback((nodeId: string, clipContent: boolean) => {
        if (!authoringDocument) {
            return;
        }

        const nextSceneDocument = updateSceneStackProps(
            updateSceneGridProps(authoringDocument.sceneDocument, nodeId, (node) => ({ ...node, clipContent })),
            nodeId,
            (node) => ({ ...node, clipContent }),
        );
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, skinYamlDraft]);

    const handleNineSliceSliceChange = React.useCallback((nodeId: string, slice: UISceneInsets) => {
        if (!authoringDocument) {
            return;
        }

        const node = selectedNodeId === nodeId ? selectedSourceNode : findNodeById(authoringDocument.sceneDocument.scene.root, nodeId);
        if (!node?.skin) {
            return;
        }

        const nextSkinCollection = updateNineSliceSkin(authoringDocument.skinCollection, node.skin, (skin) => ({
            ...skin,
            slice,
        }));
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: serializeSkinYaml(nextSkinCollection),
            sceneYaml: sceneYamlDraft,
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, sceneYamlDraft, selectedNodeId, selectedSourceNode]);

    const handleNineSliceContentPaddingChange = React.useCallback((nodeId: string, padding: UISceneInsets) => {
        if (!authoringDocument) {
            return;
        }

        const node = selectedNodeId === nodeId ? selectedSourceNode : findNodeById(authoringDocument.sceneDocument.scene.root, nodeId);
        if (!node?.skin) {
            return;
        }

        const nextSkinCollection = updateNineSliceSkin(authoringDocument.skinCollection, node.skin, (skin) => ({
            ...skin,
            contentPadding: padding,
        }));
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: serializeSkinYaml(nextSkinCollection),
            sceneYaml: sceneYamlDraft,
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, sceneYamlDraft, selectedNodeId, selectedSourceNode]);

    const handleInsertTemplate = React.useCallback((kind: 'panel' | 'stack-vertical' | 'stack-horizontal' | 'grid' | 'text' | 'button' | 'image') => {
        if (!authoringDocument) {
            return;
        }

        const parentNode = findNodeById(authoringDocument.sceneDocument.scene.root, selectedParentId);
        const templateNode = createNodeTemplate(kind, {
            flowChild: Boolean(parentNode && isFlowContainerNode(parentNode)),
        });
        const nextSceneDocument = appendChildNode(
            authoringDocument.sceneDocument,
            selectedParentId,
            templateNode,
        );
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
        setSelectedNodeIds([templateNode.id]);
        setInspectorOpen(true);
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, selectedParentId, skinYamlDraft]);

    const handleMoveNode = React.useCallback((nodeId: string, targetId: string, position: UISceneNodeMovePosition) => {
        if (!authoringDocument) {
            return;
        }

        const nextSceneDocument = moveSceneNode(
            authoringDocument.sceneDocument,
            compiledContentScene,
            nodeId,
            targetId,
            position,
        );

        if (nextSceneDocument === authoringDocument.sceneDocument) {
            return;
        }

        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
        setSelectedNodeIds([nodeId]);
        setLeftDrawerOpen(true);
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, compiledContentScene, skinYamlDraft]);

    const handleApplyAsset = React.useCallback((assetRef: string) => {
        if (!authoringDocument || !selectedNodeId) {
            return;
        }

        const nextSceneDocument = updateSceneImageAssetRef(
            authoringDocument.sceneDocument,
            selectedNodeId,
            assetRef,
        );
        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, selectedNodeId, skinYamlDraft]);

    const handleSourceDocumentChange = React.useCallback((documentId: YamlSyncDocumentId, value: string) => {
        applyAuthoringDrafts({
            assetRegistryYaml: documentId === 'assetRegistry' ? value : assetRegistryYamlDraft,
            skinYaml: documentId === 'skin' ? value : skinYamlDraft,
            sceneYaml: documentId === 'scene' ? value : sceneYamlDraft,
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, sceneYamlDraft, skinYamlDraft]);

    const handleDeleteSelection = React.useCallback(() => {
        if (!authoringDocument || selectedNodeIds.length === 0) {
            return;
        }

        const nextSceneDocument = removeSceneNodes(authoringDocument.sceneDocument, selectedNodeIds);
        if (nextSceneDocument === authoringDocument.sceneDocument) {
            return;
        }

        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
        setSelectedNodeIds([]);
        setPreviewRects({});
        setInspectorOpen(false);
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, selectedNodeIds, skinYamlDraft]);

    const handleNudgeSelection = React.useCallback((deltaX: number, deltaY: number) => {
        if (!authoringDocument || selectedNodeIds.length === 0) {
            return;
        }

        const rectEntries = buildRectEntriesFromSelection(
            selectedNodeIds,
            authoringDocument.sceneDocument,
            compiledContentScene,
            previewRects,
        );
        if (rectEntries.length === 0) {
            return;
        }

        const selectionLeft = Math.min(...rectEntries.map(([, rect]) => rect.x));
        const selectionTop = Math.min(...rectEntries.map(([, rect]) => rect.y));
        const selectionRight = Math.max(...rectEntries.map(([, rect]) => rect.x + rect.width));
        const selectionBottom = Math.max(...rectEntries.map(([, rect]) => rect.y + rect.height));
        const clampedDeltaX = Math.min(
            Math.max(deltaX, -selectionLeft),
            compiledContentScene.artboard.width - selectionRight,
        );
        const clampedDeltaY = Math.min(
            Math.max(deltaY, -selectionTop),
            compiledContentScene.artboard.height - selectionBottom,
        );

        if (clampedDeltaX === 0 && clampedDeltaY === 0) {
            return;
        }

        let nextSceneDocument = authoringDocument.sceneDocument;
        rectEntries.forEach(([nodeId, rect]) => {
            nextSceneDocument = updateSceneNodeRect(
                nextSceneDocument,
                compiledContentScene,
                nodeId,
                () => ({
                    ...rect,
                    x: rect.x + clampedDeltaX,
                    y: rect.y + clampedDeltaY,
                }),
            );
        });

        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, compiledContentScene, previewRects, selectedNodeIds, skinYamlDraft]);

    const handleAlignSelection = React.useCallback((mode: SelectionArrangeMode) => {
        if (!authoringDocument || selectedNodeIds.length < 2) {
            return;
        }

        const rectEntries = buildRectEntriesFromSelection(
            selectedNodeIds,
            authoringDocument.sceneDocument,
            compiledContentScene,
            previewRects,
        );

        if (rectEntries.length < 2) {
            return;
        }

        const primaryRect = rectEntries[0]?.[1];
        if (!primaryRect) {
            return;
        }
        const selectionLeft = Math.min(...rectEntries.map(([, rect]) => rect.x));
        const selectionTop = Math.min(...rectEntries.map(([, rect]) => rect.y));
        const selectionRight = Math.max(...rectEntries.map(([, rect]) => rect.x + rect.width));
        const selectionBottom = Math.max(...rectEntries.map(([, rect]) => rect.y + rect.height));
        const selectionCenterX = (selectionLeft + selectionRight) / 2;
        const selectionCenterY = (selectionTop + selectionBottom) / 2;
        const horizontalOrder = [...rectEntries].sort((left, right) => left[1].x - right[1].x);
        const verticalOrder = [...rectEntries].sort((left, right) => left[1].y - right[1].y);
        const distributedHorizontalRects = (() => {
            if (horizontalOrder.length < 3) {
                return null;
            }
            const innerNodes = horizontalOrder.slice(1, -1);
            const totalWidth = horizontalOrder.reduce((sum, [, rect]) => sum + rect.width, 0);
            const gap = (selectionRight - selectionLeft - totalWidth) / (horizontalOrder.length - 1);
            let cursorX = horizontalOrder[0]![1].x + horizontalOrder[0]![1].width + gap;
            const nextMap = new Map<string, UISceneRect>();
            innerNodes.forEach(([nodeId, rect]) => {
                nextMap.set(nodeId, {
                    ...rect,
                    x: cursorX,
                });
                cursorX += rect.width + gap;
            });
            return nextMap;
        })();
        const distributedVerticalRects = (() => {
            if (verticalOrder.length < 3) {
                return null;
            }
            const innerNodes = verticalOrder.slice(1, -1);
            const totalHeight = verticalOrder.reduce((sum, [, rect]) => sum + rect.height, 0);
            const gap = (selectionBottom - selectionTop - totalHeight) / (verticalOrder.length - 1);
            let cursorY = verticalOrder[0]![1].y + verticalOrder[0]![1].height + gap;
            const nextMap = new Map<string, UISceneRect>();
            innerNodes.forEach(([nodeId, rect]) => {
                nextMap.set(nodeId, {
                    ...rect,
                    y: cursorY,
                });
                cursorY += rect.height + gap;
            });
            return nextMap;
        })();

        let nextSceneDocument = authoringDocument.sceneDocument;
        rectEntries.forEach(([nodeId, rect]) => {
            const nextRect = (() => {
                switch (mode) {
                    case 'left':
                        return { ...rect, x: selectionLeft };
                    case 'horizontalCenter':
                        return { ...rect, x: selectionCenterX - rect.width / 2 };
                    case 'right':
                        return { ...rect, x: selectionRight - rect.width };
                    case 'top':
                        return { ...rect, y: selectionTop };
                    case 'verticalCenter':
                        return { ...rect, y: selectionCenterY - rect.height / 2 };
                    case 'bottom':
                        return { ...rect, y: selectionBottom - rect.height };
                    case 'sameWidth':
                        return { ...rect, width: primaryRect.width };
                    case 'sameHeight':
                        return { ...rect, height: primaryRect.height };
                    case 'sameSize':
                        return { ...rect, width: primaryRect.width, height: primaryRect.height };
                    case 'distributeHorizontal':
                        return distributedHorizontalRects?.get(nodeId) ?? rect;
                    case 'distributeVertical':
                        return distributedVerticalRects?.get(nodeId) ?? rect;
                }
            })();

            nextSceneDocument = updateSceneNodeRect(
                nextSceneDocument,
                compiledContentScene,
                nodeId,
                () => clampNodeRect(compiledContentScene, nextRect),
            );
        });

        applyAuthoringDrafts({
            assetRegistryYaml: assetRegistryYamlDraft,
            skinYaml: skinYamlDraft,
            sceneYaml: serializeSceneYaml(nextSceneDocument),
        });
    }, [applyAuthoringDrafts, assetRegistryYamlDraft, authoringDocument, compiledContentScene, previewRects, selectedNodeIds, skinYamlDraft]);

    const handleUndo = React.useCallback(() => {
        const previousDrafts = undoStack[undoStack.length - 1];
        if (!previousDrafts) {
            return;
        }

        setUndoStack(undoStack.slice(0, -1));
        setRedoStack([...redoStack, currentDraftsRef.current]);
        applyAuthoringDrafts(previousDrafts, {
            recordHistory: false,
            clearRedo: false,
        });
        setPreviewRects({});
    }, [applyAuthoringDrafts, redoStack, undoStack]);

    const handleRedo = React.useCallback(() => {
        const nextDrafts = redoStack[redoStack.length - 1];
        if (!nextDrafts) {
            return;
        }

        setRedoStack(redoStack.slice(0, -1));
        setUndoStack([...undoStack, currentDraftsRef.current]);
        applyAuthoringDrafts(nextDrafts, {
            recordHistory: false,
            clearRedo: false,
        });
        setPreviewRects({});
    }, [applyAuthoringDrafts, redoStack, undoStack]);

    React.useEffect(() => {
        if (!isAuthorMode) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isEditableTarget = Boolean(
                target
                && (
                    target instanceof HTMLInputElement
                    || target instanceof HTMLTextAreaElement
                    || target instanceof HTMLSelectElement
                    || target.isContentEditable
                ),
            );

            const isDeleteShortcut = event.key === 'Delete' || event.key === 'Backspace';
            const isUndoShortcut = (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'z' && !event.shiftKey;
            const isRedoShortcut = (event.ctrlKey || event.metaKey) && !event.altKey && (
                (event.key.toLowerCase() === 'z' && event.shiftKey)
                || event.key.toLowerCase() === 'y'
            );
            const nudgeMap: Record<string, { x: number; y: number }> = {
                ArrowLeft: { x: -1, y: 0 },
                ArrowRight: { x: 1, y: 0 },
                ArrowUp: { x: 0, y: -1 },
                ArrowDown: { x: 0, y: 1 },
            };

            if (event.key === 'Escape' && !isEditableTarget) {
                event.preventDefault();
                setSelectedNodeIds([]);
                setPreviewRects({});
                setInspectorOpen(false);
                return;
            }

            if (isEditableTarget) {
                return;
            }

            if (isDeleteShortcut && selectedNodeIds.length > 0) {
                event.preventDefault();
                handleDeleteSelection();
                return;
            }

            if (isUndoShortcut) {
                event.preventDefault();
                handleUndo();
                return;
            }

            if (isRedoShortcut) {
                event.preventDefault();
                handleRedo();
                return;
            }

            if (!event.ctrlKey && !event.metaKey && !event.altKey && selectedNodeIds.length > 0 && nudgeMap[event.key]) {
                event.preventDefault();
                const step = event.shiftKey ? 10 : 1;
                const direction = nudgeMap[event.key];
                handleNudgeSelection(direction.x * step, direction.y * step);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleDeleteSelection, handleNudgeSelection, handleRedo, handleUndo, isAuthorMode, selectedNodeIds.length]);

    const handleSave = React.useCallback(async () => {
        if (!isAuthorMode || authoringError) {
            return;
        }

        setIsSaving(true);
        setSaveMessage(null);
        try {
            await saveUiSceneAuthoring(HOME_V2_SCENE_ID, {
                sceneId: HOME_V2_SCENE_ID,
                assetRegistryYaml: assetRegistryYamlDraft,
                skinYaml: skinYamlDraft,
                sceneYaml: sceneYamlDraft,
            });
            setSaveMessage('已写回 scene / skin / asset-registry 三份 YAML');
        } catch (error) {
            setAuthoringError(formatAuthoringError(error));
        } finally {
            setIsSaving(false);
        }
    }, [assetRegistryYamlDraft, authoringError, isAuthorMode, sceneYamlDraft, skinYamlDraft]);

    const sceneContext = React.useMemo(() => ({
        activeTab,
        tabLabels: {
            lobby: '大厅',
            rooms: '房间',
            leaderboard: '榜单',
            changelog: '更新',
            about: '关于',
        },
    }), [activeTab]);

    const actionHandlers = React.useMemo<Record<string, () => void>>(() => ({
        openLobbyTab: () => handleTabChange('lobby'),
        openRoomsTab: () => handleTabChange('rooms'),
        openLeaderboardTab: () => handleTabChange('leaderboard'),
        openChangelogTab: () => handleTabChange('changelog'),
        openAboutTab: () => handleTabChange('about'),
    }), [handleTabChange]);

    const sceneSlots = React.useMemo(() => {
        const slots: Record<string, React.ReactNode> = {};

        if (activeTab === 'lobby') {
            slots.overview_left_page = (
                <LobbyDirectory.Left
                    games={overviewGames.slice(0, HOME_V2_OVERVIEW_LEFT_PAGE_CAPACITY)}
                    onGameClick={handleGameOpen}
                />
            );
            slots.overview_right_page = (
                <LobbyDirectory.Right
                    games={overviewGames.slice(HOME_V2_OVERVIEW_LEFT_PAGE_CAPACITY)}
                    onGameClick={handleGameOpen}
                />
            );
        } else if (activeTab === 'rooms') {
            slots.overview_left_page = (
                <HomeV2TabPlaceholder
                    title="房间目录"
                    description="这里会接入按页签组织的房间列表和房间筛选。当前先保留书页容器与 authoring 对位能力。"
                />
            );
        } else if (activeTab === 'leaderboard') {
            slots.overview_left_page = (
                <HomeV2TabPlaceholder
                    title="排行榜"
                    description="这里会接入胜场排行、近期战绩和玩家概览。当前先打通真实页面上的 scene authoring 链路。"
                />
            );
        } else if (activeTab === 'changelog') {
            slots.overview_left_page = (
                <HomeV2TabPlaceholder
                    title="更新日志"
                    description="这里会接入按日期编排的版本日志与置顶公告。当前先保留书页真实版式和 YAML 真源。"
                />
            );
        } else {
            slots.overview_left_page = (
                <HomeV2TabPlaceholder
                    title="关于"
                    description="这里会接入首页 V2 的项目说明、作者信息和入口说明。当前占位用于验证 tab actionId 宿主映射。"
                />
            );
        }

        if (sceneState === 'detail') {
            slots.detail_left_page = (
                <GameDetails.Left
                    game={selectedGame}
                    onBack={handleBackToOverview}
                />
            );
            slots.detail_right_page = <GameDetails.Right game={selectedGame} />;
        }

        return slots;
    }, [activeTab, handleBackToOverview, handleGameOpen, overviewGames, sceneState, selectedGame]);

    const stage = (
        <div className="relative flex h-full items-center justify-center overflow-hidden">
            <img
                src={HOME_V2_BOOK_DESK}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,216,160,0.16)_0%,_rgba(0,0,0,0)_40%),linear-gradient(180deg,_rgba(20,11,7,0.2)_0%,_rgba(9,5,4,0.46)_100%)]" />
            <div className="relative flex h-full w-full items-center justify-center">
                <div
                    data-testid="home-v2-shell-ready"
                    className="relative h-[100%] max-w-full aspect-[896/720] overflow-visible"
                >
                    <HomeSceneRenderer
                        testId="home-v2-book-stage"
                        debugRegions={debugRegions}
                        sceneState={sceneState}
                        sceneContext={sceneContext}
                        onIntroOpenComplete={() => setSceneState('tabs')}
                        onIntroTabsComplete={() => setSceneState('overview')}
                        onSceneEvent={handleSceneEvent}
                    >
                        <CompiledSceneRenderer
                            scene={compiledContentScene}
                            activeState={sceneState}
                            slots={sceneSlots}
                            actionHandlers={actionHandlers}
                            rectOverrides={previewRects}
                        >
                            {isAuthorMode && authoringDocument && overlayVisible ? (
                                <InPageAuthoringOverlay
                                    scene={compiledContentScene}
                                    visible={sceneState === 'overview' || sceneState === 'detail'}
                                    activeState={sceneState}
                                    meta={authoringMeta}
                                    sceneDocument={authoringDocument.sceneDocument}
                                    selectedNodeId={selectedNodeId}
                                    selectedNodeIds={selectedNodeIds}
                                    rectOverrides={previewRects}
                                    onSelectNode={handleSelectNode}
                                    onSelectNodes={handleSelectNodes}
                                    onPreviewRectsChange={handlePreviewRectsChange}
                                    onCommitRects={handleNodeRectsCommit}
                                    onMoveNode={handleMoveNode}
                                />
                            ) : null}
                        </CompiledSceneRenderer>
                    </HomeSceneRenderer>
                </div>
            </div>
        </div>
    );

    if (!isAuthorMode) {
        return (
            <main
                data-testid="home-v2-draft-root"
                data-bg-friendly-screen="true"
                className="h-screen overflow-hidden bg-[linear-gradient(180deg,_#1f130d_0%,_#120b07_100%)]"
            >
                {stage}
            </main>
        );
    }

    return (
        <main
            data-testid="home-v2-draft-root"
            data-bg-friendly-screen="true"
            className="h-screen overflow-hidden bg-[linear-gradient(180deg,_#1f130d_0%,_#120b07_100%)]"
        >
            <div
                className="fixed inset-0 transition-[padding] duration-300 ease-out"
                style={{
                    paddingTop: workspacePaddingTop,
                    paddingLeft: workspacePaddingLeft,
                    paddingRight: workspacePaddingRight,
                    paddingBottom: workspacePaddingBottom,
                }}
            >
                {stage}
            </div>
            <div className="pointer-events-none fixed inset-x-0 top-4 z-[2300] flex justify-center px-4">
                <div className="pointer-events-auto w-full max-w-[980px]">
                    <EditorHeaderBar
                        sceneName={authoringMeta.scene?.名称 ?? '首页 V2 内容层'}
                        leftTab={leftTab}
                        leftDrawerOpen={leftDrawerOpen}
                        inspectorOpen={inspectorOpen}
                        sourceOpen={sourcePanelOpen}
                        overlayVisible={overlayVisible}
                        canUndo={undoStack.length > 0}
                        canRedo={redoStack.length > 0}
                        canDeleteSelection={selectedNodeIds.length > 0}
                        isSaving={isSaving}
                        saveDisabled={Boolean(authoringError)}
                        onToggleLeftTab={toggleLeftDrawer}
                        onToggleInspector={() => setInspectorOpen((current) => !current)}
                        onToggleOverlay={() => setOverlayVisible((current) => !current)}
                        onToggleSource={() => setSourcePanelOpen((current) => !current)}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        onDeleteSelection={handleDeleteSelection}
                        onSave={handleSave}
                    />
                </div>
            </div>

            <div
                data-testid="home-v2-left-drawer"
                data-state={leftDrawerOpen ? 'open' : 'closed'}
                className="pointer-events-none fixed left-4 top-24 bottom-4 z-[2240] transition-transform duration-300"
                style={{
                    width: leftDrawerWidth,
                    transform: leftDrawerOpen ? 'translateX(0)' : 'translateX(calc(-100% - 1.5rem))',
                }}
            >
                <div className="pointer-events-auto relative h-full">
                    {leftTab === '图层' && authoringDocument ? (
                        <HierarchyPanel
                            embedded
                            open
                            sceneDocument={authoringDocument.sceneDocument}
                            meta={authoringMeta}
                            selectedNodeId={selectedNodeId}
                            selectedNodeIds={selectedNodeIds}
                            onSelectNode={handleSelectNode}
                            onMoveNode={handleMoveNode}
                            onToggle={() => setLeftDrawerOpen(false)}
                        />
                    ) : null}
                    {leftTab === '组件' ? (
                        <ComponentLibraryPanel
                            selectedParentLabel={selectedParentLabel}
                            onInsert={handleInsertTemplate}
                        />
                    ) : null}
                    {leftTab === '资源' && authoringDocument ? (
                        <AssetLibraryPanel
                            assetRegistry={authoringDocument.assetRegistry}
                            selectedNodeSupportsAsset={selectedSourceNode?.type === 'image'}
                            onApplyAsset={handleApplyAsset}
                        />
                    ) : null}
                    <button
                        type="button"
                        aria-label="调整左侧抽屉宽度"
                        data-testid="home-v2-left-drawer-resize"
                        className="absolute -right-[3px] top-5 bottom-5 z-10 w-[6px] cursor-ew-resize rounded-full bg-amber-100/70 shadow-[0_0_0_1px_rgba(255,248,235,0.38)]"
                        onPointerDown={(event) => {
                            event.preventDefault();
                            drawerResizeSessionRef.current = {
                                target: 'left',
                                startClientX: event.clientX,
                                startClientY: event.clientY,
                                startSize: leftDrawerWidth,
                            };
                        }}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            drawerResizeSessionRef.current = {
                                target: 'left',
                                startClientX: event.clientX,
                                startClientY: event.clientY,
                                startSize: leftDrawerWidth,
                            };
                        }}
                    />
                </div>
            </div>

            <div
                data-testid="home-v2-right-drawer"
                data-state={inspectorOpen ? 'open' : 'closed'}
                className="pointer-events-none fixed top-24 right-4 bottom-4 z-[2240] transition-transform duration-300"
                style={{
                    width: inspectorWidth,
                    transform: inspectorOpen ? 'translateX(0)' : 'translateX(calc(100% + 1.5rem))',
                }}
            >
                <div className="pointer-events-auto relative h-full">
                    {authoringDocument ? (
                        <InspectorPanel
                            embedded
                            open
                            scene={compiledContentScene}
                            sceneDocument={authoringDocument.sceneDocument}
                            meta={authoringMeta}
                            selectedNodeId={selectedNodeId}
                            selectedNodeIds={selectedNodeIds}
                            onAlignSelection={handleAlignSelection}
                            onPromoteSelectionPrimary={handlePromoteSelectionPrimary}
                            onSelectNode={handleSelectNode}
                            onChangeNodeRect={handleNodeRectChange}
                            onChangeNodeLayout={handleNodeLayoutChange}
                            onChangeStackDirection={handleStackDirectionChange}
                            onChangeStackGap={handleStackGapChange}
                            onChangeGridGap={handleGridGapChange}
                            onChangeGridColumns={handleGridColumnsChange}
                            onChangeGridRows={handleGridRowsChange}
                            onChangeContainerAlign={handleContainerAlignChange}
                            onChangeContainerJustify={handleContainerJustifyChange}
                            onChangeContainerPadding={handleContainerPaddingChange}
                            onChangeContainerClip={handleContainerClipChange}
                            onChangeNineSliceSlice={handleNineSliceSliceChange}
                            onChangeNineSliceContentPadding={handleNineSliceContentPaddingChange}
                            onToggle={() => setInspectorOpen(false)}
                        />
                    ) : null}
                    <button
                        type="button"
                        aria-label="调整属性抽屉宽度"
                        data-testid="home-v2-right-drawer-resize"
                        className="absolute -left-[3px] top-5 bottom-5 z-10 w-[6px] cursor-ew-resize rounded-full bg-amber-100/70 shadow-[0_0_0_1px_rgba(255,248,235,0.38)]"
                        onPointerDown={(event) => {
                            event.preventDefault();
                            drawerResizeSessionRef.current = {
                                target: 'right',
                                startClientX: event.clientX,
                                startClientY: event.clientY,
                                startSize: inspectorWidth,
                            };
                        }}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            drawerResizeSessionRef.current = {
                                target: 'right',
                                startClientX: event.clientX,
                                startClientY: event.clientY,
                                startSize: inspectorWidth,
                            };
                        }}
                    />
                </div>
            </div>

            <div
                data-testid="home-v2-source-drawer"
                data-state={sourcePanelOpen ? 'open' : 'closed'}
                className="pointer-events-none fixed bottom-4 z-[2240] transition-transform duration-300"
                style={{
                    left: sourceDrawerLeftInset,
                    right: sourceDrawerRightInset,
                    transform: sourcePanelOpen ? 'translateY(0)' : 'translateY(calc(100% + 1.5rem))',
                }}
            >
                <div
                    data-testid="home-v2-source-drawer-body"
                    className="pointer-events-auto relative mx-auto max-w-[960px]"
                    style={{ height: sourcePanelHeight }}
                >
                    <YamlSyncPanel
                        embedded
                        open
                        documents={{
                            scene: sceneYamlDraft,
                            skin: skinYamlDraft,
                            assetRegistry: assetRegistryYamlDraft,
                        }}
                        activeDocument={activeSourceDocument}
                        error={authoringError}
                        isSaving={isSaving}
                        saveMessage={saveMessage}
                        onChangeDocument={handleSourceDocumentChange}
                        onChangeActiveDocument={setActiveSourceDocument}
                        onSave={handleSave}
                        onToggle={() => setSourcePanelOpen(false)}
                    />
                    <button
                        type="button"
                        aria-label="调整源码抽屉高度"
                        data-testid="home-v2-source-drawer-resize"
                        className="absolute left-1/2 top-2 z-10 h-[6px] w-28 -translate-x-1/2 cursor-ns-resize rounded-full bg-amber-100/72 shadow-[0_0_0_1px_rgba(255,248,235,0.38)]"
                        onPointerDown={(event) => {
                            event.preventDefault();
                            drawerResizeSessionRef.current = {
                                target: 'bottom',
                                startClientX: event.clientX,
                                startClientY: event.clientY,
                                startSize: sourcePanelHeight,
                            };
                        }}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            drawerResizeSessionRef.current = {
                                target: 'bottom',
                                startClientX: event.clientX,
                                startClientY: event.clientY,
                                startSize: sourcePanelHeight,
                            };
                        }}
                    />
                </div>
            </div>
        </main>
    );
};
