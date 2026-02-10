import { createModel, Model } from '../index';
import { ModelManager } from '../model-manager';

describe('Optimizations and Adjustments', () => {
    
    test('Multiple reactions for the same field should all be executed', async () => {
        const spy1 = jest.fn();
        const spy2 = jest.fn();

        interface Schema {
            source: string;
            target: string;
        }
        const schema: Model<Schema> = {
            source: { type: 'string', default: 'start' },
            target: {
                type: 'string',
                default: 'initial',
                reaction: [
                    {
                        fields: ['source'],
                        computed: (values) => {
                            spy1();
                            return values.source + '_1';
                        }
                    },
                    {
                        fields: ['source'],
                        computed: (values) => {
                            spy2();
                            return values.source + '_2';
                        }
                    }
                ]
            }
        };

        const model = createModel<Schema>(schema);
        
        await model.setField('source', 'update');
        await new Promise(r => setTimeout(r, 20));
        
        expect(spy1).toHaveBeenCalled();
        expect(spy2).toHaveBeenCalled();
        
        // The final value depends on execution order, but both should have run.
        // Since they are scheduled in order, the last one likely wins.
        expect(model.getField('target')).toBe('update_2');
    });

    test('Reaction depending on different fields should only trigger relevant ones', async () => {
        const spy1 = jest.fn();
        const spy2 = jest.fn();

        interface Schema {
            dep1: string;
            dep2: string;
            target: string;
        }
        const schema: Model<Schema> = {
            dep1: { type: 'string', default: 'a' },
            dep2: { type: 'string', default: 'b' },
            target: {
                type: 'string',
                default: '',
                reaction: [
                    {
                        fields: ['dep1'],
                        computed: (values) => {
                            spy1();
                            return values.dep1;
                        }
                    },
                    {
                        fields: ['dep2'],
                        computed: (values) => {
                            spy2();
                            return values.dep2;
                        }
                    }
                ]
            }
        };

        const model = createModel<Schema>(schema);
        
        await model.setField('dep1', 'changed');
        await new Promise(r => setTimeout(r, 20));
        
        expect(spy1).toHaveBeenCalled();
        expect(spy2).not.toHaveBeenCalled(); // Should NOT run because dep2 didn't change
        
        expect(model.getField('target')).toBe('changed');
    });
    
    test('Dispose should clear timeouts', async () => {
        const spy = jest.fn();
        interface Schema {
            source: string;
            target: string;
        }
        const schema: Model<Schema> = {
            source: { type: 'string', default: 'a' },
            target: {
                type: 'string',
                default: 'b',
                reaction: {
                    fields: ['source'],
                    computed: (values) => {
                        spy();
                        return values.source;
                    }
                }
            }
        };

        const modelManager = new ModelManager<Schema>(schema, { debounceReactions: 100 });
        
        // Trigger reaction
        modelManager.setField('source', 'changed');
        
        // Dispose immediately
        modelManager.dispose();
        
        // Wait longer than debounce
        await new Promise(r => setTimeout(r, 150));
        
        // Reaction should NOT have happened
        expect(spy).not.toHaveBeenCalled();
    });

});
