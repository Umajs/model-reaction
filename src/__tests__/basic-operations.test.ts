import { createModel, ModelReturn, Model, ValidationRules, ErrorType } from '../index';

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

  let modelManager: ModelReturn;

  beforeEach(() => {
    modelManager = createModel(testSchema, { asyncValidationTimeout: 5000 });
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
    const errorCallback = jest.fn();
    modelManager.on('field:not-found', errorCallback);

    const result = await modelManager.setField('nonexistentField', 'value');

    // 验证返回值
    expect(result).toBe(false);
    // 验证错误回调被调用
    expect(errorCallback).toHaveBeenCalled();
    // 验证错误类型和字段
    expect(errorCallback.mock.calls[0][0].type).toBe(ErrorType.FIELD_NOT_FOUND);
    expect(errorCallback.mock.calls[0][0].field).toBe('nonexistentField');
    // 验证数据未被修改
    expect(modelManager.getField('nonexistentField')).toBeUndefined();
  });
});