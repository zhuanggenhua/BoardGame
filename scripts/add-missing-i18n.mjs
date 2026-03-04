#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const files = [
    {
        path: 'public/locales/zh-CN/game-dicethrone.json',
        additions: {
            endgame: {
                ariaHero: '英雄：{{hero}}',
                ariaPanel: '游戏结束面板'
            }
        }
    },
    {
        path: 'public/locales/en/game-dicethrone.json',
        additions: {
            endgame: {
                ariaHero: 'Hero: {{hero}}',
                ariaPanel: 'Game Over Panel'
            }
        }
    },
    {
        path: 'public/locales/zh-CN/lobby.json',
        additions: {
            notification: {
                playerJoinedTitle: '玩家加入',
                playerJoinedBody: '{{username}} 加入了房间',
                playerJoinedBodyAnonymous: '一位玩家加入了房间'
            }
        }
    },
    {
        path: 'public/locales/en/lobby.json',
        additions: {
            notification: {
                playerJoinedTitle: 'Player Joined',
                playerJoinedBody: '{{username}} joined the room',
                playerJoinedBodyAnonymous: 'A player joined the room'
            }
        }
    }
];

for (const file of files) {
    console.log(`Processing ${file.path}...`);
    const content = readFileSync(file.path, 'utf-8');
    const data = JSON.parse(content);
    
    // Merge additions
    for (const [key, value] of Object.entries(file.additions)) {
        if (!data[key]) {
            data[key] = value;
        } else {
            data[key] = { ...data[key], ...value };
        }
    }
    
    writeFileSync(file.path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(`✓ Updated ${file.path}`);
}

console.log('\n✓ All translations added');
