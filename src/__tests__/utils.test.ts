import { deepEqual, validateField } from '../utils';
import { ErrorHandler } from '../error-handler';
import { FieldSchema } from '../types';

describe('Utils', () => {
    describe('deepEqual', () => {
        // Basic types
        test('should handle basic types correctly', () => {
            expect(deepEqual(1, 1)).toBe(true);
            expect(deepEqual(1, 2)).toBe(false);
            expect(deepEqual('a', 'a')).toBe(true);
            expect(deepEqual('a', 'b')).toBe(false);
            expect(deepEqual(true, true)).toBe(true);
            expect(deepEqual(true, false)).toBe(false);
            expect(deepEqual(null, null)).toBe(true);
            expect(deepEqual(undefined, undefined)).toBe(true);
            expect(deepEqual(null, undefined)).toBe(false);
        });

        // Arrays
        test('should handle arrays correctly', () => {
            expect(deepEqual([], [])).toBe(true);
            expect(deepEqual([1, 2], [1, 2])).toBe(true);
            expect(deepEqual([1, 2], [1, 3])).toBe(false);
            expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
            expect(deepEqual([1, { a: 1 }], [1, { a: 1 }])).toBe(true);
        });

        // Objects
        test('should handle objects correctly', () => {
            expect(deepEqual({}, {})).toBe(true);
            expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
            expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
            expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
            expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
            
            // Nested objects
            expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
            expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
        });

        // Mixed types and edge cases
        test('should handle mixed types and edge cases', () => {
            expect(deepEqual([], {})).toBe(false);
            expect(deepEqual({}, null)).toBe(false);
            expect(deepEqual(null, {})).toBe(false);
            expect(deepEqual(1, '1')).toBe(false);
            
            const obj = { a: 1 };
            expect(deepEqual(obj, obj)).toBe(true); // Same reference
        });
    });

    describe('validateField', () => {
        test('should handle validator without validate method', async () => {
            const errorHandler = new ErrorHandler();
            const errors = {};
            
            const schema: FieldSchema = {
                type: 'string',
                validator: [
                    // @ts-ignore - simulating invalid validator object
                    {
                        type: 'custom',
                        message: 'error'
                        // missing validate method
                    }
                ]
            };

            const result = await validateField(schema, 'value', errors, 'testField', 1000, errorHandler);
            expect(result).toBe(true);
        });
    });
});
