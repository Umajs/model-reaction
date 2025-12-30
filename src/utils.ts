import { FieldSchema, ValidationError } from './types';
import { ErrorHandler } from './error-handler';

// Unified validation function - supports both synchronous and asynchronous validation
export async function validateField(
    schema: FieldSchema,
    value: any,
    errors: Record<string, ValidationError[]>,
    field: string,
    timeout: number = 5000,
    errorHandler: ErrorHandler // Add error handler parameter
): Promise<boolean> {
    if (!schema.validator) return true;
    let isValid = true;

    // Collect all validation promises
    const validationPromises = schema.validator.map(validator => {
        // Wrap synchronous validation as promise
        let validationPromise: Promise<boolean>;
        if (validator.validate) {
            const result = validator.validate(value);
            if (result instanceof Promise) {
                validationPromise = result;
            } else {
                validationPromise = Promise.resolve(result);
            }
        } else {
            validationPromise = Promise.resolve(true);
        }

        // Add timeout handling
        let timeoutId: number;
        const timeoutPromise = new Promise<boolean>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`Validation timeout: ${field}`)), timeout) as unknown as number;
        });

        return Promise.race([validationPromise, timeoutPromise])
            .then(result => {
                clearTimeout(timeoutId); // Clear timeout after validation completes
                if (!result) {
                    errors[field] = errors[field] || [];
                    errors[field].push({
                        field,
                        rule: validator.type,
                        message: validator.message
                    });
                    isValid = false;
                    // Trigger validation error
                    const error = errorHandler.createValidationError(field, validator.message);
                    errorHandler.triggerError(error);
                }
                return result;
            })
            .catch(error => {
                clearTimeout(timeoutId); // Clear timeout after validation fails
                errors[field] = errors[field] || [];
                const errorMessage = error instanceof Error ? error.message : String(error);
                errors[field].push({
                    field,
                    rule: 'validation_error',
                    message: `Validation failed: ${errorMessage}`
                });
                isValid = false;
                // Trigger validation error
                const appError = errorHandler.createValidationError(field, `Validation failed: ${errorMessage}`);
                errorHandler.triggerError(appError);
                return false;
            });
    });

    // Wait for all validations to complete
    await Promise.all(validationPromises);

    return isValid;
}

// Deep comparison of two values for equality
export function deepEqual(a: any, b: any): boolean {
    // If references are the same, return true directly
    if (a === b) return true;

    // If one is null or not an object, return false
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        return false;
    }

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }

    // Handle objects
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
            return false;
        }
    }
    return true;
}