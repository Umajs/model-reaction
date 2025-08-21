import { ModelManager, Model, ValidationRules } from '../index';
import { Rule } from '../validators';

describe('ModelManager - Validation', () => {
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
    username: {
      type: 'string',
      validator: [
        ValidationRules.required,
        {
          type: 'asyncUnique',
          message: '用户名已存在',
          validate: async (value: string): Promise<boolean> => {
          return new Promise<boolean>((resolve) => {
            setTimeout(() => {
              resolve(value !== 'admin');
            }, 10);
          });
        }}
      ]
    }
  };

  let modelManager: ModelManager;

  beforeEach(() => {
    modelManager = new ModelManager(testSchema, { asyncValidationTimeout: 5000 });
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
  });

  // 异步验证规则测试
  test('should handle async validation rules', async () => {
    // 测试可用用户名
    const result1 = await modelManager.setField('username', 'newuser');
    expect(result1).toBe(true);
    expect(modelManager.validationErrors.username).toEqual([])

    // 测试已占用用户名
    const result2 = await modelManager.setField('username', 'admin');
    expect(result2).toBe(false);
    expect(modelManager.validationErrors.username).toBeDefined();
    expect(modelManager.getValidationSummary()).toContain('username: 用户名已存在');
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
  });
});