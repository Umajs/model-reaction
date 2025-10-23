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

  // Dirty data related tests
  test('should manage dirty data correctly', async () => {
    // dirtyData should be empty in initial state
    expect(modelManager.getDirtyData()).toEqual({});

    // After setting invalid value, verify dirtyData contains the field
    await modelManager.setField('age', 'invalid-age');
    expect(modelManager.getDirtyData()).toHaveProperty('age');
    expect(modelManager.getDirtyData().age).toBe('invalid-age');

    // After clearing dirtyData, verify it is empty
    modelManager.clearDirtyData();
    expect(modelManager.getDirtyData()).toEqual({});

    // After setting valid value, verify dirtyData does not contain the field
    await modelManager.setField('name', 'Valid Name');
    expect(modelManager.getDirtyData()).not.toHaveProperty('name');

    // Set another invalid value
    await modelManager.setField('email', 'invalid-email');
    expect(modelManager.getDirtyData()).toHaveProperty('email');

    // After fixing invalid value, verify dirtyData no longer contains the field
    await modelManager.setField('email', 'valid@example.com');
    expect(modelManager.getDirtyData()).not.toHaveProperty('email');
  });
});