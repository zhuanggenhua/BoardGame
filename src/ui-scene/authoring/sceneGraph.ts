import type {
    UISceneCompiledArtifact,
    UISceneCompiledNode,
    UISceneFlowLayoutSource,
    UISceneGridNodeSource,
    UISceneImageNodeSource,
    UISceneNodeSource,
    UISceneNodeType,
    UISceneRect,
    UISceneSourceDocument,
    UISceneStackDirection,
    UISceneStackNodeSource,
    UISceneTextNodeSource,
    UISceneButtonNodeSource,
    UIScenePanelNodeSource,
} from '../types';

export type UISceneAuthoringNodeKind = '自由容器' | '纵向容器' | '横向容器' | '网格容器' | '面板' | '文字' | '按钮' | '图片' | '插槽';

export interface UISceneNodeTreeItem {
    id: string;
    nodeType: UISceneNodeSource['type'];
    label: string;
    depth: number;
    parentId: string | null;
    isContainer: boolean;
}

export type UISceneNodeMovePosition = 'inside' | 'before' | 'after';

function cloneRect(rect: UISceneRect): UISceneRect {
    return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
    };
}

export function getNodeKindLabel(node: { type: UISceneNodeType; direction?: UISceneStackDirection }): UISceneAuthoringNodeKind {
    if (node.type === 'stack') {
        if (node.direction === 'horizontal') {
            return '横向容器';
        }
        if (node.direction === 'vertical') {
            return '纵向容器';
        }
        return '自由容器';
    }

    if (node.type === 'grid') {
        return '网格容器';
    }

    if (node.type === 'panel') {
        return '面板';
    }

    if (node.type === 'text') {
        return '文字';
    }

    if (node.type === 'button') {
        return '按钮';
    }

    if (node.type === 'image') {
        return '图片';
    }

    return '插槽';
}

export function isContainerNode(node: UISceneNodeSource | UISceneCompiledNode): boolean {
    return node.type === 'panel' || node.type === 'stack' || node.type === 'grid';
}

export function isFlowContainerNode(node: UISceneNodeSource | UISceneCompiledNode): boolean {
    return node.type === 'grid' || (node.type === 'stack' && node.direction !== 'absolute');
}

export function flattenNodeTree(root: UISceneNodeSource): UISceneNodeTreeItem[] {
    const items: UISceneNodeTreeItem[] = [];

    const visit = (node: UISceneNodeSource, depth: number, parentId: string | null) => {
        items.push({
            id: node.id,
            nodeType: node.type,
            label: getNodeKindLabel(node),
            depth,
            parentId,
            isContainer: isContainerNode(node),
        });

        (node.children ?? []).forEach((child) => visit(child, depth + 1, node.id));
    };

    visit(root, 0, null);
    return items;
}

export function findNodeById(root: UISceneNodeSource, nodeId: string): UISceneNodeSource | null {
    if (root.id === nodeId) {
        return root;
    }

    for (const child of root.children ?? []) {
        const found = findNodeById(child, nodeId);
        if (found) {
            return found;
        }
    }

    return null;
}

export function findCompiledNodeById(root: UISceneCompiledNode, nodeId: string): UISceneCompiledNode | null {
    if (root.id === nodeId) {
        return root;
    }

    for (const child of root.children) {
        const found = findCompiledNodeById(child, nodeId);
        if (found) {
            return found;
        }
    }

    return null;
}

export function findParentNodeById(root: UISceneNodeSource, nodeId: string, parent: UISceneNodeSource | null = null): UISceneNodeSource | null {
    if (root.id === nodeId) {
        return parent;
    }

    for (const child of root.children ?? []) {
        const found = findParentNodeById(child, nodeId, root);
        if (found) {
            return found;
        }
    }

    return null;
}

export function listEditableCompiledNodes(root: UISceneCompiledNode, includeRoot = false): UISceneCompiledNode[] {
    const items: UISceneCompiledNode[] = [];

    const visit = (node: UISceneCompiledNode, depth: number) => {
        if (includeRoot || depth > 0) {
            items.push(node);
        }
        node.children.forEach((child) => visit(child, depth + 1));
    };

    visit(root, 0);
    return items;
}

