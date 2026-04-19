/**
 * UGC Builder 核心逻辑测试
 */

import { describe, it, expect } from 'vitest';
import { PromptGenerator, createEmptyContext } from '../ai';
import { BaseEntitySchema, extendSchema, field, getTableFields } from '../schema/types';
import { validateAbilityJson } from '../utils/validateAbilityJson';
import { buildRequirementsText } from '../utils/requirements';

describe('PromptGenerator', () => {
  const testContext = createEmptyContext();
  testContext.name = '测试游戏';
  testContext.schemas = [
    extendSchema(BaseEntitySchema, {
      id: 'card',
      name: '卡牌',
      description: '游戏卡牌',
      fields: {
        type: field.string('类型'),
        cost: field.number('费用'),
      },
    }),
  ];
  testContext.instances = {
    card: [
      { id: 'card1', name: '测试卡', type: '普通', cost: 3 },
    ],
  };

  it('应该创建 PromptGenerator 实例', () => {
    const generator = new PromptGenerator(testContext);
    expect(generator).toBeDefined();
  });

  it('应该生成完整提示词', () => {
    const generator = new PromptGenerator(testContext);
    const fullPrompt = generator.generateFullPrompt();
    
    expect(fullPrompt).toBeDefined();
    expect(fullPrompt.length).toBeGreaterThan(100);
  });
});

describe('需求汇总', () => {
  it('应拼接 rawText 与结构化条目', () => {
    const text = buildRequirementsText({
      rawText: '总体目标描述',
      entries: [
        { id: 'e1', location: '区域A', content: '需要显示资源', notes: '优先' },
        { id: 'e2', location: '', content: '支持快速切换', notes: '' },
      ],
    });

    expect(text).toContain('总体需求：总体目标描述');
    expect(text).toContain('[区域A] 需要显示资源（备注：优先）');
    expect(text).toContain('[未标注位置] 支持快速切换');
  });

  it('应追加临时输入需求', () => {
    const text = buildRequirementsText({ rawText: '', entries: [] }, '临时需求');
    expect(text).toContain('本次需求：临时需求');
  });
});

