import type {
    BetrayalCore,
    BetrayalExplorerSummary,
    BetrayalInventoryCard,
    BetrayalMonsterSummary,
    BetrayalRoomNode,
    BetrayalRoomVisualId,
} from './game';
import { inferMonsterDefinitionId } from './monsterReadModel';
import { resolveInventoryEffectId } from './possessionEffects';
import { getAllExplorers, getExplorersInTurnOrder } from './explorerReadModel';

const DUST_RESEARCH_ROOM_VISUAL_IDS = new Set<BetrayalRoomVisualId>([
    'laboratory',
    'operatingTheatre',
    'observatory',
    'kitchen',
]);
export const HELPING_HANDS_STRANGE_AMULET_EFFECT_ID = 'strange-amulet';

export function isMummyHaunt(core: BetrayalCore): boolean {
    return core.phase === 'haunt'
        && core.scenarioRuntime.hauntCardNumber === 1
        && core.scenarioRuntime.hauntScenarioCardId === 'mummy-rampage'
        && Boolean(core.scenarioRuntime.mummy);
}

export function isCrimsonJackHaunt(core: BetrayalCore): boolean {
    return core.phase === 'haunt'
        && core.scenarioRuntime.hauntCardNumber === 1
        && core.scenarioRuntime.hauntScenarioCardId === 'crimson-jack-returns';
}

export function isDustHaunt(core: BetrayalCore): boolean {
    return core.phase === 'haunt'
        && core.scenarioRuntime.hauntCardNumber === 3
        && Boolean(core.scenarioRuntime.dust);
}

export function isHelpingHandsHaunt(core: BetrayalCore): boolean {
    return core.phase === 'haunt'
        && core.scenarioRuntime.hauntCardNumber === 12
        && Boolean(core.scenarioRuntime.helpingHands);
}

export function isMagicCameraHaunt(core: BetrayalCore): boolean {
    return core.phase === 'haunt'
        && core.scenarioRuntime.hauntCardNumber === 33
        && Boolean(core.scenarioRuntime.magicCamera);
}

export function isUponReflectionHaunt(core: BetrayalCore): boolean {
    return core.phase === 'haunt'
        && core.scenarioRuntime.hauntCardNumber === 7
        && core.scenarioRuntime.hauntScenarioCardId === 'upon-reflection'
        && Boolean(core.scenarioRuntime.uponReflection);
}

export function isBloodFromStoneHaunt(core: BetrayalCore): boolean {
    return core.phase === 'haunt'
        && core.scenarioRuntime.hauntCardNumber === 5;
}

export function findFeverishMonster(core: BetrayalCore, playerId: string): BetrayalMonsterSummary | null {
    return core.monsters.find((monster) => monster.id === `feverish-${playerId}`) ?? null;
}

export function shouldDeadTraitorControlJackSpirit(core: BetrayalCore, playerId: string): boolean {
    return (
        core.scenarioRuntime.traitorPlayerId === playerId
        && core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId)
        && core.scenarioRuntime.jackSpiritReleased
        && Boolean(core.scenarioRuntime.jackSpiritRoomId)
    );
}

export function shouldDeadPlayerControlFeverish(core: BetrayalCore, playerId: string): boolean {
    return Boolean(
        isDustHaunt(core)
        && core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId)
        && core.scenarioRuntime.dust?.feverishPlayerIds.includes(playerId)
        && findFeverishMonster(core, playerId),
    );
}

export function isBetrayalPlayerControllingMonster(core: BetrayalCore, playerId: string): boolean {
    return shouldDeadTraitorControlJackSpirit(core, playerId)
        || shouldDeadPlayerControlFeverish(core, playerId);
}

export function resolveControlledRoomId(core: BetrayalCore, explorer: BetrayalExplorerSummary): string {
    if (shouldDeadTraitorControlJackSpirit(core, explorer.playerId) && core.scenarioRuntime.jackSpiritRoomId) {
        return core.scenarioRuntime.jackSpiritRoomId;
    }
    const feverish = findFeverishMonster(core, explorer.playerId);
    if (shouldDeadPlayerControlFeverish(core, explorer.playerId) && feverish) {
        return feverish.roomId;
    }
    return explorer.roomId;
}

export function hasOmenBook(explorer: BetrayalExplorerSummary | null | undefined): boolean {
    return Boolean(explorer?.inventory.some((card) => (
        card.kind === 'omen'
        && (
            resolveInventoryEffectId(card.id) === 'omen-book'
            || card.name === '书本'
            || card.name.toLowerCase() === 'book'
        )
    )));
}

export function hasMagicCamera(explorer: BetrayalExplorerSummary | null | undefined): boolean {
    return Boolean(explorer?.inventory.some((card) => resolveInventoryEffectId(card.id) === 'camera'));
}

export function isStrangeAmuletCard(card: BetrayalInventoryCard): boolean {
    return resolveInventoryEffectId(card.id) === HELPING_HANDS_STRANGE_AMULET_EFFECT_ID;
}

