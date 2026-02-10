import { createModel, Model, ValidationRules } from '../index';

describe('ModelManager - Boundary Cases', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // Boundary cases test
    test('should handle null and undefined values correctly', async () => {
        interface NullableSchema {
            nullableField: string | null;
            requiredField: string | null;
        }
        const nullableSchema: Model<NullableSchema> = {
            nullableField: {
                type: 'string',
                validator: [],
                default: null,
            },
            requiredField: {
                type: 'string',
                validator: [ValidationRules.required],
                default: '',
            },
        };
        const modelManager = createModel<NullableSchema>(nullableSchema);

        expect(modelManager.getField('nullableField')).toBeNull();

        await modelManager.setField('requiredField', null);
        await modelManager.validateAll();
        expect(modelManager.getValidationSummary()).toContain(
            'requiredField: This field is required'
        );
    });

    // Boundary values test
    test('should handle boundary values for number validation', async () => {
        interface BoundarySchema {
            age: number;
        }
        const boundarySchema: Model<BoundarySchema> = {
            age: {
                type: 'number',
                validator: [
                    ValidationRules.required,
                    ValidationRules.number,
                    ValidationRules.min(18),
                ],
                default: 18,
            },
        };
        const modelManager = createModel<BoundarySchema>(boundarySchema);

        // Boundary value test
        await modelManager.setField('age', 18);
        await modelManager.validateAll();
        expect(modelManager.getValidationSummary()).toBe('Validation passed');

        await modelManager.setField('age', 17.9);
        await modelManager.validateAll();
        expect(modelManager.getValidationSummary()).toContain(
            'age: Value must be greater than or equal to 18'
        );

        await modelManager.setField('age', Number.MAX_SAFE_INTEGER);
        await modelManager.validateAll();
        // Large integers should pass validation
        expect(modelManager.getValidationSummary()).toBe('Validation passed');
    });
});
