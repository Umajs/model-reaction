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

  // Initialization test
  test('should initialize with default values', () => {
    expect(modelManager.getField('name')).toBe('');
    expect(modelManager.getField('age')).toBe(18);
  });

  // Asynchronous field setting test
  test('should set valid field values asynchronously', async () => {
    const result = await modelManager.setField('name', 'Test User');
    expect(result).toBe(true);
    expect(modelManager.getField('name')).toBe('Test User');
  });

  // Non-existent field test
  test('should handle non-existent field modification', async () => {
    const errorCallback = jest.fn();
    modelManager.on('field:not-found', errorCallback);

    const result = await modelManager.setField('nonexistentField', 'value');

    // Validate return value
    expect(result).toBe(false);
    // Validate error callback was called
    expect(errorCallback).toHaveBeenCalled();
    // Validate error type and field
    expect(errorCallback.mock.calls[0][0].type).toBe(ErrorType.FIELD_NOT_FOUND);
    expect(errorCallback.mock.calls[0][0].field).toBe('nonexistentField');
    // Validate data was not modified
    expect(modelManager.getField('nonexistentField')).toBeUndefined();
  });
});