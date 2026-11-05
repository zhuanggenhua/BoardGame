import type { FgoCharacterEntry } from './fgoCharacterData';

// Display names only; source names, clip keys and asset identifiers stay intact.
const CHARACTER_NAMES: Record<string, string> = {
  '100100': '阿尔托莉雅·潘德拉贡',
  '101400': '弗格斯·马克·罗伊',
  '202200': '阿蒂拉（圣诞）',
  '204600': '源为朝',
  '300100': '库·丘林',
  '301000': '罗穆路斯',
  '303800': '长尾景虎',
  '305800': '阿育王',
  '400100': '美杜莎',
  '505900': '花开翁',
  '605200': '蛇女房',
  '700300': '吕布奉先',
  '701600': '玉藻猫',
  '800100': '玛修·基列莱特',
  '9930100': '骸骨兵',
  '9932300': '魔偶',
  '9942530': '宇津见绘里濑',
  '9947060': '帕茨西',
  '9947070': '卡多克与阿纳斯塔西娅',
  '9947080': '奥菲莉娅',
  '9947090': '虞美人与项羽',
  '9947100': '佩佩隆奇诺',
  '9947110': '阿夏与阿贾伊',
  '9947120': '阿黛尔与马卡里奥斯',
  '9947130': '基尔什塔利亚',
  '9947140': '奥伯龙',
  '9947150': '贝里尔',
  '9947160': '哥布林三兄弟',
  '9947180': '特佩乌',
  '9947440': '阿尔托莉雅·卡斯特',
  '9947450': '玛丽丝·迦勒底亚斯',
  '9947460': '玛丽丝·迦勒底亚斯',
  '9947470': '玛丽丝·迦勒底亚斯',
  '9947480': '玛丽丝·迦勒底亚斯',
  '9947490': '玛丽丝·迦勒底亚斯',
  '9947500': '玛丽丝·迦勒底亚斯',
  '9947520': '库库尔坎',
  '9947540': '阿周那（异闻带）',
};

export const fgoCharacterName = (entry: FgoCharacterEntry) => CHARACTER_NAMES[entry.id]
  ?? (entry.name === entry.id ? `未识别角色 ${entry.id}` : entry.name);

const MOTIONS: Record<string, { name: string; meaning: string }> = {
  attack_a: { name: '蓝卡攻击', meaning: '蓝色指令卡对应的角色攻击动作；这里只播放模型动作，不包含整场战斗的命中调度与特效。' },
  attack_b: { name: '红卡攻击', meaning: '红色指令卡对应的角色攻击动作。不同变式可能采用不同姿势或武器动作，编号不代表伤害等级。' },
  attack_q: { name: '绿卡攻击', meaning: '绿色指令卡对应的角色攻击动作。变式编号用于区分片段，不代表连击顺序。' },
  attack_ex: { name: '追加攻击', meaning: '角色追加攻击的动作片段；属于攻击动作，不能当作完整宝具演出。' },
  attack_gen: { name: '其他攻击', meaning: '原始名称为 attack_gen 的攻击片段。gen 的具体调度用途尚未确认，暂不指定为某种指令卡或宝具。' },
  damage: { name: '受击', meaning: '角色受到攻击时的反应动作。编号区分不同片段，不能直接等同于轻伤、重伤或伤害数值。' },
  eye_close: { name: '闭眼', meaning: '局部眼部动作，控制闭眼或眼部表情切换；预览中叠加在待机姿态上，避免身体回到拆分姿态。' },
  eye_open: { name: '睁眼', meaning: '局部眼部动作，控制睁眼或眼部表情恢复；预览中保留待机身体姿态。' },
  sleep_wait: { name: '睡眠待机', meaning: '睡眠状态下的待机动作片段，不代表独立攻击或宝具。' },
  spell: { name: '施法／技能动作', meaning: '施法、发动技能或剧情演出使用的身体动作。仅凭片段名称，不能确定对应哪一个具体技能。' },
  spell_loop: { name: '持续施法', meaning: '用于持续播放的施法动作片段；是否重复播放由“循环”开关控制。' },
  step_back: { name: '后退', meaning: '后退或离开目标时使用的动作片段，具体移动距离以原始动画内容为准。' },
  step_front: { name: '前进', meaning: '前进或接近目标时使用的动作片段，具体移动距离以原始动画内容为准。' },
  wait: { name: '待机', meaning: '等待行动时的姿态和呼吸等循环动作。不同变式可能对应不同站姿，编号不代表进化阶段。' },
};

export const isFgoNobleAnimation = (name: string) => /^treasureArms\d+_a$/.test(name);
export const fgoNobleClipCount = (entry: FgoCharacterEntry) => entry.animations.filter(clip => isFgoNobleAnimation(clip.name)).length;

const animationParts = (name: string) => {
  const treasure = /^treasureArms(\d+)_a$/.exec(name);
  const duplicate = / \((\d+)\)$/.exec(name);
  const unique = duplicate ? name.slice(0, duplicate.index) : name;
  const form = /_level_(\d+)$/.exec(unique);
  const motion = form ? unique.slice(0, form.index) : unique;
  const variant = /_?(\d+)$/.exec(motion);
  const base = variant ? motion.slice(0, variant.index) : motion;
  return { treasure, duplicate, form, variant, base };
};

export const fgoAnimationName = (name: string) => {
  const { treasure, duplicate, form, variant, base } = animationParts(name);
  if (treasure) return `宝具动作 · 片段 ${Number(treasure[1])}`;
  const label = MOTIONS[base]?.name ?? '其他动作';
  return label + (variant ? ` · 变式 ${Number(variant[1])}` : '')
    + (form ? ` · 形态 ${Number(form[1])}` : '')
    + (duplicate ? ` · 片段 ${Number(duplicate[1])}` : '');
};

export const fgoAnimationMeaning = (name: string) => {
  const { treasure, form, duplicate, base } = animationParts(name);
  if (treasure) return '宝具演出使用的角色身体与武器动作片段。完整演出还需要配套镜头、特效和事件时间轴；片段编号不代表第几个宝具，也不能据此确定拼接顺序。';
  return (MOTIONS[base]?.meaning ?? '此动作片段的具体用途尚未从原始数据确认。')
    + (form ? `此片段标有形态 ${Number(form[1])}。` : '')
    + (duplicate ? '同名片段按资源区分，附加编号不代表连续阶段。' : '');
};