describe('能力 JSON 校验', () => {
  it('应通过有效的能力数据', () => {
    const data = [
      {
        id: 'entity-1',
        abilities: [
          {
            id: 'ability-1',
            name: '能力名称',
            trigger: { type: 'always' },
            effects: [
              {
                id: 'effect-1',
                operations: [
                  { type: 'modifyAttribute', target: 'self', attrId: 'hp', value: -1 },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = validateAbilityJson(data);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('应拦截缺失字段的能力数据', () => {
    const data = [
      {
        id: '',
        abilities: [
          {
            id: '',
            name: '',
            effects: [],
          },
        ],
      },
    ];
    const result = validateAbilityJson(data);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('Schema 工具函数', () => {
  it('extendSchema 应该正确扩展基础 Schema', () => {
    const extended = extendSchema(BaseEntitySchema, {
      id: 'test',
      name: '测试',
      description: '测试描述',
      fields: {
        customField: field.string('自定义字段'),
      },
    });

    expect(extended.id).toBe('test');
    expect(extended.name).toBe('测试');
    expect(extended.fields.id).toBeDefined(); // 继承自 BaseEntitySchema
    expect(extended.fields.name).toBeDefined(); // 继承自 BaseEntitySchema
    expect(extended.fields.customField).toBeDefined(); // 新增字段
  });

  it('getTableFields 应该返回可显示的字段', () => {
    const schema = extendSchema(BaseEntitySchema, {
      id: 'test',
      name: '测试',
      description: '',
      fields: {
        visible: field.string('可见字段'),
        hidden: field.string('隐藏字段', { showInTable: false }),
      },
    });

    const tableFields = getTableFields(schema);
    const fieldKeys = tableFields.map(f => f.key);

    expect(fieldKeys).toContain('id');
    expect(fieldKeys).toContain('name');
    expect(fieldKeys).toContain('visible');
    expect(fieldKeys).not.toContain('hidden');
  });

  it('field 工厂函数应该创建正确的字段定义', () => {
    const stringField = field.string('文本');
    expect(stringField.type).toBe('string');
    expect(stringField.label).toBe('文本');

    const numberField = field.number('数字');
    expect(numberField.type).toBe('number');

    const booleanField = field.boolean('布尔');
    expect(booleanField.type).toBe('boolean');

    const sfxKeyField = field.sfxKey('音效');
    expect(sfxKeyField.type).toBe('sfxKey');

    const tagsField = field.tags('标签');
    expect(tagsField.type).toBe('array');
    expect(tagsField.tagEditor).toBe(true);

    const abilitiesField = field.abilities('能力');
    expect(abilitiesField.type).toBe('abilities');
    expect(abilitiesField.aiGenerated).toBe(true);
  });
});

describe('createEmptyContext', () => {
  it('应该创建默认的游戏上下文', () => {
    const ctx = createEmptyContext();

    expect(ctx.name).toBe('新游戏'); // 默认名称
    expect(ctx.description).toBe('');
    expect(ctx.tags).toEqual([]);
    expect(ctx.schemas).toEqual([]);
    expect(ctx.instances).toEqual({});
    expect(ctx.layout).toEqual([]);
  });
});

describe('Schema 标签字段', () => {
  it('field.tags 应该创建带 tagEditor 的数组字段', () => {
    const tagsField = field.tags('标签');
    
    expect(tagsField.type).toBe('array');
    expect(tagsField.tagEditor).toBe(true);
    expect(tagsField.itemType).toBe('string');
  });
});

describe('Schema 字段类型', () => {
  it('应该支持 renderComponent 字段类型', () => {
    const schema = extendSchema(BaseEntitySchema, {
      id: 'card',
      name: '卡牌',
      description: '',
      fields: {
        renderComponent: {
          type: 'renderComponent',
          label: '渲染组件',
          showInTable: true,
        },
      },
    });
    
    expect(schema.fields.renderComponent.type).toBe('renderComponent');
  });

  it('应该支持所有基础字段类型', () => {
    const schema = extendSchema(BaseEntitySchema, {
      id: 'test',
      name: '测试',
      description: '',
      fields: {
        str: field.string('文本'),
        num: field.number('数字'),
        bool: field.boolean('布尔'),
        sfx: field.sfxKey('音效'),
        tags: field.tags('标签'),
        abilities: field.abilities('能力'),
      },
    });
    
    expect(schema.fields.str.type).toBe('string');
    expect(schema.fields.num.type).toBe('number');
    expect(schema.fields.bool.type).toBe('boolean');
    expect(schema.fields.sfx.type).toBe('sfxKey');
    expect(schema.fields.tags.type).toBe('array');
    expect(schema.fields.abilities.type).toBe('abilities');
  });
});

describe('保存/加载数据结构', () => {
  it('保存数据应包含所有必要字段', () => {
    // 模拟保存数据结构
    const saveData = {
      name: '测试游戏',
      description: '游戏描述',
      tags: ['tag1', 'tag2'],
      rulesCode: '(G, ctx) => ({})',
      schemas: [
        {
          id: 'card',
          name: '卡牌',
          fields: { name: field.string('名称') },
          tagDefinitions: [
            { name: '普通', group: '稀有度' },
            { name: '稀有', group: '稀有度' },
          ],
        },
      ],
      instances: {
        card: [{ id: 'card-1', name: '测试卡' }],
      },
      renderComponents: [
        { id: 'rc-1', name: '卡牌渲染', targetSchema: 'card', renderCode: '' },
      ],
      layout: [],
    };

    // 验证数据结构完整性
    expect(saveData.name).toBeDefined();
    expect(saveData.schemas).toBeDefined();
    expect(saveData.instances).toBeDefined();
    expect(saveData.renderComponents).toBeDefined();
    expect(saveData.layout).toBeDefined();
    expect(saveData.rulesCode).toBeDefined();
    
    // 验证 tagDefinitions 结构
    expect(saveData.schemas[0].tagDefinitions).toBeDefined();
    expect(saveData.schemas[0].tagDefinitions?.length).toBe(2);
    expect(saveData.schemas[0].tagDefinitions?.[0].group).toBe('稀有度');
  });

  it('JSON序列化和反序列化应保持数据完整', () => {
    const original = {
      schemas: [
        {
          id: 'test',
          name: '测试',
          fields: {},
          tagDefinitions: [
            { name: 'tag1', group: 'group1' },
            { name: 'tag2' }, // 无分组
          ],
        },
      ],
      renderComponents: [
        { id: 'rc-1', name: '组件1', targetSchema: 'test', renderCode: 'code' },
      ],
      rulesCode: 'function setup() {}',
    };

    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.schemas[0].tagDefinitions).toHaveLength(2);
    expect(deserialized.schemas[0].tagDefinitions[0].group).toBe('group1');
    expect(deserialized.schemas[0].tagDefinitions[1].group).toBeUndefined();
    expect(deserialized.renderComponents).toHaveLength(1);
    expect(deserialized.rulesCode).toBe('function setup() {}');
  });
});
