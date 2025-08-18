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

// 新增：深度比较两个值是否相等
export function deepEqual(a: any, b: any): boolean {
    // 如果引用相同，直接返回true
    if (a === b) return true;

    // 如果其中一个为null或不是对象，返回false
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        return false;
    }

    // 处理数组
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }

    // 处理对象
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