export function findStrangeAmuletHolder(core: BetrayalCore): { playerId: string; card: BetrayalInventoryCard } | null {
    for (const explorer of getAllExplorers(core)) {
        const card = explorer.inventory.find(isStrangeAmuletCard);
        if (card) {
            return { playerId: explorer.playerId, card };
        }
    }
    return null;
}

export function resolveHelpingHandsControllerPlayerId(core: BetrayalCore): string | null {
    return findStrangeAmuletHolder(core)?.playerId ?? null;
}

export function hasLivingHeroWithBookInRoom(core: BetrayalCore, roomId: string): boolean {
    return getAllExplorers(core).some((explorer) => (
        explorer.playerId !== core.scenarioRuntime.traitorPlayerId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
        && explorer.roomId === roomId
        && hasOmenBook(explorer)
    ));
}

export function resolveMagicCameraOwnerPlayerId(core: BetrayalCore): string | null {
    return getAllExplorers(core)
        .find(hasMagicCamera)
        ?.playerId ?? null;
}

export function findMagicCameraHolderPlayerId(core: BetrayalCore): string | null {
    if (core.scenarioRuntime.magicCamera?.cameraDestroyed) {
        return null;
    }
    return resolveMagicCameraOwnerPlayerId(core);
}

export function findMummyMonster(core: BetrayalCore): BetrayalMonsterSummary | null {
    const mummyId = core.scenarioRuntime.mummy?.mummyMonsterId ?? 'mummy';
    return core.monsters.find((monster) => monster.id === mummyId || inferMonsterDefinitionId(monster) === 'mummy') ?? null;
}

export function isMummyMonster(
    core: BetrayalCore,
    monsterOrId: BetrayalMonsterSummary | string | null | undefined,
): boolean {
    if (!monsterOrId) {
        return false;
    }
    const mummy = findMummyMonster(core);
    const monsterId = typeof monsterOrId === 'string' ? monsterOrId : monsterOrId.id;
    return Boolean(mummy && mummy.id === monsterId);
}

export function findHelpingHandsTrollHand(
    core: BetrayalCore,
    monsterId: string | undefined,
): BetrayalMonsterSummary | null {
    if (!monsterId || !core.scenarioRuntime.helpingHands?.trollHandIds.includes(monsterId)) {
        return null;
    }
    return core.monsters.find((monster) => monster.id === monsterId) ?? null;
}

export function findPhantomPhotographer(
    core: BetrayalCore,
    monsterId: string | undefined,
): BetrayalMonsterSummary | null {
    if (!monsterId || !core.scenarioRuntime.magicCamera?.phantomPhotographerIds.includes(monsterId)) {
        return null;
    }
    return core.monsters.find((monster) => monster.id === monsterId) ?? null;
}

export function resolveLivingHeroExplorers(core: BetrayalCore): BetrayalExplorerSummary[] {
    return getExplorersInTurnOrder(core)
        .filter((explorer) => (
            explorer.playerId !== core.scenarioRuntime.traitorPlayerId
            && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
        ));
}

export function isMummyNameStudyRoom(core: BetrayalCore, roomId: string): boolean {
    const room = core.rooms.find((item) => item.id === roomId);
    const mummy = core.scenarioRuntime.mummy;
    return Boolean(
        room
        && mummy
        && (
            room.id === mummy.sarcophagusRoomId
            || room.visualId === 'study'
            || room.visualId === 'library'
            || ['研究室', '书房', '图书馆'].includes(room.name)
        ),
    );
}

export function isBetrayalLibraryRoom(room: BetrayalRoomNode | undefined): boolean {
    return room?.name === '图书馆' || room?.visualId === 'library';
}

export function isDustResearchRoom(room: BetrayalRoomNode | undefined): boolean {
    return Boolean(
        room
        && room.state === 'discovered'
        && (
            DUST_RESEARCH_ROOM_VISUAL_IDS.has(room.visualId)
            || ['实验室', '手术室', '观测台', '观象台', '厨房'].includes(room.name)
        ),
    );
}

export function isUponReflectionMirrorBeingMonster(monster: BetrayalMonsterSummary): boolean {
    return inferMonsterDefinitionId(monster) === 'upon-reflection-mirror-being';
}

export function isStoneCherubMonster(monster: BetrayalMonsterSummary): boolean {
    return inferMonsterDefinitionId(monster) === 'blood-from-stone-stone-cherub';
}

function isBloodFromStoneMirrorCard(card: BetrayalInventoryCard): boolean {
    const normalizedId = card.id.trim().toLowerCase();
    const normalizedName = card.name.trim().toLowerCase();
    return normalizedId === 'mirror'
        || normalizedName === 'mirror'
        || card.name.includes('镜');
}

export function hasBloodFromStoneMirror(explorer: BetrayalExplorerSummary): boolean {
    return explorer.inventory.some(isBloodFromStoneMirrorCard);
}
