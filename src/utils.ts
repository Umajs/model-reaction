import { ValidationError, Validator, ValidateFieldOptions } from './types';
import { ErrorHandler } from './error-handler';

// Unified validation function - supports both synchronous and asynchronous validation
export async function validateField(options: ValidateFieldOptions): Promise<boolean> {
    const { schema, value, errors, field, timeout = 5000, errorHandler, failFast = false } = options;
    if (!schema.validator) return true;
    let isValid = true;

    if (failFast) {
        // Sequential validation for failFast
        for (const validator of schema.validator) {
            const result = await executeValidator(validator, value, field, timeout, errors, errorHandler);
            if (!result) {
                isValid = false;
                break; // Stop on first error
            }
        }
    } else {
        // Parallel validation (original behavior)
        const validationPromises = schema.validator.map(validator => 
            executeValidator(validator, value, field, timeout, errors, errorHandler)
                .then(res => {
                    if (!res) isValid = false;
                    return res;
                })
        );

        // Wait for all validations to complete
        await Promise.all(validationPromises);
    }

    return isValid;
}

async function executeValidator(
    validator: Validator,
    value: any,
    field: string,
    timeout: number,
    errors: Record<string, ValidationError[]>,
    errorHandler: ErrorHandler
): Promise<boolean> {
    // Handle synchronous validation
    if (!validator.validate) {
        return true;
    }

    try {
        const result = validator.validate(value);
        
        // Check if result is a promise
        if (result instanceof Promise) {
            // Async validation with timeout
            let timeoutId: number;
            const timeoutPromise = new Promise<boolean>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(`Validation timeout: ${field}`)), timeout) as unknown as number;
            });

            try {
                const res = await Promise.race([result, timeoutPromise]);
                clearTimeout(timeoutId!);
                if (!res) {
                    handleValidationError(field, validator, validator.message, errors, errorHandler);
                    return false;
                }
                return true;
            } catch (error) {
                clearTimeout(timeoutId!);
                const errorMessage = error instanceof Error ? error.message : String(error);
                handleExceptionError(field, errorMessage, errors, errorHandler);
                return false;
            }
        } else {
            // Synchronous validation - no timeout needed
            if (!result) {
                handleValidationError(field, validator, validator.message, errors, errorHandler);
                return false;
            }
            return true;
        }
    } catch (error) {
        // Handle synchronous validation errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        handleExceptionError(field, errorMessage, errors, errorHandler);
        return false;
    }
}

function handleValidationError(
    field: string, 
    validator: Validator, 
    message: string, 
    errors: Record<string, ValidationError[]>, 
    errorHandler: ErrorHandler
) {
    errors[field] = errors[field] || [];
    errors[field].push({
        field,
        rule: validator.type,
        message: message
    });
    // Trigger validation error
    const error = errorHandler.createValidationError(field, message);
    errorHandler.triggerError(error);
}

function handleExceptionError(
    field: string, 
    message: string, 
    errors: Record<string, ValidationError[]>, 
    errorHandler: ErrorHandler
) {
    errors[field] = errors[field] || [];
    errors[field].push({
        field,
        rule: 'validation_error',
        message: `Validation failed: ${message}`
    });
    // Trigger validation error
    const appError = errorHandler.createValidationError(field, `Validation failed: ${message}`);
    errorHandler.triggerError(appError);
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
    const isArrayA = Array.isArray(a);
    const isArrayB = Array.isArray(b);

    if (isArrayA !== isArrayB) return false;

    if (isArrayA && isArrayB) {
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
        if (!Object.prototype.hasOwnProperty.call(b, key) || !deepEqual(a[key], b[key])) {
            return false;
        }
    }
    return true;
}
