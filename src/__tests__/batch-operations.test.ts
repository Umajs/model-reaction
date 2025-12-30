import { createModel, ModelReturn, Model, ValidationRules } from '../index';

describe('ModelManager - Batch Operations', () => {
    const testSchema: Model = {
        name: {
            type: 'string',
            validator: [ValidationRules.required],
            default: '',
        },
        age: {
            type: 'number',
            validator: [ValidationRules.required, ValidationRules.number, ValidationRules.min(18)],
            default: 18,
        },
        email: {
            type: 'string',
            validator: [ValidationRules.required, ValidationRules.email],
            default: '',
        },
    };

    let modelManager: ModelReturn;

    beforeEach(() => {
        modelManager = createModel(testSchema, { asyncValidationTimeout: 5000 });
    });

    // Batch field update test
    test('should handle batch field updates asynchronously', async () => {
        const result = await modelManager.setFields({
            name: 'Batch User',
            age: 25,
            email: 'batch@example.com',
        });
        expect(result).toBe(true);
        expect(modelManager.getField('name')).toBe('Batch User');
        expect(modelManager.getField('age')).toBe(25);
        expect(modelManager.getField('email')).toBe('batch@example.com');
        // Validate dirtyData does not contain valid data
        expect(modelManager.getDirtyData()).toEqual({});
    });
});
