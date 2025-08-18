import { ModelManager } from '../model-manager';
import { Model, Reaction, Validator } from '../types';
import { ValidationRules } from '../validators';

// 模拟异步验证器
const AsyncValidationRules = {
  // 模拟异步验证，延迟10ms
  asyncRequired: new class implements Validator {
    type = 'asyncRequired';
    message = '该字段为必填项（异步）';
    async validateAsync(value: any): Promise<boolean> {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(value !== undefined && value !== null && value !== '');
        }, 10);
      });
    }
  },

  // 模拟可能失败的异步验证
  asyncUnique: (existingValues: string[]) => {
    return new class implements Validator {
      type = 'asyncUnique';
      message = '该值已存在（异步）';
      async validateAsync(value: any): Promise<boolean> {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(!existingValues.includes(value));
          }, 10);
        });
      }
    };
  }
};

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

  test('should reject invalid field values', () => {
    const result = modelManager.setField('age', 'not-a-number');
    expect(result).toBe(false);
    expect(modelManager.getValidationSummary()).toContain('age: 必须为数字');
  });

  test('should validate all fields', () => {
    modelManager.setField('name', '');
    modelManager.setField('age', 15);

    const isValid = modelManager.validateAll();
    expect(isValid).toBe(false);
    expect(modelManager.validationErrors).toHaveProperty('name');

    modelManager.setField('age', 'Test User');
    expect(modelManager.validationErrors).toHaveProperty('age');
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
                action: () => {}
            }
        }
    };
    const modelManager = new ModelManager(reactionSchema);
    modelManager.setField('firstName', 'John');
    modelManager.setField('lastName', 'Doe');
    // 使用setTimeout等待反应执行
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

  test('should handle async reaction with debounce', (done) => {
    const asyncReactionSchema: Model = {
      value1: { type: 'number', default: 0 },
      value2: { type: 'number', default: 0 },
      sum: {
        type: 'number',
        default: 0,
        reaction: {
          fields: ['value1', 'value2'],
          computed: async (values) => {
            return new Promise(resolve => {
              setTimeout(() => {
                resolve(values.value1 + values.value2);
              }, 20);
            });
          },
          action: () => {}
        }
      }
    };
    const modelManager = new ModelManager(asyncReactionSchema, { debounceReactions: 10 });

    modelManager.setField('value1', 5);
    modelManager.setField('value2', 10);

    // 等待异步计算和防抖完成
    setTimeout(() => {
      expect(modelManager.getField('sum')).toBe(15);
      done();
    }, 50);
  });

  // 新增错误处理测试
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
          action: () => {}
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
    const invalidDepsSchema: Model = {
      validField: { type: 'string', default: 'valid' },
      invalidField: {
        type: 'string',
        default: '',
        reaction: {
          fields: ['validField', 'nonexistentField'], // 依赖不存在的字段
          computed: (values) => values.validField + values.nonexistentField,
          action: () => {}
        }
      }
    };
    const modelManager = new ModelManager(invalidDepsSchema);

    modelManager.setField('validField', 'test');

    setTimeout(() => {
      expect(modelManager.validationErrors).toHaveProperty('__reactions');
      expect(modelManager.validationErrors?.__reactions?.[0]?.message).toContain('依赖字段 nonexistentField 未定义');
      done();
    }, 0);
  });

  // 新增边缘情况测试
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

    const result = modelManager.setField('requiredField', null);
    expect(result).toBe(false);
    expect(modelManager.getValidationSummary()).toContain('requiredField: 该字段为必填项');
  });

  test('should handle boundary values for number validation', () => {
    const boundarySchema: Model = {
      age: {
        type: 'number',
        validator: [ValidationRules.required, ValidationRules.number, ValidationRules.min(18), ValidationRules.min(18)],
        default: 18
      }
    };
    const modelManager = new ModelManager(boundarySchema);

    // 边界值测试
    const justRight = modelManager.setField('age', 18);
    expect(justRight).toBe(true);

    const tooYoung = modelManager.setField('age', 17.9);
    expect(tooYoung).toBe(false);

    const maxAge = modelManager.setField('age', Number.MAX_SAFE_INTEGER);
    expect(maxAge).toBe(true);

    const minAge = modelManager.setField('age', Number.MIN_SAFE_INTEGER);
    expect(minAge).toBe(false);
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
          action: () => {}
        }
      },
      squared: {
        type: 'number',
        default: 0,
        reaction: {
          fields: ['value'],
          computed: (values) => values.value * values.value,
          action: () => {}
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
          action: () => {}
        }
      },
      c: {
        type: 'number',
        default: 0,
        reaction: {
          fields: ['b'],
          computed: (values) => values.b * 3,
          action: () => {}
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
});