function containsNode(root: UISceneNodeSource, nodeId: string): boolean {
    if (root.id === nodeId) {
        return true;
    }

    return (root.children ?? []).some((child) => containsNode(child, nodeId));
}

function updateNodeTree(
    root: UISceneNodeSource,
    nodeId: string,
    updater: (node: UISceneNodeSource) => UISceneNodeSource,
): UISceneNodeSource {
    if (root.id === nodeId) {
        return updater(root);
    }

    if (!root.children?.length) {
        return root;
    }

    return {
        ...root,
        children: root.children.map((child) => updateNodeTree(child, nodeId, updater)),
    };
}

function detachNode(root: UISceneNodeSource, nodeId: string): { nextRoot: UISceneNodeSource; removedNode: UISceneNodeSource | null } {
    if (!root.children?.length) {
        return { nextRoot: root, removedNode: null };
    }

    let removedNode: UISceneNodeSource | null = null;
    let changed = false;
    const nextChildren: UISceneNodeSource[] = [];

    root.children.forEach((child) => {
        if (child.id === nodeId) {
            removedNode = child;
            changed = true;
            return;
        }

        const result = detachNode(child, nodeId);
        if (result.removedNode) {
            removedNode = result.removedNode;
            changed = true;
        }
        nextChildren.push(result.nextRoot);
    });

    if (!changed) {
        return { nextRoot: root, removedNode: null };
    }

    return {
        nextRoot: {
            ...root,
            children: nextChildren,
        },
        removedNode,
    };
}

function normalizeMovedNode(
    node: UISceneNodeSource,
    targetParent: UISceneNodeSource,
    compiledNode: UISceneCompiledNode | null,
): UISceneNodeSource {
    if (isFlowContainerNode(targetParent)) {
        const currentRect = node.rect ?? compiledNode?.rect;
        return {
            ...node,
            rect: undefined,
            zoneRef: undefined,
            layout: node.layout ?? (currentRect ? {
                width: currentRect.width,
                height: currentRect.height,
                grow: 0,
                shrink: 0,
                alignSelf: 'stretch',
            } : {
                height: 96,
                grow: 0,
                shrink: 0,
                alignSelf: 'stretch',
            }),
        };
    }

    return {
        ...node,
        rect: node.rect ?? compiledNode?.rect ?? {
            x: 120,
            y: 120,
            width: 180,
            height: 96,
        },
        zoneRef: undefined,
    };
}

export function updateSceneNode(
    source: UISceneSourceDocument,
    nodeId: string,
    updater: (node: UISceneNodeSource) => UISceneNodeSource,
): UISceneSourceDocument {
    const visit = (node: UISceneNodeSource): UISceneNodeSource => {
        if (node.id === nodeId) {
            return updater(node);
        }

        if (!node.children?.length) {
            return node;
        }

        return {
            ...node,
            children: node.children.map(visit),
        };
    };

    return {
        scene: {
            ...source.scene,
            root: visit(source.scene.root),
        },
    };
}

export function updateSceneNodeRect(
    source: UISceneSourceDocument,
    scene: UISceneCompiledArtifact,
    nodeId: string,
    updater: (rect: UISceneRect) => UISceneRect,
): UISceneSourceDocument {
    const compiledNode = findCompiledNodeById(scene.root, nodeId);
    if (!compiledNode?.rect) {
        return source;
    }

    return updateSceneNode(source, nodeId, (node) => {
        const nextRect = updater(cloneRect(node.rect ?? compiledNode.rect!));
        return {
            ...node,
            rect: nextRect,
            zoneRef: undefined,
        };
    });
}

export function updateSceneStackProps(
    source: UISceneSourceDocument,
    nodeId: string,
    updater: (node: UISceneStackNodeSource) => UISceneStackNodeSource,
): UISceneSourceDocument {
    return updateSceneNode(source, nodeId, (node) => {
        if (node.type !== 'stack') {
            return node;
        }
        return updater(node);
    });
}

export function updateSceneGridProps(
    source: UISceneSourceDocument,
    nodeId: string,
    updater: (node: UISceneGridNodeSource) => UISceneGridNodeSource,
): UISceneSourceDocument {
    return updateSceneNode(source, nodeId, (node) => {
        if (node.type !== 'grid') {
            return node;
        }
        return updater(node);
    });
}

