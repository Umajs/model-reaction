import type { FieldSchema, ValidationError } from './types';

// 工具函数 - 独立的辅助功能
export function validateField(
    schema: FieldSchema,
    value: any,
    errors: Record<string, ValidationError[]>,
    field: string
): boolean {
    if (!schema.validator) return true;
    let isValid = true;

    schema.validator.forEach(validator => {
        if (validator.validate) {
            const validationResult = validator.validate(value);
            if (!validationResult) {
                errors[field] = errors[field] || [];
                errors[field].push({
                    field,
                    rule: validator.type,
                    message: validator.message,
                    value
                });
                isValid = false;
            }
        }
    });

    return isValid;
}