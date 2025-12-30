import { createModel, Model, ValidationRules, Rule, ModelReturn } from '../index';

describe('ModelManager - Validation', () => {
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
        username: {
            type: 'string',
            validator: [
                ValidationRules.required,
                {
                    type: 'asyncUnique',
                    message: 'Username already exists',
                    validate: async (value: string): Promise<boolean> => {
                        return new Promise<boolean>((resolve) => {
                            setTimeout(() => {
                                resolve(value !== 'admin');
                            }, 10);
                        });
                    },
                },
            ],
        },
    };

    let modelManager: ModelReturn;

    beforeEach(() => {
        modelManager = createModel(testSchema, { asyncValidationTimeout: 5000 });
    });

    // Asynchronous validation failure test
    test('should reject invalid field values and not update asynchronously', async () => {
        // Save original value
        const originalAge = modelManager.getField('age');

        // Try to set invalid value
        const result = await modelManager.setField('age', 'not-a-number');

        // Validate return value
        expect(result).toBe(false);
        // Validate value not updated
        expect(modelManager.getField('age')).toBe(originalAge);
        // Validate error message
        expect(modelManager.getValidationSummary()).toContain('age: Must be a number');
    });

    // Asynchronous overall validation test
    test('should validate all fields asynchronously', async () => {
        modelManager.clearDirtyData();
        await modelManager.setField('name', '');
        await modelManager.setField('age', 15);

        const isValid = await modelManager.validateAll();
        expect(isValid).toBe(false);
        expect(modelManager.validationErrors).toHaveProperty('name');
        expect(modelManager.validationErrors).toHaveProperty('age');
    });

    // Asynchronous validation rule test
    test('should handle async validation rules', async () => {
        // Test available username
        const result1 = await modelManager.setField('username', 'newuser');
        expect(result1).toBe(true);
        expect(modelManager.validationErrors.username).toEqual([]);

        // Test taken username
        const result2 = await modelManager.setField('username', 'admin');
        expect(result2).toBe(false);
        expect(modelManager.validationErrors.username).toBeDefined();
        expect(modelManager.getValidationSummary()).toContain('username: Username already exists');
    });

    // Asynchronous validation timeout test
    test('should handle async validation timeout', async () => {
        // Create a validator that will timeout
        const timeoutSchema: Model = {
            slowField: {
                type: 'string',
                validator: [
                    new Rule('asyncTimeout', 'Validation timeout', async () => {
                        return new Promise<boolean>((resolve) => {
                            setTimeout(() => resolve(false), 10000);
                        });
                    }),
                ],
            },
        };
        const timeoutModel = createModel(timeoutSchema, { asyncValidationTimeout: 100 });

        const result = await timeoutModel.setField('slowField', 'value');
        expect(result).toBe(false);
        expect(timeoutModel.getValidationSummary()).toContain(
            'slowField: Validation failed: Validation timeout'
        );
    });

    // Invalid batch update test
    test('should reject invalid batch updates asynchronously', async () => {
        const result = await modelManager.setFields({
            name: '',
            age: 'invalid',
            email: 'not-an-email',
        });
        expect(result).toBe(false);
        expect(modelManager.getValidationSummary()).toContain('name: This field is required');
        expect(modelManager.getValidationSummary()).toContain('age: Must be a number');
        expect(modelManager.getValidationSummary()).toContain('email: Invalid email format');
    });
});
