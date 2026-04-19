export interface AbilityJsonValidationResult {
  isValid: boolean;
  errors: string[];
}

const allowedTargetRefs = new Set(['self', 'target', 'allPlayers', 'allEnemies']);
const allowedConditionOps = new Set(['<', '<=', '=', '>=', '>']);
const allowedExpressionTypes = new Set([
  'attribute',
  'multiply',
  'add',
  'subtract',
  'min',
  'max',
]);
const allowedOperationTypes = new Set([
  'modifyAttribute',
  'setAttribute',
  'addTag',
  'removeTag',
  'custom',
]);
const allowedConditionTypes = new Set([
  'always',
  'hasTag',
  'attributeCompare',
  'and',
  'or',
  'not',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const pushError = (errors: string[], path: string, message: string) => {
  errors.push(`${path}: ${message}`);
};

const validateTargetRef = (value: unknown, path: string, errors: string[]) => {
  if (typeof value === 'string') {
    if (!allowedTargetRefs.has(value)) {
      pushError(errors, path, `无效 target 值：${value}`);
    }
    return;
  }
  if (isRecord(value)) {
    if (!isNonEmptyString(value.entityId)) {
      pushError(errors, path, 'target.entityId 必须是非空字符串');
    }
    return;
  }
  pushError(errors, path, 'target 必须是字符串或 { entityId }');
};

const validateExpression = (value: unknown, path: string, errors: string[]) => {
  if (isNumber(value)) return;
  if (!isRecord(value) || !isNonEmptyString(value.type)) {
    pushError(errors, path, 'Expression 必须是数字或带 type 的对象');
    return;
  }

  if (!allowedExpressionTypes.has(value.type)) {
    pushError(errors, path, `Expression.type 无效：${value.type}`);
    return;
  }

  if (value.type === 'attribute') {
    if (!isNonEmptyString(value.entityId)) {
      pushError(errors, `${path}.entityId`, '必须是非空字符串');
    }
    if (!isNonEmptyString(value.attrId)) {
      pushError(errors, `${path}.attrId`, '必须是非空字符串');
    }
    return;
  }

  if (!('left' in value) || !('right' in value)) {
    pushError(errors, path, '表达式缺少 left/right');
    return;
  }
  validateExpression(value.left, `${path}.left`, errors);
  validateExpression(value.right, `${path}.right`, errors);
};

const validateCondition = (value: unknown, path: string, errors: string[]) => {
  if (!isRecord(value) || !isNonEmptyString(value.type)) {
    pushError(errors, path, '条件必须是带 type 的对象');
    return;
  }

  if (!allowedConditionTypes.has(value.type)) {
    pushError(errors, path, `条件 type 无效：${value.type}`);
    return;
  }

  switch (value.type) {
    case 'always':
      return;
    case 'hasTag':
      validateTargetRef(value.target, `${path}.target`, errors);
      if (!isNonEmptyString(value.tagId)) {
        pushError(errors, `${path}.tagId`, '必须是非空字符串');
      }
      if (value.minStacks !== undefined && !isNumber(value.minStacks)) {
        pushError(errors, `${path}.minStacks`, '必须是数字');
      }
      return;
    case 'attributeCompare':
      validateTargetRef(value.target, `${path}.target`, errors);
      if (!isNonEmptyString(value.attrId)) {
        pushError(errors, `${path}.attrId`, '必须是非空字符串');
      }
      if (!isNonEmptyString(value.op) || !allowedConditionOps.has(value.op)) {
        pushError(errors, `${path}.op`, '必须是 < <= = >= > 之一');
      }
      validateExpression(value.value, `${path}.value`, errors);
      return;
    case 'and':
    case 'or': {
      if (!Array.isArray(value.conditions) || value.conditions.length === 0) {
        pushError(errors, `${path}.conditions`, '必须是非空数组');
        return;
      }
      value.conditions.forEach((condition, index) => {
        validateCondition(condition, `${path}.conditions[${index}]`, errors);
      });
      return;
    }
    case 'not':
      if (!('condition' in value)) {
        pushError(errors, `${path}.condition`, '缺少 condition');
        return;
      }
      validateCondition(value.condition, `${path}.condition`, errors);
      return;
  }
};

const validateOperation = (value: unknown, path: string, errors: string[]) => {
  if (!isRecord(value) || !isNonEmptyString(value.type)) {
    pushError(errors, path, 'operation 必须是带 type 的对象');
    return;
  }
  if (!allowedOperationTypes.has(value.type)) {
    pushError(errors, path, `operation.type 无效：${value.type}`);
    return;
  }

  switch (value.type) {
    case 'modifyAttribute':
    case 'setAttribute':
      validateTargetRef(value.target, `${path}.target`, errors);
      if (!isNonEmptyString(value.attrId)) {
        pushError(errors, `${path}.attrId`, '必须是非空字符串');
      }
      validateExpression(value.value, `${path}.value`, errors);
      return;
    case 'addTag':
      validateTargetRef(value.target, `${path}.target`, errors);
      if (!isNonEmptyString(value.tagId)) {
        pushError(errors, `${path}.tagId`, '必须是非空字符串');
      }
      if (value.stacks !== undefined && !isNumber(value.stacks)) {
        pushError(errors, `${path}.stacks`, '必须是数字');
      }
      if (value.duration !== undefined && !isNumber(value.duration)) {
        pushError(errors, `${path}.duration`, '必须是数字');
      }
      return;
    case 'removeTag':
      validateTargetRef(value.target, `${path}.target`, errors);
      if (!isNonEmptyString(value.tagId)) {
        pushError(errors, `${path}.tagId`, '必须是非空字符串');
      }
      if (value.stacks !== undefined && !isNumber(value.stacks)) {
        pushError(errors, `${path}.stacks`, '必须是数字');
      }
      return;
    case 'custom':
      if (!isNonEmptyString(value.actionId)) {
        pushError(errors, `${path}.actionId`, '必须是非空字符串');
      }
      if (value.params !== undefined && !isRecord(value.params)) {
        pushError(errors, `${path}.params`, '必须是对象');
      }
      return;
  }
};

const validateEffect = (value: unknown, path: string, errors: string[]) => {
  if (!isRecord(value)) {
    pushError(errors, path, 'Effect 必须是对象');
    return;
  }
  if (!isNonEmptyString(value.id)) {
    pushError(errors, `${path}.id`, '必须是非空字符串');
  }
  if (!Array.isArray(value.operations) || value.operations.length === 0) {
    pushError(errors, `${path}.operations`, '必须是非空数组');
  } else {
    value.operations.forEach((op, index) => {
      validateOperation(op, `${path}.operations[${index}]`, errors);
    });
  }
  if (value.condition !== undefined) {
    validateCondition(value.condition, `${path}.condition`, errors);
  }
};

const validateAbilityVariant = (value: unknown, path: string, errors: string[]) => {
  if (!isRecord(value)) {
    pushError(errors, path, 'variant 必须是对象');
    return;
  }
  if (!isNonEmptyString(value.id)) {
    pushError(errors, `${path}.id`, '必须是非空字符串');
  }
  if (!Array.isArray(value.effects) || value.effects.length === 0) {
    pushError(errors, `${path}.effects`, '必须是非空数组');
  } else {
    value.effects.forEach((effect, index) => {
      validateEffect(effect, `${path}.effects[${index}]`, errors);
    });
  }
  if (value.trigger !== undefined) {
    validateCondition(value.trigger, `${path}.trigger`, errors);
  }
  if (value.priority !== undefined && !isNumber(value.priority)) {
    pushError(errors, `${path}.priority`, '必须是数字');
  }
  if (value.tags !== undefined) {
    if (!Array.isArray(value.tags) || !value.tags.every(isNonEmptyString)) {
      pushError(errors, `${path}.tags`, '必须是字符串数组');
    }
  }
};

const validateAbility = (value: unknown, path: string, errors: string[]) => {
  if (!isRecord(value)) {
    pushError(errors, path, 'ability 必须是对象');
    return;
  }
  if (!isNonEmptyString(value.id)) {
    pushError(errors, `${path}.id`, '必须是非空字符串');
  }
  if (!isNonEmptyString(value.name)) {
    pushError(errors, `${path}.name`, '必须是非空字符串');
  }
  if (value.tags !== undefined) {
    if (!Array.isArray(value.tags) || !value.tags.every(isNonEmptyString)) {
      pushError(errors, `${path}.tags`, '必须是字符串数组');
    }
  }
  if (value.trigger !== undefined) {
    validateCondition(value.trigger, `${path}.trigger`, errors);
  }
  if (value.effects !== undefined) {
    if (!Array.isArray(value.effects) || value.effects.length === 0) {
      pushError(errors, `${path}.effects`, '必须是非空数组');
    } else {
      value.effects.forEach((effect, index) => {
        validateEffect(effect, `${path}.effects[${index}]`, errors);
      });
    }
  }
  if (value.variants !== undefined) {
    if (!Array.isArray(value.variants) || value.variants.length === 0) {
      pushError(errors, `${path}.variants`, '必须是非空数组');
    } else {
      value.variants.forEach((variant, index) => {
        validateAbilityVariant(variant, `${path}.variants[${index}]`, errors);
      });
    }
  }
  if (!value.effects && !value.variants) {
    pushError(errors, path, 'effects 或 variants 至少需要一个');
  }
  if (value.cooldown !== undefined && !isNumber(value.cooldown)) {
    pushError(errors, `${path}.cooldown`, '必须是数字');
  }
  if (value.cost !== undefined) {
    if (!isRecord(value.cost)) {
      pushError(errors, `${path}.cost`, '必须是对象');
    } else {
      Object.entries(value.cost).forEach(([key, amount]) => {
        if (!isNonEmptyString(key) || !isNumber(amount)) {
          pushError(errors, `${path}.cost.${key}`, '资源消耗必须是数字');
        }
      });
    }
  }
};

export function validateAbilityJson(data: unknown): AbilityJsonValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(data)) {
    return { isValid: false, errors: ['输入必须是 JSON 数组'] };
  }

  data.forEach((entity, index) => {
    const basePath = `entities[${index}]`;
    if (!isRecord(entity)) {
      pushError(errors, basePath, '实体必须是对象');
      return;
    }
    if (!isNonEmptyString(entity.id)) {
      pushError(errors, `${basePath}.id`, '必须是非空字符串');
    }
    if (!Array.isArray(entity.abilities)) {
      pushError(errors, `${basePath}.abilities`, '必须是数组');
      return;
    }
    if (entity.abilities.length === 0) {
      pushError(errors, `${basePath}.abilities`, '不能为空');
      return;
    }
    entity.abilities.forEach((ability, abilityIndex) => {
      validateAbility(ability, `${basePath}.abilities[${abilityIndex}]`, errors);
    });
  });

  return { isValid: errors.length === 0, errors };
}
