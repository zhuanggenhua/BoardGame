import React from 'react';
import { PixiSpriteMotion } from './PixiSpriteMotion';
import { extend, useApplication } from '@pixi/react';
import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import type { MapSceneResourceStatus, MapSceneSprite, MapSceneSpriteMotionPhaseCallback, MapSceneSpriteMotionFrameCallback } from './types';

extend({ Container, Graphics, Sprite });

async function loadCandidates(urls: readonly string[]): Promise<Texture> {
    let failure: unknown = new Error('Map sprite has no texture source');
    for (const url of urls) {
        try {
            return await Assets.load<Texture>(url);
        } catch (error) {
            failure = error;
        }
    }
    throw failure;
}

function SceneSprite({ sprite, source, onMotionComplete, onMotionPhase, onMotionFrame }: {
    sprite: MapSceneSprite;
    source: Texture;
    onMotionComplete?: (spriteId: string, motionId: string) => void;
    onMotionPhase?: MapSceneSpriteMotionPhaseCallback;
    onMotionFrame?: MapSceneSpriteMotionFrameCallback;
}) {
    const { x = 0, y = 0, width = 1, height = 1 } = sprite.frame ?? {};
    const [texture, setTexture] = React.useState(source);
    React.useLayoutEffect(() => {
        const nextTexture = new Texture({
            source: source.source,
            frame: new Rectangle(
                x * source.source.width,
                y * source.source.height,
                width * source.source.width,
                height * source.source.height,
            ),
        });
        setTexture(nextTexture);
        // React StrictMode can replay effects. Each setup owns its own crop view.
        return () => nextTexture.destroy(false);
    }, [source, x, y, width, height]);

    const [mask, setMask] = React.useState<Graphics | null>(null);
    const drawMask = React.useCallback((graphics: Graphics) => {
        graphics.clear();
        if (sprite.clipPolygon) graphics.poly(sprite.clipPolygon.flatMap(point => [point.x * sprite.width, point.y * sprite.height])).fill(0xffffff);
    }, [sprite.clipPolygon, sprite.width, sprite.height]);
    const drawBorder = React.useCallback((graphics: Graphics) => {
        graphics.clear();
        if (sprite.clipPolygon && sprite.border) graphics.poly(sprite.clipPolygon.flatMap(point => [point.x * sprite.width, point.y * sprite.height])).fill(sprite.border.color).stroke({ color: sprite.border.color, width: sprite.border.width });
    }, [sprite.clipPolygon, sprite.border, sprite.width, sprite.height]);
    const fit = sprite.imageFit === 'cover'
        ? Math.max(sprite.width / texture.width, sprite.height / texture.height)
        : Math.min(sprite.width / texture.width, sprite.height / texture.height);
    if (sprite.clipPolygon) return <PixiSpriteMotion sprite={sprite} onComplete={onMotionComplete} onPhase={onMotionPhase} onFrame={onMotionFrame}>
        <pixiGraphics draw={drawBorder} eventMode="none" />
        <pixiGraphics ref={setMask} draw={drawMask} eventMode="none" />
        {mask && <pixiSprite
            texture={texture} mask={mask} anchor={0.5}
            x={sprite.width / 2} y={sprite.height / 2}
            width={texture.width * fit * (sprite.imageScale ?? 1)}
            height={texture.height * fit * (sprite.imageScale ?? 1)}
            eventMode="none"
        />}
    </PixiSpriteMotion>;

    if (sprite.motion?.kind === 'reveal') {
        const centerX = sprite.x + sprite.width / 2;
        const centerY = sprite.y + sprite.height / 2;
        const centeredSprite = {
            ...sprite,
            x: centerX,
            y: centerY,
            // Reveal sources already use world-space center coordinates.
            motion: sprite.motion,
        };
        return <PixiSpriteMotion sprite={centeredSprite} onComplete={onMotionComplete} onPhase={onMotionPhase} onFrame={onMotionFrame}>
            <pixiSprite
                label={sprite.id}
                texture={texture}
                x={0}
                y={0}
                anchor={0.5}
                width={sprite.width}
                height={sprite.height}
                rotation={sprite.rotation ?? 0}
                eventMode="none"
            />
        </PixiSpriteMotion>;
    }

    return <pixiSprite
        label={sprite.id}
        texture={texture}
        x={sprite.x + sprite.width / 2}
        y={sprite.y + sprite.height / 2}
        anchor={0.5}
        width={sprite.width}
        height={sprite.height}
        rotation={sprite.rotation ?? 0}
        alpha={sprite.alpha ?? 1}
        eventMode="none"
    />;
}

