import { readFileSync, writeFileSync } from 'fs';

const fixes = [
  // ninjas_pod
  {
    file: 'src/games/smashup/data/factions/ninjas_pod.ts',
    replacements: [
      {
        from: `        abilityTags: ['special'],
        specialLimitGroup: 'ninja_pod_special',`,
        to: `        // 注意：影舞者在 Me First! 窗口中打出（beforeScoringPlayable），不是点击场上随从激活
        // 因此不应该有 abilityTags: ['special']
        specialLimitGroup: 'ninja_pod_special',`
      },
      {
        from: `        abilityTags: ['special'],
        specialNeedsBase: true,
        specialLimitGroup: 'ninja_pod_special',`,
        to: `        // 注意：便衣忍者在 Me First! 窗口中打出，不是点击场上卡牌激活
        // 因此不应该有 abilityTags: ['special']
        specialNeedsBase: true,
        specialLimitGroup: 'ninja_pod_special',`
      }
    ]
  },
  // cthulhu
  {
    file: 'src/games/smashup/data/factions/cthulhu.ts',
    replacements: [
      {
        from: `        power: 3,
        abilityTags: ['special'],
        count: 3,`,
        to: `        power: 3,
        // 注意：神选者的能力是 beforeScoring trigger（自动创建交互），不是点击场上随从激活
        // 因此不应该有 abilityTags: ['special']
        count: 3,`
      }
    ]
  },
  // cthulhu_pod
  {
    file: 'src/games/smashup/data/factions/cthulhu_pod.ts',
    replacements: [
      {
        from: `        power: 3,
        abilityTags: ['special'],
        count: 3,`,
        to: `        power: 3,
        // 注意：神选者的能力是 beforeScoring trigger（自动创建交互），不是点击场上随从激活
        // 因此不应该有 abilityTags: ['special']
        count: 3,`
      }
    ]
  },
  // vampires
  {
    file: 'src/games/smashup/data/factions/vampires.ts',
    replacements: [
      {
        from: `        faction: 'vampires',
        abilityTags: ['special'],
        specialNeedsBase: true,`,
        to: `        faction: 'vampires',
        // 注意：自助餐的能力是 afterScoring trigger（自动触发），不是点击场上卡牌激活
        // 因此不应该有 abilityTags: ['special']
        specialNeedsBase: true,`
      }
    ]
  },
  // vampires_pod
  {
    file: 'src/games/smashup/data/factions/vampires_pod.ts',
    replacements: [
      {
        from: `        faction: 'vampires_pod',
        abilityTags: ['special'],
        specialNeedsBase: true,`,
        to: `        faction: 'vampires_pod',
        // 注意：自助餐的能力是 afterScoring trigger（自动触发），不是点击场上卡牌激活
        // 因此不应该有 abilityTags: ['special']
        specialNeedsBase: true,`
      }
    ]
  }
];

for (const fix of fixes) {
  try {
    let content = readFileSync(fix.file, 'utf-8');
    let modified = false;
    
    for (const { from, to } of fix.replacements) {
      if (content.includes(from)) {
        content = content.replace(from, to);
        modified = true;
        console.log(`✓ Fixed in ${fix.file}`);
      }
    }
    
    if (modified) {
      writeFileSync(fix.file, content, 'utf-8');
    }
  } catch (error) {
    console.error(`✗ Error processing ${fix.file}:`, error.message);
  }
}

console.log('\n✓ All fixes applied!');
