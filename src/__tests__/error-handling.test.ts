import { createModel, Model, ErrorHandler, ErrorType } from '../index';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  // Test error subscription and triggering
  test('should subscribe to and trigger errors', () => {
    const validationErrorCallback = jest.fn();
    const unknownErrorCallback = jest.fn();

    // Subscribe to specific error type
    errorHandler.onError(ErrorType.VALIDATION, validationErrorCallback);
    // Subscribe to unknown error type
    errorHandler.onError(ErrorType.UNKNOWN, unknownErrorCallback);

    // Create and trigger validation error
    const validationError = errorHandler.createValidationError('name', 'Name cannot be empty');
    errorHandler.triggerError(validationError);

    // Validate callbacks were called
    expect(validationErrorCallback).toHaveBeenCalledWith(validationError);
    expect(unknownErrorCallback).toHaveBeenCalledWith(validationError);
  });

  // Test unsubscription
  test('should unsubscribe from errors', () => {
    const callback = jest.fn();

    errorHandler.onError(ErrorType.VALIDATION, callback);
    errorHandler.offError(ErrorType.VALIDATION, callback);

    const error = errorHandler.createValidationError('name', 'Name cannot be empty');
    errorHandler.triggerError(error);

    expect(callback).not.toHaveBeenCalled();
  });

  // Test error handling in ModelManager
  test('should handle errors in ModelManager', async () => {
    const testSchema: Model = {
      name: {
        type: 'string',
        validator: [],
        default: ''
      }
    };

    const modelManager = createModel(testSchema);
    const errorCallback = jest.fn();

    // Listen for field not found error
    modelManager.on('field:not-found', errorCallback);

    // Try to set non-existent field
    await modelManager.setField('nonexistentField', 'value');

    // Validate error was triggered
    expect(errorCallback).toHaveBeenCalled();
    expect(errorCallback.mock.calls[0][0].type).toBe(ErrorType.FIELD_NOT_FOUND);
    expect(errorCallback.mock.calls[0][0].field).toBe('nonexistentField');
  });
});