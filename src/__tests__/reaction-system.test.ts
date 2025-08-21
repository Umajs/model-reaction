import { ModelManager, Model } from '../index';

describe('ModelManager - Reaction System', () => {
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
  });
});