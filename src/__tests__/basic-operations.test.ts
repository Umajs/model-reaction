import { ModelManager, Model, ValidationRules } from '../index';
import { Rule } from '../validators';

describe('ModelManager - Basic Operations', () => {
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
    modelManager = new ModelManager(testSchema, { asyncValidationTimeout: 5000 });
  });

  // 初始化测试
  test('should initialize with default values', () => {
    expect(modelManager.getField('name')).toBe('');
    expect(modelManager.getField('age')).toBe(18);
  });

  // 异步设置字段测试
  test('should set valid field values asynchronously', async () => {
    const result = await modelManager.setField('name', 'Test User');
    expect(result).toBe(true);
    expect(modelManager.getField('name')).toBe('Test User');
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
  });
});