import { createModel, Model } from '../index';

describe('ModelManager - Reaction System', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // Asynchronous reaction test
    test('should trigger reactions when dependent fields change asynchronously', async () => {
        interface ReactionSchema {
            firstName: string;
            lastName: string;
            fullName: string;
        }
        const reactionSchema: Model<ReactionSchema> = {
            firstName: { type: 'string', default: '' },
            lastName: { type: 'string', default: '' },
            fullName: {
                type: 'string',
                default: '',
                reaction: {
                    fields: ['firstName', 'lastName'],
                    computed: (values) => `${values.firstName} ${values.lastName}`,
                },
            },
        };
        const modelManager = createModel<ReactionSchema>(reactionSchema);
        await modelManager.setField('firstName', 'John');
        await modelManager.setField('lastName', 'Doe');
        // Since reactions are now asynchronous, we need to wait a bit
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(modelManager.getField('fullName')).toBe('John Doe');
    });

    // Error handling test
    test('should handle reaction errors asynchronously', async () => {
        interface ErrorReactionSchema {
            input: string;
            output: string;
        }
        const errorReactionSchema: Model<ErrorReactionSchema> = {
            input: { type: 'string', default: '' },
            output: {
                type: 'string',
                default: '',
                reaction: {
                    fields: ['input'],
                    computed: (values) => {
                        if (values.input === 'error') {
                            throw new Error('Computation error');
                        }
                        return values.input.toUpperCase();
                    },
                },
            },
        };
        const modelManager = createModel<ErrorReactionSchema>(errorReactionSchema);

        await modelManager.setField('input', 'error');
        // Wait for reaction execution
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(modelManager.validationErrors).toHaveProperty('__reactions');
        expect(modelManager.validationErrors?.__reactions?.[0]?.message).toContain(
            'Computation error'
        );
    });

    // Invalid dependent fields test
    test('should handle invalid dependent fields in reaction', async () => {
        const consoleSpy = jest.spyOn(console, 'error');

        interface InvalidDepsSchema {
            validField: string;
            invalidField: string;
        }
        const invalidDepsSchema: Model<InvalidDepsSchema> = {
            validField: { type: 'string', default: 'valid' },
            invalidField: {
                type: 'string',
                default: '',
                reaction: {
                    fields: ['validField', 'nonexistentField'], // Depends on non-existent field
                    computed: (values) => values.validField + (values.nonexistentField || ''),
                },
            },
        };
        const modelManager = createModel<InvalidDepsSchema>(invalidDepsSchema);

        await modelManager.setField('validField', 'test');
        // Wait for reaction execution
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[dependency_error] field invalidField: Dependency field nonexistentField is not defined')
        );
    });

    // Circular dependency test
    test('should handle circular dependencies in reaction', async () => {
        const consoleSpy = jest.spyOn(console, 'error');
        
        interface CircularSchema {
            fieldA: number;
            fieldB: number;
        }
        const circularSchema: Model<CircularSchema> = {
            fieldA: {
                type: 'number',
                default: 0,
                reaction: {
                    fields: ['fieldB'],
                    computed: (values) => values.fieldB + 1,
                },
            },
            fieldB: {
                type: 'number',
                default: 0,
                reaction: {
                    fields: ['fieldA'],
                    computed: (values) => values.fieldA + 1,
                },
            },
        };

        const modelManager = createModel<CircularSchema>(circularSchema);

        await modelManager.setField('fieldA', 1);
        
        // Wait for reactions
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[circular_dependency]')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Circular dependency detected')
        );
    });
});
