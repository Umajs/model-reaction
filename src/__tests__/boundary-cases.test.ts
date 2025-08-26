import { createModel, Model, ValidationRules } from '../index';

describe('ModelManager - Boundary Cases', () => {
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
    const modelManager = createModel(nullableSchema);

    expect(modelManager.getField('nullableField')).toBeNull();

    await modelManager.setField('requiredField', null);
    await modelManager.validateAll();
    expect(modelManager.getValidationSummary()).toContain('requiredField: 该字段为必填项');
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
    const modelManager = createModel(boundarySchema);

    // 边界值测试
    await modelManager.setField('age', 18);
    await modelManager.validateAll();
    expect(modelManager.getValidationSummary()).toBe('验证通过');

    await modelManager.setField('age', 17.9);
    await modelManager.validateAll();
    expect(modelManager.getValidationSummary()).toContain('age: 值必须大于等于18');

    await modelManager.setField('age', Number.MAX_SAFE_INTEGER);
    await modelManager.validateAll();
    // 大整数应该通过验证
    expect(modelManager.getValidationSummary()).toBe('验证通过');
  });
});