/** One atlas-loading owner for all tiles/tokens in a scene. No per-object canvas or render loop. */
export function PixiSceneSpriteLayer({ sprites, onResourceStateChange, onMotionComplete, onMotionPhase, onMotionFrame }: {
    onMotionComplete?: (spriteId: string, motionId: string) => void;
    onMotionPhase?: MapSceneSpriteMotionPhaseCallback;
    onMotionFrame?: MapSceneSpriteMotionFrameCallback;
    sprites: readonly MapSceneSprite[];
    onResourceStateChange: (state: MapSceneResourceStatus) => void;
}) {
    const { app, isInitialised } = useApplication();
    const sourceKeys = [...new Set(sprites.map(sprite => JSON.stringify(sprite.textureUrls)))].sort();
    const sourceSignature = JSON.stringify(sourceKeys);
    const [loaded, setLoaded] = React.useState<{
        signature: string;
        textures: ReadonlyMap<string, Texture>;
    }>({ signature: '', textures: new Map() });
    // Keep only each live object's last committed surface while its replacement texture loads.
    // This is presentation continuity (e.g. a room back), never a substitute for another object.
    const presented = React.useRef(new Map<string, { sprite: MapSceneSprite; source: Texture }>());
    React.useLayoutEffect(() => {
        const liveIds = new Set(sprites.map(sprite => sprite.id));
        for (const id of presented.current.keys()) if (!liveIds.has(id)) presented.current.delete(id);
        for (const sprite of sprites) {
            const source = loaded.textures.get(JSON.stringify(sprite.textureUrls));
            if (source) presented.current.set(sprite.id, { sprite: { ...sprite, motion: undefined }, source });
        }
    }, [sprites, loaded.textures]);
    const callbackRef = React.useRef(onResourceStateChange);
    React.useLayoutEffect(() => { callbackRef.current = onResourceStateChange; }, [onResourceStateChange]);

    React.useEffect(() => {
        let cancelled = false;
        const keys: string[] = JSON.parse(sourceSignature);
        const resourceUrl = keys.length ? JSON.parse(keys[0])[0] ?? '' : '';
        callbackRef.current({ status: 'loading', resourceUrl });
        Promise.all(keys.map(async key => [key, await loadCandidates(JSON.parse(key))] as const))
            .then(entries => {
                if (cancelled) return;
                setLoaded({ signature: sourceSignature, textures: new Map(entries) });
            })
            .catch((error: unknown) => {
                if (!cancelled) callbackRef.current({ status: 'error', resourceUrl, error });
            });
        return () => { cancelled = true; };
    }, [sourceSignature]);

    React.useLayoutEffect(() => {
        if (loaded.signature !== sourceSignature) return;
        const keys: string[] = JSON.parse(sourceSignature);
        const resourceUrl = keys.length ? JSON.parse(keys[0])[0] ?? '' : '';
        // Background-only consumers have no sprite frame to wait for.
        if (!keys.length) {
            callbackRef.current({ status: 'ready', resourceUrl });
            return;
        }
        if (!isInitialised) return;
        const runner = app.renderer.runners.postrender;
        let cancelled = false;
        let reported = false;
        const listener = {
            postrender() {
                if (cancelled || reported) return;
                reported = true;
                // Loaded textures must reach the committed Pixi scene before
                // map input is released. This is not a GPU-present guarantee.
                // SystemRunner iterates its live array: never remove during emit.
                queueMicrotask(() => { if (!cancelled) runner.remove(listener); });
                callbackRef.current({ status: 'ready', resourceUrl });
            },
        };
        runner.add(listener);
        return () => { cancelled = true; runner.remove(listener); };
    }, [app, isInitialised, loaded.signature, sourceSignature]);

    // Keep unchanged, URL-keyed textures visible while new discoveries load their own atlas.
    // Missing keys never borrow a texture from an unrelated object.
    return <>{sprites.map(sprite => {
        const source = loaded.textures.get(JSON.stringify(sprite.textureUrls));
        const previous = presented.current.get(sprite.id);
        if (!source && previous) {
            const heldSprite = { ...previous.sprite, x: sprite.x, y: sprite.y, width: sprite.width, height: sprite.height };
            return <SceneSprite key={sprite.id} sprite={heldSprite} source={previous.source} />;
        }
        return source ? <SceneSprite key={sprite.id} sprite={sprite} source={source} onMotionComplete={onMotionComplete} onMotionPhase={onMotionPhase} onMotionFrame={onMotionFrame} /> : null;
    })}</>;
}
