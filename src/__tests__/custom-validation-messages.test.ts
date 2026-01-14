import { createModel, Model, ValidationRules, Rule, ModelReturn } from '../index';

describe('ModelManager - Custom Validation Messages', () => {
    const testSchema: Model = {
        name: {
            type: 'string',
            validator: [ValidationRules.required.withMessage('Name cannot be empty')],
            default: '',
        },
        age: {
            type: 'number',
            validator: [
                ValidationRules.required.withMessage('Age must be filled'),
                ValidationRules.number.withMessage('Age must be a number'),
                ValidationRules.min(18).withMessage('Age must be at least 18'),
            ],
            default: 18,
        },
        email: {
            type: 'string',
            validator: [
                ValidationRules.required,
                ValidationRules.email.withMessage('Please enter a valid email address'),
            ],
            default: '',
        },
        customRule: {
            type: 'string',
            validator: [
                new Rule('customPattern', 'Default error message', (value: string) => {
                    return value.startsWith('custom_');
                }).withMessage('Value must start with custom_'),
            ],
        },
    };

    let modelManager: ModelReturn;

    beforeEach(() => {
        modelManager = createModel(testSchema);
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // Test custom required message
    test('should use custom required message', async () => {
        await modelManager.setField('name', '');
        expect(modelManager.getValidationSummary()).toContain('name: Name cannot be empty');
    });

    // Test custom number message
    test('should use custom number message', async () => {
        await modelManager.setField('age', 'not-a-number');
        expect(modelManager.getValidationSummary()).toContain('age: Age must be a number');
    });

    // Test custom min message
    test('should use custom min message', async () => {
        await modelManager.setField('age', 16);
        expect(modelManager.getValidationSummary()).toContain('age: Age must be at least 18');
    });

    // Test custom email message
    test('should use custom email message', async () => {
        await modelManager.setField('email', 'invalid-email');
        expect(modelManager.getValidationSummary()).toContain(
            'email: Please enter a valid email address'
        );
    });

    // Test custom rule message
    test('should use custom rule message', async () => {
        await modelManager.setField('customRule', 'wrong_value');
        expect(modelManager.getValidationSummary()).toContain(
            'customRule: Value must start with custom_'
        );
    });

    // Test default message usage when no custom message is set
    test('should use default message when custom message is not set', async () => {
        await modelManager.setField('email', '');
        expect(modelManager.getValidationSummary()).toContain('email: This field is required');
    });
});
