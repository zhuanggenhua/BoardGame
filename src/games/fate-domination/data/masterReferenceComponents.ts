/** 中文 CHM 御主原卡的只读资料关系；不创建或执行对局组件。来源见 intake/catalog/master-reference-artwork-contract-2026-10-25.md。 */
export interface FateMasterReferenceComponent {
    id: string;
    name: string;
    kind: 'ability' | 'state' | 'resource' | 'item' | 'skill-attack' | 'attack' | 'independent-deck' | 'ascension' | 'seal';
    assetPath: string;
    backAssetPath?: string;
}

export const FATE_MASTER_REFERENCE_COMPONENTS: Record<string, readonly FateMasterReferenceComponent[]> = {
    "m_kariya": [
        {
            "id": "nemesis",
            "name": "宿敌",
            "kind": "state",
            "assetPath": "fate-domination/master-components/m_kariya/nemesis"
        },
        {
            "id": "collapse",
            "name": "崩坏",
            "kind": "ability",
            "assetPath": "fate-domination/master-components/m_kariya/collapse"
        },
        {
            "id": "command-seal",
            "name": "令咒",
            "kind": "seal",
            "assetPath": "fate-domination/master-components/m_kariya/command-seal"
        },
        {
            "id": "human-reactor",
            "name": "人体反应堆",
            "kind": "ascension",
            "assetPath": "fate-domination/master-components/m_kariya/human-reactor"
        }
    ],
    "m_shinji": [
        {
            "id": "borrowed-book-without-sakura",
            "name": "伪臣之书（间桐樱不在场）",
            "kind": "state",
            "assetPath": "fate-domination/master-components/m_shinji/borrowed-book-without-sakura"
        },
        {
            "id": "borrowed-book-with-sakura",
            "name": "伪臣之书（间桐樱在场）",
            "kind": "state",
            "assetPath": "fate-domination/master-components/m_shinji/borrowed-book-with-sakura"
        },
        {
            "id": "command-seal",
            "name": "令咒",
            "kind": "seal",
            "assetPath": "fate-domination/master-components/m_shinji/command-seal"
        },
        {
            "id": "grail-core",
            "name": "圣杯核心",
            "kind": "ascension",
            "assetPath": "fate-domination/master-components/m_shinji/grail-core"
        }
    ],
    "m_shirou_emiya": [
        {
            "id": "kanshou-bakuya",
            "name": "干将·莫邪",
            "kind": "skill-attack",
            "assetPath": "fate-domination/master-components/m_shirou_emiya/kanshou-bakuya"
        },
        {
            "id": "command-seal",
            "name": "令咒",
            "kind": "seal",
            "assetPath": "fate-domination/master-components/m_shirou_emiya/command-seal"
        },
        {
            "id": "golden-sword",
            "name": "必胜黄金之剑",
            "kind": "ascension",
            "assetPath": "fate-domination/master-components/m_shirou_emiya/golden-sword"
        }
    ],
    "m_ryuunosuke": [
        {
            "id": "art-of-death",
            "name": "死之艺术",
            "kind": "ability",
            "assetPath": "fate-domination/master-components/m_ryuunosuke/art-of-death",
            "backAssetPath": "fate-domination/master-components/m_ryuunosuke/art-of-death-back"
        },
        {
            "id": "command-seal",
            "name": "令咒",
            "kind": "seal",
            "assetPath": "fate-domination/master-components/m_ryuunosuke/command-seal"
        },
        {
            "id": "defile",
            "name": "渎神者",
            "kind": "ascension",
            "assetPath": "fate-domination/master-components/m_ryuunosuke/defile"
        }
    ],
    "m_tokiomi": [
        {
            "id": "fireball",
            "name": "火炎弹",
            "kind": "skill-attack",
            "assetPath": "fate-domination/master-components/m_tokiomi/fireball"
        },
        {
            "id": "mercury-sword",
            "name": "水银剑",
            "kind": "item",
            "assetPath": "fate-domination/master-components/m_tokiomi/mercury-sword"
        },
        {
            "id": "grimoire",
            "name": "魔导书",
            "kind": "item",
            "assetPath": "fate-domination/master-components/m_tokiomi/grimoire"
        },
        {
            "id": "gem",
            "name": "宝石",
            "kind": "item",
            "assetPath": "fate-domination/master-components/m_tokiomi/gem"
        },
        {
            "id": "mana-meter",
            "name": "魔力计",
            "kind": "item",
            "assetPath": "fate-domination/master-components/m_tokiomi/mana-meter"
        },
        {
            "id": "command-seal",
            "name": "令咒",
            "kind": "seal",
            "assetPath": "fate-domination/master-components/m_tokiomi/command-seal"
        },
        {
            "id": "gentleman-command",
            "name": "赫须绅士的令印",
            "kind": "ascension",
            "assetPath": "fate-domination/master-components/m_tokiomi/gentleman-command"
        }
    ],
    "m_iliya": [
        {
            "id": "dress-of-heaven",
            "name": "天之衣",
            "kind": "ability",
            "assetPath": "fate-domination/master-components/m_iliya/dress-of-heaven"
        },
        {
            "id": "command-seal",
            "name": "令咒",
            "kind": "seal",
            "assetPath": "fate-domination/master-components/m_iliya/command-seal"
        },
        {
            "id": "third-magic",
            "name": "第三法",
            "kind": "ascension",
            "assetPath": "fate-domination/master-components/m_iliya/third-magic"
        }
    ],
    "m_sakura": [
        {
            "id": "black-mud",
            "name": "黑泥",
            "kind": "ability",
            "assetPath": "fate-domination/master-components/m_sakura/black-mud"
        },
        {
            "id": "corrupted-grail",
            "name": "被污染的圣杯",
            "kind": "ability",
            "assetPath": "fate-domination/master-components/m_sakura/corrupted-grail"
        },
        {
            "id": "command-seal",
            "name": "令咒",
            "kind": "seal",
            "assetPath": "fate-domination/master-components/m_sakura/command-seal"
        },
        {
            "id": "corrosion",
            "name": "腐蚀",
            "kind": "ascension",
            "assetPath": "fate-domination/master-components/m_sakura/corrosion"
        }
    ],
    "m_waver": [
        {
            "id": "command-seal",
            "name": "令咒",
            "kind": "seal",
            "assetPath": "fate-domination/master-components/m_waver/command-seal"
        },
        {
            "id": "case-files",
            "name": "埃尔梅罗二世事件簿",
            "kind": "ascension",
            "assetPath": "fate-domination/master-components/m_waver/case-files"
        }
    ],
    "m_kirei": [
        {
            "id": "supervisor",
            "name": "监督者",
            "kind": "state",
            "assetPath": "fate-domination/master-components/m_kirei/supervisor"
        },
        {
            "id": "executor",
            "name": "执行者",
            "kind": "state",
            "assetPath": "fate-domination/master-components/m_kirei/executor"
        },
        {
            "id": "command-seal",
            "name": "令咒",
            "kind": "seal",
            "assetPath": "fate-domination/master-components/m_kirei/command-seal"
        },
        {
            "id": "evil-protector",
            "name": "恶的庇护者",
            "kind": "ascension",
            "assetPath": "fate-domination/master-components/m_kirei/evil-protector"
        }
    ],
    "m_kayneth": [
        {
            "id": "mercury-cleave",
            "name": "月灵髓液",
            "kind": "independent-deck",
            "assetPath": "fate-domination/master-components/m_kayneth/mercury-cleave"
        },
        {
            "id": "mercury-track",
            "name": "月灵髓液",
            "kind": "independent-deck",
            "assetPath": "fate-domination/master-components/m_kayneth/mercury-track"
        },
        {
            "id": "mercury-boil",
            "name": "月灵髓液",
            "kind": "independent-deck",
            "assetPath": "fate-domination/master-components/m_kayneth/mercury-boil"
        },
        {
            "id": "command-seal",
            "name": "令咒",
            "kind": "seal",
            "assetPath": "fate-domination/master-components/m_kayneth/command-seal"
        },
        {
            "id": "fluid-dynamics",
            "name": "流体力学",
            "kind": "ascension",
            "assetPath": "fate-domination/master-components/m_kayneth/fluid-dynamics"
        }
    ],
    "m_zouken": [
        {
            "id": "creator",
            "name": "创造者",
            "kind": "ability",
            "assetPath": "fate-domination/master-components/m_zouken/creator"
        },
        {
            "id": "five-hundred-years",
            "name": "五百年的执着",
            "kind": "ability",
            "assetPath": "fate-domination/master-components/m_zouken/five-hundred-years"
        },
        {
            "id": "mastermind",
            "name": "幕后主使",
            "kind": "ascension",
            "assetPath": "fate-domination/master-components/m_zouken/mastermind"
        }
    ],
    "m_kiritsugu": [
        {
            "id": "origin-bullet",
            "name": "起源弹",
            "kind": "attack",
            "assetPath": "fate-domination/master-components/m_kiritsugu/origin-bullet"
        },
        {
            "id": "command-seal",
            "name": "令咒",
            "kind": "seal",
            "assetPath": "fate-domination/master-components/m_kiritsugu/command-seal"
        },
        {
            "id": "cold-blooded",
            "name": "冷血杀手",
            "kind": "ascension",
            "assetPath": "fate-domination/master-components/m_kiritsugu/cold-blooded"
        }
    ],
    "m_rin": [
        {
            "id": "gems",
            "name": "宝石",
            "kind": "resource",
            "assetPath": "fate-domination/master-components/m_rin/gems",
            "backAssetPath": "fate-domination/master-components/m_rin/gems-back"
        },
        {
            "id": "gandr-shot",
            "name": "阴炁弹",
            "kind": "attack",
            "assetPath": "fate-domination/master-components/m_rin/gandr-shot"
        },
        {
            "id": "command-seal",
            "name": "令咒",
            "kind": "seal",
            "assetPath": "fate-domination/master-components/m_rin/command-seal"
        },
        {
            "id": "jewel-sword",
            "name": "宝石剑泽尔里奇",
            "kind": "ascension",
            "assetPath": "fate-domination/master-components/m_rin/jewel-sword"
        }
    ]
};