export function updateSceneNodeLayout(
    source: UISceneSourceDocument,
    nodeId: string,
    updater: (layout: UISceneFlowLayoutSource | undefined) => UISceneFlowLayoutSource | undefined,
): UISceneSourceDocument {
    return updateSceneNode(source, nodeId, (node) => ({
        ...node,
        layout: updater(node.layout),
    }));
}

export function updateSceneNodeSkin(
    source: UISceneSourceDocument,
    nodeId: string,
    skinId?: string,
): UISceneSourceDocument {
    return updateSceneNode(source, nodeId, (node) => ({
        ...node,
        skin: skinId,
    }));
}

export function appendChildNode(
    source: UISceneSourceDocument,
    parentId: string,
    child: UISceneNodeSource,
): UISceneSourceDocument {
    return updateSceneNode(source, parentId, (node) => {
        if (!isContainerNode(node)) {
            return node;
        }

        return {
            ...node,
            children: [...(node.children ?? []), child],
        };
    });
}

export function moveSceneNode(
    source: UISceneSourceDocument,
    scene: UISceneCompiledArtifact,
    nodeId: string,
    targetId: string,
    position: UISceneNodeMovePosition,
): UISceneSourceDocument {
    if (nodeId === targetId || source.scene.root.id === nodeId) {
        return source;
    }

    const movingNode = findNodeById(source.scene.root, nodeId);
    const targetNode = findNodeById(source.scene.root, targetId);
    if (!movingNode || !targetNode) {
        return source;
    }

    if (containsNode(movingNode, targetId)) {
        return source;
    }

    if (position === 'inside' && !isContainerNode(targetNode)) {
        return source;
    }

    const detached = detachNode(source.scene.root, nodeId);
    if (!detached.removedNode) {
        return source;
    }

    const compiledMovingNode = findCompiledNodeById(scene.root, nodeId);

    if (position === 'inside') {
        const targetParent = findNodeById(detached.nextRoot, targetId);
        if (!targetParent || !isContainerNode(targetParent)) {
            return source;
        }

        const normalizedNode = normalizeMovedNode(detached.removedNode, targetParent, compiledMovingNode);
        return {
            scene: {
                ...source.scene,
                root: updateNodeTree(detached.nextRoot, targetParent.id, (node) => {
                    if (!isContainerNode(node)) {
                        return node;
                    }

                    return {
                        ...node,
                        children: [...(node.children ?? []), normalizedNode],
                    };
                }),
            },
        };
    }

    const targetParent = findParentNodeById(detached.nextRoot, targetId);
    if (!targetParent) {
        return source;
    }

    const normalizedNode = normalizeMovedNode(detached.removedNode, targetParent, compiledMovingNode);

    return {
        scene: {
            ...source.scene,
            root: updateNodeTree(detached.nextRoot, targetParent.id, (node) => {
                if (!node.children?.length) {
                    return node;
                }

                const targetIndex = node.children.findIndex((child) => child.id === targetId);
                if (targetIndex < 0) {
                    return node;
                }

                const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
                const nextChildren = [...node.children];
                nextChildren.splice(insertIndex, 0, normalizedNode);
                return {
                    ...node,
                    children: nextChildren,
                };
            }),
        },
    };
}

function filterTopLevelNodeIds(root: UISceneNodeSource, nodeIds: string[]) {
    return nodeIds.filter((nodeId) => {
        const parentNode = findParentNodeById(root, nodeId);
        return !parentNode || !nodeIds.includes(parentNode.id);
    });
}

function removeNodesFromTree(root: UISceneNodeSource, nodeIds: Set<string>): UISceneNodeSource {
    if (!root.children?.length) {
        return root;
    }

    return {
        ...root,
        children: root.children
            .filter((child) => !nodeIds.has(child.id))
            .map((child) => removeNodesFromTree(child, nodeIds)),
    };
}

export function removeSceneNodes(
    source: UISceneSourceDocument,
    nodeIds: string[],
): UISceneSourceDocument {
    const normalizedNodeIds = filterTopLevelNodeIds(
        source.scene.root,
        Array.from(new Set(nodeIds.filter((nodeId) => nodeId && nodeId !== source.scene.root.id))),
    );

    if (!normalizedNodeIds.length) {
        return source;
    }

    return {
        scene: {
            ...source.scene,
            root: removeNodesFromTree(source.scene.root, new Set(normalizedNodeIds)),
        },
    };
}

