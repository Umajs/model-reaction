import { ModelManager, Model, ErrorHandler, ErrorType } from '../index';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  // 测试错误订阅和触发
  test('should subscribe to and trigger errors', () => {
    const validationErrorCallback = jest.fn();
    const unknownErrorCallback = jest.fn();

    // 订阅特定类型错误
    errorHandler.onError(ErrorType.VALIDATION, validationErrorCallback);
    // 订阅未知类型错误
    errorHandler.onError(ErrorType.UNKNOWN, unknownErrorCallback);

    // 创建并触发验证错误
    const validationError = errorHandler.createValidationError('name', '名称不能为空');
    errorHandler.triggerError(validationError);

    // 验证回调被调用
    expect(validationErrorCallback).toHaveBeenCalledWith(validationError);
    expect(unknownErrorCallback).toHaveBeenCalledWith(validationError);
  });

  // 测试取消订阅
  test('should unsubscribe from errors', () => {
    const callback = jest.fn();

    errorHandler.onError(ErrorType.VALIDATION, callback);
    errorHandler.offError(ErrorType.VALIDATION, callback);

    const error = errorHandler.createValidationError('name', '名称不能为空');
    errorHandler.triggerError(error);

    expect(callback).not.toHaveBeenCalled();
  });

  // 测试ModelManager中的错误处理
  test('should handle errors in ModelManager', async () => {
    const testSchema: Model = {
      name: {
        type: 'string',
        validator: [],
        default: ''
      }
    };

    const modelManager = new ModelManager(testSchema);
    const errorCallback = jest.fn();

    // 监听字段不存在错误
    modelManager.on('field:not-found', errorCallback);

    // 尝试设置不存在的字段
    await modelManager.setField('nonexistentField', 'value');

    // 验证错误被触发
    expect(errorCallback).toHaveBeenCalled();
    expect(errorCallback.mock.calls[0][0].type).toBe(ErrorType.FIELD_NOT_FOUND);
    expect(errorCallback.mock.calls[0][0].field).toBe('nonexistentField');
  });
});