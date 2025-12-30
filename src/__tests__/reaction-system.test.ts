import { createModel, Model } from '../index';

describe('ModelManager - Reaction System', () => {
    // Asynchronous reaction test
    test('should trigger reactions when dependent fields change asynchronously', async () => {
        const reactionSchema: Model = {
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
        const modelManager = createModel(reactionSchema);
        await modelManager.setField('firstName', 'John');
        await modelManager.setField('lastName', 'Doe');
        // Since reactions are now asynchronous, we need to wait a bit
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(modelManager.getField('fullName')).toBe('John Doe');
    });

    // Error handling test
    test('should handle reaction errors asynchronously', async () => {
        const errorReactionSchema: Model = {
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
        const modelManager = createModel(errorReactionSchema);

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
        // Capture console.error output
        console.error = jest.fn();

        const invalidDepsSchema: Model = {
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
        const modelManager = createModel(invalidDepsSchema);

        await modelManager.setField('validField', 'test');
        // Wait for reaction execution
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(console.error).toHaveBeenCalledWith(
            '[dependency_error] field invalidField: Dependency field nonexistentField is not defined'
        );
    });
});
