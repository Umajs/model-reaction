import { createModel, Model } from '../index';

describe('Async Reaction Waiting', () => {
    test('settled() should wait for reactions to complete', async () => {
        const results: string[] = [];
        interface Schema {
            a: number;
            b: number;
            c: number;
        }
        const schema: Model<Schema> = {
            a: { type: 'number', default: 0 },
            b: { 
                type: 'number', 
                default: 0,
                reaction: {
                    fields: ['a'],
                    computed: (deps) => {
                        return deps.a * 2;
                    },
                    action: (vals) => {
                        results.push(`b updated to ${vals.computed}`);
                    }
                }
            },
            c: {
                type: 'number',
                default: 0,
                reaction: {
                    fields: ['b'],
                    computed: (deps) => {
                        return deps.b + 1;
                    },
                    action: (vals) => {
                        results.push(`c updated to ${vals.computed}`);
                    }
                }
            }
        };

        const model = createModel<Schema>(schema);

        // Update 'a'. This triggers 'b', which triggers 'c'.
        // Since reactions trigger async setField calls, simply awaiting setField('a') 
        // might not ensure 'b' and 'c' are done if they are "fire and forget".
        await model.setField('a', 10);

        // Without settled(), this might fail or be flaky if reactions are truly async
        // But in current implementation, processReaction calls setField without awaiting it.
        // So setField('a') returns as soon as 'a' is updated.
        // 'b' update starts but might not be finished.
        
        // We expect results to eventually have both updates.
        // But immediately after setField('a'), they might not be there.
        
        // Check immediate state (might be partial or empty if fully async)
        // Actually current implementation is:
        // setField -> handleValidField -> triggerReactions -> scheduleReaction
        // scheduleReaction -> processReaction -> setField (async)
        // triggerReactions does NOT await scheduleReaction.
        // So setField('a') finishes before 'b' is updated.
        
        // Assert that reactions are NOT done yet (or at least we want to prove we can wait for them)
        // Note: Since everything is microtasks (promises), it's hard to guarantee "not done" 
        // without artificial delays, but we can guarantee "done" after settled().
        
        // If we implement settled(), we can wait.
        await model.settled();

        expect(model.getField('b')).toBe(20);
        expect(model.getField('c')).toBe(21);
        expect(results).toContain('b updated to 20');
        expect(results).toContain('c updated to 21');
    });

    test('settled() should wait for debounced reactions', async () => {
        interface Schema {
            source: string;
            target: string;
        }
        const schema: Model<Schema> = {
            source: { type: 'string', default: '' },
            target: {
                type: 'string',
                default: '',
                reaction: {
                    fields: ['source'],
                    computed: (deps) => deps.source.toUpperCase(),
                }
            }
        };

        // debounceReactions set to 50ms
        const model = createModel<Schema>(schema, { debounceReactions: 50 });

        await model.setField('source', 'hello');
        
        // Immediately, target should not be updated
        expect(model.getField('target')).toBe('');

        // Wait for settled
        await model.settled();

        expect(model.getField('target')).toBe('HELLO');
    });
});
