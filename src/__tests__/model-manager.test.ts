import { ModelManager, Model, ValidationRules } from '../index';

// 注意：已移除异步验证器，因为代码不再支持异步验证

describe('ModelManager', () => {
  const testSchema: Model = {
    name: {
      type: 'string',
      validator: [ValidationRules.required],
      default: ''
    },
    age: {
      type: 'number',
      validator: [ValidationRules.required, ValidationRules.number, ValidationRules.min(18)],
      default: 18
    }
  };

  let modelManager: ModelManager;

  beforeEach(() => {
    modelManager = new ModelManager(testSchema);
  });

  // 现有测试用例
  test('should initialize with default values', () => {
    expect(modelManager.getField('name')).toBe('');
    expect(modelManager.getField('age')).toBe(18);
  });

  test('should set valid field values', () => {
    const result = modelManager.setField('name', 'Test User');
    expect(result).toBe(true);
    expect(modelManager.getField('name')).toBe('Test User');
  });

  test('should reject invalid field values and not update', () => {
    // 保存原始值
    const originalAge = modelManager.getField('age');
    
    // 尝试设置无效值
    const result = modelManager.setField('age', 'not-a-number');
    
    // 验证返回值
    expect(result).toBe(false);
    // 验证值未被更新
    expect(modelManager.getField('age')).toBe(originalAge);
    // 验证错误信息
    expect(modelManager.getValidationSummary()).toContain('age: 必须为数字');
  });

  test('should validate all fields', () => {
    modelManager.setField('name', '');
    modelManager.setField('age', 15);

    const isValid = modelManager.validateAll();
    expect(isValid).toBe(false);
    expect(modelManager.validationErrors).toHaveProperty('name');
    expect(modelManager.validationErrors).toHaveProperty('age');

    modelManager.setField('name', 'Valid Name');
    modelManager.setField('age', 20);
    const isValidAfterFix = modelManager.validateAll();
    expect(isValidAfterFix).toBe(true);
  });

  test('should trigger reactions when dependent fields change', (done) => {
    const reactionSchema: Model = {
        firstName: { type: 'string', default: '' },
        lastName: { type: 'string', default: '' },
        fullName: {
            type: 'string',
            default: '',
            reaction: {
                fields: ['firstName', 'lastName'],
                computed: (values) => `${values.firstName} ${values.lastName}`,
            }
        }
    };
    const modelManager = new ModelManager(reactionSchema);
    modelManager.setField('firstName', 'John');
    modelManager.setField('lastName', 'Doe');
    // 在下一个事件循环中检查结果
    setTimeout(() => {
        expect(modelManager.getField('fullName')).toBe('John Doe');
        done();
    }, 0);
  });

  test('should handle non-existent field modification', () => {
    // 捕获console.error输出
    console.error = jest.fn();
    
    const result = modelManager.setField('nonexistentField', 'value');
    
    // 验证返回值
    expect(result).toBe(false);
    // 验证错误日志
    expect(console.error).toHaveBeenCalledWith('字段 nonexistentField 不存在于模型架构中');
    // 验证数据未被修改
    expect(modelManager.getField('nonexistentField')).toBeUndefined();
  });

  // 错误处理测试
  test('should handle reaction errors', (done) => {
    const errorReactionSchema: Model = {
      input: { type: 'string', default: '' },
      output: {
        type: 'string',
        default: '',
        reaction: {
          fields: ['input'],
          computed: (values) => {
            if (values.input === 'error') {
              throw new Error('计算错误');
            }
            return values.input.toUpperCase();
          },
        }
      }
    };
    const modelManager = new ModelManager(errorReactionSchema);

    modelManager.setField('input', 'error');

    setTimeout(() => {
      expect(modelManager.validationErrors).toHaveProperty('__reactions');
      expect(modelManager.validationErrors?.__reactions?.[0]?.message).toContain('反应处理失败: 计算错误');
      done();
    }, 0);
  });

  test('should handle invalid dependent fields in reaction', (done) => {
    // 捕获console.error输出
    console.error = jest.fn();

    const invalidDepsSchema: Model = {
      validField: { type: 'string', default: 'valid' },
      invalidField: {
        type: 'string',
        default: '',
        reaction: {
          fields: ['validField', 'nonexistentField'], // 依赖不存在的字段
          computed: (values) => values.validField + (values.nonexistentField || ''),
        }
      }
    };
    const modelManager = new ModelManager(invalidDepsSchema);

    modelManager.setField('validField', 'test');

    setTimeout(() => {
      expect(console.error).toHaveBeenCalledWith('依赖字段 nonexistentField 未定义');
      done();
    }, 0);
  });

  // 边缘情况测试
  test('should handle null and undefined values correctly', () => {
    const nullableSchema: Model = {
      nullableField: {
        type: 'string',
        validator: [],
        default: null
      },
      requiredField: {
        type: 'string',
        validator: [ValidationRules.required],
        default: ''
      }
    };
    const modelManager = new ModelManager(nullableSchema);

    expect(modelManager.getField('nullableField')).toBeNull();

    modelManager.setField('requiredField', null);
    modelManager.validateAll();
    expect(modelManager.getValidationSummary()).toContain('requiredField: 该字段为必填项');
  });

  test('should handle boundary values for number validation', () => {
    const boundarySchema: Model = {
      age: {
        type: 'number',
        validator: [ValidationRules.required, ValidationRules.number, ValidationRules.min(18)],
        default: 18
      }
    };
    const modelManager = new ModelManager(boundarySchema);

    // 边界值测试
    modelManager.setField('age', 18);
    modelManager.validateAll();
    expect(modelManager.getValidationSummary()).toBe('验证通过');

    modelManager.setField('age', 17.9);
    modelManager.validateAll();
    expect(modelManager.getValidationSummary()).toContain('age: 值必须大于等于18');

    modelManager.setField('age', Number.MAX_SAFE_INTEGER);
    modelManager.validateAll();
    expect(modelManager.getValidationSummary()).toBe('验证通过');

    modelManager.setField('age', Number.MIN_SAFE_INTEGER);
    modelManager.validateAll();
    expect(modelManager.getValidationSummary()).toContain('age: 值必须大于等于18');
  });

  test('should handle multiple reactions on the same field', (done) => {
    const multipleReactionsSchema: Model = {
      value: { type: 'number', default: 0 },
      doubled: {
        type: 'number',
        default: 0,
        reaction: {
          fields: ['value'],
          computed: (values) => values.value * 2,
        }
      },
      squared: {
        type: 'number',
        default: 0,
        reaction: {
          fields: ['value'],
          computed: (values) => values.value * values.value,
        }
      }
    };
    const modelManager = new ModelManager(multipleReactionsSchema);

    modelManager.setField('value', 5);

    setTimeout(() => {
      expect(modelManager.getField('doubled')).toBe(10);
      expect(modelManager.getField('squared')).toBe(25);
      done();
    }, 0);
  });

  test('should handle reaction chain', (done) => {
    const chainReactionSchema: Model = {
      a: { type: 'number', default: 1 },
      b: {
        type: 'number',
        default: 0,
        reaction: {
          fields: ['a'],
          computed: (values) => values.a * 2,
        }
      },
      c: {
        type: 'number',
        default: 0,
        reaction: {
          fields: ['b'],
          computed: (values) => values.b * 3,
        }
      }
    };
    const modelManager = new ModelManager(chainReactionSchema);

    modelManager.setField('a', 2);

    setTimeout(() => {
      expect(modelManager.getField('b')).toBe(4);
      expect(modelManager.getField('c')).toBe(12);
      done();
    }, 0);
  });

  // 缓存测试
  test('should use reaction cache when dependencies not changed', (done) => {
    let computeCount = 0;
    const cachedReactionSchema: Model = {
      value: { type: 'number', default: 0 },
      computedValue: {
        type: 'number',
        default: 0,
        reaction: {
          fields: ['value'],
          computed: (values) => {
            computeCount++;
            return values.value * 2;
          },
        }
      }
    };
    const modelManager = new ModelManager(cachedReactionSchema);

    // 第一次设置值，应该触发计算
    modelManager.setField('value', 5);

    setTimeout(() => {
      expect(modelManager.getField('computedValue')).toBe(10);
      expect(computeCount).toBe(1);

      // 再次设置相同的值，不应该触发计算
      modelManager.setField('value', 5);

      setTimeout(() => {
        expect(modelManager.getField('computedValue')).toBe(10);
        expect(computeCount).toBe(1); // 计数不变
        done();
      }, 0);
    }, 0);
  });

  // 新增测试：验证setField在验证失败时不更新值
  test('setField should not update value when validation fails', () => {
    // 初始值
    expect(modelManager.getField('age')).toBe(18);

    // 尝试设置无效值
    const result = modelManager.setField('age', 15);
    
    // 验证返回值
    expect(result).toBe(false);
    // 验证值未被更新
    expect(modelManager.getField('age')).toBe(18);
    // 验证错误信息
    expect(modelManager.getValidationSummary()).toContain('age: 值必须大于等于18');
  });

  // 新增测试：验证setField在验证通过时更新值
  test('setField should update value when validation passes', () => {
    // 尝试设置有效值
    const result = modelManager.setField('age', 20);
    
    // 验证返回值
    expect(result).toBe(true);
    // 验证值已被更新
    expect(modelManager.getField('age')).toBe(20);
    // 验证无错误信息
    expect(modelManager.getValidationSummary()).toBe('验证通过');
  });

  // 新增测试：验证transform不影响验证结果
  test('setField should validate transformed value correctly', () => {
    const transformSchema: Model = {
      age: {
        type: 'number',
        validator: [ValidationRules.required, ValidationRules.number, ValidationRules.min(18)],
        transform: (value) => parseInt(value as string, 10),
        default: 18
      }
    };
    const modelManager = new ModelManager(transformSchema);

    // 测试有效转换
    let result = modelManager.setField('age', '20');
    expect(result).toBe(true);
    expect(modelManager.getField('age')).toBe(20);

    // 测试无效转换
    result = modelManager.setField('age', '15');
    expect(result).toBe(false);
    expect(modelManager.getField('age')).toBe(20); // 保持之前的有效值
  });
});