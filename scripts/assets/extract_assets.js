import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const JSON_PATH = 'd:/gongzuo/web/BordGame/BordGameAsset/王权骰铸/Mods/Workshop/2513491409.json';
const SOURCE_DIR = 'd:/gongzuo/web/BordGame/BordGameAsset/王权骰铸/Mods/Images';
const TARGET_DIR = 'd:/gongzuo/web/BordGame/src/games/dicethrone/assets';

// Hero definitions to look for
const HEROES = {
    'Barbarian': { id: 'barbarian' },
    'Moon Elf': { id: 'moon_elf' }
};

if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// Pre-load all available files in Source Dir to efficient search
const availableFiles = fs.readdirSync(SOURCE_DIR);

const modData = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

// Helper to find local file by URL hash
function findLocalFile(url) {
    if (!url) return null;

    // Extract the hash part (usually the last long hex string)
    // URL formats:
    // http://cloud-3.steamusercontent.com/ugc/HASH_PART/
    // http://.../something.png

    // Split by slash, filter empty
    const parts = url.split('/').filter(p => p.length > 0);

    // Candidate parts are usually long hex strings. 
    // Let's try to match any part of the URL that is at least 10 chars long against the available filenames.
    // Iterating available files is safer.

    // Normalize url for comparison: remove http, https, : / .
    const flatUrl = url.replace(/^https?:\/\//, '').replace(/[\/\.:]/g, '');

    // 1. Try exact flat match (ignoring case)
    let match = availableFiles.find(f => {
        const flatFile = f.replace(/\.[^/.]+$/, '').replace(/[\/\.:]/g, ''); // strip extension
        return flatUrl.includes(flatFile) || flatFile.includes(flatUrl);
    });

    if (match) return match;

    // 2. Try hash match
    // Most TTS urls have the hash at the end.
    const lastPart = parts[parts.length - 1];
    if (lastPart.length > 10) {
        match = availableFiles.find(f => f.includes(lastPart));
        if (match) return match;
    }

    // 3. Try second to last part (sometimes URL ends with slash)
    if (parts.length > 1) {
        const secondLast = parts[parts.length - 2];
        if (secondLast.length > 10) {
            match = availableFiles.find(f => f.includes(secondLast));
            if (match) return match;
        }
    }

    return null;
}

function copyAsset(url, targetRelPath) {
    const localFile = findLocalFile(url);
    if (!localFile) {
        console.warn(`[MISSING] Could not find local file for URL: ${url}`);
        return;
    }

    const sourcePath = path.join(SOURCE_DIR, localFile);
    const targetPath = path.join(TARGET_DIR, targetRelPath);
    const targetDir = path.dirname(targetPath);

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.copyFileSync(sourcePath, targetPath);
    console.log(`[COPIED] ${localFile} -> ${targetRelPath}`);
}

function processObject(obj) {
    if (!obj) return;

    // Check Name/Nickname
    let heroId = null;
    for (const [name, data] of Object.entries(HEROES)) {
        if ((obj.Nickname && obj.Nickname.includes(name)) || (obj.Name && obj.Name.includes(name))) {
            heroId = data.id;
            break;
        }
    }

    if (heroId) {
        // 1. Dice
        if (obj.CustomImage && obj.CustomImage.ImageURL) {
            copyAsset(obj.CustomImage.ImageURL, `${heroId}/dice_face.png`);
        }

        // 2. Models (Board?)
        // Usually boards are CustomImage on a Token or Tile, OR CustomModel/CustomAssetBundle.
        if (obj.CustomImage && obj.CustomImage.ImageURL && (obj.Nickname.includes('Board') || obj.Nickname.includes('Mat'))) {
            copyAsset(obj.CustomImage.ImageURL, `${heroId}/board.png`);
        }

        // 3. Decks (scan contained objects or DeckIDs)
        if (obj.DeckIDs && obj.DeckIDs.length > 0) {
            // Find the Deck CustomDeck entry using the ID
            const deckId = Math.floor(obj.DeckIDs[0] / 100);
            const customDeck = findCustomDeckGlobal(deckId);

            if (customDeck) {
                copyAsset(customDeck.FaceURL, `${heroId}/cards_sheet.png`);
                copyAsset(customDeck.BackURL, `${heroId}/card_back.png`);
            }
        }
    }

    // Recurse
    if (obj.ContainedObjects) {
        obj.ContainedObjects.forEach(processObject);
    }
}

function findCustomDeckGlobal(deckId) {
    let result = null;
    const search = (o) => {
        if (!o || result) return;
        if (o.CustomDeck && o.CustomDeck[deckId]) {
            result = o.CustomDeck[deckId];
            return;
        }
        if (o.ObjectStates) o.ObjectStates.forEach(search);
        if (o.ContainedObjects) o.ContainedObjects.forEach(search);
    };

    // Search the whole tree
    search({ ObjectStates: modData.ObjectStates });

    // Also check root 'CustomDeck' property if it exists
    if (!result && modData.CustomDeck && modData.CustomDeck[deckId]) {
        result = modData.CustomDeck[deckId];
    }

    return result;
}

// Execution
console.log("Starting extraction...");
modData.ObjectStates.forEach(processObject);
console.log("Extraction complete.");
