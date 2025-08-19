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

    // 针对嵌套模型的特殊处理
    if (schema.type === 'model' && schema.model && value !== null && value !== undefined) {
        if (typeof value !== 'object') {
            errors[field] = errors[field] || [];
            errors[field].push({
                field,
                rule: 'type',
                message: `字段 ${field} 必须是一个对象`,
                value
            });
            return false;
        }
    }

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

// 新增：获取对象的嵌套属性
export function getNestedProperty(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        if (result === undefined || result === null) return undefined;
        result = result[key];
    }
    return result;
}

// 新增：设置对象的嵌套属性
export function setNestedProperty(obj: any, path: string, value: any): boolean {
    // 验证输入
    if (!obj || typeof obj !== 'object' || !path || typeof path !== 'string') {
        return false;
    }

    // 分割路径
    const keys = path.split('.');
    // 确保keys不为空
    if (keys.length === 0) {
        return false;
    }

    let current = obj;

    // 防止原型污染的正则表达式
    const PROTO_KEYS = /^(__proto__|constructor|prototype)$/;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        // 断言key不为undefined
        if (key === undefined) continue;

        // 检查是否是原型污染关键字
        if (PROTO_KEYS.test(key)) {
            return false;
        }

        // 检查当前节点是否存在且是对象
        if (current[key] === undefined || current[key] === null) {
            // 下一个键是否是数字（可能是数组索引）
            const nextKey = keys[i + 1];
            // 断言nextKey不为undefined
            if (nextKey === undefined) {
                current[key] = {};
            } else {
                const isArrayIndex = /^\d+$/.test(nextKey);
                current[key] = isArrayIndex ? [] : {};
            }
        } else if (typeof current[key] !== 'object') {
            // 如果当前节点不是对象，不能继续嵌套
            return false;
        }

        current = current[key];
    }

    // 处理最后一个键
    const lastKey = keys[keys.length - 1];
    // 断言lastKey不为undefined
    if (lastKey === undefined || PROTO_KEYS.test(lastKey)) {
        return false;
    }

    // 检查当前节点是否是对象
    if (typeof current !== 'object' || current === null) {
        return false;
    }

    current[lastKey] = value;
    return true;
}