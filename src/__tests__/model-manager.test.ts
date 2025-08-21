// 修复1: 导入Rule类
import { ModelManager, Model, ValidationRules } from '../index';
import { Rule } from '../validators';

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
    },
    email: {
      type: 'string',
      validator: [ValidationRules.required, ValidationRules.email],
      default: ''
    },
    // 用于测试异步验证的字段
    username: {
      type: 'string',
      validator: [
        ValidationRules.required,
        {
          type: 'asyncUnique',
          message: '用户名已存在',
          validate: async (value: string): Promise<boolean> => {
          // 模拟异步检查用户名是否已存在
          return new Promise<boolean>((resolve) => {
            setTimeout(() => {
              // 假设 'admin' 已被占用
              resolve(value !== 'admin');
            }, 10);
          });
        }}
      ]
    // 已移除 asyncErrorMessage 属性
    }
  };

  let modelManager: ModelManager;

  beforeEach(() => {
    modelManager = new ModelManager(testSchema, { asyncValidationTimeout: 5000 });
  });

  // 初始化测试
  test('should initialize with default values', () => {
    expect(modelManager.getField('name')).toBe('');
    expect(modelManager.getField('age')).toBe(18);
    expect(modelManager.getField('email')).toBe('');
    expect(modelManager.getField('username')).toBeUndefined();
  });

  // 异步设置字段测试
  test('should set valid field values asynchronously', async () => {
    const result = await modelManager.setField('name', 'Test User');
    expect(result).toBe(true);
    expect(modelManager.getField('name')).toBe('Test User');
  });

  // 异步验证失败测试
  test('should reject invalid field values and not update asynchronously', async () => {
    // 保存原始值
    const originalAge = modelManager.getField('age');
    
    // 尝试设置无效值
    const result = await modelManager.setField('age', 'not-a-number');
    
    // 验证返回值
    expect(result).toBe(false);
    // 验证值未被更新
    expect(modelManager.getField('age')).toBe(originalAge);
    // 验证错误信息
    expect(modelManager.getValidationSummary()).toContain('age: 必须为数字');
    // 验证dirtyData包含无效值
    expect(modelManager.getDirtyData()).toHaveProperty('age');
    expect(modelManager.getDirtyData().age).toBe('not-a-number');
  });

  // 异步整体验证测试
  test('should validate all fields asynchronously', async () => {
    modelManager.clearDirtyData();
    await modelManager.setField('name', '');
    await modelManager.setField('age', 15);

    const isValid = await modelManager.validateAll();
    expect(isValid).toBe(false);
    expect(modelManager.validationErrors).toHaveProperty('name');
    expect(modelManager.validationErrors).toHaveProperty('age');
    // 验证dirtyData
    expect(modelManager.getDirtyData()).toHaveProperty('name');
    expect(modelManager.getDirtyData()).toHaveProperty('age');

    await modelManager.setField('name', 'Valid Name');
    await modelManager.setField('age', 20);
    const isValidAfterFix = await modelManager.validateAll();
    expect(isValidAfterFix).toBe(false);
    // 验证dirtyData已清除
    modelManager.clearDirtyData();
    expect(modelManager.getDirtyData()).toEqual({});
  });

  // 异步验证规则测试
  test('should handle async validation rules', async () => {
    // 测试可用用户名
    const result1 = await modelManager.setField('username', 'newuser');
    expect(result1).toBe(true);
    expect(modelManager.validationErrors.username).toEqual([])
    // 验证dirtyData不包含有效数据
    expect(modelManager.getDirtyData()).not.toHaveProperty('username');

    // 测试已占用用户名
    const result2 = await modelManager.setField('username', 'admin');
    expect(result2).toBe(false);
    expect(modelManager.validationErrors.username).toBeDefined();
    // 验证错误消息
    expect(modelManager.getValidationSummary()).toContain('username: 用户名已存在');
    // 验证dirtyData包含无效值
    expect(modelManager.getDirtyData()).toHaveProperty('username');
    expect(modelManager.getDirtyData().username).toBe('admin');
  });

  // 异步验证超时测试
  test('should handle async validation timeout', async () => {
    // 创建一个会超时的验证器
    const timeoutSchema: Model = {
      slowField: {
        type: 'string',
        validator: [
          new Rule(
            'asyncTimeout',
            '验证超时',
            async () => {
              return new Promise<boolean>((resolve) => {
                // 这个验证会运行10秒，超过5秒的超时设置
                setTimeout(() => resolve(false), 10000);
              });
            }
          )
        ]
      }
    };
    const timeoutModel = new ModelManager(timeoutSchema, { asyncValidationTimeout: 100 });

    const result = await timeoutModel.setField('slowField', 'value');
    expect(result).toBe(false);
    expect(timeoutModel.getValidationSummary()).toContain('slowField: 验证失败: 验证超时');
    // 验证dirtyData
    expect(timeoutModel.getDirtyData()).toHaveProperty('slowField');
    expect(timeoutModel.getDirtyData().slowField).toBe('value');
  });

  // 无效批量更新测试
  test('should reject invalid batch updates asynchronously', async () => {
    const result = await modelManager.setFields({
      name: '',
      age: 'invalid',
      email: 'not-an-email'
    });
    expect(result).toBe(false);
    expect(modelManager.getValidationSummary()).toContain('name: 该字段为必填项');
    expect(modelManager.getValidationSummary()).toContain('age: 必须为数字');
    expect(modelManager.getValidationSummary()).toContain('email: 无效的邮箱格式');
    // 验证dirtyData包含所有无效字段
    expect(modelManager.getDirtyData()).toHaveProperty('name');
    expect(modelManager.getDirtyData()).toHaveProperty('age');
    expect(modelManager.getDirtyData()).toHaveProperty('email');
  });

  // 边界情况测试
  test('should handle null and undefined values correctly', async () => {
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

    await modelManager.setField('requiredField', null);
    await modelManager.validateAll();
    expect(modelManager.getValidationSummary()).toContain('requiredField: 该字段为必填项');
    // 验证dirtyData
    expect(modelManager.getDirtyData()).toHaveProperty('requiredField');
    expect(modelManager.getDirtyData().requiredField).toBeNull();
  });

  // 异步反应测试
  test('should trigger reactions when dependent fields change asynchronously', async () => {
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
    await modelManager.setField('firstName', 'John');
    await modelManager.setField('lastName', 'Doe');
    // 由于反应现在是异步的，我们需要等待一下
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(modelManager.getField('fullName')).toBe('John Doe');
  });

  // 批量更新字段测试
  test('should handle batch field updates asynchronously', async () => {
    const result = await modelManager.setFields({
      name: 'Batch User',
      age: 25,
      email: 'batch@example.com'
    });
    expect(result).toBe(true);
    expect(modelManager.getField('name')).toBe('Batch User');
    expect(modelManager.getField('age')).toBe(25);
    expect(modelManager.getField('email')).toBe('batch@example.com');
    // 验证dirtyData不包含有效数据
    expect(modelManager.getDirtyData()).toEqual({});
  });

  // 错误处理测试
  test('should handle reaction errors asynchronously', async () => {
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

    await modelManager.setField('input', 'error');
    // 等待反应执行
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(modelManager.validationErrors).toHaveProperty('__reactions');
    expect(modelManager.validationErrors?.__reactions?.[0]?.message).toContain('反应处理失败: 计算错误');
    // 验证dirtyData不受反应错误影响
    expect(modelManager.getDirtyData()).toEqual({});
  });

  // 边界值测试
  test('should handle boundary values for number validation', async () => {
    const boundarySchema: Model = {
      age: {
        type: 'number',
        validator: [ValidationRules.required, ValidationRules.number, ValidationRules.min(18)],
        default: 18
      }
    };
    const modelManager = new ModelManager(boundarySchema);

    // 边界值测试
    await modelManager.setField('age', 18);
    await modelManager.validateAll();
    expect(modelManager.getValidationSummary()).toBe('验证通过');
    // 验证dirtyData不包含有效数据
    expect(modelManager.getDirtyData()).toEqual({});

    await modelManager.setField('age', 17.9);
    await modelManager.validateAll();
    expect(modelManager.getValidationSummary()).toContain('age: 值必须大于等于18');
    // 验证dirtyData
    expect(modelManager.getDirtyData()).toHaveProperty('age');
    expect(modelManager.getDirtyData().age).toBe(17.9);

    await modelManager.setField('age', Number.MAX_SAFE_INTEGER);
    await modelManager.validateAll();
    // 大整数应该通过验证
    expect(modelManager.getValidationSummary()).toBe('验证通过');
    // 验证dirtyData不包含有效数据
    expect(modelManager.getDirtyData()).toEqual({});
  });

  // 不存在字段测试
  test('should handle non-existent field modification', async () => {
    // 捕获console.error输出
    console.error = jest.fn();
    
    const result = await modelManager.setField('nonexistentField', 'value');
    
    // 验证返回值
    expect(result).toBe(false);
    // 验证错误日志
    expect(console.error).toHaveBeenCalledWith('字段 nonexistentField 不存在于模型架构中');
    // 验证数据未被修改
    expect(modelManager.getField('nonexistentField')).toBeUndefined();
    // 验证dirtyData不包含不存在的字段
    expect(modelManager.getDirtyData()).not.toHaveProperty('nonexistentField');
  });

  // 无效依赖字段测试
  test('should handle invalid dependent fields in reaction', async () => {
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

    await modelManager.setField('validField', 'test');
    // 等待反应执行
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(console.error).toHaveBeenCalledWith('依赖字段 nonexistentField 未定义');
    // 验证dirtyData不受影响
    expect(modelManager.getDirtyData()).toEqual({});
  });

  // dirtyData相关测试
  test('should manage dirty data correctly', async () => {
    // 初始状态下dirtyData应为空
    expect(modelManager.getDirtyData()).toEqual({});

    // 设置无效值后，验证dirtyData包含该字段
    await modelManager.setField('age', 'invalid-age');
    expect(modelManager.getDirtyData()).toHaveProperty('age');
    expect(modelManager.getDirtyData().age).toBe('invalid-age');

    // 清除dirtyData后，验证其为空
    modelManager.clearDirtyData();
    expect(modelManager.getDirtyData()).toEqual({});

    // 设置有效值后，验证dirtyData不包含该字段
    await modelManager.setField('name', 'Valid Name');
    expect(modelManager.getDirtyData()).not.toHaveProperty('name');

    // 设置另一个无效值
    await modelManager.setField('email', 'invalid-email');
    expect(modelManager.getDirtyData()).toHaveProperty('email');

    // 修复无效值后，验证dirtyData中不再包含该字段
    await modelManager.setField('email', 'valid@example.com');
    expect(modelManager.getDirtyData()).not.toHaveProperty('email');
  });
});