import { ModelManager } from '../model-manager';
import { Model, ValidationRules } from '../index';

interface User {
    id: number;
    name: string;
    email?: string;
}

// Case 1: Valid schema
const validSchema: Model<User> = {
    id: { type: 'number' },
    name: { type: 'string', validator: [ValidationRules.required] },
    email: { type: 'string' }
};
const manager1 = new ModelManager<User>(validSchema);

// Case 2: Missing required field 'name'
// Uncommenting the following lines will cause a compilation error:
// Property 'name' is missing in type '{ id: { type: "number"; }; email: { type: "string"; }; }' but required in type 'Model<User>'.
/*
const invalidSchema1: Model<User> = {
    id: { type: 'number' },
    email: { type: 'string' }
};
*/

// Case 3: Missing optional field 'email'
// Since we used -?, even optional fields in T must be present in Schema
// Uncommenting the following lines will cause a compilation error:
// Property 'email' is missing in type ...
/*
const invalidSchema2: Model<User> = {
    id: { type: 'number' },
    name: { type: 'string' }
};
*/

// Case 4: Extra field 'extra'
// Mapped types should not allow extra fields
// Uncommenting the following lines will cause a compilation error:
// Object literal may only specify known properties, and 'extra' does not exist in type 'Model<User>'.
/*
const invalidSchema3: Model<User> = {
    id: { type: 'number' },
    name: { type: 'string' },
    email: { type: 'string' },
    extra: { type: 'string' }
};
*/

// Case 5: Incorrect type (not FieldSchema)
// Uncommenting the following lines will cause a compilation error:
// Type 'string' is not assignable to type 'FieldSchema'.
/*
const invalidSchema4: Model<User> = {
    id: { type: 'number' },
    name: 'not-a-schema',
    email: { type: 'string' }
};
*/

console.log('Type checks passed if no TS errors are visible.');

describe('Type Checks', () => {
    test('Dummy test for jest', () => {
        expect(true).toBe(true);
    });
});
