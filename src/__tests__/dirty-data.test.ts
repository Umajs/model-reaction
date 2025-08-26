import { createModel, Model, ModelReturn, ValidationRules } from '../index';

describe('ModelManager - Dirty Data Management', () => {
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
    }
  };

  let modelManager: ModelReturn;

  beforeEach(() => {
    modelManager = createModel(testSchema, { asyncValidationTimeout: 5000 });
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