export function updateSceneImageAssetRef(
    source: UISceneSourceDocument,
    nodeId: string,
    assetRef: string,
): UISceneSourceDocument {
    return updateSceneNode(source, nodeId, (node) => {
        if (node.type !== 'image') {
            return node;
        }

        const nextNode: UISceneImageNodeSource = {
            ...node,
            assetRef,
            path: undefined,
            remoteUrl: undefined,
        };
        return nextNode;
    });
}

function createFlowLayout(width?: number, height?: number): UISceneFlowLayoutSource {
    return {
        width,
        height,
        grow: 0,
        shrink: 0,
        alignSelf: 'stretch',
    };
}

export function createNodeTemplate(
    nodeType: 'panel' | 'stack-vertical' | 'stack-horizontal' | 'grid' | 'text' | 'button' | 'image',
    options?: { flowChild?: boolean },
): UISceneNodeSource {
    const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const flowChild = options?.flowChild ?? false;

    if (nodeType === 'panel') {
        const node: UIScenePanelNodeSource = {
            id: `panel_${uniqueSuffix}`,
            type: 'panel',
            skin: 'home_v2.paper_panel',
            rect: flowChild ? undefined : { x: 120, y: 120, width: 220, height: 140 },
            layout: flowChild ? createFlowLayout(undefined, 160) : undefined,
            children: [],
        };
        return node;
    }

    if (nodeType === 'stack-vertical') {
        const node: UISceneStackNodeSource = {
            id: `stack_vertical_${uniqueSuffix}`,
            type: 'stack',
            direction: 'vertical',
            gap: 12,
            padding: { top: 16, right: 16, bottom: 16, left: 16 },
            rect: flowChild ? undefined : { x: 120, y: 120, width: 240, height: 180 },
            layout: flowChild ? createFlowLayout(undefined, 220) : undefined,
            children: [],
        };
        return node;
    }

    if (nodeType === 'stack-horizontal') {
        const node: UISceneStackNodeSource = {
            id: `stack_horizontal_${uniqueSuffix}`,
            type: 'stack',
            direction: 'horizontal',
            gap: 12,
            padding: { top: 16, right: 16, bottom: 16, left: 16 },
            rect: flowChild ? undefined : { x: 120, y: 120, width: 260, height: 120 },
            layout: flowChild ? createFlowLayout(undefined, 120) : undefined,
            children: [],
        };
        return node;
    }

    if (nodeType === 'grid') {
        const node: UISceneGridNodeSource = {
            id: `grid_${uniqueSuffix}`,
            type: 'grid',
            columns: 2,
            gap: 12,
            padding: { top: 16, right: 16, bottom: 16, left: 16 },
            rect: flowChild ? undefined : { x: 120, y: 120, width: 280, height: 180 },
            layout: flowChild ? createFlowLayout(undefined, 220) : undefined,
            children: [],
        };
        return node;
    }

    if (nodeType === 'text') {
        const node: UISceneTextNodeSource = {
            id: `text_${uniqueSuffix}`,
            type: 'text',
            text: '新的文字',
            rect: flowChild ? undefined : { x: 120, y: 120, width: 220, height: 48 },
            layout: flowChild ? createFlowLayout(undefined, 48) : undefined,
        };
        return node;
    }

    if (nodeType === 'button') {
        const node: UISceneButtonNodeSource = {
            id: `button_${uniqueSuffix}`,
            type: 'button',
            text: '新按钮',
            rect: flowChild ? undefined : { x: 120, y: 120, width: 160, height: 56 },
            layout: flowChild ? createFlowLayout(180, 56) : undefined,
        };
        return node;
    }

    const node: UISceneImageNodeSource = {
        id: `image_${uniqueSuffix}`,
        type: 'image',
        assetRef: '',
        rect: flowChild ? undefined : { x: 120, y: 120, width: 180, height: 180 },
        layout: flowChild ? createFlowLayout(180, 180) : undefined,
        contentMode: 'contain',
        alt: '新图片',
    };
    return node;
}
