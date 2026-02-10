import { createModel, Model } from '../index';

describe('Reproduce Issues', () => {
    // Issue 1: Async Validation Race Condition
    test('Race condition in async validation', async () => {
        interface Schema {
            field: string;
        }
        const schema: Model<Schema> = {
            field: {
                type: 'string',
                validator: [
                    {
                        type: 'async',
                        validate: async (val: any) => {
                            if (val === 'slow') {
                                await new Promise(resolve => setTimeout(resolve, 100));
                                return true;
                            }
                            if (val === 'fast') {
                                await new Promise(resolve => setTimeout(resolve, 10));
                                return true;
                            }
                            return true;
                        },
                        message: 'error'
                    }
                ],
                default: ''
            }
        };
        const model = createModel<Schema>(schema);

        // Start slow request first
        const p1 = model.setField('field', 'slow');
        // Start fast request immediately after
        const p2 = model.setField('field', 'fast');

        await Promise.all([p1, p2]);
        
        // Wait a bit more to ensure everything settled
        await new Promise(resolve => setTimeout(resolve, 150));
        
        expect(model.getField('field')).toBe('fast');
    });

    // Issue 2: Double Reaction Triggering
    test('Double reaction triggering in batch updates', async () => {
        const reactionFn = jest.fn((deps) => deps.a + deps.b);
        interface Schema {
            a: number;
            b: number;
            c: number;
        }
        const schema: Model<Schema> = {
            a: { type: 'number', default: 0 },
            b: { type: 'number', default: 0 },
            c: {
                type: 'number',
                default: 0,
                reaction: {
                    fields: ['a', 'b'],
                    computed: reactionFn
                }
            }
        };
        const model = createModel<Schema>(schema);

        await model.setFields({ a: 1, b: 2 });
        
        // Wait for reactions to complete (setField inside reaction is async)
        await new Promise(resolve => setTimeout(resolve, 50));
        
        expect(reactionFn).toHaveBeenCalledTimes(1);
        expect(model.getField('c')).toBe(3);
    });
});
