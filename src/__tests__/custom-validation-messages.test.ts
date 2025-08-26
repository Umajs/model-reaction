import { createModel, Model, ValidationRules, Rule, ModelReturn } from '../index';

describe('ModelManager - Custom Validation Messages', () => {
  const testSchema: Model = {
    name: {
      type: 'string',
      validator: [ValidationRules.required.withMessage('名称不能为空')],
      default: ''
    },
    age: {
      type: 'number',
      validator: [
        ValidationRules.required.withMessage('年龄必须填写'),
        ValidationRules.number.withMessage('年龄必须是数字'),
        ValidationRules.min(18).withMessage('年龄必须满18岁')
      ],
      default: 18
    },
    email: {
      type: 'string',
      validator: [
        ValidationRules.required,
        ValidationRules.email.withMessage('请输入有效的邮箱地址')
      ],
      default: ''
    },
    customRule: {
      type: 'string',
      validator: [
        new Rule('customPattern', '默认错误消息', (value: string) => {
          return value.startsWith('custom_');
        }).withMessage('值必须以 custom_ 开头')
      ]
    }
  };

  let modelManager: ModelReturn;

  beforeEach(() => {
    modelManager = createModel(testSchema);
  });

  // 测试自定义必填消息
  test('should use custom required message', async () => {
    await modelManager.setField('name', '');
    expect(modelManager.getValidationSummary()).toContain('name: 名称不能为空');
  });

  // 测试自定义数字消息
  test('should use custom number message', async () => {
    await modelManager.setField('age', 'not-a-number');
    expect(modelManager.getValidationSummary()).toContain('age: 年龄必须是数字');
  });

  // 测试自定义最小值消息
  test('should use custom min message', async () => {
    await modelManager.setField('age', 16);
    expect(modelManager.getValidationSummary()).toContain('age: 年龄必须满18岁');
  });

  // 测试自定义邮箱消息
  test('should use custom email message', async () => {
    await modelManager.setField('email', 'invalid-email');
    expect(modelManager.getValidationSummary()).toContain('email: 请输入有效的邮箱地址');
  });

  // 测试自定义规则消息
  test('should use custom rule message', async () => {
    await modelManager.setField('customRule', 'wrong_value');
    expect(modelManager.getValidationSummary()).toContain('customRule: 值必须以 custom_ 开头');
  });

  // 测试未自定义的消息使用默认值
  test('should use default message when custom message is not set', async () => {
    await modelManager.setField('email', '');
    expect(modelManager.getValidationSummary()).toContain('email: 该字段为必填项');
  });
});