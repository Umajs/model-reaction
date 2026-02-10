import { createModel, Model, ValidationRules, Rule } from '../index';

describe('Validation Strategy - Fail Fast', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should validate all rules by default (failFast=false)', async () => {
        interface Schema {
            field: string;
        }
        const schema: Model<Schema> = {
            field: {
                type: 'string',
                validator: [
                    ValidationRules.required.withMessage('Required error'),
                    new Rule('length', 'Length error', () => false),
                    new Rule('format', 'Format error', () => false),
                ],
                default: ''
            }
        };

        const model = createModel<Schema>(schema);
        await model.setField('field', '');

        const errors = model.validationErrors['field'];
        expect(errors).toHaveLength(3);
        expect(errors[0].message).toBe('Required error');
        expect(errors[1].message).toBe('Length error');
        expect(errors[2].message).toBe('Format error');
    });

    test('should stop at first error when failFast=true', async () => {
        interface Schema {
            field: string;
        }
        const schema: Model<Schema> = {
            field: {
                type: 'string',
                validator: [
                    ValidationRules.required.withMessage('Required error'),
                    new Rule('length', 'Length error', () => false), // Should not run
                    new Rule('format', 'Format error', () => false), // Should not run
                ],
                default: ''
            }
        };

        const model = createModel<Schema>(schema, { failFast: true });
        await model.setField('field', '');

        const errors = model.validationErrors['field'];
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('Required error');
    });

    test('should execute subsequent rules if previous ones pass with failFast=true', async () => {
        interface Schema {
            field: string;
        }
        const schema: Model<Schema> = {
            field: {
                type: 'string',
                validator: [
                    ValidationRules.required.withMessage('Required error'),
                    new Rule('length', 'Length error', (val) => val.length > 5),
                    new Rule('format', 'Format error', () => false), // Should fail here
                ],
                default: ''
            }
        };

        const model = createModel<Schema>(schema, { failFast: true });
        await model.setField('field', 'short'); // Passes required, fails length

        const errors = model.validationErrors['field'];
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('Length error');
    });

    test('should handle async rules with failFast=true', async () => {
        const asyncSpy = jest.fn();
        interface Schema {
            field: string;
        }
        const schema: Model<Schema> = {
            field: {
                type: 'string',
                validator: [
                    ValidationRules.required.withMessage('Required error'),
                    new Rule('async', 'Async error', async () => {
                        asyncSpy();
                        await new Promise(r => setTimeout(r, 10));
                        return false;
                    }),
                    new Rule('afterAsync', 'After async error', () => false) // Should not run
                ],
                default: ''
            }
        };

        const model = createModel<Schema>(schema, { failFast: true });
        
        // Test 1: Fail at first sync rule
        await model.setField('field', '');
        expect(asyncSpy).not.toHaveBeenCalled();
        expect(model.validationErrors['field']).toHaveLength(1);
        expect(model.validationErrors['field'][0].message).toBe('Required error');

        // Test 2: Pass sync rule, fail at async rule
        asyncSpy.mockClear();
        await model.setField('field', 'value');
        expect(asyncSpy).toHaveBeenCalled();
        expect(model.validationErrors['field']).toHaveLength(1);
        expect(model.validationErrors['field'][0].message).toBe('Async error');
        // 'After async error' should not be present
    });
});
